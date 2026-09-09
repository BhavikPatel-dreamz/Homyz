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
console.log("     AIRBNB.ORG STAYS (PREFERENCES) VERIFICATION SUITE           ");
console.log("==================================================================\n");

// -----------------------------------------------------------------------------
// [1] File Existence & Component Architecture
// -----------------------------------------------------------------------------
console.log("--- [1] Component File Existence & Architecture ---");

const viewFilePath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/AirbnbOrgStaysView.tsx"
);
assert(fs.existsSync(viewFilePath), "AirbnbOrgStaysView.tsx file must exist");
const viewCode = fs.readFileSync(viewFilePath, "utf-8");

// -----------------------------------------------------------------------------
// [2] Exact Text & UI Match with Airbnb Reference Screenshot
// -----------------------------------------------------------------------------
console.log("\n--- [2] Copy & Reference Text Integrity (100% Match) ---");

// Heading
assert(viewCode.includes("Airbnb.org stays"), "Must contain exact page title 'Airbnb.org stays'");

// Sub-branding
assert(viewCode.includes("airbnb.org"), "Must contain brand mark 'airbnb.org'");
assert(
  viewCode.includes("Available for Airbnb.org guests for free or at a discount"),
  "Must contain exact subtitle 'Available for Airbnb.org guests for free or at a discount'"
);

// Section Header
assert(
  viewCode.includes("How Airbnb.org stays work"),
  "Must contain section heading 'How Airbnb.org stays work'"
);

// All 4 bullets matching screenshot exactly
const normalizedCode = viewCode.replace(/&apos;/g, "'");

assert(
  normalizedCode.includes(
    "When hosting for free or at a discount, you review each request before accepting, and declining a request won't affect your Superhost status."
  ),
  "Bullet 1: Review request before accepting without affecting Superhost status"
);

assert(
  normalizedCode.includes("Airbnb.org or its partner checks guests' eligibility."),
  "Bullet 2: Eligibility verification partner check"
);

assert(
  normalizedCode.includes("Airbnb.org's partners may send requests on behalf of their clients."),
  "Bullet 3: Partner request delegation"
);

assert(
  normalizedCode.includes("Stays can vary in length from a few days to a few weeks."),
  "Bullet 4: Stay duration flexibility"
);

// Link
assert(
  viewCode.includes("Learn more about Airbnb.org"),
  "Must contain 'Learn more about Airbnb.org' interactive link"
);

// -----------------------------------------------------------------------------
// [3] AGENTS.md ModalOverlay Scroll-Lock Compliance
// -----------------------------------------------------------------------------
console.log("\n--- [3] AGENTS.md ModalOverlay Scroll-Lock Compliance ---");

assert(
  viewCode.includes('import { ModalOverlay } from "@/components/ui/modal-overlay";'),
  "Must import ModalOverlay from @/components/ui/modal-overlay"
);

assert(
  viewCode.includes("<ModalOverlay"),
  "Slide-over Learn More drawer must be wrapped in <ModalOverlay"
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
// [4] Editor Sidebar & Routing Integration
// -----------------------------------------------------------------------------
console.log("\n--- [4] Editor Sidebar & Section Helpers Integration ---");

const sidebarFilePath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/EditorSidebar.tsx"
);
const sidebarCode = fs.readFileSync(sidebarFilePath, "utf-8");

assert(
  sidebarCode.includes("Airbnb.org stays"),
  "EditorSidebar must display 'Airbnb.org stays' card"
);

assert(
  sidebarCode.includes("Learn how you can help"),
  "EditorSidebar must display subtitle 'Learn how you can help'"
);

assert(
  sidebarCode.includes('setActiveSection("airbnb-org-stays")'),
  "EditorSidebar must navigate to 'airbnb-org-stays' on click"
);

const sectionHelpersPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/section-helpers.ts"
);
const helpersCode = fs.readFileSync(sectionHelpersPath, "utf-8");

assert(
  helpersCode.includes('"airbnb-org-stays"'),
  "section-helpers.ts must support 'airbnb-org-stays' in SectionKey and mapping"
);

// -----------------------------------------------------------------------------
// [5] Parent Views Mounting & Data Persistence
// -----------------------------------------------------------------------------
console.log("\n--- [5] Parent Views Mounting & Data Persistence ---");

const houseRulesPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/HouseRulesAndArrivalViews.tsx"
);
const houseRulesCode = fs.readFileSync(houseRulesPath, "utf-8");

assert(
  houseRulesCode.includes("<AirbnbOrgStaysView"),
  "HouseRulesAndArrivalViews must mount <AirbnbOrgStaysView"
);

const editorClientPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/host-listing-editor-client.tsx"
);
const editorClientCode = fs.readFileSync(editorClientPath, "utf-8");

assert(
  editorClientCode.includes('"airbnb-org-stays"'),
  "host-listing-editor-client must include 'airbnb-org-stays' in PREFERENCE_SECTIONS"
);

assert(
  editorClientCode.includes("handleSaveOrgStays"),
  "host-listing-editor-client must define handleSaveOrgStays method"
);

assert(
  editorClientCode.includes("listingDiscounts={listing.discounts}"),
  "host-listing-editor-client must pass discounts to HouseRulesAndArrivalViews"
);

console.log("\n==================================================================");
console.log("   🎉 ALL AIRBNB.ORG STAYS VERIFICATION TESTS PASSED (100%)!      ");
console.log("==================================================================\n");
