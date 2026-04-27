import { NextResponse } from "next/server";
import { requireCurrentServerUser } from "@/lib/auth/current-user";
import { updateServerUserProfile } from "@/lib/auth/user-store";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireCurrentServerUser();
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
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const current = await requireCurrentServerUser();
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
}
