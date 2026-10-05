/**
 * HOMYZ — DISCOUNT PRIORITY & WINNING DISCOUNT RESOLVER (PHASE 4)
 *
 * Consumes Phase 3 Discount Eligibility output and determines the single winning discount.
 *
 * Architectural Invariants:
 * 1. ONLY ONE DISCOUNT APPLIES PER STAY (selectedDiscountCount <= 1).
 * 2. Discounts DO NOT stack under any circumstance (isStacked: false).
 * 3. Does NOT recalculate eligibility (consumes Phase 3 evaluation).
 * 4. Deterministic resolution:
 *    - Highest qualifying discount percentage / monetary value wins (HIGHEST_APPLICABLE_DISCOUNT).
 *    - Ties broken deterministically by authoritative project priority:
 *      Monthly (1) > Weekly (2) > Last Minute (3) > New Listing (4) > Early Bird (5) > Custom (6).
 * 5. Ineligible (eligible: false) or disabled discounts can NEVER win.
 * 6. Pure, deterministic, sub-millisecond in-memory function with zero external or database dependencies.
 */

import type {
  DiscountEligibilityItem,
  DiscountEligibilityResult,
} from "./discount-eligibility.service";

export type WinningDiscountType =
  | "NEW_LISTING"
  | "LAST_MINUTE"
  | "WEEKLY"
  | "MONTHLY"
  | "EARLY_BIRD"
  | "CUSTOM_PROMOTION"
  | string;

export const WINNING_DISCOUNT_SELECTION_REASONS = {
  HIGHEST_APPLICABLE_DISCOUNT: "HIGHEST_APPLICABLE_DISCOUNT",
  TIE_BREAKER_PRIORITY: "TIE_BREAKER_PRIORITY",
  NO_ELIGIBLE_DISCOUNT: "NO_ELIGIBLE_DISCOUNT",
  PRIORITY_RULE_NOT_DEFINED: "PRIORITY_RULE_NOT_DEFINED",
} as const;

export type WinningDiscountSelectionReason =
  (typeof WINNING_DISCOUNT_SELECTION_REASONS)[keyof typeof WINNING_DISCOUNT_SELECTION_REASONS];

/**
 * Standard promotional priority order codified across Homyz pricing:
 * Lower number = higher priority when resolving ties between equal discount values.
 */
export const AUTHORITATIVE_DISCOUNT_PRIORITY_ORDER: Record<string, number> = {
  monthly: 1,
  MONTHLY: 1,
  weekly: 2,
  WEEKLY: 2,
  last_minute: 3,
  lastMinute: 3,
  LAST_MINUTE: 3,
  new_listing: 4,
  newListing: 4,
  NEW_LISTING: 4,
  early_bird: 5,
  earlyBird: 5,
  EARLY_BIRD: 5,
  custom_promotion: 6,
  CUSTOM_PROMOTION: 6,
};

export interface WinningDiscountCandidate {
  type: WinningDiscountType;
  key: string;
  name: string;
  percentage: number;
  amount: number;
  eligible: boolean;
  priorityOrder: number;
}

export interface SelectedDiscountQuote {
  type: string;
  label: string;
  percentage: number;
  amount: number;
}

export function getDiscountFriendlyLabel(typeOrKey: string): string {
  const norm = typeOrKey.toUpperCase().replace(/-/g, "_");
  switch (norm) {
    case "NEW_LISTING":
      return "New listing promotion";
    case "LAST_MINUTE":
      return "Last-minute discount";
    case "WEEKLY":
      return "Weekly discount";
    case "MONTHLY":
      return "Monthly discount";
    case "EARLY_BIRD":
      return "Early-bird discount";
    case "CUSTOM_PROMOTION":
      return "Special promotional discount";
    default:
      return "Discount";
  }
}

export interface WinningDiscountSelected {
  type: WinningDiscountType | null;
  key: string | null;
  name: string | null;
  label: string | null;
  percentage: number;
  amount: number;
  selectionReason: WinningDiscountSelectionReason;
}

export interface WinningDiscountResult {
  // Phase 4 Section 3 Output Contract
  type: WinningDiscountType | null;
  percentage: number;
  eligible: boolean;
  selected: boolean;
  selectionReason: WinningDiscountSelectionReason;

  // Direct metadata
  key: string | null;
  name: string | null;
  label: string | null;
  amount: number;

  // Phase 4 Section 12 Detail Contract
  candidates: WinningDiscountCandidate[];
  selectedDiscount: WinningDiscountSelected | null;

  // Invariants
  totalEligibleCount: number;
  isStacked: false;
  tieBreakerApplied?: boolean;
}

export interface ResolveWinningDiscountOptions {
  eligibility?: DiscountEligibilityResult | Record<string, unknown>;
  staySubtotal?: number;
  discounts?: Record<string, unknown> | null;
  candidates?: WinningDiscountCandidate[];
}

