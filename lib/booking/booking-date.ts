/**
 * Booking stay dates are calendar dates, not moments in time.
 *
 * Prisma represents PostgreSQL DATE columns as JavaScript Date instances, so
 * this module always reads/writes their UTC calendar components. Formatting is
 * pinned to UTC to keep the visible day identical in every runtime timezone.
 */

export type BookingDateInput = Date | string;

export type BookingDateParts = {
  year: number;
  month: number;
  day: number;
};

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const DAY_MS = 86_400_000;

function isValidParts(parts: BookingDateParts): boolean {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day
  );
}

export function parseBookingDateParts(value: BookingDateInput): BookingDateParts | null {
  if (typeof value === "string") {
    const match = DATE_PREFIX.exec(value.trim());
    if (!match) return null;
    const parts = {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
    return isValidParts(parts) ? parts : null;
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

/** Returns the canonical UTC-midnight transport value for a booking date. */
export function parseBookingDate(value: BookingDateInput): Date {
  const parts = parseBookingDateParts(value);
  if (!parts) return new Date(Number.NaN);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

/** Returns a stable YYYY-MM-DD API/database key. */
export function bookingDateKey(value: BookingDateInput): string {
  const parts = parseBookingDateParts(value);
  if (!parts) return "";
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Shifts a YYYY-MM-DD string by a given number of days. */
export function shiftBookingDateKey(key: string, days: number): string {
  const parts = parseBookingDateParts(key);
  if (!parts) return key;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return bookingDateKey(date);
}

export function bookingDateEpoch(value: BookingDateInput): number {
  return parseBookingDate(value).getTime();
}

export function compareBookingDates(left: BookingDateInput, right: BookingDateInput): number {
  const leftEpoch = bookingDateEpoch(left);
  const rightEpoch = bookingDateEpoch(right);
  if (Number.isNaN(leftEpoch) || Number.isNaN(rightEpoch)) return Number.NaN;
  return Math.sign(leftEpoch - rightEpoch);
}

export function differenceInBookingNights(start: BookingDateInput, end: BookingDateInput): number {
  const startEpoch = bookingDateEpoch(start);
  const endEpoch = bookingDateEpoch(end);
  if (Number.isNaN(startEpoch) || Number.isNaN(endEpoch)) return 0;
  return Math.max(0, Math.round((endEpoch - startEpoch) / DAY_MS));
}

export function formatBookingDate(
  value: BookingDateInput,
  options: {
    locale?: string;
    weekday?: boolean;
  } = {},
): string {
  const date = parseBookingDate(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(options.locale ?? "en-US", {
    ...(options.weekday ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatBookingDateRange(
  start: BookingDateInput,
  end: BookingDateInput,
  locale = "en-US",
): string {
  const startParts = parseBookingDateParts(start);
  const endParts = parseBookingDateParts(end);
  if (!startParts || !endParts || compareBookingDates(end, start) <= 0) return "Dates TBD";

  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const startMonth = monthFormatter.format(parseBookingDate(start));
  const endMonth = monthFormatter.format(parseBookingDate(end));

  if (startParts.year !== endParts.year) {
    return `${startMonth} ${startParts.day}, ${startParts.year} – ${endMonth} ${endParts.day}, ${endParts.year}`;
  }
  return `${startMonth} ${startParts.day} – ${endMonth} ${endParts.day}, ${endParts.year}`;
}

export function bookingDateYear(value: BookingDateInput): number | null {
  return parseBookingDateParts(value)?.year ?? null;
}

export function isBookingDatePast(value: BookingDateInput, now = new Date()): boolean {
  return compareBookingDates(value, now) < 0;
}

