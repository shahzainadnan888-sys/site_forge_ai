/** Prefix for grep-friendly server logs. */
const P = "[siteforge-auth]";

type AuthLogLevel = "debug" | "warn" | "error";

function enabled(level: AuthLogLevel): boolean {
  if (level === "error" || level === "warn") return true;
  return process.env.NODE_ENV !== "production" || process.env.AUTH_DEBUG === "1";
}

function metaForConsole(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta, (_k, v) => {
      if (v instanceof Error) {
        return { name: v.name, message: v.message, stack: v.stack };
      }
      return v;
    });
  } catch {
    return String(meta);
  }
}

export const authLogger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (!enabled("debug")) return;
    if (meta && Object.keys(meta).length) console.debug(P, message, metaForConsole(meta));
    else console.debug(P, message);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (meta && Object.keys(meta).length) console.warn(P, message, metaForConsole(meta));
    else console.warn(P, message);
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (meta && Object.keys(meta).length) console.error(P, message, metaForConsole(meta));
    else console.error(P, message);
  },
  /** JWT / Firestore resolution failures (often surface as Auth.js `error=Configuration`). Uses warn to avoid Next.js dev overlay noise; OAuth still completes with provider subject fallback. */
  jwtFailure(err: unknown, context: Record<string, unknown>) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.warn(P, "JWT callback Firestore step failed (OAuth continues with Google subject as uid)", {
      ...context,
      name: e.name,
      message: e.message,
      stack: process.env.NODE_ENV === "development" ? e.stack : undefined,
    });
  },
};
