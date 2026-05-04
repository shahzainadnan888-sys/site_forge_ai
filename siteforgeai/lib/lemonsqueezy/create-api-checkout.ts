/**
 * Creates a hosted checkout via Lemon Squeezy API (returns a working URL; unlike
 * hand-built `/checkout/buy/<numeric-id>` links which often 404).
 * @see https://docs.lemonsqueezy.com/api/checkouts/create-checkout
 */
export async function createLemonSqueezyHostedCheckoutUrl(opts: {
  storeId: string;
  variantId: string;
  apiKey: string;
  email: string;
  uid: string;
  credits: number;
}): Promise<{ ok: true; url: string } | { ok: false; message: string; status?: number }> {
  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: opts.email,
          custom: {
            uid: opts.uid,
            selected_credits: String(opts.credits),
            source: "plans_page",
          },
        },
      },
      relationships: {
        store: { data: { type: "stores", id: opts.storeId } },
        variant: { data: { type: "variants", id: opts.variantId } },
      },
    },
  };

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as
    | {
        data?: { attributes?: { url?: string } };
        errors?: Array<{ detail?: string; title?: string }>;
      }
    | null;

  if (!res.ok) {
    const err = json?.errors?.[0];
    const message = err?.detail || err?.title || `Lemon API error (${res.status})`;
    return { ok: false, message, status: res.status };
  }

  const url = json?.data?.attributes?.url;
  if (typeof url !== "string" || !url.trim()) {
    return { ok: false, message: "Checkout response missing URL." };
  }
  return { ok: true, url: url.trim() };
}
