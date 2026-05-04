/** Lemon Squeezy variant IDs → credit packs (store-specific). */
export const LEMONSQUEEZY_VARIANT_CREDITS: Readonly<Record<string, number>> = {
  "1610247": 10,
  "1610254": 25,
  "1610255": 35,
  "1610258": 50,
  "1610259": 100,
  "1610263": 250,
  "1610265": 500,
  "1610266": 1000,
};

/** API / webhook variant id string for a credit pack (inverse of {@link LEMONSQUEEZY_VARIANT_CREDITS}). */
export function lemonVariantIdForCredits(credits: number): string | null {
  if (!Number.isFinite(credits)) return null;
  const entry = Object.entries(LEMONSQUEEZY_VARIANT_CREDITS).find(([, v]) => v === credits);
  return entry?.[0] ?? null;
}

export function creditsForLemonVariantId(variantId: unknown): number | null {
  if (variantId === null || variantId === undefined) return null;
  const key = String(variantId).trim();
  if (!key) return null;
  const credits = LEMONSQUEEZY_VARIANT_CREDITS[key];
  return typeof credits === "number" && Number.isFinite(credits) ? credits : null;
}
