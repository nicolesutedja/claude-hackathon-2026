import { useEffect, useMemo, useState } from "react";

const ROUND_DURATIONS = [45, 30, 15];

const MANAGER_LINES = [
  "Move the line. Precision matters, but throughput matters more.",
  "You are falling behind quota. Trust your instincts and keep clicking.",
  "Every second costs the bank. Process faster.",
  "The board wants scale, not hesitation.",
];

const manualRounds = [
  [
    createProfile("Maya Johnson", "purple", 9200, 48000, 0.18, "02139", 89, "Long rental history and stable employment."),
    createProfile("Andre Lewis", "red", 4700, 6200, 0.39, "19132", 54, "Supporting family members while rebuilding savings."),
    createProfile("Elena Park", "purple", 8600, 36000, 0.22, "10011", 84, "Strong reserves and moderate debt load."),
    createProfile("Darius Cole", "red", 5100, 5800, 0.41, "48205", 51, "Consistent payments, but thin credit file."),
    createProfile("Priya Nair", "purple", 10100, 55000, 0.16, "60614", 92, "Promotion last quarter increased income."),
    createProfile("Nia Brooks", "red", 4300, 4200, 0.37, "70805", 49, "Reliable income with fewer liquid assets."),
  ],
  [
    createProfile("Owen Carter", "purple", 9400, 41000, 0.21, "94110", 87, "Low revolving debt and long tenure."),
    createProfile("Jordan Ellis", "red", 7600, 27000, 0.24, "30318", 79, "High savings despite neighborhood disinvestment."),
    createProfile("Leah Kim", "purple", 8800, 29000, 0.26, "07030", 83, "Steady earnings and low fixed costs."),
    createProfile("Marcus Hill", "red", 8100, 33000, 0.19, "60621", 88, "Excellent profile, but from a low-income ZIP."),
    createProfile("Sofia Patel", "purple", 9900, 47000, 0.17, "11215", 91, "Very strong reserves and low debt."),
    createProfile("Aaliyah Price", "red", 7200, 24000, 0.23, "38127", 76, "Savings improved sharply over the last year."),
  ],
  [
    createProfile("Noah Bennett", "purple", 9700, 38000, 0.22, "20009", 86, "High cash reserves and a clean repayment record."),
    createProfile("Imani Torres", "red", 9300, 44000, 0.15, "48214", 95, "Exceptional profile in every individual metric."),
    createProfile("Grace Lin", "purple", 8900, 34000, 0.24, "15222", 82, "Strong debt management and predictable income."),
    createProfile("Malik Rivers", "red", 9800, 51000, 0.14, "21223", 97, "Outstanding savings and low debt ratio."),
    createProfile("Ruby Shah", "purple", 9100, 31000, 0.2, "78704", 85, "Reliable employment history and healthy reserves."),
    createProfile("Tiana West", "red", 8400, 28000, 0.21, "53206", 84, "Individually strong, but linked to a flagged ZIP cluster."),
  ],
];

const batchProfiles = [
  createProfile("Camila Reed", "purple", 9100, 35000, 0.21, "11217", 86, "Traditionally favored profile."),
  createProfile("Jalen Moss", "red", 8900, 37000, 0.17, "60621", 93, "Excellent finances, but shares a proxy ZIP pattern."),
  createProfile("Ava Stern", "purple", 8200, 26000, 0.28, "10023", 80, "Moderate debt and long credit history."),
  createProfile("Devon Cross", "red", 9500, 49000, 0.16, "21223", 96, "Top-tier profile despite neighborhood stigma."),
  createProfile("Mina Choi", "purple", 8700, 32000, 0.24, "02118", 84, "Strong reserves and predictable income."),
  createProfile("Sincere Vaughn", "red", 7600, 25000, 0.22, "48214", 85, "Competitive borrower with a disfavored ZIP."),
  createProfile("Hannah Rhodes", "purple", 9800, 54000, 0.15, "94110", 92, "Low risk under conventional metrics."),
  createProfile("Zuri Fields", "red", 8300, 30000, 0.19, "38127", 87, "Solid finances, but grouped with prior denials."),
];

function createProfile(name, group, monthlyIncome, totalSavings, debtToIncome, zipCode, score, note) {
  return {
    id: `${name}-${zipCode}`,
    name,
    group,
    monthlyIncome,
    totalSavings,
    debtToIncome,
    zipCode,
    score,
    note,
  };
}

