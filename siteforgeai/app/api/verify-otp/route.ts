import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/security-log";

const OTP_COLLECTION = "otp";
const VERIFIED_EMAILS_COLLECTION = "verifiedEmails";

type Body = {
  email?: string;
  otp?: string;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeOtp(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 6) : "";
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "verify-otp", { limit: 10, windowMs: 60_000 });

    const body = (await req.json()) as Body;
    const email = normalizeEmail(body?.email);
    const otp = normalizeOtp(body?.otp);

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP are required." }, { status: 400 });
    }

    const docRef = adminDb.collection(OTP_COLLECTION).doc(email);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Invalid or expired OTP." }, { status: 400 });
    }

    const data = doc.data() as { otp?: string; expiresAt?: { toMillis?: () => number } } | undefined;
    const savedOtp = typeof data?.otp === "string" ? data.otp : "";
    const expiresAtMs = typeof data?.expiresAt?.toMillis === "function" ? data.expiresAt.toMillis() : 0;

    if (!savedOtp || otp !== savedOtp) {
      return NextResponse.json({ error: "Invalid OTP." }, { status: 400 });
    }
    if (!expiresAtMs || Date.now() > expiresAtMs) {
      await docRef.delete();
      return NextResponse.json({ error: "OTP has expired." }, { status: 400 });
    }

    await adminDb.collection(VERIFIED_EMAILS_COLLECTION).doc(email).set({
      email,
      verifiedAt: new Date(),
    });
    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CsrfError) {
      logSecurityEvent(req, "csrf_failed", { route: "verify-otp" });
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof RateLimitError) {
      logSecurityEvent(req, "rate_limit", { route: "verify-otp" });
      return NextResponse.json(
        { error: "Too many attempts. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } }
      );
    }
    console.error("[verify-otp] unexpected error", error);
    return NextResponse.json({ error: "Failed to verify OTP." }, { status: 500 });
  }
}
