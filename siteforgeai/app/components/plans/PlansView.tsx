"use client";

import { useState } from "react";
import { DEFAULT_SIGNUP_CREDITS } from "@/lib/credit-economy";

const LEMONSQUEEZY_BUY_CREDITS_URL =
  "https://siteforgeai.lemonsqueezy.com/checkout/buy/2b0a7156-47d4-4fc4-b507-6f3fc96f6fe7";

const CREDIT_PACK_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: "10 credits — $1" },
  { value: 25, label: "25 credits — $2.5" },
  { value: 35, label: "35 credits — $3.5" },
  { value: 50, label: "50 credits — $5" },
  { value: 100, label: "100 credits — $10" },
  { value: 250, label: "250 credits — $25" },
  { value: 500, label: "500 credits — $50" },
  { value: 1000, label: "1000 credits — $100" },
];

export function PlansView() {
  const [credits, setCredits] = useState<number>(100);
  const checkoutUrl = (() => {
    const base = new URL(LEMONSQUEEZY_BUY_CREDITS_URL);
    try {
      const raw = localStorage.getItem("siteforge-session");
      const session = raw
        ? (JSON.parse(raw) as { email?: string; uid?: string } | null)
        : null;
      const email = session?.email?.trim();
      const uid = session?.uid?.trim();
      if (email) base.searchParams.set("checkout[email]", email);
      if (uid) base.searchParams.set("checkout[custom][uid]", uid);
    } catch {
      // Ignore localStorage parse errors and continue to checkout.
    }
    // Optional trace metadata for analytics/debugging.
    base.searchParams.set("checkout[custom][selected_credits]", String(credits));
    base.searchParams.set("checkout[custom][source]", "plans_page");
    return base.toString();
  })();

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

          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sf-cta-glow mt-8 inline-block w-full rounded-full px-6 py-3.5 text-center text-base font-semibold text-white"
            style={{
              background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
            }}
          >
            Buy Credits
          </a>

          <p className="mt-4 text-center text-xs sm:text-sm" style={{ color: "var(--sf-text-muted)" }}>
            New users get {DEFAULT_SIGNUP_CREDITS} credits free
          </p>
        </div>
      </section>
    </>
  );
}
