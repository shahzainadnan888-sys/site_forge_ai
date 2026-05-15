"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
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

/**
 * After NextAuth (e.g. Google OAuth redirect), sync `/api/auth/me` into `localStorage`
 * so existing client UI that reads `siteforge-session` stays consistent.
 */
export function AuthSessionBootstrap() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      try {
        if (localStorage.getItem(SESSION_KEY)) {
          localStorage.removeItem(SESSION_KEY);
          emitSiteforgeSessionUpdate();
        }
      } catch {
        // ignore
      }
      return;
    }
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        const me = (await meRes.json().catch(() => null)) as MeResponse | null;
        if (cancelled) return;
        if (meRes.status === 401 || meRes.status === 403 || !meRes.ok || !me?.ok || !me.user) {
          if (meRes.status === 401 || meRes.status === 403) {
            localStorage.removeItem(SESSION_KEY);
            emitSiteforgeSessionUpdate();
          }
          return;
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
        router.refresh();
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  return null;
}
