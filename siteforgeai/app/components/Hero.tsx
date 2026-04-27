import Link from "next/link";
import { Typewriter } from "./Typewriter";

export function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <p
          className="sf-fade-up sf-animate-delay-1 mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
          style={{
            borderColor: "var(--sf-border)",
            color: "var(--sf-text-muted)",
            background: "color-mix(in srgb, var(--sf-card) 90%, transparent)",
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
              boxShadow: "0 0 8px var(--sf-glow)",
            }}
          />
          AI-powered website builder
        </p>

        <h1
          className="sf-fade-up sf-animate-delay-2 text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl"
          style={{ color: "var(--sf-text)" }}
        >
          Build Websites
          <br />
          with AI in Seconds
        </h1>

        <p
          className="sf-fade-up sf-animate-delay-3 mt-6 flex min-h-[2.5rem] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-lg sm:text-xl"
          style={{ color: "var(--sf-text-muted)" }}
        >
          <span>Perfect for</span>
          <Typewriter />
        </p>

        <div className="sf-fade-up sf-animate-delay-4 mt-10 flex w-full min-w-0 max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/dashboard"
            className="sf-cta-glow inline-flex w-full min-w-0 max-w-sm items-center justify-center self-center rounded-full px-8 py-3.5 text-base font-semibold text-white transition hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:min-w-[200px] sm:max-w-none"
            style={{
              background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
            }}
          >
            Start building free
          </Link>
          <Link
            href="#preview"
            className="inline-flex w-full min-w-0 max-w-sm items-center justify-center self-center rounded-full border px-8 py-3.5 text-base font-semibold transition hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:min-w-[200px] sm:max-w-none"
            style={{
              borderColor: "var(--sf-border)",
              color: "var(--sf-text)",
              background: "var(--sf-card)",
              boxShadow: "0 0 0 1px var(--sf-border)",
            }}
          >
            View live demo
          </Link>
        </div>
      </div>
    </section>
  );
}
