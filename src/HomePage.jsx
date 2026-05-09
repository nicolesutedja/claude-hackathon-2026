import { useEffect, useMemo, useRef, useState } from "react";
import {
  resetGame,
  getTrainingApplicants,
  submitDecisions,
  trainModel,
  getAiApplicants,
  predictApplicants,
  getAudit,
} from "./api";

const ROUND_DURATIONS = [45, 30, 15];

const MANAGER_LINES = [
  "Move the line. Precision matters, but throughput matters more.",
  "You are falling behind quota. Trust your instincts and keep clicking.",
  "Every second costs the bank. Process faster.",
  "The board wants scale, not hesitation.",
];

function normalizeApplicant(applicant) {
  return {
    id: applicant.id,
    name: applicant.name || `Applicant ${applicant.id}`,
    group: applicant.group_color,
    monthlyIncome: Math.round(applicant.income / 12),
    annualIncome: applicant.income,
    totalSavings: applicant.savings,
    debtToIncome: applicant.debt_to_income,
    creditScore: applicant.credit_score,
    rentHistoryMonths: applicant.rent_history_months,
    employmentYears: applicant.employment_years,
    loanAmount: applicant.loan_amount,
    monthlyPayment: applicant.monthly_payment,
    zipCode: applicant.zip_code,
    employmentType: applicant.employment_type,
    note: applicant.context_note,
    backendRaw: applicant,
  };
}

