import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/security-log";

const RESEND_API_URL = "https://api.resend.com/emails";
const OTP_COLLECTION = "otp";
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_FROM = "BuildWithSiteforge <support@buildwithsiteforge.com>";

type Body = { email?: string };

const basicEmailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "send-otp", { limit: 5, windowMs: 60_000 });

    const body = (await req.json()) as Body;
    const email = normalizeEmail(body?.email);
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    if (!basicEmailOk(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "OTP service is not configured." }, { status: 503 });
    }

    const otp = generateOtp();
    const expiresAtMs = Date.now() + OTP_TTL_MS;
    await adminDb.collection(OTP_COLLECTION).doc(email).set({
      email,
      otp,
      expiresAt: Timestamp.fromMillis(expiresAtMs),
      createdAt: Timestamp.now(),
    });

    const resendRes = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: OTP_FROM,
        to: [email],
        subject: "Your OTP Code",
        text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
      }),
    });

    if (!resendRes.ok) {
      const payload = (await resendRes.json().catch(() => null)) as unknown;
      console.error("[send-otp] Resend error", resendRes.status, payload);
      return NextResponse.json({ error: "Failed to send OTP. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CsrfError) {
      logSecurityEvent(req, "csrf_failed", { route: "send-otp" });
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof RateLimitError) {
      logSecurityEvent(req, "rate_limit", { route: "send-otp" });
      return NextResponse.json(
        { error: "Too many OTP requests. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } }
      );
    }
    console.error("[send-otp] unexpected error", error);
    return NextResponse.json({ error: "Failed to send OTP. Please try again." }, { status: 500 });
  }
}
