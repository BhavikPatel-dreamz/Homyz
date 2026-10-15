import type { ModerationSeverity, ModerationTargetType } from "@/generated/prisma/enums";

export type ModerationPolicy = {
  code: string;
  targetTypes: ModerationTargetType[];
  defaultSeverity: ModerationSeverity;
  description: string;
};

/**
 * Versioned, code-owned Phase 1 policy catalogue. These codes are intentionally
 * stable; a later settings phase may add approved configuration around them.
 */
export const MODERATION_POLICY_VERSION = "moderation-policy-v1";

export const MODERATION_POLICIES: readonly ModerationPolicy[] = [
  { code: "FAKE_OR_INAUTHENTIC_REVIEW", targetTypes: ["REVIEW"], defaultSeverity: "MEDIUM", description: "Review may not reflect a genuine stay." },
  { code: "IRRELEVANT_REVIEW", targetTypes: ["REVIEW"], defaultSeverity: "LOW", description: "Review is unrelated to the listing or stay." },
  { code: "RETALIATORY_REVIEW", targetTypes: ["REVIEW"], defaultSeverity: "MEDIUM", description: "Review may be retaliation rather than genuine feedback." },
  { code: "HARASSMENT_OR_THREATS", targetTypes: ["REVIEW", "LISTING", "PROFILE", "USER", "MESSAGE"], defaultSeverity: "HIGH", description: "Harassment, threats, or abusive content." },
  { code: "DISCRIMINATORY_CONTENT", targetTypes: ["REVIEW", "LISTING", "PROFILE", "USER", "MESSAGE"], defaultSeverity: "HIGH", description: "Discriminatory or hateful content." },
  { code: "SPAM_OR_PROMOTION", targetTypes: ["REVIEW", "LISTING", "PROFILE", "USER", "MESSAGE"], defaultSeverity: "LOW", description: "Spam or unauthorised promotional content." },
  { code: "PRIVATE_INFORMATION", targetTypes: ["REVIEW", "LISTING", "LISTING_PHOTO", "PROFILE", "USER", "MESSAGE"], defaultSeverity: "HIGH", description: "Personal or private information is exposed." },
  { code: "EXTORTION_OR_MANIPULATION", targetTypes: ["REVIEW", "MESSAGE"], defaultSeverity: "HIGH", description: "Extortion, review manipulation, or coercion." },
  { code: "ILLEGAL_OR_PROHIBITED_CONTENT", targetTypes: ["REVIEW", "LISTING", "LISTING_PHOTO", "PROFILE", "USER", "MESSAGE"], defaultSeverity: "CRITICAL", description: "Illegal, unsafe, or prohibited content." },
  { code: "MISLEADING_LISTING", targetTypes: ["LISTING", "LISTING_PHOTO"], defaultSeverity: "MEDIUM", description: "Listing details or imagery may be materially misleading." },
  { code: "FAKE_OR_NONEXISTENT_PROPERTY", targetTypes: ["LISTING"], defaultSeverity: "CRITICAL", description: "Property does not exist or host lacks authority to list it." },
  { code: "INCORRECT_PHOTOS", targetTypes: ["LISTING", "LISTING_PHOTO"], defaultSeverity: "MEDIUM", description: "Photos do not represent the actual property." },
  { code: "SAFETY_OR_SECURITY_CONCERNS", targetTypes: ["LISTING", "REVIEW", "MESSAGE"], defaultSeverity: "HIGH", description: "Property safety hazards, physical danger, or security risks." },
  { code: "INACCURATE_LOCATION_OR_AMENITIES", targetTypes: ["LISTING"], defaultSeverity: "MEDIUM", description: "Property location, address, or amenities are materially inaccurate." },
  { code: "SUSPECTED_FRAUD", targetTypes: ["LISTING", "LISTING_PHOTO", "PROFILE", "USER"], defaultSeverity: "CRITICAL", description: "Potential fraud or scam behaviour." },
  { code: "IMPERSONATION", targetTypes: ["PROFILE", "USER"], defaultSeverity: "HIGH", description: "Potential impersonation." },
  { code: "EXPLICIT_OR_NUDITY", targetTypes: ["LISTING_PHOTO", "PROFILE", "REVIEW", "MESSAGE"], defaultSeverity: "CRITICAL", description: "Nudity, sexual, or explicit imagery." },
  { code: "VIOLENCE_OR_DISTURBING", targetTypes: ["LISTING_PHOTO", "PROFILE", "REVIEW", "MESSAGE"], defaultSeverity: "HIGH", description: "Graphic violence, gore, or disturbing content." },
  { code: "CONTACT_INFO_IN_PHOTO", targetTypes: ["LISTING_PHOTO"], defaultSeverity: "MEDIUM", description: "Phone numbers, emails, or personal contact info displayed in images." },
  { code: "UNAUTHORIZED_OR_INFRINGING", targetTypes: ["LISTING_PHOTO", "LISTING", "PROFILE"], defaultSeverity: "MEDIUM", description: "Copyrighted, watermarked, or unauthorized imagery." },
  { code: "OTHER_SUPPORTED_CONTENT", targetTypes: ["OTHER_CONTENT"], defaultSeverity: "MEDIUM", description: "Other supported content that requires review." },
];

export function getModerationPolicy(code: string, targetType: ModerationTargetType): ModerationPolicy | null {
  const policy = MODERATION_POLICIES.find((entry) => entry.code === code);
  return policy && policy.targetTypes.includes(targetType) ? policy : null;
}
