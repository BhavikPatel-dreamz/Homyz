import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveWinningDiscount,
  WINNING_DISCOUNT_SELECTION_REASONS,
  AUTHORITATIVE_DISCOUNT_PRIORITY_ORDER,
  type WinningDiscountResult,
} from "../services/discount-priority.service";
import {
  evaluateDiscountEligibility,
  calculateBookingPrice,
  resolveSingleDiscount,
} from "../services/pricing.service";

describe("Phase 4 — Discount Priority & Winning Discount Resolver", () => {
  // -------------------------------------------------------------------------
  // 1. One Eligible Discount (Section 19)
  // -------------------------------------------------------------------------
  describe("1. One Eligible Discount (Section 19)", () => {
    it("selects Weekly discount when it is the sole eligible discount", () => {
      const eligibilityInput = {
        weekly: { eligible: true, percentage: 10, enabled: true },
        monthly: { eligible: false, percentage: 25, enabled: true },
        lastMinute: { eligible: false, percentage: 15, enabled: true },
        newListing: { eligible: false, percentage: 20, enabled: true },
      };

      const result = resolveWinningDiscount(eligibilityInput, 70_000);

      assert.equal(result.selected, true);
      assert.equal(result.type, "WEEKLY");
      assert.equal(result.key, "weekly");
      assert.equal(result.percentage, 10);
      assert.equal(result.amount, 7_000);
      assert.equal(result.selectionReason, WINNING_DISCOUNT_SELECTION_REASONS.HIGHEST_APPLICABLE_DISCOUNT);
      assert.equal(result.totalEligibleCount, 1);
      assert.equal(result.isStacked, false);
      assert.ok(result.selectedDiscount);
      assert.equal(result.selectedDiscount.type, "WEEKLY");
      assert.equal(result.selectedDiscount.percentage, 10);
      assert.equal(result.selectedDiscount.amount, 7_000);
    });

    it("selects New Listing promotion when it is the sole eligible discount", () => {
      const eligibilityInput = {
        newListing: { eligible: true, percentage: 20, enabled: true },
        lastMinute: { eligible: false, percentage: null, enabled: false },
        weekly: { eligible: false, percentage: null, enabled: false },
        monthly: { eligible: false, percentage: null, enabled: false },
      };

      const result = resolveWinningDiscount(eligibilityInput, 50_000);

      assert.equal(result.selected, true);
      assert.equal(result.type, "NEW_LISTING");
      assert.equal(result.percentage, 20);
      assert.equal(result.amount, 10_000);
      assert.equal(result.totalEligibleCount, 1);
      assert.equal(result.isStacked, false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Multiple Eligible Discounts & Strictly NO Stacking (Section 7, 20)
  // -------------------------------------------------------------------------
  describe("2. Multiple Eligible Discounts & Non-Stacking (Section 7, 20)", () => {
    it("selects the single highest percentage discount without stacking", () => {
      // New Listing (20%), Last Minute (15%), Weekly (10%) are all eligible
      const eligibilityInput = {
        newListing: { eligible: true, percentage: 20, enabled: true },
        lastMinute: { eligible: true, percentage: 15, enabled: true },
        weekly: { eligible: true, percentage: 10, enabled: true },
        monthly: { eligible: false, percentage: 25, enabled: true },
      };

      const staySubtotal = 100_000;
      const result = resolveWinningDiscount(eligibilityInput, staySubtotal);

      // Invariant: selectedDiscountCount <= 1
      assert.equal(result.selected, true);
      assert.equal(result.type, "NEW_LISTING", "Highest qualifying rate (20%) must win");
      assert.equal(result.percentage, 20);
      assert.equal(result.amount, 20_000);
      assert.equal(result.selectionReason, WINNING_DISCOUNT_SELECTION_REASONS.HIGHEST_APPLICABLE_DISCOUNT);

      // Non-stacking invariant: total eligible is 3, but selected is strictly 1
      assert.equal(result.totalEligibleCount, 3);
      assert.equal(result.isStacked, false);
      assert.notEqual(result.percentage, 45, "Must NOT stack 20% + 15% + 10% into 45%");
      assert.notEqual(result.amount, 45_000);

      // Phase 3 detail preserved in candidates
      assert.equal(result.candidates.length, 3);
    });

    it("selects Monthly discount when Monthly has highest percentage", () => {
      // Monthly (25%), Weekly (10%), New Listing (20%)
      const eligibilityInput = {
        monthly: { eligible: true, percentage: 25, enabled: true },
        weekly: { eligible: true, percentage: 10, enabled: true },
        newListing: { eligible: true, percentage: 20, enabled: true },
      };

      const result = resolveWinningDiscount(eligibilityInput, 200_000);

      assert.equal(result.selected, true);
      assert.equal(result.type, "MONTHLY");
      assert.equal(result.percentage, 25);
      assert.equal(result.amount, 50_000);
      assert.equal(result.totalEligibleCount, 3);
      assert.equal(result.isStacked, false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. None Eligible (Section 8, 21)
  // -------------------------------------------------------------------------
  describe("3. Zero Eligible Discounts (Section 8, 21)", () => {
    it("returns null selection and zero discount when no discounts qualify", () => {
      const eligibilityInput = {
        monthly: { eligible: false, percentage: 25, enabled: true },
        weekly: { eligible: false, percentage: 10, enabled: true },
        lastMinute: { eligible: false, percentage: 15, enabled: true },
        newListing: { eligible: false, percentage: 20, enabled: true },
      };

      const result = resolveWinningDiscount(eligibilityInput, 50_000);

      assert.equal(result.selected, false);
      assert.equal(result.eligible, false);
      assert.equal(result.type, null);
      assert.equal(result.key, null);
      assert.equal(result.name, null);
      assert.equal(result.percentage, 0);
      assert.equal(result.amount, 0);
      assert.equal(result.selectionReason, WINNING_DISCOUNT_SELECTION_REASONS.NO_ELIGIBLE_DISCOUNT);
      assert.equal(result.selectedDiscount, null);
      assert.equal(result.candidates.length, 0);
      assert.equal(result.totalEligibleCount, 0);
      assert.equal(result.isStacked, false);
    });

    it("handles empty or missing eligibility gracefully", () => {
      const result = resolveWinningDiscount({}, 50_000);

      assert.equal(result.selected, false);
      assert.equal(result.percentage, 0);
      assert.equal(result.amount, 0);
      assert.equal(result.selectionReason, WINNING_DISCOUNT_SELECTION_REASONS.NO_ELIGIBLE_DISCOUNT);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Disabled Discounts (Section 9, 22)
  // -------------------------------------------------------------------------
  describe("4. Disabled Discounts Never Win (Section 9, 22)", () => {
    it("ensures a disabled discount with a higher percentage never wins over an eligible one", () => {
      // Monthly is 30% but disabled (enabled: false, eligible: false)
      // Weekly is 10% and eligible
      const eligibilityInput = {
        monthly: { eligible: false, percentage: 30, enabled: false },
        weekly: { eligible: true, percentage: 10, enabled: true },
      };

      const result = resolveWinningDiscount(eligibilityInput, 100_000);

      assert.equal(result.selected, true);
      assert.equal(result.type, "WEEKLY", "Weekly must win because Monthly is disabled");
      assert.equal(result.percentage, 10);
      assert.equal(result.amount, 10_000);
      assert.equal(result.totalEligibleCount, 1);
    });

    it("ignores disabled discounts even if mistakenly marked eligible: true", () => {
      const eligibilityInput = {
        monthly: { eligible: true, percentage: 30, enabled: false },
        weekly: { eligible: true, percentage: 10, enabled: true },
      };

      const result = resolveWinningDiscount(eligibilityInput, 100_000);

      assert.equal(result.selected, true);
      assert.equal(result.type, "WEEKLY");
      assert.equal(result.percentage, 10);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Deterministic Tie Breaking (Section 11, 23)
  // -------------------------------------------------------------------------
  describe("5. Deterministic Tie Resolution (Section 11, 23)", () => {
    it("breaks tie between Weekly (15%) and Last-Minute (15%) using authoritative priority (Weekly > Last Minute)", () => {
      const eligibilityInput = {
        weekly: { eligible: true, percentage: 15, enabled: true },
        lastMinute: { eligible: true, percentage: 15, enabled: true },
      };

      const result = resolveWinningDiscount(eligibilityInput, 100_000);

      assert.equal(result.selected, true);
      assert.equal(result.type, "WEEKLY", "Weekly (priorityOrder: 2) must win over Last-Minute (priorityOrder: 3)");
      assert.equal(result.percentage, 15);
      assert.equal(result.tieBreakerApplied, true);
    });

    it("breaks tie between Monthly (20%) and Weekly (20%) using authoritative priority (Monthly > Weekly)", () => {
      const eligibilityInput = {
        monthly: { eligible: true, percentage: 20, enabled: true },
        weekly: { eligible: true, percentage: 20, enabled: true },
      };

      const result = resolveWinningDiscount(eligibilityInput, 100_000);

      assert.equal(result.selected, true);
      assert.equal(result.type, "MONTHLY", "Monthly (priorityOrder: 1) must win over Weekly (priorityOrder: 2)");
      assert.equal(result.percentage, 20);
      assert.equal(result.tieBreakerApplied, true);
    });

    it("breaks tie between Last-Minute (20%) and New Listing (20%) using authoritative priority (Last-Minute > New Listing)", () => {
      const eligibilityInput = {
        lastMinute: { eligible: true, percentage: 20, enabled: true },
        newListing: { eligible: true, percentage: 20, enabled: true },
      };

      const result = resolveWinningDiscount(eligibilityInput, 50_000);

      assert.equal(result.selected, true);
      assert.equal(result.type, "LAST_MINUTE", "Last-Minute (priorityOrder: 3) must win over New Listing (priorityOrder: 4)");
      assert.equal(result.percentage, 20);
      assert.equal(result.tieBreakerApplied, true);
    });

    it("produces identical results regardless of candidate input key order", () => {
      const orderA = {
        lastMinute: { eligible: true, percentage: 15, enabled: true },
        weekly: { eligible: true, percentage: 15, enabled: true },
      };
      const orderB = {
        weekly: { eligible: true, percentage: 15, enabled: true },
        lastMinute: { eligible: true, percentage: 15, enabled: true },
      };

      const resultA = resolveWinningDiscount(orderA, 100_000);
      const resultB = resolveWinningDiscount(orderB, 100_000);

      assert.equal(resultA.type, resultB.type);
      assert.equal(resultA.percentage, resultB.percentage);
      assert.equal(resultA.amount, resultB.amount);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Direct Consumption of Phase 3 Output (Section 2, 12)
  // -------------------------------------------------------------------------
  describe("6. Phase 3 Output Consumption (Section 2, 12)", () => {
    it("consumes evaluateDiscountEligibility return value directly without re-evaluation", () => {
      // 7 nights booking created 1 day before checkin on a new listing
      const eligibility = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-17",
        bookingDate: "2026-10-09",
        isNewListing: true,
        discounts: {
          weekly: { enabled: true, percentage: 10 },
          last_minute: { enabled: true, percentage: 15 },
          new_listing: { enabled: true, percentage: 20 },
        },
      });

      // Phase 3 returned 3 eligible discounts
      assert.equal(eligibility.eligibleDiscounts.length, 3);

      // Phase 4 consumes Phase 3 output
      const result = resolveWinningDiscount(eligibility, 70_000);

      assert.equal(result.selected, true);
      assert.equal(result.type, "NEW_LISTING", "New Listing 20% > Last-Minute 15% > Weekly 10%");
      assert.equal(result.percentage, 20);
      assert.equal(result.amount, 14_000);
      assert.equal(result.totalEligibleCount, 3);
      assert.equal(result.isStacked, false);

      // Candidates retain Phase 3 metadata
      assert.equal(result.candidates.length, 3);
      const keys = result.candidates.map((c) => c.key);
      assert.ok(keys.includes("new_listing"));
      assert.ok(keys.includes("last_minute"));
      assert.ok(keys.includes("weekly"));
    });
  });

  // -------------------------------------------------------------------------
  // 7. Client / Server Parity (Section 14, 24)
  // -------------------------------------------------------------------------
  describe("7. Client / Server Parity (Section 14, 24)", () => {
    it("produces identical winning discount on pure in-memory client call vs server quote calculator", async () => {
      const staySubtotal = 100_000;
      const discounts = {
        weekly: { enabled: true, percentage: 10 },
        monthly: { enabled: true, percentage: 25 },
        new_listing: { enabled: true, percentage: 20 },
      };

      // Server execution via calculateBookingPrice:
      const serverResult = await calculateBookingPrice({
        checkIn: "2026-10-01",
        checkOut: "2026-10-31", // 30 nights -> Monthly qualifies
        weekdayBasePrice: 100_000 / 30,
        discounts,
        hostServiceFeePercentage: 15,
      });

      // Client simulation via evaluateDiscountEligibility + resolveWinningDiscount:
      const clientEligibility = evaluateDiscountEligibility({
        checkIn: "2026-10-01",
        checkOut: "2026-10-31",
        discounts,
      });
      const clientWinner = resolveWinningDiscount(clientEligibility, serverResult.staySubtotal);

      // Strict parity check: 0 mismatches
      assert.equal(clientWinner.selected, true);
      assert.equal(clientWinner.key, serverResult.appliedDiscount?.key);
      assert.equal(clientWinner.percentage, serverResult.appliedDiscount?.percentage);
      assert.equal(clientWinner.amount, serverResult.appliedDiscount?.amount);
      assert.equal(clientWinner.selectionReason, WINNING_DISCOUNT_SELECTION_REASONS.HIGHEST_APPLICABLE_DISCOUNT);
      assert.equal(serverResult.winningDiscount?.type, clientWinner.type);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Central Pricing Engine Integration (Section 13, 25)
  // -------------------------------------------------------------------------
  describe("8. Central Pricing Integration (Section 13, 25)", () => {
    it("calculateBookingPrice returns winningDiscount and appliedDiscount in full alignment", async () => {
      const res = await calculateBookingPrice({
        checkIn: "2026-10-05",
        checkOut: "2026-10-12", // 7 nights -> Weekly qualifies
        weekdayBasePrice: 10_000,
        discounts: {
          weekly: { enabled: true, percentage: 12 },
          monthly: { enabled: true, percentage: 25 }, // stay too short
        },
        hostServiceFeePercentage: 15,
      });

      assert.ok(res.appliedDiscount);
      assert.ok(res.winningDiscount);
      assert.equal(res.appliedDiscount.key, "weekly");
      assert.equal(res.winningDiscount.type, "WEEKLY");
      assert.equal(res.winningDiscount.percentage, 12);
      assert.equal(res.appliedDiscount.percentage, 12);
      assert.equal(res.winningDiscount.amount, res.appliedDiscount.amount);
      assert.equal(res.winningDiscount.isStacked, false);
      assert.equal(res.winningDiscount.totalEligibleCount, 1);
    });

    it("resolveSingleDiscount delegates directly to resolveWinningDiscount", () => {
      const discount = resolveSingleDiscount({
        staySubtotal: 80_000,
        nights: 7,
        checkIn: new Date("2026-10-01T00:00:00.000Z"),
        discounts: {
          weekly: { enabled: true, percentage: 10 },
        },
      });

      assert.ok(discount);
      assert.equal(discount.key, "weekly");
      assert.equal(discount.percentage, 10);
      assert.equal(discount.amount, 8_000);
    });
  });
});

