/**
 * Single-page vs multi-page generation mode from user prompt.
 * Multi-page is the default; only explicit "single page only" requests stay SPA/hash mode.
 */

export function wantsSinglePageOnly(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/\b(only|just)\s+a\s+single[-\s]?page\b/i.test(t)) return true;
  if (/\bsingle[-\s]?page\s+(only|website|app|application|site)\b/i.test(t)) return true;
  if (/\bone[-\s]page\s+(only|website|app|application|site)\b/i.test(t)) return true;
  if (/\b(one|1)\s+page\s+(only|website|site)\b/i.test(t)) return true;
  if (/\bno\s+separate\s+pages?\b/i.test(t)) return true;
  if (/\blanding\s+page\s+only\b/i.test(t)) return true;
  return false;
}
