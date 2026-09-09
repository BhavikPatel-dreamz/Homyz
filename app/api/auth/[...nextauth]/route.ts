import NextAuth from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth/options";

// Automatically synchronize NEXTAUTH_URL and AUTH_TRUST_HOST based on the incoming request.
// This guarantees that whether accessed via http://8.213.86.216:3000, http://localhost:3000,
// or a custom domain, NextAuth operates on the true request origin rather than a hardcoded default.
function syncAuthEnvironment(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
    const isIp = /^\d+\.\d+\.\d+\.\d+/.test(host);
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const proto = forwardedProto || (isLocal || isIp ? "http" : "https");
    const detectedOrigin = `${proto}://${host}`;

    process.env.NEXTAUTH_URL = detectedOrigin;
    process.env.APP_URL = detectedOrigin;
    process.env.AUTH_TRUST_HOST = "true";
  }
}

const authHandler = NextAuth(authOptions);

export async function GET(req: NextRequest, ctx: any) {
  syncAuthEnvironment(req);
  const res = await authHandler(req, ctx);

  // If this is a session check (/api/auth/session) and NextAuth returned an empty object {}
  // (e.g. due to cookie prefix mismatch across HTTP/HTTPS or Bearer header usage),
  // recover the session directly from the token so callers never get a false empty {} response.
  const url = new URL(req.url);
  if (url.pathname.endsWith("/session")) {
    try {
      const clonedRes = res.clone();
      const body = await clonedRes.json().catch(() => null);
      if (!body || (typeof body === "object" && Object.keys(body).length === 0)) {
        const secret = process.env.NEXTAUTH_SECRET;
        let token = await getToken({ req, secret });
        if (!token) {
          token = await getToken({ req, secret, secureCookie: false });
        }
        if (!token) {
          token = await getToken({ req, secret, secureCookie: true });
        }

        if (token?.id) {
          const sessionPayload = {
            user: {
              name: token.name ?? null,
              email: token.email ?? null,
              image: token.picture ?? null,
              id: token.id,
              role: token.role,
              status: token.status,
              adminRoleSlug: token.adminRoleSlug ?? null,
              permissions: token.permissions ?? [],
              tokenVersion: token.tokenVersion ?? 0,
            },
            expires: token.exp
              ? new Date((token.exp as number) * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };

          return NextResponse.json(sessionPayload, {
            status: 200,
            headers: res.headers,
          });
        }
      }
    } catch {
      // Fall through to standard response
    }
  }

  return res;
}

export async function POST(req: NextRequest, ctx: any) {
  syncAuthEnvironment(req);
  return authHandler(req, ctx);
}
