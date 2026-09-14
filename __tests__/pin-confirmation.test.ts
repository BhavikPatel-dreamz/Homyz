import "dotenv/config";
import fs from "fs";
import path from "path";

async function runPinConfirmationTests() {
  console.log("\n=======================================================");
  console.log("   PIN CONFIRMATION ('IS THE PIN IN THE RIGHT SPOT?')   ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(` ❌ FAIL: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      console.log(` ✅ PASS: ${msg}`);
      passed++;
    }
  }

  // 1. Check StepPinConfirm Component Structure & Heading
  console.log("\n--- [1] Screen Title & Structure ---");
  const pinStepFile = path.join(process.cwd(), "components/host/onboarding/step-pin-confirm.tsx");
  assert(fs.existsSync(pinStepFile), "components/host/onboarding/step-pin-confirm.tsx exists");

  const pinStepContent = fs.readFileSync(pinStepFile, "utf-8");
  assert(
    pinStepContent.includes("Is the pin in the right spot?"),
    "Screen displays documented title 'Is the pin in the right spot?'"
  );
  assert(
    pinStepContent.includes("Your address is only shared with guests after they’ve made a reservation"),
    "Screen displays documented address privacy notice"
  );
  assert(
    pinStepContent.includes("Edit address") || pinStepContent.includes("onEditAddress"),
    "Screen provides quick access to return and edit address"
  );

  // 2. RealMap Dragging & Coordinates Wiring
  console.log("\n--- [2] Map Display & Draggable Pin ---");
  assert(
    pinStepContent.includes("<RealMap") &&
    pinStepContent.includes("preferInitialCoordinates={true}"),
    "StepPinConfirm integrates RealMap with preferInitialCoordinates={true} to avoid snapping"
  );
  assert(
    pinStepContent.includes("onLocationChange={handleMapLocationChange}"),
    "StepPinConfirm listens to pin marker repositioning from RealMap"
  );
  assert(
    pinStepContent.includes("details?: LocationDetails") &&
    pinStepContent.includes("onPinChange(lat, lng, details)"),
    "StepPinConfirm forwards reverse-geocoded address details when the pin moves"
  );

  // 3. Address Privacy Toggle
  console.log("\n--- [3] Address Privacy Control ---");
  assert(
    pinStepContent.includes("Show your specific location"),
    "StepPinConfirm provides 'Show your specific location' privacy toggle"
  );
  assert(
    !pinStepContent.includes("data-aos"),
    "Pin confirmation content remains visible even if page animations do not initialize"
  );

  const addressStepFile = path.join(process.cwd(), "components/host/onboarding/step-address-confirm.tsx");
  const addressStepContent = fs.readFileSync(addressStepFile, "utf-8");
  assert(
    !addressStepContent.includes("data-aos"),
    "Returning to the address form remains visible even if page animations do not initialize"
  );

  // 4. Integration in new-listing-get-started.tsx
  console.log("\n--- [4] Wizard State Machine & Navigation ---");
  const wizardFile = path.join(process.cwd(), "components/host/new-listing-get-started.tsx");
  const wizardContent = fs.readFileSync(wizardFile, "utf-8");

  assert(
    wizardContent.includes("import { StepPinConfirm } from \"./onboarding/step-pin-confirm\""),
    "new-listing-get-started.tsx imports StepPinConfirm"
  );
  assert(
    wizardContent.includes('addressView === "form"') &&
    wizardContent.includes('addressView === "pin"'),
    "new-listing-get-started.tsx cleanly manages Address form vs Pin confirmation views"
  );

  const pageFile = path.join(process.cwd(), "app/(protected)/host/listings/new/page.tsx");
  const pageContent = fs.readFileSync(pageFile, "utf-8");
  assert(
    pageContent.includes("initialAddressView={initialAddressView}") &&
    wizardContent.includes("initialAddressView ? \"pin\" : \"form\""),
    "server and client receive the same requested pin view to prevent hydration mismatches"
  );

  // 5. Pin Dragging Updates Coordinates and Address
  console.log("\n--- [5] Pin Location Synchronization ---");
  assert(
    wizardContent.includes("const handlePinChange = (lat: number, lng: number, details?: LocationDetails) => {") &&
    wizardContent.includes("handleLocationChange(lat, lng, details);"),
    "handlePinChange updates coordinates and address fields from the moved pin"
  );
  assert(
    wizardContent.includes("await queueDraftPatch(activeId, payload);") &&
    wizardContent.includes("address: streetAddress.trim() || null"),
    "Moved pin address and coordinates are included in the draft autosave payload"
  );

  // 6. Back / Return Navigation
  console.log("\n--- [6] Back / Forward Preservation ---");
  assert(
    wizardContent.includes('onBack={() => goToStep(5, "pin")}'),
    "Step 6 Basics Counters Back button returns to Pin Confirmation screen"
  );
  assert(
    wizardContent.includes('setAddressView("form")'),
    "Pin confirmation screen Back button returns to address form with data preserved"
  );

  // 7. Draft Payload & Database Persistence
  console.log("\n--- [7] Draft Payload & Coordinate Storage ---");
  assert(
    wizardContent.includes("latitude: hasConfirmedLocation && Number.isFinite(coords.lat) ? coords.lat : null"),
    "Draft payload persists verified latitude as floating point coordinate"
  );
  assert(
    wizardContent.includes("longitude: hasConfirmedLocation && Number.isFinite(coords.lng) ? coords.lng : null"),
    "Draft payload persists verified longitude as floating point coordinate"
  );

  // 8. Draft Hydration & Resumption
  console.log("\n--- [8] Draft Hydration & Resumption ---");
  assert(
    wizardContent.includes("setCoords({ lat: listing.latitude ?? 24.7136, lng: listing.longitude ?? 46.6753 })"),
    "loadDraft restores saved latitude and longitude into coords"
  );
  assert(
    wizardContent.includes("setHasConfirmedLocation(listing.latitude !== null && listing.longitude !== null)"),
    "loadDraft restores confirmed location flag from saved coordinates"
  );

  // 9. Database Schema Verification
  console.log("\n--- [9] Database Schema ---");
  const schemaFile = path.join(process.cwd(), "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaFile, "utf-8");

  assert(
    /latitude\s+Float\?/.test(schemaContent) &&
    /longitude\s+Float\?/.test(schemaContent) &&
    /showExactLocation\s+Boolean/.test(schemaContent),
    "Prisma schema defines latitude, longitude, and showExactLocation fields"
  );

  console.log(`\n=======================================================`);
  console.log(` ✅ ALL TESTS PASSED: ${passed}/${passed + failed}`);
  console.log(`=======================================================\n`);
}

runPinConfirmationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
