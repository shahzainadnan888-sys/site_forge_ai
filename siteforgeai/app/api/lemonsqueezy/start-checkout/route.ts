import { NextResponse } from "next/server";
import { getCurrentServerUser } from "@/lib/auth/current-user";
import {
  buildLemonCheckoutPrefillUrl,
  resolveLemonSqueezyCheckoutBaseUrl,
} from "@/lib/lemon-squeezy-checkout";
import { isLemonCreditPack } from "@/lib/lemon-squeezy-credit-packs";
import { createLemonSqueezyHostedCheckoutUrl } from "@/lib/lemonsqueezy/create-api-checkout";
import { lemonVariantIdForCredits } from "@/lib/lemonsqueezy/variant-credits";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function resolveLemonStoreId(): string | undefined {
  const a = process.env.LEMONSQUEEZY_STORE_ID?.trim();
  const b = process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID?.trim();
  return a || b || undefined;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentServerUser();
    if (!user) {
      const loc = new URL("/get-started", req.url);
      loc.searchParams.set(
        "message",
        "Please sign in to buy credits. Your purchase is tied to your account."
      );
      return NextResponse.redirect(loc, 302);
    }

    const { searchParams } = new URL(req.url);
    const credits = Number.parseInt(searchParams.get("credits") || "", 10);
    if (!isLemonCreditPack(credits)) {
      return NextResponse.json({ ok: false, error: "Invalid credit pack." }, { status: 400 });
    }

    enforceRateLimit(req, "lemon-start-checkout", { limit: 30, windowMs: 60_000, userId: user.uid });

    const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
    const storeId = resolveLemonStoreId();

    if (apiKey && storeId) {
      const variantId = lemonVariantIdForCredits(credits);
      if (!variantId) {
        return NextResponse.json({ ok: false, error: "Unknown pack variant mapping." }, { status: 400 });
      }
      const created = await createLemonSqueezyHostedCheckoutUrl({
        storeId,
        variantId,
        apiKey,
        email: user.email,
        uid: user.uid,
        credits,
      });
      if (created.ok) {
        return NextResponse.redirect(created.url, 302);
      }
      const code =
        created.status && created.status >= 400 && created.status < 600 ? created.status : 502;
      return NextResponse.json({ ok: false, error: created.message }, { status: code });
    }

    const base = resolveLemonSqueezyCheckoutBaseUrl(credits);
    if (base) {
      const target = buildLemonCheckoutPrefillUrl(base, {
        email: user.email,
        uid: user.uid,
        credits,
      });
      return NextResponse.redirect(target, 302);
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          "Checkout is not configured. Add LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID (Lemon Settings → API and Stores), or set NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_* to the Share checkout URLs from your dashboard.",
      },
      { status: 503 }
    );
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
    }
    throw e;
  }
}
