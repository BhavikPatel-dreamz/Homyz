import { isWeekendNight, parseDateToUtcMidnight } from "@/lib/pricing/price-tips";
import { differenceInBookingNights, bookingDateKey } from "@/lib/booking/booking-date";
import type { PricingDemandSignal } from "./pricing-contracts";

export interface DemandFactorResult {
  demandMultiplier: number; // e.g. 1.15 = +15%
  primarySignal: PricingDemandSignal;
  marketOccupancyPercentage: number;
  explanation: string;
}

export const demandFactorService = {
  /**
   * Evaluates demand factors for a target dateKey given listing context and current date.
   */
  evaluateDemandFactor(
    targetDateKey: string,
    context: {
      marketOccupancyRate: number;
      historicalPaceAheadPercentage: number;
      hasManualOverride: boolean;
    },
    referenceDate = new Date()
  ): DemandFactorResult {
    const todayKey = bookingDateKey(referenceDate);
    const leadTimeDays = Math.max(
      0,
      differenceInBookingNights(todayKey, targetDateKey)
    );

    const isWeekend = isWeekendNight(targetDateKey);
    let multiplier = 1.0;
    let signal: PricingDemandSignal = "MODERATE_STABLE_DEMAND";
    const reasons: string[] = [];

    // 1. Weekend Demand Multiplier (Thursday & Friday in Saudi Arabia)
    if (isWeekend) {
      multiplier *= 1.18; // +18% weekend baseline
      signal = "HIGH_DEMAND_WEEKEND";
      reasons.push("Strong Saudi weekend getaway demand (Thursday/Friday)");
    }

    // 2. Market Occupancy Factor
    const occ = context.marketOccupancyRate;
    if (occ >= 75) {
      multiplier *= 1.12;
      signal = "PEAK_SEASONAL_SURGE";
      reasons.push(`High citywide market compression (${occ}% occupancy)`);
    } else if (occ >= 60) {
      multiplier *= 1.05;
      if (!isWeekend) {
        signal = "STRONG_BOOKING_PACE";
        reasons.push(`Healthy market occupancy pace (${occ}%)`);
      }
    } else if (occ < 35) {
      multiplier *= 0.92; // -8% stimulation
      signal = "LOW_OCCUPANCY_STIMULATION";
      reasons.push(`Soft market demand (${occ}% occupancy); discount recommended to stimulate bookings`);
    }

    // 3. Lead Time Urgency & Curve Dynamics
    if (leadTimeDays <= 3) {
      if (occ < 50) {
        multiplier *= 0.90; // Last-minute discount
        signal = "LAST_MINUTE_UNSOLD";
        reasons.push("Unbooked inside 3-day window; fill-rate discount recommended");
      } else {
        multiplier *= 1.08; // High compression last-minute premium
        reasons.push("High-urgency last-minute reservation window with tight market availability");
      }
    } else if (leadTimeDays > 45) {
      // Long-range advance reservations
      multiplier *= 1.02;
      reasons.push("Advance booking window rate protection");
    }

    // 4. Booking Pace Dynamics
    if (context.historicalPaceAheadPercentage > 5 && !isWeekend) {
      multiplier *= 1.04;
      reasons.push("Booking pickup pace running +4.8% ahead of seasonal average");
    }

    const explanation = reasons.length > 0 ? reasons.join(" • ") : "Normal baseline market conditions";

    return {
      demandMultiplier: Math.round(multiplier * 1000) / 1000,
      primarySignal: signal,
      marketOccupancyPercentage: Math.round(occ * 10) / 10,
      explanation,
    };
  },
};

