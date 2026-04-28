/** Fields used from a session / admin user when syncing the Firestore profile. */
export type ServerUserAuthInput = {
  uid: string;
  email?: string;
  name?: string;
};

import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { DEFAULT_SIGNUP_CREDITS } from "@/lib/credit-economy";
import {
  buildDeviceFingerprint,
  type DeviceContext,
  getRequestClientIp,
  isDeviceAlreadyClaimedInTransaction,
  writeDeviceFreeCreditLog,
} from "@/lib/auth/free-credit-claims";

const USERS_COLLECTION = "siteforgeUsers";
const BONUS_ACCOUNT_EMAIL = "shahzainadnan1010@gmail.com";
const BONUS_ACCOUNT_CREDITS = 10_000;

export type ServerUser = {
  uid: string;
  email: string;
  fullName: string;
  credits: number;
  avatarDataUrl?: string;
  /** True after signup has resolved the one-time free-credit offer (granted or blocked). */
  freeCreditsClaimed: boolean;
  /** True when the user was not given free signup credits (duplicate IP already claimed offer). */
  freeCreditsBlocked: boolean;
  signupIpAddress?: string;
  /** Legacy fields; no longer set on new signups. */
  deviceFingerprint?: string;
  deviceId?: string;
};

export type GetOrCreateServerUserOptions = {
  request?: Request;
  deviceContext?: DeviceContext;
};

function isBonusAccountEmail(email: string) {
  return email.toLowerCase() === BONUS_ACCOUNT_EMAIL;
}

function getInitialCreditsForEmail(email: string): number {
  return isBonusAccountEmail(email) ? BONUS_ACCOUNT_CREDITS : DEFAULT_SIGNUP_CREDITS;
}

function normalizeServerUser(uid: string, raw: Record<string, unknown>): ServerUser {
  const email = String(raw.email ?? "").trim().toLowerCase();
  const hasExplicitClaim = typeof raw.freeCreditsClaimed === "boolean";
  return {
    uid,
    email,
    fullName: String(raw.fullName ?? "").trim() || "User",
    credits: (() => {
      const c = raw.credits;
      if (typeof c !== "number" || !Number.isFinite(c)) return 0;
      return Math.max(0, Math.min(1_000_000_000, Math.floor(c)));
    })(),
    freeCreditsClaimed: hasExplicitClaim
      ? (raw.freeCreditsClaimed as boolean)
      : true,
    freeCreditsBlocked: typeof raw.freeCreditsBlocked === "boolean" ? raw.freeCreditsBlocked : false,
    ...(typeof raw.signupIpAddress === "string" && raw.signupIpAddress
      ? { signupIpAddress: raw.signupIpAddress }
      : {}),
    ...(typeof raw.deviceFingerprint === "string" && raw.deviceFingerprint
      ? { deviceFingerprint: raw.deviceFingerprint }
      : {}),
    ...(typeof raw.deviceId === "string" && raw.deviceId ? { deviceId: raw.deviceId } : {}),
    ...(typeof raw.avatarDataUrl === "string" ? { avatarDataUrl: raw.avatarDataUrl } : {}),
  };
}

export async function verifySessionCookie(cookieValue: string) {
  return getFirebaseAdminAuth().verifySessionCookie(cookieValue, true);
}

export async function getOrCreateServerUser(
  decoded: ServerUserAuthInput,
  options?: GetOrCreateServerUserOptions
): Promise<ServerUser> {
  const db = getFirestore();
  const uid = decoded.uid;
  const email = (decoded.email || "").trim().toLowerCase();
  if (!email) throw new Error("Authenticated Firebase user has no email.");

  const fallbackName =
    (typeof decoded.name === "string" && decoded.name.trim()) ||
    (email.split("@")[0] || "User");

  const ref = db.collection(USERS_COLLECTION).doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    return normalizeServerUser(uid, (snap.data() ?? {}) as Record<string, unknown>);
  }

  const now = Date.now();
  const request = options?.request;
  const deviceFingerprint = request
    ? buildDeviceFingerprint({ request, deviceContext: options?.deviceContext })
    : null;
  const clientIp = request ? getRequestClientIp(request) : "unknown";

  return db.runTransaction(async (tx) => {
    const inTx = await tx.get(ref);
    const current = inTx.exists
      ? normalizeServerUser(uid, (inTx.data() ?? {}) as Record<string, unknown>)
      : null;

    // Bonus account keeps its fixed large balance behavior.
    if (isBonusAccountEmail(email)) {
      const credits = current ? current.credits : BONUS_ACCOUNT_CREDITS;
      const next: ServerUser = {
        uid,
        email,
        fullName: current?.fullName || fallbackName,
        credits,
        freeCreditsClaimed: true,
        freeCreditsBlocked: false,
        signupIpAddress: current?.signupIpAddress || clientIp,
      };
      tx.set(
        ref,
        {
          email: next.email,
          fullName: next.fullName,
          credits: next.credits,
          freeCreditsClaimed: true,
          freeCreditsBlocked: false,
          signupIpAddress: next.signupIpAddress,
          ...(current ? {} : { createdAt: now }),
          updatedAt: now,
        },
        { merge: true }
      );
      return next;
    }

    let grantApplied = false;
    if (deviceFingerprint) {
      const alreadyClaimed = await isDeviceAlreadyClaimedInTransaction(tx, deviceFingerprint);
      if (!alreadyClaimed) {
        grantApplied = true;
        writeDeviceFreeCreditLog(tx, deviceFingerprint, uid, true);
      }
    }

    const baseCredits = current
      ? current.credits
      : request
        ? 0
        : getInitialCreditsForEmail(email);
    const credits = Math.max(0, baseCredits + (grantApplied ? DEFAULT_SIGNUP_CREDITS : 0));
    const next: ServerUser = {
      uid,
      email,
      fullName: current?.fullName || fallbackName,
      credits,
      freeCreditsClaimed: true,
      freeCreditsBlocked: request ? !grantApplied : false,
      signupIpAddress: current?.signupIpAddress || clientIp,
      ...(deviceFingerprint ? { deviceFingerprint } : {}),
      ...(current?.avatarDataUrl ? { avatarDataUrl: current.avatarDataUrl } : {}),
    };

    tx.set(
      ref,
      {
        email: next.email,
        fullName: next.fullName,
        credits: next.credits,
        freeCreditsClaimed: true,
        freeCreditsBlocked: next.freeCreditsBlocked,
        signupIpAddress: next.signupIpAddress,
        ...(deviceFingerprint ? { deviceFingerprint } : {}),
        ...(current ? {} : { createdAt: now }),
        updatedAt: now,
      },
      { merge: true }
    );
    return next;
  });
}

