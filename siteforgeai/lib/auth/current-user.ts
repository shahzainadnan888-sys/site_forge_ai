import { cookies } from "next/headers";
import { FIREBASE_SESSION_COOKIE } from "@/lib/auth/server-session";
import { getOrCreateServerUser, type ServerUser, verifySessionCookie } from "@/lib/auth/user-store";
import { adminDb } from "@/lib/firebase/admin";

const VERIFIED_EMAILS_COLLECTION = "verifiedEmails";

async function isOtpVerifiedEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;
  const doc = await adminDb.collection(VERIFIED_EMAILS_COLLECTION).doc(normalizedEmail).get();
  return doc.exists;
}

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
    const otpVerified = await isOtpVerifiedEmail(user.email).catch(() => false);
    return {
      ...user,
      emailVerified: decoded.email_verified === true || otpVerified,
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
