# SiteForge AI — Lemon Squeezy billing (production)

This app grants **AI credits** from Lemon Squeezy using a **signed webhook** (`POST /api/lemonsqueezy/webhook`), **Firestore** idempotency, and **Firebase Auth + Firestore** user resolution.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `LEMONSQUEEZY_WEBHOOK_SECRET` | **Yes** | Verifies `X-Signature` (HMAC-SHA256 of raw body). |
| `LEMONSQUEEZY_API_KEY` | Recommended | Creates hosted checkouts with `checkout_data.custom.uid` (ties purchase to Firebase UID). |
| `LEMONSQUEEZY_STORE_ID` | Recommended | Store id for checkout API. |
| `FIREBASE_*` admin vars | **Yes** | Server writes to Firestore + optional `getUserByEmail` fallback. |
| `SITEFORGE_ADMIN_SECRET` | Optional | Protects `GET /api/admin/billing-health` (header `x-siteforge-admin-secret` or `?secret=`). |

## Lemon dashboard checklist

1. **Settings → Webhooks → New webhook**  
   - **URL:** `https://<your-domain>/api/lemonsqueezy/webhook`  
   - **Signing secret:** paste into `LEMONSQUEEZY_WEBHOOK_SECRET` (same value in Vercel / hosting env).

2. **Subscribe to events** (minimum for credits + refunds + subscriptions):

   - `order_created` — credit packs (only **`status: paid`** rows grant credits).
   - `order_refunded` — reverses credits when a prior order was credited.
   - `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `subscription_paused`, `subscription_resumed`, `subscription_unpaused` — syncs `lemonSubscription` on `siteforgeUsers`.
   - `subscription_payment_success`, `subscription_payment_recovered` — logs paid invoice + `billing_transactions` row.
   - `subscription_payment_failed` — logged only.

3. **Checkout confirmation** (so the UI refreshes after payment): set the product confirmation button to  
   `https://<your-domain>/plans?billing=success`  
   The Plans page polls `/api/auth/me` for ~2 minutes to pick up new credits.

4. **Variant IDs:** `lib/lemonsqueezy/variant-credits.ts` must list every credit-pack variant id from your Lemon store.

## Firestore collections (server-written)

| Collection | Purpose |
|------------|---------|
| `siteforgeUsers/{uid}` | Profile + `credits`, optional `lemonSubscription`, `lemonLastPaidInvoiceId`. |
| `siteforgeUsers/{uid}/billing_transactions/*` | Ledger lines (`order_<id>`, `refund_<id>`, `invoice_<id>`). |
| `lemonsqueezy_processed_orders/{orderId}` | Idempotency + `creditsAdded`, `refundReversed`. |
| `lemonsqueezy_processed_invoices/{invoiceId}` | Idempotency for subscription invoices. |
| `billing_webhook_logs` | Structured webhook audit (also printed to server logs). |
| `billing_pending_lemon_orders/{orderId}` | When no Firebase user matched email (needs manual follow-up). |

### Indexes

If `GET /api/admin/billing-health` errors on `billing_webhook_logs` query, add a single-field index: **`createdAtMs` descending** on `billing_webhook_logs`.

If `listBillingTransactionsForUser` errors, add index: collection group or subcollection `billing_transactions` field **`createdAt` descending** (parent `siteforgeUsers`).

## Security model

- **Never** trust client-side credit updates; only the webhook (signature + Firestore transaction) increments balance for purchases.
- Checkout **custom `uid`** is set server-side in `create-api-checkout.ts` when using the API key path.
- **Fallback:** if `uid` is missing in webhook `meta.custom_data`, the server resolves **`siteforgeUsers` by email**, then **`adminAuth.getUserByEmail`** before giving up.

## Operations

- **Pending orders:** `node --env-file=.env.local scripts/list-pending-lemon-orders.mjs`
- **Health:** `curl -H "x-siteforge-admin-secret: $SITEFORGE_ADMIN_SECRET" "https://<domain>/api/admin/billing-health"`
- **Stuck credits after fixing config:** use Lemon’s webhook UI **Resend** on the `order_created` event (idempotent).

## Why credits “silently” failed before

Common causes: webhook pointed at a **different** server than Next; **raw body** altered so HMAC failed; only **`order_created` with unpaid status** processed; **email mismatch** between Firebase and checkout; **variant id** not in the map; webhook secret **not set** in production (503). This codebase now logs every path to console + `billing_webhook_logs`, requires **`status === paid`**, resolves users via **Auth email**, and records **pending** rows when resolution still fails.
