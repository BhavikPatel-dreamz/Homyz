import {
  bookingDateKey,
  parseBookingDate,
  differenceInBookingNights,
} from "@/lib/booking/booking-date";

export function parseDateToUtcMidnight(input: Date | string): Date {
  return parseBookingDate(input);
}

export function formatDateToKey(date: Date): string {
  return bookingDateKey(date);
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
  const day =
    date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
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
  weekendPremium?: number | null;
  customPrices?: Record<string, number> | Map<string, number> | null;
}): { price: number; rateSource: "CUSTOM" | "WEEKEND" | "WEEKDAY"; isWeekend: boolean } {
  const isWeekend = isWeekendNight(opts.date);

  // 1. Custom Calendar Date Price (Highest Priority)
  if (opts.customPrices) {
    const custom =
      opts.customPrices instanceof Map
        ? opts.customPrices.get(opts.dateStr)
        : typeof opts.customPrices === "object"
          ? (opts.customPrices as Record<string, number>)[opts.dateStr]
          : undefined;
    if (typeof custom === "number" && custom >= 0) {
      return { price: custom, rateSource: "CUSTOM", isWeekend };
    }
  }

  // 2. Weekend Price (Applies to weekend nights when configured)
  if (isWeekend) {
    if (typeof opts.weekendPrice === "number" && opts.weekendPrice > 0) {
      return { price: opts.weekendPrice, rateSource: "WEEKEND", isWeekend };
    }
    if (typeof opts.weekendPremium === "number" && opts.weekendPremium > 0) {
      const computed = Math.round((opts.weekdayBasePrice * (1 + opts.weekendPremium / 100)) / 100) * 100;
      return { price: computed, rateSource: "WEEKEND", isWeekend };
    }
  }

  // 3. Weekday Base Price (Fallback for weekdays or unconfigured weekends)
  return { price: Math.max(0, opts.weekdayBasePrice), rateSource: "WEEKDAY", isWeekend };
}

/**
 * Universal nightly price resolver for a listing and specific date.
 * Reusable across search, listing detail, and booking flows.
 */
export function resolveNightlyPrice(
  listing: {
    price?: number | null;
    weekdayBasePrice?: number | null;
    baseNightlyPrice?: number | null;
    weekendPrice?: number | null;
    weekendPremium?: number | null;
    customPrices?: Record<string, number> | Map<string, number> | null;
    nightlyPricing?: Record<string, number> | Map<string, number> | null;
  },
  date: Date | string,
): { price: number; rateSource: "CUSTOM" | "WEEKEND" | "WEEKDAY"; isWeekend: boolean } {
  const d = parseDateToUtcMidnight(date);
  const dateStr = formatDateToKey(d);
  const weekdayBasePrice = Math.max(
    0,
    Math.round((listing.weekdayBasePrice ?? listing.baseNightlyPrice ?? listing.price) || 0),
  );
  return resolveNightlyRate({
    date: d,
    dateStr,
    weekdayBasePrice,
    weekendPrice: listing.weekendPrice,
    weekendPremium: listing.weekendPremium,
    customPrices: listing.customPrices ?? listing.nightlyPricing,
  });
}

export type PriceTipAction = "INCREASE" | "DECREASE" | "NO_CHANGE" | "INSUFFICIENT_DATA";

export interface PriceTipRecommendation {
  dateKey: string;
  action: PriceTipAction;
  currentPrice: number; // in cents
  suggestedPrice: number; // in cents
  difference: number; // in cents (suggested - current)
  percentChange: number; // percentage (-100 to +100)
  reasons: string[];
  reasonCodes: string[];
  isWeekend: boolean;
  isBooked: boolean;
  leadTimeDays: number;
  occupancyRate: number; // 0.0 to 1.0 in surrounding 30-day window
  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
}

