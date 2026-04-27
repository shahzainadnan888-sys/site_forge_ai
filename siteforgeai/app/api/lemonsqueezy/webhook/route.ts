import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { grantPurchasedCredits } from "@/lib/auth/user-store";
import { logSecurityEvent } from "@/lib/security/security-log";

export const runtime = "nodejs";

const CREDITS_BY_VARIANT_NAME: Record<string, number> = {
  "10 Credits": 10,
  "25 Credits": 25,
  "35 Credits": 35,
  "50 Credits": 50,
  "100 Credits": 100,
  "250 Credits": 250,
  "500 Credits": 500,
  "1000 Credits": 1000,
};

type LemonOrderPayload = {
  meta?: {
    event_name?: string;
  };
  data?: {
    id?: string | number;
    attributes?: {
      user_email?: string;
      first_order_item?: {
        variant_name?: string;
      };
      custom_data?: {
        uid?: string;
      };
    };
  };
};

function verifySignature(rawBody: string, signatureHeader: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const got = signatureHeader.trim().toLowerCase();
  if (expected.length !== got.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(got, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  const headerSig =
    req.headers.get("x-signature") || req.headers.get("X-Signature") || "";

  if (secret && !verifySignature(rawBody, headerSig, secret)) {
    logSecurityEvent(req, "input_rejected", {
      route: "lemonsqueezy-webhook",
      reason: "bad_signature",
    });
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  let body: LemonOrderPayload;
  try {
    body = JSON.parse(rawBody) as LemonOrderPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const eventName = body.meta?.event_name?.trim();
  if (eventName !== "order_paid" && eventName !== "order_created") {
    return NextResponse.json({ ok: true, ignored: true, reason: "event_not_supported" });
  }

  const orderId = body.data?.id != null ? String(body.data.id) : "";
  const email = body.data?.attributes?.user_email?.trim().toLowerCase() || "";
  const uid = body.data?.attributes?.custom_data?.uid?.trim() || "";
  const variantName = body.data?.attributes?.first_order_item?.variant_name?.trim() || "";
  const credits = CREDITS_BY_VARIANT_NAME[variantName];

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "Missing order id." }, { status: 400 });
  }
  if (!email && !uid) {
    return NextResponse.json(
      { ok: false, error: "Missing user identity (email/uid)." },
      { status: 400 }
    );
  }
  if (!credits) {
    return NextResponse.json(
      { ok: false, error: `Unknown Lemon variant: ${variantName || "n/a"}` },
      { status: 400 }
    );
  }

  try {
    const result = await grantPurchasedCredits({
      provider: "lemonsqueezy",
      orderId,
      credits,
      email: email || null,
      uid: uid || null,
    });
    return NextResponse.json({
      ok: true,
      applied: result.applied,
      orderId,
      creditsAdded: result.applied ? credits : 0,
      uid: result.user?.uid || null,
    });
  } catch (error) {
    logSecurityEvent(req, "input_rejected", {
      route: "lemonsqueezy-webhook",
      reason: "credit_grant_failed",
      err: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to apply purchased credits.",
      },
      { status: 500 }
    );
  }
}
