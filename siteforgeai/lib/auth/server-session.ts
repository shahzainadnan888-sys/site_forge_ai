import { cache } from "react";
import { auth } from "@/auth";

/** Minimal session for server pages (preview / editor). */
export type AppSessionUser = {
  uid: string;
  email: string;
  email_verified: boolean;
};

export const readAppSession = cache(async (): Promise<AppSessionUser | null> => {
  const session = await auth();
  if (!session?.user?.email) return null;
  const uid =
    (typeof session.firestoreUid === "string" && session.firestoreUid.trim()) ||
    (typeof session.user.id === "string" && session.user.id.trim()) ||
    "";
  if (!uid) return null;
  return {
    uid,
    email: session.user.email.trim().toLowerCase(),
    email_verified: (session.user as unknown as { emailVerified?: boolean }).emailVerified === true,
  };
});

/** @deprecated Use {@link readAppSession}. Kept for gradual migration of imports. */
export const readVerifiedFirebaseSession = readAppSession;
