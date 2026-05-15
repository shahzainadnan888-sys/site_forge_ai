import { NextResponse } from "next/server";
import { requireVerifiedServerUser } from "@/lib/auth/current-user";
import { refundServerCredits, spendServerCredits } from "@/lib/auth/user-store";
import { buildGenerationUserMessage } from "@/lib/generated-site/build-user-message";
import { wantsSinglePageOnly } from "@/lib/generate-prompt-guards";
import { finalizeGeneratedSite } from "@/lib/generated-site/finalize-site";
import { PAGE_DELIMITER_RE, SYSTEM_PROMPT_MULTI, SYSTEM_PROMPT_SINGLE } from "@/lib/generated-site/prompts";
import { splitGeneratedPages } from "@/lib/generated-site/split-pages";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { assertPromptLength } from "@/lib/security/request-limits";
import {
  enforceRateLimit,
  enforceRateLimitByIp,
  RateLimitError,
} from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/security-log";
import { verifyTurnstileIfConfigured } from "@/lib/security/turnstile";
import { GENERATION_CREDIT_COST } from "@/lib/credit-economy";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const API_SAFETY_REPAIR_NOTE =
  "Your previous draft violated API safety requirements. Regenerate from scratch with no external APIs and no unknown endpoints. For portfolio/landing pages, keep it fully static. If a contact form is included, use only fetch('/api/contact').";

