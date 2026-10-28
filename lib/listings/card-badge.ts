/**
 * Resolves the legacy single badge field included in public card payloads.
 *
 * Qualification itself is persisted and evaluated by backend services. Card
 * components must render `isGuestFavorite` and `isSuperhost` independently:
 * the two recognitions have different owners and one must never hide the
 * other. This helper remains for surfaces that only support one badge value
 * and for the featured fallback.
 */
export type PrimaryListingBadge = "guest_favorite" | "superhost" | null;

export type ListingBadgeFlags = {
  isGuestFavorite?: boolean | null;
  isSuperhost?: boolean | null;
};

export function getPrimaryListingBadge({
  isGuestFavorite,
  isSuperhost,
}: ListingBadgeFlags): PrimaryListingBadge {
  if (isGuestFavorite === true) return "guest_favorite";
  if (isSuperhost === true) return "superhost";
  return null;
}
