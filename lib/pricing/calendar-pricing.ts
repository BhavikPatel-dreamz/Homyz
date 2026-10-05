import { parseBookingDate, bookingDateKey } from "@/lib/booking/booking-date";
import { resolveNightlyRate } from "@/lib/pricing/price-tips";
import {
  evaluateDiscountEligibility,
  type DiscountEligibilityResult,
} from "@/services/discount-eligibility.service";
import {
  resolveWinningDiscount,
  type WinningDiscountResult,
} from "@/services/discount-priority.service";

export interface CalendarDatePromotion {
  applied: boolean;
  key: string;
  name: string;
  percentage: number;
  discountAmount: number; // in cents
  promotionalPrice: number; // in cents
  isCustomPromotion: boolean;
}

export interface CalendarDatePricing {
  dateKey: string;
  originalPrice: number; // in cents
  rateSource: "CUSTOM" | "WEEKEND" | "WEEKDAY";
  isWeekend: boolean;
  promotion: CalendarDatePromotion | null;
}

export interface SelectionPromotionStats {
  isConfigured: boolean;
  enabled: boolean;
  percentage: number;
  startDate: string | null;
  endDate: string | null;
  dateRangeText: string | null;
  totalNights: number;
  eligibleCount: number;
  ineligibleCount: number;
  isMixed: boolean;
  allEligible: boolean;
  noneEligible: boolean;
  avgOriginalPrice: number; // in cents
  avgGuestPrice: number; // in cents
  commonGuestPrice: number | null; // in cents
  minGuestPrice: number | null; // in cents
  maxGuestPrice: number | null; // in cents
}

/**
 * Universal resolver for a single calendar date's effective and promotional pricing.
 * Strictly uses the same authoritative pricing and discount engines as guest checkout.
 */
export function resolveCalendarDatePricing(opts: {
  dateKey: string;
  listing: {
    price?: number | null;
    weekdayBasePrice?: number | null;
    baseNightlyPrice?: number | null;
    weekendPrice?: number | null;
    weekendPremium?: number | null;
    customPrices?: Record<string, number> | Map<string, number> | null;
    nightlyPricing?: Record<string, number> | Map<string, number> | null;
    discounts?: Record<string, unknown> | null;
    isNewListing?: boolean;
  };
  todayKey?: string;
}): CalendarDatePricing {
  const d = parseBookingDate(opts.dateKey);
  const weekdayBasePrice = Math.max(
    0,
    Math.round(
      (opts.listing.weekdayBasePrice ??
        opts.listing.baseNightlyPrice ??
        opts.listing.price) ||
        0,
    ),
  );

  const resolved = resolveNightlyRate({
    date: d,
    dateStr: opts.dateKey,
    weekdayBasePrice,
    weekendPrice: opts.listing.weekendPrice,
    weekendPremium: opts.listing.weekendPremium,
    customPrices: opts.listing.customPrices ?? opts.listing.nightlyPricing,
  });

  const originalPrice = resolved.price;

  // Single-night discount evaluation (checkIn = dateKey, checkOut = next day)
  const nextDate = new Date(d.getTime() + 86_400_000);
  const eligibility = evaluateDiscountEligibility({
    checkIn: d,
    checkOut: nextDate,
    nights: 1,
    discounts: opts.listing.discounts,
    isNewListing: opts.listing.isNewListing,
    // Calendar/browse prices must expose the same new-listing promotion as
    // the authoritative booking quote.
    includeNewListingPromotion: true,
  });

  const winning = resolveWinningDiscount(eligibility, originalPrice);

  let promotion: CalendarDatePromotion | null = null;
  if (winning.selected && winning.percentage > 0) {
    const discountAmount = winning.amount;
    const promotionalPrice = Math.max(0, originalPrice - discountAmount);
    promotion = {
      applied: true,
      key: winning.key || "custom_promotion",
      name: winning.name || winning.label || "Custom promotion",
      percentage: winning.percentage,
      discountAmount,
      promotionalPrice,
      isCustomPromotion:
        winning.key === "custom_promotion" ||
        winning.type === "CUSTOM_PROMOTION",
    };
  }

  return {
    dateKey: opts.dateKey,
    originalPrice,
    rateSource: resolved.rateSource,
    isWeekend: resolved.isWeekend,
    promotion,
  };
}

/**
 * Fast, precomputed Map generator for an entire month grid.
 * Avoids any per-cell re-evaluation or per-render overhead.
 */
export function resolveCalendarMonthPricing(opts: {
  year: number;
  monthIndex: number;
  listing: {
    price?: number | null;
    weekdayBasePrice?: number | null;
    baseNightlyPrice?: number | null;
    weekendPrice?: number | null;
    weekendPremium?: number | null;
    customPrices?: Record<string, number> | Map<string, number> | null;
    nightlyPricing?: Record<string, number> | Map<string, number> | null;
    discounts?: Record<string, unknown> | null;
    isNewListing?: boolean;
  } | null;
  todayKey?: string;
}): Map<string, CalendarDatePricing> {
  const map = new Map<string, CalendarDatePricing>();
  if (!opts.listing) return map;

  const count = new Date(opts.year, opts.monthIndex + 1, 0).getDate();
  for (let day = 1; day <= count; day++) {
    const d = new Date(Date.UTC(opts.year, opts.monthIndex, day, 0, 0, 0, 0));
    const key = bookingDateKey(d);
    map.set(
      key,
      resolveCalendarDatePricing({
        dateKey: key,
        listing: opts.listing,
        todayKey: opts.todayKey,
      }),
    );
  }
  return map;
}

