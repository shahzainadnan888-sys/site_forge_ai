import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

const BILLING_WEBHOOK_LOGS = "billing_webhook_logs";

export type BillingWebhookLogInput = {
  eventName: string;
  ok: boolean;
  detail: string;
  orderId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  uid?: string;
  extra?: Record<string, string | number | boolean | undefined>;
};

/**
 * Structured billing webhook logging: always console; best-effort Firestore row for admin review.
 */
export async function logBillingWebhookEvent(req: Request, input: BillingWebhookLogInput): Promise<void> {
  const { extra, ...restInput } = input;
  const line = {
    at: new Date().toISOString(),
    path: new URL(req.url).pathname,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "",
    ...restInput,
    ...(extra || {}),
  };
  console.log("[billing-webhook]", JSON.stringify(line));

  try {
    await adminDb.collection(BILLING_WEBHOOK_LOGS).add({
      ...line,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
  } catch (err) {
    console.error("[billing-webhook] Firestore log write failed:", err instanceof Error ? err.message : err);
  }
}
