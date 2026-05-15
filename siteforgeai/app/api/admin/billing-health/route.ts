import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight admin probe: recent webhook log rows + pending manual-reconciliation orders.
 * Protect with `SITEFORGE_ADMIN_SECRET` (header `x-siteforge-admin-secret` or `?secret=`).
 */
export async function GET(req: Request) {
  const expected = process.env.SITEFORGE_ADMIN_SECRET?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "Admin secret not configured." }, { status: 503 });
  }
  const url = new URL(req.url);
  const got = (req.headers.get("x-siteforge-admin-secret") || url.searchParams.get("secret") || "").trim();
  if (got !== expected) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const logsSnap = await adminDb
      .collection("billing_webhook_logs")
      .orderBy("createdAtMs", "desc")
      .limit(40)
      .get();

    const pendingSnap = await adminDb.collection("billing_pending_lemon_orders").limit(25).get();

    return NextResponse.json({
      ok: true,
      recentWebhookLogs: logsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })),
      pendingOrders: pendingSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })),
    });
  } catch (e) {
    console.error("[admin/billing-health]", e);
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }
}
