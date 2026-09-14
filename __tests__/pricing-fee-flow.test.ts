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
  taxableComponents: ["BASE_PRICE", "CLEANING_FEE"],
  remittanceResponsibility: "PLATFORM",
});

const cleaningFee = 5000; // 50.00 SAR (5,000 cents)

const taxCalcResult = TaxCalculator.calculateTaxes({
  nights: weekdayNights,
  nightlySubtotal: stayAmountWeekdayOnly,
  cleaningFee,
  rules: [saVatRule],
  currency: "SAR",
  hostServiceFeePercentage: feePct,
  hostServiceFee,
});

// Taxable Base = Stay Amount (100,000) + Cleaning Fee (5,000) = 105,000 cents (1,050.00 SAR)
// 15% VAT on 105,000 = 15,750 cents (157.50 SAR)
// Notice: Host Service Fee (15,000) is NOT taxed! If it were taxed, base would be 120,000 and tax would be 18,000.
assert(taxCalcResult.taxes[0].taxableBase === 105000, "Taxable base must strictly equal Stay Amount + Cleaning Fee (105,000 cents)");
assert(taxCalcResult.taxes[0].taxAmount === 15750, "VAT must equal 15,750 cents (15% of 1,050.00 SAR, strictly excluding Host Service Fee)");
assert(taxCalcResult.taxTotal === 15750, "Total tax must equal 15,750 cents");

// -----------------------------------------------------------------------------
// [4] Final Total / Guest Total Formula
// -----------------------------------------------------------------------------
console.log("\n--- [4] Final Total / Guest Total Verification ---");
// Formula: Guest Total = Stay Amount + Tax + Host Service Fee + Cleaning Fee
// 100,000 (Stay) + 15,750 (Tax) + 15,000 (Host Service Fee) + 5,000 (Cleaning Fee) = 135,750 cents (1,357.50 SAR)
const expectedGuestTotal = stayAmountWeekdayOnly + taxCalcResult.taxTotal + hostServiceFee + cleaningFee;
assert(taxCalcResult.guestTotal === 135750, "Guest Total must equal Stay Amount + Tax + Host Service Fee + Cleaning Fee (135,750 cents)");
assert(taxCalcResult.guestTotal === expectedGuestTotal, "Guest Total matches expected deterministic total");

// -----------------------------------------------------------------------------
// [5] Host Payout Formula
// -----------------------------------------------------------------------------
console.log("\n--- [5] Host Payout Verification ---");
// Formula: Host Payout = Stay Amount + Cleaning Fee - Host Service Fee
// 100,000 (Stay) + 5,000 (Cleaning Fee) - 15,000 (Host Service Fee) = 90,000 cents (900.00 SAR)
const payout = taxCalcResult.payoutBreakdown;
assert(payout.platformServiceFee === 15000, "Payout platformServiceFee must equal Host Service Fee (15,000 cents)");
assert(payout.netHostPayout === 90000, "Host Payout must equal Stay Amount + Cleaning Fee - Host Service Fee (90,000 cents)");

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
  cleaningFee,
  rules: [saVatRule],
  currency: "SAR",
  hostServiceFeePercentage: feePct,
  hostServiceFee: discountedHostFee,
});

// Taxable Base = Discounted Stay (90,000) + Cleaning Fee (5,000) = 95,000 cents
// VAT 15% of 95,000 = 14,250 cents
// Guest Total = 90,000 (Stay) + 14,250 (Tax) + 13,500 (Fee) + 5,000 (Cleaning) = 122,750 cents
// Host Payout = 90,000 + 5,000 - 13,500 = 81,500 cents
assert(discountedResult.taxes[0].taxableBase === 95000, "Taxable base must reflect discounted stay amount");
assert(discountedResult.taxes[0].taxAmount === 14250, "Tax must reflect discounted stay amount");
assert(discountedResult.guestTotal === 122750, "Discounted guest total must equal 122,750 cents");
assert(discountedResult.payoutBreakdown.netHostPayout === 81500, "Discounted host payout must equal 81,500 cents");

console.log("\n==================================================================");
console.log("   🎉 ALL PRICING & FEE CALCULATION FLOW TESTS PASSED!            ");
console.log("==================================================================\n");

