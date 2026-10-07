/**
 * Centralized Qualification Engine for Homyz
 * Awards Guest Favorite through backend formulas and resolves the persisted
 * official Superhost badge. Superhost qualification is intentionally owned by
 * superhost.service.ts so public surfaces cannot run a second calculation.
 */

export interface GuestFavoriteListingInput {
  /** Persisted by the daily listing evaluator. */
  isGuestFavorite?: boolean;
  isFeatured?: boolean;
  rating?: number | string | null;
  reviewCount?: number | null;
  reviewsCount?: number | null;
  bookings?: Array<{ status: string }>;
  /** Aggregate alternative to loading a listing's booking rows. */
  confirmedBookingCount?: number;
  status?: string;
  published?: boolean;
}

export interface SuperhostHostInput {
  id?: string;
  name?: string | null;
  /** Persisted by the quarterly Superhost evaluator. */
  isSuperhost?: boolean;
  /** @deprecated Ignored for Superhost status; retained for source compatibility. */
  createdAt?: Date | string | null;
  /** @deprecated Ignored for Superhost status; retained for source compatibility. */
  publicProfile?: Record<string, unknown> | null;
  /** @deprecated Ignored for Superhost status; retained for source compatibility. */
  bookings?: Array<{ status: string; priceBreakdown?: unknown }>;
  /** @deprecated Ignored for Superhost status; retained for source compatibility. */
  bookingSummary?: {
    confirmed: number;
    cancelled?: number;
    hostCancelled?: number;
    totalCompletedNights?: number;
    responseRate?: number;
  };
}

export interface QualificationConfig {
  guestFavorite: {
    minRating: number; // e.g. 4.85
    minReviews: number; // e.g. 3
    minConfirmedBookings: number; // e.g. 2
    allowFeaturedWithConfirmedBookings: boolean;
  };
}

export const DEFAULT_QUALIFICATION_CONFIG: QualificationConfig = {
  guestFavorite: {
    minRating: 4.85,
    minReviews: 3,
    minConfirmedBookings: 2,
    allowFeaturedWithConfirmedBookings: true,
  },
};

/**
 * Resolves the official, persisted Guest Favorite badge. Qualification lives in
 * guest-favorite.service.ts, which evaluates one listing at a time each day.
 * Public presentation must not recreate a rating/review shortcut or award the
 * badge from featured status.
 */
export function isGuestFavorite(
  property: GuestFavoriteListingInput | null | undefined,
  // Retained for callers compiled against the retired live formula. Official
  // Guest Favorite status is persisted and cannot be overridden at render time.
  _customConfig?: Partial<QualificationConfig["guestFavorite"]>,
): boolean {
  return property?.isGuestFavorite === true;
}

/**
 * Resolves the official Superhost badge. Qualification itself lives only in
 * superhost.service.ts, where it is calculated from real owner-level data and
 * persisted at a quarterly checkpoint. Public presentation must never use live
 * progress, profile JSON, or a simplified booking summary to award this badge.
 */
export function isSuperhost(
  host: SuperhostHostInput | null | undefined,
): boolean {
  return host?.isSuperhost === true;
}

export const qualificationService = {
  isGuestFavorite,
  isSuperhost,
  DEFAULT_QUALIFICATION_CONFIG,
};
