/**
 * HOMYZ — DISCOUNT ELIGIBILITY ENGINE (PHASE 3)
 *
 * Evaluates which host-configured discounts are eligible for a given stay context.
 *
 * Rules:
 * 1. Evaluates eligibility independently per discount type (Weekly, Monthly, Last-Minute, New Listing).
 * 2. Strictly DOES NOT pick a winner or apply discounts (that is Phase 4).
 * 3. Strictly DOES NOT stack discounts.
 * 4. Returns stable, machine-readable reason codes alongside boolean eligibility.
 * 5. Uses normalized UTC calendar dates to guarantee identical client/server results.
 */

import {
  BookingDateInput,
  differenceInBookingNights,
  parseBookingDate,
} from "@/lib/booking/booking-date";
import {
  DEFAULT_DISCOUNT_PERCENTAGES,
  type DiscountType,
} from "@/lib/validation/listing";

export const DISCOUNT_ELIGIBILITY_REASONS = {
  ELIGIBLE: "ELIGIBLE",
  MINIMUM_STAY_MET: "MINIMUM_STAY_MET",
  DISABLED: "DISABLED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  STAY_TOO_SHORT: "STAY_TOO_SHORT",
  STAY_TOO_LONG: "STAY_TOO_LONG",
  OUTSIDE_LAST_MINUTE_WINDOW: "OUTSIDE_LAST_MINUTE_WINDOW",
  LISTING_NOT_ELIGIBLE: "LISTING_NOT_ELIGIBLE",
  PROMOTION_EXPIRED: "PROMOTION_EXPIRED",
  PROMOTION_EXCLUDED: "PROMOTION_EXCLUDED",
  RULE_NOT_DEFINED: "RULE_NOT_DEFINED",
  INVALID_DATES: "INVALID_DATES",
  NOT_EVALUATED: "NOT_EVALUATED",
} as const;

export type DiscountEligibilityReason =
  (typeof DISCOUNT_ELIGIBILITY_REASONS)[keyof typeof DISCOUNT_ELIGIBILITY_REASONS];

export interface DiscountEligibilityItem {
  key: DiscountType | string;
  name: string;
  configured: boolean;
  enabled: boolean;
  eligible: boolean;
  percentage: number | null;
  reason: DiscountEligibilityReason;
  priorityOrder: number;
  requiredNights?: number;
  actualNights?: number;
  daysUntilCheckIn?: number;
  windowDays?: number;
}

export interface DiscountEligibilityParams {
  listingId?: string | null;
  checkIn?: BookingDateInput | null;
  checkOut?: BookingDateInput | null;
  bookingDate?: BookingDateInput | null;
  bookingCreatedAt?: BookingDateInput | null;
  nights?: number | null;
  listingCreatedAt?: BookingDateInput | null;
  discounts?: Record<string, unknown> | null;
  discountConfig?: Record<string, unknown> | null;
  isNewListing?: boolean;
  completedBookingsCount?: number | null;
  approvedBookingCount?: number | null;
  includeNewListingPromotion?: boolean;
}

export interface DiscountEligibilityResult {
  newListing: DiscountEligibilityItem;
  lastMinute: DiscountEligibilityItem;
  weekly: DiscountEligibilityItem;
  monthly: DiscountEligibilityItem;
  new_listing: DiscountEligibilityItem;
  last_minute: DiscountEligibilityItem;
  eligibleDiscounts: DiscountEligibilityItem[];
}

/**
 * Extracts normalized configuration values from an arbitrary discount record entry.
 */
