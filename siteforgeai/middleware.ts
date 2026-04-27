import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROOT =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN?.replace(/^https?:\/\//, "").split("/")[0]?.replace(/^www\./, "") ||
  "siteforgeai.com";

export function middleware(request: NextRequest) {
  const hostHeader = request.headers.get("host") || "";
  const hostOnly = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  if (hostOnly === ROOT || hostOnly === `www.${ROOT}`) {
    return NextResponse.next();
  }
  if (hostOnly.endsWith(`.${ROOT}`)) {
    const sub = hostOnly.slice(0, hostOnly.length - (ROOT.length + 1));
    if (sub && !sub.includes(".") && sub !== "www") {
      const url = request.nextUrl.clone();
      url.pathname = `/sites/${sub}`;
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|api/|.*\\..*).*)"],
};
