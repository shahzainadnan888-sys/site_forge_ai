"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  browserLocalPersistence,
  sendEmailVerification,
  signOut,
  signInWithEmailAndPassword,
  setPersistence,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";

import { firebase } from "@/lib/firebase";
import { setLocalStorageFreeCreditsClaimed } from "@/lib/client-free-credit-signals";
import { emitSiteforgeSessionUpdate } from "@/lib/siteforge-credits";

type AuthTab = "signin" | "signup";

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
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screen:
      typeof window.screen?.width === "number" &&
      typeof window.screen?.height === "number"
        ? `${window.screen.width}x${window.screen.height}`
        : "",
    platform: navigator.platform || "",
    userAgent: navigator.userAgent || "",
  };
}

export function GetStartedView() {
  return (
    <Suspense fallback={null}>
      <GetStartedViewInner />
    </Suspense>
  );
}

function GetStartedViewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<AuthTab>("signin");
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [busyResendVerification, setBusyResendVerification] = useState(false);

  const SESSION_KEY = "siteforge-session";
  const entryMessage = searchParams?.get("message")?.trim() || "";

  const establishSession = async (idToken: string) => {
    const sessionRes = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, deviceContext: readDeviceContext() }),
    });

    if (!sessionRes.ok) {
      const details = await sessionRes.json().catch(() => null);
      throw new Error(details?.error || "Failed to create session.");
    }

    const meRes = await fetch("/api/auth/me", { cache: "no-store" });
    const me = (await meRes.json().catch(() => null)) as MeResponse | null;

    if (!meRes.ok || !me?.ok || !me.user) {
      throw new Error(me?.error || "Failed to load account.");
    }

    const isEmailVerified = me.user.emailVerified === true;

    if (!isEmailVerified) {
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
        emailVerified: isEmailVerified,
        credits: me.user.credits,
        ...(me.user.avatarDataUrl
          ? { avatarDataUrl: me.user.avatarDataUrl }
          : {}),
        freeCreditsBlocked: me.user.freeCreditsBlocked === true,
      })
    );

    emitSiteforgeSessionUpdate();
    router.push("/dashboard");
  };

  const handleGoogle = async () => {
    setBusyGoogle(true);
    setError("");

    try {
      const auth = firebase.auth;
      if (!auth) throw new Error("Firebase not initialized.");

      await setPersistence(auth, browserLocalPersistence);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const res = await signInWithPopup(auth, provider);
      const idToken = await res.user.getIdToken();

      await establishSession(idToken);
    } catch (e: any) {
      setError(e?.message || "Google sign-in failed.");
    } finally {
      setBusyGoogle(false);
    }
  };

  const handleEmailAuth = async () => {
    setBusyEmail(true);
    setError("");

    try {
      const auth = firebase.auth;
      if (!auth) throw new Error("Firebase not initialized.");

      await setPersistence(auth, browserLocalPersistence);

      if (!email || !password) throw new Error("Email & password required.");

      if (tab === "signup") {
        if (password !== confirmPassword)
          throw new Error("Passwords do not match.");

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: fullName });
        await sendEmailVerification(cred.user);

        await signOut(auth);
        setTab("signin");
        setInfo("Verification email sent.");
        setShowResendVerification(true);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        await signOut(auth);
        setError("Please verify your email.");
        setShowResendVerification(true);
        return;
      }

      const idToken = await cred.user.getIdToken();
      await establishSession(idToken);
    } catch (e: any) {
      setError(e?.message || "Login failed.");
    } finally {
      setBusyEmail(false);
    }
  };

  const handleResendVerification = async () => {
    setBusyResendVerification(true);
    setError("");

    try {
      const auth = firebase.auth;
      if (!auth) throw new Error("Firebase not initialized.");

      const cred = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      await signOut(auth);

      setInfo("Verification email sent.");
    } catch (e: any) {
      setError(e?.message || "Failed to resend email.");
    } finally {
      setBusyResendVerification(false);
    }
  };

  return (
    <section className="min-h-screen">
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold">Get Started</h1>

        {entryMessage && <p>{entryMessage}</p>}

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {tab === "signup" && (
          <>
            <input
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              placeholder="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </>
        )}

        <button onClick={handleEmailAuth}>
          {tab === "signin" ? "Sign In" : "Sign Up"}
        </button>

        <button onClick={handleGoogle} disabled={busyGoogle}>
          Continue with Google
        </button>

        {error && <p style={{ color: "red" }}>{error}</p>}
        {info && <p style={{ color: "green" }}>{info}</p>}

        {showResendVerification && (
          <button onClick={handleResendVerification}>
            Resend verification email
          </button>
        )}
      </div>
    </section>
  );
}