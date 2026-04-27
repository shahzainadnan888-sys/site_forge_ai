import { NextResponse } from "next/server";
import { requireCurrentServerUser } from "@/lib/auth/current-user";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/security-log";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

function isOpenAiTestRouteEnabled() {
  if (process.env.ALLOW_OPENAI_TEST_ROUTE === "1" || process.env.ALLOW_OPENAI_TEST_ROUTE === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

export async function GET(request: Request) {
  if (!isOpenAiTestRouteEnabled()) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  try {
    const user = await requireCurrentServerUser();
    enforceRateLimit(request, "openai-test-get", { limit: 30, windowMs: 60_000, userId: user.uid });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    message: "OpenAI test route is enabled. Send POST to run a real API call.",
  });
}

export async function POST(req: Request) {
  if (!isOpenAiTestRouteEnabled()) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  try {
    assertSameOrigin(req);
    const user = await requireCurrentServerUser();
    enforceRateLimit(req, "openai-test-post", { limit: 20, windowMs: 60_000, userId: user.uid });
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
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing OPENAI_API_KEY in server environment." },
      { status: 500 }
    );
  }

  try {
    const upstream = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a concise assistant used for API health checks.",
          },
          {
            role: "user",
            content: "Reply with exactly: OPENAI_ROUTE_OK",
          },
        ],
        temperature: 0,
        max_tokens: 12,
      }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return NextResponse.json(
        {
          ok: false,
          status: upstream.status,
          error: "OpenAI request failed.",
          details: errorText.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    const data = (await upstream.json()) as {
      id?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };

    return NextResponse.json({
      ok: true,
      model: data.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      reply: data.choices?.[0]?.message?.content?.trim() ?? "",
      usage: data.usage ?? null,
      requestId: data.id ?? null,
    });
  } catch (error) {
    logSecurityEvent(req, "input_rejected", { route: "openai-test" });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown OpenAI route error.",
      },
      { status: 500 }
    );
  }
}