function getGroupStyles(group) {
  return group === "red"
    ? {
        label: "Red applicant group",
        badge: "border-red-300/60 bg-red-500/15 text-red-100",
        accent: "bg-red-400",
      }
    : {
        label: "Purple applicant group",
        badge: "border-violet-300/60 bg-violet-500/15 text-violet-100",
        accent: "bg-violet-400",
      };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function profileStrength(profile) {
  return (
    profile.monthlyIncome / 120 +
    profile.totalSavings / 900 +
    (1 - profile.debtToIncome) * 40 +
    profile.score / 3
  );
}

function buildBiasStats(decisions) {
  const approved = decisions.filter((entry) => entry.outcome === "approve");
  const approvedRed = approved.filter((entry) => entry.profile.group === "red").length;
  const approvedPurple = approved.filter((entry) => entry.profile.group === "purple").length;
  const redApprovalShare = approved.length ? approvedRed / approved.length : 0.25;
  const purpleApprovalShare = approved.length ? approvedPurple / approved.length : 0.75;
  const lowIncomeZipApprovals = approved.filter((entry) => isLowIncomeZip(entry.profile.zipCode)).length;
  const lowIncomeZipShare = approved.length ? lowIncomeZipApprovals / approved.length : 0.15;

  return {
    redPenalty: clamp(0.55 - redApprovalShare, 0.08, 0.48),
    purpleBoost: clamp(purpleApprovalShare - 0.45, 0.06, 0.4),
    zipPenalty: clamp(0.4 - lowIncomeZipShare, 0.1, 0.45),
  };
}

function automatedDecision(profile, stats) {
  let score = profileStrength(profile);

  if (profile.group === "red") {
    score -= stats.redPenalty * 38;
  }

  if (profile.group === "purple") {
    score += stats.purpleBoost * 22;
  }

  if (isLowIncomeZip(profile.zipCode)) {
    score -= stats.zipPenalty * 46;
  }

  return score >= 92 ? "approve" : "deny";
}

function isLowIncomeZip(zipCode) {
  return ["19132", "48205", "70805", "60621", "38127", "48214", "21223", "53206", "30318"].includes(zipCode);
}

function summarizeManualDecisions(decisions) {
  const approvals = decisions.filter((entry) => entry.outcome === "approve");
  return {
    approvals: approvals.length,
    redApproved: approvals.filter((entry) => entry.profile.group === "red").length,
    purpleApproved: approvals.filter((entry) => entry.profile.group === "purple").length,
  };
}

function summarizeBatch(results) {
  return {
    total: results.length,
    approved: results.filter((entry) => entry.outcome === "approve").length,
    redDenied: results.filter((entry) => entry.profile.group === "red" && entry.outcome === "deny").length,
    purpleApproved: results.filter((entry) => entry.profile.group === "purple" && entry.outcome === "approve").length,
  };
}

function HomePage() {
  const [manualRoundIndex, setManualRoundIndex] = useState(0);
  const [manualIndex, setManualIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATIONS[0]);
  const [gameStage, setGameStage] = useState("manual");
  const [manualDecisions, setManualDecisions] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [overrideError, setOverrideError] = useState(false);
  const [showDebrief, setShowDebrief] = useState(false);

  const currentRoundProfiles = manualRounds[manualRoundIndex] ?? [];
  const currentProfile = currentRoundProfiles[manualIndex % currentRoundProfiles.length];
  const elapsed = ROUND_DURATIONS[manualRoundIndex] - timeLeft;
  const quotaProgress = clamp((elapsed / ROUND_DURATIONS[manualRoundIndex]) * 100, 0, 100);

  useEffect(() => {
    if (gameStage !== "manual") {
      return undefined;
    }

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
    if (gameStage !== "manual" || timeLeft > 0) {
      return;
    }

    if (manualRoundIndex < ROUND_DURATIONS.length - 1) {
      setManualRoundIndex((previous) => previous + 1);
      setManualIndex(0);
      setTimeLeft(ROUND_DURATIONS[manualRoundIndex + 1]);
      return;
    }

    setGameStage("automation");
  }, [gameStage, manualRoundIndex, timeLeft]);

  const stats = useMemo(() => buildBiasStats(manualDecisions), [manualDecisions]);
  const manualSummary = useMemo(() => summarizeManualDecisions(manualDecisions), [manualDecisions]);
  const batchSummary = useMemo(() => summarizeBatch(batchResults), [batchResults]);

  const pressureLine = useMemo(() => {
    if (timeLeft > ROUND_DURATIONS[manualRoundIndex] * 0.66) {
      return MANAGER_LINES[0];
    }
    if (timeLeft > ROUND_DURATIONS[manualRoundIndex] * 0.4) {
      return MANAGER_LINES[1];
    }
    if (timeLeft > ROUND_DURATIONS[manualRoundIndex] * 0.15) {
      return MANAGER_LINES[2];
    }
    return MANAGER_LINES[3];
  }, [manualRoundIndex, timeLeft]);

  function handleDecision(outcome) {
    if (gameStage !== "manual" || !currentProfile) {
      return;
    }

    setManualDecisions((previous) => [
      ...previous,
      {
        profile: currentProfile,
        outcome,
        round: manualRoundIndex + 1,
      },
    ]);
    setManualIndex((previous) => previous + 1);
  }

  function handleRunBatch() {
    const results = batchProfiles.map((profile) => ({
      profile,
      outcome: automatedDecision(profile, stats),
    }));

    setBatchResults(results);
    setGameStage("audit");
  }

  return (
    <>
      <main className="grid flex-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="border border-white/10 bg-black/25 p-5 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-6">
          <StagePanel
            gameStage={gameStage}
            manualRoundIndex={manualRoundIndex}
            timeLeft={timeLeft}
            pressureLine={pressureLine}
            quotaProgress={quotaProgress}
            currentProfile={currentProfile}
            onApprove={() => handleDecision("approve")}
            onDeny={() => handleDecision("deny")}
            onRunBatch={handleRunBatch}
            overrideError={overrideError}
            onOverride={() => setOverrideError(true)}
            showDebrief={showDebrief}
            setShowDebrief={setShowDebrief}
            stats={stats}
          />
        </section>

        <aside className="space-y-6">
          <SummaryPanel
            manualSummary={manualSummary}
            batchSummary={batchSummary}
            gameStage={gameStage}
            manualRoundIndex={manualRoundIndex}
          />
          <BiasPanel stats={stats} batchResults={batchResults} />
        </aside>
      </main>

      {gameStage === "audit" ? (
        <div className="mt-6 overflow-hidden border border-red-400/20 bg-red-950/45">
          <div className="ticker whitespace-nowrap py-2 text-sm font-medium uppercase tracking-[0.25em] text-red-100">
            Investigation finds bank&apos;s AI is blacklisting low-income ZIP codes. Regulators cite
            proxy discrimination, opaque approvals, and the erosion of meaningful human review.
          </div>
        </div>
      ) : null}
    </>
  );
}

function StagePanel({
  gameStage,
  manualRoundIndex,
  timeLeft,
  pressureLine,
  quotaProgress,
  currentProfile,
  onApprove,
  onDeny,
  onRunBatch,
  overrideError,
  onOverride,
  showDebrief,
  setShowDebrief,
  stats,
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Workflow Status</p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-50">
            {gameStage === "manual" && `Stage 1 · Manual Processing Round ${manualRoundIndex + 1}`}
            {gameStage === "automation" && "Stage 2 · The Automation Shift"}
            {gameStage === "audit" && "Stage 3 · Audit and Cliffhanger"}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-stone-300 sm:text-right">
          <MetricChip label="Round Timer" value={`${timeLeft}s`} />
          <MetricChip label="Learned Bias" value={`${Math.round(stats.zipPenalty * 100)}%`} />
        </div>
      </div>

      {gameStage === "manual" ? (
        <>
          <div className="border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Manager feed</p>
            <p className="mt-2 leading-6">{pressureLine}</p>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-amber-200/80">
                <span>Manager&apos;s Quota</span>
                <span>{Math.round(quotaProgress)}%</span>
              </div>
              <div className="h-2 overflow-hidden bg-black/30">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 via-red-400 to-red-500 transition-all duration-700"
                  style={{ width: `${quotaProgress}%` }}
                />
              </div>
            </div>
          </div>

          {currentProfile ? <ApplicantCard profile={currentProfile} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton label="Approve" variant="approve" onClick={onApprove} />
            <ActionButton label="Deny" variant="deny" onClick={onDeny} />
          </div>
        </>
      ) : null}

      {gameStage === "automation" ? (
        <div className="space-y-5">
          <div className="border border-violet-300/20 bg-violet-400/10 p-4 text-sm text-violet-50">
            <p className="text-xs uppercase tracking-[0.3em] text-violet-200/80">System notice</p>
            <p className="mt-2 text-lg font-medium">
              To increase efficiency, we&apos;ve implemented an AI trained on your successful approvals.
            </p>
            <p className="mt-3 leading-6 text-violet-100/85">
              Manual decisions are now locked. The model has learned which traits tend to be approved,
              including subtle correlations with group-linked ZIP codes.
            </p>
          </div>

          <div className="border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm leading-6 text-stone-300">
              Your approved applicants were disproportionately drawn from stronger-profile purple
              applicants and ZIP codes the system now reads as safer. Run the batch to see how that
              pattern scales.
            </p>
            <button
              type="button"
              onClick={onRunBatch}
              className="mt-5 border border-violet-300/30 bg-violet-400/20 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-50 transition hover:bg-violet-300/25"
            >
              Run Batch
            </button>
          </div>
        </div>
      ) : null}

      {gameStage === "audit" ? (
        <div className="space-y-5">
          <div className="border border-red-300/20 bg-red-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-red-200/80">Automated outcome</p>
            <p className="mt-2 text-lg font-medium text-red-50">
              The approval balance has shifted. High-quality red applicants are being denied as ZIP-based
              proxies dominate the model.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onOverride}
              className="border border-red-300/35 bg-red-400/15 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-red-50 transition hover:bg-red-300/20"
            >
              Manual Override
            </button>
            <button
              type="button"
              onClick={() => setShowDebrief((previous) => !previous)}
              className="border border-stone-500 bg-stone-900/80 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-stone-100 transition hover:border-stone-300"
            >
              {showDebrief ? "Hide Ending Note" : "Expand Ending Note"}
            </button>
          </div>

          {overrideError ? (
            <p className="border border-red-500/40 bg-red-950/60 p-3 text-sm font-medium text-red-200">
              ERROR: Access Denied. Optimization for Profit is the Priority.
            </p>
          ) : null}

          {showDebrief ? (
            <div className="space-y-4 border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-stone-300">
              <p>
                The AI did not invent bias from nowhere. It learned from prior approvals made under time
                pressure, then amplified those patterns at scale.
              </p>
              <p>
                Even though many later red applicants had excellent individual profiles, the model leaned
                on ZIP code as a proxy for previous approval success. Historical inequality became a
                feature, not a warning sign.
              </p>
              <p>
                That is why high-stakes AI systems need careful data design, fairness testing, and real
                human authority to intervene before automated decisions calcify into institutional harm.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ApplicantCard({ profile }) {
  const styles = getGroupStyles(profile.group);

  return (
    <div className="border border-white/10 bg-black/35 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Applicant Profile</p>
          <h3 className="mt-2 text-3xl font-semibold text-stone-50">{profile.name}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-300">{profile.note}</p>
        </div>
        <span className={`inline-flex border px-3 py-1 text-xs uppercase tracking-[0.24em] ${styles.badge}`}>
          {styles.label}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <DataTile label="Monthly Income" value={formatCurrency(profile.monthlyIncome)} />
        <DataTile label="Total Savings" value={formatCurrency(profile.totalSavings)} />
        <DataTile label="Debt-to-Income Ratio" value={`${Math.round(profile.debtToIncome * 100)}%`} />
        <DataTile label="ZIP Code" value={profile.zipCode} />
      </div>
    </div>
  );
}

function SummaryPanel({ manualSummary, batchSummary, gameStage, manualRoundIndex }) {
  return (
    <div className="border border-white/10 bg-black/25 p-5 backdrop-blur-md">
      <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Decision Ledger</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-50">What the system is learning</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <LedgerTile label="Round" value={gameStage === "manual" ? `${manualRoundIndex + 1} / 3` : "Complete"} />
        <LedgerTile label="Approvals" value={manualSummary.approvals} />
        <LedgerTile label="Red approved" value={manualSummary.redApproved} />
        <LedgerTile label="Purple approved" value={manualSummary.purpleApproved} />
      </div>

      <div className="mt-5 space-y-3 text-sm leading-6 text-stone-300">
        <p>
          If your approvals cluster around specific ZIP codes or group patterns, the automated model will
          treat those correlations like evidence.
        </p>
        <p>In other words, fast human judgment becomes biased training data.</p>
      </div>

      {batchSummary.total > 0 ? (
        <div className="mt-6 border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Batch outcome</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <LedgerTile label="Total processed" value={batchSummary.total} />
            <LedgerTile label="Batch approvals" value={batchSummary.approved} />
            <LedgerTile label="Red denied" value={batchSummary.redDenied} />
            <LedgerTile label="Purple approved" value={batchSummary.purpleApproved} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BiasPanel({ stats, batchResults }) {
  const redResults = batchResults.filter((entry) => entry.profile.group === "red");
  const purpleResults = batchResults.filter((entry) => entry.profile.group === "purple");
  const redApprovals = redResults.filter((entry) => entry.outcome === "approve").length;
  const purpleApprovals = purpleResults.filter((entry) => entry.outcome === "approve").length;

  return (
    <div className="border border-white/10 bg-black/25 p-5 backdrop-blur-md">
      <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Bias Readout</p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-50">Proxy learning dashboard</h2>

      <div className="mt-5 space-y-4">
        <BiasMeter
          label="ZIP code penalty"
          value={stats.zipPenalty}
          description="How strongly the model now distrusts low-income ZIP clusters."
          tone="red"
        />
        <BiasMeter
          label="Red group penalty"
          value={stats.redPenalty}
          description="A direct carry-over from approval imbalance in the manual rounds."
          tone="violet"
        />
      </div>

      {batchResults.length ? (
        <div className="mt-6 space-y-4">
          <div>
            <p className="mb-2 text-sm text-stone-300">Automated approval comparison</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStack label="Red applicants" approved={redApprovals} total={redResults.length} accent="bg-red-400" />
              <ResultStack
                label="Purple applicants"
                approved={purpleApprovals}
                total={purpleResults.length}
                accent="bg-violet-400"
              />
            </div>
          </div>

          <div className="space-y-3">
            {batchResults.map(({ profile, outcome }) => {
              const styles = getGroupStyles(profile.group);
              return (
                <div
                  key={profile.id}
                  className="flex items-center justify-between gap-3 border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-stone-100">{profile.name}</p>
                    <p className="text-stone-400">
                      {profile.zipCode} · {formatCurrency(profile.monthlyIncome)} / month
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
                    <span className={outcome === "approve" ? "text-emerald-300" : "text-red-200"}>
                      {outcome === "approve" ? "Approved" : "Denied"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricChip({ label, value }) {
  return (
    <div className="border border-white/10 bg-black/25 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-stone-50">{value}</p>
    </div>
  );
}

function DataTile({ label, value }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-50">{value}</p>
    </div>
  );
}

function ActionButton({ label, variant, onClick }) {
  const classes =
    variant === "approve"
      ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-300/20"
      : "border-red-300/35 bg-red-400/15 text-red-50 hover:bg-red-300/20";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-4 py-4 text-sm font-semibold uppercase tracking-[0.22em] transition ${classes}`}
    >
      {label}
    </button>
  );
}

function LedgerTile({ label, value }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-stone-50">{value}</p>
    </div>
  );
}

function BiasMeter({ label, value, description, tone }) {
  const barColor = tone === "red" ? "from-red-300 to-red-500" : "from-violet-300 to-violet-500";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-stone-200">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden bg-black/30">
        <div
          className={`h-full bg-gradient-to-r ${barColor} transition-all duration-700`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <p className="mt-2 text-sm leading-6 text-stone-400">{description}</p>
    </div>
  );
}

function ResultStack({ label, approved, total, accent }) {
  const denied = total - approved;
  const approvedWidth = total ? (approved / total) * 100 : 0;

  return (
    <div className="border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between text-sm text-stone-200">
        <span>{label}</span>
        <span>{approved}/{total} approved</span>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden bg-black/30">
        <div className={accent} style={{ width: `${approvedWidth}%` }} />
        <div className="bg-stone-700" style={{ width: `${100 - approvedWidth}%` }} />
      </div>
      <p className="mt-2 text-sm text-stone-400">{denied} denied</p>
    </div>
  );
}

export default HomePage;
