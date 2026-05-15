import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixAuthUrlEnvVars } from "@/lib/auth/auth-url";

/** `siteforgeai/` app root (this file: `siteforgeai/lib/auth/…`). */
const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Auth.js + Google OAuth + Firebase Admin (Firestore). Hydrates missing keys from `.env` files for Turbopack / load-order parity. */
const KEYS_TO_HYDRATE = [
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

function parseDotEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function envHasValue(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/**
 * Merges Auth.js, Google OAuth, and Firebase Admin vars from `.env.local` / `.env` when they are
 * missing from `process.env` (fixes Turbopack / load-order gaps).
 */
export function hydrateAuthEnvFromLocalFiles(): void {
  const candidates = [
    path.join(APP_ROOT, ".env.local"),
    path.join(APP_ROOT, ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "siteforgeai", ".env.local"),
  ];

  const needAny = KEYS_TO_HYDRATE.some((k) => !envHasValue(k));
  if (!needAny) return;

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const parsed = parseDotEnvLine(line);
      if (!parsed) continue;
      if (!KEYS_TO_HYDRATE.includes(parsed.key as (typeof KEYS_TO_HYDRATE)[number])) continue;
      if (envHasValue(parsed.key)) continue;
      process.env[parsed.key] = parsed.value;
    }
  }
}

hydrateAuthEnvFromLocalFiles();
fixAuthUrlEnvVars();