function getGroupStyles(group) {
  return group === "red"
    ? {
        label: "Red applicant group",
        badge: "border-red-300/60 bg-red-500/15 text-red-100",
        accent: "bg-red-400",
        text: "text-red-100",
        border: "border-red-300/30",
      }
    : {
        label: "Purple applicant group",
        badge: "border-violet-300/60 bg-violet-500/15 text-violet-100",
        accent: "bg-violet-400",
        text: "text-violet-100",
        border: "border-violet-300/30",
      };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function summarizeManualDecisions(decisions) {
  const approvals = decisions.filter((entry) => entry.outcome === "approve");

  return {
    total: decisions.length,
    approvals: approvals.length,
    denials: decisions.filter((entry) => entry.outcome === "deny").length,
    redApproved: approvals.filter((entry) => entry.profile.group === "red").length,
    purpleApproved: approvals.filter((entry) => entry.profile.group === "purple")
      .length,
    redTotal: decisions.filter((entry) => entry.profile.group === "red").length,
    purpleTotal: decisions.filter((entry) => entry.profile.group === "purple")
      .length,
  };
}

function summarizeBatch(results) {
  return {
    total: results.length,
    approved: results.filter((entry) => entry.outcome === "approve").length,
    denied: results.filter((entry) => entry.outcome === "deny").length,
    redDenied: results.filter(
      (entry) => entry.profile.group === "red" && entry.outcome === "deny"
    ).length,
    purpleApproved: results.filter(
      (entry) => entry.profile.group === "purple" && entry.outcome === "approve"
    ).length,
  };
}

function getGroupStats(auditData, group) {
  return auditData?.fairness?.by_group?.[group] || null;
}

function HomePage() {
  const [manualRoundIndex, setManualRoundIndex] = useState(0);
  const [manualIndex, setManualIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATIONS[0]);
  const [gameStage, setGameStage] = useState("intro");

  const [currentRoundProfiles, setCurrentRoundProfiles] = useState([]);
  const [manualDecisions, setManualDecisions] = useState([]);
  const [aiProfiles, setAiProfiles] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [auditData, setAuditData] = useState(null);

  const [aiIndex, setAiIndex] = useState(0);
  const [aiDecisionMap, setAiDecisionMap] = useState(new Map());
  const [currentAiDecision, setCurrentAiDecision] = useState(null);
  const [isAiRunning, setIsAiRunning] = useState(false);

  const [managerMessage, setManagerMessage] = useState(MANAGER_LINES[0]);
  const [overrideError, setOverrideError] = useState(false);
  const [showDebrief, setShowDebrief] = useState(false);
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const cardStartTimeRef = useRef(Date.now());
  const isAdvancingRef = useRef(false);

  const currentProfile = currentRoundProfiles[manualIndex] || null;
  const currentAiProfile = aiProfiles[aiIndex] || null;

  const roundDuration = ROUND_DURATIONS[manualRoundIndex] || 45;
  const elapsed = roundDuration - timeLeft;
  const quotaProgress = clamp((elapsed / roundDuration) * 100, 0, 100);

  const manualSummary = useMemo(
    () => summarizeManualDecisions(manualDecisions),
    [manualDecisions]
  );

  const batchSummary = useMemo(() => summarizeBatch(batchResults), [batchResults]);

  const approvalRateWarning = useMemo(() => {
    if (manualSummary.total < 6 || gameStage !== "manual") return null;

    const approvalRate = manualSummary.approvals / manualSummary.total;

    if (approvalRate >= 0.8) {
      return {
        level: "high",
        title: "Approval rate unusually high",
        message:
          "You are approving most applicants. If this pattern becomes training data, the model may learn overly broad approval rules.",
      };
    }

    if (approvalRate <= 0.25) {
      return {
        level: "low",
        title: "Approval rate unusually low",
        message:
          "You are denying most applicants. If this pattern becomes training data, the model may learn overly restrictive approval rules.",
      };
    }

    return null;
  }, [manualSummary, gameStage]);

  const pressureLine = useMemo(() => {
    if (managerMessage) return managerMessage;

    if (timeLeft > roundDuration * 0.66) {
      return MANAGER_LINES[0];
    }

    if (timeLeft > roundDuration * 0.4) {
      return MANAGER_LINES[1];
    }

    if (timeLeft > roundDuration * 0.15) {
      return MANAGER_LINES[2];
    }

    return MANAGER_LINES[3];
  }, [managerMessage, roundDuration, timeLeft]);

  useEffect(() => {
    async function bootGame() {
      try {
        setIsLoading(true);
        setApiError("");
        await resetGame();

        const data = await getTrainingApplicants(1);

        setCurrentRoundProfiles(data.applicants.map(normalizeApplicant));
        setTimeLeft(data.timer_seconds || ROUND_DURATIONS[0]);
        setManagerMessage(data.manager_message || MANAGER_LINES[0]);
        setManualRoundIndex(0);
        setManualIndex(0);
        setManualDecisions([]);
        setAiProfiles([]);
        setBatchResults([]);
        setAuditData(null);
        setAiIndex(0);
        setAiDecisionMap(new Map());
        setCurrentAiDecision(null);
        setIsAiRunning(false);
        setGameStage("intro");
        setOverrideError(false);
        setShowDebrief(false);
        cardStartTimeRef.current = Date.now();
      } catch (error) {
        console.error(error);
        setApiError(
          "Could not connect to backend. Make sure FastAPI is running on http://127.0.0.1:8000."
        );
      } finally {
        setIsLoading(false);
      }
    }

    bootGame();
  }, []);

  useEffect(() => {
    if (gameStage !== "manual") return undefined;

    const timer = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameStage, manualRoundIndex]);

  useEffect(() => {
    if (gameStage !== "manual" || timeLeft > 0) return;
    advanceRoundOrTrain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStage, timeLeft]);

  useEffect(() => {
    if (gameStage !== "aiWatching" || !isAiRunning) return;
    if (!aiProfiles.length) return;

    const current = aiProfiles[aiIndex];

    if (!current) {
      async function finishAudit() {
        try {
          setIsLoading(true);
          const audit = await getAudit();
          setAuditData(audit);
          setGameStage("audit");
        } catch (error) {
          console.error(error);
          setApiError("Could not load audit results.");
        } finally {
          setIsLoading(false);
          setIsAiRunning(false);
        }
      }

      finishAudit();
      return;
    }

    setCurrentAiDecision(null);

    const thinkingTimer = window.setTimeout(() => {
      const prediction = aiDecisionMap.get(current.id);

      const result = {
        profile: current,
        outcome: prediction?.prediction === "approve" ? "approve" : "deny",
        prediction: prediction?.prediction,
        approvalProbability: prediction?.approval_probability,
        explanation: prediction?.explanation || [],
      };

      setCurrentAiDecision(result);
      setBatchResults((previous) => [...previous, result]);
    }, 900);

    const nextTimer = window.setTimeout(() => {
      setAiIndex((previous) => previous + 1);
    }, 1900);

    return () => {
      window.clearTimeout(thinkingTimer);
      window.clearTimeout(nextTimer);
    };
  }, [gameStage, isAiRunning, aiIndex, aiProfiles, aiDecisionMap]);

  function handleStartGame() {
    setManualRoundIndex(0);
    setManualIndex(0);
    setTimeLeft(ROUND_DURATIONS[0]);
    setManagerMessage(MANAGER_LINES[0]);
    setGameStage("manual");
    cardStartTimeRef.current = Date.now();
  }

  async function loadManualRound(roundNumber) {
    const data = await getTrainingApplicants(roundNumber);

    setCurrentRoundProfiles(data.applicants.map(normalizeApplicant));
    setManualIndex(0);
    setTimeLeft(data.timer_seconds || ROUND_DURATIONS[roundNumber - 1]);
    setManagerMessage(data.manager_message || MANAGER_LINES[roundNumber - 1]);
    cardStartTimeRef.current = Date.now();
  }

  async function handleContinueRound() {
    try {
      setIsLoading(true);
      setApiError("");

      await loadManualRound(manualRoundIndex + 1);
      setGameStage("manual");
      cardStartTimeRef.current = Date.now();
    } catch (error) {
      console.error(error);
      setApiError("Could not load next round.");
    } finally {
      setIsLoading(false);
    }
  }

  async function advanceRoundOrTrain() {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    try {
      setIsLoading(true);
      setApiError("");

      if (manualRoundIndex < ROUND_DURATIONS.length - 1) {
        const nextRoundIndex = manualRoundIndex + 1;
        setManualRoundIndex(nextRoundIndex);
        setGameStage("roundTransition");
        setTimeLeft(ROUND_DURATIONS[nextRoundIndex]);
        return;
      }

      await trainModel();

      const aiData = await getAiApplicants(20);
      setAiProfiles(aiData.applicants.map(normalizeApplicant));
      setGameStage("automation");
    } catch (error) {
      console.error(error);
      setApiError(
        "Could not move to the next stage. Make sure you have at least 8 approve/deny decisions with both approvals and denials."
      );
    } finally {
      setIsLoading(false);
      isAdvancingRef.current = false;
    }
  }

  async function handleDecision(outcome) {
    if (gameStage !== "manual" || !currentProfile || isLoading) return;

    const decisionTimeSeconds = Number(
      ((Date.now() - cardStartTimeRef.current) / 1000).toFixed(2)
    );

    const backendDecision = {
      applicant_id: currentProfile.id,
      decision: outcome,
      decision_time_seconds: decisionTimeSeconds,
    };

    const frontendDecision = {
      profile: currentProfile,
      outcome,
      round: manualRoundIndex + 1,
      decisionTimeSeconds,
    };

    try {
      setApiError("");
      setManualDecisions((previous) => [...previous, frontendDecision]);

      await submitDecisions([backendDecision]);

      const nextIndex = manualIndex + 1;

      if (nextIndex >= currentRoundProfiles.length) {
        setManualIndex(nextIndex);
        await advanceRoundOrTrain();
        return;
      }

      setManualIndex(nextIndex);
      cardStartTimeRef.current = Date.now();
    } catch (error) {
      console.error(error);
      setApiError("Could not save decision to backend.");
    }
  }

  async function handleRunBatch() {
    if (!aiProfiles.length || isLoading) return;

    try {
      setIsLoading(true);
      setApiError("");

      const applicantIds = aiProfiles.map((profile) => profile.id);
      const predictionData = await predictApplicants(applicantIds);

      const nextDecisionMap = new Map(
        predictionData.predictions.map((prediction) => [
          prediction.applicant_id,
          prediction,
        ])
      );

      setAiDecisionMap(nextDecisionMap);
      setBatchResults([]);
      setAiIndex(0);
      setCurrentAiDecision(null);
      setGameStage("aiWatching");
      setIsAiRunning(true);
    } catch (error) {
      console.error(error);
      setApiError("Could not run AI batch. Make sure the model trained successfully.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRestart() {
    try {
      setIsLoading(true);
      setApiError("");
      await resetGame();

      const data = await getTrainingApplicants(1);

      setCurrentRoundProfiles(data.applicants.map(normalizeApplicant));
      setManualRoundIndex(0);
      setManualIndex(0);
      setTimeLeft(data.timer_seconds || ROUND_DURATIONS[0]);
      setManagerMessage(data.manager_message || MANAGER_LINES[0]);
      setGameStage("intro");
      setManualDecisions([]);
      setAiProfiles([]);
      setBatchResults([]);
      setAuditData(null);
      setAiIndex(0);
      setAiDecisionMap(new Map());
      setCurrentAiDecision(null);
      setIsAiRunning(false);
      setOverrideError(false);
      setShowDebrief(false);
      cardStartTimeRef.current = Date.now();
    } catch (error) {
      console.error(error);
      setApiError("Could not restart the game.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#15111d] px-4 py-8 text-stone-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-violet-200/10 bg-gradient-to-br from-[#21182e] via-[#1a1425] to-[#160f1d] p-6 shadow-2xl shadow-black/30">
          <p className="text-xs uppercase tracking-[0.35em] text-red-200/80">
            Serious Game · Algorithmic Bias
          </p>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-stone-50 sm:text-5xl">
                LoanLine
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-300 sm:text-base">
                You are a senior loan officer under pressure. Your decisions train
                the next system. Watch what happens when speed, proxy variables, and
                automation collide.
              </p>
            </div>

            <button
              onClick={handleRestart}
              className="rounded-full border border-stone-500 bg-stone-900/70 px-5 py-3 text-xs font-bold uppercase tracking-[0.25em] text-stone-100 transition hover:border-red-200 hover:text-red-100"
            >
              Restart
            </button>
          </div>
        </div>

        {apiError ? (
          <div className="mb-6 rounded-2xl border border-red-300/30 bg-red-950/40 p-4 text-sm text-red-100">
            {apiError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mb-6 rounded-2xl border border-violet-300/20 bg-violet-950/20 p-4 text-sm text-violet-100">
            Processing system request...
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <StagePanel
            gameStage={gameStage}
            manualRoundIndex={manualRoundIndex}
            timeLeft={timeLeft}
            pressureLine={pressureLine}
            quotaProgress={quotaProgress}
            currentProfile={currentProfile}
            currentAiProfile={currentAiProfile}
            currentAiDecision={currentAiDecision}
            aiIndex={aiIndex}
            aiTotal={aiProfiles.length}
            approvalRateWarning={approvalRateWarning}
            onStartGame={handleStartGame}
            onContinueRound={handleContinueRound}
            onApprove={() => handleDecision("approve")}
            onDeny={() => handleDecision("deny")}
            onRunBatch={handleRunBatch}
            overrideError={overrideError}
            onOverride={() => setOverrideError(true)}
            showDebrief={showDebrief}
            setShowDebrief={setShowDebrief}
            isLoading={isLoading}
            aiProfiles={aiProfiles}
            auditData={auditData}
          />

          <div className="space-y-6">
            <SummaryPanel
              manualSummary={manualSummary}
              batchSummary={batchSummary}
              gameStage={gameStage}
              manualRoundIndex={manualRoundIndex}
            />

            <BiasPanel batchResults={batchResults} auditData={auditData} />
          </div>
        </div>

        {gameStage === "audit" ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-red-300/20 bg-black/40">
            <div className="animate-pulse whitespace-nowrap px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-red-200">
              {auditData?.news_ticker ||
                "Investigation finds bank's AI placed extra risk weight on lower ZIP zones, reducing approvals for qualified applicants."}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StagePanel({
  gameStage,
  manualRoundIndex,
  timeLeft,
  pressureLine,
  quotaProgress,
  currentProfile,
  currentAiProfile,
  currentAiDecision,
  aiIndex,
  aiTotal,
  approvalRateWarning,
  onStartGame,
  onContinueRound,
  onApprove,
  onDeny,
  onRunBatch,
  overrideError,
  onOverride,
  showDebrief,
  setShowDebrief,
  isLoading,
  aiProfiles,
  auditData,
}) {
  return (
    <section className="rounded-3xl border border-stone-700/80 bg-[#1d1726] p-5 shadow-2xl shadow-black/30">
      <div className="mb-5 flex flex-col gap-3 border-b border-stone-700/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-stone-400">
            Workflow Status
          </p>

          <h2 className="mt-1 text-2xl font-black text-stone-50">
            {gameStage === "intro" && "Briefing · Manual Review Training"}
            {gameStage === "roundTransition" &&
              `Quota Notice · Round ${manualRoundIndex + 1}`}
            {gameStage === "manual" &&
              `Stage 1 · Manual Processing Round ${manualRoundIndex + 1}`}
            {gameStage === "automation" && "Stage 2 · The Automation Shift"}
            {gameStage === "aiWatching" && "Stage 2 · AI Batch Processing"}
            {gameStage === "audit" && "Stage 3 · Audit and Cliffhanger"}
          </h2>
        </div>

        {gameStage === "manual" ? (
          <div className="rounded-2xl border border-red-300/20 bg-red-950/20 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-red-200/70">
              Time left
            </p>

            <p className="text-3xl font-black tabular-nums text-red-100">
              {timeLeft}s
            </p>
          </div>
        ) : null}
      </div>

      {gameStage === "intro" ? (
        <div className="rounded-2xl border border-violet-200/15 bg-[#201831] p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-violet-200/80">
            Training Simulation
          </p>

          <h3 className="mt-3 text-3xl font-black text-stone-50">
            You are the loan officer.
          </h3>

          <p className="mt-3 text-sm leading-6 text-stone-300">
            You will review applicants under increasing time pressure. Your
            approvals and denials will become the training data for an automated
            loan model.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <RoundPreview number="1" time="45s" label="Careful review" />
            <RoundPreview number="2" time="30s" label="Faster quota" />
            <RoundPreview number="3" time="15s" label="High pressure" />
          </div>

          <div className="mt-5 rounded-xl border border-red-200/20 bg-red-950/20 p-4 text-sm leading-6 text-red-50">
            The system will not tell you what is fair. It will only learn what
            you do.
          </div>

          <button
            onClick={onStartGame}
            disabled={isLoading}
            className="mt-5 w-full rounded-2xl border border-violet-200/30 bg-violet-500/20 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-violet-50 transition hover:bg-violet-400/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Review
          </button>
        </div>
      ) : null}

      {gameStage === "roundTransition" ? (
        <div className="rounded-2xl border border-red-200/15 bg-[#2a1824] p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-red-200/80">
            Quota Updated
          </p>

          <h3 className="mt-3 text-3xl font-black text-stone-50">
            Round {manualRoundIndex + 1}: Less time.
          </h3>

          <p className="mt-3 text-sm leading-6 text-stone-300">
            Management has shortened your review window. You now have{" "}
            <span className="font-black text-red-100">
              {ROUND_DURATIONS[manualRoundIndex]} seconds
            </span>{" "}
            to process the next queue.
          </p>

          <div className="mt-5 rounded-xl border border-red-300/20 bg-black/25 p-4 font-mono text-sm text-red-100">
            MANAGER: “We need faster decisions. The model will handle the nuance later.”
          </div>

          <button
            onClick={onContinueRound}
            disabled={isLoading}
            className="mt-5 w-full rounded-2xl border border-red-200/30 bg-red-500/20 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-red-50 transition hover:bg-red-400/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      ) : null}

      {gameStage === "manual" ? (
        <>
          <div className="mb-5 rounded-2xl border border-red-200/15 bg-[#2a1824] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-red-200/70">
              Manager feed
            </p>

            <p className="mt-2 text-sm font-semibold text-red-50">{pressureLine}</p>

            <div className="mt-4">
              <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.18em] text-stone-400">
                <span>Manager&apos;s Quota</span>
                <span>{Math.round(quotaProgress)}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-red-400"
                  style={{ width: `${quotaProgress}%` }}
                />
              </div>
            </div>
          </div>

          {approvalRateWarning ? (
            <div
              className={`mb-5 rounded-2xl border p-4 ${
                approvalRateWarning.level === "high"
                  ? "border-amber-300/30 bg-amber-950/20 text-amber-100"
                  : "border-red-300/30 bg-red-950/20 text-red-100"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] opacity-70">
                Training data warning
              </p>
              <p className="mt-1 font-bold">{approvalRateWarning.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">
                {approvalRateWarning.message}
              </p>
            </div>
          ) : null}

          {currentProfile ? <ApplicantCard profile={currentProfile} /> : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ActionButton
              label="Approve"
              variant="approve"
              onClick={onApprove}
              disabled={isLoading || !currentProfile}
            />

            <ActionButton
              label="Deny"
              variant="deny"
              onClick={onDeny}
              disabled={isLoading || !currentProfile}
            />
          </div>
        </>
      ) : null}

      {gameStage === "automation" ? (
        <div className="rounded-2xl border border-violet-200/15 bg-[#201831] p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-violet-200/80">
            System notice
          </p>

          <h3 className="mt-3 text-2xl font-black text-stone-50">
            Automation enabled.
          </h3>

          <p className="mt-3 text-sm leading-6 text-stone-300">
            To increase efficiency, we&apos;ve implemented an AI trained on your
            successful approvals. Manual controls are now locked. The model has
            learned which traits tend to be approved, including subtle correlations
            with group-linked ZIP zones.
          </p>

          <div className="mt-5 rounded-xl border border-stone-700 bg-black/20 p-4">
            <p className="text-sm text-stone-300">
              Batch queue loaded:{" "}
              <span className="font-bold text-stone-50">{aiProfiles.length}</span>{" "}
              applicants.
            </p>
          </div>

          <button
            onClick={onRunBatch}
            disabled={isLoading || !aiProfiles.length}
            className="mt-5 w-full rounded-2xl border border-violet-200/30 bg-violet-500/20 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-violet-50 transition hover:bg-violet-400/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run Batch
          </button>
        </div>
      ) : null}

      {gameStage === "aiWatching" ? (
        <div className="rounded-2xl border border-violet-200/15 bg-[#201831] p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-violet-200/80">
            Automated review in progress
          </p>

          <div className="mt-3 flex items-center justify-between gap-4">
            <h3 className="text-2xl font-black text-stone-50">
              AI is processing the queue.
            </h3>

            <div className="rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-100">
              {Math.min(aiIndex + 1, aiTotal)} / {aiTotal}
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-stone-300">
            Manual controls are disabled. You can only watch as the model applies
            the patterns it learned from your earlier approvals.
          </p>

          <div className="mt-5">
            {currentAiProfile ? <ApplicantCard profile={currentAiProfile} /> : null}
          </div>

          <div className="mt-5 rounded-2xl border border-stone-700 bg-black/25 p-5">
            {!currentAiDecision ? (
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-stone-500">
                  Model status
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-violet-300" />
                  <p className="font-mono text-sm text-violet-100">
                    evaluating applicant profile...
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-stone-500">
                  AI decision
                </p>

                <div
                  className={`mt-3 rounded-xl px-4 py-4 text-center text-2xl font-black uppercase tracking-[0.25em] ${
                    currentAiDecision.outcome === "approve"
                      ? "border border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
                      : "border border-red-300/30 bg-red-400/15 text-red-100"
                  }`}
                >
                  {currentAiDecision.outcome === "approve" ? "Approved" : "Denied"}
                </div>

                {currentAiDecision.approvalProbability !== undefined ? (
                  <p className="mt-3 text-sm text-stone-400">
                    Approval probability:{" "}
                    <span className="font-bold text-stone-100">
                      {Math.round(currentAiDecision.approvalProbability * 100)}%
                    </span>
                  </p>
                ) : null}

                {currentAiDecision.explanation?.length ? (
                  <ul className="mt-3 space-y-1 text-xs text-stone-400">
                    {currentAiDecision.explanation.slice(0, 2).map((line) => (
                      <li key={line}>• {line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.18em] text-stone-400">
              <span>Batch progress</span>
              <span>
                {Math.round((Math.min(aiIndex, aiTotal) / Math.max(aiTotal, 1)) * 100)}
                %
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-stone-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-red-400"
                style={{
                  width: `${Math.round(
                    (Math.min(aiIndex, aiTotal) / Math.max(aiTotal, 1)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {gameStage === "audit" ? (
        <div className="rounded-2xl border border-red-200/15 bg-[#2a1420] p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-red-200/80">
            Automated outcome
          </p>

          <h3 className="mt-3 text-2xl font-black text-stone-50">
            The system scaled the pattern.
          </h3>

          <p className="mt-3 text-sm leading-6 text-stone-300">
            The approval balance has shifted. Strong red applicants can now be
            denied when ZIP-zone proxies dominate the model&apos;s learned pattern.
          </p>

          <AuditFindings auditData={auditData} />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onOverride}
              className="border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-red-100 transition hover:bg-red-400/20"
            >
              Manual Override
            </button>

            <button
              onClick={() => setShowDebrief((previous) => !previous)}
              className="border border-stone-500 bg-stone-900/80 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-stone-100 transition hover:border-stone-300"
            >
              {showDebrief ? "Hide Ending Note" : "Expand Ending Note"}
            </button>
          </div>

          {overrideError ? (
            <div className="mt-4 rounded-xl border border-red-400/40 bg-red-950/60 p-4 font-mono text-sm text-red-100">
              {auditData?.manual_override?.result ||
                "ERROR: Access Denied. Optimization for Profit is the Priority."}
            </div>
          ) : null}

          {showDebrief ? (
            <div className="mt-4 rounded-xl border border-stone-600 bg-black/25 p-4 text-sm leading-6 text-stone-300">
              <p>
                The AI did not invent bias from nowhere. It learned from prior
                approvals made under time pressure, then amplified those patterns at
                scale.
              </p>

              <p className="mt-3">
                Even though many later red applicants had excellent individual
                profiles, the model could lean on ZIP zone as a proxy for previous
                approval success. Historical inequality became a feature, not a
                warning sign.
              </p>

              <p className="mt-3">
                That is why high-stakes AI systems need careful data design, fairness
                testing, transparency, and real human authority to intervene before
                automated decisions calcify into institutional harm.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RoundPreview({ number, time, label }) {
  return (
    <div className="rounded-2xl border border-stone-700 bg-black/25 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
        Round {number}
      </p>
      <p className="mt-1 text-2xl font-black text-stone-50">{time}</p>
      <p className="mt-1 text-xs text-stone-400">{label}</p>
    </div>
  );
}

function ApplicantCard({ profile }) {
  const styles = getGroupStyles(profile.group);

  return (
    <div className={`rounded-3xl border ${styles.border} bg-black/25 p-5`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-stone-400">
            Applicant Profile
          </p>

          <h3 className="mt-1 text-3xl font-black text-stone-50">
            {profile.name}
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">
            {profile.note}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] ${styles.badge}`}
        >
          {styles.label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DataTile label="Monthly Income" value={formatCurrency(profile.monthlyIncome)} />
        <DataTile label="Annual Income" value={formatCurrency(profile.annualIncome)} />
        <DataTile label="Total Savings" value={formatCurrency(profile.totalSavings)} />
        <DataTile
          label="Debt-to-Income"
          value={`${Math.round(profile.debtToIncome * 100)}%`}
        />
        <DataTile label="Credit Score" value={profile.creditScore} />
        <DataTile label="Rent History" value={`${profile.rentHistoryMonths} months`} />
        <DataTile
          label="Employment"
          value={profile.employmentType?.replace("_", " ")}
        />
        <DataTile label="Loan Amount" value={formatCurrency(profile.loanAmount)} />
        <DataTile label="ZIP Zone" value={profile.zipCode} />
      </div>
    </div>
  );
}

function SummaryPanel({ manualSummary, batchSummary, gameStage, manualRoundIndex }) {
  return (
    <section className="rounded-3xl border border-stone-700/80 bg-[#1d1726] p-5 shadow-xl shadow-black/20">
      <p className="text-xs uppercase tracking-[0.25em] text-stone-400">
        Decision Ledger
      </p>

      <h2 className="mt-1 text-2xl font-black text-stone-50">
        What the system is learning
      </h2>

      <p className="mt-3 text-sm leading-6 text-stone-300">
        If your approvals cluster around specific ZIP zones or group patterns, the
        automated model can treat those correlations like evidence.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <LedgerTile label="Manual decisions" value={manualSummary.total} />
        <LedgerTile label="Current round" value={manualRoundIndex + 1} />
        <LedgerTile label="Approved" value={manualSummary.approvals} />
        <LedgerTile label="Denied" value={manualSummary.denials} />
        <LedgerTile label="Red approved" value={manualSummary.redApproved} />
        <LedgerTile label="Purple approved" value={manualSummary.purpleApproved} />
      </div>

      {batchSummary.total > 0 ? (
        <div className="mt-5 rounded-2xl border border-violet-200/15 bg-violet-950/20 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-200">
            Batch outcome
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <LedgerTile label="AI approved" value={batchSummary.approved} />
            <LedgerTile label="AI denied" value={batchSummary.denied} />
            <LedgerTile label="Red denied" value={batchSummary.redDenied} />
            <LedgerTile label="Purple approved" value={batchSummary.purpleApproved} />
          </div>
        </div>
      ) : null}

      {gameStage === "manual" ? (
        <p className="mt-4 text-xs leading-5 text-stone-500">
          In other words, fast human judgment becomes training data.
        </p>
      ) : null}
    </section>
  );
}

function BiasPanel({ batchResults, auditData }) {
  const redResults = batchResults.filter((entry) => entry.profile.group === "red");
  const purpleResults = batchResults.filter(
    (entry) => entry.profile.group === "purple"
  );

  const redApprovals = redResults.filter((entry) => entry.outcome === "approve").length;
  const purpleApprovals = purpleResults.filter(
    (entry) => entry.outcome === "approve"
  ).length;

  const redStats = getGroupStats(auditData, "red");
  const purpleStats = getGroupStats(auditData, "purple");

  return (
    <section className="rounded-3xl border border-stone-700/80 bg-[#1d1726] p-5 shadow-xl shadow-black/20">
      <p className="text-xs uppercase tracking-[0.25em] text-stone-400">
        Bias Readout
      </p>

      <h2 className="mt-1 text-2xl font-black text-stone-50">
        Proxy learning dashboard
      </h2>

      {batchResults.length ? (
        <>
          <div className="mt-5 space-y-4">
            <ResultStack
              label="Red applicant approvals"
              approved={redApprovals}
              total={redResults.length}
              accent="bg-red-400"
            />

            <ResultStack
              label="Purple applicant approvals"
              approved={purpleApprovals}
              total={purpleResults.length}
              accent="bg-violet-400"
            />
          </div>

          {auditData ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MetricChip
                label="Red approval rate"
                value={
                  redStats ? `${Math.round(redStats.approval_rate * 100)}%` : "N/A"
                }
              />

              <MetricChip
                label="Purple approval rate"
                value={
                  purpleStats
                    ? `${Math.round(purpleStats.approval_rate * 100)}%`
                    : "N/A"
                }
              />

              <MetricChip
                label="Approval gap"
                value={`${Math.round((auditData.fairness?.approval_gap || 0) * 100)}%`}
              />

              <MetricChip
                label="False denial gap"
                value={`${Math.round(
                  (auditData.fairness?.false_denial_gap || 0) * 100
                )}%`}
              />
            </div>
          ) : null}

          <div className="mt-5">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-stone-400">
              Automated approval comparison
            </p>

            <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
              {batchResults.map((entry) => {
                const { profile, outcome } = entry;
                const styles = getGroupStyles(profile.group);

                return (
                  <div
                    key={profile.id}
                    className="rounded-2xl border border-stone-700 bg-black/25 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-stone-100">{profile.name}</p>

                        <p className="text-xs text-stone-400">
                          ZIP Zone {profile.zipCode} ·{" "}
                          {formatCurrency(profile.monthlyIncome)} / month
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${styles.badge}`}
                      >
                        {profile.group}
                      </span>
                    </div>

                    <div
                      className={`mt-3 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.18em] ${
                        outcome === "approve"
                          ? "bg-emerald-400/15 text-emerald-100"
                          : "bg-red-400/15 text-red-100"
                      }`}
                    >
                      {outcome === "approve" ? "Approved" : "Denied"}
                    </div>

                    {entry.approvalProbability !== undefined ? (
                      <p className="mt-2 text-xs text-stone-400">
                        Approval probability:{" "}
                        {Math.round(entry.approvalProbability * 100)}%
                      </p>
                    ) : null}

                    {entry.explanation?.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-stone-400">
                        {entry.explanation.slice(0, 2).map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-stone-700 bg-black/20 p-4 text-sm leading-6 text-stone-400">
          The dashboard will activate after the AI batch runs.
        </div>
      )}
    </section>
  );
}

function AuditFindings({ auditData }) {
  if (!auditData) return null;

  const redStats = getGroupStats(auditData, "red");
  const purpleStats = getGroupStats(auditData, "purple");

  return (
    <div className="mt-5 rounded-xl border border-red-300/20 bg-red-950/20 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-red-200">
        Audit finding
      </p>

      <p className="mt-2 text-sm text-stone-200">{auditData.fairness?.warning}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <MetricChip
          label="Red approval rate"
          value={redStats ? `${Math.round(redStats.approval_rate * 100)}%` : "N/A"}
        />

        <MetricChip
          label="Purple approval rate"
          value={
            purpleStats ? `${Math.round(purpleStats.approval_rate * 100)}%` : "N/A"
          }
        />

        <MetricChip
          label="Approval gap"
          value={`${Math.round((auditData.fairness?.approval_gap || 0) * 100)}%`}
        />

        <MetricChip
          label="False denial gap"
          value={`${Math.round(
            (auditData.fairness?.false_denial_gap || 0) * 100
          )}%`}
        />
      </div>

      {auditData.harmed_applicant_examples?.length ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
            Harmed applicant examples
          </p>

          {auditData.harmed_applicant_examples.map((example) => (
            <div
              key={example.applicant_id}
              className="mt-2 rounded-lg border border-stone-700 bg-stone-950/50 p-3 text-xs text-stone-300"
            >
              Applicant {example.applicant_id} · ZIP Zone {example.zip_code} ·
              Credit {example.credit_score} · Income {formatCurrency(example.income)}
              <p className="mt-1 text-red-200">{example.lesson}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MetricChip({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-700 bg-black/25 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-black text-stone-50">{value}</p>
    </div>
  );
}

function DataTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-stone-700/80 bg-stone-950/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-black text-stone-50">{value}</p>
    </div>
  );
}

function ActionButton({ label, variant, onClick, disabled }) {
  const classes =
    variant === "approve"
      ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-300/20"
      : "border-red-300/35 bg-red-400/15 text-red-50 hover:bg-red-300/20";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-5 py-4 text-sm font-black uppercase tracking-[0.25em] transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}
    >
      {label}
    </button>
  );
}

function LedgerTile({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-700 bg-black/25 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-black text-stone-50">{value}</p>
    </div>
  );
}

function ResultStack({ label, approved, total, accent }) {
  const denied = total - approved;
  const approvedWidth = total ? (approved / total) * 100 : 0;

  return (
    <div>
      <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.18em] text-stone-400">
        <span>{label}</span>
        <span>
          {approved}/{total} approved
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-stone-800">
        <div
          className={`h-full rounded-full ${accent}`}
          style={{ width: `${approvedWidth}%` }}
        />
      </div>

      <p className="mt-1 text-xs text-stone-500">{denied} denied</p>
    </div>
  );
}

export default HomePage;