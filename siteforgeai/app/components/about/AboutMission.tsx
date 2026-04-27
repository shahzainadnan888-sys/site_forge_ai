export function AboutMission() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div
        className="sf-glass sf-card-hover relative overflow-hidden rounded-3xl p-8 sm:p-12 md:p-14"
        style={{ transition: "transform 0.4s ease, box-shadow 0.4s ease" }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl"
          style={{
            background: "color-mix(in srgb, var(--sf-accent-from) 25%, transparent)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full blur-3xl"
          style={{
            background: "color-mix(in srgb, var(--sf-accent-to) 20%, transparent)",
          }}
          aria-hidden
        />

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm"
              style={{ color: "var(--sf-accent-from)" }}
            >
              Our goals
            </p>
            <h2
              className="mt-3 text-2xl font-bold leading-snug sm:text-3xl"
              style={{ color: "var(--sf-text)" }}
            >
              Help every founder and creator launch faster with less friction.
            </h2>
            <p
              className="mt-4 text-base leading-relaxed sm:text-lg"
              style={{ color: "var(--sf-text-muted)" }}
            >
              We focus on speed, clarity, and quality. SiteForge AI is built to reduce
              setup overhead so users can move from idea to publish-ready website in
              minutes.
            </p>
          </div>

          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm"
              style={{ color: "var(--sf-accent-from)" }}
            >
              Our vision
            </p>
            <h2
              className="mt-3 text-2xl font-bold leading-snug sm:text-3xl"
              style={{ color: "var(--sf-text)" }}
            >
              Make website creation as easy as describing what you want.
            </h2>
            <p
              className="mt-4 text-base leading-relaxed sm:text-lg"
              style={{ color: "var(--sf-text-muted)" }}
            >
              We imagine a future where anyone can design, edit, and deploy high-quality
              websites with AI guidance while still keeping full creative control.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
