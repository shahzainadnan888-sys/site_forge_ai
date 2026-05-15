import { normalizePageSlug, slugFromPathSegments } from "@/lib/generated-site/normalize-slug";
import type { SitePageMap } from "@/lib/generated-site/types";

export function pagesFromFirestoreData(data: Record<string, unknown> | undefined): SitePageMap | null {
  if (!data) return null;
  const legacy = typeof data.htmlContent === "string" ? data.htmlContent : "";
  const rawPages = data.pages;
  if (rawPages && typeof rawPages === "object" && !Array.isArray(rawPages)) {
    const map: SitePageMap = {};
    for (const [k, v] of Object.entries(rawPages as Record<string, unknown>)) {
      if (typeof v === "string" && v.includes("</html>")) {
        map[normalizePageSlug(k)] = v;
      }
    }
    if (Object.keys(map).length > 0) return map;
  }
  if (legacy && legacy.includes("</html>")) {
    return { "": legacy };
  }
  return null;
}

export function resolvePageHtml(
  pages: SitePageMap,
  slugSegments: string[] | undefined
): { html: string; slug: string; found: boolean } {
  const slug = slugFromPathSegments(slugSegments);
  if (slug in pages) {
    return { html: pages[slug]!, slug, found: true };
  }
  if (slug === "" && pages[""]) {
    return { html: pages[""], slug: "", found: true };
  }
  return { html: "", slug, found: false };
}
