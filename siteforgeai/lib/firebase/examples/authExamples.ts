import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { firebase } from "../index";

export async function exampleSignUpWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(firebase.auth, email, password);
}

export async function exampleSignInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(firebase.auth, email, password);
}

export async function exampleSignInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(firebase.auth, provider);
}

export async function exampleSignOut(): Promise<void> {
  return signOut(firebase.auth);
}