function parseDiscountConfigEntry(
  val: unknown,
  defaultPercentage: number,
): { configured: boolean; enabled: boolean; percentage: number | null } {
  if (val === true) {
    return { configured: true, enabled: true, percentage: defaultPercentage };
  }
  if (val === false) {
    return { configured: true, enabled: false, percentage: defaultPercentage };
  }
  if (typeof val === "number" && Number.isFinite(val) && val > 0 && val <= 100) {
    return { configured: true, enabled: true, percentage: val };
  }
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    const enabled = obj.enabled !== false;
    let pct: number | null = null;
    if (typeof obj.percentage === "number" && Number.isFinite(obj.percentage) && obj.percentage > 0 && obj.percentage <= 100) {
      pct = obj.percentage;
    } else if (typeof obj.discountPercentage === "number" && Number.isFinite(obj.discountPercentage) && obj.discountPercentage > 0 && obj.discountPercentage <= 100) {
      pct = obj.discountPercentage;
    } else if (enabled) {
      pct = defaultPercentage;
    }
    return {
      configured: true,
      enabled,
      percentage: pct,
    };
  }
  return { configured: false, enabled: false, percentage: null };
}

/**
 * Authoritative central Discount Eligibility Engine.
 * Evaluates whether each discount type qualifies for the given reservation stay.
 */
