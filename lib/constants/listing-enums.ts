export const PROPERTY_TYPES = [
  { id: "HOUSE", label: "House" },
  { id: "APARTMENT", label: "Apartment" },
  { id: "VILLA", label: "Villa" },
  { id: "CABIN", label: "Cabin" },
  { id: "COTTAGE", label: "Cottage" },
  { id: "STUDIO", label: "Studio" },
  { id: "LOFT", label: "Loft" },
  { id: "PENTHOUSE", label: "Penthouse" },
  { id: "TOWNHOUSE", label: "Townhouse" },
  { id: "GUEST_HOUSE", label: "Guest house" },
  { id: "SECONDARY_UNIT", label: "Secondary unit" },
  { id: "BED_AND_BREAKFAST", label: "Bed & breakfast" },
  { id: "BOUTIQUE_HOTEL", label: "Boutique hotel" },
  { id: "UNIQUE_SPACE", label: "Unique space" },
] as const;

export const LISTING_TYPES = [
  { id: "ENTIRE_PLACE", label: "Entire place" },
  { id: "ROOM", label: "Private room" },
  { id: "SHARED_ROOM", label: "Shared room" },
] as const;

export const CANCELLATION_POLICIES = [
  { id: "FLEXIBLE", label: "Flexible" },
  { id: "MODERATE", label: "Moderate" },
  { id: "LIMITED", label: "Limited" },
  { id: "FIRM", label: "Firm" },
  { id: "STRICT", label: "Strict" },
] as const;

const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  HOME: "HOUSE",
  HOUSE: "HOUSE",
  APARTMENT: "APARTMENT",
  RENTAL_UNIT: "APARTMENT",
  CONDO: "APARTMENT",
  SERVICED_APARTMENT: "APARTMENT",
  VILLA: "VILLA",
  CABIN: "CABIN",
  COTTAGE: "COTTAGE",
  STUDIO: "STUDIO",
  LOFT: "LOFT",
  PENTHOUSE: "PENTHOUSE",
  TOWNHOUSE: "TOWNHOUSE",
  GUEST_HOUSE: "GUEST_HOUSE",
  "GUEST HOUSE": "GUEST_HOUSE",
  SECONDARY_UNIT: "SECONDARY_UNIT",
  "SECONDARY UNIT": "SECONDARY_UNIT",
  BED_AND_BREAKFAST: "BED_AND_BREAKFAST",
  "BED & BREAKFAST": "BED_AND_BREAKFAST",
  BOUTIQUE_HOTEL: "BOUTIQUE_HOTEL",
  "BOUTIQUE HOTEL": "BOUTIQUE_HOTEL",
  UNIQUE_SPACE: "UNIQUE_SPACE",
  "UNIQUE SPACE": "UNIQUE_SPACE",
  "SERVICED APARTMENT": "APARTMENT",
  "VACATION HOME": "HOUSE",
};

const LISTING_TYPE_ALIASES: Record<string, string> = {
  ENTIRE_PLACE: "ENTIRE_PLACE",
  "ENTIRE PLACE": "ENTIRE_PLACE",
  ENTIREPLACE: "ENTIRE_PLACE",
  ROOM: "ROOM",
  PRIVATE_ROOM: "ROOM",
  "PRIVATE ROOM": "ROOM",
  SHARED_ROOM: "SHARED_ROOM",
  "SHARED ROOM": "SHARED_ROOM",
};

const CANCELLATION_POLICY_ALIASES: Record<string, string> = {
  FLEXIBLE: "FLEXIBLE",
  MODERATE: "MODERATE",
  LIMITED: "LIMITED",
  FIRM: "FIRM",
  STRICT: "STRICT",
  SUPER_STRICT: "STRICT",
  "SUPER STRICT": "STRICT",
};

const ACCESSIBILITY_ALIASES: Record<string, string> = {
  disabled_parking: "accessible_parking",
  accessible_parking: "accessible_parking",
  "accessible parking": "accessible_parking",
  "accessible parking spot": "accessible_parking",
  lit_path: "lit_path",
  "lit path": "lit_path",
  step_free_access: "step_free_access",
  step_free: "step_free_access",
  "step free access": "step_free_access",
  "step-free access": "step_free_access",
  "step free": "step_free_access",
  wide_entrance: "wide_entrance",
  "wide entrance": "wide_entrance",
  "guest entrance wider than 32 inches": "wide_entrance",
  pool_hoist: "pool_hoist",
  "swimming pool or hot tub hoist": "pool_hoist",
  ceiling_hoist: "ceiling_hoist",
  "ceiling or mobile hoist": "ceiling_hoist",
};

