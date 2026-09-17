import "dotenv/config";
import fs from "fs";
import path from "path";

async function runDarkModeBackButtonTests() {
  console.log("\n=======================================================");
  console.log("   DARK MODE BACK BUTTON & CONTROLS VERIFICATION       ");
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

  // 1. Universal BackButton component in components/ui/back-button.tsx
  console.log("--- [1] Universal BackButton Dark Mode Styling ---");
  const backButtonFile = path.join(process.cwd(), "components/ui/back-button.tsx");
  const backButtonContent = fs.readFileSync(backButtonFile, "utf-8");

  assert(
    backButtonContent.includes("dark:border-zinc-700") &&
    backButtonContent.includes("dark:bg-zinc-800") &&
    backButtonContent.includes("dark:text-zinc-100") &&
    backButtonContent.includes("dark:hover:bg-zinc-700"),
    "BackButton component includes dark mode border, background, text, and hover state styling"
  );

  assert(
    backButtonContent.includes("dark:group-hover:stroke-white"),
    "BackButton SVG icon path includes dark:group-hover:stroke-white stroke rule"
  );

  // 2. OnboardingBackButton component in components/host/onboarding/onboarding-back-button.tsx
  console.log("\n--- [2] Onboarding BackButton Dark Mode Styling ---");
  const onboardingBackFile = path.join(process.cwd(), "components/host/onboarding/onboarding-back-button.tsx");
  const onboardingBackContent = fs.readFileSync(onboardingBackFile, "utf-8");

  assert(
    onboardingBackContent.includes("dark:border-zinc-700") &&
    onboardingBackContent.includes("dark:bg-zinc-800") &&
    onboardingBackContent.includes("dark:text-zinc-100") &&
    onboardingBackContent.includes("dark:hover:bg-zinc-700"),
    "OnboardingBackButton includes dark mode styling"
  );

  // 3. OnboardingMobileCloseButton component
  console.log("\n--- [3] Onboarding Mobile Close/Back Button ---");
  const onboardingCloseFile = path.join(process.cwd(), "components/host/onboarding/onboarding-mobile-close-button.tsx");
  const onboardingCloseContent = fs.readFileSync(onboardingCloseFile, "utf-8");

  assert(
    onboardingCloseContent.includes("dark:text-zinc-100") &&
    onboardingCloseContent.includes("dark:hover:bg-zinc-800"),
    "OnboardingMobileCloseButton includes dark mode text and hover styling"
  );

  // 4. EditorSidebar Back & Navigation controls
  console.log("\n--- [4] EditorSidebar Back & Navigation Controls ---");
  const editorSidebarFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/EditorSidebar.tsx");
  const editorSidebarContent = fs.readFileSync(editorSidebarFile, "utf-8");

  assert(
    editorSidebarContent.includes("dark:border-zinc-700") &&
    editorSidebarContent.includes("dark:bg-zinc-800") &&
    editorSidebarContent.includes("dark:text-zinc-100"),
    "EditorSidebar Header Back link includes dark mode styling"
  );

  assert(
    editorSidebarContent.includes("dark:hover:bg-zinc-700"),
    "EditorSidebar navigation controls include dark mode hover states"
  );

  // 5. Host Sub Nav & Workspace Back/Nav controls
  console.log("\n--- [5] Host Sub Nav & Workspace Controls ---");
  const hostSubNavFile = path.join(process.cwd(), "components/host/host-sub-nav.tsx");
  const hostSubNavContent = fs.readFileSync(hostSubNavFile, "utf-8");

  assert(
    hostSubNavContent.includes("dark:bg-zinc-800/80") &&
    hostSubNavContent.includes("dark:border-zinc-700") &&
    hostSubNavContent.includes("dark:text-zinc-300"),
    "HostSubNav buttons include dark mode styling"
  );

  // 6. Description Notes & 'Learn More' Button Styling in Dark Mode
  console.log("\n--- [6] Description Notes & 'Learn More' Dark Mode Styling ---");
  const pricingFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx");
  const pricingContent = fs.readFileSync(pricingFile, "utf-8");

  assert(
    pricingContent.includes("dark:text-zinc-400") &&
    pricingContent.includes("dark:text-zinc-100") &&
    pricingContent.includes("dark:hover:text-amber-400"),
    "Pricing & Availability description note and 'Learn more' button include dark mode classes"
  );

  const propDetailsFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PropertyDetailsViews.tsx");
  const propDetailsContent = fs.readFileSync(propDetailsFile, "utf-8");

  assert(
    propDetailsContent.includes("dark:text-zinc-400") &&
    propDetailsContent.includes("dark:text-zinc-100") &&
    propDetailsContent.includes("dark:hover:text-amber-400"),
    "PropertyDetails Description note and 'Learn more' link include dark mode classes"
  );

  // 7. Listing Description Cards & Accordion Styling in Dark Mode
  console.log("\n--- [7] Listing Description Cards Dark Mode Styling ---");
  assert(
    propDetailsContent.includes("dark:bg-zinc-800/90") &&
    propDetailsContent.includes("dark:border-zinc-700") &&
    propDetailsContent.includes("dark:text-zinc-100") &&
    propDetailsContent.includes("dark:bg-zinc-900") &&
    propDetailsContent.includes("dark:placeholder-zinc-500"),
    "PropertyDetails Description section cards, headers, textareas, and save buttons include dark mode classes"
  );

  // 8. Location Section Cards & Map Zoom Controls in Dark Mode
  console.log("\n--- [8] Location Section Cards & Map Zoom Controls Dark Mode Styling ---");
  const realMapFile = path.join(process.cwd(), "components/ui/real-map.tsx");
  const realMapContent = fs.readFileSync(realMapFile, "utf-8");

  assert(
    realMapContent.includes("dark:bg-zinc-800") &&
    realMapContent.includes("dark:hover:bg-zinc-700") &&
    realMapContent.includes("dark:text-zinc-100") &&
    realMapContent.includes("dark:invert"),
    "RealMap zoom buttons (+, -) and icons include dark mode and invert styling"
  );

  const hostLocationViewsFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/HostAndLocationViews.tsx");
  const hostLocationViewsContent = fs.readFileSync(hostLocationViewsFile, "utf-8");

  assert(
    hostLocationViewsContent.includes("dark:bg-zinc-800") &&
    hostLocationViewsContent.includes("dark:border-zinc-700") &&
    hostLocationViewsContent.includes("dark:text-zinc-100") &&
    hostLocationViewsContent.includes("dark:text-zinc-400") &&
    hostLocationViewsContent.includes("dark:bg-amber-400"),
    "HostAndLocationViews Location sharing card, features, accordion titles, and save buttons include dark mode classes"
  );

  // 9. Property Type Dropdown Arrows & Building Floors Counter Buttons in Dark Mode
  console.log("\n--- [9] Property Type Dropdowns & Floors Counter Controls Dark Mode Styling ---");
  assert(
    propDetailsContent.includes("stroke=\"currentColor\"") &&
    propDetailsContent.includes("dark:border-zinc-700") &&
    propDetailsContent.includes("dark:bg-zinc-800") &&
    propDetailsContent.includes("dark:text-zinc-100") &&
    propDetailsContent.includes("dark:invert"),
    "PropertyDetails Property type dropdown arrow SVG stroke uses currentColor and floor counters use dark mode/invert styling"
  );

  // 10. Sleeping Arrangements & Bathroom Privacy (Private / Shared) Buttons in Dark Mode
  console.log("\n--- [10] Sleeping Arrangements & Bathroom Privacy Buttons Dark Mode Styling ---");
  assert(
    propDetailsContent.includes("Private") &&
    propDetailsContent.includes("Shared") &&
    propDetailsContent.includes("dark:bg-amber-400") &&
    propDetailsContent.includes("dark:text-zinc-950") &&
    propDetailsContent.includes("dark:hover:bg-zinc-700"),
    "PropertyDetails Sleeping arrangements Private and Shared buttons include dark mode state classes"
  );

  // 11. Photos & Photo Tour / Unassigned Photos Section Dark Mode Styling
  console.log("\n--- [11] Photos & Photo Tour / Unassigned Photos Dark Mode Styling ---");
  const photoTourFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx");
  const photoTourContent = fs.readFileSync(photoTourFile, "utf-8");

  assert(
    photoTourContent.includes("dark:bg-zinc-700") &&
    photoTourContent.includes("dark:text-zinc-200") &&
    photoTourContent.includes("dark:bg-zinc-800/40") &&
    photoTourContent.includes("dark:border-zinc-700") &&
    photoTourContent.includes("dark:text-zinc-100"),
    "PhotoTourManager Unassigned Photos section and room cards include dark mode background, border, and text styling"
  );

  // 12. Amenities & Accessibility Features Dark Mode Styling
  console.log("\n--- [12] Amenities & Accessibility Features Dark Mode Styling ---");
  assert(
    propDetailsContent.includes("dark:divide-zinc-800") &&
    propDetailsContent.includes("dark:bg-amber-400") &&
    propDetailsContent.includes("dark:border-zinc-700"),
    "PropertyDetails Amenities and Accessibility sections include dark mode divider, background, border, and text styling"
  );

  // 13. About Host View Dark Mode Styling
  console.log("\n--- [13] About Host View Dark Mode Styling ---");
  const hostAboutHostFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/HostAboutHostView.tsx");
  const hostAboutHostContent = fs.readFileSync(hostAboutHostFile, "utf-8");

  assert(
    hostAboutHostContent.includes("dark:text-zinc-100") &&
    hostAboutHostContent.includes("dark:text-zinc-400") &&
    hostAboutHostContent.includes("dark:bg-zinc-800/90") &&
    hostAboutHostContent.includes("dark:border-zinc-700") &&
    hostAboutHostContent.includes("dark:bg-amber-400"),
    "HostAboutHostView section cards, headers, inputs, prompts, chips, and action buttons include dark mode styling"
  );

  // 14. Admin Workspace About Host View Dark Mode Styling
  console.log("\n--- [14] Admin Workspace About Host View Dark Mode Styling ---");
  const adminAboutHostFile = path.join(process.cwd(), "app/(protected)/admin/listings/[id]/components/AdminAboutHostView.tsx");
  const adminAboutHostContent = fs.readFileSync(adminAboutHostFile, "utf-8");

  assert(
    adminAboutHostContent.includes("dark:text-zinc-100") &&
    adminAboutHostContent.includes("dark:text-zinc-400") &&
    adminAboutHostContent.includes("dark:bg-zinc-800") &&
    adminAboutHostContent.includes("dark:border-zinc-700") &&
    adminAboutHostContent.includes("dark:bg-indigo-950/60") &&
    adminAboutHostContent.includes("dark:border-amber-900/60"),
    "AdminAboutHostView cards, headers, view-only banner, inputs, prompts, chips, and sticky action bar include dark mode styling"
  );

  // 15. Pricing Discounts & Fees Calendar Notice Dark Mode Styling
  console.log("\n--- [15] Pricing Discounts & Fees Calendar Notice Dark Mode Styling ---");
  assert(
    pricingContent.includes("dark:border-zinc-700") &&
    pricingContent.includes("dark:bg-zinc-800") &&
    pricingContent.includes("dark:bg-zinc-800/90") &&
    pricingContent.includes("dark:invert") &&
    pricingContent.includes("Find more discounts and fees in the calendar"),
    "PricingAndBookingViews Discounts cards, weekly/monthly inputs, and 'Find more discounts and fees in the calendar' card include dark mode classes"
  );

  // 16. Host Calendar Workspace & Settings Panel Dark Mode Styling
  console.log("\n--- [16] Host Calendar Workspace & Settings Panel Dark Mode Styling ---");
  const calPanelFile = path.join(process.cwd(), "components/host/calendar-settings-panel.tsx");
  const calPanelContent = fs.readFileSync(calPanelFile, "utf-8");
  const calWorkspaceFile = path.join(process.cwd(), "components/host/host-calendar-workspace.tsx");
  const calWorkspaceContent = fs.readFileSync(calWorkspaceFile, "utf-8");

  assert(
    calPanelContent.includes("dark:bg-zinc-800") &&
    calPanelContent.includes("dark:border-zinc-700") &&
    calPanelContent.includes("dark:text-zinc-100") &&
    calWorkspaceContent.includes("dark:bg-zinc-800") &&
    calWorkspaceContent.includes("dark:border-zinc-700") &&
    calWorkspaceContent.includes("dark:text-zinc-100"),
    "CalendarSettingsPanel and HostCalendarWorkspace matrix, month dropdown, price tips modal, and sidebar controls include dark mode styling"
  );

  // 17. House Rules & Modals Dark Mode Styling
  console.log("\n--- [17] House Rules & Modals Dark Mode Styling ---");
  const houseRulesFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/HouseRulesAndArrivalViews.tsx");
  const houseRulesContent = fs.readFileSync(houseRulesFile, "utf-8");
  const editorClientFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx");
  const editorClientContent = fs.readFileSync(editorClientFile, "utf-8");

  assert(
    houseRulesContent.includes("dark:text-zinc-100") &&
    houseRulesContent.includes("dark:text-zinc-400") &&
    houseRulesContent.includes("dark:bg-zinc-800/60") &&
    houseRulesContent.includes("dark:border-zinc-700") &&
    houseRulesContent.includes("dark:bg-zinc-900") &&
    editorClientContent.includes("dark:bg-zinc-900") &&
    editorClientContent.includes("dark:border-zinc-700"),
    "HouseRulesAndArrivalViews rows, quiet hours dropdowns, check-in/checkout modal, and Additional Rules modal include dark mode styling"
  );

  // 18. Guest Safety & Modals Dark Mode Styling
  console.log("\n--- [18] Guest Safety & Modals Dark Mode Styling ---");
  const guestsSafetyFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/GuestsSafetyView.tsx");
  const guestsSafetyContent = fs.readFileSync(guestsSafetyFile, "utf-8");

  assert(
    guestsSafetyContent.includes("dark:text-zinc-100") &&
    guestsSafetyContent.includes("dark:text-zinc-400") &&
    guestsSafetyContent.includes("dark:bg-zinc-900") &&
    guestsSafetyContent.includes("dark:border-zinc-800") &&
    guestsSafetyContent.includes("dark:bg-zinc-800/80") &&
    guestsSafetyContent.includes("dark:divide-zinc-800"),
    "GuestsSafetyView main category rows, AllowDenyButtons, modal overlays, textareas, inputs, learn more modal, and save/cancel buttons include dark mode styling"
  );

  // 19. Local Laws & Resource Centre Modal Dark Mode Styling
  console.log("\n--- [19] Local Laws & Resource Centre Modal Dark Mode Styling ---");
  const localLawsFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/LocalLawsView.tsx");
  const localLawsContent = fs.readFileSync(localLawsFile, "utf-8");

  assert(
    localLawsContent.includes("dark:text-zinc-100") &&
    localLawsContent.includes("dark:text-zinc-400") &&
    localLawsContent.includes("dark:bg-zinc-900") &&
    localLawsContent.includes("dark:border-zinc-800") &&
    localLawsContent.includes("dark:bg-amber-400") &&
    localLawsContent.includes("ModalOverlay"),
    "LocalLawsView header, article trigger card, body paragraphs, Resource Centre modal, AI prompt helper, and action buttons include dark mode styling"
  );

  // 20. Taxes Manager & Modals Dark Mode Styling
  console.log("\n--- [20] Taxes Manager & Modals Dark Mode Styling ---");
  const taxesFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/TaxesManager.tsx");
  const taxesContent = fs.readFileSync(taxesFile, "utf-8");

  assert(
    taxesContent.includes("dark:text-zinc-100") &&
    taxesContent.includes("dark:text-zinc-400") &&
    taxesContent.includes("dark:bg-zinc-900") &&
    taxesContent.includes("dark:border-zinc-800") &&
    taxesContent.includes("dark:bg-zinc-800") &&
    taxesContent.includes("ModalOverlay"),
    "TaxesManager header, platform/host tax cards, Add Tax modal, Learn More drawers, Delete confirmation, and Registration viewer include dark mode styling"
  );

  // 21. Homyz.org Stays & Resource Centre Modal Dark Mode Styling
  console.log("\n--- [21] Homyz.org Stays & Resource Centre Modal Dark Mode Styling ---");
  const orgStaysFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/AirbnbOrgStaysView.tsx");
  const orgStaysContent = fs.readFileSync(orgStaysFile, "utf-8");

  assert(
    orgStaysContent.includes("dark:text-zinc-100") &&
    orgStaysContent.includes("dark:text-zinc-400") &&
    orgStaysContent.includes("dark:bg-zinc-900") &&
    orgStaysContent.includes("dark:border-zinc-800") &&
    orgStaysContent.includes("dark:bg-amber-400") &&
    orgStaysContent.includes("ModalOverlay"),
    "AirbnbOrgStaysView header, guidance box, ON/OFF toggle switch, radio options, how it works list, save/cancel buttons, and Resource Centre modal include dark mode styling"
  );

  // 22. Unsaved Changes & Global Modals Dark Mode Styling
  console.log("\n--- [22] Unsaved Changes & Global Modals Dark Mode Styling ---");
  const removeListingFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/RemoveListingModal.tsx");
  const removeListingContent = fs.readFileSync(removeListingFile, "utf-8");
  const freshEditorClientContent = fs.readFileSync(editorClientFile, "utf-8");

  assert(
    freshEditorClientContent.includes("dark:bg-zinc-900") &&
    freshEditorClientContent.includes("dark:border-zinc-800") &&
    freshEditorClientContent.includes("dark:text-zinc-100") &&
    freshEditorClientContent.includes("dark:text-zinc-400") &&
    freshEditorClientContent.includes("dark:border-zinc-700") &&
    removeListingContent.includes("dark:bg-zinc-900") &&
    removeListingContent.includes("dark:border-zinc-800") &&
    removeListingContent.includes("dark:text-zinc-100") &&
    removeListingContent.includes("dark:divide-zinc-800") &&
    removeListingContent.includes("dark:border-rose-900"),
    "Unsaved changes modal, Turn off Instant Book dialog, Add custom message modal, and Remove listing modal include dark mode styling across containers, headers, text, inputs, warnings, and action buttons"
  );

  assert(
    freshEditorClientContent.includes("Discard changes and leave") &&
    freshEditorClientContent.includes("dark:!bg-zinc-100") &&
    freshEditorClientContent.includes("dark:!text-zinc-950") &&
    freshEditorClientContent.includes("dark:hover:!bg-zinc-200") &&
    freshEditorClientContent.includes("Stay and continue editing") &&
    freshEditorClientContent.includes("dark:bg-zinc-800") &&
    freshEditorClientContent.includes("dark:text-zinc-200") &&
    freshEditorClientContent.includes("dark:hover:bg-zinc-700"),
    "'Discard changes and leave' primary action button and 'Stay and continue editing' secondary button include high contrast dark mode background, text, and hover classes"
  );

  // 23. Custom Listing Link Dark Mode Styling
  console.log("\n--- [23] Custom Listing Link Dark Mode Styling ---");
  const customLinkPricingFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx");
  const customLinkPricingContent = fs.readFileSync(customLinkPricingFile, "utf-8");
  const sidebarFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/EditorSidebar.tsx");
  const sidebarContent = fs.readFileSync(sidebarFile, "utf-8");

  assert(
    customLinkPricingContent.includes("dark:text-zinc-300") &&
    customLinkPricingContent.includes("dark:text-zinc-100") &&
    customLinkPricingContent.includes("dark:text-zinc-400") &&
    customLinkPricingContent.includes("dark:placeholder:text-zinc-600") &&
    customLinkPricingContent.includes("dark:text-red-400") &&
    customLinkPricingContent.includes("dark:text-emerald-400") &&
    customLinkPricingContent.includes("dark:bg-amber-400") &&
    sidebarContent.includes("dark:border-zinc-800") &&
    sidebarContent.includes("dark:bg-zinc-800"),
    "Custom link view in PricingAndBookingViews and EditorSidebar custom link card include dark mode character counter, domain prefix, slug input, validation feedback, save button, and sidebar card styling"
  );

  console.log("\n=======================================================");
  console.log(` ✅ ALL TESTS PASSED: ${passed}/${passed + failed}`);
  console.log("=======================================================\n");
}

runDarkModeBackButtonTests().catch((err) => {
  console.error(err);
  process.exit(1);
});



