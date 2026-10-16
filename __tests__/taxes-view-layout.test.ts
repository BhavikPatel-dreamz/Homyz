import fs from "fs";
import path from "path";

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(` ✅ PASS: ${message}`);
}

console.log("\n==================================================================");
console.log("     TAX MANAGEMENT SPLIT-VIEW (HOMYZ BRANDING) VERIFICATION      ");
console.log("==================================================================\n");

// -----------------------------------------------------------------------------
// [1] Component File Existence & Architecture
// -----------------------------------------------------------------------------
console.log("--- [1] TaxesManager Component File & Architecture ---");

const viewFilePath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/TaxesManager.tsx"
);
assert(fs.existsSync(viewFilePath), "TaxesManager.tsx file must exist");
const viewCode = fs.readFileSync(viewFilePath, "utf-8");

// -----------------------------------------------------------------------------
// [2] Exact Copy & Homyz Brand Integrity (100% Match with Screenshot)
// -----------------------------------------------------------------------------
console.log("\n--- [2] Reference Text & Homyz Brand Integrity ---");

// Heading
assert(viewCode.includes("Taxes"), "Must contain exact page title 'Taxes'");

// Subtitle
assert(
  viewCode.includes(
    "Homyz automatically submits some taxes, and you can add other taxes you need to submit."
  ),
  "Must contain exact subtitle 'Homyz automatically submits some taxes, and you can add other taxes you need to submit.'"
);

// Card 1
assert(
  viewCode.includes("Taxes Homyz submits"),
  "Card 1: Must contain heading 'Taxes Homyz submits'"
);
assert(
  viewCode.includes(
    "We'll collect these taxes from guests on your behalf and submit payment to the designated tax authority."
  ) ||
  viewCode.includes(
    "We&apos;ll collect these taxes from guests on your behalf and submit payment to the designated tax authority."
  ),
  "Card 1: Must contain exact collection and submission description"
);

// Card 2
assert(
  viewCode.includes("Add taxes you'll submit") ||
  viewCode.includes("Add taxes you&apos;ll submit"),
  "Card 2: Must contain heading 'Add taxes you'll submit'"
);
assert(
  viewCode.includes(
    "We'll collect these taxes from guests on your behalf and pass the funds on to you. You must submit payment to the correct tax authority."
  ) ||
  viewCode.includes(
    "We&apos;ll collect these taxes from guests on your behalf and pass the funds on to you. You must submit payment to the correct tax authority."
  ),
  "Card 2: Must contain exact collection and pass-on description"
);
assert(
  viewCode.includes("Add a tax"),
  "Card 2: Must contain 'Add a tax' button"
);

// Strict check: No "airbnb" or "Airbnb" in user-facing UI copy in TaxesManager.tsx
const forbiddenMatch = viewCode.match(/\bAirbnb\b/i);
assert(
  !forbiddenMatch,
  "Must NOT contain 'Airbnb' anywhere in TaxesManager (User requested Homyz text)"
);

// -----------------------------------------------------------------------------
// [3] Right Column "Add a tax" Form Fields & Structure
// -----------------------------------------------------------------------------
console.log("\n--- [3] 'Add a tax' Panel & Form Field Structure ---");

assert(
  viewCode.includes("Add a tax") &&
  viewCode.includes("You can add one or more taxes to apply to your listing."),
  "Right panel must contain 'Add a tax' title and description"
);

// Field 1: Tax name
assert(viewCode.includes("Tax name"), "Field 1: Must contain 'Tax name' label");
assert(viewCode.includes("Hotel tax"), "Field 1: Must include Hotel tax option");
assert(viewCode.includes("Room tax"), "Field 1: Must include Room tax option");
assert(viewCode.includes("Tourist tax"), "Field 1: Must include Tourist tax option");
assert(viewCode.includes("Transient Occupancy Tax"), "Field 1: Must include Transient Occupancy Tax option");
assert(viewCode.includes("VAT/GST"), "Field 1: Must include VAT/GST option");
assert(viewCode.includes("Tourism Assessment/Fee"), "Field 1: Must include Tourism Assessment/Fee option");

// Field 2: Tax type
assert(viewCode.includes("Tax type"), "Field 2: Must contain 'Tax type' label");
assert(viewCode.includes("Percentage per booking"), "Field 2: Must include 'Percentage per booking' option");
assert(viewCode.includes("Per guest"), "Field 2: Must include 'Per guest' option");
assert(viewCode.includes("Per night"), "Field 2: Must include 'Per night' option");
assert(viewCode.includes("Per guest, per night"), "Field 2: Must include 'Per guest, per night' option");

