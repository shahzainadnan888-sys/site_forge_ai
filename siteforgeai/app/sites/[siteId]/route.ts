import { getPublishedHtmlBySiteId } from "@/lib/publish/published-site-store";
import { isValidSiteId } from "@/lib/publish/site-id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await context.params;
  if (!siteId || !isValidSiteId(siteId)) {
    return new Response("Not found", { status: 404 });
  }
  const html = await getPublishedHtmlBySiteId(siteId);
  if (!html) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=30, s-maxage=30",
    },
  });
}
