import {
  bookingDateKey,
  compareBookingDates,
  differenceInBookingNights,
  parseBookingDate,
  shiftBookingDateKey,
  type BookingDateInput,
} from "@/lib/booking/booking-date";

export type UnavailableDateRange = {
  start: BookingDateInput;
  end: BookingDateInput;
};

export type StayAvailabilityListing = {
  guests?: number | null;
  minNights?: number | null;
  maxNights?: number | null;
  advanceNotice?: string | null;
  sameDayCutoff?: string | null;
  allowSameDayRequests?: boolean | null;
  blockedDates?: string[] | null;
  discounts?: unknown;
};

export type StayAvailabilityCode =
  | "INVALID_DATES"
  | "PAST_CHECK_IN"
  | "MINIMUM_STAY"
  | "MAXIMUM_STAY"
  | "GUEST_CAPACITY"
  | "ADVANCE_NOTICE"
  | "SAME_DAY_DISABLED"
  | "SAME_DAY_CUTOFF"
  | "BLOCKED_DATE"
  | "BOOKING_OVERLAP";

export type StayAvailabilityResult =
  | { available: true; nights: number; minimumNights: number; maximumNights: number }
  | {
      available: false;
      nights: number;
      minimumNights: number;
      maximumNights: number;
      code: StayAvailabilityCode;
      message: string;
      date?: string;
    };

function localTodayKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function parseRequiredAdvanceDays(notice: string | null | undefined): number {
  const normalized = notice?.trim().toLowerCase() ?? "same day";
  if (normalized === "same day") return 0;
  const match = normalized.match(/(?:at least\s+)?(\d+)\s+days?/);
  return match ? Math.max(0, Number(match[1])) : 0;
}

/** Returns the cutoff as local minutes after midnight. Midnight means end of day. */
export function parseSameDayCutoffMinutes(cutoff: string | null | undefined): number {
  const normalized = cutoff?.trim() || "12:00 AM";
  const twelveHour = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2] ?? 0);
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return 1440;
    if (twelveHour[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (twelveHour[3].toUpperCase() === "AM" && hour === 12) {
      // The existing product treats "12:00 AM" as no same-day cutoff.
      return minute === 0 ? 1440 : minute;
    }
    return hour * 60 + minute;
  }

  const twentyFourHour = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return hour * 60 + minute;
  }
  return 1440;
}

/** Backwards-compatible hour helper used by existing host-calendar tests. */
export function parseCutoffHour(cutoff: string | null | undefined): number {
  return parseSameDayCutoffMinutes(cutoff) / 60;
}

export function getMinimumStayForCheckIn(
  listing: StayAvailabilityListing,
  checkIn: BookingDateInput,
): number {
  const checkInKey = bookingDateKey(checkIn);
  const discounts = listing.discounts && typeof listing.discounts === "object" && !Array.isArray(listing.discounts)
    ? listing.discounts as Record<string, unknown>
    : {};
  const customMinimums = discounts.customMinNights && typeof discounts.customMinNights === "object" && !Array.isArray(discounts.customMinNights)
    ? discounts.customMinNights as Record<string, unknown>
    : {};
  const custom = customMinimums[checkInKey];
  return typeof custom === "number" && Number.isFinite(custom) && custom > 0
    ? Math.max(1, Math.round(custom))
    : Math.max(1, Math.round(listing.minNights ?? 1));
}

export function getEarliestCheckInKey(
  listing: StayAvailabilityListing,
  now = new Date(),
): string {
  const todayKey = localTodayKey(now);
  const requiredDays = parseRequiredAdvanceDays(listing.advanceNotice);
  if (requiredDays > 0) return shiftBookingDateKey(todayKey, requiredDays);
  if (listing.allowSameDayRequests === false) return shiftBookingDateKey(todayKey, 1);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= parseSameDayCutoffMinutes(listing.sameDayCutoff)
    ? shiftBookingDateKey(todayKey, 1)
    : todayKey;
}

export function rangesOverlap(
  start: BookingDateInput,
  end: BookingDateInput,
  range: UnavailableDateRange,
): boolean {
  return compareBookingDates(start, range.end) < 0 && compareBookingDates(end, range.start) > 0;
}