export interface PriceTipsResult {
  recommendationVersion: string;
  hasMarketData: boolean; // strictly false in Homyz to avoid fake/fabricated competitor claims
  marketDataNote: string;
  averageCurrentPrice: number; // in cents
  averageSuggestedPrice: number; // in cents
  averageDifference: number; // in cents
  averagePercentChange: number;
  overallAction: PriceTipAction;
  reasons: string[];
  reasonCodes: string[];
  recommendations: PriceTipRecommendation[];
  applicableCount: number;
  increaseCount: number;
  decreaseCount: number;
  noChangeCount: number;
  insufficientDataCount: number;
}

export interface CalculatePriceTipsOptions {
  listing: {
    id?: string;
    price: number;
    weekdayBasePrice?: number | null;
    baseNightlyPrice?: number | null;
    weekendPrice?: number | null;
    weekendPremium?: number | null;
    smartPricingMinPrice?: number | null;
    smartPricingMaxPrice?: number | null;
    customPrices?: Record<string, number> | Map<string, number> | null;
    nightlyPricing?: Record<string, number> | Map<string, number> | null;
    createdAt?: string | Date | null;
    city?: string | null;
    propertyType?: string | null;
  };
  dateKeys: string[];
  bookings?: Array<{
    checkIn?: string | Date;
    checkOut?: string | Date;
    startDate?: string | Date;
    endDate?: string | Date;
    status: string;
    createdAt?: string | Date;
  }>;
  todayKey?: string;
  comparables?: {
    sampleCount: number;
    averagePrice: number; // in cents
  } | null;
}

/**
 * Price Tips Recommendation Engine v2.0.
 * Client-safe, deterministic advisory calculations based strictly on real Homyz host data:
 * - Real calendar forward occupancy in surrounding 30-day window
 * - Real booking lead time (distressed last-minute unbooked vs healthy advance booking)
 * - Middle East weekend demand and host-configured weekend pricing
 * - Host Smart Pricing boundaries (minimum floor & maximum ceiling)
 * - Safe data thresholds: provides INSUFFICIENT_DATA when data is inadequate, NO_CHANGE when optimal
 *
 * ZERO fake external competitor prices, ZERO hardcoded "+10%" multipliers.
 */
