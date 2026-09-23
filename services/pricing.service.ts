import { AppError } from "@/lib/api/errors";
import { TaxCalculator } from "@/lib/tax/tax-calculator";
import type { CalculatedTaxItem, HostPayoutBreakdown, ListingTaxDTO, TaxRuleDTO } from "@/lib/tax/types";
import { getHostServiceFeePercentage } from "@/services/app-settings.service";

export interface NightRateBreakdown {
  date: string; // YYYY-MM-DD
  price: number; // cents
  isWeekend: boolean;
  rateSource: "CUSTOM" | "WEEKEND" | "WEEKDAY";
}

export interface AppliedDiscount {
  key: "monthly" | "weekly" | "last_minute" | "new_listing" | "early_bird" | "custom_promotion" | "non_refundable";
  name: string;
  percentage: number; // 0 - 100
  amount: number; // cents
}

export interface BookingPricingParams {
  checkIn: Date | string;
  checkOut: Date | string;
  weekdayBasePrice: number; // cents (required, > 0)
  weekendPrice?: number | null; // cents
  customPrices?: Record<string, number> | null; // map of YYYY-MM-DD -> cents
  cleaningFee?: number | null; // cents
  extraGuestFee?: number | null; // cents per extra guest per night
  baseGuests?: number; // base guest capacity included in price (defaults to 1)
  guests?: number; // requested total guests (defaults to 1)
  pets?: number; // requested pets (defaults to 0)
  petFee?: number | null; // cents flat or per pet
  discounts?: Record<string, unknown> | null;
  isNewListing?: boolean;
  /** Reservation quotes can opt out of the marketing-only new-listing promo. */
  includeNewListingPromotion?: boolean;
  bookingCreatedAt?: Date | string;
  hostServiceFeePercentage?: number; // optional override; defaults to DB setting
  taxRules?: TaxRuleDTO[];
  hostTaxes?: ListingTaxDTO[];
  nonRefundableDiscountPercentage?: number | null;
  currency?: string;
}

export interface BookingPricingResult {
  nights: number;
  weekdayNights: number;
  weekendNights: number;
  customPricedNights: number;
  weekdayBasePrice: number; // cents
  weekendPrice: number | null; // cents
  effectiveBasePrice: number; // cents (weighted or standard base nightly)
  staySubtotal: number; // sum of nightly resolved rates (cents)
  appliedDiscount: AppliedDiscount | null;
  nonRefundableDiscount: AppliedDiscount | null;
  discountAmount: number; // cents (0 if no discount)
  discountPercentage: number; // percentage applied (0 if none)
  accommodationSubtotal: number; // staySubtotal - discountAmount (cents)
  cleaningFee: number; // cents
  extraGuestFee: number; // cents
  petFee: number; // cents
  totalAdditionalFees: number; // cleaningFee + extraGuestFee + petFee (cents)
  hostServiceFeePercentage: number; // e.g. 15
  hostServiceFee: number; // cents (calculated on accommodationSubtotal)
  taxableBase: number; // accommodationSubtotal + taxable fees (strictly excludes hostServiceFee)
  taxes: CalculatedTaxItem[];
  taxTotal: number; // cents
  platformRemittedTaxTotal: number; // cents
  hostRemittedTaxTotal: number; // cents
  guestTotal: number; // accommodationSubtotal + fees + taxes + hostServiceFee (cents)
  payoutBreakdown: HostPayoutBreakdown;
  breakdown: NightRateBreakdown[];
  currency: string;
}

export interface SpecialOfferPricingParams {
  specialOfferAmount: number; // cents (host-offered accommodation subtotal)
  nights: number;
  cleaningFee?: number | null;
  extraGuestFee?: number | null;
  petFee?: number | null;
  guests?: number;
  hostServiceFeePercentage?: number;
  taxRules?: TaxRuleDTO[];
  hostTaxes?: ListingTaxDTO[];
  currency?: string;
}

/**
 * Normalizes input date or string to UTC midnight to avoid local timezone offset drift.
 */
export function parseDateToUtcMidnight(input: Date | string): Date {
  if (typeof input === "string") {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    }
  }
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Formats a Date to YYYY-MM-DD string key in UTC.
 */
