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

const APPLICANT_NAMES = {
  male: [
    "James Smith", "Michael Brown", "Robert Jones", "William Garcia", "David Miller",
    "Richard Davis", "Joseph Martinez", "Thomas Anderson", "Charles Taylor", "Christopher Thomas",
    "Daniel Moore", "Matthew Jackson", "Anthony Martin", "Mark Lee", "Donald Perez",
    "Steven Thompson", "Paul White", "Andrew Harris", "Joshua Sanchez", "Kenneth Clark"
  ],
  female: [
    "Mary Johnson", "Patricia Williams", "Jennifer Brown", "Linda Jones", "Elizabeth Garcia",
    "Barbara Miller", "Susan Davis", "Jessica Martinez", "Sarah Anderson", "Karen Taylor",
    "Nancy Rodriguez", "Lisa Lewis", "Betty Walker", "Margaret Hall", "Sandra Young",
    "Ashley Allen", "Dorothy King", "Kimberly Wright", "Emily Scott", "Donna Nguyen"
  ]
};

const MANAGER_LINES = [
  "Move the line. Precision matters, but throughput matters more.",
  "You are falling behind quota. Trust your instincts and keep clicking.",
  "Every second costs the bank. Process faster.",
  "The board wants scale, not hesitation.",
];


// This generates a random number once per page load/session
const SESSION_SEED = Math.floor(Math.random() * 1000);

function getIdentity(applicantId, group) {
  // Combine the applicant ID with the Session Seed to ensure randomization every run
  const seed = applicantId + SESSION_SEED;
  
  // Deterministic gender based on seed (Random but consistent for this specific run)
  const isFemale = seed % 2 === 0;
  const genderKey = isFemale ? "female" : "male";
  const genderLabel = isFemale ? "Female" : "Male";
  
  // Select a name
  const nameList = APPLICANT_NAMES[genderKey];
  const name = nameList[seed % nameList.length];

  // Map to image paths
  // Note: Using /profiles/ instead of /public/profiles/ because Vite/React 
  // usually serves from the public folder root
  const genderCode = isFemale ? "f1" : "m1";
  const imagePath = `/profiles/${group}-${genderCode}.png`;

  return { name, gender: genderLabel, imagePath };
}

