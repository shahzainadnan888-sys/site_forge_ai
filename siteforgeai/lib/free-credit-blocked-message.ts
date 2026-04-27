import { DEFAULT_SIGNUP_CREDITS } from "@/lib/credit-economy";

/** Shown when free credits were not granted because this IP already claimed the signup offer. */
export const FREE_CREDITS_BLOCKED_TITLE = "Free credits already used on this network";
export const FREE_CREDITS_BLOCKED_BODY = `You won't receive ${DEFAULT_SIGNUP_CREDITS} free credits — an account was already given the signup credits from this IP address.`;

export function freeCreditsBlockedMessageMultiline() {
  return `Free credits already used on this network\n\nYou won't receive ${DEFAULT_SIGNUP_CREDITS} free credits — an account was already given the signup credits from this IP address.`;
}
