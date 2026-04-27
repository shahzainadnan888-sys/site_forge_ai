import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminBucket } from "@/lib/firebase/admin";

const COLLECTION = "siteforgePublishedSites";

/** Firestore document max is 1 MiB; keep HTML field safely under. */
export const MAX_FIRESTORE_HTML_BYTES = 950_000;

export type StorageMode = "firestore" | "gcs";

export type PublishedSiteMeta = {
  ownerUid: string;
  storagePath: string;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  vercelProjectId?: string;
  storageMode?: StorageMode;
};

function docRef(siteId: string) {
  return getFirestore().collection(COLLECTION).doc(siteId);
}

export function getHtmlStoragePath(siteId: string) {
  return `published-sites/${siteId}/index.html`;
}

export async function getPublishedMeta(siteId: string): Promise<PublishedSiteMeta | null> {
  const snap = await docRef(siteId).get();
  if (!snap.exists) return null;
  const d = snap.data() as Record<string, unknown> | undefined;
  if (!d) return null;
  const mode = d.storageMode === "gcs" || d.storageMode === "firestore" ? d.storageMode : undefined;
  return {
    ownerUid: String(d.ownerUid ?? ""),
    storagePath: String(d.storagePath ?? ""),
    sizeBytes: typeof d.sizeBytes === "number" ? d.sizeBytes : 0,
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0,
    ...(mode ? { storageMode: mode } : {}),
    ...(typeof d.vercelProjectId === "string" && d.vercelProjectId
      ? { vercelProjectId: d.vercelProjectId }
      : {}),
  };
}

export async function getPublishedHtmlFromGcs(meta: PublishedSiteMeta): Promise<string> {
  const bucket = getFirebaseAdminBucket();
  const file = bucket.file(meta.storagePath);
  const [buf] = await file.download();
  return buf.toString("utf-8");
}

/**
 * Resolves published HTML: prefers inline Firestore body (no bucket), else GCS.
 */
export async function getPublishedHtmlBySiteId(siteId: string): Promise<string | null> {
  const snap = await docRef(siteId).get();
  if (!snap.exists) return null;
  const d = snap.data() as Record<string, unknown> | undefined;
  if (!d) return null;
  if (String(d.ownerUid ?? "") === "") return null;

  if (d.storageMode === "firestore" && typeof d.htmlBody === "string" && d.htmlBody.length > 0) {
    return d.htmlBody;
  }
  if (typeof d.htmlBody === "string" && d.htmlBody.length > 0) {
    return d.htmlBody;
  }
  if (d.storageMode === "gcs" && typeof d.storagePath === "string" && d.storagePath) {
    try {
      return await getPublishedHtmlFromGcs({
        ownerUid: String(d.ownerUid),
        storagePath: d.storagePath,
        sizeBytes: typeof d.sizeBytes === "number" ? d.sizeBytes : 0,
        createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
        updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0,
        storageMode: "gcs",
      });
    } catch {
      return null;
    }
  }
  if (typeof d.storagePath === "string" && d.storagePath) {
    try {
      return await getPublishedHtmlFromGcs({
        ownerUid: String(d.ownerUid),
        storagePath: d.storagePath,
        sizeBytes: typeof d.sizeBytes === "number" ? d.sizeBytes : 0,
        createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
        updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0,
      });
    } catch {
      return null;
    }
  }
  return null;
}

export async function mergePublishedVercelProject(siteId: string, vercelProjectId: string) {
  const now = Date.now();
  await docRef(siteId).set(
    { vercelProjectId, updatedAt: now },
    { merge: true }
  );
}

export async function writePublishedSite(opts: {
  siteId: string;
  ownerUid: string;
  html: string;
  vercelProjectId?: string;
}): Promise<void> {
  const buffer = Buffer.from(opts.html, "utf-8");
  const sizeBytes = buffer.length;
  const now = Date.now();
  const ref = docRef(opts.siteId);
  const prior = await ref.get();
  const createdAt = prior.exists ? (prior.get("createdAt") as number) || now : now;

  if (sizeBytes <= MAX_FIRESTORE_HTML_BYTES) {
    const data: Record<string, unknown> = {
      ownerUid: opts.ownerUid,
      storageMode: "firestore" as const,
      htmlBody: opts.html,
      storagePath: "",
      sizeBytes,
      createdAt,
      updatedAt: now,
    };
    if (typeof opts.vercelProjectId === "string" && opts.vercelProjectId) {
      data.vercelProjectId = opts.vercelProjectId;
    } else {
      const existing = prior.get("vercelProjectId");
      if (typeof existing === "string" && existing) data.vercelProjectId = existing;
    }
    await ref.set(data, { merge: true });
    return;
  }

  const path = getHtmlStoragePath(opts.siteId);
  let bucket;
  try {
    bucket = getFirebaseAdminBucket();
  } catch (e) {
    throw new Error(
      "Published HTML is too large for the database. Enable Firebase Storage in the Firebase console and set FIREBASE_STORAGE_BUCKET, or reduce the page size."
    );
  }
  const file = bucket.file(path);
  try {
    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: "text/html; charset=utf-8",
        cacheControl: "public, max-age=30",
        metadata: { siteId: opts.siteId, ownerUid: opts.ownerUid },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/bucket does not exist|404|not exist/i.test(msg)) {
      throw new Error(
        "Firebase Storage bucket is missing or not created. In Firebase Console open Storage, Get started, or fix FIREBASE_STORAGE_BUCKET. You can also reduce the site under ~950KB to publish without Storage."
      );
    }
    throw e;
  }

  const data: Record<string, unknown> = {
    ownerUid: opts.ownerUid,
    storageMode: "gcs" as const,
    storagePath: path,
    htmlBody: FieldValue.delete(),
    sizeBytes,
    createdAt,
    updatedAt: now,
  };
  if (typeof opts.vercelProjectId === "string" && opts.vercelProjectId) {
    data.vercelProjectId = opts.vercelProjectId;
  } else {
    const existing = prior.get("vercelProjectId");
    if (typeof existing === "string" && existing) data.vercelProjectId = existing;
  }

  await ref.set(data, { merge: true });
}
