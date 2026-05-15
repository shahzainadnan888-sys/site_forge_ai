"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { syncSessionCreditsFromServer } from "@/lib/client-session-sync";
import { DEFAULT_SIGNUP_CREDITS, optionLabelForCredits } from "@/lib/credit-economy";
import { goToLemonSqueezyCheckoutForCredits, hasLemonSqueezyCheckoutForCredits } from "@/lib/lemon-squeezy-checkout";
import { LEMON_CREDIT_PACKS } from "@/lib/lemon-squeezy-credit-packs";
import { SITEFORGE_SESSION_EVENT } from "@/lib/siteforge-credits";

const SESSION_KEY = "siteforge-session";

const CREDIT_PACK_OPTIONS = LEMON_CREDIT_PACKS.map((value) => ({
  value,
  label: optionLabelForCredits(value),
}));

function readHasSignedInSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as { uid?: string; email?: string } | null;
    return Boolean(s?.uid?.trim() && s?.email?.trim());
  } catch {
    return false;
  }
}

export function PlansView() {
  const router = useRouter();
  const [credits, setCredits] = useState<number>(LEMON_CREDIT_PACKS[0]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const canCheckout = hasLemonSqueezyCheckoutForCredits(credits);

  useEffect(() => {
    const sync = () => setIsSignedIn(readHasSignedInSession());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener(SITEFORGE_SESSION_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener(SITEFORGE_SESSION_EVENT, sync);
    };
  }, []);

  /** After Lemon checkout, users can land on `/plans?billing=success` — poll Firestore until credits update. */
  useEffect(() => {
    if (typeof window === "undefined" || !isSignedIn) return;
    const sp = new URLSearchParams(window.location.search);
    const billingSync = sp.get("billing") === "success" || sp.get("billing") === "sync";
    if (!billingSync) return;

    let ticks = 0;
    const id = window.setInterval(() => {
      ticks += 1;
      void syncSessionCreditsFromServer();
      if (ticks >= 45) window.clearInterval(id);
    }, 3000);

    void syncSessionCreditsFromServer();

    return () => window.clearInterval(id);
  }, [isSignedIn]);

  const handleBuyCredits = () => {
    if (!readHasSignedInSession()) {
      router.push(
        "/get-started?message=" + encodeURIComponent("Please sign in to buy credits. Your purchase is tied to your account.")
      );
      return;
    }
    if (!canCheckout) return;
    goToLemonSqueezyCheckoutForCredits(credits);
  };

  const buyDisabled = isSignedIn && !canCheckout;
  const buyLabel = isSignedIn ? "Buy Credits" : "Sign in to buy credits";

  return (
    <>
      <section className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-16">
        <div className="mx-auto max-w-xl text-center">
          <h1
            className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl"
            style={{ color: "var(--sf-text)" }}
          >
            Buy Credits
          </h1>
          <p
            className="mx-auto mt-4 text-base sm:text-lg"
            style={{ color: "var(--sf-text-muted)" }}
          >
            Pay as you go: add credits to your account and use them for <strong>website generation</strong>{" "}
            and <strong>AI edit</strong>.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-4 pb-20 sm:px-6 sm:pb-24">
        <div
          className="sf-plan-card rounded-2xl border p-6 sm:p-8"
          style={{
            borderColor: "var(--sf-border)",
            color: "var(--sf-text)",
            background: "var(--sf-card)",
            boxShadow: "0 0 0 1px var(--sf-border)",
          }}
        >
          <label htmlFor="credit-pack" className="block text-sm font-semibold">
            Choose amount
          </label>
          <select
            id="credit-pack"
            className="mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none transition focus:ring-2"
            style={{
              borderColor: "var(--sf-border)",
              background: "color-mix(in srgb, var(--sf-card) 85%, transparent)",
              color: "var(--sf-text)",
            }}
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
          >
            {CREDIT_PACK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <ul
            className="mt-6 space-y-2 text-sm sm:text-base"
            style={{ color: "var(--sf-text-muted)" }}
          >
            <li>1 website = 10 credits</li>
            <li>1 edit = 2 credits</li>
          </ul>

          {!isSignedIn && (
            <p className="mt-6 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              You need to be signed in so credits are added to the right account after checkout.
            </p>
          )}

          {isSignedIn && !canCheckout && (
            <p className="mt-6 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              Credit purchases are not available right now. Please try again later or use{" "}
              <a href="/contact#support" className="underline underline-offset-2">
                support
              </a>
              .
            </p>
          )}

          <button
            type="button"
            disabled={buyDisabled}
            onClick={handleBuyCredits}
            className="sf-cta-glow mt-8 w-full rounded-full px-6 py-3.5 text-center text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
            }}
          >
            {buyLabel}
          </button>

          <p className="mt-4 text-center text-xs sm:text-sm" style={{ color: "var(--sf-text-muted)" }}>
            New users get {DEFAULT_SIGNUP_CREDITS} credits free
          </p>
          <p className="mt-3 text-center text-xs" style={{ color: "var(--sf-text-muted)" }}>
            After paying, use Lemon&apos;s confirmation button URL{" "}
            <span className="font-mono text-[11px]">/plans?billing=success</span> so your balance refreshes automatically.
          </p>
        </div>
      </section>
    </>
  );
}
