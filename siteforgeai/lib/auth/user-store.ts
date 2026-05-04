/** Fields used from a session / admin user when syncing the Firestore profile. */
export type ServerUserAuthInput = {
  uid: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
};
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { buildDeviceFingerprint, getRequestClientIp } from "@/lib/auth/free-credit-claims";
import { adminDb } from "@/lib/firebase/admin";
import { getInitialCreditsForEmail } from "@/lib/siteforge-credits";

const USERS_COLLECTION = "siteforgeUsers";
/** Idempotency for Lemon Squeezy webhooks (one doc per Lemon order id). */
const LEMONSQUEEZY_PROCESSED_ORDERS_COLLECTION = "lemonsqueezy_processed_orders";
const DEVICE_FREE_CREDIT_COLLECTION = "device_free_credit_log";
const SIGNUP_IP_FREE_CREDIT_COLLECTION = "signup_ip_free_credit_log";

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
  grantSignupCredits?: boolean;
  deviceContext?: {
    timezone?: string;
    screen?: string;
    platform?: string;
    userAgent?: string;
  };
};

function signupIpClaimDocId(ip: string): string | null {
  const normalized = ip.trim().toLowerCase();
  if (!normalized || normalized === "unknown") return null;
  const hash = createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 40);
  return `sfcip_v1_${hash}`;
}

function userToFirestore(user: ServerUser): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    uid: user.uid,
    email: user.email,
    fullName: user.fullName,
    credits: user.credits,
    freeCreditsClaimed: user.freeCreditsClaimed,
    freeCreditsBlocked: user.freeCreditsBlocked,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (user.signupIpAddress) payload.signupIpAddress = user.signupIpAddress;
  if (user.deviceFingerprint) payload.deviceFingerprint = user.deviceFingerprint;
  if (user.deviceId) payload.deviceId = user.deviceId;
  if (user.avatarDataUrl) payload.avatarDataUrl = user.avatarDataUrl;
  return payload;
}

async function readUserFromFirestore(uid: string): Promise<ServerUser | null> {
  const snap = await adminDb.collection(USERS_COLLECTION).doc(uid).get();
  if (!snap.exists) return null;
  return normalizeServerUser(uid, snap.data() as Record<string, unknown>);
}

async function writeUserToFirestore(user: ServerUser): Promise<void> {
  await adminDb.collection(USERS_COLLECTION).doc(user.uid).set(userToFirestore(user), { merge: true });
}

async function findUserByEmailInFirestore(email: string): Promise<ServerUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const qs = await adminDb.collection(USERS_COLLECTION).where("email", "==", normalized).limit(1).get();
  if (qs.empty) return null;
  const doc = qs.docs[0];
  return normalizeServerUser(doc.id, doc.data() as Record<string, unknown>);
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

const userStore = new Map<string, ServerUser>();

