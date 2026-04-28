"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, sendEmailVerification } from "firebase/auth";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { firebase } from "@/lib/firebase";
import { setLocalStorageFreeCreditsClaimed } from "@/lib/client-free-credit-signals";
import { emitSiteforgeSessionUpdate } from "@/lib/siteforge-credits";

const SESSION_KEY = "siteforge-session";

type MeResponse = {
  ok: boolean;
  user?: {
    uid: string;
    fullName: string;
    email: string;
    emailVerified?: boolean;
    credits: number;
    avatarDataUrl?: string;
    freeCreditsClaimed?: boolean;
    freeCreditsBlocked?: boolean;
  };
  error?: string;
};

function readDeviceContext() {
  if (typeof window === "undefined") return {};
  const screenValue =
    typeof window.screen?.width === "number" && typeof window.screen?.height === "number"
      ? `${window.screen.width}x${window.screen.height}`
      : "";
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screen: screenValue,
    platform: navigator.platform || "",
    userAgent: navigator.userAgent || "",
  };
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email")?.trim() || "";
  const [hasAuthedUser, setHasAuthedUser] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = firebase.auth;
    const unsub = onAuthStateChanged(auth, (u) => {
      setHasAuthedUser(Boolean(u));
    });
    return unsub;
  }, []);

  const establishSession = async (idToken: string) => {
    const sessionRes = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, deviceContext: readDeviceContext() }),
    });
    const sessionJson = (await sessionRes.json().catch(() => null)) as { error?: string } | null;
    if (!sessionRes.ok) {
      throw new Error(sessionJson?.error || "Failed to create secure sign-in session.");
    }
    const meRes = await fetch("/api/auth/me", { cache: "no-store" });
    const me = (await meRes.json().catch(() => null)) as MeResponse | null;
    if (!meRes.ok || !me?.ok || !me.user) {
      throw new Error(me?.error || "Failed to load your account session.");
    }
    if (me.user.emailVerified === false) {
      throw new Error("Please verify your email before logging in.");
    }
    if (me.user.freeCreditsClaimed) setLocalStorageFreeCreditsClaimed();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        uid: me.user.uid,
        fullName: me.user.fullName,
        email: me.user.email,
        emailVerified: me.user.emailVerified !== false,
        credits: me.user.credits,
        ...(me.user.avatarDataUrl ? { avatarDataUrl: me.user.avatarDataUrl } : {}),
        freeCreditsBlocked: me.user.freeCreditsBlocked === true,
      })
    );
    emitSiteforgeSessionUpdate();
  };

  const handleResend = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const user = firebase.auth.currentUser;
      if (!user) throw new Error("Please sign in first to resend verification email.");
      await sendEmailVerification(user);
      setMessage("Verification email sent. Check your inbox.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send verification email.");
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const user = firebase.auth.currentUser;
      if (!user) throw new Error("Please sign in first, then refresh verification status.");
      await user.reload();
      const updated = firebase.auth.currentUser;
      if (!updated) throw new Error("Please sign in first, then refresh verification status.");
      if (!updated.emailVerified) {
        setMessage("Email is not verified yet. Please check your inbox and click the verification link.");
        return;
      }
      const token = await updated.getIdToken(true);
      await establishSession(token);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh verification status.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        <section
          className="rounded-2xl border p-6 sm:p-8"
          style={{ borderColor: "var(--sf-border)", background: "color-mix(in srgb, var(--sf-card) 72%, transparent)" }}
        >
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--sf-text)" }}>
            Verify your email
          </h1>
          <p className="mt-3 text-base sm:text-lg" style={{ color: "var(--sf-text-muted)" }}>
            Check your inbox and verify your email to continue.
          </p>
          {emailFromQuery ? (
            <p className="mt-2 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              Verification target: <span style={{ color: "var(--sf-text)" }}>{emailFromQuery}</span>
            </p>
          ) : null}
          {!hasAuthedUser ? (
            <p className="mt-3 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              Sign in first, then use this page to resend or refresh verification status.
            </p>
          ) : null}
          {message ? (
            <p className="mt-4 text-sm" style={{ color: "var(--sf-accent-from)" }}>
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-red-500" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleResend}
              disabled={busy}
              className="rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-65"
              style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
            >
              Resend Email
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={busy}
              className="sf-cta-glow rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-65"
              style={{ background: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))" }}
            >
              Refresh Status
            </button>
            <Link
              href="/get-started"
              className="rounded-full border px-5 py-2.5 text-center text-sm font-semibold"
              style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}
            >
              Back to Login
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
