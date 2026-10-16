/**
 * HOMYZ — PROPERTY CARD PRICING VIEW MODEL ADAPTER (PHASE 6)
 *
 * Lightweight, synchronous adapter that transforms raw listing data or central pricing
 * results into a clean, presentation-ready card view model.
 *
 * Invariants:
 * 1. Synchronous, deterministic, in-memory function with zero external or DB dependencies.
 * 2. Strict integration with Phase 3 Discount Eligibility & Phase 4 Winning Discount.
 * 3. Exact Airbnb card presentation contract:
 *    - Base price only when no discount applies (zero crossed-out price, zero discount label).
 *    - Strike-through base price + discounted price + exactly ONE winning discount label when discount applies.
 * 4. Date-dependent discounts (Weekly, Monthly, Last-Minute) only evaluate when dates are provided.
 * 5. Safe fallback to base price if discount data is missing or malformed (no UI flash to 0).
 */

import { getCurrencyForCountry } from "@/lib/currency";
import {
  evaluateDiscountEligibility,
  type DiscountEligibilityParams,
} from "@/services/discount-eligibility.service";
import {
  resolveWinningDiscount,
  getDiscountFriendlyLabel,
} from "@/services/discount-priority.service";
import {
  bookingDateKey,
  differenceInBookingNights,
  parseBookingDate,
  shiftBookingDateKey,
} from "./booking-date";
import { resolveNightlyRate } from "@/lib/pricing/price-tips";

export interface PropertyCardPricingViewModel {
  currency: string;
  baseDisplayPrice: number;
  discountedDisplayPrice: number | null;
  hasDiscount: boolean;
  discountType: string | null;
  discountLabel: string | null;
  discountPercentage: number | null;
}

export interface PropertyCardPricingOptions {
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
  currency?: string | null;
  bookingDate?: string | Date | null;
  isNewListing?: boolean | null;
}

export interface ListingCardPricingInput {
  id?: string;
  currency?: string | null;
  price?: number | null;
  weekdayBasePrice?: number | null;
  weekendPrice?: number | null;
  weekendPremium?: number | null;
  customPrices?: Record<string, number> | Map<string, number> | null;
  nightlyPricing?: Record<string, number> | Map<string, number> | null;
  country?: string | null;
  discounts?: unknown;
  createdAt?: string | Date | null;
  isNewListing?: boolean | null;
  completedBookingsCount?: number | null;
  approvedBookingCount?: number | null;
  weeklyDiscount?: unknown;
  monthlyDiscount?: unknown;
  lastMinuteDiscount?: unknown;
  newListingPromotion?: unknown;

  // Pre-computed pricing quote support (Phase 1 & Phase 5)
  accommodationSubtotal?: number;
  discountedAccommodationSubtotal?: number;
  selectedDiscount?: {
    type?: string | null;
    label?: string | null;
    percentage?: number | null;
    amount?: number | null;
  } | null;
  nights?: number | null;
}

/**
 * Transforms listing pricing and discount configuration into the unified PropertyCardPricingViewModel.
 */