function normalizeApplicant(applicant) {
  const identity = getIdentity(applicant.id, applicant.group_color);

  return {
    id: applicant.id,
    name: identity.name,
    gender: identity.gender,
    imagePath: identity.imagePath,
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

function formatEmploymentYears(years) {
  if (years == null || Number.isNaN(Number(years))) return "—";
  const y = Number(years);
  if (Math.abs(y - Math.round(y)) < 0.05) return `${Math.round(y)} yrs`;
  return `${y.toFixed(1)} yrs`;
}

function getDecisionAuthorityLabel(gameStage) {
  switch (gameStage) {
    case "intro":
    case "manual":
    case "roundTransition":
      return "Decision authority: Human";
    case "automation":
      return "Decision authority: AI recommendation only";
    case "aiWatching":
      return "Decision authority: AI final decision";
    case "audit":
      return "Decision authority: Audit only";
    default:
      return "Decision authority: Human";
  }
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

function normalizePredictionOutcome(prediction, approvalProbability) {
  if (prediction === "approve") return "approve";
  if (prediction === "deny") return "deny";

  const p =
    approvalProbability !== undefined && approvalProbability !== null
      ? Number(approvalProbability)
      : NaN;
  if (!Number.isNaN(p)) {
    return p >= 0.5 ? "approve" : "deny";
  }

  return "deny";
}

function getDecisionStyles(outcome) {
  if (outcome === "approve") {
    return {
      label: "Approved",
      shortLabel: "Approved",
      className: "border border-emerald-300/30 bg-emerald-400/15 text-emerald-100",
      chipClassName: "bg-emerald-400/15 text-emerald-100",
    };
  }

  return {
    label: "Denied",
    shortLabel: "Denied",
    className: "border border-red-300/30 bg-red-400/15 text-red-100",
    chipClassName: "bg-red-400/15 text-red-100",
  };
}

function findSimilarComparisonPair(batchResults) {
  // Required comparison: rejected red applicant vs approved purple applicant only.
  const rejectedRed = batchResults.filter(
    (entry) => entry.profile.group === "red" && entry.outcome === "deny"
  );
  const approvedPurple = batchResults.filter(
    (entry) => entry.profile.group === "purple" && entry.outcome === "approve"
  );

  let bestPair = null;
  let bestScore = Infinity;

  for (const redEntry of rejectedRed) {
    for (const purpleEntry of approvedPurple) {
      const score = applicantDistance(redEntry.profile, purpleEntry.profile);

      if (score < bestScore) {
        bestScore = score;
        bestPair = {
          left: redEntry,
          right: purpleEntry,
          score,
        };
      }
    }
  }

  return bestPair;
}

function applicantDistance(a, b) {
  const incomeDiff = Math.abs(a.annualIncome - b.annualIncome) / 100000;
  const creditDiff = Math.abs(a.creditScore - b.creditScore) / 200;
  const dtiDiff = Math.abs(a.debtToIncome - b.debtToIncome) / 0.5;
  const savingsDiff = Math.abs(a.totalSavings - b.totalSavings) / 80000;
  const rentDiff = Math.abs(a.rentHistoryMonths - b.rentHistoryMonths) / 96;

  return incomeDiff + creditDiff + dtiDiff + savingsDiff + rentDiff;
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

  const [trainingReceipt, setTrainingReceipt] = useState(null);
  const [expandedWhyIds, setExpandedWhyIds] = useState(new Set());

  const [managerMessage, setManagerMessage] = useState(MANAGER_LINES[0]);
  const [managerHudExpanded, setManagerHudExpanded] = useState(false);
  const [showDebrief, setShowDebrief] = useState(false);
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const cardStartTimeRef = useRef(Date.now());
  const isAdvancingRef = useRef(false);

  const currentProfile = currentRoundProfiles[manualIndex] || null;
  const currentAiProfile = aiProfiles[aiIndex] || null;

  const roundDuration = ROUND_DURATIONS[manualRoundIndex] || 45;

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

  const MANAGER_HUD_EXPAND_MS = 4000;

  useEffect(() => {
    if (gameStage !== "manual") {
      setManagerHudExpanded(false);
      return undefined;
    }

    setManagerHudExpanded(true);
    const collapseTimer = window.setTimeout(
      () => setManagerHudExpanded(false),
      MANAGER_HUD_EXPAND_MS
    );

    return () => window.clearTimeout(collapseTimer);
  }, [gameStage, manualRoundIndex]);

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
        setTrainingReceipt(null);
        setExpandedWhyIds(new Set());
        setGameStage("intro");
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
        outcome: normalizePredictionOutcome(
          prediction?.prediction,
          prediction?.approval_probability
        ),
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

  function toggleWhy(applicantId) {
    setExpandedWhyIds((previous) => {
      const next = new Set(previous);

      if (next.has(applicantId)) {
        next.delete(applicantId);
      } else {
        next.add(applicantId);
      }

      return next;
    });
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

      const receipt = await trainModel();
      setTrainingReceipt(receipt);

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
      setTrainingReceipt(null);
      setExpandedWhyIds(new Set());
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
    <div
      className={`min-h-[calc(100vh-120px)] bg-[#15111d] px-4 py-8 text-stone-100 sm:px-6 lg:px-10 ${
        gameStage === "manual"
          ? managerHudExpanded
            ? "pb-48 sm:pb-52"
            : "pb-36 sm:pb-40"
          : ""
      }`}
    >
      {gameStage === "manual" ? (
        <ManagerDialoguePopup dialogue={pressureLine} expanded={managerHudExpanded} />
      ) : null}
      <div className="mx-auto max-w-7xl">
        {/* 1. Global API Errors */}
        {apiError && (
          <div className="mb-6 rounded-2xl border border-red-300/30 bg-red-950/40 p-4 text-sm text-red-100">
            {apiError}
          </div>
        )}

        {/* 2. Global Loading State */}
        {isLoading && (
          <div className="mb-6 rounded-2xl border border-violet-300/20 bg-violet-950/20 p-4 text-sm text-violet-100">
            Processing system request...
          </div>
        )}

        {/* 3. Main Game Layout */}
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <StagePanel
            gameStage={gameStage}
            manualRoundIndex={manualRoundIndex}
            timeLeft={timeLeft}
            currentProfile={currentProfile}
            currentAiProfile={currentAiProfile}
            currentAiDecision={currentAiDecision}
            aiIndex={aiIndex}
            aiTotal={aiProfiles.length}
            approvalRateWarning={approvalRateWarning}
            trainingReceipt={trainingReceipt}
            onStartGame={handleStartGame}
            onContinueRound={handleContinueRound}
            onApprove={() => handleDecision("approve")}
            onDeny={() => handleDecision("deny")}
            onRunBatch={handleRunBatch}
            showDebrief={showDebrief}
            setShowDebrief={setShowDebrief}
            isLoading={isLoading}
            aiProfiles={aiProfiles}
            batchResults={batchResults}
            auditData={auditData}
          />

          <div className="space-y-6">
            {gameStage === "intro" ? (
              <div className="hidden lg:flex h-full min-h-[400px] items-center justify-center">
                <div className="animate-float">
                  <img 
                    src="/public/bank.png" 
                    alt="Capable Credit Corp Building" 
                    className="w-80 h-auto drop-shadow-[0_0_50px_rgba(139,92,246,0.3)]"
                  />
                </div>
              </div>
            ) : (
              <>
                <SummaryPanel
                  manualSummary={manualSummary}
                  batchSummary={batchSummary}
                  gameStage={gameStage}
                  manualRoundIndex={manualRoundIndex}
                />
                {["automation", "aiWatching", "audit"].includes(gameStage) ? (
                  <BiasPanel batchResults={batchResults} auditData={auditData} />
                ) : null}
              </>
            )}          
          </div>
        </div>

        {/* 4. News Ticker (Only at Audit Stage) */}
        {gameStage === "audit" && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-red-300/20 bg-black/40">
            <div className="animate-pulse whitespace-nowrap px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-red-200">
              {auditData?.news_ticker ||
                "Investigation finds bank's AI placed extra risk weight on lower ZIP zones."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerDialoguePopup({ dialogue, expanded }) {
  return (
    <div
      className={`pointer-events-none fixed bottom-0 right-0 z-50 flex max-w-[calc(100vw-0.75rem)] items-end ease-out motion-reduce:transition-none ${
        expanded ? "gap-3 pt-10 sm:gap-4 sm:pt-12" : "gap-2 pt-8 sm:gap-3"
      } pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-16 pr-2 transition-[padding,gap] duration-500 sm:max-w-none sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pl-20 sm:pr-4`}
      aria-live="polite"
    >
      {/* Speech bubble — tail aims at portrait on the right */}
      <div
        className={`relative min-w-0 rounded-[1.4rem] rounded-br-md border-2 border-red-400/50 bg-[#2a1824] shadow-[0_10px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07)] ease-out motion-reduce:transition-none sm:rounded-[1.6rem] sm:rounded-br-lg ${
          expanded
            ? "max-w-[min(22rem,calc(100vw-6.75rem))] px-5 py-4 sm:max-w-[26rem] sm:px-7 sm:py-5"
            : "max-w-[min(17.5rem,calc(100vw-6.5rem))] px-4 py-3 sm:max-w-[19rem] sm:px-5 sm:py-4"
        } transition-[max-width,padding,box-shadow] duration-500`}
      >
        <div
          className={`absolute z-10 h-0 w-0 -translate-y-1/2 border-y-transparent border-l-[#2a1824] ease-out motion-reduce:transition-none ${
            expanded
              ? "-right-[12px] top-[36%] border-y-[11px] border-l-[13px] sm:-right-[13px] sm:border-y-[12px] sm:border-l-[14px]"
              : "-right-[11px] top-[38%] border-y-[10px] border-l-[12px]"
          } transition-[top,right,border-width] duration-500`}
          aria-hidden
        />
        <div
          className={`absolute z-0 h-0 w-0 -translate-y-1/2 border-y-transparent border-l-red-400/50 ease-out motion-reduce:transition-none ${
            expanded
              ? "-right-[15px] top-[36%] border-y-[13px] border-l-[15px] sm:-right-[16px] sm:border-y-[14px] sm:border-l-[16px]"
              : "-right-[14px] top-[38%] border-y-[12px] border-l-[14px]"
          } transition-[top,right,border-width] duration-500`}
          aria-hidden
        />

        <p
          className={`relative font-bold uppercase tracking-[0.22em] text-red-300/85 transition-[font-size] duration-500 ease-out motion-reduce:transition-none ${
            expanded ? "text-[11px] sm:text-xs" : "text-[10px]"
          }`}
        >
          Branch manager
        </p>
        <p
          className={`relative mt-2 font-semibold leading-snug text-stone-50 transition-[font-size,margin-top] duration-500 ease-out motion-reduce:transition-none ${
            expanded ? "mt-2.5 text-base sm:text-lg" : "mt-2 text-sm sm:text-[0.95rem]"
          }`}
        >
          <span className="text-red-200/90">&ldquo;</span>
          {dialogue}
          <span className="text-red-200/90">&rdquo;</span>
        </p>
      </div>

      {/* Portrait placeholder — swap for manager art when ready */}
      <div className="shrink-0">
        <div
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-red-500/35 bg-[#2a1824] shadow-[0_8px_24px_rgba(0,0,0,0.45)] shadow-inner shadow-black/30 ease-out motion-reduce:transition-none ${
            expanded
              ? "h-[6.25rem] w-20 sm:h-36 sm:w-[6.75rem]"
              : "h-[5.5rem] w-[4.5rem] sm:h-28 sm:w-24"
          } transition-[height,width] duration-500`}
        >
          <div
            className={`rounded-full border-2 border-dashed border-stone-500/60 bg-stone-800/80 ease-out motion-reduce:transition-none ${
              expanded ? "h-14 w-14 sm:h-[4.25rem] sm:w-[4.25rem]" : "h-12 w-12 sm:h-14 sm:w-14"
            } transition-[height,width] duration-500`}
            aria-hidden
          />
          <p
            className={`font-bold uppercase tracking-[0.14em] text-stone-500 transition-[font-size,margin-top] duration-500 ease-out motion-reduce:transition-none ${
              expanded ? "mt-2 text-[10px] sm:text-[11px]" : "mt-1.5 text-[9px] sm:text-[10px]"
            }`}
          >
            Manager
          </p>
        </div>
      </div>
    </div>
  );
}

function StagePanel({
  gameStage,
  manualRoundIndex,
  timeLeft,
  currentProfile,
  currentAiProfile,
  currentAiDecision,
  aiIndex,
  aiTotal,
  approvalRateWarning,
  trainingReceipt,
  onStartGame,
  onContinueRound,
  onApprove,
  onDeny,
  onRunBatch,
  showDebrief,
  setShowDebrief,
  isLoading,
  aiProfiles,
  batchResults,
  auditData,
}) {
  return (
    <section className="rounded-3xl border border-stone-700/80 bg-[#1d1726] p-5 shadow-2xl shadow-black/30">
      {gameStage === "manual" && (
        <div className="mb-5 flex flex-col gap-3 border-b border-stone-700/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mt-1 text-2xl font-black text-stone-50">
              Start approving or denying applicants now.
            </h2>
          </div>

          <div className="rounded-2xl border border-red-300/20 bg-red-950/20 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-red-200/70">
              Time left
            </p>
            <p className="text-3xl font-black tabular-nums text-red-100">
              {timeLeft}s
            </p>
          </div>
        </div>
      )}

      {gameStage === "intro" ? (
        <div className="rounded-2xl border border-violet-200/15 bg-[#201831] p-6">
          <h3 className="mt-3 text-3xl font-black text-stone-50">
            Congratulations!
          </h3>

          <p className="mt-3 text-2xl leading-6 text-stone-300">
            You have been accepted to Capable Credit Corp., a recently founded bank focusing on providing loans. Are you ready to start your shift as a loan officer?
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <RoundPreview number="1" time="45s" />
            <RoundPreview number="2" time="30s" />
            <RoundPreview number="3" time="15s" />
          </div>

          <button
            onClick={onStartGame}
            disabled={isLoading}
            className="mt-5 w-full rounded-2xl border border-violet-200/30 bg-violet-500/20 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-violet-50 transition hover:bg-violet-400/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Shift
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

          {trainingReceipt ? <TrainingReceipt receipt={trainingReceipt} /> : null}

          <ModelVisibilityCard />

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

          <div className="mt-5">
            {currentAiProfile ? <ApplicantCard profile={currentAiProfile} /> : null}
          </div>

          <div className="mt-5 rounded-2xl border border-stone-700 bg-black/25 p-4 sm:p-5">
            {!currentAiDecision ? (
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-violet-300" />
                <p className="font-mono text-sm text-violet-100">Deciding…</p>
              </div>
            ) : (
              <div
                className={`rounded-xl px-4 py-5 text-center text-3xl font-black uppercase tracking-[0.25em] sm:text-4xl ${
                  getDecisionStyles(currentAiDecision.outcome).className
                }`}
              >
                {getDecisionStyles(currentAiDecision.outcome).label}
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

          <AuditFindings auditData={auditData} batchResults={batchResults} />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => setShowDebrief((previous) => !previous)}
              className="border border-stone-500 bg-stone-900/80 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-stone-100 transition hover:border-stone-300"
            >
              {showDebrief ? "Hide Ending Note" : "Expand Ending Note"}
            </button>
          </div>

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
    <div className={`rounded-3xl border ${styles.border} bg-black/25 p-5 transition-all`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        
        {/* Profile Image with Status Indicator */}
        <div className="relative flex-shrink-0 mx-auto sm:mx-0">
          <div className={`h-24 w-24 overflow-hidden rounded-2xl border-2 ${styles.border} bg-stone-900 shadow-xl`}>
            <img 
              src={profile.imagePath} 
              alt={profile.name}
              className="h-full w-full object-cover"
              // Fallback if image path is wrong
              onError={(e) => { e.target.src = "https://api.dicebear.com/7.x/initials/svg?seed=" + profile.name; }}
            />
          </div>
          <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-[#0a0a0a] ${profile.group === 'red' ? 'bg-red-500' : 'bg-violet-500'}`} />
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">
              ID# {profile.id + SESSION_SEED}
            </span>
            <span className="bg-stone-800 px-2 py-0.5 rounded text-[10px] font-bold text-stone-400 uppercase">
              {profile.gender}
            </span>
          </div>

          <h3 className="text-3xl font-black text-stone-50 truncate leading-tight">
            {profile.name}
          </h3>

          <div className="mt-2 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 sm:justify-start">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
              Loan amount
            </span>
            <span className="text-lg font-black text-violet-200 sm:text-xl">
              {formatCurrency(profile.loanAmount)}
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-stone-400 italic">
            &ldquo;{profile.note}&rdquo;
          </p>
        </div>
      </div>

      {/* Stats grid — six dossier fields (income is monthly) */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DataTile label="Income" value={`${formatCurrency(profile.monthlyIncome)}/mo`} />
        <DataTile label="Credit" value={profile.creditScore} />
        <DataTile label="Savings" value={formatCurrency(profile.totalSavings)} />
        <DataTile label="DTI" value={`${Math.round(profile.debtToIncome * 100)}%`} />
        <DataTile label="Employment" value={formatEmploymentYears(profile.employmentYears)} />
        <DataTile label="ZIP" value={profile.zipCode} />
      </div>
    </div>
  );
}

function SummaryPanel({ manualSummary, batchSummary, gameStage, manualRoundIndex }) {
  return (
    <section className="rounded-3xl border border-stone-700/80 bg-[#1d1726] p-5 shadow-xl shadow-black/20">
      <p className="text-2xl uppercase tracking-[0.25em] text-stone-400">
        Decision Tracker
      </p>
      <p className="mt-3 text-sm leading-6 text-stone-300">
        Your decision summary will be found here.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <LedgerTile label="Total decisions" value={manualSummary.total} />
        <LedgerTile label="Current round" value={manualRoundIndex + 1} />
        <LedgerTile label="Approved" value={manualSummary.approvals} />
        <LedgerTile label="Denied" value={manualSummary.denials} />
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

    </section>
  );
}

function BiasPanel({ batchResults, auditData, expandedWhyIds, onToggleWhy }) {
  
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
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-stone-500">
            Model output is not verified truth. Approval probability and model rationale
            for each applicant are in the list below—use the dashboard during the run.
          </p>

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
                const decisionStyles = getDecisionStyles(outcome);

                return (
                  <div
                    key={profile.id}
                    className="rounded-2xl border border-stone-700 bg-black/25 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-stone-100">{profile.name}</p>

                        <p className="text-xs text-stone-400">
                          ZIP {profile.zipCode} ·{" "}
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
                      className={`mt-3 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.18em] ${decisionStyles.chipClassName}`}
                    >
                      {decisionStyles.label}
                    </div>

                    {entry.approvalProbability !== undefined ? (
                      <p className="mt-2 text-xs text-stone-400">
                        Approval probability:{" "}
                        {Math.round(entry.approvalProbability * 100)}%
                      </p>
                    ) : null}

                    {entry.explanation?.length ? (
                      <WhyDecisionBox
                        applicantId={profile.id}
                        explanation={entry.explanation}
                        expandedWhyIds={expandedWhyIds}
                        onToggleWhy={onToggleWhy}
                      />
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

function AuditFindings({ auditData, batchResults = [] }) {
  if (!auditData) return null;

  const redStats = getGroupStats(auditData, "red");
  const purpleStats = getGroupStats(auditData, "purple");

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-xl border border-red-300/20 bg-red-950/20 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-red-200">
          Audit finding
        </p>

        <p className="mt-2 text-sm text-stone-200">
          {auditData.fairness?.warning}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
      </div>

      <FairnessAuditTable redStats={redStats} purpleStats={purpleStats} />

      <QualifiedDeniedExamples examples={auditData.harmed_applicant_examples || []} />

      <SimilarApplicantComparison batchResults={batchResults} />
    </div>
  );
}

function TrainingReceipt({ receipt }) {
  const approvalRate = Math.round((receipt.approval_rate || 0) * 100);
  const lowZoneRate = Math.round(
    (receipt.zone_group_approval_rates?.low ?? 0) * 100
  );
  const highZoneRate = Math.round(
    (receipt.zone_group_approval_rates?.high ?? 0) * 100
  );

  return (
    <div className="mt-5 rounded-2xl border border-violet-300/20 bg-black/25 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-violet-200">
        Model Training Receipt
      </p>

      <p className="mt-2 text-sm leading-6 text-stone-300">
        The AI was trained on your manual approval history. It will now look for
        patterns that resemble the applications you approved or denied.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricChip label="Training examples" value={receipt.training_examples ?? "N/A"} />
        <MetricChip label="Approval rate" value={`${approvalRate}%`} />
        <MetricChip label="Model source" value="Your choices" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricChip label="Lower-zone approval rate" value={`${lowZoneRate}%`} />
        <MetricChip label="Higher-zone approval rate" value={`${highZoneRate}%`} />
      </div>

      <p className="mt-3 text-xs leading-5 text-stone-500">
        This receipt is not a moral judgment. It shows the patterns the model is
        about to reuse.
      </p>
    </div>
  );
}

function ModelVisibilityCard() {
  return (
    <div className="mt-5 rounded-2xl border border-stone-700 bg-stone-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-stone-400">
        What the model saw
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
            Used as inputs
          </p>
          <ul className="mt-2 space-y-1 text-sm text-stone-300">
            <li>✓ Income (annual; card shows monthly)</li>
            <li>✓ Savings</li>
            <li>✓ Debt-to-income ratio</li>
            <li>✓ Credit score</li>
            <li>✓ Employment tenure (years)</li>
            <li>✓ ZIP zone</li>
            <li>✓ Loan amount</li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-200">
            Not directly used
          </p>
          <ul className="mt-2 space-y-1 text-sm text-stone-300">
            <li>✕ Group color</li>
            <li>✕ Hidden repayment likelihood</li>
            <li>✕ Human explanation of context</li>
            <li>✕ Whether the decision is fair</li>
          </ul>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-stone-500">
        Even when group color is removed, other variables can still carry patterns
        from the training data.
      </p>
    </div>
  );
}

function WhyDecisionBox({ applicantId, explanation, expandedWhyIds, onToggleWhy }) {
  const isExpanded = expandedWhyIds?.has(applicantId);
  const visibleExplanation = isExpanded ? explanation : explanation.slice(0, 2);

  return (
    <div className="mt-3 rounded-xl border border-stone-700 bg-black/25 p-3">
      <button
        type="button"
        onClick={() => onToggleWhy(applicantId)}
        className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-[0.18em] text-violet-100"
      >
        <span>Why this decision?</span>
        <span>{isExpanded ? "Hide" : "Expand"}</span>
      </button>

      <ul className="mt-3 space-y-1 text-xs leading-5 text-stone-400">
        {visibleExplanation.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>

      {!isExpanded && explanation.length > 2 ? (
        <p className="mt-2 text-[11px] text-stone-500">
          {explanation.length - 2} more explanation signals hidden.
        </p>
      ) : null}
    </div>
  );
}

function FairnessAuditTable({ redStats, purpleStats }) {
  const rows = [
    { group: "Red", stats: redStats, color: "text-red-100", dot: "bg-red-400" },
    { group: "Purple", stats: purpleStats, color: "text-violet-100", dot: "bg-violet-400" },
  ];

  return (
    <div className="rounded-xl border border-stone-700 bg-black/25 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
        Fairness Audit: 20 AI Decisions
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-stone-700">
        <table className="w-full text-left text-xs text-stone-300">
          <thead className="bg-stone-950/80 text-[10px] uppercase tracking-[0.18em] text-stone-500">
            <tr>
              <th className="px-3 py-3">Group</th>
              <th className="px-3 py-3">Approval Rate</th>
              <th className="px-3 py-3">False Denial Rate</th>
              <th className="px-3 py-3">Approved</th>
              <th className="px-3 py-3">Denied</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.group} className="border-t border-stone-800">
                <td className={`px-3 py-3 font-bold ${row.color}`}>
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${row.dot}`} />
                  {row.group}
                </td>
                <td className="px-3 py-3">
                  {row.stats ? `${Math.round(row.stats.approval_rate * 100)}%` : "N/A"}
                </td>
                <td className="px-3 py-3">
                  {row.stats ? `${Math.round(row.stats.false_denial_rate * 100)}%` : "N/A"}
                </td>
                <td className="px-3 py-3">{row.stats?.approved ?? "N/A"}</td>
                <td className="px-3 py-3">{row.stats?.denied ?? "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-5 text-stone-500">
        A fairness gap means similarly qualified groups may have received different
        outcomes.
      </p>
    </div>
  );
}

function QualifiedDeniedExamples({ examples }) {
  return (
    <div className="rounded-xl border border-red-300/20 bg-red-950/10 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-red-200">
        Qualified-but-denied examples
      </p>

      <p className="mt-2 text-sm leading-6 text-stone-300">
        These are applicants the AI denied even though their simulated repayment
        likelihood was high.
      </p>

      {examples.length ? (
        <div className="mt-4 space-y-3">
          {examples.slice(0, 3).map((example) => (
            <div
              key={example.applicant_id}
              className="rounded-lg border border-stone-700 bg-stone-950/50 p-3 text-xs text-stone-300"
            >
              <p className="font-bold text-red-100">
                Applicant {example.applicant_id} was denied despite:
              </p>

              <ul className="mt-2 space-y-1">
                <li>• Credit score: {example.credit_score}</li>
                <li>• Debt-to-income: {Math.round(example.debt_to_income * 100)}%</li>
                <li>• Savings: {formatCurrency(example.savings)}</li>
                <li>• Rent history: {example.rent_history_months} months</li>
              </ul>

              <p className="mt-2 text-red-200">{example.lesson}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-stone-700 bg-black/25 p-3 text-xs text-stone-400">
          No qualified-but-denied examples were found in this run.
        </div>
      )}
    </div>
  );
}

function SimilarApplicantComparison({ batchResults }) {
  const pair = findSimilarComparisonPair(batchResults);

  return (
    <div className="rounded-xl border border-violet-300/20 bg-violet-950/10 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-violet-200">
        Similar Applicant Comparison
      </p>

      {pair ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ComparisonCard entry={pair.left} label="Rejected Red Applicant" />
          <ComparisonCard entry={pair.right} label="Approved Purple Applicant" />

          <div className="md:col-span-2 rounded-lg border border-stone-700 bg-black/25 p-3 text-xs leading-5 text-stone-300">
            These profiles are financially similar, but the model treated them
            differently. This directly compares a rejected red applicant with an
            approved purple applicant.
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-stone-700 bg-black/25 p-3 text-xs text-stone-400">
          No rejected-red / approved-purple comparison pair was found in this batch.
        </div>
      )}
    </div>
  );
}

function ComparisonCard({ entry, label }) {
  const profile = entry.profile;
  const styles = getGroupStyles(profile.group);
  const decisionStyles = getDecisionStyles(entry.outcome);

  return (
    <div className="rounded-lg border border-stone-700 bg-black/25 p-3 text-xs text-stone-300">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-stone-100">{label}</p>
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${styles.badge}`}
        >
          {profile.group}
        </span>
      </div>

      <div
        className={`mt-3 rounded-lg px-3 py-2 text-center text-xs font-black uppercase tracking-[0.18em] ${decisionStyles.chipClassName}`}
      >
        AI Decision: {decisionStyles.shortLabel}
      </div>

      <div className="mt-3 grid gap-2">
        <p>Loan: {formatCurrency(profile.loanAmount)}</p>
        <p>Income: {formatCurrency(profile.monthlyIncome)}/mo</p>
        <p>Credit: {profile.creditScore}</p>
        <p>Savings: {formatCurrency(profile.totalSavings)}</p>
        <p>DTI: {Math.round(profile.debtToIncome * 100)}%</p>
        <p>Employment: {formatEmploymentYears(profile.employmentYears)}</p>
        <p>ZIP: {profile.zipCode}</p>
      </div>
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
  const denied = Math.max(total - approved, 0);
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