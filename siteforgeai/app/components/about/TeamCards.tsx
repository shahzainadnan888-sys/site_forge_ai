const team = [
  {
    name: "Shahzain Adnan",
    role: "Founder",
    bio: "Leading product direction, growth, and overall vision for SiteForge AI.",
    initials: "SA",
  },
  {
    name: "Arooj Zahra",
    role: "Co-founder",
    bio: "Co-leading strategy and execution to deliver a seamless AI website building experience.",
    initials: "AZ",
  },
] as const;

function Avatar({ initials }: { initials: string }) {
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
      style={{
        background: `linear-gradient(135deg, var(--sf-accent-from), var(--sf-accent-to))`,
        boxShadow: "0 0 20px var(--sf-glow)",
      }}
    >
      {initials}
    </div>
  );
}

export function TeamCards() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6 sm:pb-24 sm:pt-8">
      <div className="text-center">
        <h2
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--sf-text)" }}
        >
          Team
        </h2>
        <p
          className="mx-auto mt-3 max-w-2xl text-base sm:text-lg"
          style={{ color: "var(--sf-text-muted)" }}
        >
          Built by a focused founding team committed to making web creation simpler.
        </p>
      </div>

      <ul className="mt-12 grid gap-6 sm:grid-cols-2">
        {team.map((person) => (
          <li
            key={person.name}
            className="sf-glass sf-card-hover flex gap-4 rounded-2xl p-6 sm:p-7"
            style={{ transition: "transform 0.35s ease, box-shadow 0.35s ease" }}
          >
            <Avatar initials={person.initials} />
            <div className="min-w-0">
              <h3
                className="text-lg font-semibold"
                style={{ color: "var(--sf-text)" }}
              >
                {person.name}
              </h3>
              <p
                className="mt-0.5 text-sm font-medium"
                style={{ color: "var(--sf-accent-from)" }}
              >
                {person.role}
              </p>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--sf-text-muted)" }}
              >
                {person.bio}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
