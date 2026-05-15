import { NextResponse } from "next/server";
import {
  applyLemonOrderCreditsToSiteforgeUser,
  recordLemonSubscriptionPaidInvoice,
  reverseLemonOrderRefundCredits,
  syncLemonSubscriptionToSiteforgeUser,
  writePendingLemonCreditOrder,
} from "@/lib/auth/user-store";
import { logBillingWebhookEvent } from "@/lib/billing/webhook-log";
import {
  parseLemonOrderRefundPayload,
  parseLemonOrderWebhookForCredits,
  parseLemonSubscriptionInvoicePayload,
  parseLemonSubscriptionWebhookPayload,
} from "@/lib/lemonsqueezy/parse-order-created";
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
    await logBillingWebhookEvent(req, {
      eventName: "config",
      ok: false,
      detail: "webhook_secret_not_configured",
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
    await logBillingWebhookEvent(req, { eventName: "unknown", ok: false, detail: "bad_signature" });
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

  if (!eventName) {
    await logBillingWebhookEvent(req, { eventName: "unknown", ok: false, detail: "missing_event_name" });
    return jsonResponse({ ok: false, error: "Missing meta.event_name." }, 400);
  }

  try {
    if (eventName === "order_created") {
      const parsed = parseLemonOrderWebhookForCredits(bodyJson, eventName);
      if (parsed.outcome === "reject") {
        logSecurityEvent(req, "input_rejected", {
          route: "lemonsqueezy-webhook",
          reason: "bad_order_payload",
          detail: parsed.reason.slice(0, 120),
        });
        await logBillingWebhookEvent(req, {
          eventName,
          ok: false,
          detail: parsed.reason,
        });
        return jsonResponse({ ok: false, error: parsed.reason }, 400);
      }
      if (parsed.outcome === "skip") {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: true,
          detail: `skip:${parsed.reason}`,
          orderId: parsed.orderId,
          extra: { reasonDetail: parsed.detail },
        });
        return jsonResponse(
          {
            ok: true,
            ignored: true,
            reason: parsed.reason,
            orderId: parsed.orderId,
            detail: parsed.detail,
          },
          200
        );
      }

      const result = await applyLemonOrderCreditsToSiteforgeUser({
        orderId: parsed.orderId,
        email: parsed.email,
        variantId: parsed.variantId,
        creditsToAdd: parsed.credits,
        firebaseUid: parsed.firebaseUid,
        sourceEvent: eventName,
      });

      if (result.duplicate) {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: true,
          detail: "duplicate_order",
          orderId: result.orderId,
        });
        return jsonResponse({ ok: true, duplicate: true, orderId: result.orderId }, 200);
      }

      if ("skipped" in result && result.skipped) {
        await writePendingLemonCreditOrder({
          orderId: result.orderId,
          email: result.email,
          variantId: parsed.variantId,
          credits: parsed.credits,
          reason: result.reason,
        });
        await logBillingWebhookEvent(req, {
          eventName,
          ok: false,
          detail: `skipped:${result.reason}`,
          orderId: result.orderId,
        });
        return jsonResponse(
          {
            ok: true,
            skipped: true,
            orderId: result.orderId,
            email: result.email,
            reason: result.reason,
            pendingRecorded: true,
          },
          200
        );
      }

      await logBillingWebhookEvent(req, {
        eventName,
        ok: true,
        detail: "credits_granted",
        orderId: result.orderId,
        uid: result.uid,
        extra: { creditsAdded: result.creditsAdded, creditsAfter: result.creditsAfter },
      });
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
    }

    if (eventName === "order_refunded") {
      const parsed = parseLemonOrderRefundPayload(bodyJson);
      if (parsed.outcome === "reject") {
        await logBillingWebhookEvent(req, { eventName, ok: false, detail: parsed.reason });
        return jsonResponse({ ok: false, error: parsed.reason }, 400);
      }
      if (parsed.outcome === "skip") {
        await logBillingWebhookEvent(req, { eventName, ok: true, detail: parsed.reason });
        return jsonResponse({ ok: true, ignored: true }, 200);
      }
      const rev = await reverseLemonOrderRefundCredits(parsed.orderId);
      if (rev.ok && "duplicate" in rev && rev.duplicate) {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: true,
          detail: "refund_duplicate",
          orderId: parsed.orderId,
        });
        return jsonResponse({ ok: true, duplicate: true, orderId: parsed.orderId }, 200);
      }
      if (rev.ok && "skipped" in rev && rev.skipped) {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: true,
          detail: `refund_skipped:${rev.reason}`,
          orderId: rev.orderId,
        });
        return jsonResponse({ ok: true, skipped: true, orderId: rev.orderId, reason: rev.reason }, 200);
      }
      if (rev.ok && "reversed" in rev && rev.reversed) {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: true,
          detail: "credits_reversed",
          orderId: rev.orderId,
          uid: rev.uid,
          extra: { creditsRemoved: rev.creditsRemoved, creditsAfter: rev.creditsAfter },
        });
        return jsonResponse(
          {
            ok: true,
            reversed: true,
            orderId: rev.orderId,
            creditsRemoved: rev.creditsRemoved,
            creditsAfter: rev.creditsAfter,
            uid: rev.uid,
          },
          200
        );
      }
    }

    if (
      eventName === "subscription_created" ||
      eventName === "subscription_updated" ||
      eventName === "subscription_cancelled" ||
      eventName === "subscription_resumed" ||
      eventName === "subscription_expired" ||
      eventName === "subscription_paused" ||
      eventName === "subscription_unpaused"
    ) {
      const parsed = parseLemonSubscriptionWebhookPayload(bodyJson);
      if (parsed.outcome === "reject") {
        await logBillingWebhookEvent(req, { eventName, ok: false, detail: parsed.reason });
        return jsonResponse({ ok: false, error: parsed.reason }, 400);
      }
      const sync = await syncLemonSubscriptionToSiteforgeUser({
        subscriptionId: parsed.subscriptionId,
        email: parsed.email,
        firebaseUid: parsed.firebaseUid,
        status: parsed.status,
        variantId: parsed.variantId,
        productId: parsed.productId,
        renewsAt: parsed.renewsAt,
        endsAt: parsed.endsAt,
        cancelled: parsed.cancelled,
        customerPortalUrl: parsed.customerPortalUrl,
        updatePaymentMethodUrl: parsed.updatePaymentMethodUrl,
      });
      if (sync.skipped) {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: true,
          detail: `subscription_sync_skipped:${sync.reason}`,
          subscriptionId: parsed.subscriptionId,
        });
        return jsonResponse({ ok: true, skipped: true, reason: sync.reason }, 200);
      }
      await logBillingWebhookEvent(req, {
        eventName,
        ok: true,
        detail: "subscription_synced",
        subscriptionId: parsed.subscriptionId,
        uid: sync.uid,
      });
      return jsonResponse({ ok: true, uid: sync.uid, subscriptionId: parsed.subscriptionId }, 200);
    }

    if (
      eventName === "subscription_payment_success" ||
      eventName === "subscription_payment_recovered"
    ) {
      const parsed = parseLemonSubscriptionInvoicePayload(bodyJson);
      if (parsed.outcome === "reject") {
        await logBillingWebhookEvent(req, { eventName, ok: false, detail: parsed.reason });
        return jsonResponse({ ok: false, error: parsed.reason }, 400);
      }
      if (parsed.outcome === "skip") {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: true,
          detail: `invoice_skip:${parsed.reason}`,
          invoiceId: parsed.invoiceId,
        });
        return jsonResponse({ ok: true, ignored: true, reason: parsed.reason }, 200);
      }
      if (parsed.status !== "paid") {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: true,
          detail: `invoice_not_paid_status:${parsed.status}`,
          invoiceId: parsed.invoiceId,
        });
        return jsonResponse({ ok: true, ignored: true, reason: "invoice_not_paid", status: parsed.status }, 200);
      }
      const rec = await recordLemonSubscriptionPaidInvoice({
        invoiceId: parsed.invoiceId,
        subscriptionId: parsed.subscriptionId,
        email: parsed.email,
        firebaseUid: parsed.firebaseUid,
        billingReason: parsed.billingReason,
      });
      await logBillingWebhookEvent(req, {
        eventName,
        ok: true,
        detail: rec.duplicate ? "invoice_duplicate" : "invoice_recorded",
        invoiceId: parsed.invoiceId,
        subscriptionId: parsed.subscriptionId,
        uid: rec.uid,
      });
      return jsonResponse(
        { ok: true, invoiceId: parsed.invoiceId, duplicate: rec.duplicate, uid: rec.uid },
        200
      );
    }

    if (eventName === "subscription_payment_failed") {
      const parsed = parseLemonSubscriptionInvoicePayload(bodyJson);
      if (parsed.outcome === "reject") {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: false,
          detail: parsed.reason,
        });
        return jsonResponse({ ok: true, ignored: true }, 200);
      }
      if (parsed.outcome === "skip") {
        await logBillingWebhookEvent(req, {
          eventName,
          ok: true,
          detail: `invoice_skip:${parsed.reason}`,
          invoiceId: parsed.invoiceId,
        });
        return jsonResponse({ ok: true, ignored: true, reason: parsed.reason }, 200);
      }
      await logBillingWebhookEvent(req, {
        eventName,
        ok: true,
        detail: "payment_failed_logged",
        invoiceId: parsed.invoiceId,
        subscriptionId: parsed.subscriptionId,
      });
      return jsonResponse({ ok: true, ignored: true, event: eventName }, 200);
    }

    await logBillingWebhookEvent(req, { eventName, ok: true, detail: "ignored_unhandled_event" });
    return jsonResponse({ ok: true, ignored: true, event: eventName }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown";
    logSecurityEvent(req, "input_rejected", {
      route: "lemonsqueezy-webhook",
      reason: "firestore_failed",
      err: msg.slice(0, 120),
    });
    await logBillingWebhookEvent(req, {
      eventName,
      ok: false,
      detail: `exception:${msg.slice(0, 200)}`,
    });
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to process webhook.",
      },
      500
    );
  }
}
