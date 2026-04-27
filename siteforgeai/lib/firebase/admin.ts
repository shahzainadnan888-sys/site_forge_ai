import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

function readRequired(name: "FIREBASE_PROJECT_ID" | "FIREBASE_CLIENT_EMAIL" | "FIREBASE_PRIVATE_KEY") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to your .env.local and restart the dev server.`);
  }
  return value;
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const projectId = readRequired("FIREBASE_PROJECT_ID");
  const clientEmail = readRequired("FIREBASE_CLIENT_EMAIL");
  const privateKey = readRequired("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function getFirebaseAdminAuth() {
  return getAuth(getAdminApp());
}

/** Default bucket: FIREBASE_STORAGE_BUCKET, else `<projectId>.appspot.com`. */
export function getFirebaseAdminBucket() {
  const app = getAdminApp();
  const explicit = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (explicit) {
    return getStorage(app).bucket(explicit);
  }
  return getStorage(app).bucket();
}
