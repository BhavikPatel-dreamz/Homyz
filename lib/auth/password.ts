import bcrypt from "bcryptjs";

// bcrypt password hashing. Also used for OTP codes (low-entropy secrets benefit
// from a slow hash). Never store or log plaintext.
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
