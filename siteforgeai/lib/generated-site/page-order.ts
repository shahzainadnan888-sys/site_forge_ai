import type { SitePageMap } from "@/lib/generated-site/types";

/** Preferred tab order; home ("") always first. */
const PREFERRED_ORDER = [
  "",
  "about",
  "projects",
  "portfolio",
  "work",
  "services",
  "skills",
  "experience",
  "blog",
  "pricing",
  "contact",
] as const;

/** Slugs for UI tabs and publish — home first, then known sections, then the rest alphabetically. */
export function orderedPageSlugs(pages: SitePageMap): string[] {
  const valid = Object.keys(pages).filter((k) => pages[k]?.includes("</html>"));
  const remaining = new Set(valid);

  const ordered: string[] = [];
  for (const slug of PREFERRED_ORDER) {
    if (remaining.has(slug)) {
      ordered.push(slug);
      remaining.delete(slug);
    }
  }

  const rest = [...remaining].sort((a, b) => {
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b);
  });

  return [...ordered, ...rest.filter((s) => !ordered.includes(s))];
}

export function pageTabLabel(slug: string): string {
  if (!slug) return "Home";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
