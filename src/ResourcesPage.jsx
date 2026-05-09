import { useState, useEffect } from "react";

const RESOURCE_PAGES = [
  {
    id: "bias-fairness",
    title: "Bias & Fairness",
    eyebrow: "Core concept",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 10l5-6 5 6" /><path d="M21 10H3" /><path d="M12 21a8 8 0 0 0 0-16" /><path d="M12 11l3 4.5" /><path d="M12 11l-3 4.5" />
      </svg>
    ),
    markdown: `## Why this matters

AI systems can appear neutral while still producing unequal outcomes for underserved communities.

- **Historical Bias:** Training data often reflects historical discrimination rather than ideal decision-making.
- **Feedback Loops:** A model can learn patterns tied to approval history, not actual borrower merit.
- **The Paradox:** This means a technically accurate model can still be socially unfair.

## Useful fairness lens

- **Disparate Impact:** compares how often different groups receive favorable outcomes.
- If one group is approved at a much lower rate, that is a warning sign even when the model never sees race directly.
- A system should be audited for both accuracy and unequal harm.`,
  },
  {
    id: "data-collection",
    title: "Data Collection & Anonymization",
    eyebrow: "Proxy variables",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" /><path d="M3 10h18" /><path d="M7 15h.01" /><path d="M11 15h.01" />
      </svg>
    ),
    markdown: `## Anonymous data is not always harmless

ZIP codes can act as stand-ins for race, wealth, and neighborhood opportunity.

- **Hidden Labels:** A field can be legally or technically "non-sensitive" while still revealing sensitive social patterns.
- **Historical Redlining:** Historical redlining made place-based data especially risky in lending.
- **Re-identification:** Combining income, savings, debt, and ZIP code can make groups easier to infer.

## Why proxies matter

- A model may deny applicants for a location pattern that correlates with marginalized identity.
- That creates discrimination without ever using an explicit protected label.`,
  },
  {
    id: "human-oversight",
    title: "Human Oversight",
    eyebrow: "Accountability",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
    markdown: `## The black box problem

When automated systems become too complex or too trusted, humans stop meaningfully intervening.

- **Automation Bias:** Staff may defer to model outputs because they seem faster or more objective.
- **Optimization Goals:** Override powers may disappear once optimization goals dominate the workflow.
- **High-Stakes Lending:** Meaningful review should be possible before harm compounds.

## What good oversight looks like

- Clear documentation of training goals.
- Appeal pathways for affected applicants.
- Regular bias testing and the power to pause deployment.`,
  },
  {
    id: "how-we-built",
    title: "How We Built LoanLine",
    eyebrow: "Process",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    markdown: `## Current build notes

This prototype uses placeholder applicant profiles and a lightweight front-end simulation.

- **State Management:** React manages the game state and stage transitions.
- **Styling:** Tailwind CSS handles the visual system and layout.
- **The Loop:** The automated stage uses the player's own approval patterns to mimic biased model training.

## Future extension

- Replace placeholder profiles with Gemini-generated scenarios.
- Add logging, richer analytics, and alternative audit outcomes.`,
  },
  {
    id: "goal",
    title: "Goal of the App",
    eyebrow: "Learning outcome",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
    markdown: `## Why LoanLine exists

LoanLine is designed to make redlining and algorithmic bias feel procedural rather than abstract.

- **Human Bias:** The player first experiences pressure to make imperfect human decisions.
- **Algorithmic Scaling:** Then the system scales those choices into automated harm.
- **Final Lesson:** Careless AI adoption can amplify old inequalities under the language of efficiency.`,
  },
];

function ResourcesPage() {
  const [currentPageId, setCurrentPageId] = useState(RESOURCE_PAGES[0].id);
  const currentPage = RESOURCE_PAGES.find((p) => p.id === currentPageId);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPageId]);

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 max-w-6xl mx-auto px-6 py-12 min-h-screen">
      {/* Sticky Table of Contents Sidebar */}
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <nav className="sticky top-12 space-y-1">
          <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-stone-500 font-mono">
            Table of Contents
          </p>
          {RESOURCE_PAGES.map((page) => {
            const isActive = currentPageId === page.id;
            return (
              <button
                key={page.id}
                onClick={() => setCurrentPageId(page.id)}
                className={`group flex w-full items-start gap-2.5 py-2.5 text-left text-sm transition-all duration-200 ${
                  isActive ? "text-violet-300" : "text-stone-500 hover:text-stone-200"
                }`}
              >
                <span className={`mt-[7px] h-px flex-shrink-0 transition-all duration-300 ${
                  isActive ? "w-5 bg-violet-400" : "w-2.5 bg-stone-600 group-hover:w-4 group-hover:bg-stone-400"
                }`} />
                <span className="leading-snug">{page.title}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile ToC */}
      <nav className="lg:hidden flex gap-2 flex-wrap mb-4">
        {RESOURCE_PAGES.map((page) => (
          <button
            key={page.id}
            onClick={() => setCurrentPageId(page.id)}
            className={`border px-3 py-1.5 text-xs transition ${
              currentPageId === page.id 
                ? "border-violet-400/50 bg-violet-400/10 text-violet-200" 
                : "border-white/10 bg-white/5 text-stone-400"
            }`}
          >
            {page.title}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl">
        {currentPage && (
          <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <header className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-violet-400 p-2 bg-violet-400/10 rounded-lg ring-1 ring-violet-400/20">
                  {currentPage.icon}
                </span>
                <span className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-mono">
                  {currentPage.eyebrow}
                </span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-stone-50 tracking-tight">
                {currentPage.title}
              </h1>
            </header>

            <div className="border-t border-white/10 pt-10">
              <MarkdownBlock markdown={currentPage.markdown} />
            </div>
          </article>
        )}
      </main>
    </div>
  );
}

function MarkdownBlock({ markdown }) {
  const lines = markdown.split("\n");
  return (
    <div className="space-y-6 text-base lg:text-lg leading-relaxed text-stone-400">
      {lines.map((line, index) => {
        if (!line.trim()) return null;
        
        if (line.startsWith("## ")) {
          return (
            <h2 key={index} className="text-xl font-semibold text-violet-200 mt-12 mb-4 first:mt-0">
              {line.replace("## ", "")}
            </h2>
          );
        }
        
        if (line.startsWith("- ")) {
          return (
            <div key={index} className="flex gap-4 pl-1">
              <span className="mt-[11px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500/50" />
              <span className="text-stone-300">{renderInlineBold(line.replace("- ", ""))}</span>
            </div>
          );
        }
        
        return <p key={index}>{renderInlineBold(line)}</p>;
      })}
    </div>
  );
}

function renderInlineBold(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-stone-100">{part.slice(2, -2)}</strong>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

export default ResourcesPage;