import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// OPTIMISTIC redirects only. This is NOT the authorization boundary — the real
// server-side checks live in each page via requirePageUser()/requirePageRole()
// (which render unauthorized.tsx / forbidden.tsx) and inside every service,
// route handler and Server Action. Proxy just avoids showing a flash of a page
// the user could never load. Per the Next.js 16 docs, Server Functions are
// POSTs to the page route, so a matcher change must never be relied on for
// security — hence the redundant in-page guards.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // /admin/login is a public authentication route
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Unauthenticated → login, preserving the intended destination.
  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = token.role;

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (
    pathname.startsWith("/host") &&
    role !== "HOST" &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/host/:path*",
    "/dashboard/:path*",
    "/profile/:path*",
    "/bookings/:path*",
    "/favorites/:path*",
  ],
};
