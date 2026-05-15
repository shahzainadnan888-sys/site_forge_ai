/**
 * Public site URL used by Auth.js (OAuth redirect validation). Same source as middleware cookie mode.
 */
export function getAuthPublicBaseUrl(): string {
  return (process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "").replace(/\/$/, "");
}

/** Use secure session cookie names when the app is served over HTTPS (or AUTH_URL is https). */
export function isAuthSecureCookieFromRequest(request: { nextUrl: URL; headers: Headers }): boolean {
  const base = getAuthPublicBaseUrl();
  if (base.startsWith("https://")) return true;
  if (base.startsWith("http://")) return false;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return request.nextUrl.protocol === "https:" || proto === "https";
}
