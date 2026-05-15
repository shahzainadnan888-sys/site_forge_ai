/** Fields used from a session / admin user when syncing the Firestore profile. */
export type ServerUserAuthInput = {
  uid: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
};
import { createHash } from "node:crypto";
import type { DocumentReference } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { buildDeviceFingerprint, getRequestClientIp } from "@/lib/auth/free-credit-claims";
import { adminDb } from "@/lib/firebase/admin";
import { getInitialCreditsForEmail } from "@/lib/siteforge-credits";

const USERS_COLLECTION = "siteforgeUsers";
/** Idempotency for Lemon Squeezy webhooks (one doc per Lemon order id). */
const LEMONSQUEEZY_PROCESSED_ORDERS_COLLECTION = "lemonsqueezy_processed_orders";
const BILLING_TRANSACTIONS_SUBCOLLECTION = "billing_transactions";
const LEMONSQUEEZY_PROCESSED_INVOICES_COLLECTION = "lemonsqueezy_processed_invoices";
const BILLING_PENDING_LEMON_ORDERS_COLLECTION = "billing_pending_lemon_orders";
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
  /** Last known Lemon subscription snapshot (optional; set by webhooks). */
  lemonSubscription?: {
    id: string;
    status: string;
    variantId: string;
    productId?: string;
    renewsAt?: string | null;
    endsAt?: string | null;
    cancelled?: boolean;
    customerPortalUrl?: string | null;
    updatePaymentMethodUrl?: string | null;
  };
  /** Last paid subscription invoice id we recorded (audit). */
  lemonLastPaidInvoiceId?: string;
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
  if (user.lemonSubscription) payload.lemonSubscription = user.lemonSubscription;
  if (user.lemonLastPaidInvoiceId) payload.lemonLastPaidInvoiceId = user.lemonLastPaidInvoiceId;
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

export async function findUserByEmailInFirestore(email: string): Promise<ServerUser | null> {
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
    ...normalizeLemonSubscriptionFields(raw),
  };
}

function normalizeLemonSubscriptionFields(raw: Record<string, unknown>): Pick<ServerUser, "lemonSubscription" | "lemonLastPaidInvoiceId"> {
  const out: Pick<ServerUser, "lemonSubscription" | "lemonLastPaidInvoiceId"> = {};
  const sub = raw.lemonSubscription;
  if (sub && typeof sub === "object") {
    const o = sub as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const status = typeof o.status === "string" ? o.status.trim() : "";
    const variantId = typeof o.variantId === "string" ? o.variantId.trim() : "";
    if (id && status && variantId) {
      out.lemonSubscription = {
        id,
        status,
        variantId,
        ...(typeof o.productId === "string" && o.productId.trim() ? { productId: o.productId.trim() } : {}),
        ...(o.renewsAt === null || typeof o.renewsAt === "string" ? { renewsAt: o.renewsAt as string | null } : {}),
        ...(o.endsAt === null || typeof o.endsAt === "string" ? { endsAt: o.endsAt as string | null } : {}),
        ...(typeof o.cancelled === "boolean" ? { cancelled: o.cancelled } : {}),
        ...(typeof o.customerPortalUrl === "string" ? { customerPortalUrl: o.customerPortalUrl } : {}),
        ...(typeof o.updatePaymentMethodUrl === "string" ? { updatePaymentMethodUrl: o.updatePaymentMethodUrl } : {}),
      };
    }
  }
  if (typeof raw.lemonLastPaidInvoiceId === "string" && raw.lemonLastPaidInvoiceId.trim()) {
    out.lemonLastPaidInvoiceId = raw.lemonLastPaidInvoiceId.trim();
  }
  return out;
}

const userStore = new Map<string, ServerUser>();

async function ensureUserInMemory(uid: string): Promise<ServerUser | null> {
  const cached = userStore.get(uid);
  if (cached) return cached;
  const loaded = await readUserFromFirestore(uid);
  if (loaded) userStore.set(uid, loaded);
  return loaded;
}