async function ensureUserInMemory(uid: string): Promise<ServerUser | null> {
  const cached = userStore.get(uid);
  if (cached) return cached;
  const loaded = await readUserFromFirestore(uid);
  if (loaded) userStore.set(uid, loaded);
  return loaded;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Invalid token.");
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
  const json = Buffer.from(`${payload}${pad}`, "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

export async function verifySessionCookie(cookieValue: string): Promise<ServerUserAuthInput> {
  const decoded = decodeJwtPayload(cookieValue);
  const uid = String(decoded.user_id ?? decoded.sub ?? "").trim();
  if (!uid) throw new Error("Invalid token payload.");
  return {
    uid,
    email: typeof decoded.email === "string" ? decoded.email : undefined,
    name: typeof decoded.name === "string" ? decoded.name : undefined,
    email_verified: decoded.email_verified === true,
  };
}

export async function getOrCreateServerUser(
  decoded: ServerUserAuthInput,
  options?: GetOrCreateServerUserOptions
): Promise<ServerUser> {
  const uid = decoded.uid;
  const email = (decoded.email || "").trim().toLowerCase();
  if (!email) throw new Error("Authenticated Firebase user has no email.");

  const fallbackName =
    (typeof decoded.name === "string" && decoded.name.trim()) ||
    (email.split("@")[0] || "User");

  const grantSignupCredits = options?.grantSignupCredits === true;
  const signupIpAddress = options?.request ? getRequestClientIp(options.request) : undefined;
  const deviceFingerprint = options?.request
    ? buildDeviceFingerprint({
        request: options.request,
        deviceContext: options.deviceContext,
      })
    : undefined;

  const persisted = await readUserFromFirestore(uid);
  if (persisted) {
    let next = persisted;
    let dirty = false;
    if (persisted.email !== email) {
      next = { ...persisted, email };
      dirty = true;
    }
    const shouldUpdateMeta =
      (signupIpAddress &&
        signupIpAddress !== "unknown" &&
        next.signupIpAddress !== signupIpAddress) ||
      (deviceFingerprint && next.deviceFingerprint !== deviceFingerprint);
    if (shouldUpdateMeta) {
      next = {
        ...next,
        ...(signupIpAddress && signupIpAddress !== "unknown" ? { signupIpAddress } : {}),
        ...(deviceFingerprint ? { deviceFingerprint } : {}),
      };
      dirty = true;
    }
    if (dirty) await writeUserToFirestore(next);
    userStore.set(uid, next);
    return next;
  }

  const created = await adminDb.runTransaction(async (transaction) => {
    const userRef = adminDb.collection(USERS_COLLECTION).doc(uid);
    const userSnap = await transaction.get(userRef);
    if (userSnap.exists) {
      return normalizeServerUser(uid, userSnap.data() as Record<string, unknown>);
    }

    const devRef = deviceFingerprint
      ? adminDb.collection(DEVICE_FREE_CREDIT_COLLECTION).doc(deviceFingerprint)
      : null;
    const devSnap = devRef ? await transaction.get(devRef) : null;
    const deviceFirstUid = devSnap?.exists
      ? String((devSnap.data() as { firstUserId?: string }).firstUserId ?? "").trim()
      : "";
    const deviceClaimedByOther = Boolean(deviceFirstUid && deviceFirstUid !== uid);

    const ipDocId =
      signupIpAddress && signupIpAddress !== "unknown" ? signupIpClaimDocId(signupIpAddress) : null;
    let ipSnapExists = false;
    let ipFirstUid = "";
    if (ipDocId) {
      const ipRef = adminDb.collection(SIGNUP_IP_FREE_CREDIT_COLLECTION).doc(ipDocId);
      const ipSnap = await transaction.get(ipRef);
      ipSnapExists = ipSnap.exists;
      if (ipSnap.exists) {
        ipFirstUid = String((ipSnap.data() as { firstUserId?: string }).firstUserId ?? "").trim();
      }
    }
    const ipClaimedByOther =
      grantSignupCredits && Boolean(ipFirstUid && ipFirstUid !== uid);

    const signupBonusBlocked = grantSignupCredits && (deviceClaimedByOther || ipClaimedByOther);
    const shouldGrantSignupCredits = grantSignupCredits && !signupBonusBlocked;
    const nextUser: ServerUser = {
      uid,
      email,
      fullName: fallbackName,
      credits: shouldGrantSignupCredits ? getInitialCreditsForEmail(email) : 0,
      freeCreditsClaimed: true,
      freeCreditsBlocked: signupBonusBlocked,
      ...(signupIpAddress && signupIpAddress !== "unknown" ? { signupIpAddress } : {}),
      ...(deviceFingerprint ? { deviceFingerprint } : {}),
    };

    transaction.set(userRef, userToFirestore(nextUser), { merge: false });

    const now = Date.now();
    if (deviceFingerprint && devRef && !devSnap?.exists) {
      transaction.set(
        devRef,
        {
          id: deviceFingerprint,
          deviceFingerprint,
          firstUserId: uid,
          freeCreditsGiven: shouldGrantSignupCredits,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    }
    if (ipDocId && !ipSnapExists) {
      transaction.set(
        adminDb.collection(SIGNUP_IP_FREE_CREDIT_COLLECTION).doc(ipDocId),
        {
          id: ipDocId,
          firstUserId: uid,
          freeCreditsGiven: shouldGrantSignupCredits,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return nextUser;
  });

  userStore.set(uid, created);
  return created;
}

export async function updateServerUserName(uid: string, fullName: string): Promise<ServerUser> {
  return updateServerUserProfile(uid, { fullName });
}

export async function updateServerUserProfile(
  uid: string,
  patch: { fullName?: string; avatarDataUrl?: string | null }
): Promise<ServerUser> {
  const current = await ensureUserInMemory(uid);
  if (!current) throw new Error("User profile not found.");
  const updated: ServerUser = {
    ...current,
    ...(typeof patch.fullName === "string" ? { fullName: patch.fullName.trim() || "User" } : {}),
    ...(patch.avatarDataUrl === null
      ? { avatarDataUrl: undefined }
      : typeof patch.avatarDataUrl === "string"
        ? { avatarDataUrl: patch.avatarDataUrl }
        : {}),
  };
  const payload = userToFirestore(updated);
  if (patch.avatarDataUrl === null) {
    payload.avatarDataUrl = FieldValue.delete();
  }
  await adminDb.collection(USERS_COLLECTION).doc(uid).set(payload, { merge: true });
  userStore.set(uid, updated);
  return updated;
}

export async function spendServerCredits(uid: string, amount: number): Promise<ServerUser> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid credit amount.");
  const next = await adminDb.runTransaction(async (transaction) => {
    const ref = adminDb.collection(USERS_COLLECTION).doc(uid);
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("User profile not found.");
    const current = normalizeServerUser(uid, snap.data() as Record<string, unknown>);
    if (current.credits < amount) throw new Error("INSUFFICIENT_CREDITS");
    const updated = { ...current, credits: current.credits - amount };
    transaction.set(ref, userToFirestore(updated), { merge: true });
    return updated;
  });
  userStore.set(uid, next);
  return next;
}

export async function refundServerCredits(uid: string, amount: number): Promise<ServerUser> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid refund amount.");
  const next = await adminDb.runTransaction(async (transaction) => {
    const ref = adminDb.collection(USERS_COLLECTION).doc(uid);
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("User profile not found.");
    const current = normalizeServerUser(uid, snap.data() as Record<string, unknown>);
    const updated = { ...current, credits: Math.max(0, current.credits + amount) };
    transaction.set(ref, userToFirestore(updated), { merge: true });
    return updated;
  });
  userStore.set(uid, next);
  return next;
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
  const normalizedEmail = (input.email || "").trim().toLowerCase();
  const normalizedUid = (input.uid || "").trim();
  let user: ServerUser | null = null;
  if (normalizedUid) {
    user = (await readUserFromFirestore(normalizedUid)) ?? userStore.get(normalizedUid) ?? null;
  }
  if (!user && normalizedEmail) {
    user = await findUserByEmailInFirestore(normalizedEmail);
  }
  if (!user) throw new Error("No matching user found for paid order.");

  const add = Math.floor(input.credits);
  const uid = user.uid;
  const nextUser = await adminDb.runTransaction(async (transaction) => {
    const ref = adminDb.collection(USERS_COLLECTION).doc(uid);
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("No matching user found for paid order.");
    const current = normalizeServerUser(uid, snap.data() as Record<string, unknown>);
    const updated = { ...current, credits: Math.max(0, current.credits + add) };
    transaction.set(ref, userToFirestore(updated), { merge: true });
    return updated;
  });
  userStore.set(nextUser.uid, nextUser);
  return { applied: true, user: nextUser };
}

export type ApplyLemonSiteforgeOrderResult =
  | { ok: true; duplicate: true; orderId: string }
  | {
      ok: true;
      duplicate: false;
      skipped: true;
      orderId: string;
      email: string;
      reason: "no_siteforge_user";
    }
  | {
      ok: true;
      duplicate: false;
      skipped: false;
      orderId: string;
      email: string;
      variantId: string;
      creditsAdded: number;
      newUser: boolean;
      creditsAfter: number;
      uid: string;
    };

/**
 * Lemon `order_created` → idempotently add credits on `siteforgeUsers` only.
 * Resolves the profile by Firebase UID (checkout custom `uid`) when present, else by email.
 * Creates a minimal `siteforgeUsers/{uid}` row only when UID is known and the doc is missing.
 */
export async function applyLemonOrderCreditsToSiteforgeUser(input: {
  orderId: string;
  email: string;
  variantId: string;
  creditsToAdd: number;
  firebaseUid?: string | null;
}): Promise<ApplyLemonSiteforgeOrderResult> {
  const { orderId, variantId, creditsToAdd } = input;
  const normalizedEmail = input.email.trim().toLowerCase();
  const normUid = (input.firebaseUid || "").trim();

  if (!orderId.trim()) throw new Error("Order id is required.");
  if (!normalizedEmail) throw new Error("Email is required.");
  if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) throw new Error("Invalid credit amount.");
  const add = Math.floor(creditsToAdd);

  let userRef = normUid
    ? adminDb.collection(USERS_COLLECTION).doc(normUid)
    : null;

  if (!userRef) {
    const existing = await findUserByEmailInFirestore(normalizedEmail);
    if (!existing) {
      return {
        ok: true,
        duplicate: false,
        skipped: true,
        orderId,
        email: normalizedEmail,
        reason: "no_siteforge_user",
      };
    }
    userRef = adminDb.collection(USERS_COLLECTION).doc(existing.uid);
  }

  const processedRef = adminDb.collection(LEMONSQUEEZY_PROCESSED_ORDERS_COLLECTION).doc(orderId);

  const txResult = await adminDb.runTransaction(async (tx) => {
    const processedSnap = await tx.get(processedRef);
    if (processedSnap.exists) {
      return { duplicate: true as const };
    }

    const userSnap = await tx.get(userRef);
    const now = FieldValue.serverTimestamp();

    if (!userSnap.exists) {
      const localName = normalizedEmail.split("@")[0]?.trim() || "User";
      tx.set(
        userRef,
        {
          uid: userRef.id,
          email: normalizedEmail,
          fullName: localName,
          credits: add,
          freeCreditsClaimed: true,
          freeCreditsBlocked: false,
          updatedAt: now,
        },
        { merge: true }
      );
    } else {
      tx.set(
        userRef,
        {
          credits: FieldValue.increment(add),
          updatedAt: now,
        },
        { merge: true }
      );
    }

    tx.set(processedRef, {
      orderId,
      email: normalizedEmail,
      variantId,
      firebaseUid: normUid || null,
      siteforgeUid: userRef.id,
      creditsAdded: add,
      processedAt: now,
    });

    return {
      duplicate: false as const,
      newUser: !userSnap.exists,
    };
  });

  if (txResult.duplicate) {
    return { ok: true, duplicate: true, orderId };
  }

  const after = await readUserFromFirestore(userRef.id);
  const rawAfter = after?.credits;
  const creditsAfter =
    typeof rawAfter === "number" && Number.isFinite(rawAfter) ? Math.max(0, Math.floor(rawAfter)) : add;
  if (after) {
    userStore.set(after.uid, after);
  }

  return {
    ok: true,
    duplicate: false,
    skipped: false,
    orderId,
    email: normalizedEmail,
    variantId,
    creditsAdded: add,
    newUser: txResult.newUser,
    creditsAfter,
    uid: userRef.id,
  };
}
