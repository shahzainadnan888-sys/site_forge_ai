import type { SiteType } from "@/lib/generated-site/detect-site-type";
import { getThemedImage } from "@/lib/generated-site/image-catalog";

type Builder = () => string;

function portfolioHome(): string {
  const hero = getThemedImage("portfolio", "hero", 0);
  const avatar = getThemedImage("portfolio", "avatar", 0);
  return `<main id="home">
<section style="padding:clamp(4rem,10vw,6rem) 1.5rem;max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:3rem;align-items:center">
  <div>
    <p style="font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:.8rem;opacity:.7;margin-bottom:1rem">Creative Developer</p>
    <h1 style="font-size:clamp(2.5rem,5vw,3.5rem);font-weight:800;line-height:1.1;margin-bottom:1rem">I design &amp; build premium digital experiences</h1>
    <p style="font-size:1.15rem;line-height:1.65;opacity:.88;margin-bottom:2rem">Full-stack developer specializing in polished interfaces, performant web apps, and memorable brand sites.</p>
    <div style="display:flex;gap:1rem;flex-wrap:wrap">
      <a href="/projects" style="padding:.75rem 1.5rem;border-radius:999px;font-weight:600;background:linear-gradient(90deg,#7c3aed,#d946ef);color:#fff;text-decoration:none">View projects</a>
      <a href="/contact" style="padding:.75rem 1.5rem;border-radius:999px;font-weight:600;border:1px solid rgba(255,255,255,.2);color:inherit;text-decoration:none">Get in touch</a>
    </div>
  </div>
  <img src="${hero}" alt="Developer workspace" loading="lazy" style="width:100%;border-radius:1.25rem" />
</section>
<section style="padding:2rem 1.5rem 4rem;max-width:1100px;margin:0 auto">
  <div style="display:flex;align-items:center;gap:1.5rem;padding:2rem;background:rgba(255,255,255,.04);border-radius:1.25rem;border:1px solid rgba(255,255,255,.08)">
    <img src="${avatar}" alt="Profile" loading="lazy" style="width:80px;height:80px;border-radius:50%;object-fit:cover" />
    <div><h2 style="font-size:1.35rem;font-weight:700">Open to new opportunities</h2><p style="opacity:.8;margin-top:.25rem">React · Next.js · TypeScript · UI/UX</p></div>
  </div>
</section></main>`;
}

function portfolioAbout(): string {
  const avatar = getThemedImage("portfolio", "avatar", 0);
  const office = getThemedImage("portfolio", "office", 0);
  const skills = ["React", "Next.js", "TypeScript", "Node.js", "Figma", "UI/UX", "PostgreSQL", "AWS"]
    .map((s) => `<span style="padding:.35rem .85rem;border-radius:999px;background:rgba(124,58,237,.15);font-size:.85rem;font-weight:600">${s}</span>`)
    .join("");
  return `<main id="about"><section style="padding:clamp(3rem,6vw,5rem) 1.5rem;max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:3rem;align-items:start">
  <img src="${avatar}" alt="Profile photo" loading="lazy" style="width:100%;max-width:320px;border-radius:1.25rem;object-fit:cover" />
  <div>
    <h1 style="font-size:clamp(2rem,4vw,2.75rem);font-weight:800;margin-bottom:1rem">About Me</h1>
    <p style="line-height:1.7;opacity:.9;margin-bottom:1.25rem">Product-minded developer with 6+ years building interfaces users love. I partner with startups and agencies to ship fast without sacrificing craft.</p>
    <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:.75rem">Skills</h2>
    <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:2rem">${skills}</div>
    <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:.75rem">Experience</h2>
    <ul style="line-height:1.8;opacity:.9;list-style:none;padding:0">
      <li><strong>Senior Frontend Engineer</strong> — Product Studio (2022–Present)</li>
      <li><strong>Full-Stack Developer</strong> — Digital Agency (2019–2022)</li>
    </ul>
  </div>
</section>
<section style="padding:0 1.5rem 4rem;max-width:1100px;margin:0 auto"><img src="${office}" alt="Collaboration" loading="lazy" style="width:100%;border-radius:1rem;max-height:360px;object-fit:cover" /></section>
</main>`;
}

