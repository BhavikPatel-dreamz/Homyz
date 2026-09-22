/**
 * Centralized Qualification Engine for Homyz
 * Awards Guest Favorite and Superhost badges strictly through backend formulas
 * using genuine database signals (ratings, review counts, completed bookings,
 * cancellation rate, and tenure). Never manufactures fake qualification data.
 */

export interface GuestFavoriteListingInput {
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
  createdAt?: Date | string | null;
  publicProfile?: Record<string, unknown> | null;
  bookings?: Array<{ status: string }>;
  /** Aggregate alternative to loading every booking belonging to a host. */
  bookingSummary?: { confirmed: number; cancelled: number };
  listings?: Array<{ id: string; isFeatured?: boolean }>;
}

export interface QualificationConfig {
  guestFavorite: {
    minRating: number; // e.g. 4.85
    minReviews: number; // e.g. 3
    minConfirmedBookings: number; // e.g. 2
    allowFeaturedWithConfirmedBookings: boolean;
  };
  superhost: {
    minRating: number; // e.g. 4.8
    minCompletedBookings: number; // e.g. 3
    maxCancellationRate: number; // e.g. 0.05 (5%)
    minTenureDays: number; // e.g. 30
  };
}

export const DEFAULT_QUALIFICATION_CONFIG: QualificationConfig = {
  guestFavorite: {
    minRating: 4.85,
    minReviews: 3,
    minConfirmedBookings: 2,
    allowFeaturedWithConfirmedBookings: true,
  },
  superhost: {
    minRating: 4.8,
    minCompletedBookings: 3,
    maxCancellationRate: 0.05,
    minTenureDays: 30,
  },
};

/**
 * Calculates whether a property qualifies for the Guest Favorite badge.
 * Formula requires either:
 *  1. Verified high rating (>= 4.85) AND sufficient review/booking volume (>= 3 reviews or >= 2 confirmed bookings).
 *  2. Featured property with at least 1 confirmed booking track record.
 * Returns false for unverified, unreviewed, or below-threshold properties.
 */
export function isGuestFavorite(
  property: GuestFavoriteListingInput | null | undefined,
  customConfig?: Partial<QualificationConfig["guestFavorite"]>,
): boolean {
  if (!property) return false;
  const cfg = { ...DEFAULT_QUALIFICATION_CONFIG.guestFavorite, ...customConfig };

  const rawRating = property.rating != null ? Number(property.rating) : null;
  const rating = rawRating !== null && !isNaN(rawRating) && rawRating > 0 ? rawRating : null;
  const reviews = Number(property.reviewCount ?? property.reviewsCount ?? 0) || 0;
  const confirmedBookings = typeof property.confirmedBookingCount === "number"
    ? Math.max(0, property.confirmedBookingCount)
    : (property.bookings || []).filter(
      (b) => b.status === "CONFIRMED" || b.status === "COMPLETED",
    ).length;

  // 1. High rating track
  if (
    rating !== null &&
    rating >= cfg.minRating &&
    (reviews >= cfg.minReviews || confirmedBookings >= cfg.minConfirmedBookings)
  ) {
    return true;
  }

  // 2. Featured property with confirmed bookings track
  if (cfg.allowFeaturedWithConfirmedBookings && property.isFeatured && confirmedBookings >= 1) {
    return true;
  }

  return false;
}

/**
 * Calculates whether a host qualifies for the Superhost badge.
 * Evaluates host profile, completed bookings track record, cancellation rate, and tenure.
 * Returns false if the host does not meet qualification standards.
 */
export function isSuperhost(
  host: SuperhostHostInput | null | undefined,
  customConfig?: Partial<QualificationConfig["superhost"]>,
): boolean {
  if (!host) return false;
  const cfg = { ...DEFAULT_QUALIFICATION_CONFIG.superhost, ...customConfig };

  const profile = (host.publicProfile || {}) as Record<string, unknown>;

  // 1. Explicit verified superhost badge in host system profile
  if (profile.isSuperhost === true || profile.superhost === true) {
    return true;
  }

  const rawRating = profile.rating != null ? Number(profile.rating) : null;
  const rating = rawRating !== null && !isNaN(rawRating) && rawRating > 0 ? rawRating : null;

  const allBookings = host.bookings || [];
  const confirmed = host.bookingSummary
    ? Math.max(0, host.bookingSummary.confirmed)
    : allBookings.filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED").length;
  const cancelled = host.bookingSummary
    ? Math.max(0, host.bookingSummary.cancelled)
    : allBookings.filter((b) => b.status === "CANCELLED").length;
  const total = confirmed + cancelled;

  // Check tenure
  if (host.createdAt && cfg.minTenureDays > 0) {
    const createdDate = new Date(host.createdAt);
    const ageDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < cfg.minTenureDays) {
      return false;
    }
  }

  // Completed/confirmed bookings requirement
  if (confirmed < cfg.minCompletedBookings) {
    return false;
  }

  // Cancellation rate check
  if (total > 0 && cancelled / total > cfg.maxCancellationRate) {
    return false;
  }

  // Rating check (must meet min rating if rating exists)
  if (rating !== null && rating < cfg.minRating) {
    return false;
  }

  return true;
}

export const qualificationService = {
  isGuestFavorite,
  isSuperhost,
  DEFAULT_QUALIFICATION_CONFIG,
};
