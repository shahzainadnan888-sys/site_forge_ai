"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { firebase } from "@/lib/firebase";
import { SITEFORGE_SESSION_EVENT } from "@/lib/siteforge-credits";
import { fileToResizedJpegDataUrl } from "@/lib/profile-avatar";

const SESSION_KEY = "siteforge-session";

type Session = {
  uid?: string;
  fullName?: string;
  email?: string;
  credits?: number;
  avatarDataUrl?: string;
  freeCreditsBlocked?: boolean;
} | null;
type MeResponse = {
  ok: boolean;
  user?: {
    uid: string;
    fullName: string;
    email: string;
    credits: number;
    avatarDataUrl?: string;
    freeCreditsBlocked?: boolean;
  };
};

function readSession(): Session {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

async function syncSessionFromServer(): Promise<Session> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as MeResponse | null;
    if (!res.ok || !data?.ok || !data.user) return null;
    const nextSession: Session = {
      uid: data.user.uid,
      fullName: data.user.fullName,
      email: data.user.email,
      credits: data.user.credits,
      freeCreditsBlocked: data.user.freeCreditsBlocked === true,
      ...(data.user.avatarDataUrl ? { avatarDataUrl: data.user.avatarDataUrl } : {}),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    return nextSession;
  } catch {
    return null;
  }
}

function initialsForSession(s: NonNullable<Session>) {
  const base = s.fullName?.trim() || s.email?.trim() || "U";
  const parts = base.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || "U").toUpperCase();
}

