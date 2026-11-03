import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { recordPublicRequest } from "@/lib/diagnostics/public-diagnostics";

/**
 * Records redacted application traffic. Static assets are intentionally
 * excluded so the diagnostics file remains useful instead of being dominated
 * by JavaScript, CSS, and image requests.
 */
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // Reading diagnostics must not manufacture another request log entry.
  if (pathname !== "/api/diagnostics.log") {
    event.waitUntil(recordPublicRequest(request.method, pathname));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:css|js|map|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)"],
};
