import { after, NextResponse } from "next/server";
import { requireVerifiedServerUser } from "@/lib/auth/current-user";
import {
  getPublishedMeta,
  mergePublishedVercelProject,
  writePublishedSite,
} from "@/lib/publish/published-site-store";
import { getAppOriginFromRequest, getPublishedSiteUrls } from "@/lib/publish/public-url";
import { generateSiteId, isValidSiteId } from "@/lib/publish/site-id";
import { deployStaticSiteToVercelIfConfigured } from "@/lib/vercel/deployments";
import { assertSameOrigin, CsrfError } from "@/lib/security/csrf";
import { enforceRateLimit, enforceRateLimitByIp, RateLimitError } from "@/lib/security/rate-limit";

/** Over ~950KB requires Firebase Storage (GCS); under uses fast Firestore-only. */
const MAX_HTML_BYTES = 1_500_000;

export const maxDuration = 60;

type Body = {
  userId?: string;
  siteId?: string | null;
  html?: string;
};

function looksLikeFullHtml(s: string) {
  return /<!doctype html/i.test(s) && /<\/html>\s*$/i.test(s.trim());
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const currentUser = await requireVerifiedServerUser();
    enforceRateLimit(request, "publish-site", { limit: 8, windowMs: 60_000, userId: currentUser.uid });
    enforceRateLimitByIp(request, "publish-site-ip", { limit: 20, windowMs: 60_000 });

    const body = (await request.json()) as Body;
    const html = typeof body.html === "string" ? body.html : "";
    if (Buffer.byteLength(html, "utf-8") > MAX_HTML_BYTES) {
      return NextResponse.json(
        { ok: false, error: "HTML is too large to publish. Try trimming the page and saving again." },
        { status: 413 }
      );
    }
    if (!html.trim() || !looksLikeFullHtml(html)) {
      return NextResponse.json(
        { ok: false, error: "Valid full HTML (with doctype) is required to publish." },
        { status: 400 }
      );
    }

    if (typeof body.userId === "string" && body.userId && body.userId !== currentUser.uid) {
      return NextResponse.json({ ok: false, error: "User mismatch." }, { status: 403 });
    }

    const requestedId = body.siteId?.trim() || "";
    const siteId = requestedId && isValidSiteId(requestedId) ? requestedId : generateSiteId();
    if (requestedId && !isValidSiteId(requestedId)) {
      return NextResponse.json({ ok: false, error: "Invalid siteId." }, { status: 400 });
    }

    const existing = await getPublishedMeta(siteId);
    if (existing && existing.ownerUid && existing.ownerUid !== currentUser.uid) {
      return NextResponse.json(
        { ok: false, error: "This site is owned by another account." },
        { status: 403 }
      );
    }

    await writePublishedSite({
      siteId,
      ownerUid: currentUser.uid,
      html,
    });

    const origin = getAppOriginFromRequest(request);
    const { pathUrl, subdomainUrl } = getPublishedSiteUrls(origin, siteId);

    after(() => {
      void (async () => {
        const vercel = await deployStaticSiteToVercelIfConfigured({ siteId, html });
        if (vercel.ok) {
          await mergePublishedVercelProject(siteId, vercel.projectId);
        }
      })();
    });

    return NextResponse.json({
      ok: true,
      siteId,
      url: pathUrl,
      urlSubdomain: subdomainUrl,
      vercel: { pending: true as const },
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
    if (e instanceof Error && e.message === "UNVERIFIED_EMAIL") {
      return NextResponse.json({ ok: false, error: "Verify email first" }, { status: 403 });
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
