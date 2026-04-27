import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseOptions } from "./config";

type Client = { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage };

let instance: Client | undefined;

function getClient(): Client {
  if (typeof window === "undefined") {
    throw new Error("Firebase can only be used in the browser (e.g. Client Components).");
  }
  if (!instance) {
    const app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseOptions());
    instance = {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      storage: getStorage(app),
    };
  }
  return instance;
}

export const firebase = {
  get app() {
    return getClient().app;
  },
  get auth() {
    return getClient().auth;
  },
  get db() {
    return getClient().db;
  },
  get storage() {
    return getClient().storage;
  },
} as const;

export { getClient as getFirebaseClient };
export { getFirebaseOptions } from "./config";
export type { FirebaseApp } from "firebase/app";
export type { Auth } from "firebase/auth";
export type { Firestore } from "firebase/firestore";
export type { FirebaseStorage } from "firebase/storage";
