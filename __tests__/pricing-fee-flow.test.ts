import { TaxCalculator } from "../lib/tax/tax-calculator";
import type { TaxRuleDTO } from "../lib/tax/types";
import { getHostServiceFeePercentage } from "../services/app-settings.service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(` ✅ PASS: ${message}`);
}

function makeTaxRule(partial: Partial<TaxRuleDTO> & { id: string; jurisdictionId: string; taxType: any; name: string; calculationMethod: any }): TaxRuleDTO {
  return {
    description: null,
    rate: null,
    amount: null,
    taxableComponents: ["BASE_PRICE"],
    remittanceResponsibility: "PLATFORM",
    isSystemManaged: true,
    isInclusive: false,
    longStayExemptionNights: null,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveUntil: null,
    version: 1,
    isActive: true,
    ...partial,
  };
}

console.log("\n==================================================================");
console.log("       PRICING & FEE CALCULATION FLOW VERIFICATION SUITE          ");
console.log("==================================================================\n");

// -----------------------------------------------------------------------------
// [1] Weekday Base Price & Deterministic Stay Amount
// -----------------------------------------------------------------------------
console.log("--- [1] Weekday Base Price Integrity ---");
const hostWeekdayPrice = 25000; // 250.00 SAR per night (cents)
const weekdayNights = 4;
const stayAmountWeekdayOnly = hostWeekdayPrice * weekdayNights; // 100,000 cents (1,000.00 SAR)

assert(stayAmountWeekdayOnly === 100000, "Weekday base price must produce exact stay amount with zero float drift");

// -----------------------------------------------------------------------------
// [2] Host Service Fee Configuration & Fallback
// -----------------------------------------------------------------------------
console.log("\n--- [2] Host Service Fee Calculation ---");
const feePct = 15; // 15% admin configured fee
const hostServiceFee = Math.round(stayAmountWeekdayOnly * (feePct / 100)); // 15,000 cents (150.00 SAR)

assert(hostServiceFee === 15000, "15% Host Service Fee on 1,000.00 SAR must equal exactly 15,000 cents (150.00 SAR)");

// -----------------------------------------------------------------------------
// [3] Tax Calculation & Non-Taxable Host Service Fee
// -----------------------------------------------------------------------------
console.log("\n--- [3] Tax Calculation Strictly Excludes Host Service Fee ---");
const saVatRule = makeTaxRule({
  id: "sa-vat-15",
  jurisdictionId: "sa-zatca",
  taxType: "VAT",
  name: "Value-Added Tax (VAT)",
  calculationMethod: "PERCENTAGE",
  rate: 15.0,
  taxableComponents: ["BASE_PRICE"],
  remittanceResponsibility: "PLATFORM",
});

const taxCalcResult = TaxCalculator.calculateTaxes({
  nights: weekdayNights,
  nightlySubtotal: stayAmountWeekdayOnly,
  rules: [saVatRule],
  currency: "SAR",
  hostServiceFeePercentage: feePct,
  hostServiceFee,
});

assert(taxCalcResult.taxes[0].taxableBase === 100000, "Taxable base must equal accommodation only");
assert(taxCalcResult.taxes[0].taxAmount === 15000, "VAT must equal 15,000 cents and exclude removed cleaning/platform fees");
assert(taxCalcResult.taxTotal === 15000, "Total tax must equal 15,000 cents");

// -----------------------------------------------------------------------------
// [4] Final Total / Guest Total Formula
// -----------------------------------------------------------------------------
console.log("\n--- [4] Final Total / Guest Total Verification ---");
const expectedGuestTotal = stayAmountWeekdayOnly + taxCalcResult.taxTotal;
assert(taxCalcResult.guestTotal === 115000, "Guest Total must equal accommodation plus configured tax only");
assert(taxCalcResult.guestTotal === expectedGuestTotal, "Guest Total matches expected deterministic total");

// -----------------------------------------------------------------------------
// [5] Host Payout Formula
// -----------------------------------------------------------------------------
console.log("\n--- [5] Host Payout Verification ---");
const payout = taxCalcResult.payoutBreakdown;
assert(payout.platformServiceFee === 15000, "Payout platformServiceFee must equal Host Service Fee (15,000 cents)");
assert(payout.netHostPayout === 85000, "Host Payout must equal accommodation minus platform service fee");

// -----------------------------------------------------------------------------
// [6] Length-of-Stay Discount Integration
// -----------------------------------------------------------------------------
console.log("\n--- [6] Discount Integration ---");
// 10% Weekly Discount on 100,000 cents = 10,000 cents discount
const discountAmount = 10000;
const discountedStayAmount = stayAmountWeekdayOnly - discountAmount; // 90,000 cents
const discountedHostFee = Math.round(discountedStayAmount * (feePct / 100)); // 13,500 cents

const discountedResult = TaxCalculator.calculateTaxes({
  nights: 7,
  nightlySubtotal: stayAmountWeekdayOnly,
  discountAmount,
  rules: [saVatRule],
  currency: "SAR",
  hostServiceFeePercentage: feePct,
  hostServiceFee: discountedHostFee,
});

assert(discountedResult.taxes[0].taxableBase === 90000, "Taxable base must reflect discounted stay amount");
assert(discountedResult.taxes[0].taxAmount === 13500, "Tax must reflect discounted stay amount");
assert(discountedResult.guestTotal === 103500, "Discounted guest total must exclude cleaning and host payout fees");
assert(discountedResult.payoutBreakdown.netHostPayout === 76500, "Discounted host payout must deduct the platform fee");

console.log("\n==================================================================");
console.log("   🎉 ALL PRICING & FEE CALCULATION FLOW TESTS PASSED!            ");
console.log("==================================================================\n");
