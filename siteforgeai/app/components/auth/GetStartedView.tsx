"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { SERVICE_FEATURE_CARDS } from "@/lib/service-feature-cards";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_SECONDS = 15 * 60;

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden focusable="false">
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

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12S5.25 5.25 12 5.25 21.75 12 21.75 12 18.75 18.75 12 18.75 2.25 12 2.25 12z" />
        <circle cx="12" cy="12" r="3.25" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58A3.25 3.25 0 0013.42 13.42" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 5.55A10.58 10.58 0 0112 5.25c6.75 0 9.75 6.75 9.75 6.75a17.9 17.9 0 01-3.22 4.67M6.53 6.53A17.8 17.8 0 002.25 12s3 6.75 9.75 6.75a10.8 10.8 0 005.47-1.47" />
    </svg>
  );
}

export function GetStartedView() {
  return (
    <Suspense fallback={null}>
      <GetStartedViewInner />
    </Suspense>
  );
}

type ProfileSyncState = "idle" | "opening" | "ready" | "pending";
type AuthTab = "signin" | "signup";
type SignupStep = "details" | "otp";

function GetStartedViewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [tab, setTab] = useState<AuthTab>("signin");
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [busyCredentials, setBusyCredentials] = useState(false);
  const [error, setError] = useState("");
  const [profileSync, setProfileSync] = useState<ProfileSyncState>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupStep, setSignupStep] = useState<SignupStep>("details");
  const [otp, setOtp] = useState("");
  const [otpRemainingSec, setOtpRemainingSec] = useState(0);
  const [info, setInfo] = useState("");
  const [busySendOtp, setBusySendOtp] = useState(false);
  const [busyVerifyOtp, setBusyVerifyOtp] = useState(false);
  const [busyResendOtp, setBusyResendOtp] = useState(false);
  const entryMessage = searchParams.get("message")?.trim() || "";
  const authCallbackError = searchParams.get("error")?.trim() || "";

  useEffect(() => {
    if (authCallbackError === "Configuration") {
      setError(
        "Sign-in is not fully configured on the server. Use email and password, or set AUTH_SECRET and Google OAuth credentials in the deployment environment."
      );
    }
  }, [authCallbackError]);

  useEffect(() => {
    if (signupStep !== "otp" || otpRemainingSec <= 0) return;
    const id = window.setInterval(() => {
      setOtpRemainingSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [signupStep, otpRemainingSec]);

  useEffect(() => {
    if (status !== "authenticated") {
      setProfileSync("idle");
      return;
    }
    let cancelled = false;
    setProfileSync("opening");
    void (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (cancelled) return;
      if (res.ok && data?.ok) {
        setProfileSync("ready");
        router.replace("/dashboard");
        return;
      }
      setProfileSync("pending");
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  const handleContinueWithGoogle = async () => {
    setBusyGoogle(true);
    setError("");
    try {
      const hint = email.trim().toLowerCase();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      await signIn("google", {
        callbackUrl: origin ? `${origin}/dashboard` : "/dashboard",
        ...(hint && EMAIL_REGEX.test(hint) ? { login_hint: hint } : {}),
      });
    } catch (e) {
      const err = e as Error;
      setError(err.message || "Unable to continue with Google sign-in.");
    } finally {
      setBusyGoogle(false);
    }
  };

  const handleEmailPasswordSignIn = async () => {
    setError("");
    setInfo("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    setBusyCredentials(true);
    try {
      const res = await signIn("credentials", {
        email: cleanEmail,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("No account found, or the password is incorrect.");
        return;
      }
      router.replace("/dashboard");
    } catch (e) {
      const err = e as Error;
      setError(err.message || "Sign-in failed.");
    } finally {
      setBusyCredentials(false);
    }
  };

  const validateSignupDetailsForOtp = (): boolean => {
    setError("");
    setInfo("");
    if (!fullName.trim()) {
      setError("Full name is required.");
      return false;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleSendSignupOtp = async () => {
    if (!validateSignupDetailsForOtp()) return;
    setBusySendOtp(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/send-signup-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          password,
          confirmPassword,
        }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not send verification email.");
        return;
      }
      setSignupStep("otp");
      setOtpRemainingSec(OTP_SECONDS);
      setOtp("");
      setInfo("A verification code has been sent to this email.");
    } finally {
      setBusySendOtp(false);
    }
  };

  const handleVerifyOtpAndCompleteSignup = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.replace(/\D/g, "").slice(0, 6);
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError("Invalid email.");
      return;
    }
    if (cleanOtp.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusyVerifyOtp(true);
    setError("");
    setInfo("");
    try {
      const verifyRes = await fetch("/api/auth/verify-signup-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
        credentials: "include",
      });
      const verifyData = (await verifyRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!verifyRes.ok || !verifyData?.ok) {
        setError(verifyData?.error || "Verification failed.");
        return;
      }
      const completeRes = await fetch("/api/auth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          fullName: fullName.trim(),
        }),
        credentials: "include",
      });
      const completeData = (await completeRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!completeRes.ok || !completeData?.ok) {
        setError(completeData?.error || "Could not finish creating your account.");
        return;
      }
      const sessionRes = await signIn("credentials", {
        email: cleanEmail,
        password,
        redirect: false,
      });
      if (sessionRes?.error) {
        setError("Account created, but sign-in failed. Try signing in with your email and password.");
        return;
      }
      router.replace("/dashboard");
    } finally {
      setBusyVerifyOtp(false);
    }
  };

  const handleResendSignupOtp = async () => {
    if (busyResendOtp) return;
    if (!validateSignupDetailsForOtp()) return;
    setBusyResendOtp(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-signup-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          password,
          confirmPassword,
        }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not resend code.");
        return;
      }
      setOtpRemainingSec(OTP_SECONDS);
      setOtp("");
      setInfo("A new code was sent to your email.");
    } finally {
      setBusyResendOtp(false);
    }
  };

  const sessionBusy = profileSync === "opening" || profileSync === "ready";
  const otpExpired = signupStep === "otp" && otpRemainingSec <= 0;
  const signInFormBusy = sessionBusy || busyCredentials || busyGoogle || busySendOtp || busyVerifyOtp || busyResendOtp;
  const googleButtonBusy = sessionBusy || busyGoogle || busyCredentials;
  const signupDetailsBusy = sessionBusy || busySendOtp || busyVerifyOtp || busyResendOtp;
  const signupOtpBusy = sessionBusy || busySendOtp || busyVerifyOtp || busyResendOtp;

  const googleButtonLabel = busyGoogle ? "Continuing..." : "Continue with Google";

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
                        <p className="mt-2 text-[11px] leading-relaxed sm:text-xs" style={{ color: "var(--sf-text)" }}>
                          {card.description}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-[11px] leading-relaxed sm:text-xs" style={{ color: "var(--sf-text)" }}>
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
                onClick={() => {
                  setTab("signin");
                  setError("");
                  setInfo("");
                  setFullName("");
                  setConfirmPassword("");
                  setSignupStep("details");
                  setOtp("");
                  setOtpRemainingSec(0);
                }}
                className="relative z-10 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ color: tab === "signin" ? "white" : "var(--sf-text-muted)" }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("signup");
                  setError("");
                  setInfo("");
                  setSignupStep("details");
                  setOtp("");
                  setOtpRemainingSec(0);
                }}
                className="relative z-10 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ color: tab === "signup" ? "white" : "var(--sf-text-muted)" }}
              >
                Sign Up
              </button>
            </div>

            <div className="relative mt-6 min-h-[430px]">
              <div className="sf-elevate rounded-2xl border p-5" style={{ borderColor: "var(--sf-border)" }}>
                <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                  {tab === "signin"
                    ? "Sign in to continue to your account."
                    : signupStep === "otp"
                      ? "Enter the verification code we emailed you."
                      : "Create your account. We will email a code to verify your address."}
                </p>
                {entryMessage ? (
                  <p className="mt-3 text-sm" style={{ color: "var(--sf-accent-from)" }}>
                    {entryMessage}
                  </p>
                ) : null}

                {tab === "signin" ? (
                  <>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      autoComplete="email"
                      className="mt-4 h-11 w-full rounded-xl border bg-transparent px-4 text-sm outline-none"
                      style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                    />
                    <div className="relative mt-3">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="current-password"
                        className="h-11 w-full rounded-xl border bg-transparent px-4 pr-11 text-sm outline-none"
                        style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: "var(--sf-text-muted)" }}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleEmailPasswordSignIn()}
                      disabled={signInFormBusy}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-65"
                      style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                    >
                      {busyCredentials ? "Signing in..." : "Sign in"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleContinueWithGoogle()}
                      disabled={googleButtonBusy}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-65"
                      style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                    >
                      <GoogleMark />
                      {googleButtonLabel}
                    </button>
                  </>
                ) : signupStep === "details" ? (
                    <>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Full name"
                        autoComplete="name"
                        className="mt-4 h-11 w-full rounded-xl border bg-transparent px-4 text-sm outline-none"
                        style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        autoComplete="email"
                        className="mt-3 h-11 w-full rounded-xl border bg-transparent px-4 text-sm outline-none"
                        style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                      />
                      <div className="relative mt-3">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          autoComplete="new-password"
                          className="h-11 w-full rounded-xl border bg-transparent px-4 pr-11 text-sm outline-none"
                          style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--sf-text-muted)" }}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          <EyeIcon open={showPassword} />
                        </button>
                      </div>
                      <div className="relative mt-3">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm password"
                          autoComplete="new-password"
                          className="h-11 w-full rounded-xl border bg-transparent px-4 pr-11 text-sm outline-none"
                          style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--sf-text-muted)" }}
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          <EyeIcon open={showConfirmPassword} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSendSignupOtp()}
                        disabled={signupDetailsBusy}
                        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-65"
                        style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                      >
                        {busySendOtp ? "Sending..." : "Create account"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="mt-4 text-xs" style={{ color: "var(--sf-text-muted)" }}>
                        Code sent to <span style={{ color: "var(--sf-text)" }}>{email}</span>
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs font-medium">
                        <span style={{ color: otpExpired ? "#f87171" : "var(--sf-accent-from)" }}>
                          {otpExpired ? "Code expired" : `Expires in ${formatMmSs(otpRemainingSec)}`}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6-digit code"
                        disabled={otpExpired}
                        className="mt-3 h-11 w-full rounded-xl border bg-transparent px-4 text-sm outline-none tracking-[0.35em]"
                        style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                        inputMode="numeric"
                        maxLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => void handleVerifyOtpAndCompleteSignup()}
                        disabled={signupOtpBusy || otpExpired}
                        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-65"
                        style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                      >
                        {busyVerifyOtp ? "Finishing..." : "Verify and continue"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleResendSignupOtp()}
                        disabled={busyResendOtp || busyVerifyOtp}
                        className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-65"
                        style={{
                          borderColor: "var(--sf-accent-from)",
                          color: "var(--sf-accent-from)",
                          background: "color-mix(in srgb, var(--sf-accent-from) 12%, transparent)",
                        }}
                      >
                        {busyResendOtp ? "Sending..." : "Resend code"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSignupStep("details");
                          setOtp("");
                          setOtpRemainingSec(0);
                          setError("");
                          setInfo("");
                        }}
                        disabled={busyVerifyOtp || busyResendOtp}
                        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-65"
                        style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}
                      >
                        Back
                      </button>
                    </>
                  )}

                {info ? (
                  <p className="mt-3 text-sm" style={{ color: "var(--sf-accent-from)" }}>
                    {info}
                  </p>
                ) : null}

                {error ? (
                  <p className="mt-3 text-sm text-red-500" role="alert">
                    {error}
                  </p>
                ) : null}

                {profileSync === "opening" || profileSync === "ready" ? (
                  <p className="mt-4 text-sm" style={{ color: "var(--sf-text-muted)" }}>
                    Opening your dashboard…
                  </p>
                ) : null}

                {profileSync === "pending" ? (
                  <div className="mt-4 space-y-3 text-sm" style={{ color: "var(--sf-text-muted)" }}>
                    <p>You are signed in, but we could not finish loading your workspace yet.</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                        style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                        onClick={() => window.location.reload()}
                      >
                        Refresh page
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                        style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                        onClick={() => void signOut({ callbackUrl: "/get-started" })}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