export interface AccessibilityFeatureDetail {
  featureId: string;
  photos: string[];
}

const PROPERTY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROPERTY_TYPES.map(({ id, label }) => [id, label])
);

const LISTING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  LISTING_TYPES.map(({ id, label }) => [id, label])
);

const CANCELLATION_POLICY_LABELS: Record<string, string> = Object.fromEntries(
  CANCELLATION_POLICIES.map(({ id, label }) => [id, label])
);

function canonicalizeEnum(value: string | undefined | null, aliasMap: Record<string, string>, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  if (!trimmed) return fallback;
  const upper = trimmed.toUpperCase();
  const normalized = upper
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (aliasMap[upper]) return aliasMap[upper];
  if (aliasMap[normalized]) return aliasMap[normalized];
  if (aliasMap[trimmed]) return aliasMap[trimmed];
  return normalized || fallback;
}

export function canonicalPropertyType(value: string | undefined | null): string {
  return canonicalizeEnum(value, PROPERTY_TYPE_ALIASES, "APARTMENT");
}

export function propertyTypeLabel(value: string | undefined | null): string {
  const canonical = canonicalPropertyType(value);
  return PROPERTY_TYPE_LABELS[canonical] ?? canonical.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function normalizeMostLikeSelection(value: string | undefined | null): string {
  const canonical = canonicalPropertyType(value);

  if (["HOUSE", "VILLA", "CABIN", "COTTAGE", "TOWNHOUSE", "GUEST_HOUSE"].includes(canonical)) {
    return "HOUSE";
  }

  if (["APARTMENT", "LOFT", "PENTHOUSE", "STUDIO"].includes(canonical)) {
    return "APARTMENT";
  }

  if (["SECONDARY_UNIT", "BED_AND_BREAKFAST", "BOUTIQUE_HOTEL", "UNIQUE_SPACE"].includes(canonical)) {
    return canonical;
  }

  return "APARTMENT";
}

export function canonicalListingType(value: string | undefined | null): string {
  return canonicalizeEnum(value, LISTING_TYPE_ALIASES, "ENTIRE_PLACE");
}

export function listingTypeLabel(value: string | undefined | null): string {
  const canonical = canonicalListingType(value);
  return LISTING_TYPE_LABELS[canonical] ?? canonical.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function canonicalCancellationPolicy(value: string | undefined | null): string {
  return canonicalizeEnum(value, CANCELLATION_POLICY_ALIASES, "FLEXIBLE");
}

export function cancellationPolicyLabel(value: string | undefined | null): string {
  const canonical = canonicalCancellationPolicy(value);
  return CANCELLATION_POLICY_LABELS[canonical] ?? canonical.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function normalizeAccessibilityFeature(input: string | undefined | null): string {
  if (input === undefined || input === null) return "";
  const trimmed = String(input).trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (ACCESSIBILITY_ALIASES[lower]) return ACCESSIBILITY_ALIASES[lower];
  const slug = lower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (ACCESSIBILITY_ALIASES[slug]) return ACCESSIBILITY_ALIASES[slug];
  return slug;
}

export function normalizeAccessibilityFeatureIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeAccessibilityFeature(String(value));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function normalizeAccessibilityFeatureDetails(values: unknown): AccessibilityFeatureDetail[] {
  if (!Array.isArray(values)) return [];

  const details = new Map<string, string[]>();
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const featureId = normalizeAccessibilityFeature(typeof record.featureId === "string" ? record.featureId : "");
    if (!featureId) continue;
    const photos = Array.isArray(record.photos)
      ? record.photos.filter((photo): photo is string => typeof photo === "string" && photo.trim().length > 0)
      : [];
    const existing = details.get(featureId) ?? [];
    details.set(featureId, [...new Set([...existing, ...photos])].slice(0, 10));
  }

  return Array.from(details, ([featureId, photos]) => ({ featureId, photos }));
}
