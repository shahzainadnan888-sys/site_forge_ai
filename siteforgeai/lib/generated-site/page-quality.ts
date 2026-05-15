/** Detect pages with insufficient real content (stubs or model cutoffs). */
export function isThinPage(html: string): boolean {
  if (!html?.includes("</html>")) return true;
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html;
  const text = main.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const imgCount = (main.match(/<img\b/gi) || []).length;
  const sectionCount = (main.match(/<section\b/gi) || []).length;
  if (text.length < 280) return true;
  if (text.length < 500 && imgCount === 0 && sectionCount < 2) return true;
  if (/refine in the editor|content will appear here|premium .* content —/i.test(text)) return true;
  return false;
}
