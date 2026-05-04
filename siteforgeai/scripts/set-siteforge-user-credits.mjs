/**
 * Read or set `siteforgeUsers` credit balance by email (Firebase Admin).
 *
 * Usage (from `siteforgeai/`):
 *   node --env-file=.env.local scripts/set-siteforge-user-credits.mjs get <email>
 *   node --env-file=.env.local scripts/set-siteforge-user-credits.mjs set <email> <credits> --yes
 *
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in env.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const USERS = "siteforgeUsers";

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

async function findByEmail(db, email) {
  const q = await db.collection(USERS).where("email", "==", email.trim().toLowerCase()).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  return { uid: doc.id, ...doc.data() };
}

async function main() {
  const [, , cmd, email, creditsRaw, confirm] = process.argv;
  if (!cmd || !email) {
    console.error(
      "Usage:\n  node --env-file=.env.local scripts/set-siteforge-user-credits.mjs get <email>\n  node --env-file=.env.local scripts/set-siteforge-user-credits.mjs set <email> <credits> --yes"
    );
    process.exit(1);
  }

  const db = getDb();
  const row = await findByEmail(db, email);
  if (!row) {
    console.error("No siteforgeUsers document for that email.");
    process.exit(2);
  }

  const cur =
    typeof row.credits === "number" && Number.isFinite(row.credits) ? Math.floor(row.credits) : 0;

  if (cmd === "get") {
    console.log(JSON.stringify({ uid: row.uid, email: row.email, credits: cur }, null, 2));
    return;
  }

  if (cmd !== "set") {
    console.error('First arg must be "get" or "set".');
    process.exit(1);
  }

  const next = Number.parseInt(String(creditsRaw), 10);
  if (!Number.isFinite(next) || next < 0 || next > 1_000_000_000) {
    console.error("Invalid credits; provide a non-negative integer.");
    process.exit(1);
  }
  if (confirm !== "--yes") {
    console.error('Refusing to write without literal "--yes" as the last argument.');
    process.exit(1);
  }

  await db.collection(USERS).doc(row.uid).set(
    {
      credits: next,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(JSON.stringify({ ok: true, uid: row.uid, email: row.email, was: cur, now: next }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
