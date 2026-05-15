import { notFound } from "next/navigation";
import { slugFromPathSegments } from "@/lib/generated-site/normalize-slug";
import { pagesFromFirestoreData, resolvePageHtml } from "@/lib/generated-site/resolve-published-page";
import { preparePublishedHtml } from "@/lib/generated-site/sanitize-published-html";
import { adminDb } from "@/lib/firebase/admin";

/** First path segments that must never be treated as published site usernames. */
const RESERVED_USERNAMES = new Set([
  "api",
  "_next",
  "favicon.ico",
  "dashboard",
  "editor",
  "preview",
  "account",
  "get-started",
  "plans",
  "services",
  "about",
  "contact",
  "verify-email",
]);

function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function renderPublishedSitePage(rawUsername: string, slugSegments?: string[]) {
  const username = normalizeUsername(decodeURIComponent(rawUsername || ""));
  if (!username || RESERVED_USERNAMES.has(username)) {
    notFound();
  }

  const snap = await adminDb
    .collection("siteforgePublishedSites")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (snap.empty) {
    notFound();
  }

  const data = snap.docs[0]?.data() as Record<string, unknown> | undefined;
  const pages = pagesFromFirestoreData(data);
  if (!pages) {
    notFound();
  }

  const { html, found } = resolvePageHtml(pages, slugSegments);
  if (!found || !html) {
    notFound();
  }

  const pageSlug = slugFromPathSegments(slugSegments);
  const safe = preparePublishedHtml(html, username, pageSlug);
  return <div dangerouslySetInnerHTML={{ __html: safe }} />;
}
