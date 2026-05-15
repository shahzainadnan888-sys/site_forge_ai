import { createHash, randomInt } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

const OTP_DOCS = "siteforge_signup_otps";
const VERIFIED = "siteforge_signup_verified";

const OTP_TTL_MS = 15 * 60 * 1000;

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

function docIdForEmail(email: string): string {
  const n = normEmail(email);
  return createHash("sha256").update(n, "utf8").digest("hex").slice(0, 48);
}

function otpPepper(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.OTP_PEPPER?.trim() ||
    "dev-otp-pepper-unsafe"
  );
}

export function hashSignupOtp(email: string, code: string): string {
  return createHash("sha256").update(`${otpPepper()}:${normEmail(email)}:${code}`, "utf8").digest("hex");
}

export function generateSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function saveSignupOtpRequest(email: string, fullName: string, codeHash: string): Promise<void> {
  const id = docIdForEmail(email);
  const expiresAt = Timestamp.fromMillis(Date.now() + OTP_TTL_MS);
  await adminDb.collection(OTP_DOCS).doc(id).set({
    email: normEmail(email),
    fullName: fullName.trim(),
    codeHash,
    expiresAt,
    attempts: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function verifySignupOtpAndMarkVerified(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const clean = normEmail(email);
  const id = docIdForEmail(clean);
  const ref = adminDb.collection(OTP_DOCS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: "No verification code pending for this email. Request a new code." };
  }
  const data = snap.data() as {
    codeHash?: string;
    expiresAt?: Timestamp;
    attempts?: number;
    fullName?: string;
  };
  const exp = data.expiresAt?.toMillis() ?? 0;
  if (exp < Date.now()) {
    await ref.delete();
    return { ok: false, error: "Code expired. Request a new verification code." };
  }
  const attempts = typeof data.attempts === "number" ? data.attempts : 0;
  if (attempts >= 8) {
    await ref.delete();
    return { ok: false, error: "Too many attempts. Request a new verification code." };
  }
  const expected = data.codeHash;
  const got = hashSignupOtp(clean, code.replace(/\D/g, "").slice(0, 6));
  if (!expected || got !== expected) {
    await ref.update({ attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    return { ok: false, error: "Invalid verification code." };
  }
  const fullName = typeof data.fullName === "string" && data.fullName.trim() ? data.fullName.trim() : "User";
  await ref.delete();
  await adminDb
    .collection(VERIFIED)
    .doc(id)
    .set({
      email: clean,
      fullName,
      verifiedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
    });
  return { ok: true };
}

export async function isSignupEmailVerified(email: string): Promise<boolean> {
  const id = docIdForEmail(email);
  const snap = await adminDb.collection(VERIFIED).doc(id).get();
  if (!snap.exists) return false;
  const data = snap.data() as { expiresAt?: Timestamp };
  const exp = data.expiresAt?.toMillis() ?? 0;
  if (exp < Date.now()) {
    await adminDb.collection(VERIFIED).doc(id).delete();
    return false;
  }
  return true;
}

export async function deleteSignupVerified(email: string): Promise<void> {
  const id = docIdForEmail(email);
  await adminDb.collection(VERIFIED).doc(id).delete().catch(() => undefined);
}
