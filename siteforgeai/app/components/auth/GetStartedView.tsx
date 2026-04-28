"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  browserLocalPersistence,
  sendEmailVerification,
  signOut,
  signInWithEmailAndPassword,
  setPersistence,
  signInWithRedirect,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { firebase } from "@/lib/firebase";
import { setLocalStorageFreeCreditsClaimed } from "@/lib/client-free-credit-signals";
import { SERVICE_FEATURE_CARDS } from "@/lib/service-feature-cards";
import { emitSiteforgeSessionUpdate } from "@/lib/siteforge-credits";

type AuthTab = "signin" | "signup";
type FirebaseLoginError = {
  code?: string;
  message?: string;
};

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

function GoogleMark() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function GetStartedView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AuthTab>("signin");
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [info, setInfo] = useState("");
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [busyResendVerification, setBusyResendVerification] = useState(false);
  const SESSION_KEY = "siteforge-session";
  const entryMessage = searchParams.get("message")?.trim() || "";

  const establishSession = async (idToken: string) => {
    const sessionRes = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, deviceContext: readDeviceContext() }),
    });
    if (!sessionRes.ok) {
      const details = (await sessionRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(details?.error || "Failed to create secure sign-in session.");
    }
    const meRes = await fetch("/api/auth/me", { cache: "no-store" });
    const me = (await meRes.json().catch(() => null)) as MeResponse | null;
    if (!meRes.ok || !me?.ok || !me.user) {
      throw new Error(me?.error || "Failed to load your account session.");
    }
    const isEmailVerified = !!me.user.emailVerified;
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
        ...(me.user.avatarDataUrl ? { avatarDataUrl: me.user.avatarDataUrl } : {}),
        freeCreditsBlocked: me.user.freeCreditsBlocked === true,
      })
    );
    emitSiteforgeSessionUpdate();
    router.push("/dashboard");
  };

  const handleGoogle = async () => {
    setBusyGoogle(true);
    setError("");
    setInfo("");
    setShowResendVerification(false);

    try {
      const auth = firebase.auth;
      if (!auth) throw new Error("Firebase auth not initialized. Check your env keys.");

      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const res = await signInWithPopup(auth, provider);
      const idToken = await res.user.getIdToken();
      await establishSession(idToken);
    } catch (e) {
      const err = e as FirebaseLoginError;
      const msg = err?.message || "Unable to continue with Google sign-in.";
      if (err?.code === "auth/popup-closed-by-user") {
        setError("Google sign-in cancelled.");
      } else if (
        err?.code === "auth/popup-blocked" ||
        err?.code === "auth/cancelled-popup-request"
      ) {
        setError("Popup blocked by browser. Redirecting to Google sign-in...");
        const auth = firebase.auth;
        if (!auth) throw new Error("Firebase auth not initialized. Check your env keys.");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithRedirect(auth, provider);
      } else if (err?.code === "auth/unauthorized-domain") {
        setError("This domain is not authorized in Firebase Authentication.");
      } else {
        setError(msg);
      }
    } finally {
      setBusyGoogle(false);
    }
  };

  const handleEmailAuth = async () => {
    setBusyEmail(true);
    setError("");
    setInfo("");
    setShowResendVerification(false);
    try {
      const auth = firebase.auth;
      if (!auth) throw new Error("Firebase auth not initialized. Check your env keys.");
      await setPersistence(auth, browserLocalPersistence);

      const cleanEmail = email.trim();
      if (!cleanEmail || !password.trim()) {
        throw new Error("Email and password are required.");
      }

      if (tab === "signup") {
        if (!fullName.trim()) throw new Error("Full name is required for sign up.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(credential.user, { displayName: fullName.trim() });
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setTab("signin");
        setInfo("Verification email sent. Please verify your email before logging in.");
        setShowResendVerification(true);
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      if (!credential.user.emailVerified) {
        await signOut(auth);
        setError("Please verify your email before logging in.");
        setShowResendVerification(true);
        return;
      }
      const idToken = await credential.user.getIdToken();
      await establishSession(idToken);
    } catch (e) {
      const err = e as FirebaseLoginError;
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") setError("Email already in use. Try Sign In.");
      else if (code === "auth/invalid-credential" || code === "auth/wrong-password")
        setError("Invalid email or password.");
      else if (code === "auth/user-not-found") setError("No account found. Please Sign Up.");
      else if (code === "auth/invalid-email") setError("Please enter a valid email address.");
      else if (code === "auth/operation-not-allowed")
        setError(
          "Email and password sign-in is turned off in Firebase. Open Firebase Console → Authentication → Sign-in method, then enable Email/Password."
        );
      else if (code === "auth/weak-password") setError("Use a stronger password (at least 6 characters).");
      else setError(err?.message || "Unable to continue with email/password.");
    } finally {
      setBusyEmail(false);
    }
  };

  const handleResendVerification = async () => {
    if (busyResendVerification) return;
    setBusyResendVerification(true);
    setError("");
    setInfo("");
    try {
      const auth = firebase.auth;
      if (!auth) throw new Error("Firebase auth not initialized. Check your env keys.");
      const cleanEmail = email.trim();
      if (!cleanEmail || !password.trim()) {
        throw new Error("Enter your email and password first, then resend verification.");
      }
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      await sendEmailVerification(credential.user);
      await signOut(auth);
      setInfo("Verification email sent. Check your inbox.");
    } catch (e) {
      const err = e as FirebaseLoginError;
      setError(err?.message || "Could not resend verification email.");
    } finally {
      setBusyResendVerification(false);
    }
  };


  return (
    <section className="sf-hide-inner-scrollbars relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1280px] gap-0 lg:grid-cols-2">
        <div
          className="border-b px-4 py-8 sm:px-6 lg:hidden"
          style={{ borderColor: "var(--sf-border)", background: "color-mix(in srgb, var(--sf-card) 40%, transparent)" }}
        >
          <p
            className="text-xl font-bold tracking-tight"
            style={{
              backgroundImage: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            SiteForge AI
          </p>
          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl" style={{ color: "var(--sf-text)" }}>
            Start building websites with AI
          </h1>
          <p className="mt-2 text-sm leading-relaxed sm:text-base" style={{ color: "var(--sf-text-muted)" }}>
            Generate, edit and deploy your website instantly.
          </p>
          <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SERVICE_FEATURE_CARDS.map((card) => (
              <li
                key={card.title}
                className="rounded-xl border px-3 py-2.5 text-left text-xs leading-snug sm:text-sm"
                style={{
                  borderColor: "var(--sf-border)",
                  background: "color-mix(in srgb, var(--sf-card) 65%, transparent)",
                  color: "var(--sf-text)",
                }}
              >
                <span className="font-semibold" style={{ color: "var(--sf-accent-from)" }}>
                  {card.title}
                </span>
                <span className="mt-0.5 block font-normal" style={{ color: "var(--sf-text-muted)" }}>
                  {card.description}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="relative hidden overflow-hidden border-r px-8 py-12 lg:block" style={{ borderColor: "var(--sf-border)" }}>
          <div className="sf-auth-gradient-bg absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto flex h-full max-w-xl flex-col justify-between">
            <div>
              <p
                className="text-2xl font-bold tracking-tight"
                style={{
                  backgroundImage: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                }}
              >
                SiteForge AI
              </p>
              <h1 className="mt-6 text-4xl font-bold leading-tight" style={{ color: "var(--sf-text)" }}>
                Start building websites with AI
              </h1>
              <p className="mt-3 max-w-md text-lg" style={{ color: "var(--sf-text-muted)" }}>
                Generate, edit and deploy your website instantly.
              </p>
            </div>

            <div className="relative mt-10 h-[30rem] min-h-[24rem] sm:h-[32rem]">
              {SERVICE_FEATURE_CARDS.map((card, i) => {
                const pos =
                  i === 0
                    ? "left-0 top-2 w-[80%] z-10"
                    : i === 1
                      ? "right-0 top-28 w-[76%] z-20"
                      : i === 2
                        ? "left-0 top-48 w-[80%] z-30"
                        : "right-0 bottom-2 w-[74%] z-40";
                const anim =
                  i === 0
                    ? ""
                    : i === 1
                      ? "sf-auth-mock-delay"
                      : i === 2
                        ? "sf-auth-mock-delay-2"
                        : "sf-auth-mock-delay-3";
                return (
                  <div key={card.title} className={`sf-auth-mock-card ${pos} ${anim}`.trim()}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
                      {card.title}
                    </p>
                    {i === 2 ? (
                      <>
                        <div
                          className="mt-2 h-14 rounded-lg sm:h-16"
                          style={{ background: "color-mix(in srgb, var(--sf-accent-from) 20%, transparent)" }}
                        />
                        <p
                          className="mt-2 text-[11px] leading-relaxed sm:text-xs"
                          style={{ color: "var(--sf-text)" }}
                        >
                          {card.description}
                        </p>
                      </>
                    ) : (
                      <p
                        className="mt-2 text-[11px] leading-relaxed sm:text-xs"
                        style={{ color: "var(--sf-text)" }}
                      >
                        {card.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="sf-auth-card w-full max-w-md rounded-3xl p-6 sm:p-8">
            <div className="sf-auth-tabs relative grid grid-cols-2 rounded-xl p-1">
              <span
                className={`sf-auth-tab-indicator ${tab === "signup" ? "translate-x-full" : "translate-x-0"}`}
              />
              <button
                type="button"
                onClick={() => setTab("signin")}
                className="relative z-10 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ color: tab === "signin" ? "white" : "var(--sf-text-muted)" }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className="relative z-10 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ color: tab === "signup" ? "white" : "var(--sf-text-muted)" }}
              >
                Sign Up
              </button>
            </div>

            <div className="relative mt-6 min-h-[430px]">
              <div className="rounded-2xl border p-5" style={{ borderColor: "var(--sf-border)" }}>
                <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                  {tab === "signin"
                    ? "Sign in to continue to your account."
                    : "Create your account instantly with Google."}
                </p>
                {entryMessage ? (
                  <p className="mt-3 text-sm" style={{ color: "var(--sf-accent-from)" }}>
                    {entryMessage}
                  </p>
                ) : null}
                {tab === "signup" && (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    className="mt-4 h-11 w-full rounded-xl border bg-transparent px-4 text-sm outline-none"
                    style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                  />
                )}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="mt-4 h-11 w-full rounded-xl border bg-transparent px-4 text-sm outline-none"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="mt-3 h-11 w-full rounded-xl border bg-transparent px-4 text-sm outline-none"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                />
                {tab === "signup" && (
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="mt-3 h-11 w-full rounded-xl border bg-transparent px-4 text-sm outline-none"
                    style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                  />
                )}
                <button
                  type="button"
                  onClick={handleEmailAuth}
                  disabled={busyEmail}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-65"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                >
                  {busyEmail ? "Continuing..." : tab === "signin" ? "Sign in" : "Create account"}
                </button>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={busyGoogle}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-65"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                >
                  <GoogleMark />
                  {busyGoogle ? "Continuing..." : "Continue with Google"}
                </button>
                {error && (
                  <p className="mt-3 text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}
                {info ? (
                  <p className="mt-3 text-sm" style={{ color: "var(--sf-accent-from)" }}>
                    {info}
                  </p>
                ) : null}
                {showResendVerification ? (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={busyResendVerification}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-65"
                    style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                  >
                    {busyResendVerification ? "Resending..." : "Resend verification email"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
