import "@/lib/auth/bootstrap-auth-env";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local.`);
  }
  return value;
}

function getPrivateKey(): string {
  return requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

const firebaseProjectId = requiredEnv("FIREBASE_PROJECT_ID");
const firebaseClientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");
const firebasePrivateKey = getPrivateKey();

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: firebaseProjectId,
      clientEmail: firebaseClientEmail,
      privateKey: firebasePrivateKey,
    }),
  });

const publicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
if (publicProjectId && publicProjectId !== firebaseProjectId && process.env.NODE_ENV === "development") {
  console.warn(
    `[SiteForge] FIREBASE_PROJECT_ID (${firebaseProjectId}) does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID (${publicProjectId}). The Admin SDK uses FIREBASE_PROJECT_ID; a mismatch often causes PERMISSION_DENIED or wrong data.`
  );
}

/** Firestore + Firebase Auth (email/password sign-up). */
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
