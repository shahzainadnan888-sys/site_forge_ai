"use client";

import { useCallback, useEffect, useState } from "react";
import { FREE_CREDITS_BLOCKED_BODY, FREE_CREDITS_BLOCKED_TITLE } from "@/lib/free-credit-blocked-message";
import { SITEFORGE_SESSION_EVENT } from "@/lib/siteforge-credits";

const TOAST_MS = 6000;
const SESSION_KEY = "siteforge-session";

/**
 * Shown for signed-in users with a zero balance.
 * Daily/automatic refill messaging is intentionally removed.
 */
export function GlobalZeroCreditsToast() {
  const [zeroCredits, setZeroCredits] = useState(false);
  const [freeCreditsDuplicateBlock, setFreeCreditsDuplicateBlock] = useState(false);
  /** Stays true only for the short window the toast is on screen (see {@link TOAST_MS}). */
  const [toastOpen, setToastOpen] = useState(false);

  const refresh = useCallback(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        setZeroCredits(false);
        setFreeCreditsDuplicateBlock(false);
        return;
      }
      const parsed = JSON.parse(raw) as {
        email?: string;
        credits?: number;
        freeCreditsBlocked?: boolean;
      };
      const signedIn = typeof parsed.email === "string" && parsed.email.length > 0;
      const credits = typeof parsed.credits === "number" ? parsed.credits : 0;
      setZeroCredits(signedIn && credits <= 0);
      setFreeCreditsDuplicateBlock(signedIn && parsed.freeCreditsBlocked === true);
    } catch {
      setZeroCredits(false);
      setFreeCreditsDuplicateBlock(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 1000);
    window.addEventListener(SITEFORGE_SESSION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(SITEFORGE_SESSION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const shouldOfferToast = zeroCredits;

  useEffect(() => {
    if (!shouldOfferToast) {
      setToastOpen(false);
      return;
    }
    setToastOpen(true);
    const hide = window.setTimeout(() => setToastOpen(false), TOAST_MS);
    return () => window.clearTimeout(hide);
  }, [shouldOfferToast]);

  if (!shouldOfferToast || !toastOpen) return null;

  const isDuplicate = freeCreditsDuplicateBlock;

  return (
    <div
      className="pointer-events-none fixed right-3 top-[4.5rem] z-[60] w-[min(22rem,calc(100vw-1.5rem))] sm:right-5"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto rounded-2xl border px-3 py-2.5 text-sm leading-snug shadow-lg sm:px-4 sm:py-3"
        style={{
          borderColor: "var(--sf-border)",
          color: "var(--sf-text)",
          background: "var(--sf-card)",
          boxShadow: "0 10px 40px color-mix(in srgb, black 18%, transparent)",
        }}
      >
        {isDuplicate ? (
          <>
            <p className="font-semibold" style={{ color: "var(--sf-text)" }}>
              {FREE_CREDITS_BLOCKED_TITLE}
            </p>
            <p className="mt-1" style={{ color: "var(--sf-text-muted)" }}>
              {FREE_CREDITS_BLOCKED_BODY}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold" style={{ color: "var(--sf-text)" }}>
              You&apos;re out of credits
            </p>
            <p className="mt-1" style={{ color: "var(--sf-text-muted)" }}>
              Contact us to get more credits and keep generating websites.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
