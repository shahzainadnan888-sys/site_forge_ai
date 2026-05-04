/** Credit amounts sold on the Plans page (must match webhook variant names). */
export const LEMON_CREDIT_PACKS = [10, 25, 35, 50, 100, 250, 500, 1000] as const;

export type LemonCreditPack = (typeof LEMON_CREDIT_PACKS)[number];

export function isLemonCreditPack(credits: number): credits is LemonCreditPack {
  return (LEMON_CREDIT_PACKS as readonly number[]).includes(credits);
}
