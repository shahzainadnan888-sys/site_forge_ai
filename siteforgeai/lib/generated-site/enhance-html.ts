import type { SiteType } from "@/lib/generated-site/detect-site-type";
import { rewriteImagesForSiteType } from "@/lib/generated-site/image-catalog";

const PREMIUM_BASE_CSS = `
<style id="sf-premium-base">
@media (prefers-reduced-motion: no-preference) {
  @keyframes sf-fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
  article, .card, [class*="card"] { animation: sf-fadeUp .55s ease both; }
}
article, .card {
  transition: transform .25s ease, box-shadow .25s ease;
}
article:hover, .card:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
}
button, .btn, [type="submit"] {
  transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
}
button:hover, .btn:hover, [type="submit"]:hover {
  filter: brightness(1.06);
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.25);
}
@media (prefers-reduced-motion: reduce) {
  article, .card { animation: none; transition: none; }
}
</style>`.trim();

/** Add card animations and category-appropriate images. */
export function enhanceVisualAssets(html: string, siteType: SiteType): string {
  let out = html;

  if (!/<meta[^>]+viewport/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="viewport" content="width=device-width, initial-scale=1">`);
  }

  if (!/id=["']sf-premium-base["']/.test(out)) {
    out = out.replace(/<\/head>/i, `${PREMIUM_BASE_CSS}\n</head>`);
  }

  out = rewriteImagesForSiteType(out, siteType);

  return out;
}
