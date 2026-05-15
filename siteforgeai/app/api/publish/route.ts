import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { requireCurrentServerUser } from "@/lib/auth/current-user";
import { normalizePageSlug } from "@/lib/generated-site/normalize-slug";
import { reconcileGeneratedPages } from "@/lib/generated-site/reconcile-pages";
import { preparePublishedHtml } from "@/lib/generated-site/sanitize-published-html";
import { primaryHtmlFromPages } from "@/lib/generated-site/split-pages";
import type { SitePageMap } from "@/lib/generated-site/types";
import { adminDb } from "@/lib/firebase/admin";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, enforceRateLimitByIp, RateLimitError } from "@/lib/security/rate-limit";

const MAX_HTML_BYTES = 1_500_000;
const COLLECTION = "siteforgePublishedSites";

export const maxDuration = 60;

type Body = {
  userId?: string;
  html?: string;
  username?: string;
  /** Multi-page site: slug -> full HTML (slug "" = home). */
  pages?: Record<string, string>;
};

function looksLikeFullHtml(s: string) {
  return /<!doctype html/i.test(s) && /<\/html>\s*$/i.test(s.trim());
}

function normalizeUsername(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const currentUser = await requireCurrentServerUser();
    enforceRateLimit(request, "publish-site", { limit: 8, windowMs: 60_000, userId: currentUser.uid });
    enforceRateLimitByIp(request, "publish-site-ip", { limit: 20, windowMs: 60_000 });

    const body = (await request.json()) as Body;
    const username = normalizeUsername(body.username);

    let pages: SitePageMap = {};
    if (body.pages && typeof body.pages === "object" && !Array.isArray(body.pages)) {
      for (const [k, v] of Object.entries(body.pages)) {
        if (typeof v === "string" && looksLikeFullHtml(v)) {
          pages[normalizePageSlug(k)] = v;
        }
      }
    }
    const html =
      typeof body.html === "string" && looksLikeFullHtml(body.html)
        ? body.html
        : primaryHtmlFromPages(pages);
    if (html && !pages[""]) {
      pages[""] = html;
    }

    if (Object.keys(pages).length > 0) {
      pages = reconcileGeneratedPages(pages, { forceExpand: true });
    }

    const totalBytes = Object.values(pages).reduce((n, p) => n + Buffer.byteLength(p, "utf-8"), 0);
    if (totalBytes > MAX_HTML_BYTES) {
      return NextResponse.json(
        { ok: false, error: "HTML is too large to publish. Try trimming the page and saving again." },
        { status: 413 }
      );
    }
    if (!html.trim() || !looksLikeFullHtml(html) || Object.keys(pages).length === 0) {
      return NextResponse.json(
        { ok: false, error: "Valid full HTML (with doctype) is required to publish." },
        { status: 400 }
      );
    }

    const publishedPages: SitePageMap = {};
    for (const [slug, pageHtml] of Object.entries(pages)) {
      publishedPages[slug] = preparePublishedHtml(pageHtml, username, slug);
    }
    if (!username || username.length < 3) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid username or website name (at least 3 characters)." },
        { status: 400 }
      );
    }

    if (typeof body.userId === "string" && body.userId && body.userId !== currentUser.uid) {
      return NextResponse.json({ ok: false, error: "User mismatch." }, { status: 403 });
    }

    const existingSnap = await adminDb
      .collection(COLLECTION)
      .where("username", "==", username)
      .limit(1)
      .get();
    const existingDoc = existingSnap.docs[0];
    const existingUserId = String(existingDoc?.data()?.userId ?? "");
    if (existingDoc && existingUserId && existingUserId !== currentUser.uid) {
      return NextResponse.json(
        { ok: false, error: "Username already taken / or someone already took the website name " },
        { status: 409 }
      );
    }

    const origin = new URL(request.url).origin;
    const docId = existingDoc?.id || username;
    await adminDb.collection(COLLECTION).doc(docId).set(
      {
        username,
        userId: currentUser.uid,
        htmlContent: publishedPages[""] ?? preparePublishedHtml(html, username, ""),
        pages: publishedPages,
        createdAt: existingDoc ? existingDoc.data().createdAt : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      success: true,
      message: "Published successfully",
      username,
      url: `${origin}/${encodeURIComponent(username)}`,
    });
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    }
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "Too many publish attempts. Please wait and retry." },
        { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } }
      );
    }
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "You must be signed in to publish." }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Publish failed." },
      { status: 500 }
    );
  }
}
