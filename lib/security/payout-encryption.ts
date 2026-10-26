import crypto from "node:crypto";

/**
 * Payout Account Identifier Encryption & Deduplication Utilities
 * Uses AES-256-GCM with authenticated encryption for at-rest protection
 * of full Saudi IBANs and sensitive banking identifiers.
 */

const SALT = "homyz-payout-encryption-salt-v1";
const ALGORITHM = "aes-256-gcm";

function getDerivedKey(): Buffer {
  const secret =
    process.env.PAYOUT_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ||
    "homyz-dev-fallback-payout-encryption-secret-key";

  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Encrypts a sensitive account identifier (e.g. clean IBAN).
 * Returns serialized format: `ivHex:authTagHex:cipherTextHex`
 */
export function encryptAccountIdentifier(plainText: string): string {
  if (!plainText) return "";
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an encrypted account identifier.
 * Validates the authentication tag to ensure data integrity.
 */
export function decryptAccountIdentifier(cipherText: string): string | null {
  if (!cipherText) return null;
  const parts = cipherText.split(":");
  if (parts.length !== 3) return null;

  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Failed to decrypt account identifier:", error);
    return null;
  }
}

/**
 * Generates a deterministic, cryptographically secure fingerprint of an IBAN or account identifier.
 * Used for host deduplication and unique constraint checking without storing raw identifiers.
 */
export function generateAccountFingerprint(plainIdentifier: string): string {
  if (!plainIdentifier) return "";
  // If it's an email, normalize to lowercase; otherwise clean spaces/hyphens and uppercase for IBAN
  const clean = plainIdentifier.includes("@")
    ? plainIdentifier.trim().toLowerCase()
    : plainIdentifier.replace(/[\s\-_]/g, "").toUpperCase();
  const key = getDerivedKey();
  return crypto.createHmac("sha256", key).update(clean).digest("hex");
}

/**
 * Masks an email address for secure public display without exposing full PII.
 * Example: "john.doe@example.com" => "j***e@example.com"
 * Example: "ab@domain.com" => "a***@domain.com"
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "***@***.***";
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split("@");
  if (parts.length !== 2) return "***@***.***";

  const [username, domain] = parts;
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  return `${username[0]}***${username[username.length - 1]}@${domain}`;
}


