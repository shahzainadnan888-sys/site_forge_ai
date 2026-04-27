import Link from "next/link";

export function AboutStoryHero() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-16">
      <div className="mx-auto max-w-3xl text-center">
        <p
          className="sf-fade-up sf-animate-delay-1 mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition hover:scale-[1.01]"
          style={{
            borderColor: "var(--sf-border)",
            color: "var(--sf-text-muted)",
            background: "color-mix(in srgb, var(--sf-card) 60%, transparent)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
              boxShadow: "0 0 8px var(--sf-glow)",
            }}
          />
          Our story
        </p>

        <h1
          className="sf-fade-up sf-animate-delay-2 text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl"
          style={{ color: "var(--sf-text)" }}
        >
          We started where
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
            }}
          >
            build meets imagination
          </span>
        </h1>

        <p
          className="sf-fade-up sf-animate-delay-3 mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg"
          style={{ color: "var(--sf-text-muted)" }}
        >
          We provide simple and fast website generation tools to help you create professional
          websites in minutes. From landing pages to single page portfolios and ready made
          templates, our platform makes it easy for anyone to build and launch a website without
          coding.
        </p>

        <div className="sf-fade-up sf-animate-delay-4 mt-10">
          <Link
            href="/#features"
            className="sf-cta-glow inline-flex min-w-[200px] items-center justify-center rounded-full px-8 py-3.5 text-base font-semibold text-white transition hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
            }}
          >
            Explore the product
          </Link>
        </div>
      </div>
    </section>
  );
}
