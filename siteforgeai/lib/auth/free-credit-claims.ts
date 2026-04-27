import { createHash } from "node:crypto";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getTrustedClientIp } from "@/lib/security/client-ip";

const GRANTS_COLLECTION = "siteforgeFreeCreditGrants";
const ID_PREFIX = "sffc_v1";

function hashPart(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 40);
}

/** Firestore document id for the signup IP (hashed; no raw IP stored in id beyond hash). */
function freeCreditIpGrantId(clientIp: string): string {
  return `${ID_PREFIX}_ip_${hashPart(clientIp || "unknown")}`;
}

export function getRequestClientIp(request: Request): string {
  return getTrustedClientIp(request);
}

/**
 * If this IP has already been used to grant a free-credit signup, block another grant.
 * Server-trusted IP only (see getTrustedClientIp).
 */
export async function shouldBlockFreeCreditsInTransaction(
  tx: Transaction,
  clientIp: string
): Promise<boolean> {
  const db = getFirestore();
  const ref: DocumentReference = db.collection(GRANTS_COLLECTION).doc(
    freeCreditIpGrantId(clientIp)
  );
  const snap = await tx.get(ref);
  return snap.exists;
}

export function writeFreeCreditGrants(
  tx: Transaction,
  uid: string,
  clientIp: string
): void {
  const db = getFirestore();
  const now = Date.now();
  const payload = { userId: uid, createdAt: now };
  tx.set(db.collection(GRANTS_COLLECTION).doc(freeCreditIpGrantId(clientIp)), payload);
}