/**
 * Normalizes an arbitrary discount key or type name to standard representations.
 */
function normalizeTypeAndKey(rawKey: string): { type: WinningDiscountType; key: string; name: string; priorityOrder: number } {
  const lower = rawKey.toLowerCase();
  if (lower === "monthly") {
    return { type: "MONTHLY", key: "monthly", name: "Monthly Stay Discount", priorityOrder: 1 };
  }
  if (lower === "weekly") {
    return { type: "WEEKLY", key: "weekly", name: "Weekly Stay Discount", priorityOrder: 2 };
  }
  if (lower === "last_minute" || lower === "lastminute") {
    return { type: "LAST_MINUTE", key: "last_minute", name: "Last-Minute Booking Discount", priorityOrder: 3 };
  }
  if (lower === "new_listing" || lower === "newlisting") {
    return { type: "NEW_LISTING", key: "new_listing", name: "New Listing Promotion", priorityOrder: 4 };
  }
  if (lower === "early_bird" || lower === "earlybird") {
    return { type: "EARLY_BIRD", key: "early_bird", name: "Early-Bird Booking Discount", priorityOrder: 5 };
  }
  if (lower === "custom_promotion" || lower === "custompromotion") {
    return { type: "CUSTOM_PROMOTION", key: "custom_promotion", name: "Custom Promotional Discount", priorityOrder: 6 };
  }

  const upper = rawKey.toUpperCase().replace(/-/g, "_");
  const priority = AUTHORITATIVE_DISCOUNT_PRIORITY_ORDER[rawKey] ?? 99;
  return { type: upper, key: rawKey, name: `${rawKey} Discount`, priorityOrder: priority };
}

/**
 * Extracts and filters eligible candidate discounts from Phase 3 eligibility output.
 * Guarantees that disabled or ineligible discounts are discarded.
 */
function extractEligibleCandidates(
  source: unknown,
  staySubtotal: number,
): WinningDiscountCandidate[] {
  if (!source || typeof source !== "object") return [];

  const candidates: WinningDiscountCandidate[] = [];
  const seenKeys = new Set<string>();

  // 1. If Phase 3 eligibleDiscounts array is provided directly:
  const obj = source as Record<string, unknown>;
  if (Array.isArray(obj.eligibleDiscounts)) {
    for (const item of obj.eligibleDiscounts as DiscountEligibilityItem[]) {
      if (!item || item.eligible !== true || item.enabled === false) continue;
      const pct = typeof item.percentage === "number" && Number.isFinite(item.percentage) ? item.percentage : 0;
      if (pct <= 0) continue;

      const norm = normalizeTypeAndKey(String(item.key));
      const amount = staySubtotal > 0 ? Math.round((staySubtotal * pct) / 100) : 0;

      if (!seenKeys.has(norm.key)) {
        seenKeys.add(norm.key);
        candidates.push({
          type: norm.type,
          key: norm.key,
          name: item.name || norm.name,
          percentage: pct,
          amount,
          eligible: true,
          priorityOrder: typeof item.priorityOrder === "number" ? item.priorityOrder : norm.priorityOrder,
        });
      }
    }
    return candidates;
  }

  // 2. If an object with named discount properties is provided (e.g. Phase 4 Section 2 example):
  const standardKeys = [
    { prop: "monthly", def: "monthly" },
    { prop: "weekly", def: "weekly" },
    { prop: "lastMinute", def: "last_minute" },
    { prop: "last_minute", def: "last_minute" },
    { prop: "newListing", def: "new_listing" },
    { prop: "new_listing", def: "new_listing" },
    { prop: "early_bird", def: "early_bird" },
    { prop: "earlyBird", def: "early_bird" },
    { prop: "custom_promotion", def: "custom_promotion" },
  ];

  for (const { prop, def } of standardKeys) {
    const val = obj[prop];
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const item = val as Record<string, unknown>;

    // Discard disabled or ineligible
    if (item.eligible !== true || item.enabled === false) continue;

    const pct = typeof item.percentage === "number" && Number.isFinite(item.percentage) ? item.percentage : 0;
    if (pct <= 0) continue;

    const norm = normalizeTypeAndKey(def);
    if (seenKeys.has(norm.key)) continue;
    seenKeys.add(norm.key);

    const amount = staySubtotal > 0 ? Math.round((staySubtotal * pct) / 100) : 0;
    const priority = typeof item.priorityOrder === "number" ? item.priorityOrder : norm.priorityOrder;

    candidates.push({
      type: norm.type,
      key: norm.key,
      name: typeof item.name === "string" ? item.name : norm.name,
      percentage: pct,
      amount,
      eligible: true,
      priorityOrder: priority,
    });
  }

  return candidates;
}

/**
 * Authoritative Central Discount Priority & Winning Discount Resolver.
 *
 * Implements Phase 4 single winning discount selection:
 * - Accepts Phase 3 output without re-evaluating eligibility.
 * - Compares candidate discount amounts (or percentages).
 * - Enforces deterministic tie resolution.
 * - Guarantees non-stacking (selectedDiscountCount <= 1).
 */
