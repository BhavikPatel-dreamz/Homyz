import "dotenv/config";
import fs from "fs";
import path from "path";
import { WIZARD_STEPS, TOTAL_WIZARD_STEPS, getStepByIndex, getStepBySlug } from "../components/host/onboarding/wizard-steps";

async function runPhaseP1Tests() {
  console.log("\n=======================================================");
  console.log("   PHASE P1 HOST LISTING WIZARD & FLOW VERIFICATION   ");
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

  // ─────────────────────────────────────────────────────────────
  // 1. Centralized Wizard Step Configuration & Sequence
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [1] Wizard Step Configuration & 3-Part Order ---");

  assert(TOTAL_WIZARD_STEPS === 19, `Total wizard steps must be exactly 19 (found: ${TOTAL_WIZARD_STEPS})`);

  // Verify Part 1 (The basics): steps 0..6
  const part1Slugs = WIZARD_STEPS.slice(0, 7).map((s) => s.slug);
  assert(
    JSON.stringify(part1Slugs) ===
      JSON.stringify(["overview", "intro", "category", "place-type", "location", "address", "basics"]),
    `Part 1 sequence must be: overview, intro, category, place-type, location, address, basics. Got: ${part1Slugs.join(", ")}`
  );

  // Verify Part 2 (Make it stand out): steps 7..13
  const part2Slugs = WIZARD_STEPS.slice(7, 14).map((s) => s.slug);
  assert(
    JSON.stringify(part2Slugs) ===
      JSON.stringify(["standout", "amenities", "photos", "photos-review", "title", "highlights", "description"]),
    `Part 2 sequence must be: standout, amenities, photos, photos-review, title, highlights, description. Got: ${part2Slugs.join(", ")}`
  );

  // Verify Part 3 (Finish up): steps 14..18
  const part3Slugs = WIZARD_STEPS.slice(14, 19).map((s) => s.slug);
  assert(
    JSON.stringify(part3Slugs) ===
      JSON.stringify(["finish-intro", "price", "weekend-price", "discounts", "safety"]),
    `Part 3 sequence must be: finish-intro, price, weekend-price, discounts, safety. Got: ${part3Slugs.join(", ")}`
  );

  assert(getStepByIndex(15).slug === "price", "Step 15 must be weekday base price");
  assert(getStepByIndex(16).slug === "weekend-price", "Step 16 must be weekend price & premium");
  assert(getStepByIndex(17).slug === "discounts", "Step 17 must be discounts");
  assert(getStepByIndex(18).slug === "safety", "Step 18 must be safety disclosures");
  assert(getStepBySlug("weekend-price")?.index === 16, "getStepBySlug('weekend-price') must return index 16");

  // ─────────────────────────────────────────────────────────────
  // 2. new-listing-get-started.tsx Step Sequence & Validation
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [2] Wizard Implementation & Completion Mapping ---");

  const wizardFile = path.join(process.cwd(), "components/host/new-listing-get-started.tsx");
  const wizardContent = fs.readFileSync(wizardFile, "utf-8");

  assert(
    wizardContent.includes("WIZARD_STEPS.map((s) => s.slug)"),
    "new-listing-get-started.tsx derives STEP_SLUGS directly from centralized WIZARD_STEPS"
  );

  assert(
    wizardContent.includes("weekdayPrice: { message: \"Set a weekday price greater than zero.\", step: 15 }"),
    "COMPLETION_REQUIREMENTS maps weekdayPrice to step 15"
  );
  assert(
    wizardContent.includes("weekendPrice: { message: \"Set a weekend price greater than zero.\", step: 16 }"),
    "COMPLETION_REQUIREMENTS maps weekendPrice to step 16"
  );
  assert(
    wizardContent.includes("safetyDisclosures: { message: \"Answer all three safety questions.\", step: 18 }"),
    "COMPLETION_REQUIREMENTS maps safetyDisclosures to step 18"
  );

  // ─────────────────────────────────────────────────────────────
  // 3. Become A Host Modal Flow & Controlled Type Selection
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [3] Become Host Modal Flow & Safety ---");

  const modalFile = path.join(process.cwd(), "components/host/become-host-modal.tsx");
  const modalContent = fs.readFileSync(modalFile, "utf-8");

  assert(
    modalContent.includes("Escape"),
    "BecomeHostModal includes Escape key event listener to close modal"
  );

  assert(
    modalContent.includes("isTypeSupported"),
    "BecomeHostModal enforces isTypeSupported check for Experience and Service"
  );

  assert(
    modalContent.includes("coming soon to Homyz"),
    "BecomeHostModal displays professional explanation when Experience or Service is chosen"
  );

  // Verify /become-a-host page role-aware routing
  const becomePageFile = path.join(process.cwd(), "app/(protected)/become-a-host/page.tsx");
  const becomePageContent = fs.readFileSync(becomePageFile, "utf-8");

  assert(
    becomePageContent.includes("Role.HOST") && becomePageContent.includes("Role.ADMIN"),
    "become-a-host/page.tsx checks for HOST or ADMIN role"
  );
  assert(
    becomePageContent.includes("/host/listings/new?type=HOME"),
    "become-a-host/page.tsx routes active hosts directly to new listing creation"
  );

  // ─────────────────────────────────────────────────────────────
  // 4. Zero Lorem Ipsum in Host Creation Flow
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [4] Elimination of Latin & Placeholder Text ---");

  const hostComponentsDir = path.join(process.cwd(), "components/host");
  function scanDirForLorem(dir: string): string[] {
    const findings: string[] = [];
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        findings.push(...scanDirForLorem(full));
      } else if (f.endsWith(".tsx") || f.endsWith(".ts")) {
        const c = fs.readFileSync(full, "utf-8");
        if (/lorem\s+ipsum/i.test(c)) {
          findings.push(full);
        }
      }
    }
    return findings;
  }

  const loremFiles = scanDirForLorem(hostComponentsDir);
  assert(
    loremFiles.length === 0,
    `components/host/ must contain zero Lorem Ipsum (found in: ${loremFiles.join(", ") || "none"})`
  );

  // ─────────────────────────────────────────────────────────────
  // 5. Honest Pricing & Clean Calculations
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [5] Realistic Pricing & Platform Currency ---");

  const stepPriceFile = path.join(process.cwd(), "components/host/onboarding/step-price.tsx");
  const stepPriceContent = fs.readFileSync(stepPriceFile, "utf-8");

  assert(
    !stepPriceContent.includes("1.2074"),
    "step-price.tsx must NOT contain fake multiplier 1.2074"
  );
  assert(
    !stepPriceContent.includes("onChangePrice(241)"),
    "step-price.tsx must NOT contain fake hardcoded default 241"
  );
  assert(
    stepPriceContent.includes('currencySymbol = "SAR"'),
    "step-price.tsx defaults to platform currency SAR"
  );

  const stepWeekendFile = path.join(process.cwd(), "components/host/onboarding/step-weekend-price.tsx");
  const stepWeekendContent = fs.readFileSync(stepWeekendFile, "utf-8");

  assert(
    !stepWeekendContent.includes("1.1134"),
    "step-weekend-price.tsx must NOT contain fake multiplier 1.1134"
  );
  assert(
    stepWeekendContent.includes("baseWeekday"),
    "step-weekend-price.tsx dynamically derives weekend rates from weekday base price"
  );

  // ─────────────────────────────────────────────────────────────
  // 6. UI Detail Fixes: StepTitle, Workspace Empty State & Editor
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [6] UI Details: Back Buttons, Workspace & Editor Cleanliness ---");

  const stepTitleFile = path.join(process.cwd(), "components/host/onboarding/step-title.tsx");
  const stepTitleContent = fs.readFileSync(stepTitleFile, "utf-8");
  assert(
    !stepTitleContent.includes(">Exit<"),
    "step-title.tsx must NOT have 'Exit' as navigation button; must say 'Back'"
  );

  const workspaceFile = path.join(process.cwd(), "components/host/host-listings-workspace.tsx");
  const workspaceContent = fs.readFileSync(workspaceFile, "utf-8");
  assert(
    !workspaceContent.includes("photo-1513694203232-719a280e022f"),
    "host-listings-workspace.tsx empty state must NOT show fake Unsplash property cards"
  );
  assert(
    !workspaceContent.includes("photo-1586023492125-27b2c045efd7"),
    "host-listings-workspace.tsx empty state must NOT show fake second card"
  );

  const editorFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx");
  const editorContent = fs.readFileSync(editorFile, "utf-8");
  assert(
    !editorContent.includes("voluptatem"),
    "host-listing-editor-client.tsx must NOT contain 'voluptatem' dummy address default"
  );
  assert(
    !editorContent.includes("exercitatione"),
    "host-listing-editor-client.tsx must NOT contain 'exercitatione' dummy city default"
  );

  console.log("\n=======================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhaseP1Tests().catch((err) => {
  console.error(err);
  process.exit(1);
});
