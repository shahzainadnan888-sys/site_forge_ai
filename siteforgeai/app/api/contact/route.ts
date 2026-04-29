import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/security-log";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_CONTACT_TO = "support@buildwithsiteforge.com";
const CONTACT_SUBJECT = "New Contact Form Message";
const CONTACT_FROM = "BuildWithSiteforge <support@buildwithsiteforge.com>";
const MAX_MESSAGE_LEN = 10_000;
const MAX_NAME_LEN = 200;
const MAX_EMAIL_LEN = 320;

function trimStr(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

const basicEmailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildContactEmailHtml(name: string, email: string, message: string): string {
  const n = escapeHtml(name);
  const e = escapeHtml(email);
  const mailtoHref = `mailto:${encodeURIComponent(email)}`;
  const m = escapeHtml(message).replace(/\r\n|\r|\n/g, "<br />");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7fb;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:20px 24px;background:linear-gradient(90deg,#6366f1,#06b6d4);color:#fff;font-weight:600;font-size:18px;">
          New contact form message
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;">Name</p>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">${n}</p>
          <p style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;">Email</p>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;"><a href="${mailtoHref}" style="color:#2563eb;text-decoration:none;">${e}</a></p>
          <p style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;">Message</p>
          <div style="margin:0;font-size:15px;line-height:1.6;color:#374151;border-left:3px solid #6366f1;padding-left:14px;">${m}</div>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Sent via SiteForge contact form · Reply goes to the sender.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendResendEmail(params: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: CONTACT_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
    }),
  });

  const payload = (await res.json()) as { message?: string; name?: string };
  return { res, payload };
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    enforceRateLimit(req, "contact", { limit: 5, windowMs: 60_000 });
  } catch (e) {
    if (e instanceof CsrfError) {
      logSecurityEvent(req, "csrf_failed", { route: "contact" });
      return NextResponse.json({ success: false, error: e.message }, { status: 403 });
    }
    if (e instanceof RateLimitError) {
      logSecurityEvent(req, "rate_limit", { route: "contact" });
      return NextResponse.json(
        {
          success: false,
          error: "Too many messages. Please wait a moment and try again.",
        },
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
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const name = trimStr(body.name, MAX_NAME_LEN);
  const email = trimStr(body.email, MAX_EMAIL_LEN);
  const message = trimStr(body.message, MAX_MESSAGE_LEN);

  if (!name || !email || !message) {
    return NextResponse.json({ success: false, error: "All fields are required." }, { status: 400 });
  }

  if (!basicEmailOk(email)) {
    return NextResponse.json({ success: false, error: "Please enter a valid email address." }, { status: 400 });
  }

  /** Required on the server (e.g. Vercel env). Without it Resend cannot send mail — add RESEND_API_KEY in hosting env or .env.local locally. */
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = DEFAULT_CONTACT_TO;

  if (!apiKey) {
    console.error("[contact] Missing RESEND_API_KEY — contact form cannot send until this env var is set.");
    return NextResponse.json({ error: "Failed to send message" }, { status: 503 });
  }

  const plainText = `Name: ${name}\nEmail: ${email}\nMessage: ${message}`;
  const htmlBody = buildContactEmailHtml(name, email, message);

  const supportEmail = await sendResendEmail({
    apiKey,
    to,
    subject: CONTACT_SUBJECT,
    replyTo: email,
    html: htmlBody,
    text: plainText,
  });

  if (!supportEmail.res.ok) {
    console.error("[contact] Resend support email error", supportEmail.res.status, supportEmail.payload);
    return NextResponse.json({ error: "Failed to send message" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