export function resolveWinningDiscount(
  input:
    | DiscountEligibilityResult
    | Record<string, unknown>
    | ResolveWinningDiscountOptions,
  staySubtotalArg?: number,
): WinningDiscountResult {
  // Determine staySubtotal
  let staySubtotal = 0;
  let eligibilitySource: unknown = input;

  if (typeof staySubtotalArg === "number" && Number.isFinite(staySubtotalArg) && staySubtotalArg > 0) {
    staySubtotal = Math.round(staySubtotalArg);
  }

  if (input && typeof input === "object" && !Array.isArray(input)) {
    const opts = input as ResolveWinningDiscountOptions;
    if (opts.staySubtotal && typeof opts.staySubtotal === "number" && opts.staySubtotal > 0) {
      staySubtotal = Math.round(opts.staySubtotal);
    }
    if (opts.eligibility) {
      eligibilitySource = opts.eligibility;
    }
  }

  // Extract eligible candidates from Phase 3 output
  const explicitCandidates = input && typeof input === "object" && !Array.isArray(input)
    ? (input as ResolveWinningDiscountOptions).candidates
    : undefined;
  const candidates = explicitCandidates
    ? explicitCandidates.filter((candidate) => candidate.eligible && candidate.percentage > 0 && candidate.amount > 0).map((candidate) => ({ ...candidate }))
    : extractEligibleCandidates(eligibilitySource, staySubtotal);

  // Case 1: ZERO ELIGIBLE DISCOUNTS (Section 8)
  if (candidates.length === 0) {
    return {
      type: null,
      percentage: 0,
      eligible: false,
      selected: false,
      selectionReason: WINNING_DISCOUNT_SELECTION_REASONS.NO_ELIGIBLE_DISCOUNT,
      key: null,
      name: null,
      label: null,
      amount: 0,
      candidates: [],
      selectedDiscount: null,
      totalEligibleCount: 0,
      isStacked: false,
    };
  }

  // Case 2: EXACTLY ONE ELIGIBLE DISCOUNT (Section 19)
  if (candidates.length === 1) {
    const single = candidates[0];
    const friendlyLabel = getDiscountFriendlyLabel(single.type || single.key);
    const selected: WinningDiscountSelected = {
      type: single.type,
      key: single.key,
      name: single.name,
      label: friendlyLabel,
      percentage: single.percentage,
      amount: single.amount,
      selectionReason: WINNING_DISCOUNT_SELECTION_REASONS.HIGHEST_APPLICABLE_DISCOUNT,
    };

    return {
      type: single.type,
      percentage: single.percentage,
      eligible: true,
      selected: true,
      selectionReason: WINNING_DISCOUNT_SELECTION_REASONS.HIGHEST_APPLICABLE_DISCOUNT,
      key: single.key,
      name: single.name,
      label: friendlyLabel,
      amount: single.amount,
      candidates: [single],
      selectedDiscount: selected,
      totalEligibleCount: 1,
      isStacked: false,
      tieBreakerApplied: false,
    };
  }

  // Case 3: MULTIPLE ELIGIBLE CANDIDATES (Section 20 & 23)
  // Sort deterministically:
  // 1. Primary: Highest discount amount (or percentage if subtotal is zero).
  // 2. Secondary: Deterministic tie breaker using authoritative priority:
  //    Monthly (1) > Weekly (2) > Last Minute (3) > New Listing (4) > Early Bird (5) > Custom (6).
  candidates.sort((a, b) => {
    if (staySubtotal > 0 && b.amount !== a.amount) {
      return b.amount - a.amount;
    }
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    return a.priorityOrder - b.priorityOrder;
  });

  const winner = candidates[0];
  const runnerUp = candidates[1];
  const isTie = winner.percentage === runnerUp.percentage && (staySubtotal <= 0 || winner.amount === runnerUp.amount);
  const friendlyLabel = getDiscountFriendlyLabel(winner.type || winner.key);

  const selectedDiscount: WinningDiscountSelected = {
    type: winner.type,
    key: winner.key,
    name: winner.name,
    label: friendlyLabel,
    percentage: winner.percentage,
    amount: winner.amount,
    selectionReason: WINNING_DISCOUNT_SELECTION_REASONS.HIGHEST_APPLICABLE_DISCOUNT,
  };

  return {
    type: winner.type,
    percentage: winner.percentage,
    eligible: true,
    selected: true,
    selectionReason: WINNING_DISCOUNT_SELECTION_REASONS.HIGHEST_APPLICABLE_DISCOUNT,
    key: winner.key,
    name: winner.name,
    label: friendlyLabel,
    amount: winner.amount,
    candidates,
    selectedDiscount,
    totalEligibleCount: candidates.length,
    isStacked: false,
    tieBreakerApplied: isTie,
  };
}
