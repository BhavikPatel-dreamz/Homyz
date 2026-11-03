import { SignJWT, jwtVerify } from "jose";

if (typeof (globalThis as any).structuredClone !== "function") {
  (globalThis as any).structuredClone = (val: any) => JSON.parse(JSON.stringify(val));
}

if (typeof (globalThis as any).crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (globalThis as any).crypto = require("crypto").webcrypto;
}

function previewSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to sign CMS preview tokens.");
  }
  return new TextEncoder().encode(secret);
}

export interface PreviewTokenPayload {
  contentId: string;
  versionId: string;
  actorId: string;
  type: string;
}

/**
 * Generate a short-lived signed JWT preview token (1 hour)
 */
export async function generatePreviewToken(payload: PreviewTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(previewSecret());
}

/**
 * Verify a preview token and extract target content/version IDs
 */
export async function verifyPreviewToken(token: string): Promise<PreviewTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, previewSecret());
    if (!payload.contentId || !payload.versionId) {
      return null;
    }
    return {
      contentId: String(payload.contentId),
      versionId: String(payload.versionId),
      actorId: String(payload.actorId || ""),
      type: String(payload.type || ""),
    };
  } catch {
    return null;
  }
}
