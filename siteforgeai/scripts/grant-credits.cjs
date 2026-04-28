const fs = require("node:fs");
const path = require("node:path");
const admin = require("firebase-admin");

function loadEnvFromDotLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found");
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  const emailArg = (process.argv[2] || "").trim().toLowerCase();
  const deltaArg = Number.parseInt(process.argv[3] || "0", 10);
  if (!emailArg || !Number.isFinite(deltaArg) || deltaArg <= 0) {
    throw new Error("Usage: node scripts/grant-credits.cjs <email> <positiveCredits>");
  }

  loadEnvFromDotLocal();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY");
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  const db = admin.firestore();
  const query = await db.collection("siteforgeUsers").where("email", "==", emailArg).limit(1).get();
  if (query.empty) {
    throw new Error(`No user found for email: ${emailArg}`);
  }

  const doc = query.docs[0];
  const data = doc.data() || {};
  const before = Number.isFinite(data.credits) ? Math.max(0, Math.floor(data.credits)) : 0;
  const after = before + deltaArg;
  await doc.ref.set({ credits: after, updatedAt: Date.now() }, { merge: true });

  console.log(
    JSON.stringify({
      ok: true,
      uid: doc.id,
      email: emailArg,
      before,
      added: deltaArg,
      after,
    })
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
