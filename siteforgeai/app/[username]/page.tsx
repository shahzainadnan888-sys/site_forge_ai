import { adminDb } from "@/lib/firebase/admin";

type Props = {
  params: Promise<{ username: string }>;
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
  const { username: raw } = await params;
  const username = normalizeUsername(decodeURIComponent(raw || ""));
  if (!username) {
    return <main style={{ padding: 24 }}>Site not found</main>;
  }

  const snap = await adminDb
    .collection("siteforgePublishedSites")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (snap.empty) {
    return <main style={{ padding: 24 }}>Site not found</main>;
  }

  const htmlContent = String(snap.docs[0]?.data()?.htmlContent ?? "");
  if (!htmlContent) {
    return <main style={{ padding: 24 }}>Site not found</main>;
  }

  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}
