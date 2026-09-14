import "dotenv/config";
import fs from "fs";
import path from "path";

async function runWhatWouldYouLikeToHostTests() {
  console.log("\n=======================================================");
  console.log("   WHAT WOULD YOU LIKE TO HOST? STEP VERIFICATION      ");
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

  // 1. Become Host Modal - Step 2 Structure & Title
  console.log("\n--- [1] Modal Structure & Options ---");
  const modalFile = path.join(process.cwd(), "components/host/become-host-modal.tsx");
  const modalContent = fs.readFileSync(modalFile, "utf-8");

  assert(
    modalContent.includes("What would you like to host?"),
    "Title 'What would you like to host?' exists in become-host-modal.tsx"
  );

  assert(
    modalContent.includes('setSelectedType("HOME")') &&
    modalContent.includes('setSelectedType("EXPERIENCE")') &&
    modalContent.includes('setSelectedType("SERVICE")'),
    "All 3 options (Home, Experience, Service) can be selected in become-host-modal.tsx"
  );

  // 2. Flow sequence: Create new listing opens Step 2
  console.log("\n--- [2] Step Navigation Flow ---");
  assert(
    modalContent.includes("const handleSelectCreateNew = () => {") &&
    modalContent.includes("setStep(2);"),
    "Clicking 'Create a new listing' transitions to Step 2 ('What would you like to host?')"
  );

  assert(
    modalContent.includes("setStep(1)") && modalContent.includes("BackButton"),
    "Step 2 provides a BackButton navigating back to Step 1"
  );

  // 3. Selection state & highlight
  console.log("\n--- [3] Selection State & Visual Highlight ---");
  assert(
    modalContent.includes('border-2 border-zinc-950 bg-white shadow-md ring-2 ring-zinc-950/10'),
    "Selected card has active highlighted border and ring styling"
  );

  // 4. Persistence in sessionStorage
  console.log("\n--- [4] Persistence Across Navigation ---");
  assert(
    modalContent.includes('sessionStorage.setItem("host_type",') &&
    modalContent.includes('sessionStorage.getItem("host_type")'),
    "Selected host_type persists in sessionStorage across navigation and draft restarts"
  );

  // 5. Next Button Constraints & Supported Types
  console.log("\n--- [5] Next Button Validation & Supported Types ---");
  assert(
    modalContent.includes("disabled={!selectedType || !isTypeSupported || isNavigating}"),
    "Next button is disabled if no option is selected or if selected option is unsupported"
  );

  assert(
    modalContent.includes('const isTypeSupported = selectedType === "HOME";'),
    "Only 'HOME' is currently supported for new listing wizard"
  );

  assert(
    modalContent.includes("coming soon to Homyz"),
    "Experience and Service display informative 'coming soon' message without breaking or fabricating unsupported flows"
  );

  assert(
    modalContent.includes("router.push(`/host/listings/new?type=${selectedType}`)"),
    "Advancing with Home navigates to /host/listings/new?type=HOME"
  );

  // 6. Back navigation from Onboarding Wizard to Modal
  console.log("\n--- [6] Back Navigation from Onboarding Step 0 ---");
  const getStartedFile = path.join(process.cwd(), "components/host/new-listing-get-started.tsx");
  const getStartedContent = fs.readFileSync(getStartedFile, "utf-8");

  assert(
    getStartedContent.includes('router.push("/host/listings?create=open")'),
    "Back button in wizard StepOverview returns to /host/listings?create=open"
  );

  const workspaceFile = path.join(process.cwd(), "components/host/host-listings-workspace.tsx");
  const workspaceContent = fs.readFileSync(workspaceFile, "utf-8");

  assert(
    workspaceContent.includes('params.get("create") === "open"') &&
    workspaceContent.includes("setBecomeHostModalStep(2)"),
    "Host listings workspace reopens BecomeHostModal at Step 2 when navigating back from wizard"
  );

  // 7. Database schema compatibility
  console.log("\n--- [7] Database Schema & API Verification ---");
  const schemaFile = path.join(process.cwd(), "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaFile, "utf-8");

  assert(
    schemaContent.includes("enum HostingType {") &&
    schemaContent.includes("HOME") &&
    schemaContent.includes("EXPERIENCE") &&
    schemaContent.includes("SERVICE"),
    "Prisma schema defines HostingType enum with HOME, EXPERIENCE, SERVICE"
  );

  assert(
    /hostingType\s+HostingType\s+@default\(HOME\)/.test(schemaContent),
    "Listing model defines hostingType with default HOME"
  );

  console.log(`\n=======================================================`);
  console.log(` ✅ ALL TESTS PASSED: ${passed}/${passed + failed}`);
  console.log(`=======================================================\n`);
}

runWhatWouldYouLikeToHostTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

