import type { ModerationSeverity, ModerationTargetType } from "@/generated/prisma/enums";

export type ModerationPolicyCategory =
  | "SAFETY"
  | "CONTENT_QUALITY"
  | "FRAUD_AND_LEGAL"
  | "AUTHENTICITY"
  | "COMMUNITY_STANDARDS";

export type ModerationPolicy = {
  code: string;
  name?: string;
  category?: ModerationPolicyCategory;
  targetTypes: ModerationTargetType[];
  defaultSeverity: ModerationSeverity;
  description: string;
  appealable?: boolean;
  appealDeadlineDays?: number;
  allowedEnforcements?: string[];
};

/**
 * Versioned, code-owned policy catalogue.
 */
export const MODERATION_POLICY_VERSION = "moderation-policy-v1";

export const MODERATION_POLICY_CATEGORIES: readonly { id: ModerationPolicyCategory; label: string; description: string }[] = [
  { id: "SAFETY", label: "Safety & Security", description: "Physical safety hazards, threats, and private information exposure." },
  { id: "CONTENT_QUALITY", label: "Content Quality & Accuracy", description: "Accuracy of listing details, amenities, and photos." },
  { id: "FRAUD_AND_LEGAL", label: "Fraud & Legal Compliance", description: "Impersonation, scam attempts, illegal items, and nonexistent listings." },
  { id: "AUTHENTICITY", label: "Authenticity & Trust", description: "Genuine feedback and authentic representations of property conditions." },
  { id: "COMMUNITY_STANDARDS", label: "Community Standards", description: "Anti-discrimination, respectful behavior, and prohibited explicit media." },
];

