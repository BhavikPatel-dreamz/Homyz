/**
 * Homyz Refund Policy Engine
 *
 * Implements deterministic, versioned, configurable cancellation policy rules
 * and refund eligibility calculations.
 *
 * Operates strictly with integer minor units (cents/halalas) to eliminate floating-point drift.
 * Unapproved or missing policies fail closed into "NEEDS_REVIEW" without fabricating numbers.
 */

export type CancellationPolicyId =
  | "FLEXIBLE"
  | "MODERATE"
  | "FIRM"
  | "FIRM_LONG_TERM"
  | "STRICT_LONG_TERM"
  | "NON_REFUNDABLE"
  | string;

export type CancellationActor = "GUEST" | "HOST" | "ADMIN";

export type RefundEligibilityStatus = "ELIGIBLE" | "INELIGIBLE" | "NEEDS_REVIEW";

export interface RefundMilestone {
  name: string;
  minHoursBeforeCheckIn: number; // e.g. 24 for >= 24h
  maxHoursBeforeCheckIn?: number; // e.g. 120 for < 5 days
  accommodationRefundPercent: number; // 0 to 100
  cleaningFeeRefund: "FULL" | "NONE";
  serviceFeeRefund: "FULL" | "NONE" | "PROPORTIONAL";
  taxesRefund: "PROPORTIONAL" | "NONE";
  description: string;
}

export interface PolicyDefinition {
  policyId: string;
  policyName: string;
  version: string;
  category: "SHORT_TERM" | "LONG_TERM";
  isApproved: boolean;
  missingRules?: string[];
  description: string;
  milestones: RefundMilestone[];
}

/**
 * Authoritative Policy Configuration Registry.
 * Versioned so historical bookings retain their booking-time terms.
 */