// Field 3: Tax rate
assert(viewCode.includes("Tax rate"), "Field 3: Must contain 'Tax rate' label");

// Field 4: Taxable base and cap
assert(viewCode.includes("Taxable base"), "Field 4: Must contain 'Taxable base' label");
assert(viewCode.includes("Management fee"), "Field 4: Must include Management fee taxable component");
assert(viewCode.includes("Maximum cap per person per night"), "Field 5: Must contain maximum cap field");

// Field 6: Partial-stay exemption
assert(viewCode.includes("Partial-stay exemption"), "Field 4: Must contain 'Partial-stay exemption' label");
assert(
  viewCode.includes(
    "If local laws exempt taxes after a certain number of nights, select that number of nights."
  ),
  "Field 6: Must contain partial-stay exemption explanation"
);

// Field 7: Full-stay exemption
assert(viewCode.includes("Full-stay exemption"), "Field 5: Must contain 'Full-stay exemption' label");
assert(
  viewCode.includes(
    "If local laws exempt taxes for the entire stay after a certain number of nights, select that number of nights."
  ),
  "Field 7: Must contain full-stay exemption explanation"
);

// Field 8: Accommodation tax registration number
assert(
  viewCode.includes("Accommodation tax registration number"),
  "Field 8: Must contain 'Accommodation tax registration number' label"
);
assert(
  viewCode.includes("This number is on your tax regulation documents."),
  "Field 8: Must contain regulatory number explanation"
);
assert(
  viewCode.includes("Tax registration number"),
  "Field 8: Must contain placeholder 'Tax registration number'"
);

// Field 9: Terms for adding taxes
assert(viewCode.includes("Terms for adding taxes"), "Field 7: Must contain 'Terms for adding taxes' heading");
const expectedTermsText =
  "I confirm the tax information is correct and will remit any tax collected on my bookings to the appropriate tax authorities. I grant Homyz permission to disclose tax-related and transaction information (such as name, listing address, tax amount and registration number) to the relevant tax authorities.";
assert(
  viewCode.includes(expectedTermsText),
  "Field 9: Must contain exact legal terms confirmation with Homyz grant"
);

// Sticky action bar
assert(viewCode.includes("Cancel"), "Action bar: Must contain Cancel button");
assert(viewCode.includes("Save"), "Action bar: Must contain Save button");

// -----------------------------------------------------------------------------
// [4] AGENTS.md ModalOverlay Scroll-Lock Compliance
// -----------------------------------------------------------------------------
console.log("\n--- [4] AGENTS.md ModalOverlay Compliance ---");

assert(
  viewCode.includes('import { ModalOverlay } from "@/components/ui/modal-overlay";'),
  "Must import ModalOverlay from @/components/ui/modal-overlay"
);

const modalMatches = (viewCode.match(/<ModalOverlay/g) || []).length;
assert(
  modalMatches >= 4,
  `Must wrap all dialogs/drawers in <ModalOverlay (found ${modalMatches})`
);

assert(
  !viewCode.includes("document.body.style.overflow"),
  "Must NOT mutate document.body.style.overflow directly"
);
assert(
  !viewCode.includes("document.documentElement.style.overflow"),
  "Must NOT mutate document.documentElement.style.overflow directly"
);

// -----------------------------------------------------------------------------
// [5] Consistent Main Sidebar & Modal Drawer Integration
// -----------------------------------------------------------------------------
console.log("\n--- [5] Main Sidebar & Modal Drawer Integration ---");

const editorClientPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/host-listing-editor-client.tsx"
);
const editorClientCode = fs.readFileSync(editorClientPath, "utf-8");

assert(
  editorClientCode.includes("<EditorSidebar"),
  "host-listing-editor-client.tsx must render EditorSidebar in main layout"
);

assert(
  editorClientCode.includes("<HouseRulesAndArrivalViews"),
  "host-listing-editor-client.tsx must render HouseRulesAndArrivalViews in main column"
);

const houseRulesPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/HouseRulesAndArrivalViews.tsx"
);
const houseRulesCode = fs.readFileSync(houseRulesPath, "utf-8");
assert(
  houseRulesCode.includes("<TaxesManager"),
  "HouseRulesAndArrivalViews.tsx must mount TaxesManager when activeSection is taxes"
);

assert(
  viewCode.includes("isAddTaxModalOpen"),
  "TaxesManager.tsx must manage isAddTaxModalOpen for Add a tax modal drawer"
);

console.log("\n==================================================================");
console.log("   🎉 ALL TAXES SPLIT-VIEW VERIFICATION TESTS PASSED (100%)!      ");
console.log("==================================================================\n");