export function AccountView() {
  const router = useRouter();
  const [session, setSession] = useState<Session>(() => readSession());
  const [isHydratingSession, setIsHydratingSession] = useState(true);
  const [avatarError, setAvatarError] = useState("");
  const [avatarStatus, setAvatarStatus] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSession = useCallback(() => {
    setSession(readSession());
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await syncSessionFromServer();
      if (s) {
        setSession(s);
        window.dispatchEvent(new Event(SITEFORGE_SESSION_EVENT));
      }
      setIsHydratingSession(false);
    })();
  }, []);

  useEffect(() => {
    const onS = () => {
      if (!readSession()) {
        setSession(null);
        return;
      }
      refreshSession();
    };
    window.addEventListener(SITEFORGE_SESSION_EVENT, onS);
    window.addEventListener("storage", onS);
    return () => {
      window.removeEventListener(SITEFORGE_SESSION_EVENT, onS);
      window.removeEventListener("storage", onS);
    };
  }, [refreshSession]);

  const avatarLabel = useMemo(() => (session ? initialsForSession(session) : "U"), [session]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError("");
    setAvatarStatus("");
    try {
      const dataUrl = await fileToResizedJpegDataUrl(file);
      const res = await fetch("/api/auth/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDataUrl: dataUrl }),
      });
      if (!res.ok) {
        const details = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(details?.error || "Could not save profile photo.");
      }

      const synced = await syncSessionFromServer();
      if (synced) {
        setSession(synced);
        window.dispatchEvent(new Event(SITEFORGE_SESSION_EVENT));
      } else {
        refreshSession();
      }
      setAvatarStatus("Photo uploaded and saved to your account.");
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Could not use that file.");
    }
  };

  const onRemovePhoto = async () => {
    setAvatarError("");
    setAvatarStatus("");
    try {
      const res = await fetch("/api/auth/avatar", { method: "DELETE" });
      if (!res.ok) {
        const details = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(details?.error || "Could not remove profile photo.");
      }

      const synced = await syncSessionFromServer();
      if (synced) {
        setSession(synced);
        window.dispatchEvent(new Event(SITEFORGE_SESSION_EVENT));
      } else {
        refreshSession();
      }
      setAvatarStatus("Profile photo removed from your account.");
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Could not remove that photo.");
    }
  };

  const onStartEditingName = () => {
    setNameDraft(session?.fullName ?? "");
    setIsEditingName(true);
  };

  const onCancelEditingName = () => {
    setIsEditingName(false);
    setNameDraft("");
  };

  const onSaveName = async () => {
    const currentSession = readSession();
    if (!currentSession) return;
    const nextName = nameDraft.trim();
    if (!nextName) return;

    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: nextName }),
    });
    if (!res.ok) return;

    const nextSession = { ...currentSession, fullName: nextName };
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    window.dispatchEvent(new Event(SITEFORGE_SESSION_EVENT));
    setIsEditingName(false);
    refreshSession();
  };

  if (isHydratingSession) return null;
  if (!session) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      <div className="sf-glass rounded-3xl p-6 sm:p-8">
        <p
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
          style={{
            borderColor: "var(--sf-border)",
            color: "var(--sf-accent-from)",
            background: "color-mix(in srgb, var(--sf-accent-from) 10%, transparent)",
          }}
        >
          Account
        </p>
        <h1 className="mt-4 text-3xl font-bold" style={{ color: "var(--sf-text)" }}>
          Your Profile
        </h1>
        <p className="mt-2 text-sm sm:text-base" style={{ color: "var(--sf-text-muted)" }}>
          Manage your SiteForge AI profile and current credit balance.
        </p>

        <div
          className="mt-8 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-6"
          style={{ borderColor: "var(--sf-border)" }}
        >
          <div
            className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-full border sm:mx-0"
            style={{ borderColor: "var(--sf-border)" }}
          >
            {session.avatarDataUrl ? (
              <img
                src={session.avatarDataUrl}
                alt="Your profile"
                className="h-full w-full object-cover"
                width={112}
                height={112}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-2xl font-bold"
                style={{
                  color: "var(--sf-text)",
                  background: "linear-gradient(135deg, color-mix(in srgb, var(--sf-accent-from) 30%, var(--sf-card)), color-mix(in srgb, var(--sf-accent-to) 30%, var(--sf-card)))",
                }}
              >
                {avatarLabel}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
              Profile picture
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onFileChange}
            />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition hover:opacity-90"
                style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
              >
                Upload photo
              </button>
              {session.avatarDataUrl && (
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-transparent px-4 text-sm font-semibold text-red-500 transition hover:bg-red-500/10"
                >
                  Remove
                </button>
              )}
            </div>
            {avatarError && (
              <p className="mt-2 text-sm text-red-500" role="alert">
                {avatarError}
              </p>
            )}
            {avatarStatus && <p className="mt-2 text-sm" style={{ color: "var(--sf-accent-from)" }}>{avatarStatus}</p>}
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--sf-border)" }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
              Full name
            </p>
            {isEditingName ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-xl border bg-transparent px-3 text-sm font-medium"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                  placeholder="Enter your full name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveName();
                    if (e.key === "Escape") onCancelEditingName();
                  }}
                />
                <button
                  type="button"
                  onClick={onSaveName}
                  className="inline-flex h-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition hover:opacity-90"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEditingName}
                  className="inline-flex h-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition hover:opacity-90"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-base font-semibold" style={{ color: "var(--sf-text)" }}>
                  {session.fullName || "Not set"}
                </p>
                <button
                  type="button"
                  onClick={onStartEditingName}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm transition hover:opacity-90"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}
                  aria-label="Edit full name"
                  title="Edit full name"
                >
                  ✎
                </button>
              </div>
            )}
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--sf-border)" }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
              Email
            </p>
            <p className="mt-1 break-all text-base font-semibold" style={{ color: "var(--sf-text)" }}>
              {session.email || "Not set"}
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--sf-border)" }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
              Credits
            </p>
            <p className="mt-1 text-base font-semibold" style={{ color: "var(--sf-accent-from)" }}>
              {typeof session.credits === "number" ? session.credits : 0}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="sf-cta-glow inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))" }}
          >
            Go to dashboard
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST" });
              } catch {
                // Ignore logout API failures and still clear local auth state.
              }
              const auth = firebase.auth;
              if (auth) {
                await signOut(auth).catch(() => {
                  // Ignore local Firebase signout errors on this device.
                });
              }
              localStorage.removeItem(SESSION_KEY);
              window.dispatchEvent(new Event(SITEFORGE_SESSION_EVENT));
              router.push("/get-started");
            }}
            className="inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-semibold"
            style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
}
