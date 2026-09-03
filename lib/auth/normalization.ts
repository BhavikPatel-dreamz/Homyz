/**
 * Canonical Normalization Utilities for Homyz Authentication
 */

/**
 * Normalizes an email address to a canonical form:
 * - Trims leading and trailing whitespace
 * - Converts to lowercase
 */
export function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Normalizes a phone number to E.164 canonical format.
 * Handles:
 * - Localized formatting: spaces, dashes, parentheses, dots
 * - International prefix replacement: e.g. "0039" -> "+39"
 * - Raw digits with optional leading '+'
 *
 * Example transformations:
 * - "+1 (555) 234-5678" -> "+15552345678"
 * - "00966 51 234 5678" -> "+966512345678"
 * - "+39-06-12345678"   -> "+390612345678"
 * - "966512345678"      -> "+966512345678"
 */
export function normalizePhone(phone: string, defaultCountryCode = "+1"): string {
  if (!phone) return "";

  // Trim whitespace
  let cleaned = phone.trim();

  // Replace leading "00" with "+"
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // Remove all non-digit characters except leading '+'
  const hasPlus = cleaned.startsWith("+");
  const digitsOnly = cleaned.replace(/\D/g, "");

  if (!digitsOnly) return "";

  if (hasPlus) {
    return `+${digitsOnly}`;
  }

  // If no leading '+' was provided, prepend default country code if missing
  const defaultDigits = defaultCountryCode.replace(/\D/g, "");
  if (digitsOnly.startsWith(defaultDigits)) {
    return `+${digitsOnly}`;
  }

  return `+${digitsOnly}`;
}

/**
 * Validates whether a phone number matches basic E.164 structure (7 to 15 digits).
 */
export function isValidE164Phone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}