export const REFUND_POLICY_REGISTRY: Record<string, PolicyDefinition> = {
  // ── Short-Term Stays (< 28 nights) ──────────────────────────────────────────
  "FLEXIBLE:v1": {
    policyId: "FLEXIBLE",
    policyName: "Flexible Policy",
    version: "v1",
    category: "SHORT_TERM",
    isApproved: true,
    description: "Full refund up to 24 hours before check-in. Cleaning fee refunded if cancelled before check-in.",
    milestones: [
      {
        name: "Full Refund Window (>= 24 hours before check-in)",
        minHoursBeforeCheckIn: 24,
        accommodationRefundPercent: 100,
        cleaningFeeRefund: "FULL",
        serviceFeeRefund: "FULL",
        taxesRefund: "PROPORTIONAL",
        description: "100% refund of accommodation, cleaning fee, and guest fees.",
      },
      {
        name: "Late Cancellation Window (< 24 hours before check-in)",
        minHoursBeforeCheckIn: 0,
        maxHoursBeforeCheckIn: 24,
        accommodationRefundPercent: 0,
        cleaningFeeRefund: "FULL",
        serviceFeeRefund: "NONE",
        taxesRefund: "PROPORTIONAL",
        description: "Cleaning fee refunded. First night and accommodation retained.",
      },
    ],
  },

  "MODERATE:v1": {
    policyId: "MODERATE",
    policyName: "Moderate Policy",
    version: "v1",
    category: "SHORT_TERM",
    isApproved: true,
    description: "Full refund up to 5 days (120 hours) before check-in. Cleaning fee refunded if cancelled before check-in.",
    milestones: [
      {
        name: "Full Refund Window (>= 120 hours before check-in)",
        minHoursBeforeCheckIn: 120,
        accommodationRefundPercent: 100,
        cleaningFeeRefund: "FULL",
        serviceFeeRefund: "FULL",
        taxesRefund: "PROPORTIONAL",
        description: "100% refund of accommodation, cleaning fee, and guest fees.",
      },
      {
        name: "Late Cancellation Window (< 120 hours before check-in)",
        minHoursBeforeCheckIn: 0,
        maxHoursBeforeCheckIn: 120,
        accommodationRefundPercent: 0,
        cleaningFeeRefund: "FULL",
        serviceFeeRefund: "NONE",
        taxesRefund: "PROPORTIONAL",
        description: "Cleaning fee refunded. Accommodation retained.",
      },
    ],
  },

  "FIRM:v1": {
    policyId: "FIRM",
    policyName: "Firm Policy",
    version: "v1",
    category: "SHORT_TERM",
    isApproved: true,
    description: "Full refund up to 30 days before check-in; 50% refund between 30 and 7 days before check-in.",
    milestones: [
      {
        name: "Full Refund Window (>= 720 hours / 30 days before check-in)",
        minHoursBeforeCheckIn: 720,
        accommodationRefundPercent: 100,
        cleaningFeeRefund: "FULL",
        serviceFeeRefund: "FULL",
        taxesRefund: "PROPORTIONAL",
        description: "100% refund of accommodation and cleaning fee.",
      },
      {
        name: "Partial 50% Refund Window (168 to 720 hours before check-in)",
        minHoursBeforeCheckIn: 168,
        maxHoursBeforeCheckIn: 720,
        accommodationRefundPercent: 50,
        cleaningFeeRefund: "FULL",
        serviceFeeRefund: "NONE",
        taxesRefund: "PROPORTIONAL",
        description: "50% refund of accommodation, 100% refund of cleaning fee.",
      },
      {
        name: "Late Cancellation Window (< 168 hours / 7 days before check-in)",
        minHoursBeforeCheckIn: 0,
        maxHoursBeforeCheckIn: 168,
        accommodationRefundPercent: 0,
        cleaningFeeRefund: "FULL",
        serviceFeeRefund: "NONE",
        taxesRefund: "PROPORTIONAL",
        description: "Cleaning fee refunded. Accommodation retained.",
      },
    ],
  },

  // ── Long-Term Stays (>= 28 nights) ──────────────────────────────────────────
  "FIRM_LONG_TERM:v1": {
    policyId: "FIRM_LONG_TERM",
    policyName: "Firm Long-Term Policy",
    version: "v1",
    category: "LONG_TERM",
    isApproved: false,
    missingRules: [
      "Long-term 30-day rolling commitment and host payout retention schedule is awaiting formal platform executive approval.",
    ],
    description: "Full refund if cancelled >= 30 days before check-in; otherwise first 30 days non-refundable (Under Review).",
    milestones: [],
  },

  "STRICT_LONG_TERM:v1": {
    policyId: "STRICT_LONG_TERM",
    policyName: "Strict Long-Term Policy",
    version: "v1",
    category: "LONG_TERM",
    isApproved: false,
    missingRules: [
      "Strict long-term retention schedule awaiting finance executive sign-off.",
    ],
    description: "First 30 days non-refundable regardless of cancellation timing (Under Review).",
    milestones: [],
  },

  // ── Special Conditions Option ──────────────────────────────────────────────
  "NON_REFUNDABLE:v1": {
    policyId: "NON_REFUNDABLE",
    policyName: "Non-Refundable Option",
    version: "v1",
    category: "SHORT_TERM",
    isApproved: true,
    description: "Guest received an upfront discount in exchange for forfeiting accommodation refunds. Cleaning fee is refunded if cancelled before check-in.",
    milestones: [
      {
        name: "Non-Refundable Stay Cancellation",
        minHoursBeforeCheckIn: 0,
        accommodationRefundPercent: 0,
        cleaningFeeRefund: "FULL",
        serviceFeeRefund: "NONE",
        taxesRefund: "PROPORTIONAL",
        description: "0% accommodation refund. 100% cleaning fee refunded if cancelled before check-in.",
      },
    ],
  },
};

/** Resolves policy definition by ID and version. */
export function getPolicyDefinition(
  policyId?: string | null,
  version = "v1",
): PolicyDefinition | null {
  if (!policyId) return null;
  const normalizedId = policyId.trim().toUpperCase();
  const key = `${normalizedId}:${version}`;
  if (REFUND_POLICY_REGISTRY[key]) return REFUND_POLICY_REGISTRY[key];

  // Try alias mappings
  if (normalizedId === "STRICT" && REFUND_POLICY_REGISTRY["FIRM:v1"]) {
    return REFUND_POLICY_REGISTRY["FIRM:v1"];
  }
  return null;
}

