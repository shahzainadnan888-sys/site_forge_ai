const steps = [
  {
    title: "Describe your idea",
    copy: "Type a short brief—audience, tone, and the outcome you need from the page.",
  },
  {
    title: "AI drafts your site",
    copy: "SiteForge assembles structure, copy, and visuals into a responsive layout you can open instantly.",
  },
  {
    title: "Refine in the editor",
    copy: "Click anything to adjust spacing, colors, and sections. Every change is visual—no hand-written CSS.",
  },
  {
    title: "Publish in one click",
    copy: "Connect a domain or use a free subdomain. We handle SSL, caching, and global delivery.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6"
    >
      <div className="text-center">
        <h2
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--sf-text)" }}
        >
          How it works
        </h2>
        <p
          className="mx-auto mt-3 max-w-2xl text-base sm:text-lg"
          style={{ color: "var(--sf-text-muted)" }}
        >
          Four clear steps from prompt to a live, polished site.
        </p>
      </div>

      <ol className="relative mt-16 grid gap-8 lg:grid-cols-2">
        <li
          className="pointer-events-none absolute left-[50%] top-0 hidden h-full w-px -translate-x-1/2 lg:block"
          style={{
            background: `linear-gradient(180deg, var(--sf-accent-from), var(--sf-accent-to))`,
            opacity: 0.35,
          }}
          aria-hidden
        />
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="sf-card-hover relative rounded-2xl border p-6 sm:p-8"
            style={{
              background: "var(--sf-card)",
              borderColor: "var(--sf-border)",
            }}
          >
            <div
              className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{
                background: `linear-gradient(135deg, var(--sf-accent-from), var(--sf-accent-to))`,
                boxShadow: "0 0 20px var(--sf-glow)",
              }}
            >
              {i + 1}
            </div>
            <h3
              className="text-xl font-semibold"
              style={{ color: "var(--sf-text)" }}
            >
              {s.title}
            </h3>
            <p
              className="mt-2 text-sm leading-relaxed sm:text-base"
              style={{ color: "var(--sf-text-muted)" }}
            >
              {s.copy}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