export function evaluateDiscountEligibility(
  params: DiscountEligibilityParams,
): DiscountEligibilityResult {
  const rawDiscounts = params.discounts ?? params.discountConfig ?? {};

  let datesProvided = false;
  let datesValid = false;
  let checkInDate: Date | null = null;
  let checkOutDate: Date | null = null;
  let actualNights = 0;
  let daysUntilCheckIn = 0;

  if (params.checkIn && params.checkOut) {
    datesProvided = true;
    checkInDate = parseBookingDate(params.checkIn);
    checkOutDate = parseBookingDate(params.checkOut);

    if (!Number.isNaN(checkInDate.getTime()) && !Number.isNaN(checkOutDate.getTime())) {
      if (checkOutDate.getTime() > checkInDate.getTime()) {
        datesValid = true;
        actualNights = typeof params.nights === "number" && params.nights > 0
          ? params.nights
          : differenceInBookingNights(checkInDate, checkOutDate);

        const bookingMoment = params.bookingDate ?? params.bookingCreatedAt ?? new Date();
        const bDate = parseBookingDate(bookingMoment);
        daysUntilCheckIn = Math.round((checkInDate.getTime() - bDate.getTime()) / 86_400_000);
      }
    }
  }

  // -------------------------------------------------------------
  // 1. Weekly Discount (Authoritative threshold: 7+ nights)
  // -------------------------------------------------------------
  const rawWeekly = rawDiscounts.weekly;
  const weeklyParsed = parseDiscountConfigEntry(rawWeekly, DEFAULT_DISCOUNT_PERCENTAGES.weekly);
  const weeklyRequiredNights = 7;

  let weeklyEligible = false;
  let weeklyReason: DiscountEligibilityReason;

  if (!weeklyParsed.configured) {
    weeklyReason = DISCOUNT_ELIGIBILITY_REASONS.NOT_CONFIGURED;
  } else if (!weeklyParsed.enabled) {
    weeklyReason = DISCOUNT_ELIGIBILITY_REASONS.DISABLED;
  } else if (!datesProvided) {
    weeklyReason = DISCOUNT_ELIGIBILITY_REASONS.NOT_EVALUATED;
  } else if (!datesValid) {
    weeklyReason = DISCOUNT_ELIGIBILITY_REASONS.INVALID_DATES;
  } else if (actualNights < weeklyRequiredNights) {
    weeklyReason = DISCOUNT_ELIGIBILITY_REASONS.STAY_TOO_SHORT;
  } else {
    weeklyEligible = true;
    weeklyReason = DISCOUNT_ELIGIBILITY_REASONS.MINIMUM_STAY_MET;
  }

  const weeklyItem: DiscountEligibilityItem = {
    key: "weekly",
    name: "Weekly Stay Discount",
    configured: weeklyParsed.configured,
    enabled: weeklyParsed.enabled,
    eligible: weeklyEligible,
    percentage: weeklyParsed.percentage,
    requiredNights: weeklyRequiredNights,
    actualNights: datesValid ? actualNights : undefined,
    reason: weeklyReason,
    priorityOrder: 2,
  };

  // -------------------------------------------------------------
  // 2. Monthly Discount (Authoritative threshold: 28+ nights)
  // -------------------------------------------------------------
  const rawMonthly = rawDiscounts.monthly;
  const monthlyParsed = parseDiscountConfigEntry(rawMonthly, DEFAULT_DISCOUNT_PERCENTAGES.monthly);
  const monthlyRequiredNights = 28;

  let monthlyEligible = false;
  let monthlyReason: DiscountEligibilityReason;

  if (!monthlyParsed.configured) {
    monthlyReason = DISCOUNT_ELIGIBILITY_REASONS.NOT_CONFIGURED;
  } else if (!monthlyParsed.enabled) {
    monthlyReason = DISCOUNT_ELIGIBILITY_REASONS.DISABLED;
  } else if (!datesProvided) {
    monthlyReason = DISCOUNT_ELIGIBILITY_REASONS.NOT_EVALUATED;
  } else if (!datesValid) {
    monthlyReason = DISCOUNT_ELIGIBILITY_REASONS.INVALID_DATES;
  } else if (actualNights < monthlyRequiredNights) {
    monthlyReason = DISCOUNT_ELIGIBILITY_REASONS.STAY_TOO_SHORT;
  } else {
    monthlyEligible = true;
    monthlyReason = DISCOUNT_ELIGIBILITY_REASONS.MINIMUM_STAY_MET;
  }

  const monthlyItem: DiscountEligibilityItem = {
    key: "monthly",
    name: "Monthly Stay Discount",
    configured: monthlyParsed.configured,
    enabled: monthlyParsed.enabled,
    eligible: monthlyEligible,
    percentage: monthlyParsed.percentage,
    requiredNights: monthlyRequiredNights,
    actualNights: datesValid ? actualNights : undefined,
    reason: monthlyReason,
    priorityOrder: 1,
  };

  // -------------------------------------------------------------
  // 3. Last-Minute Discount (Authoritative threshold: <= 2 days)
  // -------------------------------------------------------------
  const rawLastMinute = rawDiscounts.last_minute ?? rawDiscounts.lastMinute;
  const lastMinuteParsed = parseDiscountConfigEntry(rawLastMinute, DEFAULT_DISCOUNT_PERCENTAGES.last_minute);
  let lastMinuteWindow = 2;
  if (typeof rawLastMinute === "object" && rawLastMinute !== null && typeof (rawLastMinute as any).daysBefore === "number") {
    lastMinuteWindow = (rawLastMinute as any).daysBefore;
  }

  let lastMinuteEligible = false;
  let lastMinuteReason: DiscountEligibilityReason;

  if (!lastMinuteParsed.configured) {
    lastMinuteReason = DISCOUNT_ELIGIBILITY_REASONS.NOT_CONFIGURED;
  } else if (!lastMinuteParsed.enabled) {
    lastMinuteReason = DISCOUNT_ELIGIBILITY_REASONS.DISABLED;
  } else if (!datesProvided) {
    lastMinuteReason = DISCOUNT_ELIGIBILITY_REASONS.NOT_EVALUATED;
  } else if (!datesValid || daysUntilCheckIn < 0) {
    lastMinuteReason = DISCOUNT_ELIGIBILITY_REASONS.INVALID_DATES;
  } else if (daysUntilCheckIn > lastMinuteWindow) {
    lastMinuteReason = DISCOUNT_ELIGIBILITY_REASONS.OUTSIDE_LAST_MINUTE_WINDOW;
  } else {
    lastMinuteEligible = true;
    lastMinuteReason = DISCOUNT_ELIGIBILITY_REASONS.ELIGIBLE;
  }

  const lastMinuteItem: DiscountEligibilityItem = {
    key: "last_minute",
    name: "Last-Minute Booking Discount",
    configured: lastMinuteParsed.configured,
    enabled: lastMinuteParsed.enabled,
    eligible: lastMinuteEligible,
    percentage: lastMinuteParsed.percentage,
    windowDays: lastMinuteWindow,
    daysUntilCheckIn: datesValid ? daysUntilCheckIn : undefined,
    reason: lastMinuteReason,
    priorityOrder: 3,
  };

  // -------------------------------------------------------------
  // 4. New Listing Promotion (Authoritative: First 3 bookings)
  // -------------------------------------------------------------
  const rawNewListing = rawDiscounts.new_listing ?? rawDiscounts.newListing;
  const newListingParsed = parseDiscountConfigEntry(rawNewListing, DEFAULT_DISCOUNT_PERCENTAGES.new_listing);
  const isConfiguredOrFlagged = newListingParsed.configured || params.isNewListing === true;
  const bookingsCount = params.completedBookingsCount ?? params.approvedBookingCount;

  let newListingEligible = false;
  let newListingReason: DiscountEligibilityReason;

  if (params.includeNewListingPromotion === false) {
    newListingReason = DISCOUNT_ELIGIBILITY_REASONS.PROMOTION_EXCLUDED;
  } else if (newListingParsed.configured && !newListingParsed.enabled) {
    newListingReason = DISCOUNT_ELIGIBILITY_REASONS.DISABLED;
  } else if (!isConfiguredOrFlagged) {
    newListingReason = DISCOUNT_ELIGIBILITY_REASONS.NOT_CONFIGURED;
  } else if (params.isNewListing === false) {
    newListingReason = DISCOUNT_ELIGIBILITY_REASONS.LISTING_NOT_ELIGIBLE;
  } else if (typeof bookingsCount === "number" && bookingsCount >= 3) {
    newListingReason = DISCOUNT_ELIGIBILITY_REASONS.PROMOTION_EXPIRED;
  } else if (datesProvided && !datesValid) {
    newListingReason = DISCOUNT_ELIGIBILITY_REASONS.INVALID_DATES;
  } else {
    newListingEligible = true;
    newListingReason = DISCOUNT_ELIGIBILITY_REASONS.ELIGIBLE;
  }

  const newListingItem: DiscountEligibilityItem = {
    key: "new_listing",
    name: "New Listing Promotion",
    configured: isConfiguredOrFlagged,
    enabled: newListingParsed.configured ? newListingParsed.enabled : (params.isNewListing === true),
    eligible: newListingEligible,
    percentage: newListingParsed.percentage ?? (newListingEligible ? DEFAULT_DISCOUNT_PERCENTAGES.new_listing : null),
    reason: newListingReason,
    priorityOrder: 4,
  };

  // -------------------------------------------------------------
  // Collect all eligible discounts (WITHOUT picking a single winner)
  // -------------------------------------------------------------
  const eligibleDiscounts: DiscountEligibilityItem[] = [];
  if (monthlyItem.eligible) eligibleDiscounts.push(monthlyItem);
  if (weeklyItem.eligible) eligibleDiscounts.push(weeklyItem);
  if (lastMinuteItem.eligible) eligibleDiscounts.push(lastMinuteItem);
  if (newListingItem.eligible) eligibleDiscounts.push(newListingItem);

  return {
    newListing: newListingItem,
    lastMinute: lastMinuteItem,
    weekly: weeklyItem,
    monthly: monthlyItem,
    new_listing: newListingItem,
    last_minute: lastMinuteItem,
    eligibleDiscounts,
  };
}

export {
  resolveWinningDiscount,
  WINNING_DISCOUNT_SELECTION_REASONS,
  AUTHORITATIVE_DISCOUNT_PRIORITY_ORDER,
  type WinningDiscountType,
  type WinningDiscountSelectionReason,
  type WinningDiscountCandidate,
  type WinningDiscountSelected,
  type WinningDiscountResult,
  type ResolveWinningDiscountOptions,
} from "./discount-priority.service";

