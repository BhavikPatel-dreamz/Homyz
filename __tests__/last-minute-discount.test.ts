import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { updateListingSchema } from "../lib/validation/listing";
import { resolveSingleDiscount } from "../services/pricing.service";

describe("Last-minute discount", () => {
  it("is visible at 15% and off by default in Add Discounts", () => {
    const wizard = fs.readFileSync(
      path.join(process.cwd(), "components/host/new-listing-get-started.tsx"),
      "utf8",
    );
    const step = fs.readFileSync(
      path.join(process.cwd(), "components/host/onboarding/step-discounts.tsx"),
      "utf8",
    );

    assert.match(step, /id: "last_minute"/);
    assert.match(step, /percentage: 15/);
    assert.match(wizard, /useState<string\[\]>\(\["new_listing"\]\)/);
  });

  it("accepts and preserves the persisted last-minute percentage configuration", () => {
    const parsed = updateListingSchema.parse({
      discounts: { last_minute: { enabled: true, percentage: 15 } },
    });

    assert.deepEqual(parsed.discounts, {
      last_minute: { enabled: true, percentage: 15 },
    });
  });

  it("uses the documented 15% for a saved last-minute discount", () => {
    const discount = resolveSingleDiscount({
      staySubtotal: 100_000,
      nights: 2,
      checkIn: new Date("2026-10-02T00:00:00.000Z"),
      bookingCreatedAt: new Date("2026-10-01T00:00:00.000Z"),
      discounts: { last_minute: { enabled: true, percentage: 15 } },
    });

    assert.equal(discount?.key, "last_minute");
    assert.equal(discount?.percentage, 15);
    assert.equal(discount?.amount, 15_000);
  });

  it("enforces the existing no-stacking rule against another qualifying discount", () => {
    const discount = resolveSingleDiscount({
      staySubtotal: 100_000,
      nights: 2,
      checkIn: new Date("2026-10-02T00:00:00.000Z"),
      bookingCreatedAt: new Date("2026-10-01T00:00:00.000Z"),
      discounts: {
        new_listing: { enabled: true, percentage: 20 },
        last_minute: { enabled: true, percentage: 15 },
      },
    });

    assert.equal(discount?.key, "new_listing");
    assert.equal(discount?.percentage, 20);
    assert.equal(discount?.amount, 20_000);
  });

  it("restores and edits the saved last-minute configuration", () => {
    const wizard = fs.readFileSync(
      path.join(process.cwd(), "components/host/new-listing-get-started.tsx"),
      "utf8",
    );
    const editor = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx"),
      "utf8",
    );
    const pricingView = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx"),
      "utf8",
    );

    assert.match(wizard, /filter\(\(\[, value\]\) => isDiscountEnabled\(value\)\)/);
    assert.match(editor, /last_minute: \{\s*enabled: lastMinuteEnabled,/);
    assert.match(pricingView, /aria-label="Toggle last-minute discount"/);
  });
});
