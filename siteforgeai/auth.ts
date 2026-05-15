import "./lib/auth/bootstrap-auth-env.server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { getAuthPublicBaseUrl } from "./lib/auth/auth-url";
import { authLogger } from "./lib/auth/auth-logger";
import { resolveAuthSecret } from "./lib/auth/resolve-auth-secret";

const secret = resolveAuthSecret();

if (!secret) {
  authLogger.error(
    "AUTH_SECRET (or NEXTAUTH_SECRET) is missing. Set it in .env.local (dev) or your host env (production), then restart."
  );
}

const publicBase = getAuthPublicBaseUrl();
const googleRedirectUri = publicBase ? `${publicBase}/api/auth/callback/google` : "";
if (googleRedirectUri) {
  authLogger.debug("OAuth callback (Google Cloud Console → OAuth client → Authorized redirect URIs)", {
    redirectUri: googleRedirectUri,
  });
  if (process.env.NODE_ENV === "development") {
    authLogger.warn(
      `Google OAuth: register this exact Authorized redirect URI (error 400 redirect_uri_mismatch if it is missing or differs by even one character): ${googleRedirectUri}`
    );
  }
} else {
  authLogger.warn(
    "AUTH_URL / NEXTAUTH_URL is not set. Set AUTH_URL to the origin you use in the browser (e.g. http://localhost:3000) or Google returns redirect_uri_mismatch."
  );
}

const authDebug = process.env.AUTH_DEBUG === "1" || process.env.NODE_ENV === "development";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret,
  debug: authDebug,
  logger: {
    debug(message, metadata) {
      if (authDebug) authLogger.debug(String(message), metadata as Record<string, unknown> | undefined);
    },
    warn(message) {
      authLogger.warn(String(message));
    },
    error(error) {
      authLogger.error("Auth.js core error", {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      });
    },
  },
});