function portfolioProjects(): string {
  const titles = ["Analytics Dashboard", "E-commerce Platform", "Brand Experience"];
  const stacks = ["React · TypeScript · Node", "Next.js · Stripe · Tailwind", "HTML · CSS · Motion"];
  const descs = [
    "Real-time metrics with role-based access and exportable reports.",
    "Mobile-first storefront with optimized checkout and conversion UX.",
    "Scroll-driven storytelling with premium micro-interactions.",
  ];
  const cards = titles
    .map((title, i) => {
      const img = getThemedImage("portfolio", "card", i);
      return `<article style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:1.25rem;overflow:hidden">
      <img src="${img}" alt="${title}" loading="lazy" style="width:100%;height:200px;object-fit:cover" />
      <div style="padding:1.25rem"><h2 style="font-size:1.2rem;font-weight:700">${title}</h2>
      <p style="font-size:.8rem;opacity:.65;margin:.35rem 0 .75rem">${stacks[i]}</p>
      <p style="line-height:1.55;opacity:.9;margin-bottom:1rem">${descs[i]}</p>
      <a href="/contact" style="padding:.5rem 1rem;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#d946ef);color:#fff;text-decoration:none;font-weight:600;font-size:.875rem">View case study</a></div></article>`;
    })
    .join("");
  return `<main id="projects"><section style="padding:clamp(3rem,6vw,5rem) 1.5rem;max-width:1100px;margin:0 auto">
  <h1 style="font-size:clamp(2rem,4vw,2.75rem);font-weight:800;margin-bottom:.5rem">Featured Projects</h1>
  <p style="font-size:1.1rem;opacity:.85;margin-bottom:2.5rem">Recent work across product, commerce, and brand experiences.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem">${cards}</div>
</section></main>`;
}

function contactPage(): string {
  return `<main id="contact"><section style="padding:clamp(3rem,6vw,5rem) 1.5rem;max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:3rem">
  <div>
    <h1 style="font-size:clamp(2rem,4vw,2.75rem);font-weight:800;margin-bottom:.75rem">Let's work together</h1>
    <p style="line-height:1.65;opacity:.88;margin-bottom:2rem">Have a project in mind? I typically respond within 24 hours.</p>
    <p><strong>Email:</strong> hello@example.com</p>
    <p><strong>Location:</strong> Remote · Worldwide</p>
    <p style="margin-top:1.5rem;display:flex;gap:1rem"><a href="#">LinkedIn</a><a href="#">GitHub</a><a href="#">Dribbble</a></p>
  </div>
  <form style="display:flex;flex-direction:column;gap:1rem;padding:2rem;border-radius:1.25rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)">
    <label>Name<input type="text" name="name" required style="width:100%;padding:.75rem;margin-top:.35rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.15);background:transparent;color:inherit" /></label>
    <label>Email<input type="email" name="email" required style="width:100%;padding:.75rem;margin-top:.35rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.15);background:transparent;color:inherit" /></label>
    <label>Message<textarea name="message" rows="4" required style="width:100%;padding:.75rem;margin-top:.35rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.15);background:transparent;color:inherit"></textarea></label>
    <button type="submit" style="padding:.85rem;border:none;border-radius:999px;font-weight:700;background:linear-gradient(90deg,#7c3aed,#d946ef);color:#fff;cursor:pointer">Send message</button>
  </form>
</section></main>`;
}

function servicesPage(): string {
  const img = getThemedImage("business", "feature", 0);
  const items = ["Strategy & Discovery", "Design Systems", "Web Development", "Growth & SEO"]
    .map(
      (t) => `<article style="padding:1.5rem;border-radius:1rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03)"><h3 style="font-weight:700;margin-bottom:.5rem">${t}</h3><p style="opacity:.85;line-height:1.6">End-to-end delivery with measurable outcomes and premium polish.</p></article>`
    )
    .join("");
  return `<main><section style="padding:clamp(3rem,6vw,5rem) 1.5rem;max-width:1100px;margin:0 auto">
  <h1 style="font-size:clamp(2rem,4vw,2.75rem);font-weight:800;margin-bottom:2rem">Our Services</h1>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.25rem;margin-bottom:3rem">${items}</div>
  <img src="${img}" alt="Services" loading="lazy" style="width:100%;border-radius:1rem;max-height:400px;object-fit:cover" />
</section></main>`;
}

