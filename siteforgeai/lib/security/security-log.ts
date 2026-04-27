import { getTrustedClientIp } from "@/lib/security/client-ip";

type SecurityEventType =
  | "rate_limit"
  | "unauthorized"
  | "csrf_failed"
  | "auth_session_failed"
  | "credits_rejected"
  | "input_rejected"
  | "turnstile_failed";

let seq = 0;

function nowIso() {
  return new Date().toISOString();
}

/**
 * Minimal structured security logging (console). For production, forward to
 * Datadog / Cloud Logging / Sentry from your infra, or use `process.env.SECURITY_LOG_JSON`.
 */
export function logSecurityEvent(
  req: Request,
  type: SecurityEventType,
  detail: Record<string, string | number | boolean | undefined> = {}
) {
  const ip = getTrustedClientIp(req);
  const id = ++seq;
  const path = new URL(req.url).pathname;
  const line = {
    at: nowIso(),
    type: "siteforge.security",
    event: type,
    id,
    path,
    ip,
    userAgent: req.headers.get("user-agent")?.slice(0, 200) || "",
    ...detail,
  };
  if (process.env.SECURITY_LOG_JSON === "1") {
    console.log(JSON.stringify(line));
  } else {
    console.warn("[security]", type, path, "ip=" + ip, JSON.stringify(line));
  }
}
