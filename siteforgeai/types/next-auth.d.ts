import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    firestoreUid?: string;
    user: DefaultSession["user"] & { id?: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    firestoreUid?: string;
    email?: string;
    name?: string;
    emailVerified?: boolean;
  }
}
