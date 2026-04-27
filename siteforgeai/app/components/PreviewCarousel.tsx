const previews = [
  { name: "Portfolio", bar: "portfolio.site", image: "/Gemini_Generated_Image_pobz0cpobz0cpobz.png" },
  { name: "SaaS", bar: "app.siteforge.ai", image: "/Gemini_Generated_Image_oiwkcmoiwkcmoiwk.png" },
  { name: "E-commerce", bar: "shop.brand.co", image: "/Gemini_Generated_Image_ucnophucnophucno.png" },
  { name: "Landing", bar: "launch.studio", image: "/Gemini_Generated_Image_a1lewna1lewna1le.png" },
  { name: "Agency", bar: "agencyflow.io", image: "/Gemini_Generated_Image_ykzq3oykzq3oykzq.png" },
  { name: "Startup", bar: "founderspace.app", image: "/Gemini_Generated_Image_t01zy6t01zy6t01z.png" },
  { name: "Creator", bar: "creatorhub.pro", image: "/Gemini_Generated_Image_3fvfy13fvfy13fvf.png" },
  { name: "Consulting", bar: "consulting.one", image: "/Gemini_Generated_Image_1ob3er1ob3er1ob3.png" },
  { name: "Product", bar: "productlab.dev", image: "/Gemini_Generated_Image_7758zm7758zm7758.png" },
  { name: "Education", bar: "learnfast.co", image: "/Gemini_Generated_Image_nr0cponr0cponr0c.png" },
] as const;

function PreviewFrame({
  name,
  bar,
  image,
}: (typeof previews)[number]) {
  return (
    <div
      className="w-[min(100%,320px)] shrink-0 snap-center sm:w-[360px]"
      aria-hidden
    >
      <div
        className="overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: "var(--sf-border)",
          background: "var(--sf-card)",
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-3 py-2.5"
          style={{ borderColor: "var(--sf-border)" }}
        >
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <div
            className="ml-2 flex-1 truncate rounded-md px-2 py-0.5 text-center text-xs"
            style={{
              color: "var(--sf-text-muted)",
              background: "color-mix(in srgb, var(--sf-text) 5%, transparent)",
            }}
          >
            {bar}
          </div>
        </div>
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          <img
            src={image}
            alt={`${name} website preview`}
            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(0,0,0,0.5)_100%)]" />
          <p className="absolute bottom-3 left-4 text-xs font-semibold text-white/95 drop-shadow">
            {name} website
          </p>
        </div>
      </div>
    </div>
  );
}

export function PreviewCarousel() {
  const track = [...previews, ...previews];

  return (
    <section id="preview" className="overflow-hidden py-20">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <h2
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--sf-text)" }}
        >
          See what you can build
        </h2>
        <p
          className="mx-auto mt-3 max-w-2xl text-base sm:text-lg"
          style={{ color: "var(--sf-text-muted)" }}
        >
          Auto-rotating previews of layouts generated from real prompts.
        </p>
      </div>

      <div
        className="relative mt-14"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div
          className="flex w-max gap-6 py-2"
          style={{
            animation: "scroll-x 45s linear infinite",
          }}
        >
          {track.map((p, i) => (
            <PreviewFrame key={`${p.name}-${i}`} {...p} />
          ))}
        </div>
      </div>
    </section>
  );
}
