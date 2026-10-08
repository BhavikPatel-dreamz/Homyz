/**
 * Resolves the single qualification badge displayed on public property cards.
 *
 * Qualification itself is persisted and evaluated by the backend services.
 * This helper deliberately decides presentation only: Guest Favorite takes
 * precedence when a listing and its host both hold their respective statuses.
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
