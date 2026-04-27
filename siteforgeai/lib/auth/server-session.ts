import { cookies } from "next/headers";
import { cache } from "react";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";

export const FIREBASE_SESSION_COOKIE = "siteforge_firebase_session";
const SESSION_EXPIRES_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export function getSessionCookieOptions() {
  return {
    name: FIREBASE_SESSION_COOKIE,
    maxAgeMs: SESSION_EXPIRES_MS,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: Math.floor(SESSION_EXPIRES_MS / 1000),
    },
  };
}

export const readVerifiedFirebaseSession = cache(async () => {
  const store = await cookies();
  const raw = store.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(raw, true);
    return decoded;
  } catch {
    return null;
  }
});
