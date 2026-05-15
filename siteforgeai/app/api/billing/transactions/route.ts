import { NextResponse } from "next/server";
import { requireCurrentServerUser } from "@/lib/auth/current-user";
import { listBillingTransactionsForUser } from "@/lib/auth/user-store";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function serializeTimestamp(v: unknown): string | null {
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const user = await requireCurrentServerUser();
    enforceRateLimit(req, "billing-tx-list", { limit: 60, windowMs: 60_000, userId: user.uid });
    const rows = await listBillingTransactionsForUser(user.uid, 50);
    const items = rows.map(({ id, data }) => ({
      id,
      kind: typeof data.kind === "string" ? data.kind : null,
      provider: typeof data.provider === "string" ? data.provider : null,
      orderId: typeof data.orderId === "string" ? data.orderId : null,
      invoiceId: typeof data.invoiceId === "string" ? data.invoiceId : null,
      subscriptionId: typeof data.subscriptionId === "string" ? data.subscriptionId : null,
      variantId: typeof data.variantId === "string" ? data.variantId : null,
      credits: typeof data.credits === "number" && Number.isFinite(data.credits) ? data.credits : null,
      billingReason: typeof data.billingReason === "string" ? data.billingReason : null,
      createdAt: serializeTimestamp(data.createdAt),
    }));
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("[billing/transactions]", error);
    return NextResponse.json({ ok: false, error: "Unable to load transactions." }, { status: 500 });
  }
}
