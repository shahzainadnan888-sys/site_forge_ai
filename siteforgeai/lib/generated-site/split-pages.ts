import { normalizePageSlug } from "@/lib/generated-site/normalize-slug";
import type { SitePageMap } from "@/lib/generated-site/types";
function normalizeModelHtml(raw: string): string {
  let text = (raw || "").trim();
  if (!text) return "";
  text = text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const lower = text.toLowerCase();
  const doctypeIdx = lower.indexOf("<!doctype html>");
  const htmlIdx = lower.indexOf("<html");
  if (doctypeIdx >= 0) {
    text = text.slice(doctypeIdx).trim();
  } else if (htmlIdx >= 0) {
    text = `<!DOCTYPE html>\n${text.slice(htmlIdx).trim()}`;
  }
  const endIdx = text.toLowerCase().lastIndexOf("</html>");
  if (endIdx >= 0) text = text.slice(0, endIdx + "</html>".length).trim();
  return text.trim();
}

const PAGE_MARKER_RE = /<!--\s*SITEFORGE_PAGE:([^>]*)\s*-->/gi;

/** Split model output into per-slug HTML pages. Falls back to single home page if no markers. */
export function splitGeneratedPages(raw: string): SitePageMap {
  const text = raw.trim();
  if (!text) return { "": "" };

  const markers = [...text.matchAll(PAGE_MARKER_RE)];
  if (markers.length === 0) {
    const single = normalizeModelHtml(text);
    return single ? { "": single } : { "": "" };
  }

  const pages: SitePageMap = {};
  const firstIdx = markers[0].index ?? 0;
  const beforeFirst = normalizeModelHtml(text.slice(0, firstIdx));
  if (beforeFirst) {
    pages[""] = beforeFirst;
  }

  for (let i = 0; i < markers.length; i++) {
    const match = markers[i];
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < markers.length ? (markers[i + 1].index ?? text.length) : text.length;
    const html = normalizeModelHtml(text.slice(start, end));
    if (!html) continue;
    const slug = normalizePageSlug(match[1]);
    if (slug === "" && pages[""] && pages[""].length >= html.length) continue;
    pages[slug] = html;
  }

  if (Object.keys(pages).length === 0) {
    const single = normalizeModelHtml(text);
    if (single) pages[""] = single;
  }

  return pages;
}

export function primaryHtmlFromPages(pages: SitePageMap): string {
  return pages[""] ?? pages.home ?? Object.values(pages)[0] ?? "";
}
