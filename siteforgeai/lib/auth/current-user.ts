import { cookies } from "next/headers";
import { FIREBASE_SESSION_COOKIE } from "@/lib/auth/server-session";
import { getOrCreateServerUser, verifySessionCookie } from "@/lib/auth/user-store";

export async function getCurrentServerUser() {
  const store = await cookies();
  const cookie = store.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await verifySessionCookie(cookie);
    return await getOrCreateServerUser(decoded);
  } catch {
    return null;
  }
}

export async function requireCurrentServerUser() {
  const user = await getCurrentServerUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