/**
 * Calculates hours remaining between cancellation time and check-in time.
 * Standard Airbnb/Homyz check-in is 15:00 (3:00 PM) local property time.
 */
export function calculateHoursUntilCheckIn(
  checkInDate: Date | string,
  checkInTimeStr?: string | null,
  cancellationTime: Date = new Date(),
): { hours: number; isPastCheckIn: boolean; checkInDateTime: Date } {
  const checkInBase = typeof checkInDate === "string" ? new Date(checkInDate) : checkInDate;

  // Extract date components
  const y = checkInBase.getUTCFullYear();
  const m = checkInBase.getUTCMonth();
  const d = checkInBase.getUTCDate();

  // Parse check-in time string (e.g. "15:00") or default to 15:00 (3:00 PM)
  let hour = 15;
  let minute = 0;
  if (checkInTimeStr && /^\d{1,2}:\d{2}$/.test(checkInTimeStr.trim())) {
    const [h, min] = checkInTimeStr.trim().split(":").map(Number);
    if (!Number.isNaN(h) && h >= 0 && h <= 23) hour = h;
    if (!Number.isNaN(min) && min >= 0 && min <= 59) minute = min;
  }

  const checkInDateTime = new Date(Date.UTC(y, m, d, hour, minute, 0));
  const diffMs = checkInDateTime.getTime() - cancellationTime.getTime();
  const hours = diffMs / (3600 * 1000);

  return {
    hours,
    isPastCheckIn: hours <= 0,
    checkInDateTime,
  };
}

export interface RefundCalculationParams {
  bookingId: string;
  cancellationActor: CancellationActor;
  effectiveCancellationTime?: Date;
  policyIdSnapshot?: string | null;
  policyVersion?: string;
  isNonRefundable?: boolean;
  nights: number;
  checkInDate: Date | string;
  checkInTimeStr?: string | null;

  // Financial components (integer minor units / cents)
  totalPrice: number; // Stored booking total
  accommodationTotal?: number; // Base room total or subtotal
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
  currency?: string;

  // Payment balances (integer minor units / cents)
  capturedAmount: number;
  alreadyRefundedAmount: number;
  pendingRefundReservedAmount?: number;

  // Administrative overrides
  discretionaryAdjustmentAmount?: number;
  discretionaryReason?: string;
}

export interface RefundCalculationResult {
  bookingId: string;
  currency: string;
  status: RefundEligibilityStatus;
  isCalculated: boolean;
  policyUsed: string;
  policyVersion: string;
  milestoneApplied?: string;
  hoursUntilCheckIn: number;
  isPastCheckIn: boolean;

  // Balance overview (cents)
  capturedAmount: number;
  alreadyRefundedAmount: number;
  pendingRefundReservedAmount: number;
  remainingRefundableBalance: number;

  // Proposed itemized refund (cents)
  accommodationRefund: number;
  cleaningFeeRefund: number;
  serviceFeeRefund: number;
  taxRefund: number;
  discretionaryAmount: number;
  totalRefundableAmount: number;

  // Explanations and warnings
  explanation: string;
  missingRules: string[];
}

/**
 * Primary deterministic refund calculation engine.
 * Computes exact refundable amounts based on booking-time policy terms.
 */
