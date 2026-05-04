import crypto from "node:crypto";

/**
 * Verifies Lemon Squeezy `X-Signature` (HMAC-SHA256 of the raw body, hex digest).
 * @see https://docs.lemonsqueezy.com/help/webhooks/webhook-requests#signing-requests
 */
export function verifyLemonSqueezySignature(rawBody: Buffer, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.trim() || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = signatureHeader.trim().toLowerCase();
  if (expected.length !== got.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(got, "hex"));
  } catch {
    return false;
  }
}
