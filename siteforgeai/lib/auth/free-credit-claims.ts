import { createHash } from "node:crypto";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getTrustedClientIp } from "@/lib/security/client-ip";

const DEVICE_LOG_COLLECTION = "device_free_credit_log";
const ID_PREFIX = "sfdc_v1";

export type DeviceContext = {
  timezone?: string;
  screen?: string;
  platform?: string;
  userAgent?: string;
};

function hashPart(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 40);
}

function normalizePart(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 300);
}

function makeRawDeviceFingerprint(input: {
  clientIp: string;
  userAgent: string;
  timezone: string;
  screen: string;
  platform: string;
}) {
  return [
    normalizePart(input.clientIp || "unknown"),
    normalizePart(input.userAgent || "unknown"),
    normalizePart(input.timezone || "unknown"),
    normalizePart(input.screen || "unknown"),
    normalizePart(input.platform || "unknown"),
  ].join("|");
}

export function buildDeviceFingerprint(args: {
  request: Request;
  deviceContext?: DeviceContext;
}): string {
  const clientIp = getRequestClientIp(args.request);
  const uaFromHeader = args.request.headers.get("user-agent") || "";
  const userAgent = args.deviceContext?.userAgent?.trim() || uaFromHeader;
  const timezone = args.deviceContext?.timezone?.trim() || "unknown";
  const screen = args.deviceContext?.screen?.trim() || "unknown";
  const platform = args.deviceContext?.platform?.trim() || "unknown";
  const raw = makeRawDeviceFingerprint({
    clientIp,
    userAgent,
    timezone,
    screen,
    platform,
  });
  return `${ID_PREFIX}_${hashPart(raw)}`;
}

function freeCreditDeviceRef(deviceFingerprint: string): DocumentReference {
  const db = getFirestore();
  return db.collection(DEVICE_LOG_COLLECTION).doc(deviceFingerprint);
}

export function getRequestClientIp(request: Request): string {
  return getTrustedClientIp(request);
}

export async function isDeviceAlreadyClaimedInTransaction(
  tx: Transaction,
  deviceFingerprint: string
): Promise<boolean> {
  const ref = freeCreditDeviceRef(deviceFingerprint);
  const snap = await tx.get(ref);
  return snap.exists;
}

export function writeDeviceFreeCreditLog(
  tx: Transaction,
  deviceFingerprint: string,
  uid: string,
  freeCreditsGiven: boolean
): void {
  const now = Date.now();
  tx.set(
    freeCreditDeviceRef(deviceFingerprint),
    {
      id: deviceFingerprint,
      deviceFingerprint,
      firstUserId: uid,
      freeCreditsGiven,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}
