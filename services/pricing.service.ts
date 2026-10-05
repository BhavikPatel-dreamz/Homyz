import { AppError } from "@/lib/api/errors";
import { TaxCalculator } from "@/lib/tax/tax-calculator";
import type { CalculatedTaxItem, HostPayoutBreakdown, ListingTaxDTO, TaxRuleDTO } from "@/lib/tax/types";
async function getAuthoritativeHostServiceFee(): Promise<number> {
  try {
    const { getHostServiceFeePercentage } = await import("@/services/app-settings.service");
    return await getHostServiceFeePercentage();
  } catch {
    return 15;
  }
}
import { bookingDateKey, parseBookingDate } from "@/lib/booking/booking-date";
import {
  evaluateDiscountEligibility,
  DISCOUNT_ELIGIBILITY_REASONS,
  type DiscountEligibilityItem,
  type DiscountEligibilityParams,
  type DiscountEligibilityReason,
  type DiscountEligibilityResult,
} from "./discount-eligibility.service";
import {
  resolveWinningDiscount,
  getDiscountFriendlyLabel,
  WINNING_DISCOUNT_SELECTION_REASONS,
  AUTHORITATIVE_DISCOUNT_PRIORITY_ORDER,
  type WinningDiscountType,
  type WinningDiscountSelectionReason,
  type WinningDiscountCandidate,
  type WinningDiscountSelected,
  type WinningDiscountResult,
  type ResolveWinningDiscountOptions,
  type SelectedDiscountQuote,
} from "./discount-priority.service";

export {
  evaluateDiscountEligibility,
  DISCOUNT_ELIGIBILITY_REASONS,
  type DiscountEligibilityItem,
  type DiscountEligibilityParams,
  type DiscountEligibilityReason,
  type DiscountEligibilityResult,
  resolveWinningDiscount,
  getDiscountFriendlyLabel,
  WINNING_DISCOUNT_SELECTION_REASONS,
  AUTHORITATIVE_DISCOUNT_PRIORITY_ORDER,
  type WinningDiscountType,
  type WinningDiscountSelectionReason,
  type WinningDiscountCandidate,
  type WinningDiscountSelected,
  type WinningDiscountResult,
  type ResolveWinningDiscountOptions,
  type SelectedDiscountQuote,
};

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

export interface NormalizedFeeItem {
  id: string;
  name: string;
  amount: number; // cents
}

export interface BookingPricingParams {
  checkIn: Date | string;
  checkOut: Date | string;
  weekdayBasePrice?: number; // cents (required if baseNightlyPrice omitted, > 0)
  baseNightlyPrice?: number; // alias for weekdayBasePrice
  weekendPrice?: number | null; // cents
  weekendPremium?: number | null; // percentage fallback when no explicit weekend price
  customPrices?: Record<string, number> | Map<string, number> | null; // map of YYYY-MM-DD -> cents
  nightlyPricing?: Record<string, number> | Map<string, number> | null; // alias for customPrices
  /** @deprecated Retained for backwards-compatible listing payloads; occupancy is inclusive. */
  extraGuestFee?: number | null;
  /** @deprecated Retained for backwards-compatible callers; max guests are all included. */
  baseGuests?: number;
  guests?: number; // requested total guests (defaults to 1)
  adults?: number; // optional adult count
  children?: number; // optional children count
  pets?: number; // requested pets (defaults to 0)
  petFee?: number | null; // cents flat or per pet
  cleaningFee?: number | null; // cents flat per stay
  discounts?: Record<string, unknown> | null;
  isNewListing?: boolean;
  /** Reservation quotes can opt out of the marketing-only new-listing promo. */
  includeNewListingPromotion?: boolean;
  bookingCreatedAt?: Date | string;
  hostServiceFeePercentage?: number; // optional override; defaults to DB setting
  taxRules?: TaxRuleDTO[];
  hostTaxes?: ListingTaxDTO[];
  nonRefundableDiscountPercentage?: number | null;
  rateType?: "STANDARD" | "NON_REFUNDABLE" | string;
  isNonRefundable?: boolean;
  nonRefundable?: boolean;
  currency?: string;
  listingId?: string;
}