export const MODERATION_POLICIES: readonly ModerationPolicy[] = [
  {
    code: "FAKE_OR_INAUTHENTIC_REVIEW",
    name: "Fake or Inauthentic Review",
    category: "AUTHENTICITY",
    targetTypes: ["REVIEW"],
    defaultSeverity: "MEDIUM",
    description: "Review may not reflect a genuine stay.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "WARN", "RESTORE"],
  },
  {
    code: "IRRELEVANT_REVIEW",
    name: "Irrelevant Review",
    category: "CONTENT_QUALITY",
    targetTypes: ["REVIEW"],
    defaultSeverity: "LOW",
    description: "Review is unrelated to the listing or stay.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "HIDE", "RESTORE"],
  },
  {
    code: "RETALIATORY_REVIEW",
    name: "Retaliatory Review",
    category: "COMMUNITY_STANDARDS",
    targetTypes: ["REVIEW"],
    defaultSeverity: "MEDIUM",
    description: "Review may be retaliation rather than genuine feedback.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "RESTORE"],
  },
  {
    code: "HARASSMENT_OR_THREATS",
    name: "Harassment or Threats",
    category: "SAFETY",
    targetTypes: ["REVIEW", "LISTING", "PROFILE", "USER", "MESSAGE"],
    defaultSeverity: "HIGH",
    description: "Harassment, threats, or abusive content.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "WARN", "SUSPEND", "RESTORE"],
  },
  {
    code: "DISCRIMINATORY_CONTENT",
    name: "Discriminatory Content",
    category: "COMMUNITY_STANDARDS",
    targetTypes: ["REVIEW", "LISTING", "PROFILE", "USER", "MESSAGE"],
    defaultSeverity: "HIGH",
    description: "Discriminatory or hateful content.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "WARN", "RESTORE"],
  },
  {
    code: "SPAM_OR_PROMOTION",
    name: "Spam or Promotional Content",
    category: "CONTENT_QUALITY",
    targetTypes: ["REVIEW", "LISTING", "PROFILE", "USER", "MESSAGE"],
    defaultSeverity: "LOW",
    description: "Spam or unauthorised promotional content.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "HIDE", "RESTORE"],
  },
  {
    code: "PRIVATE_INFORMATION",
    name: "Private Information Exposure",
    category: "SAFETY",
    targetTypes: ["REVIEW", "LISTING", "LISTING_PHOTO", "PROFILE", "USER", "MESSAGE"],
    defaultSeverity: "HIGH",
    description: "Personal or private information is exposed.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "WARN", "RESTORE"],
  },
  {
    code: "EXTORTION_OR_MANIPULATION",
    name: "Extortion or Manipulation",
    category: "FRAUD_AND_LEGAL",
    targetTypes: ["REVIEW", "MESSAGE"],
    defaultSeverity: "HIGH",
    description: "Extortion, review manipulation, or coercion.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "SUSPEND", "RESTORE"],
  },
  {
    code: "ILLEGAL_OR_PROHIBITED_CONTENT",
    name: "Illegal or Prohibited Content",
    category: "FRAUD_AND_LEGAL",
    targetTypes: ["REVIEW", "LISTING", "LISTING_PHOTO", "PROFILE", "USER", "MESSAGE"],
    defaultSeverity: "CRITICAL",
    description: "Illegal, unsafe, or prohibited content.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "SUSPEND", "RESTORE"],
  },
  {
    code: "MISLEADING_LISTING",
    name: "Misleading Listing",
    category: "AUTHENTICITY",
    targetTypes: ["LISTING", "LISTING_PHOTO"],
    defaultSeverity: "MEDIUM",
    description: "Listing details or imagery may be materially misleading.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["PAUSE", "REQUIRE_EDIT", "RESTORE"],
  },
  {
    code: "FAKE_OR_NONEXISTENT_PROPERTY",
    name: "Fake or Nonexistent Property",
    category: "FRAUD_AND_LEGAL",
    targetTypes: ["LISTING"],
    defaultSeverity: "CRITICAL",
    description: "Property does not exist or host lacks authority to list it.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REJECT", "SUSPEND", "RESTORE"],
  },
  {
    code: "INCORRECT_PHOTOS",
    name: "Incorrect Photos",
    category: "CONTENT_QUALITY",
    targetTypes: ["LISTING", "LISTING_PHOTO"],
    defaultSeverity: "MEDIUM",
    description: "Photos do not represent the actual property.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE_PHOTO", "REQUIRE_EDIT", "RESTORE_PHOTO"],
  },
  {
    code: "SAFETY_OR_SECURITY_CONCERNS",
    name: "Safety or Security Concerns",
    category: "SAFETY",
    targetTypes: ["LISTING", "REVIEW", "MESSAGE"],
    defaultSeverity: "HIGH",
    description: "Property safety hazards, physical danger, or security risks.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["PAUSE", "INVESTIGATE", "RESTORE"],
  },
  {
    code: "INACCURATE_LOCATION_OR_AMENITIES",
    name: "Inaccurate Location or Amenities",
    category: "CONTENT_QUALITY",
    targetTypes: ["LISTING"],
    defaultSeverity: "MEDIUM",
    description: "Property location, address, or amenities are materially inaccurate.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REQUIRE_EDIT", "PAUSE", "RESTORE"],
  },
  {
    code: "SUSPECTED_FRAUD",
    name: "Suspected Fraud",
    category: "FRAUD_AND_LEGAL",
    targetTypes: ["LISTING", "LISTING_PHOTO", "PROFILE", "USER"],
    defaultSeverity: "CRITICAL",
    description: "Potential fraud or scam behaviour.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["SUSPEND", "INVESTIGATE", "RESTORE"],
  },
  {
    code: "IMPERSONATION",
    name: "Impersonation",
    category: "FRAUD_AND_LEGAL",
    targetTypes: ["PROFILE", "USER"],
    defaultSeverity: "HIGH",
    description: "Potential impersonation.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE", "SUSPEND", "RESTORE"],
  },
  {
    code: "EXPLICIT_OR_NUDITY",
    name: "Explicit or Nudity",
    category: "COMMUNITY_STANDARDS",
    targetTypes: ["LISTING_PHOTO", "PROFILE", "REVIEW", "MESSAGE"],
    defaultSeverity: "CRITICAL",
    description: "Nudity, sexual, or explicit imagery.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE_PHOTO", "REMOVE", "RESTORE"],
  },
  {
    code: "VIOLENCE_OR_DISTURBING",
    name: "Violence or Disturbing Content",
    category: "COMMUNITY_STANDARDS",
    targetTypes: ["LISTING_PHOTO", "PROFILE", "REVIEW", "MESSAGE"],
    defaultSeverity: "HIGH",
    description: "Graphic violence, gore, or disturbing content.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE_PHOTO", "REMOVE", "RESTORE"],
  },
  {
    code: "CONTACT_INFO_IN_PHOTO",
    name: "Contact Info in Photo",
    category: "CONTENT_QUALITY",
    targetTypes: ["LISTING_PHOTO"],
    defaultSeverity: "MEDIUM",
    description: "Phone numbers, emails, or personal contact info displayed in images.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE_PHOTO", "RESTORE_PHOTO"],
  },
  {
    code: "UNAUTHORIZED_OR_INFRINGING",
    name: "Unauthorized or Infringing Material",
    category: "FRAUD_AND_LEGAL",
    targetTypes: ["LISTING_PHOTO", "LISTING", "PROFILE"],
    defaultSeverity: "MEDIUM",
    description: "Copyrighted, watermarked, or unauthorized imagery.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["REMOVE_PHOTO", "RESTORE_PHOTO"],
  },
  {
    code: "OTHER_SUPPORTED_CONTENT",
    name: "Other Supported Content",
    category: "COMMUNITY_STANDARDS",
    targetTypes: ["OTHER_CONTENT"],
    defaultSeverity: "MEDIUM",
    description: "Other supported content that requires review.",
    appealable: true,
    appealDeadlineDays: 14,
    allowedEnforcements: ["WARN", "REMOVE", "RESTORE"],
  },
];

export function isPolicyAppealable(code: string): boolean {
  const policy = MODERATION_POLICIES.find((p) => p.code === code);
  return policy?.appealable ?? true;
}

export function getAppealDeadlineDays(code?: string): number {
  if (!code) return 14;
  const policy = MODERATION_POLICIES.find((p) => p.code === code);
  return policy?.appealDeadlineDays ?? 14;
}

export function listAllModerationPolicies(filters?: {
  targetType?: ModerationTargetType;
  category?: ModerationPolicyCategory;
  appealable?: boolean;
}): readonly ModerationPolicy[] {
  return MODERATION_POLICIES.filter((policy) => {
    if (filters?.targetType && !policy.targetTypes.includes(filters.targetType)) return false;
    if (filters?.category && policy.category !== filters.category) return false;
    if (filters?.appealable !== undefined && policy.appealable !== filters.appealable) return false;
    return true;
  });
}

export function getModerationPolicy(code: string, targetType?: ModerationTargetType): ModerationPolicy | null {
  const policy = MODERATION_POLICIES.find((entry) => entry.code === code);
  if (!policy) return null;
  if (targetType && !policy.targetTypes.includes(targetType)) return null;
  return policy;
}