function productsPage(): string {
  const names = ["Classic Sneaker", "Wireless Headphones", "Minimal Watch", "Leather Backpack"];
  const prices = ["$129", "$249", "$199", "$89"];
  const cards = names
    .map((name, i) => {
      const img = getThemedImage("ecommerce", "product", i);
      return `<article style="border-radius:1rem;overflow:hidden;border:1px solid rgba(255,255,255,.1)">
      <img src="${img}" alt="${name}" loading="lazy" style="width:100%;height:220px;object-fit:cover" />
      <div style="padding:1rem"><h3 style="font-weight:700">${name}</h3><p style="font-size:1.1rem;font-weight:600;margin:.5rem 0 1rem">${prices[i]}</p>
      <button style="width:100%;padding:.65rem;border:none;border-radius:.5rem;font-weight:600;background:linear-gradient(90deg,#7c3aed,#d946ef);color:#fff">Add to cart</button></div></article>`;
    })
    .join("");
  return `<main><section style="padding:clamp(3rem,6vw,5rem) 1.5rem;max-width:1100px;margin:0 auto">
  <h1 style="font-size:clamp(2rem,4vw,2.75rem);font-weight:800;margin-bottom:2rem">Shop Collection</h1>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.5rem">${cards}</div>
</section></main>`;
}

function pricingPage(): string {
  const tiers = [
    ["Starter", "$19/mo", "Core features, email support"],
    ["Pro", "$49/mo", "Advanced analytics, priority support"],
    ["Enterprise", "Custom", "SSO, SLA, dedicated success"],
  ];
  const cards = tiers
    .map(
      ([name, price, feat]) => `<article style="padding:2rem;border-radius:1.25rem;border:1px solid rgba(255,255,255,.12);text-align:center">
      <h3 style="font-size:1.25rem;font-weight:700">${name}</h3><p style="font-size:2rem;font-weight:800;margin:1rem 0">${price}</p><p style="opacity:.85;margin-bottom:1.5rem">${feat}</p>
      <a href="/contact" style="display:inline-block;padding:.65rem 1.25rem;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#d946ef);color:#fff;text-decoration:none;font-weight:600">Get started</a></article>`
    )
    .join("");
  return `<main><section style="padding:clamp(3rem,6vw,5rem) 1.5rem;max-width:1000px;margin:0 auto">
  <h1 style="font-size:clamp(2rem,4vw,2.75rem);font-weight:800;text-align:center;margin-bottom:2.5rem">Simple pricing</h1>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem">${cards}</div>
</section></main>`;
}

function menuPage(): string {
  const dishes = [
    ["Truffle Pasta", "$24", "Handmade pasta, wild mushrooms, parmesan"],
    ["Grilled Salmon", "$28", "Citrus glaze, seasonal vegetables"],
    ["Chocolate Soufflé", "$12", "Warm center, vanilla bean ice cream"],
  ];
  const items = dishes
    .map(
      ([name, price, desc]) => `<article style="display:flex;justify-content:space-between;gap:1rem;padding:1.25rem 0;border-bottom:1px solid rgba(255,255,255,.1)">
      <div><h3 style="font-weight:700">${name}</h3><p style="opacity:.8;font-size:.95rem">${desc}</p></div><span style="font-weight:700">${price}</span></article>`
    )
    .join("");
  const hero = getThemedImage("restaurant", "food", 0);
  return `<main><section style="padding:clamp(3rem,6vw,5rem) 1.5rem;max-width:800px;margin:0 auto">
  <img src="${hero}" alt="Featured dish" loading="lazy" style="width:100%;border-radius:1rem;margin-bottom:2rem;max-height:320px;object-fit:cover" />
  <h1 style="font-size:clamp(2rem,4vw,2.75rem);font-weight:800;margin-bottom:2rem">Our Menu</h1>${items}
</section></main>`;
}