export interface BookingPricingResult {
  nights: number;
  weekdayNights: number;
  weekendNights: number;
  customPricedNights: number;
  weekdayBasePrice: number; // cents
  baseNightlyPrice: number; // cents (alias for effectiveBasePrice)
  weekendPrice: number | null; // cents
  effectiveBasePrice: number; // cents (weighted or standard base nightly)
  staySubtotal: number; // sum of nightly resolved rates (cents)
  appliedDiscount: AppliedDiscount | null;
  nonRefundableDiscount: AppliedDiscount | null;
  discountAmount: number; // cents (0 if no discount)
  discountPercentage: number; // percentage applied (0 if none)
  accommodationSubtotal: number; // staySubtotal - discountAmount (cents)
  discountedAccommodationSubtotal: number; // cents (alias for accommodationSubtotal)
  /** Always zero for new quotes; retained so legacy snapshots can be read. */
  extraGuestFee: number; // cents
  petFee: number; // cents
  cleaningFee: number; // cents flat per stay
  totalAdditionalFees: number; // petFee + cleaningFee (cents)
  feeTotal: number; // cents (alias for totalAdditionalFees)
  feeBreakdown: NormalizedFeeItem[];
  hostServiceFeePercentage: number; // e.g. 15
  hostServiceFee: number; // cents (calculated on accommodationSubtotal)
  taxableBase: number; // accommodationSubtotal + taxable fees (strictly excludes hostServiceFee)
  taxes: CalculatedTaxItem[];
  taxBreakdown: CalculatedTaxItem[]; // alias for taxes
  taxTotal: number; // cents
  platformRemittedTaxTotal: number; // cents
  hostRemittedTaxTotal: number; // cents
  guestTotal: number; // accommodationSubtotal + fees + taxes + hostServiceFee (cents)
  total: number; // cents (alias for guestTotal)
  payoutBreakdown: HostPayoutBreakdown;
  breakdown: NightRateBreakdown[];
  nightlyBreakdown: Array<{ date: string; rate: number; rateType: "CUSTOM" | "WEEKEND" | "WEEKDAY" }>;
  currency: string;
  discountEligibility?: DiscountEligibilityResult;
  winningDiscount?: WinningDiscountResult;
  selectedDiscount: SelectedDiscountQuote | null;
  rateType: "STANDARD" | "NON_REFUNDABLE";
  isNonRefundable: boolean;
  nonRefundable: {
    enabled: boolean;
    selected: boolean;
    percentage: number;
    amount: number;
  };
  originalDisplayPrice: number;
  discountedDisplayPrice: number;
  discountType: string | null;
  discountLabel: string | null;
}


export interface SpecialOfferPricingParams {
  specialOfferAmount: number; // cents (host-offered accommodation subtotal)
  nights: number;
  /** @deprecated Legacy field ignored by the inclusive occupancy model. */
  extraGuestFee?: number | null;
  petFee?: number | null;
  cleaningFee?: number | null;
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
  return parseBookingDate(input);
}

/**
 * Formats a Date to YYYY-MM-DD string key in UTC.
 */
export function formatDateToKey(date: Date): string {
  return bookingDateKey(date);
}

import {
  isWeekendNight,
  resolveNightlyRate,
  resolveNightlyPrice,
  calculatePriceTips,
  type PriceTipRecommendation,
  type PriceTipsResult,
  type PriceTipAction,
  type CalculatePriceTipsOptions,
} from "@/lib/pricing/price-tips";

