function IconWand() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
      />
    </svg>
  );
}

function IconRocket() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
      />
    </svg>
  );
}

const features = [
  {
    title: "AI Generator",
    description:
      "Describe your brand in a sentence. Our models produce layouts, copy, and imagery tuned to your niche.",
    icon: IconWand,
  },
  {
    title: "Live Editor",
    description:
      "Tweak every section in place with a visual canvas. Changes sync instantly—no build step required.",
    icon: IconPencil,
  },
  {
    title: "Deploy",
    description:
      "Ship to a global edge network in one click. Custom domains, SSL, and preview links included.",
    icon: IconRocket,
  },
] as const;

export function FeatureCards() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <h2
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--sf-text)" }}
        >
          Everything to ship faster
        </h2>
        <p
          className="mx-auto mt-3 max-w-2xl text-base sm:text-lg"
          style={{ color: "var(--sf-text-muted)" }}
        >
          From first prompt to production—SiteForge keeps you in flow.
        </p>
      </div>

      <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <li
              key={f.title}
              className="sf-card-hover rounded-2xl border p-6 sm:p-8"
              style={{
                background: "var(--sf-card)",
                borderColor: "var(--sf-border)",
              }}
            >
              <div
                className="mb-5 inline-flex rounded-xl p-3"
                style={{
                  color: "var(--sf-accent-from)",
                  background: "color-mix(in srgb, var(--sf-accent-from) 12%, transparent)",
                }}
              >
                <Icon />
              </div>
              <h3
                className="text-xl font-semibold"
                style={{ color: "var(--sf-text)" }}
              >
                {f.title}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed sm:text-base"
                style={{ color: "var(--sf-text-muted)" }}
              >
                {f.description}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