function galleryPage(): string {
  const imgs = [0, 1, 2, 3].map((i) => getThemedImage("restaurant", "food", i % 3));
  const grid = imgs
    .map((src, i) => `<img src="${src}" alt="Gallery ${i + 1}" loading="lazy" style="width:100%;height:220px;object-fit:cover;border-radius:.75rem" />`)
    .join("");
  return `<main><section style="padding:clamp(3rem,6vw,5rem) 1.5rem;max-width:1100px;margin:0 auto">
  <h1 style="font-size:clamp(2rem,4vw,2.75rem);font-weight:800;margin-bottom:2rem">Gallery</h1>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">${grid}</div>
</section></main>`;
}

function featuresPage(): string {
  const img = getThemedImage("saas", "feature", 0);
  return `<main><section style="padding:clamp(3rem,6vw,5rem) 1.5rem;max-width:1100px;margin:0 auto">
  <h1 style="font-size:clamp(2rem,4vw,2.75rem);font-weight:800;margin-bottom:1rem">Powerful features</h1>
  <p style="opacity:.88;margin-bottom:2rem;max-width:36rem">Analytics, automation, and collaboration tools built for modern teams.</p>
  <img src="${img}" alt="Product dashboard" loading="lazy" style="width:100%;border-radius:1rem;margin-bottom:2rem" />
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">
    ${["Real-time analytics", "Team workspaces", "API integrations", "Enterprise security"].map((f) => `<div style="padding:1.25rem;border-radius:1rem;border:1px solid rgba(255,255,255,.1)"><strong>${f}</strong></div>`).join("")}
  </div>
</section></main>`;
}

function genericHome(type: SiteType): string {
  const hero = getThemedImage(type, "hero", 0);
  return `<main><section style="padding:clamp(4rem,8vw,6rem) 1.5rem;max-width:1100px;margin:0 auto;text-align:center">
  <h1 style="font-size:clamp(2.5rem,5vw,3.5rem);font-weight:800;margin-bottom:1rem">Welcome</h1>
  <p style="font-size:1.15rem;opacity:.88;max-width:36rem;margin:0 auto 2rem">Premium ${type} experience — crafted with modern design and attention to detail.</p>
  <img src="${hero}" alt="Hero" loading="lazy" style="width:100%;max-width:800px;border-radius:1.25rem;margin:0 auto" />
  <p style="margin-top:2rem"><a href="/contact" style="padding:.75rem 1.5rem;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#d946ef);color:#fff;text-decoration:none;font-weight:600">Contact us</a></p>
</section></main>`;
}

const SLUG_BUILDERS: Record<string, Builder> = {
  "": () => portfolioHome(),
  home: () => portfolioHome(),
  about: () => portfolioAbout(),
  projects: () => portfolioProjects(),
  portfolio: () => portfolioProjects(),
  work: () => portfolioProjects(),
  contact: () => contactPage(),
  services: () => servicesPage(),
  service: () => servicesPage(),
  products: () => productsPage(),
  product: () => productsPage(),
  shop: () => productsPage(),
  pricing: () => pricingPage(),
  menu: () => menuPage(),
  gallery: () => galleryPage(),
  features: () => featuresPage(),
  feature: () => featuresPage(),
  blog: () => productsPage(),
};

const TYPE_HOME: Partial<Record<SiteType, Builder>> = {
  portfolio: portfolioHome,
  business: () => genericHome("business"),
  ecommerce: () => genericHome("ecommerce"),
  saas: () => genericHome("saas"),
  agency: () => genericHome("agency"),
  restaurant: () => genericHome("restaurant"),
  blog: () => genericHome("blog"),
  landing: () => genericHome("landing"),
  general: () => genericHome("general"),
};

export function getRichMainContent(siteType: SiteType, slug: string): string {
  const key = slug || "";
  if (key === "" && TYPE_HOME[siteType]) {
    return TYPE_HOME[siteType]!();
  }
  const builder = SLUG_BUILDERS[key] ?? SLUG_BUILDERS.contact;
  return builder();
}

export function buildRichPageFromTemplate(templateHtml: string, siteType: SiteType, slug: string): string {
  const main = getRichMainContent(siteType, slug);
  const label = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "Home";
  let html = templateHtml;
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${label}</title>`);
  if (/<main\b[\s\S]*?<\/main>/i.test(html)) {
    html = html.replace(/<main\b[\s\S]*?<\/main>/i, main);
  } else {
    html = html.replace(/(<body\b[^>]*>)/i, `$1${main}`);
  }
  return html;
}
