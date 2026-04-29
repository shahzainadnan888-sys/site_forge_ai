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

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: requiredEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: getPrivateKey(),
    }),
  });

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
