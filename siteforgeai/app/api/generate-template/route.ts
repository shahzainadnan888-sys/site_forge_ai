import { NextResponse } from "next/server";
import { requireVerifiedServerUser } from "@/lib/auth/current-user";
import { refundServerCredits, spendServerCredits } from "@/lib/auth/user-store";
import { isMultiPageWebsiteRequest, MULTI_PAGE_NOT_ALLOWED } from "@/lib/generate-prompt-guards";
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
import { enforceSinglePageAnchors } from "@/lib/sanitize-generated-html";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT_SINGLE =
  "You are a world-class frontend developer and designer. This tool outputs exactly ONE self-contained HTML file (a single-page application with in-page sections and #anchors only). You MUST NOT design or reference multiple top-level pages, multiple HTML files, or app routing. Generate a COMPLETE, production-ready SINGLE-PAGE website. CRITICAL — NAV (SPA only): - Give each main content section a matching id: id=\"home\" (or hero), id=\"features\", id=\"about\", id=\"pricing\", id=\"contact\" (add id=\"projects\" or id=\"services\" if used). - In the <nav> bar, use ONLY in-page hash links, e.g. <a href=\"#features\"> not href=\"/features\" and not a full site URL. - Do NOT use any real personal website, portfolio, or brand domain in href (no https:// to the user's or anyone's real site for in-app navigation; use only #section anchors and mailto: or tel: where a real address is actually needed). - NEVER use a <base> tag. - NEVER use target=\"_parent\" or target=\"_top\" on in-site links. STRICT RULES: - Output ONLY HTML code - No explanations - No markdown - No section labels like 'Hero Section' - Use SINGLE PAGE anchors only (href like #home, #features, #pricing) - NEVER use route links like /about, /pricing, /contact - NEVER generate admin/editor UI (no top control bars, no 'Theme/Colors/Fonts/Preview/Publish' panels, no builder controls) THEME AND DEFAULTS: - If the user does not specify colors or a theme, use a clean, professional default: restrained palette (e.g. deep neutral background or soft off-white) with one accent color, strong contrast, and NO muddy low-contrast text. - If the user describes a style in their prompt, match it while keeping readability first. - If the user gives a detailed prompt, prioritize that detail and produce the highest-quality, context-aware output possible while preserving clean structure. TYPOGRAPHY AND READABILITY: - All body text and headings must be clearly visible: use font-weight 500-700 for important text, semibold or bold for headings, sufficient line-height (1.4-1.6), and contrast ratios that pass WCAG-style readability (no light gray on light backgrounds). - Establish clear visual hierarchy: large bold hero headline, subheadings, generous whitespace, aligned grids. LAYOUT: - Everything must be properly arranged, aligned, and balanced; use a consistent max-width content container, consistent section padding, and a clean column/grid system. - Use Flexbox/Grid; avoid clutter. TECH REQUIREMENTS: - Full HTML5 structure - CSS inside <style> - Use modern design principles - Use gradients, shadows, and spacing thoughtfully (not only heavy gradients) - Use Flexbox/Grid DESIGN: - If no theme is given, make it look like a premium, minimal SaaS or portfolio site: attractive, professional, and calm. - If a theme is given, follow it. - Add smooth animations (hover, transitions, subtle motion) - Buttons with clear hover/focus states SECTIONS TO ALWAYS INCLUDE: - Navbar - Hero (strong bold headline + CTA) - Features (cards with icons) - About or How it works - Pricing (3 cards) - Footer OUTPUT FORMAT: - Must start with <!DOCTYPE html> - Must end with </html> - Must be directly usable in browser FAIL IF: - Output is plain text - Output is not styled - Text is too faint, too small, or hard to read - Output has no animations";

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

function ndjsonLine(payload: unknown) {
  return `${JSON.stringify(payload)}\n`;
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
    if (isMultiPageWebsiteRequest(prompt)) {
      return NextResponse.json({ ok: false, error: MULTI_PAGE_NOT_ALLOWED }, { status: 400 });
    }
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
        max_tokens: 6000,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_SINGLE },
          referenceImageDataUrl
            ? {
                role: "user",
                content: [
                  { type: "text", text: `${prompt}\n\nUse the attached image as a strong design reference.` },
                  { type: "image_url", image_url: { url: referenceImageDataUrl } },
                ],
              }
            : { role: "user", content: prompt },
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
        if (!/^<!doctype html>/i.test(normalized) || !/<\/html>\s*$/i.test(normalized) || !looksLikeCompleteWebsite(normalized)) {
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

        await writer.write(encoder.encode(ndjsonLine({ type: "progress", progress: 100 })));
        await writer.write(
          encoder.encode(
            ndjsonLine({
              type: "result",
              ok: true,
              appType: "single",
              html: enforceSinglePageAnchors(normalized),
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
