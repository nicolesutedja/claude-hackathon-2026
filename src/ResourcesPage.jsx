const RESOURCE_CARDS = [
  {
    title: "Bias & Fairness",
    eyebrow: "Core concept",
    markdown: `## Why this matters

AI systems can appear neutral while still producing unequal outcomes for underserved communities.

- Training data often reflects historical discrimination rather than ideal decision-making.
- A model can learn patterns tied to approval history, not actual borrower merit.
- This means a technically accurate model can still be socially unfair.

## Useful fairness lens

- **Disparate Impact:** compares how often different groups receive favorable outcomes.
- If one group is approved at a much lower rate, that is a warning sign even when the model never sees race directly.
- A system should be audited for both accuracy and unequal harm.`,
  },
  {
    title: "Data Collection & Re-identification",
    eyebrow: "Proxy variables",
    markdown: `## Anonymous data is not always harmless

ZIP codes can act as stand-ins for race, wealth, and neighborhood opportunity.

- A field can be legally or technically "non-sensitive" while still revealing sensitive social patterns.
- Historical redlining made place-based data especially risky in lending.
- Combining income, savings, debt, and ZIP code can make groups easier to infer.

## Why proxies matter

- A model may deny applicants for a location pattern that correlates with marginalized identity.
- That creates discrimination without ever using an explicit protected label.`,
  },
  {
    title: "Human Oversight",
    eyebrow: "Accountability",
    markdown: `## The black box problem

When automated systems become too complex or too trusted, humans stop meaningfully intervening.

- Staff may defer to model outputs because they seem faster or more objective.
- Override powers may disappear once optimization goals dominate the workflow.
- In high-stakes lending, meaningful review should be possible before harm compounds.

## What good oversight looks like

- Clear documentation of training goals.
- Appeal pathways for affected applicants.
- Regular bias testing and the power to pause deployment.`,
  },
  {
    title: "How We Built LoanLine",
    eyebrow: "Placeholder process",
    markdown: `## Current build notes

This prototype uses placeholder applicant profiles and a lightweight front-end simulation.

- React manages the game state and stage transitions.
- Tailwind CSS handles the visual system and layout.
- The automated stage uses the player's own approval patterns to mimic biased model training.

## Future extension

- Replace placeholder profiles with Gemini-generated scenarios.
- Add logging, richer analytics, and alternative audit outcomes.`,
  },
  {
    title: "Goal of the App",
    eyebrow: "Learning outcome",
    markdown: `## Why LoanLine exists

LoanLine is designed to make redlining and algorithmic bias feel procedural rather than abstract.

- The player first experiences pressure to make imperfect human decisions.
- Then the system scales those choices into automated harm.
- The lesson is that careless AI adoption can amplify old inequalities under the language of efficiency.`,
  },
];

function ResourcesPage() {
  return (
    <main className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {RESOURCE_CARDS.map((card) => (
        <article
          key={card.title}
          className="border border-white/10 bg-black/25 p-5 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          <p className="text-xs uppercase tracking-[0.28em] text-stone-500">{card.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-stone-50">{card.title}</h2>
          <div className="mt-4">
            <MarkdownBlock markdown={card.markdown} />
          </div>
        </article>
      ))}
    </main>
  );
}

function MarkdownBlock({ markdown }) {
  const lines = markdown.split("\n");

  return (
    <div className="space-y-3 text-sm leading-6 text-stone-300">
      {lines.map((line, index) => {
        if (!line.trim()) {
          return <div key={`${line}-${index}`} className="h-1" />;
        }

        if (line.startsWith("## ")) {
          return (
            <h3 key={`${line}-${index}`} className="text-lg font-semibold text-stone-100">
              {line.replace("## ", "")}
            </h3>
          );
        }

        if (line.startsWith("- ")) {
          return (
            <p key={`${line}-${index}`} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-stone-400" />
              <span>{renderInlineBold(line.replace("- ", ""))}</span>
            </p>
          );
        }

        return <p key={`${line}-${index}`}>{renderInlineBold(line)}</p>;
      })}
    </div>
  );
}

function renderInlineBold(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${part}-${index}`} className="font-semibold text-stone-100">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

export default ResourcesPage;
