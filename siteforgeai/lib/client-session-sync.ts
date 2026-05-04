import { emitSiteforgeSessionUpdate } from "@/lib/siteforge-credits";

const SESSION_KEY = "siteforge-session";

/**
 * Pulls the latest profile (including credits) from `/api/auth/me` into `siteforge-session`.
 * Call after sign-in or when the UI should match Firestore (e.g. navbar).
 */
export async function syncSessionCreditsFromServer(): Promise<number | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as
      | {
          ok: true;
          user: {
            uid: string;
            credits: number;
            fullName: string;
            email: string;
            avatarDataUrl?: string;
            freeCreditsBlocked?: boolean;
          };
        }
      | { ok: false; error?: string }
      | null;
    if (!res.ok || !data || !data.ok) return null;
    const currentRaw = localStorage.getItem(SESSION_KEY);
    const current = currentRaw ? (JSON.parse(currentRaw) as Record<string, unknown>) : {};
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        ...current,
        uid: data.user.uid,
        fullName: data.user.fullName,
        email: data.user.email,
        credits: data.user.credits,
        freeCreditsBlocked: data.user.freeCreditsBlocked === true,
        ...(data.user.avatarDataUrl ? { avatarDataUrl: data.user.avatarDataUrl } : {}),
      })
    );
    emitSiteforgeSessionUpdate();
    return data.user.credits;
  } catch {
    return null;
  }
}
