import type { Session } from "next-auth";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { authLogger } from "@/lib/auth/auth-logger";
import { getOrCreateServerUser, type ServerUser } from "@/lib/auth/user-store";
import { adminDb } from "@/lib/firebase/admin";

const VERIFIED_EMAILS_COLLECTION = "verifiedEmails";

async function isOtpVerifiedEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;
  try {
    const doc = await adminDb.collection(VERIFIED_EMAILS_COLLECTION).doc(normalizedEmail).get();
    return doc.exists;
  } catch {
    return false;
  }
}

export type CurrentServerUser = ServerUser & {
  emailVerified: boolean;
};

/** Returned with 401 from `/api/auth/me` when Google session exists but Firestore Admin cannot read/write. */
export type ServerUserSyncError = "firestore_permission_denied" | "unknown";

function sessionUid(session: Session): string {
  const fromCustom = typeof session.firestoreUid === "string" ? session.firestoreUid.trim() : "";
  const fromUser = typeof session.user?.id === "string" ? session.user.id.trim() : "";
  return fromCustom || fromUser;
}

/**
 * Builds the SiteForge user from an Auth.js session (Firestore profile).
 * Prefer passing `session` from `auth((req) => …)` / `req.auth` in Route Handlers so cookies are always in scope.
 */
export async function resolveCurrentServerUserFromSession(session: Session | null): Promise<{
  user: CurrentServerUser | null;
  syncError?: ServerUserSyncError;
}> {
  if (!session?.user?.email) {
    authLogger.debug("getCurrentServerUserFromSession: no session or missing user.email");
    return { user: null };
  }
  const uid = sessionUid(session);
  if (!uid) {
    authLogger.warn("getCurrentServerUserFromSession: session missing firestoreUid and user.id", {
      email: session.user.email,
    });
    return { user: null };
  }
  const email = session.user.email.trim().toLowerCase();
  const emailVerified =
    (session.user as unknown as { emailVerified?: boolean }).emailVerified === true;
  try {
    const user = await getOrCreateServerUser({
      uid,
      email,
      name: session.user.name || undefined,
      email_verified: emailVerified,
    });
    const otpVerified = await isOtpVerifiedEmail(user.email).catch(() => false);
    return {
      user: {
        ...user,
        emailVerified: emailVerified || otpVerified,
      } satisfies CurrentServerUser,
    };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    authLogger.warn("getCurrentServerUserFromSession: getOrCreateServerUser failed (session cookie ok; Firestore or Admin config may be wrong)", {
      uid,
      email,
      message: e.message,
      name: e.name,
    });
    const syncError: ServerUserSyncError = e.message.includes("PERMISSION_DENIED")
      ? "firestore_permission_denied"
      : "unknown";
    return { user: null, syncError };
  }
}

export async function getCurrentServerUserFromSession(session: Session | null): Promise<CurrentServerUser | null> {
  return (await resolveCurrentServerUserFromSession(session)).user;
}

export async function getCurrentServerUser() {
  await headers();
  const session = await auth();
  return getCurrentServerUserFromSession(session);
}

export async function requireCurrentServerUserFromSession(session: Session | null) {
  const user = await getCurrentServerUserFromSession(session);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
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
