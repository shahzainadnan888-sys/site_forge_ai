/** Fields used from a session / admin user when syncing the Firestore profile. */
export type ServerUserAuthInput = {
  uid: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
};
import { DEFAULT_SIGNUP_CREDITS } from "@/lib/credit-economy";
import { buildDeviceFingerprint, getRequestClientIp } from "@/lib/auth/free-credit-claims";

const USERS_COLLECTION = "siteforgeUsers";

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

function getInitialCreditsForEmail(_email: string): number {
  return DEFAULT_SIGNUP_CREDITS;
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

function hasPriorClaimByAnotherUser(args: {
  uid: string;
  signupIpAddress?: string;
  deviceFingerprint?: string;
}): boolean {
  const signupIpAddress =
    typeof args.signupIpAddress === "string" &&
    args.signupIpAddress.length > 0 &&
    args.signupIpAddress !== "unknown"
      ? args.signupIpAddress
      : "";
  const deviceFingerprint =
    typeof args.deviceFingerprint === "string" && args.deviceFingerprint.length > 0
      ? args.deviceFingerprint
      : "";
  if (!signupIpAddress && !deviceFingerprint) return false;

  for (const other of userStore.values()) {
    if (other.uid === args.uid) continue;
    if (signupIpAddress && other.signupIpAddress === signupIpAddress) return true;
    if (deviceFingerprint && other.deviceFingerprint === deviceFingerprint) return true;
  }
  return false;
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

  const existing = userStore.get(uid);
  const grantSignupCredits = options?.grantSignupCredits === true;
  const signupIpAddress = options?.request ? getRequestClientIp(options.request) : undefined;
  const deviceFingerprint = options?.request
    ? buildDeviceFingerprint({
        request: options.request,
        deviceContext: options.deviceContext,
      })
    : undefined;
  if (existing) {
    const shouldUpdate =
      (signupIpAddress &&
        signupIpAddress !== "unknown" &&
        existing.signupIpAddress !== signupIpAddress) ||
      (deviceFingerprint && existing.deviceFingerprint !== deviceFingerprint);
    if (shouldUpdate) {
      const next = {
        ...existing,
        ...(signupIpAddress && signupIpAddress !== "unknown" ? { signupIpAddress } : {}),
        ...(deviceFingerprint ? { deviceFingerprint } : {}),
      };
      userStore.set(uid, next);
      return next;
    }
    return existing;
  }

  const alreadyClaimed = hasPriorClaimByAnotherUser({
    uid,
    signupIpAddress,
    deviceFingerprint,
  });
  const shouldGrantSignupCredits = grantSignupCredits && !alreadyClaimed;

  const next: ServerUser = {
    uid,
    email,
    fullName: fallbackName,
    credits: shouldGrantSignupCredits ? getInitialCreditsForEmail(email) : 0,
    freeCreditsClaimed: true,
    freeCreditsBlocked: alreadyClaimed,
    ...(signupIpAddress ? { signupIpAddress } : {}),
    ...(deviceFingerprint ? { deviceFingerprint } : {}),
  };
  userStore.set(uid, next);
  return next;
}

export async function updateServerUserName(uid: string, fullName: string): Promise<ServerUser> {
  return updateServerUserProfile(uid, { fullName });
}

export async function updateServerUserProfile(
  uid: string,
  patch: { fullName?: string; avatarDataUrl?: string | null }
): Promise<ServerUser> {
  const current = userStore.get(uid);
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
  userStore.set(uid, updated);
  return updated;
}

export async function spendServerCredits(uid: string, amount: number): Promise<ServerUser> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid credit amount.");
  const current = userStore.get(uid);
  if (!current) throw new Error("User profile not found.");
  if (current.credits < amount) throw new Error("INSUFFICIENT_CREDITS");
  const next = { ...current, credits: current.credits - amount };
  userStore.set(uid, next);
  return next;
}

export async function refundServerCredits(uid: string, amount: number): Promise<ServerUser> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid refund amount.");
  const current = userStore.get(uid);
  if (!current) throw new Error("User profile not found.");
  const next = { ...current, credits: Math.max(0, current.credits + amount) };
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
  const user =
    (normalizedUid ? userStore.get(normalizedUid) : undefined) ??
    [...userStore.values()].find((u) => u.email === normalizedEmail);
  if (!user) throw new Error("No matching user found for paid order.");
  const nextUser = { ...user, credits: Math.max(0, user.credits + Math.floor(input.credits)) };
  userStore.set(nextUser.uid, nextUser);
  return { applied: true, user: nextUser };
}