export {
  isWeekendNight,
  resolveNightlyRate,
  resolveNightlyPrice,
  calculatePriceTips,
  type PriceTipRecommendation,
  type PriceTipsResult,
  type PriceTipAction,
  type CalculatePriceTipsOptions,
};

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
  completedBookingsCount?: number | null;
  approvedBookingCount?: number | null;
}): AppliedDiscount | null {
  if (opts.staySubtotal <= 0 || opts.nights < 1) return null;

  const checkOutDate = new Date(opts.checkIn.getTime() + opts.nights * 86_400_000);
  const eligibility = evaluateDiscountEligibility({
    checkIn: opts.checkIn,
    checkOut: checkOutDate,
    nights: opts.nights,
    discounts: opts.discounts,
    isNewListing: opts.isNewListing,
    includeNewListingPromotion: opts.includeNewListingPromotion,
    bookingCreatedAt: opts.bookingCreatedAt,
    completedBookingsCount: opts.completedBookingsCount ?? opts.approvedBookingCount,
  });

  const winning = resolveWinningDiscount(eligibility, opts.staySubtotal);
  if (!winning.selected || !winning.key) return null;

  return {
    key: winning.key as AppliedDiscount["key"],
    name: winning.name || winning.key,
    percentage: winning.percentage,
    amount: winning.amount,
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

  const rawBase = params.weekdayBasePrice ?? params.baseNightlyPrice;
  const weekdayBasePrice = Math.max(0, Math.round(rawBase ?? 0));
  if (weekdayBasePrice <= 0) {
    throw AppError.badRequest("Weekday base price must be greater than zero.");
  }

  const weekendPrice = typeof params.weekendPrice === "number" && params.weekendPrice > 0
    ? Math.round(params.weekendPrice)
    : null;

  const computedGuests = params.guests ?? ((params.adults || 0) + (params.children || 0) || 1);
  const guests = Math.max(1, computedGuests);
  const currency = params.currency || "SAR";

  // Pre-index custom prices into a Map for O(1) date price lookups
  const rawCustom = params.customPrices ?? params.nightlyPricing;
  const priceByDate: Map<string, number> | null = rawCustom instanceof Map
    ? rawCustom
    : rawCustom && typeof rawCustom === "object"
      ? new Map(Object.entries(rawCustom))
      : null;

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
      weekendPremium: params.weekendPremium,
      customPrices: priceByDate,
    });

    if (resolved.rateSource === "CUSTOM") {
      customPricedNights++;
    } else if (resolved.rateSource === "WEEKEND") {
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

  // 2. Discount Eligibility and Single Discount Selection (No stacking)
  const discountEligibility = evaluateDiscountEligibility({
    listingId: params.listingId,
    checkIn: cIn,
    checkOut: cOut,
    nights,
    discounts: params.discounts,
    isNewListing: params.isNewListing,
    includeNewListingPromotion: params.includeNewListingPromotion,
    bookingCreatedAt: params.bookingCreatedAt ? new Date(params.bookingCreatedAt) : undefined,
  });

  const standardCandidates: WinningDiscountCandidate[] = discountEligibility.eligibleDiscounts
    .filter((discount) => discount.key !== "custom_promotion")
    .flatMap((discount) => {
      const percentage = discount.percentage ?? 0;
      if (percentage <= 0) return [];
      return [{
        type: String(discount.key).toUpperCase(),
        key: String(discount.key),
        name: discount.name,
        percentage,
        amount: Math.round((staySubtotal * percentage) / 100),
        eligible: true,
        priorityOrder: discount.priorityOrder,
      }];
    });

  // Special-day promotions are calendar-scoped. Calculate their candidate
  // value from eligible nights only, then let the existing single-winner rule
  // compare it with weekly/monthly/other discounts. This prevents a one-day
  // promotion from discounting the entire reservation.
  const discountsRecordForPromotion = params.discounts && typeof params.discounts === "object"
    ? params.discounts as Record<string, unknown>
    : {};
  const rawCustomPromotion = discountsRecordForPromotion.custom_promotion;
  if (rawCustomPromotion && typeof rawCustomPromotion === "object" && !Array.isArray(rawCustomPromotion)) {
    const promotion = rawCustomPromotion as Record<string, unknown>;
    const enabled = promotion.enabled !== false;
    const percentage = typeof promotion.percentage === "number"
      ? promotion.percentage
      : typeof promotion.discountPercentage === "number"
        ? promotion.discountPercentage
        : 15;
    const startDate = typeof promotion.startDate === "string" ? promotion.startDate : null;
    const endDate = typeof promotion.endDate === "string" ? promotion.endDate : null;
    if (enabled && percentage > 0 && percentage <= 100) {
      const eligibleSubtotal = breakdown.reduce((sum, night) => {
        const eligible = (!startDate || night.date >= startDate) && (!endDate || night.date <= endDate);
        return sum + (eligible ? night.price : 0);
      }, 0);
      const amount = Math.round((eligibleSubtotal * percentage) / 100);
      if (amount > 0) {
        standardCandidates.push({
          type: "CUSTOM_PROMOTION",
          key: "custom_promotion",
          name: typeof promotion.name === "string" ? promotion.name : "Custom Promotional Discount",
          percentage,
          amount,
          eligible: true,
          priorityOrder: 6,
        });
      }
    }
  }

  const winningDiscount = resolveWinningDiscount({ candidates: standardCandidates, staySubtotal });
  const appliedDiscount: AppliedDiscount | null = winningDiscount.selected && winningDiscount.key
    ? {
        key: winningDiscount.key as AppliedDiscount["key"],
        name: winningDiscount.name || winningDiscount.key,
        percentage: winningDiscount.percentage,
        amount: winningDiscount.amount,
      }
    : null;

  const selectedDiscount: SelectedDiscountQuote | null =
    winningDiscount.selected && winningDiscount.type
      ? {
          type: winningDiscount.type,
          label: winningDiscount.label || getDiscountFriendlyLabel(winningDiscount.type),
          percentage: winningDiscount.percentage,
          amount: winningDiscount.amount,
        }
      : null;

  const standardDiscountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  const afterStandardDiscount = Math.max(0, staySubtotal - standardDiscountAmount);

  const discountsRecord = (typeof params.discounts === "object" && params.discounts !== null)
    ? (params.discounts as Record<string, unknown>)
    : null;
  const nonRefundableSetting = discountsRecord?.non_refundable ?? discountsRecord?.nonRefundable;
  let nonRefundableFromDiscounts: { enabled: boolean; percentage?: number } | null = null;
  if (typeof nonRefundableSetting === "object" && nonRefundableSetting !== null) {
    const s = nonRefundableSetting as { enabled?: boolean; percentage?: number };
    nonRefundableFromDiscounts = {
      enabled: Boolean(s.enabled),
      percentage: typeof s.percentage === "number" ? s.percentage : 10,
    };
  } else if (nonRefundableSetting === true) {
    nonRefundableFromDiscounts = { enabled: true, percentage: 10 };
  }

  const nonRefundableConfiguredPercentage =
    typeof params.nonRefundableDiscountPercentage === "number"
      ? Math.max(0, Math.min(100, params.nonRefundableDiscountPercentage))
      : nonRefundableFromDiscounts?.enabled
      ? Math.max(0, Math.min(100, nonRefundableFromDiscounts.percentage ?? 10))
      : 0;

  const isNonRefundableExplicitlySelected =
    params.rateType === "NON_REFUNDABLE" ||
    params.isNonRefundable === true ||
    params.nonRefundable === true;

  const isNonRefundableExplicitlyDisabled =
    params.rateType === "STANDARD" ||
    params.isNonRefundable === false ||
    params.nonRefundable === false;

  const isNonRefundableActive =
    !isNonRefundableExplicitlyDisabled &&
    (isNonRefundableExplicitlySelected ||
      (typeof params.nonRefundableDiscountPercentage === "number" && params.rateType === undefined));

  const nonRefundablePercentage = isNonRefundableActive ? nonRefundableConfiguredPercentage : 0;

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


  // 3. Inclusive occupancy: every guest through the listing capacity uses the
  // same accommodation price. Legacy extra-guest settings remain readable,
  // but are intentionally ignored for new quotes.
  const extraGuestFee = 0;
  const petFee = Math.max(0, Math.round(params.petFee ?? 0));
  const cleaningFee = Math.max(0, Math.round(params.cleaningFee ?? 0));
  const totalAdditionalFees = petFee + cleaningFee;

  const feeBreakdown: NormalizedFeeItem[] = [];
  if (petFee > 0) {
    feeBreakdown.push({ id: "pets", name: "Pet fee", amount: petFee });
  }
  if (cleaningFee > 0) {
    feeBreakdown.push({ id: "cleaning", name: "Cleaning fee", amount: cleaningFee });
  }

  // 4. Host Service Fee (Admin Configured, strictly excluded from Taxable Base)
  const hostServiceFeePercentage = params.hostServiceFeePercentage ?? (await getAuthoritativeHostServiceFee());
  const hostServiceFee = Math.round(accommodationSubtotal * (hostServiceFeePercentage / 100));

  // 5. Deterministic Tax Calculation (Immune to Host Service Fee)
  const taxResult = TaxCalculator.calculateTaxes({
    nights,
    nightlySubtotal: staySubtotal,
    nightlyRates: breakdown.map((night) => night.price),
    discountAmount,
    petFee,
    extraGuestFee: 0,
    cleaningFee,
    feeAmounts: { CLEANING_FEE: cleaningFee },
    guests,
    rules: params.taxRules || [],
    hostTaxes: params.hostTaxes || [],
    currency,
    hostServiceFeePercentage,
    hostServiceFee,
  });

  // 6. Final Guest Total & Host Payout
  const taxableBase = accommodationSubtotal + petFee + cleaningFee;
  const guestTotal = taxResult.guestTotal;
  const payoutBreakdown = taxResult.payoutBreakdown;

  const nightlyBreakdown = breakdown.map((b) => ({
    date: b.date,
    rate: b.price,
    rateType: b.rateSource,
  }));

  return {
    nights,
    weekdayNights,
    weekendNights,
    customPricedNights,
    weekdayBasePrice,
    baseNightlyPrice: effectiveBasePrice,
    weekendPrice,
    effectiveBasePrice,
    staySubtotal,
    appliedDiscount,
    nonRefundableDiscount,
    discountAmount,
    discountPercentage,
    accommodationSubtotal,
    discountedAccommodationSubtotal: accommodationSubtotal,
    extraGuestFee,
    petFee,
    cleaningFee,
    totalAdditionalFees,
    feeTotal: totalAdditionalFees,
    feeBreakdown,
    hostServiceFeePercentage,
    hostServiceFee,
    taxableBase,
    taxes: taxResult.taxes,
    taxBreakdown: taxResult.taxes,
    taxTotal: taxResult.taxTotal,
    platformRemittedTaxTotal: taxResult.platformRemittedTaxTotal,
    hostRemittedTaxTotal: taxResult.hostRemittedTaxTotal,
    guestTotal,
    total: guestTotal,
    payoutBreakdown,
    breakdown,
    nightlyBreakdown,
    currency,
    discountEligibility,
    winningDiscount,
    selectedDiscount,
    rateType: isNonRefundableActive && nonRefundablePercentage > 0 ? "NON_REFUNDABLE" : "STANDARD",
    isNonRefundable: isNonRefundableActive && nonRefundablePercentage > 0,
    nonRefundable: {
      enabled: nonRefundableConfiguredPercentage > 0,
      selected: isNonRefundableActive && nonRefundablePercentage > 0,
      percentage: nonRefundableConfiguredPercentage,
      amount: nonRefundableDiscount?.amount ?? 0,
    },
    originalDisplayPrice: effectiveBasePrice,
    discountedDisplayPrice: Math.round(accommodationSubtotal / nights),
    discountType: selectedDiscount ? selectedDiscount.type : null,
    discountLabel: selectedDiscount ? selectedDiscount.label : null,
  };

}

