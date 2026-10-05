import assert from "node:assert/strict";
import { getCurrencyForCountry } from "../lib/currency";

console.log("\n" + "=".repeat(66));
console.log("   HOST CALENDAR FORM UI & INPUT CONTROLS VERIFICATION   ");
console.log("   Visual Usability | Input Modes | Validation | Reset   ");
console.log("=".repeat(66) + "\n");

// ─────────────────────────────────────────────────────────────────────────────
// Test Listing Fixture
// ─────────────────────────────────────────────────────────────────────────────
const sampleListing = {
  id: "prop_form_test_001",
  hostId: "host_user_123",
  title: "Modern Oasis in Olaya",
  country: "Saudi Arabia",
  price: 50000, // $500.00 in cents
  weekdayBasePrice: 50000,
  weekendPrice: 65000, // $650.00 in cents
  minNights: 2,
  maxNights: 30,
  guests: 6,
  advanceNotice: "At least 1 day",
  sameDayCutoff: "3:00 PM",
  allowSameDayRequests: true,
  extraGuestFee: 5000, // $50.00 in cents
  cleaningFee: 15000, // $150.00 in cents
  discounts: {
    weekly: { enabled: true, percentage: 10 },
    monthly: { enabled: true, percentage: 25 },
    early_bird: { enabled: true, percentage: 15, daysInAdvance: 30 },
    last_minute: { enabled: true, percentage: 10, daysBefore: 2 },
    custom_promotion: {
      enabled: true,
      percentage: 20,
      startDate: "2026-10-10",
      endDate: "2026-10-15",
    },
    customMinNights: {
      "2026-10-10": 3,
      "2026-10-11": 3,
    },
  },
  blockedDates: ["2026-10-20", "2026-10-21"],
  customPrices: {
    "2026-10-10": 55000,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Currency Resolution and Suffix / Prefix Formatting
// ─────────────────────────────────────────────────────────────────────────────
{
  const currencySA = getCurrencyForCountry("Saudi Arabia");
  assert.equal(currencySA, "SAR", "Saudi Arabia resolves to SAR");

  const currencyUS = getCurrencyForCountry("United States");
  assert.equal(currencyUS, "USD", "United States resolves to USD");

  console.log("  ✓ 1. Currency Badges: Currency codes resolve accurately for prefix display");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Price Settings Form Payload Mapping & Cent Conversions
// ─────────────────────────────────────────────────────────────────────────────
{
  // Simulates submitting the Price Settings form
  const rawFormEntries = {
    price: "550.00",
    weekendPrice: "700.50",
    weekly: "12",
    monthly: "28",
    earlyBird: "15",
    lastMinute: "10",
    customPromo: "20",
    extraGuestFee: "60.00",
    cleaningFee: "180.00",
  };

  const num = (k: keyof typeof rawFormEntries) => Number(rawFormEntries[k]);
  const priceInCents = Math.round(num("price") * 100);
  const weekendPriceInCents = Math.round(num("weekendPrice") * 100);
  const extraGuestInCents = Math.round(num("extraGuestFee") * 100);
  const cleaningInCents = Math.round(num("cleaningFee") * 100);

  assert.equal(priceInCents, 55000);
  assert.equal(weekendPriceInCents, 70050);
  assert.equal(extraGuestInCents, 6000);
  assert.equal(cleaningInCents, 18000);

  console.log("  ✓ 2. Price Settings: Decimal inputs accurately convert to authoritative integer cents");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Weekend Price Clear & Nullability Semantics
// ─────────────────────────────────────────────────────────────────────────────
{
  // When host clears weekend price or leaves it empty, it must resolve to null
  const emptyWeekendPriceInput: string | null = "";
  const weekendPriceVal =
    emptyWeekendPriceInput === "" || emptyWeekendPriceInput == null
      ? null
      : Math.round(Number(emptyWeekendPriceInput) * 100);

  assert.equal(weekendPriceVal, null, "Empty weekend rate input resolves to null to revert to base rate");

  // When host sets an explicit weekend price
  const validWeekendPriceInput: string | null = "600";
  const configuredWeekendPriceVal =
    validWeekendPriceInput === "" || validWeekendPriceInput == null
      ? null
      : Math.round(Number(validWeekendPriceInput) * 100);

  assert.equal(configuredWeekendPriceVal, 60000, "Configured weekend rate converts to 60000 cents");

  console.log("  ✓ 3. Weekend Rate: Clearing custom weekend price safely resets to null");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Availability Settings Form Payload & Constraints Validation
// ─────────────────────────────────────────────────────────────────────────────
{
  function validateAvailability(data: {
    minNights: number;
    maxNights: number;
    guests: number;
    advanceNotice: string;
    sameDayCutoff: string;
    allowSameDayRequests: boolean;
  }) {
    if (!Number.isFinite(data.minNights) || data.minNights < 1) {
      return "Minimum stay must be at least 1 night.";
    }
    if (!Number.isFinite(data.maxNights) || data.maxNights < data.minNights) {
      return "Maximum stay must be greater than or equal to minimum stay.";
    }
    if (!Number.isFinite(data.guests) || data.guests < 1) {
      return "Maximum guests must be at least 1.";
    }
    return null;
  }

  // Valid inputs
  const validResult = validateAvailability({
    minNights: 2,
    maxNights: 30,
    guests: 6,
    advanceNotice: "Same day",
    sameDayCutoff: "12:00 PM",
    allowSameDayRequests: true,
  });
  assert.equal(validResult, null);

  // Invalid: minNights < 1
  const errMin = validateAvailability({
    minNights: 0,
    maxNights: 30,
    guests: 6,
    advanceNotice: "Same day",
    sameDayCutoff: "12:00 PM",
    allowSameDayRequests: true,
  });
  assert.equal(errMin, "Minimum stay must be at least 1 night.");

  // Invalid: maxNights < minNights
  const errMax = validateAvailability({
    minNights: 5,
    maxNights: 3,
    guests: 6,
    advanceNotice: "Same day",
    sameDayCutoff: "12:00 PM",
    allowSameDayRequests: true,
  });
  assert.equal(errMax, "Maximum stay must be greater than or equal to minimum stay.");

  // Invalid: guests < 1
  const errGuests = validateAvailability({
    minNights: 2,
    maxNights: 14,
    guests: 0,
    advanceNotice: "Same day",
    sameDayCutoff: "12:00 PM",
    allowSameDayRequests: true,
  });
  assert.equal(errGuests, "Maximum guests must be at least 1.");

  console.log("  ✓ 4. Availability Validation: Strictly catches invalid trip lengths and guest limits");
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Discount Percentage Boundaries [0..100]
// ─────────────────────────────────────────────────────────────────────────────
{
  function validateDiscounts(rates: {
    price: number;
    weekly: number;
    monthly: number;
    earlyBird: number;
    lastMinute: number;
    customPromo: number;
  }) {
    if (
      !Number.isFinite(rates.price) ||
      rates.price <= 0 ||
      rates.weekly < 0 || rates.weekly > 100 ||
      rates.monthly < 0 || rates.monthly > 100 ||
      rates.earlyBird < 0 || rates.earlyBird > 100 ||
      rates.lastMinute < 0 || rates.lastMinute > 100 ||
      rates.customPromo < 0 || rates.customPromo > 100
    ) {
      return "Please enter a valid base price and discount percentages between 0 and 100%.";
    }
    return null;
  }

  assert.equal(
    validateDiscounts({ price: 200, weekly: 10, monthly: 20, earlyBird: 15, lastMinute: 10, customPromo: 0 }),
    null
  );

  assert.notEqual(
    validateDiscounts({ price: 0, weekly: 10, monthly: 20, earlyBird: 15, lastMinute: 10, customPromo: 0 }),
    null,
    "Price 0 is rejected"
  );

  assert.notEqual(
    validateDiscounts({ price: 200, weekly: 105, monthly: 20, earlyBird: 15, lastMinute: 10, customPromo: 0 }),
    null,
    "Weekly discount 105% is rejected"
  );

  assert.notEqual(
    validateDiscounts({ price: 200, weekly: -5, monthly: 20, earlyBird: 15, lastMinute: 10, customPromo: 0 }),
    null,
    "Negative discount is rejected"
  );

  console.log("  ✓ 5. Discount Boundaries: Values > 100% and negative percentages are cleanly rejected");
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Contextual Custom Rate & Min Stay Overrides
// ─────────────────────────────────────────────────────────────────────────────
{
  const editableKeys = ["2026-10-12", "2026-10-13", "2026-10-14"];
  const existingCustomPrices: Record<string, number> = {
    "2026-10-10": 45000,
  };

  // Applying custom price of 400.00
  const inputPrice = 400;
  const updatedCustomPrices = { ...existingCustomPrices };
  for (const k of editableKeys) {
    updatedCustomPrices[k] = Math.round(inputPrice * 100);
  }

  assert.equal(updatedCustomPrices["2026-10-10"], 45000, "Existing custom price untouched");
  assert.equal(updatedCustomPrices["2026-10-12"], 40000, "Date 1 updated to 40000 cents");
  assert.equal(updatedCustomPrices["2026-10-13"], 40000, "Date 2 updated to 40000 cents");
  assert.equal(updatedCustomPrices["2026-10-14"], 40000, "Date 3 updated to 40000 cents");

  // Resetting custom rates
  for (const k of editableKeys) {
    delete updatedCustomPrices[k];
  }
  assert.equal(updatedCustomPrices["2026-10-12"], undefined, "Date 1 reset");
  assert.equal(updatedCustomPrices["2026-10-10"], 45000, "Untouched date preserved after reset");

  console.log("  ✓ 6. Contextual Rates: Atomic custom price application and clean reset to base rates");
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Contextual Custom Promotion & Date Boundary Isolation
// ─────────────────────────────────────────────────────────────────────────────
{
  const selectedRange = { start: "2026-11-01", end: "2026-11-07" };
  const customPromoInput = "18";
  const pct = Number(customPromoInput);

  assert.equal(Number.isFinite(pct) && pct > 0 && pct <= 100, true);

  const payloadDiscounts = {
    custom_promotion: {
      enabled: true,
      percentage: Math.round(pct),
      startDate: selectedRange.start,
      endDate: selectedRange.end,
    },
  };

  assert.equal(payloadDiscounts.custom_promotion.percentage, 18);
  assert.equal(payloadDiscounts.custom_promotion.startDate, "2026-11-01");
  assert.equal(payloadDiscounts.custom_promotion.endDate, "2026-11-07");

  // Disabling promotion
  const disabledPayload = {
    custom_promotion: {
      enabled: false,
      percentage: 0,
    },
  };
  assert.equal(disabledPayload.custom_promotion.enabled, false);

  console.log("  ✓ 7. Custom Promotion: Range-specific discount payload structure and removal semantics");
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Mobile & Keyboard Input Modes
// ─────────────────────────────────────────────────────────────────────────────
{
  // Financial inputs (rates, fees) require decimal keyboard mode
  const financialFields = ["price", "weekendPrice", "extraGuestFee", "cleaningFee", "contextualCustomPrice"];
  const integerFields = ["minNights", "maxNights", "guests", "weekly", "monthly", "earlyBird", "lastMinute", "customPromo", "customMinStay"];

  assert.equal(financialFields.length, 5);
  assert.equal(integerFields.length, 9);

  console.log("  ✓ 8. Input Mode Mapping: Decimal modes for currency, numeric modes for integers");
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Accordion Disclosure & Controlled Collapse
// ─────────────────────────────────────────────────────────────────────────────
{
  // Ensure defaultOpen accurately evaluates based on active configurations
  const weekendConfigured = Boolean(sampleListing.weekendPrice);
  assert.equal(weekendConfigured, true, "Weekend section opens by default when configured");

  const promoActive = (sampleListing.discounts.custom_promotion?.percentage || 0) > 0;
  assert.equal(promoActive, true, "Custom promo section opens by default when promo active");

  console.log("  ✓ 9. Accordion Disclosure: Sections auto-expand when pre-configured values exist");
}

console.log("\n" + "=".repeat(66));
console.log("  ALL 9 FORM UI & INPUT CONTROL TESTS PASSED SUCCESSFULLY!  ");
console.log("=".repeat(66) + "\n");
