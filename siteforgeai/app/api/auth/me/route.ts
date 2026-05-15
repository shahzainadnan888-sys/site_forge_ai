import { auth } from "@/auth";
import { authLogger } from "@/lib/auth/auth-logger";
import {
  requireCurrentServerUserFromSession,
  resolveCurrentServerUserFromSession,
} from "@/lib/auth/current-user";
import { updateServerUserProfile } from "@/lib/auth/user-store";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NextAuthAugmentedRequest = NextRequest & { auth: import("next-auth").Session | null };

function logMeRequest(req: NextRequest, label: string, session: import("next-auth").Session | null) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const hasSessionCookie =
    cookieHeader.includes("authjs.session-token") ||
    cookieHeader.includes("__Secure-authjs.session-token") ||
    cookieHeader.includes("next-auth.session-token") ||
    cookieHeader.includes("__Secure-next-auth.session-token");
  authLogger.debug(`/api/auth/me ${label}`, {
    hasCookieHeader: cookieHeader.length > 0,
    hasLikelySessionCookie: hasSessionCookie,
    sessionUserEmail: session?.user?.email ?? null,
    firestoreUid: session && "firestoreUid" in session ? (session as { firestoreUid?: string }).firestoreUid : null,
  });
}

export const GET = auth(async (req: NextRequest) => {
  const session = (req as NextAuthAugmentedRequest).auth;
  logMeRequest(req, "GET", session);

  try {
    const { user, syncError } = await resolveCurrentServerUserFromSession(session);
    if (!user) {
      authLogger.warn("/api/auth/me GET: no SiteForge user (session missing, uid missing, or Firestore error — see prior logs)");
      const debugAuth = process.env.AUTH_DEBUG === "1" || process.env.NODE_ENV === "development";
      const body: {
        ok: false;
        error: string;
        syncError?: string;
        firebaseProjectId?: string;
        fixHint?: string;
      } = { ok: false, error: "Unauthorized" };
      if (debugAuth && syncError === "firestore_permission_denied") {
        body.syncError = syncError;
        const pid = process.env.FIREBASE_PROJECT_ID?.trim();
        if (pid) body.firebaseProjectId = pid;
        body.fixHint =
          "In Google Cloud Console → IAM for this Firebase/GCP project, grant the service account in FIREBASE_CLIENT_EMAIL the role roles/datastore.user (Cloud Datastore User). Use a private key downloaded from the same project (Firebase console → Project settings → Service accounts).";
      }
      return NextResponse.json(body, { status: 401 });
    }
    enforceRateLimit(req, "auth-me-get", { limit: 120, windowMs: 60_000, userId: user.uid });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } }
      );
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
});

export const PATCH = auth(async (req: NextRequest) => {
  const session = (req as NextAuthAugmentedRequest).auth;
  logMeRequest(req, "PATCH", session);

  try {
    assertSameOrigin(req);
    const current = await requireCurrentServerUserFromSession(session);
    enforceRateLimit(req, "auth-me-patch", { limit: 30, windowMs: 60_000, userId: current.uid });
    const body = (await req.json()) as { fullName?: string; avatarDataUrl?: string | null };
    const fullName = body?.fullName?.trim();
    const avatarDataUrl = body?.avatarDataUrl;
    const hasName = typeof fullName === "string" && fullName.length > 0;
    const hasAvatar =
      avatarDataUrl === null || (typeof avatarDataUrl === "string" && avatarDataUrl.length > 0);
    if (!hasName && !hasAvatar) {
      return NextResponse.json(
        { ok: false, error: "Provide fullName or avatarDataUrl." },
        { status: 400 }
      );
    }
    const updated = await updateServerUserProfile(current.uid, {
      ...(hasName ? { fullName } : {}),
      ...(hasAvatar ? { avatarDataUrl } : {}),
    });
    return NextResponse.json({ ok: true, user: updated });
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
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Unable to update profile." }, { status: 500 });
  }
});
