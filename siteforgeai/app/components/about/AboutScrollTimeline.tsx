"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const milestones = [
  {
    year: "2023",
    title: "The spark",
    text: "Early prototypes: prompt in, page structure out. We obsessed over legibility, spacing, and “does this feel real?”",
  },
  {
    year: "2024",
    title: "Editor in the loop",
    text: "Visual editing landed—every block became selectable. AI drafts; you direct. Iteration time dropped to seconds.",
  },
  {
    year: "2025",
    title: "Deploy that scales",
    text: "Edge delivery, SSL, and preview links shipped. Team workspaces and guardrails to keep brand voice consistent.",
  },
  {
    year: "2026",
    title: "The road ahead",
    text: "Deeper design systems, smarter components, and more ways to go from storyboard to site—without a ticket queue.",
  },
] as const;

export function AboutScrollTimeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [lineProgress, setLineProgress] = useState(0);
  const [trackH, setTrackH] = useState(0);
  const [visible, setVisible] = useState<Record<number, boolean>>({});

  const updateLine = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const sectionH = el.offsetHeight;
    const start = (vh * 0.5 - rect.top) / Math.max(sectionH * 0.7, 1);
    setLineProgress(Math.min(1, Math.max(0, start)));
  }, []);

  useEffect(() => {
    updateLine();
    window.addEventListener("scroll", updateLine, { passive: true });
    window.addEventListener("resize", updateLine, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateLine);
      window.removeEventListener("resize", updateLine);
    };
  }, [updateLine]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const items = sectionRef.current?.querySelectorAll<HTMLElement>("[data-timeline-item]");
    if (!items?.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = (e.target as HTMLElement).dataset.index;
          if (i == null) continue;
          if (e.isIntersecting) {
            setVisible((prev) => ({ ...prev, [Number(i)]: true }));
          }
        }
      },
      { root: null, rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    for (const n of items) obs.observe(n);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="text-center">
        <h2
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--sf-text)" }}
        >
          Our timeline
        </h2>
        <p
          className="mx-auto mt-3 max-w-2xl text-base sm:text-lg"
          style={{ color: "var(--sf-text-muted)" }}
        >
          From nights-and-weekends to a product teams trust—scroll to watch the story
          unfold.
        </p>
      </div>

      <div ref={trackRef} className="relative mt-16">
        <div
          className="pointer-events-none absolute bottom-0 left-4 top-0 w-px -translate-x-1/2 sm:left-5"
          style={{ background: "var(--sf-border)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-4 top-0 w-0.5 -translate-x-1/2 sm:left-5"
          style={{
            height: trackH * lineProgress,
            maxHeight: trackH,
            background: `linear-gradient(180deg, var(--sf-accent-from), var(--sf-accent-to))`,
            boxShadow: "0 0 16px var(--sf-glow)",
            transition: "height 0.12s ease-out",
          }}
          aria-hidden
        />

        <ol className="relative space-y-10 pl-10 sm:pl-14">
          {milestones.map((m, i) => (
            <li
              key={m.year}
              data-timeline-item
              data-index={i}
              className="relative transition-all duration-700 ease-out"
              style={{
                opacity: visible[i] ? 1 : 0.35,
                transform: visible[i] ? "translateX(0)" : "translateX(-8px)",
              }}
            >
              <div
                className="absolute left-4 top-6 flex h-8 w-8 -translate-x-1/2 items-center justify-center sm:left-5 sm:top-7 sm:h-9 sm:w-9"
                aria-hidden
              >
                <div
                  className="h-3.5 w-3.5 rounded-full border-2 sm:h-4 sm:w-4"
                  style={{
                    borderColor: "var(--sf-card)",
                    background: `linear-gradient(135deg, var(--sf-accent-from), var(--sf-accent-to))`,
                    boxShadow: visible[i] ? "0 0 12px var(--sf-glow)" : "none",
                    transition: "box-shadow 0.5s ease",
                  }}
                />
              </div>
              <div
                className="sf-glass sf-card-hover rounded-2xl p-6 sm:p-8"
                style={{ transition: "transform 0.35s ease, box-shadow 0.35s ease" }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm"
                  style={{ color: "var(--sf-accent-from)" }}
                >
                  {m.year}
                </p>
                <h3
                  className="mt-2 text-xl font-semibold"
                  style={{ color: "var(--sf-text)" }}
                >
                  {m.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed sm:text-base"
                  style={{ color: "var(--sf-text-muted)" }}
                >
                  {m.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
