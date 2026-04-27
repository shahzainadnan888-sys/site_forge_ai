function ChevronDown() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <svg
        className="h-5 w-5 opacity-45"
        style={{ color: "var(--sf-text-muted)" }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

const layers = [
  {
    title: "Your brief",
    body: "Goals, audience, and tone. We keep prompts short and structured so the model has clear constraints.",
    mono: "brand · audience · CTA",
  },
  {
    title: "Context layer",
    body: "Layout tokens, design system, and accessible defaults merge with your text so output stays on-brand.",
    mono: "tokens + a11y + structure",
  },
  {
    title: "Model pass",
    body: "A frontier model plans sections, refines copy, and suggests variants you can pick in one click.",
    mono: "plan → draft → options",
  },
  {
    title: "Canvas output",
    body: "React-ready blocks land in a live editor. Edits are visual; export stays clean for when you are ready to ship.",
    mono: "edit · preview · deploy",
  },
] as const;

export function HowAILayers() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="text-center">
        <h2
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--sf-text)" }}
        >
          How the AI works
        </h2>
        <p
          className="mx-auto mt-3 max-w-2xl text-base sm:text-lg"
          style={{ color: "var(--sf-text-muted)" }}
        >
          A transparent stack: your intent, our guardrails, a capable model, and a
          surface you can actually refine.
        </p>
      </div>

      <ol className="mt-12 list-none p-0">
        {layers.map((layer, i) => (
          <li key={layer.title}>
            <div
              className="sf-glass group relative overflow-hidden rounded-2xl p-5 transition duration-500 hover:shadow-lg sm:p-6"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}
            >
              {i === 2 && (
                <div
                  className="absolute right-4 top-4 h-2 w-2 rounded-full sm:right-5 sm:top-5"
                  style={{
                    background: `linear-gradient(135deg, var(--sf-accent-from), var(--sf-accent-to))`,
                    animation: "sf-pulse-node 2.2s ease-in-out infinite",
                  }}
                  aria-hidden
                />
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-5">
                <div
                  className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, var(--sf-accent-from), var(--sf-accent-to))`,
                    boxShadow: i === 2 ? "0 0 20px var(--sf-glow)" : undefined,
                  }}
                >
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className="text-lg font-semibold"
                    style={{ color: "var(--sf-text)" }}
                  >
                    {layer.title}
                  </h3>
                  <p
                    className="mt-1.5 text-sm leading-relaxed sm:text-base"
                    style={{ color: "var(--sf-text-muted)" }}
                  >
                    {layer.body}
                  </p>
                  <pre
                    className="mt-3 overflow-x-auto rounded-lg border px-3 py-2 font-mono text-xs sm:text-sm"
                    style={{
                      borderColor: "var(--sf-border)",
                      color: "var(--sf-text-muted)",
                      background: "color-mix(in srgb, var(--sf-card) 50%, transparent)",
                    }}
                  >
                    {layer.mono}
                  </pre>
                </div>
              </div>
            </div>
            {i < layers.length - 1 && <ChevronDown />}
          </li>
        ))}
      </ol>

      <p
        className="mt-6 text-center text-sm"
        style={{ color: "var(--sf-text-muted)" }}
      >
        No black box: you always see the draft, the structure, and the next best edit.
      </p>
    </section>
  );
}
