export const REQUIRED_PROFILE_FIELDS = ["name", "birthDate", "email", "phone"] as const;

export type RequiredProfileField = (typeof REQUIRED_PROFILE_FIELDS)[number];

export interface ProfileCompletionCandidate {
  name?: string | null;
  birthDate?: Date | string | null;
  email?: string | null;
  phone?: string | null;
}

const LEGACY_PHONE_SIGNUP_EMAIL = /^user_\d+@homyz\.app$/i;
const LEGACY_PHONE_SIGNUP_NAME = /^guest\s*\([^)]*\)$/i;

export function hasUsableProfileName(name: string | null | undefined): boolean {
  const value = name?.trim() ?? "";
  return value.length >= 2 && !LEGACY_PHONE_SIGNUP_NAME.test(value);
}

export function hasUsableProfileEmail(email: string | null | undefined): boolean {
  const value = email?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !LEGACY_PHONE_SIGNUP_EMAIL.test(value);
}

export function getMissingProfileFields(
  profile: ProfileCompletionCandidate,
): RequiredProfileField[] {
  const missing: RequiredProfileField[] = [];
  if (!hasUsableProfileName(profile.name)) missing.push("name");
  if (!profile.birthDate) missing.push("birthDate");
  if (!hasUsableProfileEmail(profile.email)) missing.push("email");
  if (!profile.phone?.trim() || !isValidE164Phone(normalizePhone(profile.phone))) {
    missing.push("phone");
  }
  return missing;
}

export function isRegistrationProfileComplete(
  profile: ProfileCompletionCandidate,
): boolean {
  return getMissingProfileFields(profile).length === 0;
}
import { isValidE164Phone, normalizePhone } from "@/lib/auth/normalization";
