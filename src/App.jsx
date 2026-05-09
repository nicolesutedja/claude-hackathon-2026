import { useState } from "react";
import HomePage from "./HomePage";
import ResourcesPage from "./ResourcesPage";

function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [resetCount, setResetCount] = useState(0);

  function handleReset() {
    setActiveTab("home");
    setResetCount((previous) => previous + 1);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(160,82,117,0.22),_transparent_38%),linear-gradient(180deg,_#1b1320_0%,_#120f17_45%,_#09090d_100%)] text-stone-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.35em] text-stone-400">LoanLine</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-50 sm:text-5xl">
                Process the line. Train the machine. Watch bias harden into policy.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
                A serious game about how proxy variables like ZIP codes let automated loan systems
                inherit human bias under the banner of efficiency.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <TabButton active={activeTab === "home"} onClick={() => setActiveTab("home")} label="Home" />
              <TabButton
                active={activeTab === "resources"}
                onClick={() => setActiveTab("resources")}
                label="Resources"
              />
              <button
                type="button"
                onClick={handleReset}
                className="border border-stone-600 bg-stone-900/80 px-4 py-2 text-sm font-medium text-stone-200 transition hover:border-stone-400 hover:text-white"
              >
                Restart Simulation
              </button>
            </div>
          </div>
        </header>

        {activeTab === "home" ? <HomePage key={resetCount} /> : <ResourcesPage />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-violet-200/50 bg-violet-300/20 text-violet-50"
          : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/25 hover:text-stone-100"
      }`}
    >
      {label}
    </button>
  );
}

export default App;
