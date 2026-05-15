import { isLemonCreditPack } from "@/lib/lemon-squeezy-credit-packs";
import { creditsForLemonVariantId } from "@/lib/lemonsqueezy/variant-credits";

export type LemonOrderCreatedPayload = {
  meta?: { event_name?: string; custom_data?: Record<string, unknown> | null };
  data?: {
    id?: string | number;
    type?: string;
    attributes?: {
      user_email?: string;
      status?: string;
      test_mode?: boolean;
      custom_data?: Record<string, unknown> | null;
      first_order_item?: {
        variant_id?: string | number;
        variant_name?: string;
      };
    };
  };
};

export type ParsedOrderCreated =
  | { ok: true; orderId: string; email: string; variantId: string; credits: number; firebaseUid?: string }
  | { ok: false; reason: string };

/** Lemon documents `meta.custom_data` for checkout `custom` fields (prefer over attributes). */
export function extractFirebaseUidFromOrderPayload(b: LemonOrderCreatedPayload): string | undefined {
  const blocks: unknown[] = [b.meta?.custom_data, b.data?.attributes?.custom_data];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const u = (block as { uid?: unknown }).uid;
    if (typeof u === "string" && u.trim()) return u.trim();
  }
  return undefined;
}

function normalizeOrderStatus(data: LemonOrderCreatedPayload["data"] | undefined): string {
  const s = data?.attributes?.status;
  return typeof s === "string" ? s.trim().toLowerCase() : "";
}

