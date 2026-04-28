import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { getSessionCookieOptions } from "@/lib/auth/server-session";
import { getOrCreateServerUser } from "@/lib/auth/user-store";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, enforceRateLimitByIp, RateLimitError } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/security-log";

export const runtime = "nodejs";

type Body = {
  idToken?: string;
  deviceContext?: {
    timezone?: string;
    screen?: string;
    platform?: string;
    userAgent?: string;
  };
};

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "auth-session", { limit: 20, windowMs: 60_000 });
    enforceRateLimitByIp(req, "auth-session-ip", { limit: 40, windowMs: 300_000 });
    const body = (await req.json()) as Body;
    const idToken = body?.idToken?.trim();
    if (!idToken) {
      return NextResponse.json({ ok: false, error: "Missing idToken." }, { status: 400 });
    }

    const adminAuth = getFirebaseAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    if (decoded.email_verified !== true) {
      return NextResponse.json(
        { ok: false, error: "Please verify your email before logging in.", code: "EMAIL_NOT_VERIFIED" },
        { status: 403 }
      );
    }

    const { name, maxAgeMs, cookie } = getSessionCookieOptions();
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: maxAgeMs });

    await getOrCreateServerUser(decoded, {
      request: req,
      deviceContext: body?.deviceContext,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(name, sessionCookie, cookie);
    return response;
  } catch (error) {
    if (error instanceof CsrfError) {
      logSecurityEvent(req, "csrf_failed", { route: "auth-session" });
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    if (error instanceof RateLimitError) {
      logSecurityEvent(req, "rate_limit", { route: "auth-session" });
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } }
      );
    }
    logSecurityEvent(req, "auth_session_failed", {
      err: error instanceof Error ? error.name : "unknown",
    });
    const message = error instanceof Error ? error.message : "Unable to create session.";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
