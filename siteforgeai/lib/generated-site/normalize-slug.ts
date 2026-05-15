/** Normalize URL segment or path to a site page slug ("" = home). */
export function normalizePageSlug(raw: string | undefined | null): string {
  let s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  if (s === "home" || s === "index" || s === "index.html") return "";
  s = s.replace(/\.html?$/i, "");
  s = s.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return s;
}

export function slugFromPathSegments(segments: string[] | undefined): string {
  if (!segments?.length) return "";
  return normalizePageSlug(segments.join("/"));
}
