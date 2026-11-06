import type { PricingConstraintLimits } from "./pricing-contracts";

export interface ConstraintEvaluationResult {
  constrainedPriceCents: number;
  unconstrainedPriceCents: number;
  deltaPercentage: number;
  appliedConstraints: string[];
  isLockedBooked: boolean;
  canModify: boolean;
}

export const pricingConstraintsService = {
  /**
   * Applies safety bounds, host-defined floors/ceilings, and daily change limits to a raw recommended price.
   */
  applyPricingConstraints(params: {
    currentPriceCents: number;
    rawRecommendedPriceCents: number;
    isBooked: boolean;
    limits: PricingConstraintLimits;
  }): ConstraintEvaluationResult {
    const { currentPriceCents, rawRecommendedPriceCents, isBooked, limits } = params;

    // 1. Confirmed Reservation Safety Lock
    if (isBooked) {
      return {
        constrainedPriceCents: currentPriceCents,
        unconstrainedPriceCents: rawRecommendedPriceCents,
        deltaPercentage: 0,
        appliedConstraints: ["CONFIRMED_BOOKING_LOCKED"],
        isLockedBooked: true,
        canModify: false,
      };
    }

    const appliedConstraints: string[] = [];
    let price = rawRecommendedPriceCents;

    // 2. Global System Bounds (Sanity Check)
    if (price < limits.systemMinPriceCents) {
      price = limits.systemMinPriceCents;
      appliedConstraints.push("SYSTEM_MIN_PRICE_CLAMPED");
    } else if (price > limits.systemMaxPriceCents) {
      price = limits.systemMaxPriceCents;
      appliedConstraints.push("SYSTEM_MAX_PRICE_CLAMPED");
    }

    // 3. Host-Configured Floor (smartPricingMinPrice)
    if (
      limits.hostFloorPriceCents !== undefined &&
      limits.hostFloorPriceCents !== null &&
      limits.hostFloorPriceCents > 0
    ) {
      if (price < limits.hostFloorPriceCents) {
        price = limits.hostFloorPriceCents;
        appliedConstraints.push("HOST_FLOOR_PRICE_CLAMPED");
      }
    }

    // 4. Host-Configured Ceiling (smartPricingMaxPrice)
    if (
      limits.hostCeilingPriceCents !== undefined &&
      limits.hostCeilingPriceCents !== null &&
      limits.hostCeilingPriceCents > 0
    ) {
      if (price > limits.hostCeilingPriceCents) {
        price = limits.hostCeilingPriceCents;
        appliedConstraints.push("HOST_CEILING_PRICE_CLAMPED");
      }
    }

    // 5. Maximum Permitted Daily Change Constraint (default +/- 15%)
    if (currentPriceCents > 0 && limits.maxDailyChangePercentage > 0) {
      const maxAllowedIncrease = Math.round(
        currentPriceCents * (1 + limits.maxDailyChangePercentage / 100)
      );
      const maxAllowedDecrease = Math.round(
        currentPriceCents * (1 - limits.maxDailyChangePercentage / 100)
      );

      if (price > maxAllowedIncrease) {
        price = maxAllowedIncrease;
        appliedConstraints.push("MAX_DAILY_INCREASE_BOUNDED");
      } else if (price < maxAllowedDecrease) {
        price = maxAllowedDecrease;
        appliedConstraints.push("MAX_DAILY_DECREASE_BOUNDED");
      }
    }

    // Round to nearest integer cent
    const finalPrice = Math.round(price);
    const delta =
      currentPriceCents > 0
        ? Math.round(((finalPrice - currentPriceCents) / currentPriceCents) * 1000) / 10
        : 0;

    return {
      constrainedPriceCents: finalPrice,
      unconstrainedPriceCents: Math.round(rawRecommendedPriceCents),
      deltaPercentage: delta,
      appliedConstraints,
      isLockedBooked: false,
      canModify: true,
    };
  },
};

