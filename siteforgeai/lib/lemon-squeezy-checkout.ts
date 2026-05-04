/**
 * Lemon Squeezy checkout URLs per credit pack.
 *
 * **Recommended:** use `GET /api/lemonsqueezy/start-checkout` (see `goToLemonSqueezyCheckoutForCredits`)
 * with `LEMONSQUEEZY_API_KEY` + `LEMONSQUEEZY_STORE_ID` so Lemon returns a real checkout URL
 * (`/checkout/custom/...`), avoiding 404s from guessed `/checkout/buy/<numeric-variant-id>` links.
 *
 * **Alternative:** set `NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_<credits>` to the full URL from
 * Lemon → Product → **Share** → Checkout (must match what Lemon shows; often a UUID path, not the API id).
 *
 * Optional fallback: `NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL` when a tier-specific URL is missing.
 */

import { isLemonCreditPack, type LemonCreditPack } from "@/lib/lemon-squeezy-credit-packs";

const CHECKOUT_ENV: Record<LemonCreditPack, string | undefined> = {
  10: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_10,
  25: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_25,
  35: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_35,
  50: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_50,
  100: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_100,
  250: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_250,
  500: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_500,
  1000: process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_1000,
};

/** Optional inline URLs when not using env (same shape as packs). */
const INLINE_CHECKOUT_URLS: Partial<Record<LemonCreditPack, string>> = {
  // Example: 10: "https://buildwithsiteforge.lemonsqueezy.com/checkout/buy/…",
};

function trimUrl(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t || undefined;
}

/**
 * Resolves the Lemon Squeezy checkout URL for a credit pack (no query params).
 */
export function resolveLemonSqueezyCheckoutBaseUrl(credits: number): string | undefined {
  if (!isLemonCreditPack(credits)) return undefined;
  const pack = credits;

  return (
    trimUrl(CHECKOUT_ENV[pack]) ||
    trimUrl(INLINE_CHECKOUT_URLS[pack]) ||
    trimUrl(process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL)
  );
}

export type LemonCheckoutSessionFields = {
  email?: string;
  uid?: string;
};

function parseSessionJson(raw: string | null): LemonCheckoutSessionFields {
  if (!raw) return {};
  try {
    const session = JSON.parse(raw) as { email?: string; uid?: string } | null;
    if (!session || typeof session !== "object") return {};
    return {
      email: typeof session.email === "string" ? session.email.trim() : undefined,
      uid: typeof session.uid === "string" ? session.uid.trim() : undefined,
    };
  } catch {
    return {};
  }
}

/** Appends prefill + custom_data query params (same shape as Lemon hosted checkout docs). */
export function buildLemonCheckoutPrefillUrl(
  baseRaw: string,
  fields: { email?: string; uid?: string; credits: number }
): string {
  const base = new URL(baseRaw.trim());
  const email = fields.email?.trim();
  const uid = fields.uid?.trim();
  if (email) base.searchParams.set("checkout[email]", email);
  if (uid) base.searchParams.set("checkout[custom][uid]", uid);
  base.searchParams.set("checkout[custom][selected_credits]", String(fields.credits));
  base.searchParams.set("checkout[custom][source]", "plans_page");
  return base.toString();
}

/**
 * Builds the full checkout URL with optional prefill / custom data for the webhook.
 */
export function buildLemonSqueezyCheckoutUrl(
  credits: number,
  sessionJson: string | null | undefined
): string | null {
  if (!isLemonCreditPack(credits)) return null;
  const baseRaw = resolveLemonSqueezyCheckoutBaseUrl(credits);
  if (!baseRaw) return null;
  const { email, uid } = parseSessionJson(sessionJson ?? null);
  return buildLemonCheckoutPrefillUrl(baseRaw, { email, uid, credits });
}

function lemonStoreIdConfiguredPublic(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID?.trim());
}

export function hasLemonSqueezyCheckoutForCredits(credits: number): boolean {
  if (!isLemonCreditPack(credits)) return false;
  if (resolveLemonSqueezyCheckoutBaseUrl(credits)) return true;
  /** Enables Buy when using API-only checkout (server also reads LEMONSQUEEZY_STORE_ID). */
  return lemonStoreIdConfiguredPublic();
}

/**
 * Redirects to the server route that either creates a Lemon API checkout or uses configured Share URLs.
 * Session email / uid are taken from the Firebase session cookie on the server.
 */
export function goToLemonSqueezyCheckoutForCredits(credits: number): boolean {
  if (typeof window === "undefined") return false;
  if (!isLemonCreditPack(credits)) return false;
  window.location.assign(`/api/lemonsqueezy/start-checkout?credits=${credits}`);
  return true;
}
