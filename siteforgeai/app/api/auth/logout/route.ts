import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FIREBASE_SESSION_COOKIE } from "@/lib/auth/server-session";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "auth-logout", { limit: 40, windowMs: 60_000 });
    const store = await cookies();
    store.delete(FIREBASE_SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } }
      );
    }
    return NextResponse.json({ ok: false, error: "Logout failed." }, { status: 500 });
  }
}
