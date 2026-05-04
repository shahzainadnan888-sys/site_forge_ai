import { NextResponse } from "next/server";
import { applyLemonOrderCreditsToSiteforgeUser } from "@/lib/auth/user-store";
import { parseOrderCreatedPayload } from "@/lib/lemonsqueezy/parse-order-created";
import { verifyLemonSqueezySignature } from "@/lib/lemonsqueezy/webhook-verify";
import { logSecurityEvent } from "@/lib/security/security-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512 * 1024;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logSecurityEvent(req, "input_rejected", {
      route: "lemonsqueezy-webhook",
      reason: "webhook_secret_not_configured",
    });
    return jsonResponse(
      { ok: false, error: "Webhook signing secret is not configured on the server." },
      503
    );
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Payload too large." }, 413);
  }

  const rawBuffer = Buffer.from(await req.arrayBuffer());
  if (rawBuffer.length > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Payload too large." }, 413);
  }

  const headerSig = req.headers.get("x-signature") ?? req.headers.get("X-Signature") ?? "";
  if (!verifyLemonSqueezySignature(rawBuffer, headerSig, secret)) {
    logSecurityEvent(req, "input_rejected", {
      route: "lemonsqueezy-webhook",
      reason: "bad_signature",
    });
    return jsonResponse({ ok: false, error: "Invalid signature." }, 401);
  }

  let bodyJson: unknown;
  try {
    bodyJson = JSON.parse(rawBuffer.toString("utf8")) as unknown;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON payload." }, 400);
  }

  const eventName =
    typeof bodyJson === "object" &&
    bodyJson !== null &&
    "meta" in bodyJson &&
    typeof (bodyJson as { meta?: { event_name?: string } }).meta?.event_name === "string"
      ? (bodyJson as { meta: { event_name: string } }).meta.event_name.trim()
      : "";

  if (eventName !== "order_created") {
    return jsonResponse({ ok: true, ignored: true, event: eventName || "unknown" }, 200);
  }

  const parsed = parseOrderCreatedPayload(bodyJson);
  if (!parsed.ok) {
    logSecurityEvent(req, "input_rejected", {
      route: "lemonsqueezy-webhook",
      reason: "bad_order_payload",
      detail: parsed.reason.slice(0, 120),
    });
    return jsonResponse({ ok: false, error: parsed.reason }, 400);
  }

  try {
    const result = await applyLemonOrderCreditsToSiteforgeUser({
      orderId: parsed.orderId,
      email: parsed.email,
      variantId: parsed.variantId,
      creditsToAdd: parsed.credits,
      firebaseUid: parsed.firebaseUid,
    });

    if (result.duplicate) {
      return jsonResponse({ ok: true, duplicate: true, orderId: result.orderId }, 200);
    }

    if ("skipped" in result && result.skipped) {
      return jsonResponse(
        {
          ok: true,
          skipped: true,
          orderId: result.orderId,
          email: result.email,
          reason: result.reason,
        },
        200
      );
    }

    return jsonResponse(
      {
        ok: true,
        orderId: result.orderId,
        email: result.email,
        variantId: result.variantId,
        creditsAdded: result.creditsAdded,
        newUser: result.newUser,
        creditsAfter: result.creditsAfter,
        uid: result.uid,
      },
      200
    );
  } catch (error) {
    logSecurityEvent(req, "input_rejected", {
      route: "lemonsqueezy-webhook",
      reason: "firestore_failed",
      err: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to apply credits.",
      },
      500
    );
  }
}
