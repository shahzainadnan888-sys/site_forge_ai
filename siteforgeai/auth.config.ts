import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authLogger } from "@/lib/auth/auth-logger";
import { normalizeAuthBaseUrl } from "@/lib/auth/auth-url";
import { signInWithEmailPasswordFirebase } from "@/lib/auth/firebase-password-sign-in";
import { resolveFirestoreProfileUidForNextAuth } from "@/lib/auth/user-store";

const googleClientId =
  process.env.GOOGLE_CLIENT_ID?.trim() || process.env.AUTH_GOOGLE_ID?.trim() || "";
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET?.trim() || process.env.AUTH_GOOGLE_SECRET?.trim() || "";

const googleOAuthConfigured = Boolean(googleClientId && googleClientSecret);

if (!googleOAuthConfigured) {
  authLogger.warn(
    "Google OAuth is disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET). Email/password sign-in still works."
  );
}

const providers: Provider[] = [];

if (googleOAuthConfigured) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: { params: { prompt: "select_account" } },
    })
  );
}

providers.push(
  Credentials({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email.trim() || !password) return null;
        const res = await signInWithEmailPasswordFirebase(email, password);
        if (!res.ok) return null;
        return {
          id: res.uid,
          email: res.email,
          name: res.displayName || res.email.split("@")[0] || "User",
          emailVerified: true,
        };
      },
    })
);

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 5 },
  pages: { signIn: "/get-started", error: "/get-started" },
  providers,
  events: {
    async signIn(message) {
      const m = message as { account?: { provider?: string } };
      authLogger.debug("signIn event", { provider: m.account?.provider });
    },
  },
  callbacks: {
    /**
     * OAuth post-login redirects: keep relative URLs on this origin; default unknown off-site URLs to dashboard.
     */
    async redirect({ url, baseUrl }) {
      const base = normalizeAuthBaseUrl(baseUrl);
      if (url.startsWith("/")) return `${base}${url}`;
      try {
        const target = new URL(url);
        if (target.origin === new URL(base).origin) return url;
      } catch {
        /* ignore malformed */
      }
      return `${base}/dashboard`;
    },
    async jwt({ token, user, account, profile }) {
      if (!user) {
        return token;
      }

      if (account?.provider === "credentials") {
        token.firestoreUid = String(user.id || "");
        token.email = (user.email || "").trim().toLowerCase();
        token.name = user.name || (token.email as string).split("@")[0] || "User";
        token.emailVerified = true;
        return token;
      }

      const iss = typeof (profile as { iss?: string } | undefined)?.iss === "string" ? (profile as { iss: string }).iss : "";
      const isGoogle =
        account?.provider === "google" ||
        (account?.provider === "oidc" && iss === "https://accounts.google.com") ||
        iss === "https://accounts.google.com";

      if (!isGoogle) {
        return token;
      }

      const email = (user.email || (profile as { email?: string } | undefined)?.email || "")
        .trim()
        .toLowerCase();
      const sub = String(
        account?.providerAccountId || (profile as { sub?: string } | undefined)?.sub || user.id || ""
      ).trim();

      if (!email) {
        authLogger.warn("Google JWT: missing email on user/profile", { sub });
        return token;
      }
      if (!sub) {
        authLogger.warn("Google JWT: missing provider subject", { email });
        return token;
      }

      try {
        const { firestoreUid } = await resolveFirestoreProfileUidForNextAuth({
          providerSub: sub,
          email,
          name: user.name || (profile as { name?: string } | undefined)?.name,
        });
        token.firestoreUid = firestoreUid;
        token.email = email;
        token.name = user.name || (profile as { name?: string } | undefined)?.name || email.split("@")[0];
        const prof = profile as { email_verified?: boolean } | undefined;
        token.emailVerified = prof?.email_verified === true;
      } catch (err) {
        authLogger.jwtFailure(err, {
          email,
          sub,
          hint: "If you see PERMISSION_DENIED, grant the Firestore Admin service account roles/datastore.user (or Editor) on the GCP project. Empty GOOGLE_CLIENT_ID also causes Configuration errors.",
        });
        token.firestoreUid = sub;
        token.email = email;
        token.name = user.name || (profile as { name?: string } | undefined)?.name || email.split("@")[0];
        const prof = profile as { email_verified?: boolean } | undefined;
        token.emailVerified = prof?.email_verified === true;
      }

      return token;
    },
    async session({ session, token }) {
      const uid = typeof token.firestoreUid === "string" ? token.firestoreUid : "";
      if (session.user) {
        if (uid) session.user.id = uid;
        session.user.email = (token.email as string) || session.user.email || "";
        session.user.name = (token.name as string) || session.user.name || "";
        (session.user as unknown as { emailVerified?: boolean }).emailVerified = token.emailVerified === true;
        session.firestoreUid = uid;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
