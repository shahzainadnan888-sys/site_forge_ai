/**
 * SiteForge only generates a single HTML document (single-page / SPA-style with anchors),
 * not multi-route Next.js apps or multiple HTML files.
 */
export const MULTI_PAGE_NOT_ALLOWED =
  "Can't generate multi-page application due to some technical issues.";

export function isMultiPageWebsiteRequest(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;

  // User explicitly only wants a single page — do not block.
  if (/\b(only|just)\s+a\s+single[-\s]?page\b/i.test(t)) return false;
  if (/\bsingle[-\s]?page\s+(only|website|app|application|site)\b/i.test(t)) return false;
  if (/\bone[-\s]page\s+(only|website|app|application|site)\b/i.test(t)) return false;

  const patterns: RegExp[] = [
    /\bmulti[-\s]?page/i,
    /\bmultipage\b/i,
    /\bmulti[-\s]page[-\s]?(app|application|site|website)\b/i,
    /\bmultiple\s+pages?\b/i,
    /\bseveral\s+pages?\b/i,
    /\bmany\s+pages?\b/i,
    /\bmore\s+than\s+one\s+page/i,
    /\bseparate\s+pages?\b/i,
    /\bdistinct\s+pages?\b/i,
    /\b(additional|second|third|extra|another|new)\s+pages?\b/i,
    /\bhtml\s+files?\b/i,
    /\bseparate\s+html/i,
    /\bper[-\s]page\s+(file|url|route|link)/i,
    /\bnavigate\s+between\s+pages/i,
    /\bmultiple\s+routes?\b/i,
  ];

  return patterns.some((re) => re.test(t));
}