function creditsFromVariantName(variantName: unknown): number | null {
  if (typeof variantName !== "string") return null;
  const m = variantName.trim().match(/^(\d+)\s*credits?$/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return isLemonCreditPack(n) ? n : null;
}

export type LemonOrderCreditParse =
  | {
      outcome: "grant";
      orderId: string;
      email: string;
      variantId: string;
      credits: number;
      firebaseUid?: string;
      orderStatus: string;
      testMode: boolean;
    }
  | { outcome: "skip"; reason: string; orderId?: string; detail?: string }
  | { outcome: "reject"; reason: string };

/**
 * Parses a Lemon `order_created` (or other order-shaped) webhook for **credit packs**.
 * Only `status === "paid"` orders grant credits (Lemon does not emit `order_paid`).
 */
export function parseLemonOrderWebhookForCredits(body: unknown, _eventName: string): LemonOrderCreditParse {
  void _eventName;
  if (!body || typeof body !== "object") {
    return { outcome: "reject", reason: "invalid_body" };
  }
  const b = body as LemonOrderCreatedPayload;
  if (b.data?.type && b.data.type !== "orders") {
    return { outcome: "reject", reason: "unexpected_data_type" };
  }

  const orderId = b.data?.id != null ? String(b.data.id).trim() : "";
  if (!orderId) {
    return { outcome: "reject", reason: "missing_order_id" };
  }

  const attrs = b.data?.attributes;
  const email = typeof attrs?.user_email === "string" ? attrs.user_email.trim().toLowerCase() : "";
  if (!email) {
    return { outcome: "reject", reason: "missing_user_email" };
  }

  const orderStatus = normalizeOrderStatus(b.data);
  if (!orderStatus) {
    return { outcome: "skip", reason: "missing_order_status", orderId };
  }
  if (orderStatus !== "paid") {
    return {
      outcome: "skip",
      reason: "order_not_paid",
      orderId,
      detail: orderStatus,
    };
  }

  const rawVariantId = attrs?.first_order_item?.variant_id;
  const variantId = rawVariantId != null ? String(rawVariantId).trim() : "";
  let credits = variantId ? creditsForLemonVariantId(variantId) : null;
  if (credits === null && attrs?.first_order_item?.variant_name !== undefined) {
    credits = creditsFromVariantName(attrs.first_order_item.variant_name);
  }
  if (credits === null || !variantId) {
    if (!variantId) {
      return { outcome: "reject", reason: "missing_variant_id" };
    }
    return {
      outcome: "skip",
      reason: "unknown_credit_variant",
      orderId,
      detail: variantId,
    };
  }

  const firebaseUid = extractFirebaseUidFromOrderPayload(b);
  const testMode = attrs?.test_mode === true;
  return {
    outcome: "grant",
    orderId,
    email,
    variantId,
    credits,
    ...(firebaseUid ? { firebaseUid } : {}),
    orderStatus: orderStatus || "paid",
    testMode,
  };
}

/** @deprecated Prefer {@link parseLemonOrderWebhookForCredits}. */
export function parseOrderCreatedPayload(body: unknown): ParsedOrderCreated {
  const r = parseLemonOrderWebhookForCredits(body, "order_created");
  if (r.outcome === "reject") return { ok: false, reason: r.reason };
  if (r.outcome === "skip") return { ok: false, reason: r.reason + (r.detail ? `:${r.detail}` : "") };
  return {
    ok: true,
    orderId: r.orderId,
    email: r.email,
    variantId: r.variantId,
    credits: r.credits,
    ...(r.firebaseUid ? { firebaseUid: r.firebaseUid } : {}),
  };
}

export type LemonOrderRefundParse =
  | { outcome: "refund"; orderId: string; testMode: boolean }
  | { outcome: "skip"; reason: string; orderId?: string }
  | { outcome: "reject"; reason: string };

/** Parses `order_refunded` payloads (same Order object shape). */
export function parseLemonOrderRefundPayload(body: unknown): LemonOrderRefundParse {
  if (!body || typeof body !== "object") {
    return { outcome: "reject", reason: "invalid_body" };
  }
  const b = body as LemonOrderCreatedPayload;
  if (b.data?.type && b.data.type !== "orders") {
    return { outcome: "reject", reason: "unexpected_data_type" };
  }
  const orderId = b.data?.id != null ? String(b.data.id).trim() : "";
  if (!orderId) return { outcome: "reject", reason: "missing_order_id" };
  const testMode = b.data?.attributes?.test_mode === true;
  return { outcome: "refund", orderId, testMode };
}

export type LemonSubscriptionWebhookPayload = {
  meta?: { custom_data?: Record<string, unknown> | null };
  data?: {
    id?: string | number;
    type?: string;
    attributes?: {
      user_email?: string;
      status?: string;
      variant_id?: string | number;
      product_id?: string | number;
      renews_at?: string | null;
      ends_at?: string | null;
      cancelled?: boolean;
      test_mode?: boolean;
      urls?: { customer_portal?: string | null; update_payment_method?: string | null } | null;
    };
  };
};

export type LemonSubscriptionParse =
  | {
      outcome: "sync";
      subscriptionId: string;
      email: string;
      status: string;
      variantId: string;
      productId?: string;
      renewsAt?: string | null;
      endsAt?: string | null;
      cancelled: boolean;
      customerPortalUrl?: string | null;
      updatePaymentMethodUrl?: string | null;
      firebaseUid?: string;
      testMode: boolean;
    }
  | { outcome: "reject"; reason: string };

function extractFirebaseUidFromSubscriptionPayload(b: LemonSubscriptionWebhookPayload): string | undefined {
  const block = b.meta?.custom_data;
  if (!block || typeof block !== "object") return undefined;
  const u = (block as { uid?: unknown }).uid;
  return typeof u === "string" && u.trim() ? u.trim() : undefined;
}

export function parseLemonSubscriptionWebhookPayload(body: unknown): LemonSubscriptionParse {
  if (!body || typeof body !== "object") {
    return { outcome: "reject", reason: "invalid_body" };
  }
  const b = body as LemonSubscriptionWebhookPayload;
  if (b.data?.type && b.data.type !== "subscriptions") {
    return { outcome: "reject", reason: "unexpected_data_type" };
  }
  const subscriptionId = b.data?.id != null ? String(b.data.id).trim() : "";
  if (!subscriptionId) return { outcome: "reject", reason: "missing_subscription_id" };
  const attrs = b.data?.attributes;
  const email = typeof attrs?.user_email === "string" ? attrs.user_email.trim().toLowerCase() : "";
  if (!email) return { outcome: "reject", reason: "missing_user_email" };
  const status = typeof attrs?.status === "string" ? attrs.status.trim() : "";
  if (!status) return { outcome: "reject", reason: "missing_subscription_status" };
  const rawVid = attrs?.variant_id;
  const variantId = rawVid != null ? String(rawVid).trim() : "";
  if (!variantId) return { outcome: "reject", reason: "missing_variant_id" };
  const rawPid = attrs?.product_id;
  const productId = rawPid != null ? String(rawPid).trim() : undefined;
  const firebaseUid = extractFirebaseUidFromSubscriptionPayload(b);
  const urls = attrs?.urls;
  return {
    outcome: "sync",
    subscriptionId,
    email,
    status,
    variantId,
    ...(productId ? { productId } : {}),
    renewsAt: attrs?.renews_at ?? null,
    endsAt: attrs?.ends_at ?? null,
    cancelled: attrs?.cancelled === true,
    customerPortalUrl: typeof urls?.customer_portal === "string" ? urls.customer_portal : null,
    updatePaymentMethodUrl: typeof urls?.update_payment_method === "string" ? urls.update_payment_method : null,
    ...(firebaseUid ? { firebaseUid } : {}),
    testMode: attrs?.test_mode === true,
  };
}

export type LemonSubscriptionInvoicePayload = {
  meta?: { custom_data?: Record<string, unknown> | null };
  data?: {
    id?: string | number;
    type?: string;
    attributes?: {
      subscription_id?: string | number;
      user_email?: string;
      status?: string;
      billing_reason?: string;
      test_mode?: boolean;
    };
  };
};

export type LemonSubscriptionInvoiceParse =
  | {
      outcome: "invoice";
      invoiceId: string;
      subscriptionId: string;
      email: string;
      status: string;
      billingReason: string;
      firebaseUid?: string;
      testMode: boolean;
    }
  | { outcome: "skip"; reason: string; invoiceId?: string }
  | { outcome: "reject"; reason: string };

function extractFirebaseUidFromInvoicePayload(b: LemonSubscriptionInvoicePayload): string | undefined {
  const block = b.meta?.custom_data;
  if (!block || typeof block !== "object") return undefined;
  const u = (block as { uid?: unknown }).uid;
  return typeof u === "string" && u.trim() ? u.trim() : undefined;
}

/** Used for `subscription_payment_success` / `subscription_payment_failed` / refunds on invoices. */
export function parseLemonSubscriptionInvoicePayload(body: unknown): LemonSubscriptionInvoiceParse {
  if (!body || typeof body !== "object") {
    return { outcome: "reject", reason: "invalid_body" };
  }
  const b = body as LemonSubscriptionInvoicePayload;
  if (b.data?.type && b.data.type !== "subscription-invoices") {
    return { outcome: "reject", reason: "unexpected_data_type" };
  }
  const invoiceId = b.data?.id != null ? String(b.data.id).trim() : "";
  if (!invoiceId) return { outcome: "reject", reason: "missing_invoice_id" };
  const attrs = b.data?.attributes;
  const rawSub = attrs?.subscription_id;
  const subscriptionId = rawSub != null ? String(rawSub).trim() : "";
  if (!subscriptionId) return { outcome: "reject", reason: "missing_subscription_id" };
  const email = typeof attrs?.user_email === "string" ? attrs.user_email.trim().toLowerCase() : "";
  if (!email) return { outcome: "reject", reason: "missing_user_email" };
  const status = typeof attrs?.status === "string" ? attrs.status.trim().toLowerCase() : "";
  if (status === "pending") {
    return { outcome: "skip", reason: "invoice_not_paid", invoiceId };
  }
  const billingReason = typeof attrs?.billing_reason === "string" ? attrs.billing_reason.trim() : "";
  const firebaseUid = extractFirebaseUidFromInvoicePayload(b);
  return {
    outcome: "invoice",
    invoiceId,
    subscriptionId,
    email,
    status: status || "unknown",
    billingReason: billingReason || "unknown",
    ...(firebaseUid ? { firebaseUid } : {}),
    testMode: attrs?.test_mode === true,
  };
}
