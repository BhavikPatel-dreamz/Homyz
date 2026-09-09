import fs from "fs";
import path from "path";
import { getSafeTaxItems } from "../lib/tax/safe-simulator";
import { TaxCalculator } from "../lib/tax/tax-calculator";
import { resolveTaxJurisdiction } from "../lib/tax/jurisdiction-resolver";
import type { ListingTaxDTO, TaxRuleDTO } from "../lib/tax/types";

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

function makeListingTax(partial: Partial<ListingTaxDTO> & { id: string; listingId: string; taxType: any; calculationMethod: any }): ListingTaxDTO {
  return {
    taxRuleId: null,
    customName: null,
    rate: null,
    amount: null,
    taxableComponents: ["BASE_PRICE"],
    remittanceResponsibility: "HOST",
    longStayExemptionNights: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

console.log("\n==================================================================");
console.log("       TAX MANAGEMENT ENGINE COMPREHENSIVE VERIFICATION SUITE       ");
console.log("==================================================================\n");

// -----------------------------------------------------------------------------
// [1] Deterministic Integer Arithmetic & All 5 Calculation Methods
// -----------------------------------------------------------------------------
console.log("--- [1] Deterministic Calculation Methods in Minor Units (Cents/Halalas) ---");

// Method A: PERCENTAGE
const percentageRule: TaxRuleDTO = makeTaxRule({
  id: "rule-vat-15",
  jurisdictionId: "sa-zatca",
  taxType: "VAT",
  name: "Value-Added Tax (VAT)",
  description: "Standard Saudi ZATCA VAT",
  calculationMethod: "PERCENTAGE",
  rate: 15.0,
  taxableComponents: ["BASE_PRICE", "CLEANING_FEE"],
  remittanceResponsibility: "PLATFORM",
});

const resPercentage = TaxCalculator.calculateTaxes({
  nights: 5,
  nightlySubtotal: 100000, // 1000.00 SAR
  cleaningFee: 15000,     // 150.00 SAR
  rules: [percentageRule],
  currency: "SAR",
});

// Taxable base = 100000 + 15000 = 115000 (1150.00 SAR)
// VAT 15% of 115000 = 17250 (172.50 SAR)
assert(resPercentage.taxes.length === 1, "Should calculate 1 tax item");
assert(resPercentage.taxes[0].taxAmount === 17250, "VAT 15% of 1150.00 SAR must equal exactly 17250 halalas");
assert(resPercentage.taxTotal === 17250, "Total tax should equal 17250 halalas");
assert(resPercentage.guestTotal === 115000 + 17250, "Guest total must equal subtotal + tax = 132250 halalas");

// Method B: FLAT_PER_BOOKING
const flatRule: TaxRuleDTO = makeTaxRule({
  id: "rule-flat",
  jurisdictionId: "sa-zatca",
  taxType: "OTHER",
  name: "Flat Booking Surcharge",
  calculationMethod: "FLAT_PER_BOOKING",
  amount: 2500, // 25.00 SAR
  remittanceResponsibility: "HOST",
});

const resFlat = TaxCalculator.calculateTaxes({
  nights: 3,
  nightlySubtotal: 30000,
  rules: [flatRule],
  currency: "SAR",
});
assert(resFlat.taxes[0].taxAmount === 2500, "Flat per booking must equal 2500 halalas regardless of nights or guests");

// Method C: AMOUNT_PER_NIGHT
const perNightRule: TaxRuleDTO = makeTaxRule({
  id: "rule-per-night",
  jurisdictionId: "sa-riyadh",
  taxType: "TOURIST_TAX",
  name: "Tourism Fee Per Night",
  calculationMethod: "AMOUNT_PER_NIGHT",
  amount: 1000, // 10.00 SAR per night
  remittanceResponsibility: "PLATFORM",
});

const resPerNight = TaxCalculator.calculateTaxes({
  nights: 7,
  nightlySubtotal: 70000,
  rules: [perNightRule],
  currency: "SAR",
});
assert(resPerNight.taxes[0].taxAmount === 7000, "Per night fee for 7 nights at 10.00 SAR must equal 7000 halalas");

// Method D: AMOUNT_PER_GUEST
const perGuestRule: TaxRuleDTO = makeTaxRule({
  id: "rule-per-guest",
  jurisdictionId: "us-ca",
  taxType: "OCCUPANCY_TAX",
  name: "Transient Surcharge Per Guest",
  calculationMethod: "AMOUNT_PER_GUEST",
  amount: 1500, // 15.00 SAR per guest
  remittanceResponsibility: "HOST",
});

const resPerGuest = TaxCalculator.calculateTaxes({
  nights: 2,
  guests: 4,
  nightlySubtotal: 40000,
  rules: [perGuestRule],
  currency: "SAR",
});
assert(resPerGuest.taxes[0].taxAmount === 6000, "Per guest fee for 4 guests at 15.00 SAR must equal 6000 halalas");

// Method E: AMOUNT_PER_GUEST_PER_NIGHT
const perGuestNightRule: TaxRuleDTO = makeTaxRule({
  id: "rule-per-guest-night",
  jurisdictionId: "it-rome",
  taxType: "CITY_TAX",
  name: "City Tourist Tax",
  calculationMethod: "AMOUNT_PER_GUEST_PER_NIGHT",
  amount: 500, // 5.00 SAR per guest per night
  remittanceResponsibility: "HOST",
});

const resPerGuestNight = TaxCalculator.calculateTaxes({
  nights: 3,
  guests: 3,
  nightlySubtotal: 45000,
  rules: [perGuestNightRule],
  currency: "SAR",
});
// 3 guests * 3 nights * 500 = 4500 halalas
assert(resPerGuestNight.taxes[0].taxAmount === 4500, "Per guest per night for 3 guests, 3 nights at 5.00 SAR must equal 4500 halalas");

// -----------------------------------------------------------------------------
// [2] Taxable Base Component Filtering
// -----------------------------------------------------------------------------
console.log("\n--- [2] Taxable Base Component Filtering ---");

const taxOnlyOnBase: TaxRuleDTO = makeTaxRule({
  id: "rule-base-only",
  jurisdictionId: "test",
  taxType: "VAT",
  name: "Base Only Tax",
  calculationMethod: "PERCENTAGE",
  rate: 10.0,
  remittanceResponsibility: "PLATFORM",
});

const resBaseOnly = TaxCalculator.calculateTaxes({
  nights: 2,
  nightlySubtotal: 20000, // 200 SAR
  cleaningFee: 5000,     // 50 SAR
  petFee: 3000,          // 30 SAR
  rules: [taxOnlyOnBase],
  currency: "SAR",
});
// 10% of 20000 = 2000 halalas (cleaning and pet fees excluded)
assert(resBaseOnly.taxes[0].taxAmount === 2000, "Tax with only BASE_PRICE component must ignore cleaning and pet fees");

// -----------------------------------------------------------------------------
// [3] Long-Stay Exemption Engine (28+ Nights)
// -----------------------------------------------------------------------------
console.log("\n--- [3] Long-Stay Exemption Logic ---");

const ruleWithExemption: TaxRuleDTO = makeTaxRule({
  id: "rule-exempt-28",
  jurisdictionId: "sa-zatca",
  taxType: "TOURIST_TAX",
  name: "Tourism Fee (Exempt 28+ nights)",
  calculationMethod: "AMOUNT_PER_NIGHT",
  amount: 2000,
  remittanceResponsibility: "PLATFORM",
  longStayExemptionNights: 28,
});

// Case 1: Short stay (14 nights) -> NOT exempt
const resShortStay = TaxCalculator.calculateTaxes({
  nights: 14,
  nightlySubtotal: 140000,
  rules: [ruleWithExemption],
  currency: "SAR",
});
assert(resShortStay.taxes[0].isExempt === false, "14 nights must NOT trigger 28-night exemption");
assert(resShortStay.taxes[0].taxAmount === 28000, "14 nights * 2000 = 28000 halalas tax");

// Case 2: Long stay (30 nights) -> EXEMPT
const resLongStay = TaxCalculator.calculateTaxes({
  nights: 30,
  nightlySubtotal: 300000,
  rules: [ruleWithExemption],
  currency: "SAR",
});
assert(resLongStay.taxes[0].isExempt === true, "30 nights MUST trigger 28-night exemption");
assert(resLongStay.taxes[0].taxAmount === 0, "Exempt tax amount must equal 0 halalas");
assert(Boolean(resLongStay.taxes[0].exemptionReason), "Exemption reason must be documented");

// -----------------------------------------------------------------------------
// [4] Remittance Responsibility Separation (Platform vs Host Payout)
// -----------------------------------------------------------------------------
console.log("\n--- [4] Platform vs Host Remittance Responsibility in Host Payout ---");

const platformVat: TaxRuleDTO = makeTaxRule({
  id: "platform-vat",
  jurisdictionId: "sa",
  taxType: "VAT",
  name: "Platform VAT 15%",
  calculationMethod: "PERCENTAGE",
  rate: 15.0,
  remittanceResponsibility: "PLATFORM",
});

const hostCityTax: ListingTaxDTO = makeListingTax({
  id: "host-tax-1",
  listingId: "listing-1",
  customName: "Host Municipal Tax",
  taxType: "CITY_TAX",
  calculationMethod: "PERCENTAGE",
  rate: 5.0,
  remittanceResponsibility: "HOST",
});

const resRemittance = TaxCalculator.calculateTaxes({
  nights: 1,
  nightlySubtotal: 100000, // 1000.00 SAR
  cleaningFee: 0,
  rules: [platformVat],
  hostTaxes: [hostCityTax],
  currency: "SAR",
});

// Platform VAT: 15% of 1000.00 = 150.00 SAR (15000 halalas) -> Remitted by Platform
// Host City Tax: 5% of 1000.00 = 50.00 SAR (5000 halalas) -> Remitted by Host
// Guest Total = 100000 + 15000 + 5000 = 120000 halalas
assert(resRemittance.platformRemittedTaxTotal === 15000, "Platform remitted total must be 15000 halalas");
assert(resRemittance.hostRemittedTaxTotal === 5000, "Host remitted total must be 5000 halalas");
assert(resRemittance.guestTotal === 120000, "Guest pays 1200.00 SAR (subtotal + all taxes)");

// Host Payout verification:
// Subtotal = 100000
// Taxes collected for host = 5000 (Host must receive this to remit to city)
// Platform fee (3% of subtotal) = 3000
// Net Host Payout = 100000 + 5000 - 3000 = 102000 halalas
const payout = resRemittance.payoutBreakdown;
assert(payout.taxesRemittedByPlatform === 15000, "Platform tax is accounted for platform remittance");
assert(payout.taxesCollectedForHost === 5000, "Host tax is added to host payout");
assert(payout.netHostPayout === 102000, "Host net payout must include host taxes and deduct platform fee (102000 halalas)");

// -----------------------------------------------------------------------------
// [5] Jurisdiction Resolution Engine
// -----------------------------------------------------------------------------
console.log("\n--- [5] Jurisdiction Resolution Engine ---");

// Saudi Arabia (National)
const saRes = resolveTaxJurisdiction({ country: "SA", city: "Riyadh" });
assert(saRes.jurisdiction.country === "SA", "Saudi Arabia country code must resolve");
assert(saRes.systemRules.some((r) => r.taxType === "VAT" && r.rate === 15), "Saudi Arabia must resolve 15% VAT");

// UAE (Dubai DTCM)
const uaeRes = resolveTaxJurisdiction({ country: "AE", city: "Dubai" });
assert(uaeRes.jurisdiction.country === "AE", "Dubai must resolve to UAE jurisdiction");
assert(uaeRes.systemRules.some((r) => r.taxType === "VAT" && r.rate === 5), "UAE must resolve 5% VAT");

// United Kingdom
const ukRes = resolveTaxJurisdiction({ country: "GB", city: "London" });
assert(ukRes.jurisdiction.country === "GB", "London must resolve to GB jurisdiction");
assert(ukRes.systemRules.some((r) => r.rate === 20), "UK must resolve 20% standard VAT");

// Global Fallback
const unknownRes = resolveTaxJurisdiction({ country: "XX", city: "Nowhere" });
assert(unknownRes.jurisdiction.id === "jur_default_global", "Unknown location must gracefully resolve to global fallback");

// -----------------------------------------------------------------------------
// [6] Duplicate Tax Type Collision Prevention
// -----------------------------------------------------------------------------
console.log("\n--- [6] Duplicate Tax Collision Prevention ---");

// If platform already collects VAT for Saudi Arabia, host tax of type VAT must be ignored
const duplicateHostVat: ListingTaxDTO = makeListingTax({
  id: "host-vat",
  listingId: "listing-1",
  customName: "Host Duplicate VAT",
  taxType: "VAT",
  calculationMethod: "PERCENTAGE",
  rate: 15.0,
  remittanceResponsibility: "HOST",
});

const resDeduplicated = TaxCalculator.calculateTaxes({
  nights: 2,
  nightlySubtotal: 20000,
  rules: [percentageRule], // platform rule is VAT
  hostTaxes: [duplicateHostVat], // host also tried to add VAT
  currency: "SAR",
});

assert(resDeduplicated.taxes.length === 1, "Duplicate VAT tax must NOT be added twice");
assert(resDeduplicated.taxes[0].remittanceResponsibility === "PLATFORM", "Platform-managed VAT must take strict priority");

// -----------------------------------------------------------------------------
// [7] AGENTS.md ModalOverlay Background Scroll Lock Compliance
// -----------------------------------------------------------------------------
console.log("\n--- [7] AGENTS.md ModalOverlay Scroll-Lock Compliance ---");

const taxesManagerPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/TaxesManager.tsx"
);
assert(fs.existsSync(taxesManagerPath), "TaxesManager.tsx file must exist");
const taxesManagerCode = fs.readFileSync(taxesManagerPath, "utf-8");

assert(
  taxesManagerCode.includes('import { ModalOverlay } from "@/components/ui/modal-overlay";'),
  "TaxesManager.tsx must import ModalOverlay from @/components/ui/modal-overlay"
);

// Verify all modals use ModalOverlay
const modalOverlayOccurrences = (taxesManagerCode.match(/<ModalOverlay/g) || []).length;
assert(
  modalOverlayOccurrences >= 4,
  `TaxesManager.tsx must wrap all 4 modals (Add/Edit, Delete, Registration, Invoice) in ModalOverlay (found ${modalOverlayOccurrences})`
);

// Verify no forbidden manual scroll lock mutations
assert(
  !taxesManagerCode.includes("document.body.style.overflow"),
  "TaxesManager.tsx must NOT mutate document.body.style.overflow directly (forbidden by AGENTS.md)"
);
assert(
  !taxesManagerCode.includes("document.documentElement.style.overflow"),
  "TaxesManager.tsx must NOT mutate document.documentElement.style.overflow directly (forbidden by AGENTS.md)"
);

// -----------------------------------------------------------------------------
// [8] Public Quote Integration Verification
// -----------------------------------------------------------------------------
console.log("\n--- [8] Public Listing Quote Breakdown Verification ---");

const publicClientPath = path.resolve(
  __dirname,
  "../app/listings/[id]/public-listing-detail-client.tsx"
);
const publicClientCode = fs.readFileSync(publicClientPath, "utf-8");
assert(
  publicClientCode.includes("Taxes & fees"),
  "Public listing detail must include 'Taxes & fees' line item"
);
assert(
  publicClientCode.includes("Exemption applied"),
  "Public listing detail must support showing 'Exemption applied' badge"
);

assert(getSafeTaxItems(undefined).length === 0, "Missing simulator tax data should normalize to an empty list");
assert(getSafeTaxItems([{ taxName: "VAT" } as any]).length === 1, "Valid simulator tax data should be retained");

console.log("\n==================================================================");
console.log("   🎉 ALL 18 TAX ENGINE TESTS PASSED WITH 100% PRECISION!         ");
console.log("==================================================================\n");
