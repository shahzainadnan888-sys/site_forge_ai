import { NextResponse } from "next/server";
import { requireCurrentServerUser } from "@/lib/auth/current-user";
import { updateServerUserProfile } from "@/lib/auth/user-store";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type UploadBody = { avatarDataUrl?: string };

function parseJpegDataUrl(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Invalid avatar format. Expected JPEG data URL.");
  return Buffer.from(match[1], "base64");
}

const MAX_INLINE_AVATAR_DATA_URL_CHARS = 900_000;

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireCurrentServerUser();
    enforceRateLimit(req, "auth-avatar-post", { limit: 20, windowMs: 60_000, userId: user.uid });

    const body = (await req.json()) as UploadBody;
    const avatarDataUrl = body?.avatarDataUrl?.trim();
    if (!avatarDataUrl) {
      return NextResponse.json({ ok: false, error: "avatarDataUrl is required." }, { status: 400 });
    }

    const imageBytes = parseJpegDataUrl(avatarDataUrl);
    const maxBytes = 1_200_000; // ~1.2 MB post-processed
    if (imageBytes.length > maxBytes) {
      return NextResponse.json({ ok: false, error: "Avatar is too large after processing." }, { status: 400 });
    }

    if (avatarDataUrl.length > MAX_INLINE_AVATAR_DATA_URL_CHARS) {
      return NextResponse.json(
        { ok: false, error: "Avatar is too large." },
        { status: 400 }
      );
    }
    const updated = await updateServerUserProfile(user.uid, { avatarDataUrl });
    return NextResponse.json({ ok: true, user: updated, avatarUrl: avatarDataUrl, storage: "inline" as const });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "Too many upload requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } }
      );
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const msg = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireCurrentServerUser();
    enforceRateLimit(req, "auth-avatar-delete", { limit: 20, windowMs: 60_000, userId: user.uid });

    const updated = await updateServerUserProfile(user.uid, { avatarDataUrl: null });
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
    const msg = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
