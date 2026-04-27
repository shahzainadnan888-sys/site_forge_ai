/**
 * Lemon Squeezy webhook server for a credit system.
 * Run: npm install && npm start
 * Default port: 3001 (set PORT env to change)
 *
 * - Set LEMONSQUEEZY_WEBHOOK_SECRET in .env to verify X-Signature (HMAC-SHA256 of raw body).
 *   See: https://docs.lemonsqueezy.com/help/webhooks/webhook-requests#signing-requests
 *
 * Webhook payload: https://docs.lemonsqueezy.com/help/webhooks/example-payloads
 */

const crypto = require("node:crypto");
const express = require("express");

const app = express();

/** In-memory user store: email -> { credits: number } */
const users = {};

const processedOrderIds = new Set();

const CREDITS_BY_VARIANT = {
  "10 Credits": 10,
  "25 Credits": 25,
  "35 Credits": 35,
  "50 Credits": 50,
  "100 Credits": 100,
  "250 Credits": 250,
  "500 Credits": 500,
  "1000 Credits": 1000,
};

const ORDER_EVENTS = new Set(["order_created", "order_paid"]);

function getCreditsForVariantName(variantName) {
  if (typeof variantName !== "string") return null;
  const trimmed = variantName.trim();
  if (Object.prototype.hasOwnProperty.call(CREDITS_BY_VARIANT, trimmed)) {
    return CREDITS_BY_VARIANT[trimmed];
  }
  return null;
}

function extractOrderFields(body) {
  const attrs = body?.data?.attributes;
  if (!attrs) return { email: null, variantName: null };

  const email = typeof attrs.user_email === "string" ? attrs.user_email.trim() : null;
  const first = attrs.first_order_item;
  const variantName =
    first && typeof first.variant_name === "string" ? first.variant_name.trim() : null;

  return { email, variantName };
}

/**
 * @param {Buffer} rawBuffer
 * @param {string | undefined} headerSig
 * @param {string} secret
 */
function verifyLemonSqueezySignature(rawBuffer, headerSig, secret) {
  if (!headerSig) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBuffer);
  const expectedHex = hmac.digest("hex");
  const got = String(headerSig).toLowerCase().trim();
  if (expectedHex.length !== got.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(got, "hex"));
  } catch {
    return false;
  }
}

function processWebhookBody(body) {
  const eventName = body?.meta?.event_name;
  console.log("[webhook] event:", eventName);

  if (!ORDER_EVENTS.has(eventName)) {
    console.log("[webhook] ignored (not order_created / order_paid)");
    return { status: 200, json: { ok: true, message: "ignored" } };
  }

  const orderId = body?.data?.id != null ? String(body.data.id) : null;
  if (orderId && processedOrderIds.has(orderId)) {
    console.log("[webhook] duplicate order, skip:", orderId);
    return { status: 200, json: { ok: true, message: "duplicate order" } };
  }

  const { email, variantName } = extractOrderFields(body);

  if (!email) {
    console.log("[webhook] no user_email on order; nothing to do");
    return { status: 200, json: { ok: true, message: "no email" } };
  }

  const creditsToAdd = getCreditsForVariantName(variantName);
  if (creditsToAdd == null) {
    console.log("[webhook] unknown variant name:", JSON.stringify(variantName));
    return { status: 200, json: { ok: true, message: "unknown variant" } };
  }

  if (!users[email]) {
    users[email] = { credits: 0 };
  }
  users[email].credits += creditsToAdd;
  if (orderId) processedOrderIds.add(orderId);

  console.log("[webhook] email:", email);
  console.log("[webhook] credits added:", creditsToAdd, "| total:", users[email].credits);

  return {
    status: 200,
    json: { ok: true, email, creditsAdded: creditsToAdd, total: users[email].credits },
  };
}

// Raw body required for HMAC verification — must be registered before express.json()
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const raw = /** @type {Buffer} */ (req.body);
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
    if (secret) {
      const sig = req.get("X-Signature") || req.get("x-signature");
      if (!verifyLemonSqueezySignature(raw, sig, secret)) {
        console.warn("[webhook] bad signature (check LEMONSQUEEZY_WEBHOOK_SECRET and raw body handling)");
        return res.status(401).json({ ok: false, error: "Invalid signature" });
      }
    }

    let body;
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Invalid JSON" });
    }

    try {
      const out = processWebhookBody(body);
      return res.status(out.status).json(out.json);
    } catch (err) {
      console.error("[webhook] error:", err);
      return res.status(500).json({ ok: false, error: "processing error" });
    }
  }
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`Lemon Squeezy webhook server listening on http://localhost:${PORT}`);
  console.log("POST /webhook (HMAC with LEMONSQUEEZY_WEBHOOK_SECRET if set)");
});