export function formatDateToKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns true if a given date falls on a Middle East / Saudi weekend night:
 * Thursday (day 4) and Friday (day 5).
 */
export function isWeekendNight(date: Date | string): boolean {
  if (typeof date === "string") {
    const d = parseDateToUtcMidnight(date);
    const day = d.getUTCDay();
    return day === 4 || day === 5;
  }
  const day = (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0)
    ? date.getUTCDay()
    : date.getDay();
  return day === 4 || day === 5;
}

/**
 * Resolves the nightly rate for a specific date using strict priority order:
 * Custom Date Price > Weekend Price > Weekday Base Price
 */
export function resolveNightlyRate(opts: {
  date: Date;
  dateStr: string;
  weekdayBasePrice: number;
  weekendPrice?: number | null;
  customPrices?: Record<string, number> | null;
}): { price: number; rateSource: "CUSTOM" | "WEEKEND" | "WEEKDAY"; isWeekend: boolean } {
  const isWeekend = isWeekendNight(opts.date);

  // 1. Custom Calendar Date Price (Highest Priority)
  if (opts.customPrices && typeof opts.customPrices === "object") {
    const custom = opts.customPrices[opts.dateStr];
    if (typeof custom === "number" && custom >= 0) {
      return { price: custom, rateSource: "CUSTOM", isWeekend };
    }
  }

  // 2. Weekend Price (Applies to weekend nights when configured)
  if (isWeekend && typeof opts.weekendPrice === "number" && opts.weekendPrice > 0) {
    return { price: opts.weekendPrice, rateSource: "WEEKEND", isWeekend };
  }

  // 3. Weekday Base Price (Fallback for weekdays or unconfigured weekends)
  return { price: Math.max(0, opts.weekdayBasePrice), rateSource: "WEEKDAY", isWeekend };
}

/**
 * Single Discount Rule Resolver.
 * Evaluates all discount candidates and strictly enforces single discount per stay (NO stacking).
 * Selects the single highest qualifying discount percentage.
 * Breaks ties using standard promotional priority: Monthly > Weekly > Last Minute > New Listing > Early Bird > Custom Promotion.
 */
