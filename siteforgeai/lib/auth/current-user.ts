import { cookies } from "next/headers";
import { FIREBASE_SESSION_COOKIE } from "@/lib/auth/server-session";
import { getOrCreateServerUser, type ServerUser, verifySessionCookie } from "@/lib/auth/user-store";

export type CurrentServerUser = ServerUser & {
  emailVerified: boolean;
};

export async function getCurrentServerUser() {
  const store = await cookies();
  const cookie = store.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await verifySessionCookie(cookie);
    const user = await getOrCreateServerUser(decoded);
    return {
      ...user,
      emailVerified: decoded.email_verified === true,
    } satisfies CurrentServerUser;
  } catch {
    return null;
  }
}

export async function requireCurrentServerUser() {
  const user = await getCurrentServerUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireVerifiedServerUser() {
  const user = await requireCurrentServerUser();
  if (!user.emailVerified) throw new Error("UNVERIFIED_EMAIL");
  return user;
}
