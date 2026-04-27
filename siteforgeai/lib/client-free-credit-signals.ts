"use client";

const FREE_CREDITS_CLAIMED_KEY = "siteforge_free_credits_claimed";

export function setLocalStorageFreeCreditsClaimed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FREE_CREDITS_CLAIMED_KEY, "1");
  } catch {
    // ignore
  }
}