function normalizeModelHtml(raw: string): string {
  let text = (raw || "").trim();
  if (!text) return "";
  text = text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const lower = text.toLowerCase();
  const doctypeIdx = lower.indexOf("<!doctype html>");
  const htmlIdx = lower.indexOf("<html");
  if (doctypeIdx >= 0) {
    text = text.slice(doctypeIdx).trim();
  } else if (htmlIdx >= 0) {
    text = `<!DOCTYPE html>\n${text.slice(htmlIdx).trim()}`;
  } else if (lower.includes("<body") || lower.includes("<head")) {
    text = `<!DOCTYPE html>\n<html>\n${text}\n</html>`;
  } else {
    text = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head><body>\n${text}\n</body></html>`;
  }
  const endIdx = text.toLowerCase().lastIndexOf("</html>");
  if (endIdx >= 0) text = text.slice(0, endIdx + "</html>".length).trim();
  else text = `${text}\n</html>`;
  if (!/^<!doctype html>/i.test(text)) text = `<!DOCTYPE html>\n${text.replace(/^<!doctype html>\s*/i, "").trim()}`;
  return text.trim();
}

/** Heuristic: accept simple portfolios that use divs instead of many <section> tags. */
function looksLikeCompleteWebsite(html: string): boolean {
  if (!html || html.length < 900) return false;
  const lower = html.toLowerCase();
  if (!lower.includes("<body")) return false;
  const hasCss = lower.includes("<style") || lower.includes("stylesheet");
  if (!hasCss) return false;
  const sections = (lower.match(/<section\b/g) || []).length;
  const articles = (lower.match(/<article\b/g) || []).length;
  const mains = (lower.match(/<main\b/g) || []).length;
  const semanticBlocks = sections + articles + mains;
  const hasFooterTag = lower.includes("<footer");
  const footerLike =
    hasFooterTag || /\b(id|class)\s*=\s*["'][^"']*footer[^"']*["']/i.test(html);
  const hasNav = lower.includes("<nav") || lower.includes("<header");
  if (semanticBlocks >= 2 && footerLike) return true;
  if (semanticBlocks >= 1 && hasNav && footerLike && html.length >= 1600) return true;
  if (sections >= 1 && footerLike && html.length >= 2000) return true;
  if (html.length >= 2800 && lower.includes("<head") && hasNav) return true;
  return false;
}

function looksLikeValidGenerationOutput(html: string, singlePage: boolean): boolean {
  if (!html || !/^<!doctype html>/i.test(html)) return false;
  if (singlePage) {
    return looksLikeCompleteWebsite(html);
  }
  const hasMarkers = PAGE_DELIMITER_RE.test(html);
  PAGE_DELIMITER_RE.lastIndex = 0;
  if (hasMarkers) {
    const pages = splitGeneratedPages(html);
    const complete = Object.values(pages).filter((p) => p.includes("</html>") && looksLikeCompleteWebsite(p));
    return complete.length >= 2;
  }
  return looksLikeCompleteWebsite(html);
}

function hasForbiddenNetworkCalls(html: string): boolean {
  if (!html) return false;
  const forbiddenPatterns = [
    /fetch\s*\(\s*["']https?:\/\//i,
    /axios\s*\(\s*["']https?:\/\//i,
    /axios\.(get|post|put|patch|delete)\s*\(\s*["']https?:\/\//i,
    /new\s+XMLHttpRequest\s*\(/i,
    /\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["']https?:\/\//i,
  ];
  return forbiddenPatterns.some((pattern) => pattern.test(html));
}

function hasInvalidApiRouteUsage(html: string): boolean {
  if (!html) return false;
  const allowedApiRoutes = new Set(["/api/contact"]);
  const quotedApiPaths = html.match(/["']\/api\/[^"']+["']/gi) ?? [];
  for (const raw of quotedApiPaths) {
    const route = raw.slice(1, -1).split("?")[0].split("#")[0].toLowerCase();
    if (!allowedApiRoutes.has(route)) {
      return true;
    }
  }
  return false;
}

function ndjsonLine(payload: unknown) {
  return `${JSON.stringify(payload)}\n`;
}

function extractMessageText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("")
    .trim();
}

async function requestApiSafeRepairHtml(args: {
  apiKey: string;
  prompt: string;
  referenceImageDataUrl: string;
}): Promise<string> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT_SINGLE },
    args.referenceImageDataUrl
      ? {
          role: "user",
          content: [
            {
              type: "text",
              text: `${args.prompt}\n\nUse the attached image as a strong design reference.\n\n${API_SAFETY_REPAIR_NOTE}`,
            },
            { type: "image_url", image_url: { url: args.referenceImageDataUrl } },
          ],
        }
      : { role: "user", content: `${args.prompt}\n\n${API_SAFETY_REPAIR_NOTE}` },
  ];

  const repairRes = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      temperature: 0.65,
      max_tokens: 6000,
      stream: false,
      messages,
    }),
    cache: "no-store",
  });
  if (!repairRes.ok) {
    const details = await repairRes.text().catch(() => "");
    throw new Error(`Repair generation failed: ${details.slice(0, 500)}`);
  }
  const payload = (await repairRes.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = extractMessageText(payload?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("Repair generation returned empty content.");
  }
  return content;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY in server environment." }, { status: 500 });
  }

  try {
    assertSameOrigin(req);
    const currentUser = await requireVerifiedServerUser();
    enforceRateLimit(req, "generate-template", { limit: 12, windowMs: 60_000, userId: currentUser.uid });
    enforceRateLimitByIp(req, "generate-template-ip", { limit: 24, windowMs: 60_000 });
    const body = (await req.json()) as { prompt?: string; turnstileToken?: string; referenceImageDataUrl?: string };
    const turnstile = await verifyTurnstileIfConfigured(body?.turnstileToken);
    if (!turnstile.ok) {
      logSecurityEvent(req, "turnstile_failed", { route: "generate-template" });
      return NextResponse.json({ ok: false, error: turnstile.error }, { status: 403 });
    }
    const prompt = body?.prompt?.trim();
    const referenceImageDataUrl = typeof body?.referenceImageDataUrl === "string" ? body.referenceImageDataUrl.trim() : "";

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "Prompt is required." }, { status: 400 });
    }
    if (referenceImageDataUrl && !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(referenceImageDataUrl)) {
      return NextResponse.json({ ok: false, error: "Reference image must be a valid image data URL." }, { status: 400 });
    }
    const plen = assertPromptLength(prompt);
    if (!plen.ok) {
      logSecurityEvent(req, "input_rejected", { reason: "prompt_length" });
      return NextResponse.json({ ok: false, error: plen.error }, { status: 400 });
    }
    const singlePage = wantsSinglePageOnly(prompt);
    const systemPrompt = singlePage ? SYSTEM_PROMPT_SINGLE : SYSTEM_PROMPT_MULTI;
    const userMessage = buildGenerationUserMessage(prompt);
    const chargedUser = await spendServerCredits(currentUser.uid, GENERATION_CREDIT_COST);
    const upstream = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        temperature: 0.7,
        max_tokens: singlePage ? 8000 : 16384,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          referenceImageDataUrl
            ? {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `${userMessage}\n\nUse the attached image as a strong design reference.`,
                  },
                  { type: "image_url", image_url: { url: referenceImageDataUrl } },
                ],
              }
            : { role: "user", content: userMessage },
        ],
      }),
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      const errorText = await upstream.text();
      await refundServerCredits(currentUser.uid, GENERATION_CREDIT_COST);
      return NextResponse.json(
        { ok: false, error: "OpenAI request failed.", details: errorText.slice(0, 1000) },
        { status: upstream.status }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const transform = new TransformStream<Uint8Array, Uint8Array>();
    const writer = transform.writable.getWriter();
    const reader = upstream.body.getReader();

    void (async () => {
      let buffer = "";
      let output = "";
      let lastProgress = 3;
      let receivedChars = 0;
      let chunkCount = 0;
      const startedAt = Date.now();
      let lastEmitAt = 0;

      try {
        await writer.write(encoder.encode(ndjsonLine({ type: "progress", progress: lastProgress })));
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const lineRaw of lines) {
            const line = lineRaw.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const part = parsed.choices?.[0]?.delta?.content ?? "";
              if (!part) continue;
              output += part;
              receivedChars += part.length;
              chunkCount += 1;
              const elapsedMs = Date.now() - startedAt;
              // Time-based progress keeps loader moving gradually with generation duration.
              const timeProgress = Math.min(90, 4 + Math.floor(elapsedMs / 220));
              // Output-based progress prevents time from getting ahead of real model output.
              const outputProgress = Math.min(
                96,
                6 + Math.floor(Math.log1p(receivedChars) * 6) + Math.floor(chunkCount * 0.9)
              );
              const targetProgress = Math.min(timeProgress, outputProgress);
              const nextProgress = Math.min(targetProgress, lastProgress + 2);
              const now = Date.now();

              if (nextProgress > lastProgress && now - lastEmitAt >= 160) {
                lastProgress = nextProgress;
                lastEmitAt = now;
                await writer.write(encoder.encode(ndjsonLine({ type: "progress", progress: nextProgress })));
              }
            } catch {
              // Ignore transient parse issues from partial stream fragments.
            }
          }
        }

        const normalized = normalizeModelHtml(output);
        if (!/<\/html>\s*$/i.test(normalized) || !looksLikeValidGenerationOutput(normalized, singlePage)) {
          await refundServerCredits(currentUser.uid, GENERATION_CREDIT_COST);
          await writer.write(
            encoder.encode(
              ndjsonLine({
                type: "error",
                error: "Model did not return valid full HTML output.",
              })
            )
          );
          return;
        }
        let finalOutput = normalized;
        if (hasForbiddenNetworkCalls(finalOutput) || hasInvalidApiRouteUsage(finalOutput)) {
          await writer.write(encoder.encode(ndjsonLine({ type: "progress", progress: 98 })));
          const repairedRaw = await requestApiSafeRepairHtml({
            apiKey,
            prompt,
            referenceImageDataUrl,
          });
          finalOutput = normalizeModelHtml(repairedRaw);
          if (
            !/^<!doctype html>/i.test(finalOutput) ||
            !/<\/html>\s*$/i.test(finalOutput) ||
            !looksLikeValidGenerationOutput(finalOutput, singlePage) ||
            hasForbiddenNetworkCalls(finalOutput) ||
            hasInvalidApiRouteUsage(finalOutput)
          ) {
            await refundServerCredits(currentUser.uid, GENERATION_CREDIT_COST);
            await writer.write(
              encoder.encode(
                ndjsonLine({
                  type: "error",
                  error: "Generation could not produce a valid API-safe website. Please retry.",
                })
              )
            );
            return;
          }
        }

        const rawPages = splitGeneratedPages(finalOutput);
        const site = finalizeGeneratedSite(rawPages, singlePage, { userPrompt: prompt });

        await writer.write(encoder.encode(ndjsonLine({ type: "progress", progress: 100 })));
        await writer.write(
          encoder.encode(
            ndjsonLine({
              type: "result",
              ok: true,
              appType: site.appType,
              html: site.html,
              pages: site.pages,
              remainingCredits: chargedUser.credits,
            })
          )
        );
      } catch (error) {
        await refundServerCredits(currentUser.uid, GENERATION_CREDIT_COST).catch(() => undefined);
        await writer.write(
          encoder.encode(
            ndjsonLine({
              type: "error",
              error: error instanceof Error ? error.message : "Generation failed.",
            })
          )
        );
      } finally {
        await writer.close();
        reader.releaseLock();
      }
    })();

    return new Response(transform.readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof CsrfError) {
      logSecurityEvent(req, "csrf_failed", { route: "generate-template" });
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }
    if (error instanceof RateLimitError) {
      logSecurityEvent(req, "rate_limit", { route: "generate-template" });
      return NextResponse.json(
        { ok: false, error: "Too many generation requests. Please wait and retry." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSec) } }
      );
    }
    if (error instanceof Error && error.message === "UNVERIFIED_EMAIL") {
      return NextResponse.json({ ok: false, error: "Verify email first" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ ok: false, error: "Insufficient credits." }, { status: 402 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Generation failed." },
      { status: 500 }
    );
  }
}
