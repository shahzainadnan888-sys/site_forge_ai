import { handlers } from "@/auth";
import { syncAuthUrlFromRequest } from "@/lib/auth/auth-url";
import type { NextRequest } from "next/server";

/** Avoid Edge runtime quirks with JWT/crypto; keeps `/api/auth/session` JSON responses stable. */
export const runtime = "nodejs";

async function runWithSyncedAuthUrl(request: NextRequest, method: "GET" | "POST"): Promise<Response> {
  syncAuthUrlFromRequest(request);
  return method === "GET" ? handlers.GET(request) : handlers.POST(request);
}

export async function GET(request: NextRequest) {
  return runWithSyncedAuthUrl(request, "GET");
}

export async function POST(request: NextRequest) {
  return runWithSyncedAuthUrl(request, "POST");
}
