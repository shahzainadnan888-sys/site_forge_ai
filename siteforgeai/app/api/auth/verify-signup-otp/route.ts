import { verifySignupOtpAndMarkVerified } from "@/lib/auth/oauth-flow-firestore";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "verify-signup-otp", { limit: 40, windowMs: 60_000 });
    const body = (await req.json()) as { email?: string; otp?: string };
    const email = (body.email || "").trim().toLowerCase();
    const otp = (body.otp || "").replace(/\D/g, "").slice(0, 6);
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email." }, { status: 400 });
    }
    if (!OTP_REGEX.test(otp)) {
      return NextResponse.json({ ok: false, error: "Enter the 6-digit code." }, { status: 400 });
    }
    const result = await verifySignupOtpAndMarkVerified(email, otp);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || "Verification failed." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    }
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } }
      );
    }
    return NextResponse.json({ ok: false, error: "Unable to verify code." }, { status: 500 });
  }
}