export function validateStayAvailability(opts: {
  listing: StayAvailabilityListing;
  checkIn: BookingDateInput;
  checkOut: BookingDateInput;
  guests?: number;
  now?: Date;
  unavailableRanges?: UnavailableDateRange[];
  skipLengthRules?: boolean;
}): StayAvailabilityResult {
  const { listing } = opts;
  const checkIn = parseBookingDate(opts.checkIn);
  const checkOut = parseBookingDate(opts.checkOut);
  const minimumNights = getMinimumStayForCheckIn(listing, opts.checkIn);
  const maximumNights = Math.max(minimumNights, Math.round(listing.maxNights ?? 365));
  const nights = differenceInBookingNights(checkIn, checkOut);

  const fail = (code: StayAvailabilityCode, message: string, date?: string): StayAvailabilityResult => ({
    available: false,
    nights,
    minimumNights,
    maximumNights,
    code,
    message,
    ...(date ? { date } : {}),
  });

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || compareBookingDates(checkOut, checkIn) <= 0) {
    return fail("INVALID_DATES", "Checkout must be after check-in");
  }

  const now = opts.now ?? new Date();
  const todayKey = localTodayKey(now);
  const checkInKey = bookingDateKey(checkIn);
  if (checkInKey < todayKey) return fail("PAST_CHECK_IN", "Check-in date cannot be in the past");

  if (!opts.skipLengthRules && nights < minimumNights) {
    return fail("MINIMUM_STAY", `Minimum stay is ${minimumNights} ${minimumNights === 1 ? "night" : "nights"}`);
  }
  if (!opts.skipLengthRules && nights > maximumNights) {
    return fail("MAXIMUM_STAY", `Maximum stay is ${maximumNights} ${maximumNights === 1 ? "night" : "nights"}`);
  }

  const requestedGuests = Math.max(1, Math.round(opts.guests ?? 1));
  const maximumGuests = Math.max(1, Math.round(listing.guests ?? 1));
  if (requestedGuests > maximumGuests) {
    return fail("GUEST_CAPACITY", `Property accommodates a maximum of ${maximumGuests} guests`);
  }

  const requiredAdvanceDays = parseRequiredAdvanceDays(listing.advanceNotice);
  const daysUntilCheckIn = differenceInBookingNights(todayKey, checkInKey);
  if (checkInKey === todayKey) {
    if (listing.allowSameDayRequests === false) {
      return fail("SAME_DAY_DISABLED", "Same-day bookings are not allowed for this property");
    }
    if (requiredAdvanceDays > 0) {
      return fail("ADVANCE_NOTICE", `This property requires at least ${requiredAdvanceDays} ${requiredAdvanceDays === 1 ? "day" : "days"} advance notice before arrival`);
    }
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (currentMinutes >= parseSameDayCutoffMinutes(listing.sameDayCutoff)) {
      return fail("SAME_DAY_CUTOFF", `Same-day bookings for today closed at ${listing.sameDayCutoff || "12:00 AM"}`);
    }
  } else if (daysUntilCheckIn < requiredAdvanceDays) {
    return fail("ADVANCE_NOTICE", `This property requires at least ${requiredAdvanceDays} ${requiredAdvanceDays === 1 ? "day" : "days"} advance notice before arrival`);
  }

  const blockedDates = new Set(Array.isArray(listing.blockedDates) ? listing.blockedDates : []);
  for (let dateKey = checkInKey; dateKey < bookingDateKey(checkOut); dateKey = shiftBookingDateKey(dateKey, 1)) {
    if (blockedDates.has(dateKey)) {
      return fail("BLOCKED_DATE", `The date ${dateKey} is not available for booking`, dateKey);
    }
  }

  const overlappingRange = opts.unavailableRanges?.find((range) => rangesOverlap(checkIn, checkOut, range));
  if (overlappingRange) {
    return fail("BOOKING_OVERLAP", "The selected dates are not available");
  }

  return { available: true, nights, minimumNights, maximumNights };
}

export function isCheckInDateAllowed(
  listing: StayAvailabilityListing,
  checkIn: BookingDateInput,
  now = new Date(),
): boolean {
  const checkInKey = bookingDateKey(checkIn);
  if (!checkInKey || checkInKey < getEarliestCheckInKey(listing, now)) return false;
  return !new Set(listing.blockedDates ?? []).has(checkInKey);
}
