import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/security-log";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_CONTACT_TO = "support@buildwithsiteforge.com";
const CONTACT_SUBJECT = "New Contact Form Message - BuildWithSiteForge";
const MAX_MESSAGE_LEN = 10_000;
const MAX_NAME_LEN = 200;
const MAX_EMAIL_LEN = 320;

function trimStr(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

const basicEmailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "contact", { limit: 5, windowMs: 60_000 });
  } catch (e) {
    if (e instanceof CsrfError) {
      logSecurityEvent(req, "csrf_failed", { route: "contact" });
      return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    }
    if (e instanceof RateLimitError) {
      logSecurityEvent(req, "rate_limit", { route: "contact" });
      return NextResponse.json(
        { ok: false, error: "Too many messages. Please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } }
      );
    }
    throw e;
  }

  let body: { name?: string; email?: string; message?: string };
  try {
    body = (await req.json()) as { name?: string; email?: string; message?: string };
  } catch {
    logSecurityEvent(req, "input_rejected", { route: "contact" });
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const name = trimStr(body.name, MAX_NAME_LEN);
  const email = trimStr(body.email, MAX_EMAIL_LEN);
  const message = trimStr(body.message, MAX_MESSAGE_LEN);

  if (!name || !email || !message) {
    return NextResponse.json({ ok: false, error: "Please fill in all fields." }, { status: 400 });
  }

  if (!basicEmailOk(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  const to = DEFAULT_CONTACT_TO;

  if (!apiKey || !from) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Contact delivery is not configured yet. Please email us at " + DEFAULT_CONTACT_TO + " directly.",
      },
      { status: 503 }
    );
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: CONTACT_SUBJECT,
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    }),
  });

  const payload = (await res.json()) as { message?: string; name?: string };

  if (!res.ok) {
    console.error("[contact] Resend error", res.status, payload);
    return NextResponse.json(
      {
        ok: false,
        error: "Could not send your message. Please try again or email " + DEFAULT_CONTACT_TO + ".",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message: "Email sent successfully." });
}
