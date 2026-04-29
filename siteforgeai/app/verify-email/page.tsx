"use client";

import { Suspense, useEffect, useState } from "react";
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
    typeof window.screen?.width === "number" &&
    typeof window.screen?.height === "number"
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
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams?.get("email")?.trim() || "";

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

    const sessionJson = (await sessionRes.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!sessionRes.ok) {
      throw new Error(sessionJson?.error || "Failed to create session.");
    }

    const meRes = await fetch("/api/auth/me", { cache: "no-store" });
    const me = (await meRes.json().catch(() => null)) as MeResponse | null;

    if (!meRes.ok || !me?.ok || !me.user) {
      throw new Error(me?.error || "Failed to load account.");
    }

    if (me.user.emailVerified === false) {
      throw new Error("Please verify your email before logging in.");
    }

    if (me.user.freeCreditsClaimed) {
      setLocalStorageFreeCreditsClaimed();
    }

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        uid: me.user.uid,
        fullName: me.user.fullName,
        email: me.user.email,
        emailVerified: me.user.emailVerified === true,
        credits: me.user.credits,
        ...(me.user.avatarDataUrl
          ? { avatarDataUrl: me.user.avatarDataUrl }
          : {}),
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
      if (!user) throw new Error("Sign in first.");

      await sendEmailVerification(user);
      setMessage("Verification email sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
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
      if (!user) throw new Error("Sign in first.");

      await user.reload();
      const updated = firebase.auth.currentUser;

      if (!updated?.emailVerified) {
        setMessage("Email not verified yet.");
        return;
      }

      const token = await updated.getIdToken(true);
      await establishSession(token);

      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        <section className="rounded-2xl border p-6 sm:p-8">
          <h1 className="text-3xl font-bold">Verify your email</h1>

          <p className="mt-3 text-sm">
            Check your inbox and verify your email.
          </p>

          {emailFromQuery && (
            <p className="mt-2 text-sm">
              Email: <b>{emailFromQuery}</b>
            </p>
          )}

          {!hasAuthedUser && (
            <p className="mt-3 text-sm">
              Sign in first before verifying email.
            </p>
          )}

          {message && <p className="mt-4 text-green-600">{message}</p>}
          {error && <p className="mt-4 text-red-500">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={handleResend} disabled={busy}>
              Resend Email
            </button>

            <button onClick={handleRefresh} disabled={busy}>
              Refresh Status
            </button>

            <Link href="/get-started">Back</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}