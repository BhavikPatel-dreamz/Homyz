import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  DISCOUNT_TYPES,
  DISCOUNT_KEYS,
  DEFAULT_DISCOUNT_PERCENTAGES,
  percentageDiscountSchema,
  updateListingSchema,
  createListingSchema,
} from "../lib/validation/listing";
import {
  calculateBookingPrice,
  resolveSingleDiscount,
} from "../services/pricing.service";

describe("Phase 2 — Host Discount Settings & Validation", () => {
  describe("1. Canonical Configuration & Types", () => {
    it("defines all 4 documented discounts in DISCOUNT_TYPES", () => {
      assert.deepEqual([...DISCOUNT_TYPES], [
        "new_listing",
        "last_minute",
        "weekly",
        "monthly",
      ]);
    });

    it("has documented default percentages for all 4 discounts", () => {
      assert.equal(DEFAULT_DISCOUNT_PERCENTAGES.new_listing, 20);
      assert.equal(DEFAULT_DISCOUNT_PERCENTAGES.last_minute, 15);
      assert.equal(DEFAULT_DISCOUNT_PERCENTAGES.weekly, 10);
      assert.equal(DEFAULT_DISCOUNT_PERCENTAGES.monthly, 25);
    });

    it("has stable keys in DISCOUNT_KEYS without storing UI labels as logic", () => {
      assert.equal(DISCOUNT_KEYS.NEW_LISTING, "new_listing");
      assert.equal(DISCOUNT_KEYS.LAST_MINUTE, "last_minute");
      assert.equal(DISCOUNT_KEYS.WEEKLY, "weekly");
      assert.equal(DISCOUNT_KEYS.MONTHLY, "monthly");
    });
  });

  describe("2. Strict Percentage Validation (Section 10 & 18)", () => {
    it("accepts valid enabled percentage discounts (1 to 100)", () => {
      const valid1 = percentageDiscountSchema.parse({ enabled: true, percentage: 20 });
      assert.deepEqual(valid1, { enabled: true, percentage: 20 });

      const valid2 = percentageDiscountSchema.parse({ enabled: true, percentage: 1 });
      assert.deepEqual(valid2, { enabled: true, percentage: 1 });

      const valid3 = percentageDiscountSchema.parse({ enabled: true, percentage: 100 });
      assert.deepEqual(valid3, { enabled: true, percentage: 100 });
    });

    it("rejects negative percentages when enabled", () => {
      assert.throws(() => {
        percentageDiscountSchema.parse({ enabled: true, percentage: -5 });
      });
    });

    it("rejects zero percentage when enabled (Section 18)", () => {
      assert.throws(() => {
        percentageDiscountSchema.parse({ enabled: true, percentage: 0 });
      });
    });

    it("rejects percentages greater than 100", () => {
      assert.throws(() => {
        percentageDiscountSchema.parse({ enabled: true, percentage: 105 });
      });
    });

    it("rejects NaN, Infinity, and malformed strings", () => {
      assert.throws(() => {
        percentageDiscountSchema.parse({ enabled: true, percentage: NaN });
      });
      assert.throws(() => {
        percentageDiscountSchema.parse({ enabled: true, percentage: Infinity });
      });
      assert.throws(() => {
        percentageDiscountSchema.parse({ enabled: true, percentage: "20" as any });
      });
    });

    it("rejects null or undefined percentage when enabled: true", () => {
      assert.throws(() => {
        percentageDiscountSchema.parse({ enabled: true, percentage: null });
      });
      assert.throws(() => {
        percentageDiscountSchema.parse({ enabled: true });
      });
    });

    it("preserves saved percentage when toggled off (Section 12)", () => {
      const disabledWithPercentage = percentageDiscountSchema.parse({
        enabled: false,
        percentage: 10,
      });
      assert.deepEqual(disabledWithPercentage, { enabled: false, percentage: 10 });
    });

    it("allows null or omitted percentage when toggled off", () => {
      const disabledNull = percentageDiscountSchema.parse({
        enabled: false,
        percentage: null,
      });
      assert.equal(disabledNull.enabled, false);
      assert.equal(disabledNull.percentage, null);

      const disabledOmitted = percentageDiscountSchema.parse({
        enabled: false,
      });
      assert.equal(disabledOmitted.enabled, false);
    });
  });

  describe("3. Listing Validation Schemas (Create & Update)", () => {
    it("accepts canonical discounts object in updateListingSchema", () => {
      const parsed = updateListingSchema.parse({
        discounts: {
          new_listing: { enabled: true, percentage: 20 },
          last_minute: { enabled: false, percentage: 15 },
          weekly: { enabled: true, percentage: 10 },
          monthly: { enabled: false, percentage: 25 },
        },
      });

      assert.deepEqual(parsed.discounts, {
        new_listing: { enabled: true, percentage: 20 },
        last_minute: { enabled: false, percentage: 15 },
        weekly: { enabled: true, percentage: 10 },
        monthly: { enabled: false, percentage: 25 },
      });
    });

    it("accepts camelCase aliases (newListing, lastMinute) in updateListingSchema", () => {
      const parsed = updateListingSchema.parse({
        discounts: {
          newListing: { enabled: true, percentage: 20 },
          lastMinute: { enabled: false, percentage: 15 },
          weekly: { enabled: true, percentage: 10 },
          monthly: { enabled: false, percentage: 25 },
        },
      });

      const discounts = parsed.discounts as Record<string, any>;
      assert.equal(discounts?.newListing?.enabled, true);
      assert.equal(discounts?.lastMinute?.enabled, false);
    });

    it("preserves backward compatibility for legacy boolean discount values", () => {
      const parsed = updateListingSchema.parse({
        discounts: {
          weekly: true,
          monthly: false,
        },
      });

      const discounts = parsed.discounts as Record<string, any>;
      assert.equal(discounts?.weekly, true);
      assert.equal(discounts?.monthly, false);
    });
  });

  describe("4. Pricing Engine Integration (Disabled & Single Discount Rule)", () => {
    it("does NOT apply discount when enabled: false, even if percentage is stored (Section 11)", () => {
      const discount = resolveSingleDiscount({
        staySubtotal: 100_000,
        nights: 7,
        checkIn: new Date("2026-10-10T00:00:00.000Z"),
        discounts: {
          weekly: { enabled: false, percentage: 10 },
        },
      });

      assert.equal(discount, null);
    });

    it("applies weekly discount (10%) when enabled: true for 7+ nights", () => {
      const discount = resolveSingleDiscount({
        staySubtotal: 70_000,
        nights: 7,
        checkIn: new Date("2026-10-10T00:00:00.000Z"),
        discounts: {
          weekly: { enabled: true, percentage: 10 },
        },
      });

      assert.ok(discount);
      assert.equal(discount.key, "weekly");
      assert.equal(discount.percentage, 10);
      assert.equal(discount.amount, 7_000);
    });

    it("applies monthly discount (25%) when enabled: true for 28+ nights without stacking", () => {
      const discount = resolveSingleDiscount({
        staySubtotal: 280_000,
        nights: 28,
        checkIn: new Date("2026-10-10T00:00:00.000Z"),
        discounts: {
          weekly: { enabled: true, percentage: 10 },
          monthly: { enabled: true, percentage: 25 },
        },
      });

      assert.ok(discount);
      // Monthly takes priority over weekly
      assert.equal(discount.key, "monthly");
      assert.equal(discount.percentage, 25);
      assert.equal(discount.amount, 70_000);
    });

    it("does NOT automatically apply new listing promotion if explicitly disabled (Section 4 & 11)", () => {
      const discount = resolveSingleDiscount({
        staySubtotal: 100_000,
        nights: 3,
        checkIn: new Date("2026-10-10T00:00:00.000Z"),
        isNewListing: true,
        discounts: {
          new_listing: { enabled: false, percentage: 20 },
        },
      });

      assert.equal(discount, null);
    });

    it("enforces single discount rule across all 4 discounts (strictly NO stacking)", async () => {
      const result = await calculateBookingPrice({
        baseNightlyPrice: 100_00, // 100 SAR
        checkIn: "2026-10-02",
        checkOut: "2026-10-10", // 8 nights
        discounts: {
          new_listing: { enabled: true, percentage: 20 },
          weekly: { enabled: true, percentage: 10 },
          last_minute: { enabled: true, percentage: 15 },
        },
      });

      // Exactly ONE discount applied (highest qualifying single discount: 20% > 10%)
      assert.equal(result.nights, 8);
      assert.ok(result.appliedDiscount);
      assert.equal(result.appliedDiscount.key, "new_listing");
      assert.equal(result.appliedDiscount.percentage, 20);
      assert.equal(result.discountAmount, 160_00); // 20% of 800 SAR = 160 SAR
      assert.equal(result.discountedAccommodationSubtotal, 640_00);
    });
  });

  describe("5. Code Integrity & Consistency Audits", () => {
    it("onboarding step-discounts.tsx contains all 4 documented discounts with defaults", () => {
      const stepContent = fs.readFileSync(
        path.join(process.cwd(), "components/host/onboarding/step-discounts.tsx"),
        "utf8",
      );

      assert.match(stepContent, /id:\s*"new_listing"/);
      assert.match(stepContent, /percentage:\s*20/);
      assert.match(stepContent, /id:\s*"last_minute"/);
      assert.match(stepContent, /percentage:\s*15/);
      assert.match(stepContent, /id:\s*"weekly"/);
      assert.match(stepContent, /percentage:\s*10/);
      assert.match(stepContent, /id:\s*"monthly"/);
      assert.match(stepContent, /percentage:\s*25/);
    });

    it("new-listing-get-started.tsx persists canonical { enabled, percentage } discounts", () => {
      const wizardContent = fs.readFileSync(
        path.join(process.cwd(), "components/host/new-listing-get-started.tsx"),
        "utf8",
      );

      assert.match(wizardContent, /new_listing:\s*\{\s*enabled:/);
      assert.match(wizardContent, /last_minute:\s*\{\s*enabled:/);
      assert.match(wizardContent, /weekly:\s*\{\s*enabled:/);
      assert.match(wizardContent, /monthly:\s*\{\s*enabled:/);
      assert.match(wizardContent, /filter\(\(\[, value\]\) => isDiscountEnabled\(value\)\)/);
    });

    it("PricingAndBookingViews.tsx renders all 4 discount cards with switch toggles and Section 28 helper text", () => {
      const pricingViewContent = fs.readFileSync(
        path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx"),
        "utf8",
      );

      assert.match(pricingViewContent, /aria-label="Toggle new listing promotion"/);
      assert.match(pricingViewContent, /aria-label="Toggle last-minute discount"/);
      assert.match(pricingViewContent, /aria-label="Toggle weekly discount"/);
      assert.match(pricingViewContent, /aria-label="Toggle monthly discount"/);
      assert.match(pricingViewContent, /Only one discount can apply to a reservation/);
      assert.match(pricingViewContent, /dark:border-zinc-700/);
      assert.match(pricingViewContent, /dark:bg-zinc-800/);
    });

    it("host-listing-editor-client.tsx saves canonical discounts and invalidates quote cache", () => {
      const editorContent = fs.readFileSync(
        path.join(process.cwd(), "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx"),
        "utf8",
      );

      assert.match(editorContent, /last_minute:\s*\{\s*enabled:\s*lastMinuteEnabled,/);
      assert.match(editorContent, /new_listing:\s*\{\s*enabled:\s*newListingEnabled,/);
      assert.match(editorContent, /weekly:\s*\{\s*enabled:\s*weeklyEnabled,/);
      assert.match(editorContent, /monthly:\s*\{\s*enabled:\s*monthlyEnabled,/);
      assert.match(editorContent, /clearBookingQuote\(listing\.id\)/);
    });
  });
});