export function calculatePriceTips({
  listing,
  dateKeys,
  bookings = [],
  todayKey,
  comparables = null,
}: CalculatePriceTipsOptions): PriceTipsResult {
  const recommendationVersion = "2.0.0";
  const baseRate = Math.max(
    0,
    Math.round((listing.weekdayBasePrice ?? listing.baseNightlyPrice ?? listing.price) || 0),
  );
  const today = todayKey || new Date().toISOString().slice(0, 10);

  // 1. Index all active bookings into a booked-dates set
  const bookedSet = new Set<string>();
  let confirmedBookingsCount = 0;

  for (const b of bookings) {
    if (b.status === "CONFIRMED" || b.status === "PENDING" || b.status === "COMPLETED") {
      confirmedBookingsCount++;
      const rawStart = b.startDate ?? b.checkIn;
      const rawEnd = b.endDate ?? b.checkOut;
      if (!rawStart || !rawEnd) continue;
      const startKey =
        typeof rawStart === "string" ? rawStart.slice(0, 10) : rawStart.toISOString().slice(0, 10);
      const endKey =
        typeof rawEnd === "string" ? rawEnd.slice(0, 10) : rawEnd.toISOString().slice(0, 10);

      try {
        let cur = parseDateToUtcMidnight(startKey);
        const end = parseDateToUtcMidnight(endKey);
        while (cur < end) {
          bookedSet.add(formatDateToKey(cur));
          cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1));
        }
      } catch {
        // Safe date parse ignore
      }
    }
  }

  // 2. Check if the listing has sufficient real historical data for recommendations
  // An active listing needs at least 1 booking or valid comparable data to form an occupancy signal.
  const hasReliableData =
    confirmedBookingsCount > 0 ||
    (comparables !== null && comparables.sampleCount >= 3);

  const recommendations: PriceTipRecommendation[] = [];
  const aggregatedReasons = new Set<string>();
  const aggregatedReasonCodes = new Set<string>();

  let totalCurrent = 0;
  let totalSuggested = 0;
  let applicableCount = 0;
  let increaseCount = 0;
  let decreaseCount = 0;
  let noChangeCount = 0;
  let insufficientDataCount = 0;

  // Sort keys chronologically
  const sortedKeys = [...dateKeys].sort();

  for (const key of sortedKeys) {
    const isBooked = bookedSet.has(key);
    const dateObj = parseDateToUtcMidnight(key);
    const isWeekend = isWeekendNight(dateObj);
    const leadTimeDays = differenceInBookingNights(today, key);

    const current = resolveNightlyRate({
      date: dateObj,
      dateStr: key,
      weekdayBasePrice: baseRate,
      weekendPrice: listing.weekendPrice,
      weekendPremium: listing.weekendPremium,
      customPrices: listing.customPrices ?? listing.nightlyPricing,
    }).price;

    // Case 1: Date has active reservation -> Protected, No changes
    if (isBooked) {
      recommendations.push({
        dateKey: key,
        action: "NO_CHANGE",
        currentPrice: current,
        suggestedPrice: current,
        difference: 0,
        percentChange: 0,
        reasons: ["Date is reserved by a confirmed reservation (protected)"],
        reasonCodes: ["PROTECTED_RESERVATION"],
        isWeekend,
        isBooked: true,
        leadTimeDays,
        occupancyRate: 1,
        confidence: "HIGH",
      });
      continue;
    }

    // Case 2: Insufficient data for this date -> INSUFFICIENT_DATA
    const hasDateSignals =
      hasReliableData ||
      isWeekend ||
      Boolean(
        (typeof listing.weekendPrice === "number" && listing.weekendPrice > 0) ||
        (typeof listing.weekendPremium === "number" && listing.weekendPremium > 0) ||
        (typeof listing.smartPricingMinPrice === "number" && listing.smartPricingMinPrice > 0) ||
        (typeof listing.smartPricingMaxPrice === "number" && listing.smartPricingMaxPrice > 0)
      );

    if (!hasDateSignals) {
      insufficientDataCount++;
      applicableCount++;
      totalCurrent += current;
      totalSuggested += current;

      const reasonMsg =
        "No reliable price tip available yet. Standard base rate remains active until booking signals accumulate.";
      aggregatedReasons.add(reasonMsg);
      aggregatedReasonCodes.add("INSUFFICIENT_DATA");

      recommendations.push({
        dateKey: key,
        action: "INSUFFICIENT_DATA",
        currentPrice: current,
        suggestedPrice: current,
        difference: 0,
        percentChange: 0,
        reasons: [reasonMsg],
        reasonCodes: ["INSUFFICIENT_DATA"],
        isWeekend,
        isBooked: false,
        leadTimeDays,
        occupancyRate: 0,
        confidence: "INSUFFICIENT",
      });
      continue;
    }

    // Case 3: Data-driven calculation using real signals
    // 3A. Calculate local forward rolling 30-day occupancy around target date [date - 14d, date + 15d]
    let windowBookedCount = 0;
    const windowTotalNights = 30;
    for (let offset = -14; offset <= 15; offset++) {
      const windowDate = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate() + offset));
      const windowKey = formatDateToKey(windowDate);
      if (bookedSet.has(windowKey)) {
        windowBookedCount++;
      }
    }
    const localOccupancy = windowBookedCount / windowTotalNights;

    // 3B. Establish baseline for the day of week
    let baseline = baseRate;
    let weekendReason: string | null = null;
    let weekendCode: string | null = null;

    if (isWeekend) {
      if (typeof listing.weekendPrice === "number" && listing.weekendPrice > 0) {
        baseline = listing.weekendPrice;
        weekendReason = "Aligned with your configured weekend rate";
        weekendCode = "CONFIGURED_WEEKEND_RATE";
      } else if (typeof listing.weekendPremium === "number" && listing.weekendPremium > 0) {
        baseline = Math.round((baseRate * (1 + listing.weekendPremium / 100)) / 100) * 100;
        weekendReason = `Includes your configured ${listing.weekendPremium}% weekend premium`;
        weekendCode = "CONFIGURED_WEEKEND_PREMIUM";
      } else {
        baseline = Math.round((baseRate * 1.15) / 100) * 100;
        weekendReason = "Weekend night demand adjustment (Thursday/Friday)";
        weekendCode = "WEEKEND_NIGHT_DEMAND";
      }
    }

    const reasons: string[] = [];
    const reasonCodes: string[] = [];
    if (weekendReason && weekendCode) {
      reasons.push(weekendReason);
      reasonCodes.push(weekendCode);
    }

    // 3C. Dynamic adjustments based on real signals
    let multiplier = 1.0;

    // Signal A: High forward occupancy compression
    if (localOccupancy >= 0.70) {
      multiplier *= 1.15;
      const occPct = Math.round(localOccupancy * 100);
      reasons.push(`High calendar compression (${occPct}% booked in surrounding 30 days)`);
      reasonCodes.push("HIGH_OCCUPANCY_SURGE");
    } else if (localOccupancy >= 0.50) {
      multiplier *= 1.08;
      const occPct = Math.round(localOccupancy * 100);
      reasons.push(`Healthy booking pace (${occPct}% booked in surrounding 30 days)`);
      reasonCodes.push("STRONG_OCCUPANCY");
    }

    // Signal B: Lead time & distressed inventory
    if (leadTimeDays >= 0 && leadTimeDays <= 4 && localOccupancy < 0.40) {
      multiplier *= 0.85;
      const dayLabel = leadTimeDays === 0 ? "today" : `${leadTimeDays} days`;
      reasons.push(`Unbooked date approaching in ${dayLabel} — discount to capture last-minute bookings`);
      reasonCodes.push("LAST_MINUTE_UNBOOKED_DISCOUNT");
    } else if (leadTimeDays > 4 && leadTimeDays <= 12 && localOccupancy < 0.25) {
      multiplier *= 0.90;
      const occPct = Math.round(localOccupancy * 100);
      reasons.push(`Low near-term occupancy (${occPct}% booked) — discount incentive to fill calendar`);
      reasonCodes.push("LOW_NEAR_TERM_OCCUPANCY");
    } else if (leadTimeDays > 45 && localOccupancy < 0.15) {
      multiplier *= 0.95;
      reasons.push("Far advance unbooked date — early booking incentive to build base occupancy");
      reasonCodes.push("EARLY_BIRD_INCENTIVE");
    } else if (leadTimeDays > 30 && localOccupancy >= 0.50) {
      multiplier *= 1.06;
      reasons.push("Strong advance booking momentum for dates > 30 days out");
      reasonCodes.push("STRONG_ADVANCE_MOMENTUM");
    }

    // Signal C: Internal similar listings benchmark (strictly requires sample >= 3)
    if (comparables && comparables.sampleCount >= 3) {
      if (comparables.averagePrice > baseRate * 1.20) {
        multiplier *= 1.05;
        const avgDisplay = Math.round(comparables.averagePrice / 100);
        reasons.push(`Comparable active listings in your market average ${avgDisplay} (${comparables.sampleCount} properties)`);
        reasonCodes.push("COMPARABLE_LISTINGS_HIGHER");
      } else if (comparables.averagePrice < baseRate * 0.80) {
        multiplier *= 0.95;
        const avgDisplay = Math.round(comparables.averagePrice / 100);
        reasons.push(`Comparable active listings in your market average ${avgDisplay} (${comparables.sampleCount} properties)`);
        reasonCodes.push("COMPARABLE_LISTINGS_LOWER");
      }
    }

    // Compute raw target
    let target = Math.round((baseline * multiplier) / 100) * 100;

    // 3D. Smart Pricing min/max enforcement & safety bounds
    if (listing.smartPricingMinPrice != null && listing.smartPricingMinPrice > 0) {
      if (target < listing.smartPricingMinPrice) {
        target = listing.smartPricingMinPrice;
        reasons.push("Protected by your configured Smart Pricing minimum floor");
        reasonCodes.push("SMART_PRICING_FLOOR");
      }
    } else {
      // General safety floor: never drop below 60% of base rate
      target = Math.max(target, Math.round((baseRate * 0.6) / 100) * 100);
    }

    if (listing.smartPricingMaxPrice != null && listing.smartPricingMaxPrice > 0) {
      if (target > listing.smartPricingMaxPrice) {
        target = listing.smartPricingMaxPrice;
        reasons.push("Protected by your configured Smart Pricing maximum ceiling");
        reasonCodes.push("SMART_PRICING_CEILING");
      }
    } else {
      // General safety ceiling: never exceed 160% of base rate
      target = Math.min(target, Math.round((baseRate * 1.6) / 100) * 100);
    }

    target = Math.round(target / 100) * 100;

    // 3E. Action classification & No-Change threshold
    let difference = target - current;
    let percentChange = current > 0 ? Math.round((difference / current) * 100) : 0;
    let action: PriceTipAction = "NO_CHANGE";

    // Within +/- 2% or less than 1 whole currency unit -> Optimal / No change
    if (Math.abs(difference) < 100 || Math.abs(percentChange) <= 2) {
      action = "NO_CHANGE";
      target = current; // Suggested matches current
      difference = 0;
      percentChange = 0;
      if (reasons.length === 0) {
        reasons.push("Your current nightly rate is already well-aligned with demand signals for this date");
        reasonCodes.push("OPTIMAL_RATE");
      }
      noChangeCount++;
    } else if (target > current) {
      action = "INCREASE";
      increaseCount++;
    } else {
      action = "DECREASE";
      decreaseCount++;
    }

    if (reasons.length === 0) {
      reasons.push("Standard nightly rate based on property calendar settings");
      reasonCodes.push("STANDARD_BASELINE");
    }

    for (const r of reasons) aggregatedReasons.add(r);
    for (const rc of reasonCodes) aggregatedReasonCodes.add(rc);

    applicableCount++;
    totalCurrent += current;
    totalSuggested += target;

    recommendations.push({
      dateKey: key,
      action,
      currentPrice: current,
      suggestedPrice: target,
      difference,
      percentChange,
      reasons,
      reasonCodes,
      isWeekend,
      isBooked: false,
      leadTimeDays,
      occupancyRate: localOccupancy,
      confidence: localOccupancy > 0 ? "HIGH" : "MEDIUM",
    });
  }

  const averageCurrentPrice =
    applicableCount > 0 ? Math.round(totalCurrent / applicableCount) : 0;
  const averageSuggestedPrice =
    applicableCount > 0 ? Math.round(totalSuggested / applicableCount) : 0;
  const averageDifference = averageSuggestedPrice - averageCurrentPrice;
  const averagePercentChange =
    averageCurrentPrice > 0
      ? Math.round(((averageSuggestedPrice - averageCurrentPrice) / averageCurrentPrice) * 100)
      : 0;

  // Determine overall action
  let overallAction: PriceTipAction = "NO_CHANGE";
  if (insufficientDataCount === applicableCount && applicableCount > 0) {
    overallAction = "INSUFFICIENT_DATA";
  } else if (noChangeCount === applicableCount && applicableCount > 0) {
    overallAction = "NO_CHANGE";
  } else if (increaseCount > decreaseCount && averageDifference > 0) {
    overallAction = "INCREASE";
  } else if (decreaseCount > increaseCount && averageDifference < 0) {
    overallAction = "DECREASE";
  } else if (increaseCount > 0) {
    overallAction = "INCREASE";
  } else if (decreaseCount > 0) {
    overallAction = "DECREASE";
  }

  return {
    recommendationVersion,
    hasMarketData: false,
    marketDataNote:
      "External competitor comparison is unavailable. Recommendations are calculated strictly from your property's real calendar occupancy, booking lead time, weekend settings, and booking pace.",
    averageCurrentPrice,
    averageSuggestedPrice,
    averageDifference,
    averagePercentChange,
    overallAction,
    reasons: Array.from(aggregatedReasons),
    reasonCodes: Array.from(aggregatedReasonCodes),
    recommendations,
    applicableCount,
    increaseCount,
    decreaseCount,
    noChangeCount,
    insufficientDataCount,
  };
}
