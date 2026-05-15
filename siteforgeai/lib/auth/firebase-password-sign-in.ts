/**
 * Verify email/password using Firebase Auth REST API (same project as Admin SDK).
 */
export type FirebasePasswordSignInResult =
  | { ok: true; uid: string; email: string; displayName?: string }
  | { ok: false; error: "invalid_credentials" | "no_api_key" | "network" };

export async function signInWithEmailPasswordFirebase(
  email: string,
  password: string
): Promise<FirebasePasswordSignInResult> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "no_api_key" };
  }
  const clean = email.trim().toLowerCase();
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, password, returnSecureToken: true }),
      }
    );
    const data = (await res.json()) as {
      localId?: string;
      email?: string;
      displayName?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.localId) {
      return { ok: false, error: "invalid_credentials" };
    }
    return {
      ok: true,
      uid: data.localId,
      email: (data.email || clean).trim().toLowerCase(),
      ...(typeof data.displayName === "string" && data.displayName.trim()
        ? { displayName: data.displayName.trim() }
        : {}),
    };
  } catch {
    return { ok: false, error: "network" };
  }
}
