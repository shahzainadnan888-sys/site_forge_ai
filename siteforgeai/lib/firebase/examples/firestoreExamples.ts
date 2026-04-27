import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { firebase } from "../index";

const USERS = "users";

export async function exampleWriteUserProfile(
  userId: string,
  data: { displayName: string }
): Promise<void> {
  const ref = doc(firebase.db, USERS, userId);
  await setDoc(
    ref,
    {
      displayName: data.displayName,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function exampleReadUserProfile(userId: string): Promise<DocumentData | null> {
  const ref = doc(firebase.db, USERS, userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
