import { notFound } from "next/navigation";
import { slugFromPathSegments } from "@/lib/generated-site/normalize-slug";
import { pagesFromFirestoreData, resolvePageHtml } from "@/lib/generated-site/resolve-published-page";
import { preparePublishedHtml } from "@/lib/generated-site/sanitize-published-html";
import { adminDb } from "@/lib/firebase/admin";

type Props = {
  params: Promise<{ username: string; slug?: string[] }>;
};

function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function PublishedSitePage({ params }: Props) {
  const { username: raw, slug: slugSegments } = await params;
  const username = normalizeUsername(decodeURIComponent(raw || ""));
  if (!username) {
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
