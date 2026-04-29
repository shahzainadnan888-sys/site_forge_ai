import { deleteField, doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";

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
  return doc(getFirestore(app), COLLECTION, siteId);
}

export function getHtmlStoragePath(siteId: string) {
  return `published-sites/${siteId}/index.html`;
}

export async function getPublishedMeta(siteId: string): Promise<PublishedSiteMeta | null> {
  const snap = await getDoc(docRef(siteId));
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
  throw new Error(`GCS storage mode is not supported in frontend-only Firebase setup. Path: ${meta.storagePath}`);
}

/**
 * Resolves published HTML: prefers inline Firestore body (no bucket), else GCS.
 */
export async function getPublishedHtmlBySiteId(siteId: string): Promise<string | null> {
  const snap = await getDoc(docRef(siteId));
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
  await setDoc(
    docRef(siteId),
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
  const prior = await getDoc(ref);
  const priorData = prior.data() as Record<string, unknown> | undefined;
  const createdAt = prior.exists() ? (priorData?.createdAt as number) || now : now;

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
    await setDoc(ref, data, { merge: true });
    return;
  }
  throw new Error("Published HTML is too large for Firestore in frontend-only mode. Reduce page size below 950KB.");

  const data: Record<string, unknown> = {
    ownerUid: opts.ownerUid,
    storageMode: "gcs" as const,
    storagePath: "",
    htmlBody: deleteField(),
    sizeBytes,
    createdAt,
    updatedAt: now,
  };
  if (typeof opts.vercelProjectId === "string" && opts.vercelProjectId) {
    data.vercelProjectId = opts.vercelProjectId;
  } else {
      const existing = priorData?.vercelProjectId;
    if (typeof existing === "string" && existing) data.vercelProjectId = existing;
  }

  await setDoc(ref, data, { merge: true });
}
