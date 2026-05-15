/**
 * List `billing_pending_lemon_orders` (orders where no Firebase user matched at webhook time).
 *
 *   node --env-file=.env.local scripts/list-pending-lemon-orders.mjs
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function requiredEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function getDb() {
  if (!getApps().length) {
    const key = requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
    initializeApp({
      credential: cert({
        projectId: requiredEnv("FIREBASE_PROJECT_ID"),
        clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
        privateKey: key,
      }),
    });
  }
  return getFirestore();
}

async function main() {
  const db = getDb();
  const snap = await db.collection("billing_pending_lemon_orders").limit(50).get();
  if (snap.empty) {
    console.log("No pending rows.");
    return;
  }
  for (const d of snap.docs) {
    console.log(JSON.stringify({ id: d.id, ...d.data() }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