export async function updateServerUserName(uid: string, fullName: string): Promise<ServerUser> {
  return updateServerUserProfile(uid, { fullName });
}

export async function updateServerUserProfile(
  uid: string,
  patch: { fullName?: string; avatarDataUrl?: string | null }
): Promise<ServerUser> {
  const db = getFirestore();
  const next: Record<string, unknown> = {
    updatedAt: Date.now(),
  };
  if (typeof patch.fullName === "string") {
    next.fullName = patch.fullName.trim() || "User";
  }
  if (patch.avatarDataUrl === null) {
    next.avatarDataUrl = null;
  } else if (typeof patch.avatarDataUrl === "string") {
    next.avatarDataUrl = patch.avatarDataUrl;
  }

  await db.collection(USERS_COLLECTION).doc(uid).set(
    next,
    { merge: true }
  );
  const authUser = await getFirebaseAdminAuth().getUser(uid);
  return getOrCreateServerUser({
    uid,
    email: authUser.email ?? undefined,
    name:
      typeof next.fullName === "string"
        ? next.fullName
        : authUser.displayName ?? "",
  });
}

export async function spendServerCredits(uid: string, amount: number): Promise<ServerUser> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid credit amount.");
  const db = getFirestore();
  const ref = db.collection(USERS_COLLECTION).doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("User profile not found.");
    const now = Date.now();
    const current = normalizeServerUser(uid, (snap.data() ?? {}) as Record<string, unknown>);

    if (current.credits < amount) {
      throw new Error("INSUFFICIENT_CREDITS");
    }
    const nextCredits = current.credits - amount;
    const next: ServerUser = {
      ...current,
      credits: nextCredits,
    };
    tx.set(ref, { ...next, updatedAt: now }, { merge: true });
    return next;
  });
}

export async function refundServerCredits(uid: string, amount: number): Promise<ServerUser> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid refund amount.");
  const db = getFirestore();
  const ref = db.collection(USERS_COLLECTION).doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("User profile not found.");
    const now = Date.now();
    const current = normalizeServerUser(uid, (snap.data() ?? {}) as Record<string, unknown>);
    const next: ServerUser = {
      ...current,
      credits: Math.max(0, current.credits + amount),
    };
    tx.set(ref, { ...next, updatedAt: now }, { merge: true });
    return next;
  });
}

type GrantPurchasedCreditsInput = {
  uid?: string | null;
  email?: string | null;
  credits: number;
  orderId: string;
  provider: "lemonsqueezy";
};

export async function grantPurchasedCredits(
  input: GrantPurchasedCreditsInput
): Promise<{ applied: boolean; user: ServerUser | null }> {
  if (!Number.isFinite(input.credits) || input.credits <= 0) {
    throw new Error("Invalid purchased credit amount.");
  }
  const db = getFirestore();
  const now = Date.now();
  const purchaseRef = db
    .collection("siteforgeCreditPurchases")
    .doc(`${input.provider}:${input.orderId}`);
  const normalizedEmail = (input.email || "").trim().toLowerCase();
  const normalizedUid = (input.uid || "").trim();

  return db.runTransaction(async (tx) => {
    const purchaseSnap = await tx.get(purchaseRef);
    if (purchaseSnap.exists) {
      return { applied: false, user: null };
    }

    let userRef = normalizedUid ? db.collection(USERS_COLLECTION).doc(normalizedUid) : null;
    let userSnap = userRef ? await tx.get(userRef) : null;

    if ((!userSnap || !userSnap.exists) && normalizedEmail) {
      const byEmail = await tx.get(
        db.collection(USERS_COLLECTION).where("email", "==", normalizedEmail).limit(1)
      );
      if (!byEmail.empty) {
        userRef = byEmail.docs[0].ref;
        userSnap = byEmail.docs[0];
      }
    }

    if (!userRef || !userSnap || !userSnap.exists) {
      throw new Error("No matching user found for paid order.");
    }

    const current = normalizeServerUser(
      userRef.id,
      (userSnap.data() ?? {}) as Record<string, unknown>
    );
    const nextCredits = Math.max(0, current.credits + Math.floor(input.credits));
    const nextUser: ServerUser = { ...current, credits: nextCredits };

    tx.set(
      userRef,
      {
        credits: nextCredits,
        updatedAt: now,
      },
      { merge: true }
    );
    tx.set(purchaseRef, {
      provider: input.provider,
      orderId: input.orderId,
      uid: userRef.id,
      email: current.email,
      creditsAdded: Math.floor(input.credits),
      createdAt: now,
    });

    return { applied: true, user: nextUser };
  });
}
