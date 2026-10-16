export const BOOKING_MODES = ["INSTANT_BOOK", "REQUEST_TO_BOOK"] as const;

export type BookingMode = (typeof BOOKING_MODES)[number];

type ListingBookingModeSource = {
  bookingMode?: unknown;
  bookingApprovalMode?: unknown;
  instantBook?: unknown;
};

export function isBookingMode(value: unknown): value is BookingMode {
  return value === "INSTANT_BOOK" || value === "REQUEST_TO_BOOK";
}

/**
 * Normalizes the two historical listing booking fields into the only two
 * guest-facing modes. A disagreement is resolved conservatively: both stored
 * fields must permit Instant Book before a reservation can auto-confirm.
 * Legacy FIRST_THREE listings remain request-to-book listings.
 */
export function resolveBookingMode(listing: ListingBookingModeSource): BookingMode {
  if (isBookingMode(listing.bookingMode)) return listing.bookingMode;

  const approvalMode = listing.bookingApprovalMode;
  if (approvalMode === "MANUAL" || approvalMode === "FIRST_THREE" || listing.instantBook === false) {
    return "REQUEST_TO_BOOK";
  }

  return "INSTANT_BOOK";
}

export function bookingModePersistence(mode: BookingMode): {
  bookingApprovalMode: "INSTANT" | "MANUAL";
  instantBook: boolean;
} {
  return mode === "INSTANT_BOOK"
    ? { bookingApprovalMode: "INSTANT", instantBook: true }
    : { bookingApprovalMode: "MANUAL", instantBook: false };
}
