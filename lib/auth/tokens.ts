import { createHash } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";

import type { Role } from "@/generated/prisma/enums";

// App-signed tokens for the MOBILE clients (web uses the NextAuth cookie).
// Access token: short-lived, carries { sub, role }. Refresh token: long-lived,
// carries { sub, jti }; its hash is stored in the DB, rotated on refresh and
// revoked on logout. HS256 via `jose` — no custom crypto.

const encoder = new TextEncoder();

function requireSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): Uint8Array {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return encoder.encode(value);
}

function accessTtlSeconds(): number {
  return Number(process.env.ACCESS_TOKEN_TTL ?? 900);
}
function refreshTtlSeconds(): number {
  return Number(process.env.REFRESH_TOKEN_TTL ?? 2_592_000);
}

export interface AccessClaims {
  sub: string;
  role: Role;
}

export async function signAccessToken(
  userId: string,
  role: Role,
): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${accessTtlSeconds()}s`)
    .sign(requireSecret("JWT_ACCESS_SECRET"));
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, requireSecret("JWT_ACCESS_SECRET"));
    if (!payload.sub || typeof payload.role !== "string") return null;
    return { sub: payload.sub, role: payload.role as Role };
  } catch {
    return null;
  }
}

export interface SignedRefreshToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export async function signRefreshToken(
  userId: string,
): Promise<SignedRefreshToken> {
  const jti = nanoid(32);
  const ttl = refreshTtlSeconds();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(requireSecret("JWT_REFRESH_SECRET"));
  return { token, jti, expiresAt: new Date(Date.now() + ttl * 1000) };
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ sub: string; jti: string } | null> {
  try {
    const { payload } = await jwtVerify(token, requireSecret("JWT_REFRESH_SECRET"));
    if (!payload.sub || !payload.jti) return null;
    return { sub: payload.sub, jti: payload.jti };
  } catch {
    return null;
  }
}

/** SHA-256 hex digest for storing high-entropy tokens (refresh, reset) at rest. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