/**
 * Analyzes promotion applicability across a selected range of dates.
 * Determines whether the selection is all eligible, mixed, or ineligible.
 */
export function analyzeSelectionPromotion(opts: {
  dateKeys: string[];
  listing: {
    price?: number | null;
    weekdayBasePrice?: number | null;
    baseNightlyPrice?: number | null;
    weekendPrice?: number | null;
    weekendPremium?: number | null;
    customPrices?: Record<string, number> | Map<string, number> | null;
    nightlyPricing?: Record<string, number> | Map<string, number> | null;
    discounts?: Record<string, unknown> | null;
    isNewListing?: boolean;
  };
  cachedPricingMap?: Map<string, CalendarDatePricing>;
}): SelectionPromotionStats {
  const rawDiscounts =
    typeof opts.listing.discounts === "object" && opts.listing.discounts !== null
      ? (opts.listing.discounts as Record<string, any>)
      : {};

  const rawPromo = rawDiscounts.custom_promotion;
  const isConfigured = Boolean(
    rawPromo &&
      (typeof rawPromo === "object" ? rawPromo.percentage > 0 : Number(rawPromo) > 0),
  );
  const enabled = Boolean(
    rawPromo &&
      (typeof rawPromo === "object"
        ? rawPromo.enabled !== false && rawPromo.percentage > 0
        : Number(rawPromo) > 0),
  );
  const percentage =
    typeof rawPromo === "object"
      ? Number(rawPromo.percentage) || 15
      : Number(rawPromo) || 15;

  let startDate: string | null = null;
  let endDate: string | null = null;
  if (typeof rawPromo === "object" && rawPromo !== null) {
    if (typeof rawPromo.startDate === "string" && rawPromo.startDate.trim()) {
      startDate = rawPromo.startDate.trim();
    }
    if (typeof rawPromo.endDate === "string" && rawPromo.endDate.trim()) {
      endDate = rawPromo.endDate.trim();
    }
  }

  let dateRangeText: string | null = null;
  if (startDate && endDate) {
    dateRangeText = `${startDate} – ${endDate}`;
  } else if (startDate) {
    dateRangeText = `From ${startDate}`;
  } else if (endDate) {
    dateRangeText = `Until ${endDate}`;
  } else if (isConfigured) {
    dateRangeText = "Property-wide (all eligible dates)";
  }

  const totalNights = opts.dateKeys.length;
  if (totalNights === 0) {
    return {
      isConfigured,
      enabled,
      percentage,
      startDate,
      endDate,
      dateRangeText,
      totalNights: 0,
      eligibleCount: 0,
      ineligibleCount: 0,
      isMixed: false,
      allEligible: false,
      noneEligible: true,
      avgOriginalPrice: 0,
      avgGuestPrice: 0,
      commonGuestPrice: null,
      minGuestPrice: null,
      maxGuestPrice: null,
    };
  }

  let eligibleCount = 0;
  let ineligibleCount = 0;
  let sumOriginal = 0;
  let sumGuest = 0;
  const guestPrices: number[] = [];

  for (const k of opts.dateKeys) {
    const day =
      opts.cachedPricingMap?.get(k) ||
      resolveCalendarDatePricing({
        dateKey: k,
        listing: opts.listing,
      });

    sumOriginal += day.originalPrice;
    if (day.promotion?.applied) {
      eligibleCount++;
      sumGuest += day.promotion.promotionalPrice;
      guestPrices.push(day.promotion.promotionalPrice);
    } else {
      ineligibleCount++;
      sumGuest += day.originalPrice;
      guestPrices.push(day.originalPrice);
    }
  }

  const isMixed = eligibleCount > 0 && ineligibleCount > 0;
  const allEligible = eligibleCount === totalNights && eligibleCount > 0;
  const noneEligible = eligibleCount === 0;

  const avgOriginalPrice = Math.round(sumOriginal / totalNights);
  const avgGuestPrice = Math.round(sumGuest / totalNights);

  const uniqueGuest = new Set(guestPrices);
  const commonGuestPrice = uniqueGuest.size === 1 ? guestPrices[0] : null;
  const minGuestPrice = guestPrices.length > 0 ? Math.min(...guestPrices) : null;
  const maxGuestPrice = guestPrices.length > 0 ? Math.max(...guestPrices) : null;

  return {
    isConfigured,
    enabled,
    percentage,
    startDate,
    endDate,
    dateRangeText,
    totalNights,
    eligibleCount,
    ineligibleCount,
    isMixed,
    allEligible,
    noneEligible,
    avgOriginalPrice,
    avgGuestPrice,
    commonGuestPrice,
    minGuestPrice,
    maxGuestPrice,
  };
}
