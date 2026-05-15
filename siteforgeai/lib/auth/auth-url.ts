const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Loopback origins without a port resolve to port 80 in the browser (ERR_CONNECTION_REFUSED in dev).
 * Next.js dev defaults to 3000 unless PORT is set.
 */
export function normalizeAuthBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    if (LOOPBACK_HOSTS.has(u.hostname) && !u.port) {
      const port = process.env.PORT?.trim() || "3000";
      return `${u.protocol}//${u.hostname}:${port}`;
    }
    return u.origin;
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

/** Rewrite AUTH_URL / NEXTAUTH_URL in process.env when they omit the dev port on localhost. */
export function fixAuthUrlEnvVars(): void {
  for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
    const val = process.env[key]?.trim();
    if (!val) continue;
    const normalized = normalizeAuthBaseUrl(val);
    if (!normalized) continue;
    const prior = val.replace(/\/$/, "");
    if (normalized !== prior) {
      process.env[key] = normalized;
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[auth] ${key} was "${val}"; normalized to "${normalized}" (use the same origin in the browser and in Google OAuth redirect URIs).`
        );
      }
    }
  }
}

/**
 * Public site URL used by Auth.js (OAuth redirect validation). Same source as middleware cookie mode.
 */
export function getAuthPublicBaseUrl(): string {
  return normalizeAuthBaseUrl(
    process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || ""
  );
}

function requestOrigin(request: Request): string | undefined {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  if (!host) return undefined;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  let proto = forwardedProto;
  if (!proto) {
    try {
      proto = new URL(request.url).protocol.replace(":", "");
    } catch {
      proto = "http";
    }
  }
  return normalizeAuthBaseUrl(`${proto}://${host}`);
}

/**
 * Align AUTH_URL with the browser origin on each `/api/auth/*` request.
 * Fixes Google OAuth sending users to `http://localhost` (port 80) when `.env` omits the dev port.
 */
export function syncAuthUrlFromRequest(request: Request): string | undefined {
  const origin = requestOrigin(request);
  if (!origin) return undefined;

  const configured = getAuthPublicBaseUrl();
  const isDev = process.env.NODE_ENV !== "production";
  const configuredBroken =
    Boolean(configured) &&
    (() => {
      try {
        const u = new URL(configured);
        return LOOPBACK_HOSTS.has(u.hostname) && !u.port;
      } catch {
        return false;
      }
    })();

  if (isDev || !configured || configuredBroken) {
    process.env.AUTH_URL = origin;
    process.env.NEXTAUTH_URL = origin;
    return origin;
  }

  return configured;
}

/** Use secure session cookie names when the app is served over HTTPS (or AUTH_URL is https). */
export function isAuthSecureCookieFromRequest(request: { nextUrl: URL; headers: Headers }): boolean {
  const base = getAuthPublicBaseUrl();
  if (base.startsWith("https://")) return true;
  if (base.startsWith("http://")) return false;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return request.nextUrl.protocol === "https:" || proto === "https";
}
