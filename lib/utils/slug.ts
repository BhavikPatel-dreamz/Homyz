// Reserved top-level application route segments that a custom listing slug must not shadow
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "auth",
  "bookings",
  "co-host-invitations",
  "edit",
  "help",
  "host",
  "listings",
  "login",
  "new",
  "privacy",
  "profile",
  "register",
  "search",
  "settings",
  "signup",
  "stay",
  "support",
  "terms",
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

const RESERVED_SLUG_SET = new Set<string>(RESERVED_SLUGS);

/**
 * Normalizes a user-entered slug into a safe URL-friendly string.
 * Example: "  Luxury Villa - Riyadh ! " -> "luxury-villa-riyadh"
 */
export function normalizeSlug(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove accent marks
    .replace(/[^a-z0-9-]+/g, "-") // replace non-alphanumeric (except hyphen) with hyphen
    .replace(/-+/g, "-") // collapse repeated hyphens
    .replace(/^-+|-+$/g, ""); // trim leading and trailing hyphens
}

/**
 * Checks whether a normalized slug collides with a reserved application route.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(slug.toLowerCase().trim());
}

/**
 * Checks whether a slug meets all format requirements:
 * - 3 to 100 characters
 * - lowercase alphanumeric with single internal hyphens
 * - not a reserved application route
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 100) return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
  return !isReservedSlug(slug);
}
