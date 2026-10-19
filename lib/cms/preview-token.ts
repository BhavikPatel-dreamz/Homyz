import { SignJWT, jwtVerify } from "jose";

if (typeof (globalThis as any).structuredClone !== "function") {
  (globalThis as any).structuredClone = (val: any) => JSON.parse(JSON.stringify(val));
}

if (typeof (globalThis as any).crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (globalThis as any).crypto = require("crypto").webcrypto;
}

const PREVIEW_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "cms_preview_secret_homyz_key_32chars_min"
);

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
    .sign(PREVIEW_SECRET);
}

/**
 * Verify a preview token and extract target content/version IDs
 */
export async function verifyPreviewToken(token: string): Promise<PreviewTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, PREVIEW_SECRET);
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

