"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SIGNUP_CREDITS } from "@/lib/credit-economy";
import { SITEFORGE_SESSION_EVENT } from "@/lib/siteforge-credits";

const SESSION_KEY = "siteforge-session";
const TOAST_MS = 7000;

function readHasSession(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as { email?: string };
    return typeof s.email === "string" && s.email.length > 0;
  } catch {
    return false;
  }
}

/**
 * For visitors who are not signed in. Encourages sign-up and free starter credits. Hidden on
 * the auth page and when a user session exists. Auto-hides after a few seconds.
 */
export function GlobalSignUpToast() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(true);

  const check = useCallback(() => {
    setHasSession(readHasSession());
  }, []);

  useEffect(() => {
    setReady(true);
    check();
  }, [check]);

  useEffect(() => {
    if (!ready) return;
    const onS = () => check();
    window.addEventListener(SITEFORGE_SESSION_EVENT, onS);
    window.addEventListener("storage", onS);
    return () => {
      window.removeEventListener(SITEFORGE_SESSION_EVENT, onS);
      window.removeEventListener("storage", onS);
    };
  }, [ready, check]);

  const onAuthPath = pathname === "/get-started" || (pathname != null && pathname.startsWith("/get-started"));
  const shouldOffer = ready && !hasSession && !onAuthPath;
  const [toastOpen, setToastOpen] = useState(false);

  useEffect(() => {
    if (!shouldOffer) {
      setToastOpen(false);
      return;
    }
    setToastOpen(true);
    const hide = window.setTimeout(() => setToastOpen(false), TOAST_MS);
    return () => window.clearTimeout(hide);
  }, [shouldOffer]);

  if (!shouldOffer || !toastOpen) return null;

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
        <p className="font-semibold" style={{ color: "var(--sf-text)" }}>
          Sign up to get {DEFAULT_SIGNUP_CREDITS} credits and start building your first website for completely
          free.
        </p>
        <div className="mt-2.5">
          <Link
            href="/get-started"
            className="inline-flex h-9 items-center justify-center rounded-full border px-4 text-xs font-semibold text-white transition hover:opacity-95"
            style={{
              borderColor: "transparent",
              background: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))",
            }}
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}