export async function getOrCreateServerUser(
  decoded: ServerUserAuthInput,
  options?: GetOrCreateServerUserOptions
): Promise<ServerUser> {
  const uid = decoded.uid;
  const email = (decoded.email || "").trim().toLowerCase();
  if (!email) throw new Error("Authenticated user has no email.");

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

export async function resolveFirestoreProfileUidForNextAuth(input: {
  providerSub: string;
  email: string;
  name?: string | null;
}): Promise<{ firestoreUid: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email required.");
  const sub = input.providerSub.trim();
  if (!sub) throw new Error("Provider subject required.");

  const bySub = await adminDb.collection(USERS_COLLECTION).doc(sub).get();
  if (bySub.exists) {
    return { firestoreUid: sub };
  }

  let existing: ServerUser | null = null;
  try {
    existing = await findUserByEmailInFirestore(email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("PERMISSION_DENIED")) {
      console.warn(
        "[SiteForge] Firestore PERMISSION_DENIED while resolving Google sign-in. " +
          "Open Google Cloud Console → IAM for project",
        process.env.FIREBASE_PROJECT_ID || "(unknown)",
        "and grant the Admin SDK service account (FIREBASE_CLIENT_EMAIL) at least roles/datastore.user " +
          "(or use a Firebase-generated service account key from Project settings → Service accounts)."
      );
    }
    throw err;
  }
  if (existing) {
    return { firestoreUid: existing.uid };
  }

  await getOrCreateServerUser(
    {
      uid: sub,
      email,
      name: typeof input.name === "string" ? input.name : undefined,
      email_verified: true,
    },
    { grantSignupCredits: true }
  );
  return { firestoreUid: sub };
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
      reason: "no_siteforge_user_for_email";
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

async function resolveSiteforgeUserRefForLemonPurchase(params: {
  normalizedEmail: string;
  firebaseUid?: string | null;
}): Promise<DocumentReference | null> {
  const normUid = (params.firebaseUid || "").trim();
  if (normUid) {
    return adminDb.collection(USERS_COLLECTION).doc(normUid);
  }
  const existing = await findUserByEmailInFirestore(params.normalizedEmail);
  if (existing) {
    return adminDb.collection(USERS_COLLECTION).doc(existing.uid);
  }
  return null;
}

export async function writePendingLemonCreditOrder(input: {
  orderId: string;
  email: string;
  variantId: string;
  credits: number;
  reason: string;
}): Promise<void> {
  const ref = adminDb.collection(BILLING_PENDING_LEMON_ORDERS_COLLECTION).doc(input.orderId);
  await ref.set(
    {
      orderId: input.orderId,
      email: input.email,
      variantId: input.variantId,
      credits: input.credits,
      reason: input.reason,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Lemon `order_created` (paid) → idempotently add credits on `siteforgeUsers`.
 * Resolves the profile by checkout `uid` (server-created checkouts), then Firestore email.
 */
export async function applyLemonOrderCreditsToSiteforgeUser(input: {
  orderId: string;
  email: string;
  variantId: string;
  creditsToAdd: number;
  firebaseUid?: string | null;
  /** Webhook event name for audit (`order_created`). */
  sourceEvent?: string;
}): Promise<ApplyLemonSiteforgeOrderResult> {
  const { orderId, variantId, creditsToAdd } = input;
  const normalizedEmail = input.email.trim().toLowerCase();
  const normUid = (input.firebaseUid || "").trim();
  const sourceEvent = (input.sourceEvent || "order_created").trim() || "order_created";

  if (!orderId.trim()) throw new Error("Order id is required.");
  if (!normalizedEmail) throw new Error("Email is required.");
  if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) throw new Error("Invalid credit amount.");
  const add = Math.floor(creditsToAdd);

  const userRef = await resolveSiteforgeUserRefForLemonPurchase({
    normalizedEmail,
    firebaseUid: normUid || undefined,
  });

  if (!userRef) {
    return {
      ok: true,
      duplicate: false,
      skipped: true,
      orderId,
      email: normalizedEmail,
      reason: "no_siteforge_user_for_email",
    };
  }

  const processedRef = adminDb.collection(LEMONSQUEEZY_PROCESSED_ORDERS_COLLECTION).doc(orderId);
  const billingLineRef = userRef.collection(BILLING_TRANSACTIONS_SUBCOLLECTION).doc(`order_${orderId}`);

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
      sourceEvent,
      refundReversed: false,
    });

    tx.set(billingLineRef, {
      kind: "credit_purchase",
      provider: "lemonsqueezy",
      orderId,
      variantId,
      credits: add,
      userEmail: normalizedEmail,
      createdAt: now,
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

export type ReverseLemonRefundResult =
  | { ok: true; duplicate: true; orderId: string }
  | { ok: true; skipped: true; orderId: string; reason: string }
  | {
      ok: true;
      reversed: true;
      orderId: string;
      creditsRemoved: number;
      uid: string;
      creditsAfter: number;
    };

/** Reverses credits from a prior successful `applyLemonOrderCreditsToSiteforgeUser` (idempotent per order). */
export async function reverseLemonOrderRefundCredits(orderId: string): Promise<ReverseLemonRefundResult> {
  const id = orderId.trim();
  if (!id) throw new Error("Order id is required.");
  const processedRef = adminDb.collection(LEMONSQUEEZY_PROCESSED_ORDERS_COLLECTION).doc(id);

  const txResult = await adminDb.runTransaction(async (tx) => {
    const processedSnap = await tx.get(processedRef);
    if (!processedSnap.exists) {
      return { kind: "skipped" as const, reason: "no_processed_purchase_for_order" };
    }
    const p = processedSnap.data() as {
      creditsAdded?: unknown;
      siteforgeUid?: unknown;
      refundReversed?: unknown;
    };
    if (p.refundReversed === true) {
      return { kind: "duplicate" as const };
    }
    const uid = typeof p.siteforgeUid === "string" ? p.siteforgeUid.trim() : "";
    const creditsAdded =
      typeof p.creditsAdded === "number" && Number.isFinite(p.creditsAdded) ? Math.max(0, Math.floor(p.creditsAdded)) : 0;
    if (!uid || creditsAdded <= 0) {
      return { kind: "skipped" as const, reason: "invalid_processed_snapshot" };
    }
    const userRef = adminDb.collection(USERS_COLLECTION).doc(uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      return { kind: "skipped" as const, reason: "user_doc_missing" };
    }
    const current = normalizeServerUser(uid, userSnap.data() as Record<string, unknown>);
    const nextCredits = Math.max(0, current.credits - creditsAdded);
    const now = FieldValue.serverTimestamp();
    tx.set(
      userRef,
      {
        credits: nextCredits,
        updatedAt: now,
      },
      { merge: true }
    );
    tx.set(
      processedRef,
      {
        refundReversed: true,
        refundReversedAt: now,
      },
      { merge: true }
    );
    const lineRef = userRef.collection(BILLING_TRANSACTIONS_SUBCOLLECTION).doc(`refund_${id}`);
    tx.set(lineRef, {
      kind: "refund",
      provider: "lemonsqueezy",
      orderId: id,
      credits: -creditsAdded,
      createdAt: now,
    });
    return { kind: "reversed" as const, creditsRemoved: creditsAdded, uid, creditsAfter: nextCredits };
  });

  if (txResult.kind === "duplicate") {
    return { ok: true, duplicate: true, orderId: id };
  }
  if (txResult.kind === "skipped") {
    return { ok: true, skipped: true, orderId: id, reason: txResult.reason };
  }

  const after = await readUserFromFirestore(txResult.uid);
  if (after) userStore.set(after.uid, after);

  return {
    ok: true,
    reversed: true,
    orderId: id,
    creditsRemoved: txResult.creditsRemoved,
    uid: txResult.uid,
    creditsAfter: txResult.creditsAfter,
  };
}

export type SyncLemonSubscriptionResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; uid: string; subscriptionId: string };

export async function syncLemonSubscriptionToSiteforgeUser(input: {
  subscriptionId: string;
  email: string;
  firebaseUid?: string | null;
  status: string;
  variantId: string;
  productId?: string;
  renewsAt?: string | null;
  endsAt?: string | null;
  cancelled: boolean;
  customerPortalUrl?: string | null;
  updatePaymentMethodUrl?: string | null;
}): Promise<SyncLemonSubscriptionResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const userRef = await resolveSiteforgeUserRefForLemonPurchase({
    normalizedEmail,
    firebaseUid: input.firebaseUid,
  });
  if (!userRef) {
    return { ok: true, skipped: true, reason: "no_siteforge_user_for_email" };
  }
  const snap = await userRef.get();
  if (!snap.exists) {
    const localName = normalizedEmail.split("@")[0]?.trim() || "User";
    await userRef.set(
      {
        uid: userRef.id,
        email: normalizedEmail,
        fullName: localName,
        credits: 0,
        freeCreditsClaimed: true,
        freeCreditsBlocked: false,
        lemonSubscription: {
          id: input.subscriptionId,
          status: input.status,
          variantId: input.variantId,
          ...(input.productId ? { productId: input.productId } : {}),
          renewsAt: input.renewsAt ?? null,
          endsAt: input.endsAt ?? null,
          cancelled: input.cancelled,
          customerPortalUrl: input.customerPortalUrl ?? null,
          updatePaymentMethodUrl: input.updatePaymentMethodUrl ?? null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    const cur = normalizeServerUser(userRef.id, snap.data() as Record<string, unknown>);
    const next: ServerUser = {
      ...cur,
      lemonSubscription: {
        id: input.subscriptionId,
        status: input.status,
        variantId: input.variantId,
        ...(input.productId ? { productId: input.productId } : {}),
        renewsAt: input.renewsAt ?? null,
        endsAt: input.endsAt ?? null,
        cancelled: input.cancelled,
        customerPortalUrl: input.customerPortalUrl ?? null,
        updatePaymentMethodUrl: input.updatePaymentMethodUrl ?? null,
      },
    };
    await userRef.set(userToFirestore(next), { merge: true });
    userStore.set(next.uid, next);
  }
  return { ok: true, skipped: false, uid: userRef.id, subscriptionId: input.subscriptionId };
}

export type RecordInvoiceResult = { ok: true; duplicate: boolean; invoiceId: string; uid?: string };

/** Records a paid subscription invoice on the user profile (idempotent). Optional hook for renewals / analytics. */
export async function recordLemonSubscriptionPaidInvoice(input: {
  invoiceId: string;
  subscriptionId: string;
  email: string;
  firebaseUid?: string | null;
  billingReason: string;
}): Promise<RecordInvoiceResult> {
  const invId = input.invoiceId.trim();
  const invRef = adminDb.collection(LEMONSQUEEZY_PROCESSED_INVOICES_COLLECTION).doc(invId);
  const normalizedEmail = input.email.trim().toLowerCase();
  const userRef = await resolveSiteforgeUserRefForLemonPurchase({
    normalizedEmail,
    firebaseUid: input.firebaseUid,
  });
  if (!userRef) {
    return { ok: true, duplicate: false, invoiceId: invId };
  }

  const dup = await adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(invRef);
    if (existing.exists) return true;
    const now = FieldValue.serverTimestamp();
    tx.set(invRef, {
      invoiceId: invId,
      subscriptionId: input.subscriptionId,
      email: normalizedEmail,
      siteforgeUid: userRef.id,
      billingReason: input.billingReason,
      recordedAt: now,
    });
    tx.set(
      userRef,
      {
        lemonLastPaidInvoiceId: invId,
        updatedAt: now,
      },
      { merge: true }
    );
    const lineRef = userRef.collection(BILLING_TRANSACTIONS_SUBCOLLECTION).doc(`invoice_${invId}`);
    tx.set(lineRef, {
      kind: "subscription_invoice_paid",
      provider: "lemonsqueezy",
      invoiceId: invId,
      subscriptionId: input.subscriptionId,
      billingReason: input.billingReason,
      createdAt: now,
    });
    return false;
  });

  const after = await readUserFromFirestore(userRef.id);
  if (after) userStore.set(after.uid, after);

  return { ok: true, duplicate: dup, invoiceId: invId, uid: userRef.id };
}

export async function listBillingTransactionsForUser(
  uid: string,
  max = 50
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const snap = await adminDb
    .collection(USERS_COLLECTION)
    .doc(uid)
    .collection(BILLING_TRANSACTIONS_SUBCOLLECTION)
    .orderBy("createdAt", "desc")
    .limit(Math.min(100, Math.max(1, max)))
    .get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
}
