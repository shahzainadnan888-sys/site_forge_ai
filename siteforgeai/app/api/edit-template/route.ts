import { NextResponse } from "next/server";
import { requireCurrentServerUser } from "@/lib/auth/current-user";
import { refundServerCredits, spendServerCredits } from "@/lib/auth/user-store";
import { EDIT_APPLY_CREDIT_COST } from "@/lib/credit-economy";
import { assertEditBodyLimits } from "@/lib/security/request-limits";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import {
  enforceRateLimit,
  enforceRateLimitByIp,
  RateLimitError,
} from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/security-log";
import { verifyTurnstileIfConfigured } from "@/lib/security/turnstile";
import { enforceSinglePageAnchors } from "@/lib/sanitize-generated-html";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

type Body = {
  html?: string;
  instruction?: string;
  turnstileToken?: string;
};

function normalizeHtml(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const lower = text.toLowerCase();

  const doctypeStart = lower.indexOf("<!doctype html>");
  const htmlStart = lower.indexOf("<html");
  const htmlEnd = lower.lastIndexOf("</html>");

  if (doctypeStart >= 0) {
    text = text.slice(doctypeStart).trim();
  } else if (htmlStart >= 0) {
    text = `<!DOCTYPE html>\n${text.slice(htmlStart).trim()}`;
  } else {
    text = `<!DOCTYPE html>\n<html>\n<body>\n${text}\n</body>\n</html>`;
  }

  const normalizedLower = text.toLowerCase();
  const normalizedHtmlEnd = normalizedLower.lastIndexOf("</html>");
  if (normalizedHtmlEnd >= 0) {
    text = text.slice(0, normalizedHtmlEnd + "</html>".length).trim();
  } else {
    text = `${text}\n</html>`;
  }

  if (!text.toLowerCase().startsWith("<!doctype html>")) {
    text = `<!DOCTYPE html>\n${text.replace(/^<!doctype html>\s*/i, "").trim()}`;
  }

  return text;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY in server environment." }, { status: 500 });
  }

  try {
    assertSameOrigin(req);
    const user = await requireCurrentServerUser();
    enforceRateLimit(req, "edit-template", { limit: 20, windowMs: 60_000, userId: user.uid });
    enforceRateLimitByIp(req, "edit-template-ip", { limit: 40, windowMs: 60_000 });
    const body = (await req.json()) as Body;
    const t = await verifyTurnstileIfConfigured(body?.turnstileToken);
    if (!t.ok) {
      logSecurityEvent(req, "turnstile_failed", { route: "edit-template" });
      return NextResponse.json({ ok: false, error: t.error }, { status: 403 });
    }
    const html = body?.html?.trim();
    const instruction = body?.instruction?.trim();

    if (!html || !instruction) {
      return NextResponse.json({ ok: false, error: "html and instruction are required." }, { status: 400 });
    }
    const lim = assertEditBodyLimits(html, instruction);
    if (!lim.ok) {
      logSecurityEvent(req, "input_rejected", { route: "edit-template" });
      return NextResponse.json({ ok: false, error: lim.error }, { status: 400 });
    }

    let chargedUser: Awaited<ReturnType<typeof spendServerCredits>>;
    try {
      chargedUser = await spendServerCredits(user.uid, EDIT_APPLY_CREDIT_COST);
    } catch (e) {
      if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") {
        return NextResponse.json({ ok: false, error: "Insufficient credits." }, { status: 402 });
      }
      throw e;
    }

    try {
      const upstream = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          temperature: 0.4,
          max_tokens: 7000,
          messages: [
            {
              role: "system",
              content:
                "You are an expert website editor. You will receive an existing full HTML document and an instruction. Apply only the exact changes explicitly requested by the user. Do not add extra enhancements, redesigns, rewrites, content changes, copy updates, spacing changes, color changes, or structural changes unless the user explicitly asks for them. Keep everything else unchanged. Return the UPDATED full HTML only. Do not explain anything. Keep it single-page. In-site navigation must use only #anchor hrefs (no https:// to personal, portfolio, or real domains for main nav, footer, or in-page section links; mailto: and tel: are fine when appropriate). Must start with <!DOCTYPE html> and end with </html>.",
            },
            {
              role: "user",
              content: `Instruction:\n${instruction}\n\nCurrent HTML:\n${html}`,
            },
          ],
        }),
        cache: "no-store",
      });

      if (!upstream.ok) {
        const details = await upstream.text();
        await refundServerCredits(user.uid, EDIT_APPLY_CREDIT_COST);
        return NextResponse.json(
          { ok: false, error: "OpenAI edit request failed.", details: details.slice(0, 1000) },
          { status: upstream.status }
        );
      }

      const data = (await upstream.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const updated = normalizeHtml(data.choices?.[0]?.message?.content ?? "");
      if (!updated.startsWith("<!DOCTYPE html>") || !updated.endsWith("</html>")) {
        await refundServerCredits(user.uid, EDIT_APPLY_CREDIT_COST);
        return NextResponse.json({ ok: false, error: "Edited HTML response was invalid." }, { status: 502 });
      }

      return NextResponse.json({
        ok: true,
        html: enforceSinglePageAnchors(updated),
        remainingCredits: chargedUser.credits,
      });
    } catch (innerError) {
      try {
        await refundServerCredits(user.uid, EDIT_APPLY_CREDIT_COST);
      } catch {
        // ignore refund failures
      }
      throw innerError;
    }
  } catch (error) {
    if (error instanceof CsrfError) {
      logSecurityEvent(req, "csrf_failed", { route: "edit-template" });
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    if (error instanceof RateLimitError) {
      logSecurityEvent(req, "rate_limit", { route: "edit-template" });
      return NextResponse.json(
        { ok: false, error: "Too many edit requests. Please wait and retry." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } }
      );
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ ok: false, error: "Insufficient credits." }, { status: 402 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Edit failed." },
      { status: 500 }
    );
  }
}
