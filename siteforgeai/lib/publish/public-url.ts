/**
 * Public origin for this deployment (Vercel / custom domain), without trailing slash.
 */
export function getAppOriginFromRequest(request: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_ROOT_URL;
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      // ignore
    }
  }
  return new URL(request.url).origin;
}

/**
 * Default live URL: `https://<origin>/sites/<siteId>`.
 * Subdomain URL (when `*.root` is wired in DNS + middleware) for display.
 */
export function getPublishedSiteUrls(origin: string, siteId: string) {
  const pathUrl = `${origin}/sites/${encodeURIComponent(siteId)}`;
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "siteforgeai.com")
    .replace(/^https?:\/\//, "")
    .split("/")[0]!
    .replace(/^www\./, "");
  const subdomainUrl = `https://${encodeURIComponent(siteId)}.${root}`;
  return { pathUrl, subdomainUrl, root };
}