export function resolveSingleDiscount(opts: {
  staySubtotal: number;
  nights: number;
  checkIn: Date;
  discounts?: Record<string, unknown> | null;
  isNewListing?: boolean;
  /** Reservation quotes can opt out of the marketing-only new-listing promo. */
  includeNewListingPromotion?: boolean;
  bookingCreatedAt?: Date;
}): AppliedDiscount | null {
  if (opts.staySubtotal <= 0 || opts.nights < 1) return null;

  const rawDiscounts = opts.discounts && typeof opts.discounts === "object" ? opts.discounts : {};
  const bookingTime = opts.bookingCreatedAt ? opts.bookingCreatedAt.getTime() : Date.now();
  const checkInTime = opts.checkIn.getTime();
  const daysUntilCheckIn = Math.max(0, Math.floor((checkInTime - bookingTime) / (1000 * 60 * 60 * 24)));

  interface Candidate {
    key: AppliedDiscount["key"];
    name: string;
    percentage: number;
    priorityOrder: number; // lower number = higher priority for ties
  }

  const candidates: Candidate[] = [];

  // Helper to extract enabled & percentage
  const parseDiscountEntry = (val: unknown, defaultPct: number): number | null => {
    if (val === true) return defaultPct;
    if (typeof val === "number" && val > 0 && val <= 100) return val;
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      if (obj.enabled !== false && typeof obj.percentage === "number" && obj.percentage > 0 && obj.percentage <= 100) {
        return obj.percentage;
      }
    }
    return null;
  };

  // 1. Monthly Discount (28+ nights) - Priority 1
  if (opts.nights >= 28) {
    const pct = parseDiscountEntry(rawDiscounts.monthly, 25);
    if (pct !== null) {
      candidates.push({
        key: "monthly",
        name: "Monthly Stay Discount",
        percentage: pct,
        priorityOrder: 1,
      });
    }
  }

  // 2. Weekly Discount (7+ nights) - Priority 2
  if (opts.nights >= 7) {
    const pct = parseDiscountEntry(rawDiscounts.weekly, 10);
    if (pct !== null) {
      candidates.push({
        key: "weekly",
        name: "Weekly Stay Discount",
        percentage: pct,
        priorityOrder: 2,
      });
    }
  }

  // 3. Last-Minute Discount (e.g. booked within 2 days of arrival) - Priority 3
  const lastMinuteEntry = rawDiscounts.last_minute;
  if (lastMinuteEntry) {
    let daysThreshold = 2;
    if (typeof lastMinuteEntry === "object" && lastMinuteEntry !== null && typeof (lastMinuteEntry as any).daysBefore === "number") {
      daysThreshold = (lastMinuteEntry as any).daysBefore;
    }
    if (daysUntilCheckIn <= daysThreshold) {
      const pct = parseDiscountEntry(lastMinuteEntry, 15);
      if (pct !== null) {
        candidates.push({
          key: "last_minute",
          name: "Last-Minute Booking Discount",
          percentage: pct,
          priorityOrder: 3,
        });
      }
    }
  }

  // 4. New Listing Promotion (20% for first bookings or flagged) - Priority 4
  const isNewListingFlag = opts.isNewListing || rawDiscounts.new_listing === true ||
    (typeof rawDiscounts.new_listing === "object" && rawDiscounts.new_listing !== null && (rawDiscounts.new_listing as any).enabled !== false);
  if (opts.includeNewListingPromotion !== false && isNewListingFlag) {
    const pct = parseDiscountEntry(rawDiscounts.new_listing, 20);
    if (pct !== null) {
      candidates.push({
        key: "new_listing",
        name: "New Listing Promotion",
        percentage: pct,
        priorityOrder: 4,
      });
    }
  }

  // 5. Early-Bird Discount (e.g. booked >= 30 days in advance) - Priority 5
  const earlyBirdEntry = rawDiscounts.early_bird;
  if (earlyBirdEntry) {
    let advanceThreshold = 30;
    if (typeof earlyBirdEntry === "object" && earlyBirdEntry !== null && typeof (earlyBirdEntry as any).daysInAdvance === "number") {
      advanceThreshold = (earlyBirdEntry as any).daysInAdvance;
    }
    if (daysUntilCheckIn >= advanceThreshold) {
      const pct = parseDiscountEntry(earlyBirdEntry, 10);
      if (pct !== null) {
        candidates.push({
          key: "early_bird",
          name: "Early-Bird Booking Discount",
          percentage: pct,
          priorityOrder: 5,
        });
      }
    }
  }

  // 6. Custom Promotion - Priority 6
  const customPromoEntry = rawDiscounts.custom_promotion;
  if (customPromoEntry) {
    const pct = parseDiscountEntry(customPromoEntry, 15);
    if (pct !== null) {
      candidates.push({
        key: "custom_promotion",
        name: "Custom Promotional Discount",
        percentage: pct,
        priorityOrder: 6,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Select single best discount: Highest percentage wins.
  // If percentages are equal, break tie with lower priorityOrder (Monthly > Weekly > Last Minute > New Listing > Early Bird > Custom).
  candidates.sort((a, b) => {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    return a.priorityOrder - b.priorityOrder;
  });

  const best = candidates[0];
  const amount = Math.round((opts.staySubtotal * best.percentage) / 100);

  return {
    key: best.key,
    name: best.name,
    percentage: best.percentage,
    amount,
  };
}

/**
 * Authoritative, server-side centralized pricing calculator.
 * Strictly executes the 16 pricing business rules in exact order with zero floating-point drift.
 */
export async function calculateBookingPrice(params: BookingPricingParams): Promise<BookingPricingResult> {
  const cInRaw = new Date(params.checkIn);
  const cOutRaw = new Date(params.checkOut);

  if (isNaN(cInRaw.getTime()) || isNaN(cOutRaw.getTime())) {
    throw AppError.badRequest("Invalid check-in or check-out date.");
  }

  const cIn = parseDateToUtcMidnight(params.checkIn);
  const cOut = parseDateToUtcMidnight(params.checkOut);

  const diffMs = cOut.getTime() - cIn.getTime();
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (nights < 1) {
    throw AppError.badRequest("Check-out date must be at least one night after check-in date.");
  }

  const weekdayBasePrice = Math.max(0, Math.round(params.weekdayBasePrice));
  if (weekdayBasePrice <= 0) {
    throw AppError.badRequest("Weekday base price must be greater than zero.");
  }

  const weekendPrice = typeof params.weekendPrice === "number" && params.weekendPrice > 0
    ? Math.round(params.weekendPrice)
    : null;

  const guests = Math.max(1, params.guests ?? 1);
  const baseGuests = Math.max(1, params.baseGuests ?? 1);
  const currency = params.currency || "SAR";

  // 1. Resolve nightly rates per date
  let weekdayNights = 0;
  let weekendNights = 0;
  let customPricedNights = 0;
  let staySubtotal = 0;
  const breakdown: NightRateBreakdown[] = [];

  for (let i = 0; i < nights; i++) {
    const currentNight = new Date(Date.UTC(cIn.getUTCFullYear(), cIn.getUTCMonth(), cIn.getUTCDate() + i, 0, 0, 0, 0));
    const dateStr = formatDateToKey(currentNight);

    const resolved = resolveNightlyRate({
      date: currentNight,
      dateStr,
      weekdayBasePrice,
      weekendPrice,
      customPrices: params.customPrices,
    });

    if (resolved.rateSource === "CUSTOM") {
      customPricedNights++;
    } else if (resolved.isWeekend && weekendPrice !== null) {
      weekendNights++;
    } else {
      weekdayNights++;
    }

    staySubtotal += resolved.price;
    breakdown.push({
      date: dateStr,
      price: resolved.price,
      isWeekend: resolved.isWeekend,
      rateSource: resolved.rateSource,
    });
  }

  const effectiveBasePrice = Math.round(staySubtotal / nights);

  // 2. Single Discount Rule (Strictly one discount, no stacking)
  const appliedDiscount = resolveSingleDiscount({
    staySubtotal,
    nights,
    checkIn: cIn,
    discounts: params.discounts,
    isNewListing: params.isNewListing,
    includeNewListingPromotion: params.includeNewListingPromotion,
    bookingCreatedAt: params.bookingCreatedAt ? new Date(params.bookingCreatedAt) : undefined,
  });

  const standardDiscountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  const afterStandardDiscount = Math.max(0, staySubtotal - standardDiscountAmount);
  const nonRefundablePercentage = typeof params.nonRefundableDiscountPercentage === "number"
    ? Math.max(0, Math.min(100, params.nonRefundableDiscountPercentage))
    : 0;
  const nonRefundableDiscount = nonRefundablePercentage > 0
    ? {
        key: "non_refundable" as const,
        name: "Non-refundable booking discount",
        percentage: nonRefundablePercentage,
        amount: Math.round((afterStandardDiscount * nonRefundablePercentage) / 100),
      }
    : null;
  const discountAmount = standardDiscountAmount + (nonRefundableDiscount?.amount ?? 0);
  const discountPercentage = staySubtotal > 0 ? (discountAmount / staySubtotal) * 100 : 0;
  const accommodationSubtotal = Math.max(0, staySubtotal - discountAmount);

  // 3. Host-Defined Additional Charges
  const cleaningFee = Math.max(0, Math.round(params.cleaningFee ?? 0));
  const extraGuestPerNightRate = Math.max(0, Math.round(params.extraGuestFee ?? 0));
  const extraGuestCount = Math.max(0, guests - baseGuests);
  const extraGuestFee = extraGuestCount * extraGuestPerNightRate * nights;
  const petFee = Math.max(0, Math.round(params.petFee ?? 0));
  const totalAdditionalFees = cleaningFee + extraGuestFee + petFee;

  // 4. Host Service Fee (Admin Configured, strictly excluded from Taxable Base)
  const hostServiceFeePercentage = params.hostServiceFeePercentage ?? (await getHostServiceFeePercentage().catch(() => 15));
  const hostServiceFee = Math.round(accommodationSubtotal * (hostServiceFeePercentage / 100));

  // 5. Deterministic Tax Calculation (Immune to Host Service Fee)
  const taxResult = TaxCalculator.calculateTaxes({
    nights,
    nightlySubtotal: staySubtotal,
    discountAmount,
    cleaningFee,
    petFee,
    extraGuestFee,
    guests,
    rules: params.taxRules || [],
    hostTaxes: params.hostTaxes || [],
    currency,
    hostServiceFeePercentage,
    hostServiceFee,
  });

  // 6. Final Guest Total & Host Payout
  const taxableBase = accommodationSubtotal + cleaningFee + petFee + extraGuestFee;
  const guestTotal = taxResult.guestTotal;
  const payoutBreakdown = taxResult.payoutBreakdown;

  return {
    nights,
    weekdayNights,
    weekendNights,
    customPricedNights,
    weekdayBasePrice,
    weekendPrice,
    effectiveBasePrice,
    staySubtotal,
    appliedDiscount,
    nonRefundableDiscount,
    discountAmount,
    discountPercentage,
    accommodationSubtotal,
    cleaningFee,
    extraGuestFee,
    petFee,
    totalAdditionalFees,
    hostServiceFeePercentage,
    hostServiceFee,
    taxableBase,
    taxes: taxResult.taxes,
    taxTotal: taxResult.taxTotal,
    platformRemittedTaxTotal: taxResult.platformRemittedTaxTotal,
    hostRemittedTaxTotal: taxResult.hostRemittedTaxTotal,
    guestTotal,
    payoutBreakdown,
    breakdown,
    currency,
  };
}

/**
 * Special Offer Pricing Calculator.
 * The host sets an explicit accommodation subtotal for the entire stay.
 * Cleaning fees, extra guest fees, taxes, and host service fees are computed separately on top.
 */
export async function calculateSpecialOffer(params: SpecialOfferPricingParams): Promise<BookingPricingResult> {
  const nights = Math.max(1, params.nights);
  const specialOfferAmount = Math.max(0, Math.round(params.specialOfferAmount));
  const cleaningFee = Math.max(0, Math.round(params.cleaningFee ?? 0));
  const extraGuestFee = Math.max(0, Math.round(params.extraGuestFee ?? 0));
  const petFee = Math.max(0, Math.round(params.petFee ?? 0));
  const guests = Math.max(1, params.guests ?? 1);
  const currency = params.currency || "SAR";

  const hostServiceFeePercentage = params.hostServiceFeePercentage ?? (await getHostServiceFeePercentage().catch(() => 15));
  const hostServiceFee = Math.round(specialOfferAmount * (hostServiceFeePercentage / 100));

  const taxResult = TaxCalculator.calculateTaxes({
    nights,
    nightlySubtotal: specialOfferAmount,
    discountAmount: 0,
    cleaningFee,
    petFee,
    extraGuestFee,
    guests,
    rules: params.taxRules || [],
    hostTaxes: params.hostTaxes || [],
    currency,
    hostServiceFeePercentage,
    hostServiceFee,
  });

  const taxableBase = specialOfferAmount + cleaningFee + petFee + extraGuestFee;

  return {
    nights,
    weekdayNights: 0,
    weekendNights: 0,
    customPricedNights: 0,
    weekdayBasePrice: Math.round(specialOfferAmount / nights),
    weekendPrice: null,
    effectiveBasePrice: Math.round(specialOfferAmount / nights),
    staySubtotal: specialOfferAmount,
    appliedDiscount: null,
    nonRefundableDiscount: null,
    discountAmount: 0,
    discountPercentage: 0,
    accommodationSubtotal: specialOfferAmount,
    cleaningFee,
    extraGuestFee,
    petFee,
    totalAdditionalFees: cleaningFee + extraGuestFee + petFee,
    hostServiceFeePercentage,
    hostServiceFee,
    taxableBase,
    taxes: taxResult.taxes,
    taxTotal: taxResult.taxTotal,
    platformRemittedTaxTotal: taxResult.platformRemittedTaxTotal,
    hostRemittedTaxTotal: taxResult.hostRemittedTaxTotal,
    guestTotal: taxResult.guestTotal,
    payoutBreakdown: taxResult.payoutBreakdown,
    breakdown: [],
    currency,
  };
}
