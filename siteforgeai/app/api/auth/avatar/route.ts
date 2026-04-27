import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { requireCurrentServerUser } from "@/lib/auth/current-user";
import { updateServerUserProfile } from "@/lib/auth/user-store";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type UploadBody = {
  avatarDataUrl?: string;
};

function buildBucketCandidates() {
  const direct = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const publicBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();

  const candidates = new Set<string>();
  if (direct) candidates.add(direct);
  if (publicBucket) candidates.add(publicBucket);
  if (projectId) {
    candidates.add(`${projectId}.firebasestorage.app`);
    candidates.add(`${projectId}.appspot.com`);
  }

  const out = [...candidates].filter(Boolean);
  if (out.length === 0) {
    throw new Error(
      "Missing Firebase Storage bucket configuration. Add FIREBASE_STORAGE_BUCKET (or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)."
    );
  }
  return out;
}

function parseJpegDataUrl(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Invalid avatar format. Expected JPEG data URL.");
  return Buffer.from(match[1], "base64");
}

function buildDownloadUrl(bucket: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;
}

/** Firestore string field must stay under ~1 MiB; leave headroom for other user fields. */
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

    let bucketCandidates: string[] = [];
    try {
      bucketCandidates = buildBucketCandidates();
    } catch {
      // No bucket env — skip Storage and use Firestore inline avatar below.
    }
    const objectPath = `profile-avatars/${user.uid}/avatar.jpg`;
    const token = randomUUID();
    let bucketNameUsed = "";
    let uploadError: unknown = null;
    for (const candidate of bucketCandidates) {
      try {
        const bucket = getStorage().bucket(candidate);
        const file = bucket.file(objectPath);
        await file.save(imageBytes, {
          resumable: false,
          metadata: {
            contentType: "image/jpeg",
            cacheControl: "public,max-age=3600",
            metadata: {
              firebaseStorageDownloadTokens: token,
            },
          },
        });
        bucketNameUsed = candidate;
        uploadError = null;
        break;
      } catch (error) {
        uploadError = error;
      }
    }
    if (!bucketNameUsed) {
      if (avatarDataUrl.length > MAX_INLINE_AVATAR_DATA_URL_CHARS) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Avatar is too large to save without Firebase Storage. Enable Storage in Firebase Console, or use a smaller image.",
          },
          { status: 400 }
        );
      }
      const updated = await updateServerUserProfile(user.uid, { avatarDataUrl });
      return NextResponse.json({
        ok: true,
        user: updated,
        avatarUrl: avatarDataUrl,
        storage: "inline" as const,
      });
    }

    const avatarUrl = buildDownloadUrl(bucketNameUsed, objectPath, token);
    const updated = await updateServerUserProfile(user.uid, { avatarDataUrl: avatarUrl });
    return NextResponse.json({ ok: true, user: updated, avatarUrl, storage: "firebase" as const });
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

    let bucketCandidates: string[] = [];
    try {
      bucketCandidates = buildBucketCandidates();
    } catch {
      // Storage not configured — still clear avatar in Firestore.
    }
    const objectPath = `profile-avatars/${user.uid}/avatar.jpg`;
    for (const candidate of bucketCandidates) {
      try {
        const bucket = getStorage().bucket(candidate);
        const file = bucket.file(objectPath);
        await file.delete({ ignoreNotFound: true });
      } catch {
        // Storage may be disabled; still clear profile in Firestore below.
      }
    }

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
