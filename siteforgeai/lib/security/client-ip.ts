/**
 * Client IP for rate limiting, free-credit IP checks, and security logs.
 * Order: Cloudflare (CF-Connecting-IP), then first X-Forwarded-For hop (Vercel / common hosts),
 * then X-Real-IP. Set only by your edge — never pass through raw client XFF in production
 * without a trusted front proxy.
 */
export function getTrustedClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
