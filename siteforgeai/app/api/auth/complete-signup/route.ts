import { adminAuth } from "@/lib/firebase/admin";
import { deleteSignupVerified, isSignupEmailVerified } from "@/lib/auth/oauth-flow-firestore";
import { findUserByEmailInFirestore, getOrCreateServerUser } from "@/lib/auth/user-store";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "complete-signup", { limit: 15, windowMs: 60 * 60 * 1000 });
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
    };
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const fullName = (body.fullName || "").trim();
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Password must be at least 6 characters." }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ ok: false, error: "Full name is required." }, { status: 400 });
    }
    const verified = await isSignupEmailVerified(email);
    if (!verified) {
      return NextResponse.json(
        { ok: false, error: "Email is not verified. Enter the code from your email first." },
        { status: 400 }
      );
    }
    const existing = await findUserByEmailInFirestore(email);
    if (existing) {
      return NextResponse.json({ ok: false, error: "An account with this email already exists." }, { status: 409 });
    }
    let uid: string;
    try {
      const record = await adminAuth.createUser({
        email,
        password,
        displayName: fullName,
        emailVerified: true,
      });
      uid = record.uid;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("email-already-exists")) {
        return NextResponse.json(
          { ok: false, error: "This email is already registered. Try signing in instead." },
          { status: 409 }
        );
      }
      throw e;
    }
    await getOrCreateServerUser(
      {
        uid,
        email,
        name: fullName,
        email_verified: true,
      },
      { grantSignupCredits: true }
    );
    await deleteSignupVerified(email);
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
    return NextResponse.json({ ok: false, error: "Unable to create your account." }, { status: 500 });
  }
}
