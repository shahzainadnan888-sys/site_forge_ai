/** Single source of truth for credit costs and signup grant. */
export const DEFAULT_SIGNUP_CREDITS = 16;
export const GENERATION_CREDIT_COST = 10;
export const EDIT_APPLY_CREDIT_COST = 2;
/** 10 credits = $1 when purchasing. */
export const CREDITS_PER_USD = 10;

export function usdForCredits(credits: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(credits / CREDITS_PER_USD);
}

export function optionLabelForCredits(credits: number): string {
  return `${credits} credits — ${usdForCredits(credits)}`;
}
