import { fixAuthUrlEnvVars } from "@/lib/auth/auth-url";

function envHasValue(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/** Local dev only — avoids Auth.js `error=Configuration` when `.env.local` omits AUTH_SECRET. */
function ensureDevAuthSecret(): void {
  if (process.env.NODE_ENV === "production") return;
  if (envHasValue("AUTH_SECRET") || envHasValue("NEXTAUTH_SECRET")) return;
  process.env.AUTH_SECRET = "siteforge-local-dev-auth-secret";
  console.warn(
    "[auth] AUTH_SECRET is not set; using a local dev fallback. Add AUTH_SECRET to .env.local (e.g. `openssl rand -base64 32`)."
  );
}

fixAuthUrlEnvVars();
ensureDevAuthSecret();

export function resolveAuthSecret(): string | undefined {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
  return secret || undefined;
}
