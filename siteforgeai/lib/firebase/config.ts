import type { FirebaseOptions } from "firebase/app";

function trimOrEmpty(v: string | undefined): string {
  return v == null ? "" : String(v).trim();
}

export function getFirebaseOptions(): FirebaseOptions {
  const apiKey = trimOrEmpty(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const authDomain = trimOrEmpty(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const projectId = trimOrEmpty(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const storageBucket = trimOrEmpty(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = trimOrEmpty(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
  const appId = trimOrEmpty(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
  const measurementId = trimOrEmpty(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);

  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY. Add it to .env.local and restart the dev server.");
  }
  if (!authDomain) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN. Add it to .env.local and restart the dev server.");
  }
  if (!projectId) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID. Add it to .env.local and restart the dev server.");
  }
  if (!storageBucket) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET. Add it to .env.local and restart the dev server.");
  }
  if (!messagingSenderId) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID. Add it to .env.local and restart the dev server.");
  }
  if (!appId) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_APP_ID. Add it to .env.local and restart the dev server.");
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    ...(measurementId ? { measurementId } : {}),
  };
}
