import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAuthSecureCookieFromRequest } from "@/lib/auth/auth-url";

const ROOT =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN?.replace(/^https?:\/\//, "").split("/")[0]?.replace(/^www\./, "") ||
  "siteforgeai.com";

const PROTECTED_PREFIXES = ["/dashboard", "/editor", "/preview", "/account"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  /** Never touch Auth.js or other API routes — middleware HTML/redirect breaks `fetch(...).json()` on `/api/auth/session`. */
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  const hostHeader = request.headers.get("host") || "";
  const hostOnly = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  if (hostOnly === ROOT || hostOnly === `www.${ROOT}`) {
    // continue
  } else if (hostOnly.endsWith(`.${ROOT}`)) {
    const sub = hostOnly.slice(0, hostOnly.length - (ROOT.length + 1));
    if (sub && !sub.includes(".") && sub !== "www") {
      const url = request.nextUrl.clone();
      const suffix = path === "/" || path === "" ? "" : path;
      url.pathname = `/${sub}${suffix}`;
      return NextResponse.rewrite(url);
    }
  }

  const needsAuth = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  if (needsAuth) {
    const secret = (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "").trim() || undefined;
    const secure = isAuthSecureCookieFromRequest(request);
    let token = secret
      ? await getToken({
          req: request,
          secret,
          secureCookie: secure,
        })
      : null;
    if (!token && secret) {
      token = await getToken({
        req: request,
        secret,
        secureCookie: !secure,
      });
    }
    if (!token) {
      const u = request.nextUrl.clone();
      u.pathname = "/get-started";
      u.searchParams.set("message", "Please sign in to continue.");
      return NextResponse.redirect(u);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|api/|.*\\..*).*)"],
};
