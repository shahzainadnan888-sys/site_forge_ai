import {
  generateSixDigitOtp,
  hashSignupOtp,
  saveSignupOtpRequest,
} from "@/lib/auth/oauth-flow-firestore";
import { sendSignupOtpEmail } from "@/lib/auth/signup-otp-mail";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, enforceRateLimitByIp, RateLimitError } from "@/lib/security/rate-limit";
import { findUserByEmailInFirestore } from "@/lib/auth/user-store";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "send-signup-otp", { limit: 8, windowMs: 60 * 60 * 1000 });
    enforceRateLimitByIp(req, "send-signup-otp", { limit: 24, windowMs: 60 * 60 * 1000 });
    const body = (await req.json()) as {
      email?: string;
      fullName?: string;
      password?: string;
      confirmPassword?: string;
    };
    const fullName = (body.fullName || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const confirmPassword = body.confirmPassword || "";
    if (!fullName) {
      return NextResponse.json({ ok: false, error: "Full name is required." }, { status: 400 });
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Password must be at least 6 characters." }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ ok: false, error: "Passwords do not match." }, { status: 400 });
    }
    const existing = await findUserByEmailInFirestore(email);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }
    if (!process.env.RESEND_API_KEY?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Email verification is not configured (RESEND_API_KEY)." },
        { status: 503 }
      );
    }
    const code = generateSixDigitOtp();
    const codeHash = hashSignupOtp(email, code);
    await saveSignupOtpRequest(email, fullName, codeHash);
    await sendSignupOtpEmail(email, code);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    }
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } }
      );
    }
    const msg = e instanceof Error ? e.message : "Unable to send verification email.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
