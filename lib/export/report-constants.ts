/**
 * Standard fields included in host earnings custom reports and CSV exports.
 * Kept lightweight and decoupled from server dependencies so it is safe to import
 * in both Client Components and Server Services.
 */

export const DEFAULT_EXPORT_FIELDS = [
  "bookingId",
  "listingTitle",
  "guestName",
  "checkIn",
  "checkOut",
  "nights",
  "grossEarnings",
  "hostServiceFee",
  "netEarnings",
  "currency",
  "payoutStatus",
  "payoutMethod",
] as const;

export const defaultExportFields = [...DEFAULT_EXPORT_FIELDS];