/**
 * Special Offer Pricing Calculator.
 * The host sets an explicit accommodation subtotal for the entire stay.
 * Pet fees, cleaning fees, and taxes are computed separately on top. Legacy
 * extra-guest settings are ignored because all occupancy is included.
 */
export async function calculateSpecialOffer(params: SpecialOfferPricingParams): Promise<BookingPricingResult> {
  const nights = Math.max(1, params.nights);
  const specialOfferAmount = Math.max(0, Math.round(params.specialOfferAmount));
  const extraGuestFee = 0;
  const petFee = Math.max(0, Math.round(params.petFee ?? 0));
  const cleaningFee = Math.max(0, Math.round(params.cleaningFee ?? 0));
  const guests = Math.max(1, params.guests ?? 1);
  const currency = params.currency || "SAR";

  const hostServiceFeePercentage = params.hostServiceFeePercentage ?? (await getAuthoritativeHostServiceFee());
  const hostServiceFee = Math.round(specialOfferAmount * (hostServiceFeePercentage / 100));

  const taxResult = TaxCalculator.calculateTaxes({
    nights,
    nightlySubtotal: specialOfferAmount,
    nightlyRates: Array.from({ length: nights }, (_, index) => {
      const base = Math.floor(specialOfferAmount / nights);
      return base + (index < specialOfferAmount - base * nights ? 1 : 0);
    }),
    discountAmount: 0,
    petFee,
    extraGuestFee,
    cleaningFee,
    feeAmounts: { CLEANING_FEE: cleaningFee },
    guests,
    rules: params.taxRules || [],
    hostTaxes: params.hostTaxes || [],
    currency,
    hostServiceFeePercentage,
    hostServiceFee,
  });

  const taxableBase = specialOfferAmount + petFee + cleaningFee;
  const totalAdditionalFees = petFee + cleaningFee;

  const feeBreakdown: NormalizedFeeItem[] = [];
  if (petFee > 0) {
    feeBreakdown.push({ id: "pets", name: "Pet fee", amount: petFee });
  }
  if (cleaningFee > 0) {
    feeBreakdown.push({ id: "cleaning", name: "Cleaning fee", amount: cleaningFee });
  }

  const baseRate = Math.round(specialOfferAmount / nights);

  return {
    nights,
    weekdayNights: 0,
    weekendNights: 0,
    customPricedNights: 0,
    weekdayBasePrice: baseRate,
    baseNightlyPrice: baseRate,
    weekendPrice: null,
    effectiveBasePrice: baseRate,
    staySubtotal: specialOfferAmount,
    appliedDiscount: null,
    nonRefundableDiscount: null,
    discountAmount: 0,
    discountPercentage: 0,
    accommodationSubtotal: specialOfferAmount,
    discountedAccommodationSubtotal: specialOfferAmount,
    extraGuestFee,
    petFee,
    cleaningFee,
    totalAdditionalFees,
    feeTotal: totalAdditionalFees,
    feeBreakdown,
    hostServiceFeePercentage,
    hostServiceFee,
    taxableBase,
    taxes: taxResult.taxes,
    taxBreakdown: taxResult.taxes,
    taxTotal: taxResult.taxTotal,
    platformRemittedTaxTotal: taxResult.platformRemittedTaxTotal,
    hostRemittedTaxTotal: taxResult.hostRemittedTaxTotal,
    guestTotal: taxResult.guestTotal,
    total: taxResult.guestTotal,
    payoutBreakdown: taxResult.payoutBreakdown,
    breakdown: [],
    nightlyBreakdown: [],
    currency,
    selectedDiscount: null,
    rateType: "STANDARD",
    isNonRefundable: false,
    nonRefundable: {
      enabled: false,
      selected: false,
      percentage: 0,
      amount: 0,
    },
    originalDisplayPrice: Math.round(specialOfferAmount / nights),

    discountedDisplayPrice: Math.round(specialOfferAmount / nights),
    discountType: null,
    discountLabel: null,
  };
}

export {
  toPropertyCardPricingViewModel,
  type PropertyCardPricingViewModel,
  type PropertyCardPricingOptions,
  type ListingCardPricingInput,
} from "@/lib/booking/property-card-pricing";
