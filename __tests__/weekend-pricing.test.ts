import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clampWeekendPremium, computeWeekendPrice, deriveWeekendPremium } from "@/lib/utils/listing-pricing";

describe("weekend pricing helpers", () => {
  it("increments a weekend premium by 1% and clamps to boundaries", () => {
    assert.equal(clampWeekendPremium(0), 0);
    assert.equal(clampWeekendPremium(99), 99);
    assert.equal(clampWeekendPremium(150), 100);
    assert.equal(clampWeekendPremium(-5), 0);
  });

  it("derives the weekend nightly price from the base price and a premium percentage", () => {
    assert.equal(computeWeekendPrice(10000, 15), 11500);
    assert.equal(computeWeekendPrice(10000, 0), 10000);
  });

  it("derives a premium percentage back from a stored weekend price", () => {
    assert.equal(deriveWeekendPremium(10000, 11500), 15);
    assert.equal(deriveWeekendPremium(10000, 10000), 0);
  });
});