export function calculateRefundEligibility(
  params: RefundCalculationParams,
): RefundCalculationResult {
  const {
    bookingId,
    cancellationActor,
    effectiveCancellationTime = new Date(),
    policyVersion = "v1",
    isNonRefundable = false,
    nights,
    checkInDate,
    checkInTimeStr,
    totalPrice,
    currency = "SAR",
    capturedAmount,
    alreadyRefundedAmount,
    pendingRefundReservedAmount = 0,
    discretionaryAdjustmentAmount,
    discretionaryReason,
  } = params;

  // Minor unit protections
  const safeCaptured = Math.max(0, Math.round(capturedAmount));
  const safeAlreadyRefunded = Math.max(0, Math.round(alreadyRefundedAmount));
  const safePendingReserved = Math.max(0, Math.round(pendingRefundReservedAmount));
  const remainingRefundableBalance = Math.max(
    0,
    safeCaptured - (safeAlreadyRefunded + safePendingReserved),
  );

  // Time calculation
  const { hours, isPastCheckIn } = calculateHoursUntilCheckIn(
    checkInDate,
    checkInTimeStr,
    effectiveCancellationTime,
  );

  // Financial components decomposition
  const safeCleaning = Math.max(0, Math.round(params.cleaningFee ?? 0));
  const safeService = Math.max(0, Math.round(params.serviceFee ?? 0));
  const safeTaxes = Math.max(0, Math.round(params.taxes ?? 0));
  const safeAccommodation = Math.max(
    0,
    Math.round(params.accommodationTotal ?? (totalPrice - safeCleaning - safeService - safeTaxes)),
  );

  // 1. Check if captured amount is 0
  if (safeCaptured <= 0) {
    return {
      bookingId,
      currency,
      status: "INELIGIBLE",
      isCalculated: true,
      policyUsed: params.policyIdSnapshot || "NONE",
      policyVersion,
      hoursUntilCheckIn: hours,
      isPastCheckIn,
      capturedAmount: 0,
      alreadyRefundedAmount: 0,
      pendingRefundReservedAmount: 0,
      remainingRefundableBalance: 0,
      accommodationRefund: 0,
      cleaningFeeRefund: 0,
      serviceFeeRefund: 0,
      taxRefund: 0,
      discretionaryAmount: 0,
      totalRefundableAmount: 0,
      explanation: "No captured payment exists for this reservation. Cannot issue refund.",
      missingRules: [],
    };
  }

  // 2. Check if remaining refundable balance is 0
  if (remainingRefundableBalance <= 0) {
    return {
      bookingId,
      currency,
      status: "INELIGIBLE",
      isCalculated: true,
      policyUsed: params.policyIdSnapshot || "NONE",
      policyVersion,
      hoursUntilCheckIn: hours,
      isPastCheckIn,
      capturedAmount: safeCaptured,
      alreadyRefundedAmount: safeAlreadyRefunded,
      pendingRefundReservedAmount: safePendingReserved,
      remainingRefundableBalance: 0,
      accommodationRefund: 0,
      cleaningFeeRefund: 0,
      serviceFeeRefund: 0,
      taxRefund: 0,
      discretionaryAmount: 0,
      totalRefundableAmount: 0,
      explanation: "This reservation has already been fully refunded or all captured funds are committed.",
      missingRules: [],
    };
  }

  // 3. Special Case: HOST CANCELLATION
  // When host cancels a confirmed reservation, guest is entitled to 100% full reimbursement
  if (cancellationActor === "HOST") {
    const fullAmount = Math.min(safeCaptured, remainingRefundableBalance);
    return {
      bookingId,
      currency,
      status: "ELIGIBLE",
      isCalculated: true,
      policyUsed: "HOST_CANCELLATION",
      policyVersion,
      milestoneApplied: "Host-Initiated Full Reimbursement",
      hoursUntilCheckIn: hours,
      isPastCheckIn,
      capturedAmount: safeCaptured,
      alreadyRefundedAmount: safeAlreadyRefunded,
      pendingRefundReservedAmount: safePendingReserved,
      remainingRefundableBalance,
      accommodationRefund: safeAccommodation,
      cleaningFeeRefund: safeCleaning,
      serviceFeeRefund: safeService,
      taxRefund: safeTaxes,
      discretionaryAmount: 0,
      totalRefundableAmount: fullAmount,
      explanation: "Host cancelled reservation. Guest is entitled to a 100% full reimbursement of all captured funds.",
      missingRules: [],
    };
  }

  // 4. Special Case: ADMIN DISCRETIONARY OVERRIDE
  if (cancellationActor === "ADMIN" && discretionaryAdjustmentAmount !== undefined) {
    const safeDiscretionary = Math.min(
      Math.max(0, Math.round(discretionaryAdjustmentAmount)),
      remainingRefundableBalance,
    );
    return {
      bookingId,
      currency,
      status: "ELIGIBLE",
      isCalculated: true,
      policyUsed: "ADMIN_DISCRETIONARY",
      policyVersion,
      milestoneApplied: "Administrative Override",
      hoursUntilCheckIn: hours,
      isPastCheckIn,
      capturedAmount: safeCaptured,
      alreadyRefundedAmount: safeAlreadyRefunded,
      pendingRefundReservedAmount: safePendingReserved,
      remainingRefundableBalance,
      accommodationRefund: 0,
      cleaningFeeRefund: 0,
      serviceFeeRefund: 0,
      taxRefund: 0,
      discretionaryAmount: safeDiscretionary,
      totalRefundableAmount: safeDiscretionary,
      explanation: `Administrative discretionary refund override${discretionaryReason ? `: "${discretionaryReason}"` : ""}. Bounded by captured balance.`,
      missingRules: [],
    };
  }

  // 5. Resolve Policy Definition
  const effectivePolicyId = isNonRefundable
    ? "NON_REFUNDABLE"
    : (params.policyIdSnapshot || (nights >= 28 ? "FIRM_LONG_TERM" : "FLEXIBLE"));

  const policy = getPolicyDefinition(effectivePolicyId, policyVersion);

  // If policy definition is missing or unapproved -> Fail safe into NEEDS_REVIEW
  if (!policy) {
    return {
      bookingId,
      currency,
      status: "NEEDS_REVIEW",
      isCalculated: false,
      policyUsed: effectivePolicyId,
      policyVersion,
      hoursUntilCheckIn: hours,
      isPastCheckIn,
      capturedAmount: safeCaptured,
      alreadyRefundedAmount: safeAlreadyRefunded,
      pendingRefundReservedAmount: safePendingReserved,
      remainingRefundableBalance,
      accommodationRefund: 0,
      cleaningFeeRefund: 0,
      serviceFeeRefund: 0,
      taxRefund: 0,
      discretionaryAmount: 0,
      totalRefundableAmount: 0,
      explanation: `Refund eligibility requires review: Policy "${effectivePolicyId}" (${policyVersion}) is not configured in the policy registry.`,
      missingRules: [`Policy "${effectivePolicyId}" definition is missing.`],
    };
  }

  if (!policy.isApproved) {
    return {
      bookingId,
      currency,
      status: "NEEDS_REVIEW",
      isCalculated: false,
      policyUsed: policy.policyId,
      policyVersion: policy.version,
      hoursUntilCheckIn: hours,
      isPastCheckIn,
      capturedAmount: safeCaptured,
      alreadyRefundedAmount: safeAlreadyRefunded,
      pendingRefundReservedAmount: safePendingReserved,
      remainingRefundableBalance,
      accommodationRefund: 0,
      cleaningFeeRefund: 0,
      serviceFeeRefund: 0,
      taxRefund: 0,
      discretionaryAmount: 0,
      totalRefundableAmount: 0,
      explanation: `Refund calculation unavailable: ${policy.policyName} terms are currently awaiting platform executive approval. Automatic processing is disabled.`,
      missingRules: policy.missingRules || ["Policy rules awaiting approval."],
    };
  }

  // 6. Handle Past Check-In
  if (isPastCheckIn) {
    return {
      bookingId,
      currency,
      status: "INELIGIBLE",
      isCalculated: true,
      policyUsed: policy.policyId,
      policyVersion: policy.version,
      milestoneApplied: "Past Check-In",
      hoursUntilCheckIn: hours,
      isPastCheckIn: true,
      capturedAmount: safeCaptured,
      alreadyRefundedAmount: safeAlreadyRefunded,
      pendingRefundReservedAmount: safePendingReserved,
      remainingRefundableBalance,
      accommodationRefund: 0,
      cleaningFeeRefund: 0,
      serviceFeeRefund: 0,
      taxRefund: 0,
      discretionaryAmount: 0,
      totalRefundableAmount: 0,
      explanation: "Reservation was cancelled after the scheduled check-in time. Accommodation and cleaning fee are non-refundable under standard policy terms.",
      missingRules: [],
    };
  }

  // 7. Find Matching Milestone by Hours Until Check-In
  const matchedMilestone = policy.milestones.find((m) => {
    const passesMin = hours >= m.minHoursBeforeCheckIn;
    const passesMax = m.maxHoursBeforeCheckIn === undefined || hours < m.maxHoursBeforeCheckIn;
    return passesMin && passesMax;
  });

  if (!matchedMilestone) {
    return {
      bookingId,
      currency,
      status: "NEEDS_REVIEW",
      isCalculated: false,
      policyUsed: policy.policyId,
      policyVersion: policy.version,
      hoursUntilCheckIn: hours,
      isPastCheckIn: false,
      capturedAmount: safeCaptured,
      alreadyRefundedAmount: safeAlreadyRefunded,
      pendingRefundReservedAmount: safePendingReserved,
      remainingRefundableBalance,
      accommodationRefund: 0,
      cleaningFeeRefund: 0,
      serviceFeeRefund: 0,
      taxRefund: 0,
      discretionaryAmount: 0,
      totalRefundableAmount: 0,
      explanation: `Cancellation timing (${hours.toFixed(1)}h before check-in) does not match any approved milestone in ${policy.policyName}. Requires manual financial review.`,
      missingRules: [`No milestone rule defined for timing of ${hours.toFixed(1)}h before check-in.`],
    };
  }

  // 8. Calculate Itemized Amounts
  const accommodationRefund = Math.round(
    (safeAccommodation * matchedMilestone.accommodationRefundPercent) / 100,
  );
  const cleaningFeeRefund = matchedMilestone.cleaningFeeRefund === "FULL" ? safeCleaning : 0;
  const serviceFeeRefund = matchedMilestone.serviceFeeRefund === "FULL" ? safeService : 0;

  // Proportional tax refund based on refunded portion of accommodation + cleaning fee
  const originalTaxableBase = safeAccommodation + safeCleaning;
  const refundedTaxableBase = accommodationRefund + cleaningFeeRefund;
  const taxRefund = originalTaxableBase > 0
    ? Math.round((safeTaxes * refundedTaxableBase) / originalTaxableBase)
    : 0;

  const rawProposedTotal = accommodationRefund + cleaningFeeRefund + serviceFeeRefund + taxRefund;
  const totalRefundableAmount = Math.min(rawProposedTotal, remainingRefundableBalance);

  const status: RefundEligibilityStatus = totalRefundableAmount > 0 ? "ELIGIBLE" : "INELIGIBLE";

  const explanation = `${policy.policyName} (${policy.version}): Cancelled ${hours.toFixed(1)} hours before check-in. Matched "${matchedMilestone.name}". Accommodation refund: ${matchedMilestone.accommodationRefundPercent}% (${(accommodationRefund / 100).toFixed(2)} ${currency}). Cleaning fee refund: ${(cleaningFeeRefund / 100).toFixed(2)} ${currency}. Total calculated refund: ${(totalRefundableAmount / 100).toFixed(2)} ${currency}.`;

  return {
    bookingId,
    currency,
    status,
    isCalculated: true,
    policyUsed: policy.policyId,
    policyVersion: policy.version,
    milestoneApplied: matchedMilestone.name,
    hoursUntilCheckIn: hours,
    isPastCheckIn: false,
    capturedAmount: safeCaptured,
    alreadyRefundedAmount: safeAlreadyRefunded,
    pendingRefundReservedAmount: safePendingReserved,
    remainingRefundableBalance,
    accommodationRefund,
    cleaningFeeRefund,
    serviceFeeRefund,
    taxRefund,
    discretionaryAmount: 0,
    totalRefundableAmount,
    explanation,
    missingRules: [],
  };
}
