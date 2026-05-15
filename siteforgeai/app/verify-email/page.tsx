"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
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
  const { data: session, status } = useSession();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const persistFromMe = async () => {
    const meRes = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
    const me = (await meRes.json().catch(() => null)) as MeResponse | null;
    if (!meRes.ok || !me?.ok || !me.user) {
      throw new Error(me?.error || "Failed to load account.");
    }
    if (me.user.emailVerified === false) {
      throw new Error("Your account email is not verified yet.");
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
        ...(me.user.avatarDataUrl ? { avatarDataUrl: me.user.avatarDataUrl } : {}),
        freeCreditsBlocked: me.user.freeCreditsBlocked === true,
      })
    );
    emitSiteforgeSessionUpdate();
  };

  const handleRefresh = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (status !== "authenticated") {
        throw new Error("Sign in first, then refresh your verification status.");
      }
      await persistFromMe();
      setMessage("You're verified — redirecting to your dashboard.");
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
        <section className="sf-elevate rounded-2xl border p-6 sm:p-8" style={{ borderColor: "var(--sf-border)" }}>
          <h1 className="text-3xl font-bold" style={{ color: "var(--sf-text)" }}>
            Verify your email
          </h1>

          <p className="mt-3 text-sm" style={{ color: "var(--sf-text-muted)" }}>
            If you just confirmed your email, refresh below to continue.
          </p>

          {emailFromQuery && (
            <p className="mt-2 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              Email: <b style={{ color: "var(--sf-text)" }}>{emailFromQuery}</b>
            </p>
          )}

          {status === "unauthenticated" && (
            <p className="mt-3 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              You are not signed in.{" "}
              <Link href="/get-started" className="underline">
                Sign in
              </Link>{" "}
              first.
            </p>
          )}

          {message && <p className="mt-4 text-green-600">{message}</p>}
          {error && <p className="mt-4 text-red-500">{error}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => void handleRefresh()} disabled={busy || status !== "authenticated"}>
              I have verified — continue
            </button>

            <Link href="/get-started">Back</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