export function toPropertyCardPricingViewModel(
  listingOrPricing: ListingCardPricingInput | null | undefined,
  options?: PropertyCardPricingOptions,
): PropertyCardPricingViewModel {
  // Safe fallback if input is null/undefined
  if (!listingOrPricing) {
    return {
      currency: options?.currency || "SAR",
      baseDisplayPrice: 0,
      discountedDisplayPrice: null,
      hasDiscount: false,
      discountType: null,
      discountLabel: null,
      discountPercentage: null,
    };
  }

  const currency =
    options?.currency ||
    (typeof listingOrPricing.currency === "string" && listingOrPricing.currency) ||
    getCurrencyForCountry(listingOrPricing.country) ||
    "SAR";

  // Check if a pre-computed Phase 1/5 quote was passed directly
  if (
    typeof listingOrPricing.accommodationSubtotal === "number" &&
    listingOrPricing.accommodationSubtotal > 0
  ) {
    const nights = Math.max(1, Number(listingOrPricing.nights) || 1);
    const baseDisplayPrice =
      Math.round((listingOrPricing.accommodationSubtotal / nights) * 100) / 100;
    const selectedDisc = listingOrPricing.selectedDiscount;

    if (
      selectedDisc &&
      typeof selectedDisc.percentage === "number" &&
      selectedDisc.percentage > 0 &&
      selectedDisc.type
    ) {
      const discountedSubtotal =
        typeof listingOrPricing.discountedAccommodationSubtotal === "number"
          ? listingOrPricing.discountedAccommodationSubtotal
          : listingOrPricing.accommodationSubtotal * (1 - selectedDisc.percentage / 100);
      const discountedDisplayPrice =
        Math.round((discountedSubtotal / nights) * 100) / 100;

      return {
        currency,
        baseDisplayPrice,
        discountedDisplayPrice,
        hasDiscount: true,
        discountType: selectedDisc.type,
        discountLabel:
          selectedDisc.label || getDiscountFriendlyLabel(selectedDisc.type),
        discountPercentage: selectedDisc.percentage,
      };
    }

    return {
      currency,
      baseDisplayPrice,
      discountedDisplayPrice: null,
      hasDiscount: false,
      discountType: null,
      discountLabel: null,
      discountPercentage: null,
    };
  }

  // Resolve the displayed nightly price through the same calendar hierarchy as
  // checkout: custom date > weekend > weekday/base. For a selected stay the
  // card shows the effective average of every night, never a static base rate.
  const rawPrice = listingOrPricing.weekdayBasePrice ?? listingOrPricing.price;
  const weekdayBasePrice =
    typeof rawPrice === "number" && Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
  const selectedCheckIn = options?.checkIn ?? null;
  const selectedCheckOut = options?.checkOut ?? null;
  const selectedNights = selectedCheckIn && selectedCheckOut
    ? differenceInBookingNights(selectedCheckIn, selectedCheckOut)
    : 0;
  const fallbackDate = options?.bookingDate
    ? bookingDateKey(options.bookingDate)
    : bookingDateKey(new Date());
  const firstNight = selectedNights > 0 && selectedCheckIn ? selectedCheckIn : fallbackDate;
  const nightsToPrice = selectedNights > 0 ? selectedNights : 1;
  let staySubtotal = 0;
  const nightlyRates: Array<{ date: string; rate: number }> = [];
  for (let index = 0; index < nightsToPrice; index += 1) {
    const dateKey = shiftBookingDateKey(firstNight, index);
    const rate = resolveNightlyRate({
      date: parseBookingDate(dateKey),
      dateStr: dateKey,
      weekdayBasePrice,
      weekendPrice: listingOrPricing.weekendPrice,
      weekendPremium: listingOrPricing.weekendPremium,
      customPrices: listingOrPricing.customPrices ?? listingOrPricing.nightlyPricing,
    }).price;
    staySubtotal += rate;
    nightlyRates.push({ date: dateKey, rate });
  }
  const baseDisplayPrice = nightsToPrice > 0
    ? Math.round((staySubtotal / nightsToPrice) * 100) / 100
    : weekdayBasePrice;

  if (baseDisplayPrice <= 0) {
    return {
      currency,
      baseDisplayPrice: 0,
      discountedDisplayPrice: null,
      hasDiscount: false,
      discountType: null,
      discountLabel: null,
      discountPercentage: null,
    };
  }

  // Parse discounts config safely
  let rawDiscounts = listingOrPricing.discounts;
  if (typeof rawDiscounts === "string") {
    try {
      rawDiscounts = JSON.parse(rawDiscounts);
    } catch {
      rawDiscounts = {};
    }
  }
  const discountsObj: Record<string, unknown> =
    typeof rawDiscounts === "object" && rawDiscounts !== null && !Array.isArray(rawDiscounts)
      ? { ...(rawDiscounts as Record<string, unknown>) }
      : {};

  if (listingOrPricing.weeklyDiscount != null && discountsObj.weekly === undefined) {
    discountsObj.weekly = listingOrPricing.weeklyDiscount;
  }
  if (listingOrPricing.monthlyDiscount != null && discountsObj.monthly === undefined) {
    discountsObj.monthly = listingOrPricing.monthlyDiscount;
  }
  if (
    listingOrPricing.lastMinuteDiscount != null &&
    discountsObj.last_minute === undefined &&
    discountsObj.lastMinute === undefined
  ) {
    discountsObj.last_minute = listingOrPricing.lastMinuteDiscount;
  }
  if (
    listingOrPricing.newListingPromotion != null &&
    discountsObj.new_listing === undefined &&
    discountsObj.newListing === undefined
  ) {
    discountsObj.new_listing = listingOrPricing.newListingPromotion;
  }

  // Date validation and calculation
  const checkIn = selectedCheckIn;
  const checkOut = selectedCheckOut;
  let nights: number | null = null;
  let datesValid = false;

  if (checkIn && checkOut) {
    const diff = differenceInBookingNights(checkIn, checkOut);
    if (diff > 0) {
      nights = diff;
      datesValid = true;
    }
  }

  // Evaluate discount eligibility using Phase 3 engine
  const isNewListing = options?.isNewListing ?? listingOrPricing.isNewListing;
  const eligibilityParams: DiscountEligibilityParams = {
    listingId: listingOrPricing.id,
    checkIn: datesValid ? checkIn : undefined,
    checkOut: datesValid ? checkOut : undefined,
    nights: datesValid ? nights : undefined,
    bookingDate: options?.bookingDate,
    discounts: discountsObj,
    isNewListing: isNewListing != null ? Boolean(isNewListing) : undefined,
    listingCreatedAt: listingOrPricing.createdAt,
    completedBookingsCount: listingOrPricing.completedBookingsCount,
    approvedBookingCount: listingOrPricing.approvedBookingCount,
  };

  const eligibility = evaluateDiscountEligibility(eligibilityParams);

  // Stay subtotal for discount resolution
  const effectiveNights = nights && nights > 0 ? nights : 1;
  if (staySubtotal <= 0) staySubtotal = baseDisplayPrice * effectiveNights;

  // Resolve winning discount using Phase 4 engine
  let winning = resolveWinningDiscount({
    eligibility,
    staySubtotal,
  });

  const rawCustomPromotion = discountsObj.custom_promotion;
  if (rawCustomPromotion && typeof rawCustomPromotion === "object" && !Array.isArray(rawCustomPromotion)) {
    const promotion = rawCustomPromotion as Record<string, unknown>;
    const percentage = typeof promotion.percentage === "number"
      ? promotion.percentage
      : typeof promotion.discountPercentage === "number"
        ? promotion.discountPercentage
        : 15;
    const startDate = typeof promotion.startDate === "string" ? promotion.startDate : null;
    const endDate = typeof promotion.endDate === "string" ? promotion.endDate : null;
    const otherCandidates = winning.candidates.filter((candidate) => candidate.key !== "custom_promotion");
    const eligibleSubtotal = nightlyRates.reduce((sum, night) => (
      (!startDate || night.date >= startDate) && (!endDate || night.date <= endDate)
        ? sum + night.rate
        : sum
    ), 0);
    const amount = promotion.enabled === false || percentage <= 0 || percentage > 100
      ? 0
      : Math.round((eligibleSubtotal * percentage) / 100);
    if (amount > 0) {
      otherCandidates.push({
        type: "CUSTOM_PROMOTION",
        key: "custom_promotion",
        name: typeof promotion.name === "string" ? promotion.name : "Custom Promotional Discount",
        percentage,
        amount,
        eligible: true,
        priorityOrder: 6,
      });
    }
    winning = resolveWinningDiscount({ candidates: otherCandidates, staySubtotal });
  }

  if (winning.selected && winning.percentage > 0 && winning.type) {
    // Standard stay-wide discounts retain the exact displayed percentage.
    // A calendar-scoped promotion must instead use its eligible-night amount,
    // because it may cover only part of the selected range.
    const discountedDisplayPrice = winning.key === "custom_promotion"
      ? Math.round(((staySubtotal - winning.amount) / effectiveNights) * 100) / 100
      : Math.round((baseDisplayPrice * (1 - winning.percentage / 100)) * 100) / 100;

    return {
      currency,
      baseDisplayPrice,
      discountedDisplayPrice,
      hasDiscount: true,
      discountType: winning.type,
      discountLabel: winning.label || getDiscountFriendlyLabel(winning.type),
      discountPercentage: winning.percentage,
    };
  }

  return {
    currency,
    baseDisplayPrice,
    discountedDisplayPrice: null,
    hasDiscount: false,
    discountType: null,
    discountLabel: null,
    discountPercentage: null,
  };
}
