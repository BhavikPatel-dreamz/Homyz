/**
 * Canonical Normalization & Validation Utilities for Homyz Authentication
 * Powered by libphonenumber-js for strict international E.164 compliance.
 */
import { parsePhoneNumberWithError, isValidPhoneNumber, isPossiblePhoneNumber, CountryCode } from "libphonenumber-js";
import { COUNTRY_CODES } from "./country-codes";

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
 * - Country code prepending when raw digits are supplied without '+'
 *
 * Example transformations:
 * - "+1 (555) 234-5678" -> "+15552345678"
 * - "00966 51 234 5678" -> "+966512345678"
 * - "+39-06-12345678"   -> "+390612345678"
 * - "966512345678"      -> "+966512345678"
 */
export function normalizePhone(phone: string, defaultCountryCallingCode = "+1"): string {
  if (!phone) return "";

  let cleaned = phone.trim();

  // Replace leading "00" with "+"
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // If phone already starts with '+', parse directly
  if (cleaned.startsWith("+")) {
    try {
      const parsed = parsePhoneNumberWithError(cleaned);
      return parsed.format("E.164");
    } catch {
      const digitsOnly = cleaned.replace(/\D/g, "");
      return digitsOnly ? `+${digitsOnly}` : "";
    }
  }

  const digitsOnly = cleaned.replace(/\D/g, "");
  if (!digitsOnly) return "";

  // Check if digitsOnly starts with any known calling code in our country dataset
  const callingCodes = COUNTRY_CODES.map((c) => c.code.replace(/\D/g, "")).sort((a, b) => b.length - a.length);
  const matchingCode = callingCodes.find((code) => digitsOnly.startsWith(code));

  if (matchingCode) {
    cleaned = `+${digitsOnly}`;
  } else {
    const defaultDigits = defaultCountryCallingCode.replace(/\D/g, "");
    cleaned = `+${defaultDigits}${digitsOnly}`;
  }

  try {
    const parsed = parsePhoneNumberWithError(cleaned);
    return parsed.format("E.164");
  } catch {
    return cleaned;
  }
}

/**
 * Validates whether a phone number is a valid/possible international E.164 phone number.
 */
export function isValidE164Phone(phone: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  if (!normalized.startsWith("+")) return false;

  try {
    return isPossiblePhoneNumber(normalized) || isValidPhoneNumber(normalized);
  } catch {
    return /^\+[1-9]\d{6,14}$/.test(normalized);
  }
}
