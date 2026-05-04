import { DEFAULT_SIGNUP_CREDITS } from "@/lib/credit-economy";

/** Shown when free credits were not granted because this device or network already claimed the signup offer. */
export const FREE_CREDITS_BLOCKED_TITLE = "Free credits already used on this device or network";
export const FREE_CREDITS_BLOCKED_BODY = `You won't receive ${DEFAULT_SIGNUP_CREDITS} free credits — another account on this device or network already received the signup credits.`;

export function freeCreditsBlockedMessageMultiline() {
  return `Free credits already used on this device or network\n\nYou won't receive ${DEFAULT_SIGNUP_CREDITS} free credits — another account on this device or network already received the signup credits.`;
}
