"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { exampleReadUserProfile, exampleSignInWithEmail, exampleSignInWithGoogle, exampleSignOut, exampleSignUpWithEmail, exampleWriteUserProfile } from "@/lib/firebase/examples";
import { firebase } from "@/lib/firebase";

type Props = { className?: string };

export function FirebaseExampleUsage({ className }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    return onAuthStateChanged(firebase.auth, (u) => {
      setUser(u);
    });
  }, []);

  return (
    <div className={className} style={{ color: "var(--sf-text)" }}>
      <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
        Reference panel: email/password and Google auth, then Firestore read/write for the current UID.
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--sf-text-muted)" }}>
        Session: {user ? user.email ?? user.uid : "signed out"}
      </p>

      <div className="mt-3 flex max-w-sm flex-col gap-2">
        <input
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--sf-border)" }}
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--sf-border)" }}
          type="password"
          placeholder="password (min 6)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--sf-border)" }}
            onClick={async () => {
              setError(null);
              setLog(null);
              try {
                const cred = await exampleSignUpWithEmail(email, password);
                setLog(`signUp: ${cred.user.uid}`);
              } catch (e) {
                setError(e instanceof Error ? e.message : "signUp failed");
              }
            }}
          >
            Sign up (email)
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--sf-border)" }}
            onClick={async () => {
              setError(null);
              setLog(null);
              try {
                const cred = await exampleSignInWithEmail(email, password);
                setLog(`signIn: ${cred.user.uid}`);
              } catch (e) {
                setError(e instanceof Error ? e.message : "signIn failed");
              }
            }}
          >
            Sign in (email)
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--sf-border)" }}
            onClick={async () => {
              setError(null);
              setLog(null);
              try {
                const cred = await exampleSignInWithGoogle();
                setLog(`google: ${cred.user.uid}`);
              } catch (e) {
                setError(e instanceof Error ? e.message : "google failed");
              }
            }}
          >
            Google popup
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--sf-border)" }}
            onClick={async () => {
              setError(null);
              setLog(null);
              try {
                const u = firebase.auth.currentUser;
                if (!u) {
                  setError("Sign in first");
                  return;
                }
                await exampleWriteUserProfile(u.uid, { displayName: u.displayName || "User" });
                const d = await exampleReadUserProfile(u.uid);
                setLog(d ? `firestore: ${JSON.stringify(d)}` : "firestore: null");
              } catch (e) {
                setError(e instanceof Error ? e.message : "firestore failed");
              }
            }}
          >
            Read/write user doc
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--sf-border)" }}
            onClick={async () => {
              setError(null);
              setLog(null);
              try {
                await exampleSignOut();
                setLog("signed out");
              } catch (e) {
                setError(e instanceof Error ? e.message : "sign out failed");
              }
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
      {log && <p className="mt-1 font-mono text-xs opacity-80">{log}</p>}
    </div>
  );
}
