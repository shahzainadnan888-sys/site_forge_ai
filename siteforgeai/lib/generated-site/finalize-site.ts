import { enforceSinglePageAnchors } from "@/lib/sanitize-generated-html";
import { detectSiteType } from "@/lib/generated-site/detect-site-type";
import { enhanceVisualAssets } from "@/lib/generated-site/enhance-html";
import { preparePreviewHtml } from "@/lib/generated-site/sanitize-preview-html";
import { reconcileGeneratedPages } from "@/lib/generated-site/reconcile-pages";
import { primaryHtmlFromPages } from "@/lib/generated-site/split-pages";
import type { GeneratedSiteResult, SitePageMap } from "@/lib/generated-site/types";

export function finalizeGeneratedSite(
  pages: SitePageMap,
  singlePage: boolean,
  opts?: { userPrompt?: string }
): GeneratedSiteResult {
  let source = pages;
  const siteType = opts?.userPrompt ? detectSiteType(opts.userPrompt) : "general";

  if (!singlePage) {
    source = reconcileGeneratedPages(pages, {
      userPrompt: opts?.userPrompt,
      portfolioDefaults: siteType === "portfolio",
      forceExpand: true,
    });
  }

  const out: SitePageMap = {};
  const multi = !singlePage && Object.keys(source).length > 1;

  for (const [slug, html] of Object.entries(source)) {
    if (!html?.includes("</html>")) continue;
    let processed = enhanceVisualAssets(html, siteType);
    processed = multi
      ? preparePreviewHtml(processed, { multiPage: true, pageSlug: slug })
      : enforceSinglePageAnchors(processed);
    out[slug] = processed;
  }

  if (Object.keys(out).length === 0) {
    const fallback = enforceSinglePageAnchors(primaryHtmlFromPages(source));
    return { appType: "single", html: fallback, pages: { "": fallback } };
  }

  return {
    appType: multi ? "multi" : "single",
    html: primaryHtmlFromPages(out),
    pages: out,
  };
}
