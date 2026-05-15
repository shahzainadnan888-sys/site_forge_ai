import { normalizePageSlug } from "@/lib/generated-site/normalize-slug";

/** Map visible nav link text to page slug ("" = home). */
const LABEL_TO_SLUG: Record<string, string> = {
  home: "",
  "main page": "",
  index: "",
  about: "about",
  "about us": "about",
  "about me": "about",
  bio: "about",
  story: "about",
  projects: "projects",
  project: "projects",
  portfolio: "projects",
  work: "projects",
  "my work": "projects",
  "case studies": "projects",
  services: "services",
  service: "services",
  offerings: "services",
  products: "products",
  product: "products",
  shop: "shop",
  store: "shop",
  catalog: "products",
  menu: "menu",
  gallery: "gallery",
  blog: "blog",
  news: "blog",
  articles: "blog",
  pricing: "pricing",
  plans: "pricing",
  contact: "contact",
  "contact us": "contact",
  "get in touch": "contact",
  reach: "contact",
  team: "team",
  careers: "careers",
  faq: "faq",
  features: "features",
  dashboard: "features",
};

function slugFromLinkText(text: string): string | null {
  const t = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!t || t.length > 40) return null;
  if (LABEL_TO_SLUG[t] !== undefined) return LABEL_TO_SLUG[t];
  for (const [label, slug] of Object.entries(LABEL_TO_SLUG)) {
    if (t === label || t.startsWith(`${label} `) || t.endsWith(` ${label}`)) {
      return slug;
    }
  }
  if (/^[a-z][a-z0-9\s-]{1,24}$/.test(t)) {
    return normalizePageSlug(t.replace(/\s+/g, "-"));
  }
  return null;
}

/** Extract slugs from visible text inside <nav>, <header>, and footer nav areas. */
export function extractNavSlugsFromLabels(html: string): string[] {
  const slugs = new Set<string>();
  const blocks =
    html.match(/<nav\b[\s\S]*?<\/nav>/gi) ??
    html.match(/<header\b[\s\S]*?<\/header>/gi) ??
    [];

  for (const block of blocks) {
    const linkRe = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(block))) {
      const slug = slugFromLinkText(m[1]);
      if (slug !== null) slugs.add(slug);
    }
  }

  return [...slugs];
}
