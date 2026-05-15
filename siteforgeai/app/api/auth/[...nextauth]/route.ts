import { handlers } from "@/auth";

/** Avoid Edge runtime quirks with JWT/crypto; keeps `/api/auth/session` JSON responses stable. */
export const runtime = "nodejs";

export const { GET, POST } = handlers;
