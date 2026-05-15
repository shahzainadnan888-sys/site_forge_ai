import { defaultSlugsForSiteType, detectSiteType } from "@/lib/generated-site/detect-site-type";
import { extractNavSlugsFromLabels } from "@/lib/generated-site/nav-labels";
import { normalizePageSlug } from "@/lib/generated-site/normalize-slug";
import { isThinPage } from "@/lib/generated-site/page-quality";
import { buildRichPageFromTemplate } from "@/lib/generated-site/rich-page-content";
import type { SitePageMap } from "@/lib/generated-site/types";

/** Parse href into a page slug ("" = home) or null if external / non-nav. */
export function hrefToPageSlug(href: string): string | null {
  let h = (href || "").trim();
  if (!h || /^mailto:|^tel:|^javascript:/i.test(h)) return null;
  if (/^https?:\/\//i.test(h) || h.startsWith("//")) return null;

  if (h.startsWith("#")) {
    const id = normalizePageSlug(h.slice(1));
    return id === "home" ? "" : id;
  }

  const noHash = h.split("#")[0] ?? h;
  const pathOnly = (noHash.split("?")[0] ?? noHash).trim();
  if (!pathOnly) return "";

  if (pathOnly === "/" || pathOnly === "./" || /^index\.html?$/i.test(pathOnly)) return "";

  if (pathOnly.startsWith("/")) {
    return normalizePageSlug(pathOnly.slice(1));
  }

  if (pathOnly.startsWith("./")) {
    return normalizePageSlug(pathOnly.slice(2));
  }

  if (/^[a-z0-9-]+\.html?$/i.test(pathOnly)) {
    return normalizePageSlug(pathOnly.replace(/\.html?$/i, ""));
  }

  if (/^[a-z0-9-]+$/i.test(pathOnly)) {
    return normalizePageSlug(pathOnly);
  }

  return null;
}

function mergeHomeAliases(pages: SitePageMap): SitePageMap {
  const out: SitePageMap = { ...pages };
  if (out.home && (!out[""] || out[""].length < out.home.length)) {
    out[""] = out.home;
  }
  if (out.index && !out[""]) {
    out[""] = out.index;
  }
  delete out.home;
  delete out.index;
  return out;
}

/** Collect slugs referenced by internal <a href> across all pages. */
export function extractNavSlugsFromHtml(html: string): string[] {
  const slugs = new Set<string>();
  const re = /<a\b[^>]*\bhref\s*=\s*(['"])([^'"]*)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = hrefToPageSlug(m[2]);
    if (slug !== null) slugs.add(slug);
  }
  for (const slug of extractNavSlugsFromLabels(html)) {
    slugs.add(slug);
  }
  return [...slugs];
}

function collectExpectedSlugs(pages: SitePageMap, userPrompt?: string): Set<string> {
  const expected = new Set<string>(Object.keys(pages));
  expected.add("");

  for (const html of Object.values(pages)) {
    for (const slug of extractNavSlugsFromHtml(html)) {
      expected.add(slug);
    }
  }

  if (userPrompt) {
    for (const slug of defaultSlugsForSiteType(detectSiteType(userPrompt))) {
      expected.add(slug);
    }
  }

  return expected;
}

function ensureRichPage(template: string, slug: string, siteType: ReturnType<typeof detectSiteType>): string {
  return buildRichPageFromTemplate(template, siteType, slug);
}

/** Rewrite internal anchors to canonical root-relative paths (/, /about, …). */
export function normalizeInternalLinks(html: string, knownSlugs: Set<string>): string {
  return html.replace(/<a\b([^>]*?)\bhref\s*=\s*(['"])([^'"]*)\2([^>]*)>/gi, (full, pre, q, href, post) => {
    const slug = hrefToPageSlug(href);
    if (slug === null) return full;
    if (!knownSlugs.has(slug)) return full;
    const path = slug ? `/${slug}` : "/";
    return `<a${pre}href="${path}"${post}>`;
  });
}

export type ReconcileOptions = {
  userPrompt?: string;
  portfolioDefaults?: boolean;
  /** When true, always fill missing nav pages and ensure home exists. */
  forceExpand?: boolean;
};

/**
 * Ensure home exists, merge aliases, fill missing nav targets, normalize links.
 */
export function reconcileGeneratedPages(pages: SitePageMap, opts?: ReconcileOptions): SitePageMap {
  let out = mergeHomeAliases(pages);

  const validEntries = Object.entries(out).filter(([, html]) => html?.includes("</html>"));
  out = Object.fromEntries(validEntries);

  if (!out[""]) {
    const first = Object.values(out)[0];
    if (first) out[""] = first;
  }

  if (Object.keys(out).length === 0) {
    return { "": "" };
  }

  const expected = collectExpectedSlugs(out, opts?.userPrompt);

  if (opts?.portfolioDefaults) {
    for (const slug of ["", "about", "projects", "contact"]) {
      expected.add(slug);
    }
  }

  const shouldExpand =
    opts?.forceExpand !== false &&
    (Object.keys(out).length > 1 || expected.size > 1 || Boolean(opts?.userPrompt));

  if (!shouldExpand) return out;

  const siteType = opts?.userPrompt ? detectSiteType(opts.userPrompt) : "general";
  const template = out[""] ?? Object.values(out)[0] ?? "";

  for (const slug of expected) {
    const existing = out[slug];
    if (!existing?.includes("</html>")) {
      out[slug] = ensureRichPage(template, slug, siteType);
    } else if (slug !== "" && isThinPage(existing)) {
      out[slug] = ensureRichPage(template, slug, siteType);
    }
  }

  if (!out[""]?.includes("</html>") || isThinPage(out[""])) {
    out[""] = ensureRichPage(template, "", siteType);
  }

  const known = new Set(Object.keys(out));
  for (const slug of Object.keys(out)) {
    out[slug] = normalizeInternalLinks(out[slug], known);
  }

  return out;
}

export function isPortfolioStylePrompt(prompt: string): boolean {
  return detectSiteType(prompt) === "portfolio";
}
