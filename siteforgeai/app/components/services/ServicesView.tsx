"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SERVICE_FEATURE_CARDS } from "@/lib/service-feature-cards";

function IconGenerator() {
  return (
    <svg
      className="sf-icon-ai-gen h-8 w-8"
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

function IconEditor() {
  return (
    <div className="sf-icon-editor-outer inline-flex h-8 w-8 items-center justify-center">
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
        <rect
          x="3.5"
          y="3.5"
          width="6.5"
          height="6.5"
          rx="1.5"
          className="sf-ed-pulse-1"
          fill="var(--sf-accent-from)"
        />
        <rect
          x="14"
          y="3.5"
          width="6.5"
          height="6.5"
          rx="1.5"
          className="sf-ed-pulse-2"
          fill="var(--sf-accent-to)"
        />
        <rect
          x="3.5"
          y="14"
          width="6.5"
          height="6.5"
          rx="1.5"
          className="sf-ed-pulse-3"
          fill="var(--sf-accent-to)"
        />
        <rect
          x="14"
          y="14"
          width="6.5"
          height="6.5"
          rx="1.5"
          className="sf-ed-pulse-4"
          fill="var(--sf-accent-from)"
        />
      </svg>
    </div>
  );
}

function IconDeploy() {
  return (
    <svg
      className="sf-icon-deploy h-8 w-8"
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

/** Real-time / live preview — monitor + content lines */
function IconPreview() {
  return (
    <svg
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <rect x="2.25" y="3.5" width="19.5" height="14" rx="2" />
      <path strokeLinecap="round" d="M8 21.25h8M12 17.5v3.75" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 7.5h11M6.5 10.5h7"
        className="opacity-70"
        strokeWidth={1.25}
      />
    </svg>
  );
}

const serviceIcons: (() => ReactNode)[] = [
  IconGenerator,
  IconEditor,
  IconPreview,
  IconDeploy,
];

const services: {
  title: string;
  description: string;
  Icon: () => ReactNode;
}[] = SERVICE_FEATURE_CARDS.map((s, i) => ({
  ...s,
  Icon: serviceIcons[i] ?? IconGenerator,
}));

function ScrollRevealItem({
  children,
  className = "",
  delay = "0s",
}: {
  children: ReactNode;
  className?: string;
  delay?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setInView(true);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ ["--sf-reveal-delay" as string]: delay }}
    >
      <div
        className={
          inView
            ? "sf-reveal sf-reveal--in h-full"
            : "sf-reveal h-full"
        }
      >
        {children}
      </div>
    </div>
  );
}

export function ServicesView() {
  return (
    <>
      <section className="relative mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="sf-fade-up sf-animate-delay-1 mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
            style={{
              borderColor: "var(--sf-border)",
              color: "var(--sf-text-muted)",
              background: "color-mix(in srgb, var(--sf-card) 60%, transparent)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
                boxShadow: "0 0 8px var(--sf-glow)",
              }}
            />
            Services
          </p>
          <h1
            className="sf-fade-up sf-animate-delay-2 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl"
            style={{ color: "var(--sf-text)" }}
          >
            <span className="block sm:inline">Everything you need to</span>{" "}
            <span
              className="mt-0.5 block bg-clip-text text-transparent sm:mt-0 sm:inline"
              style={{
                backgroundImage: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
              }}
            >
              build and launch
            </span>
          </h1>
          <div
            className="sf-fade-up sf-animate-delay-3 mx-auto mt-5 max-w-xl space-y-4 text-center text-base sm:text-lg"
            style={{ color: "var(--sf-text-muted)" }}
          >
            <p>
              We offer a streamlined website generation service designed to help you build
              single page, responsive, and high-quality websites in minutes.
            </p>
            <p>
              Our platform provides expertly crafted templates, landing pages, and
              single-page portfolio solutions tailored for speed, performance, and clean
              design.
            </p>
            <p>
              Whether you&apos;re launching a product, showcasing your work, building
              your online presence, or need a sample project to present to your client, we
              deliver production-ready websites without the complexity of coding.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((s, i) => {
            const Icon = s.Icon;
            return (
              <li key={s.title} className="h-full min-h-0">
                <ScrollRevealItem
                  className="h-full"
                  delay={`${0.08 * (i + 1)}s`}
                >
                  <article
                    className="sf-glass sf-service-glow group flex h-full flex-col rounded-2xl p-6 sm:p-7"
                    style={{ color: "var(--sf-text)" }}
                  >
                    <div
                      className="mb-5 inline-flex rounded-2xl p-3 transition-transform duration-500 group-hover:scale-105"
                      style={{
                        color: "var(--sf-accent-from)",
                        background:
                          "color-mix(in srgb, var(--sf-accent-from) 14%, transparent)",
                      }}
                    >
                      <Icon />
                    </div>
                    <h2 className="text-xl font-semibold sm:text-2xl">{s.title}</h2>
                    <p
                      className="mt-2 flex-1 text-sm leading-relaxed sm:text-base"
                      style={{ color: "var(--sf-text-muted)" }}
                    >
                      {s.description}
                    </p>
                    <div
                      className="mt-4 h-px w-full max-w-[120px] rounded-full transition-all duration-500 group-hover:max-w-full"
                      style={{
                        background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
                        opacity: 0.7,
                      }}
                    />
                  </article>
                </ScrollRevealItem>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
