import { creditsForLemonVariantId } from "@/lib/lemonsqueezy/variant-credits";

export type LemonOrderCreatedPayload = {
  meta?: { custom_data?: Record<string, unknown> };
  data?: {
    id?: string | number;
    type?: string;
    attributes?: {
      user_email?: string;
      /** From checkout URL params, e.g. `checkout[custom][uid]`. */
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

function extractFirebaseUidFromOrderPayload(b: LemonOrderCreatedPayload): string | undefined {
  const blocks: unknown[] = [b.data?.attributes?.custom_data, b.meta?.custom_data];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const u = (block as { uid?: unknown }).uid;
    if (typeof u === "string" && u.trim()) return u.trim();
  }
  return undefined;
}

/** Expect `meta.event_name === "order_created"` (caller must verify before calling). */
export function parseOrderCreatedPayload(body: unknown): ParsedOrderCreated {
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "invalid_body" };
  }
  const b = body as LemonOrderCreatedPayload;
  if (b.data?.type && b.data.type !== "orders") {
    return { ok: false, reason: "unexpected_data_type" };
  }

  const orderId = b.data?.id != null ? String(b.data.id).trim() : "";
  if (!orderId) {
    return { ok: false, reason: "missing_order_id" };
  }

  const attrs = b.data?.attributes;
  const email = typeof attrs?.user_email === "string" ? attrs.user_email.trim().toLowerCase() : "";
  if (!email) {
    return { ok: false, reason: "missing_user_email" };
  }

  const rawVariantId = attrs?.first_order_item?.variant_id;
  const variantId = rawVariantId != null ? String(rawVariantId).trim() : "";
  if (!variantId) {
    return { ok: false, reason: "missing_variant_id" };
  }

  const credits = creditsForLemonVariantId(variantId);
  if (credits === null) {
    return { ok: false, reason: `unknown_variant_id:${variantId}` };
  }

  const firebaseUid = extractFirebaseUidFromOrderPayload(b);
  return { ok: true, orderId, email, variantId, credits, ...(firebaseUid ? { firebaseUid } : {}) };
}
