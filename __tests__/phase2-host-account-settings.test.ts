import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("\n==================================================================");
console.log("   HOMYZ — PHASE 2: HOST ACCOUNT SETTINGS UI/UX ACCEPTANCE TEST   ");
console.log("==================================================================\n");

// -----------------------------------------------------------------------------
// [1] Route Files & Directory Structure Verification
// -----------------------------------------------------------------------------
console.log("--- [1] Route Files & Directory Structure ---");

const expectedRoutes = [
  "app/(protected)/host/account-settings/layout.tsx",
  "app/(protected)/host/account-settings/page.tsx",
  "app/(protected)/host/account-settings/loading.tsx",
  "app/(protected)/host/account-settings/error.tsx",
  "app/(protected)/host/account-settings/payouts/page.tsx",
  "app/(protected)/host/account-settings/payouts/add/page.tsx",
  "app/(protected)/host/account-settings/payouts/methods/[id]/page.tsx",
  "app/(protected)/host/account-settings/payouts/routing-rules/page.tsx",
  "app/(protected)/host/account-settings/taxes/page.tsx",
  "app/(protected)/host/account-settings/taxes/taxpayers/page.tsx",
  "app/(protected)/host/account-settings/taxes/documents/page.tsx",
  "app/(protected)/host/account-settings/earnings-reports/page.tsx",
  "app/(protected)/host/account-settings/hosting-preferences/page.tsx",
  "app/(protected)/host/account-settings/permissions/page.tsx",
  "app/(protected)/host/account-settings/notifications/page.tsx",
];

for (const relPath of expectedRoutes) {
  const fullPath = path.join(process.cwd(), relPath);
  assert.ok(fs.existsSync(fullPath), `Route file must exist: ${relPath}`);
}
console.log(`✓ All ${expectedRoutes.length} route files verified in app/(protected)/host/account-settings/`);

// -----------------------------------------------------------------------------
// [2] Reusable UI Components Infrastructure Verification
// -----------------------------------------------------------------------------
console.log("\n--- [2] Reusable UI Components Infrastructure ---");

const expectedComponents = [
  "components/host/account-settings/index.ts",
  "components/host/account-settings/icons.tsx",
  "components/host/account-settings/settings-status-badge.tsx",
  "components/host/account-settings/settings-section-card.tsx",
  "components/host/account-settings/settings-page-header.tsx",
  "components/host/account-settings/host-settings-navigation.tsx",
  "components/host/account-settings/settings-help-card.tsx",
  "components/host/account-settings/settings-empty-state.tsx",
  "components/host/account-settings/settings-error-state.tsx",
  "components/host/account-settings/settings-loading-skeleton.tsx",
  "components/host/account-settings/settings-responsive-drawer.tsx",
  "components/host/account-settings/host-account-settings-layout.tsx",
];

for (const compPath of expectedComponents) {
  const fullPath = path.join(process.cwd(), compPath);
  assert.ok(fs.existsSync(fullPath), `Component file must exist: ${compPath}`);
}
console.log(`✓ All ${expectedComponents.length} component infrastructure files verified`);

// -----------------------------------------------------------------------------
// [3] Header Navigation Correction Verification
// -----------------------------------------------------------------------------
console.log("\n--- [3] Header Navigation Correction (app-header.tsx) ---");

const headerSource = fs.readFileSync(
  path.join(process.cwd(), "components/dashboard/app-header.tsx"),
  "utf-8"
);

// In hosting mode (isHosting === true), Account Settings must link to /host/account-settings
assert.ok(
  headerSource.includes('href="/host/account-settings"'),
  "app-header.tsx hosting menu must link to /host/account-settings"
);
assert.ok(
  headerSource.includes('pathname?.startsWith("/host/account-settings")'),
  "app-header.tsx hosting menu must activate on /host/account-settings"
);

// In guest/traveling mode, Account Settings must preserve /profile/tab/account_settings
assert.ok(
  headerSource.includes('href="/profile/tab/account_settings"'),
  "app-header.tsx guest menu must preserve /profile/tab/account_settings"
);

// Verify guest menu does NOT falsely highlight on /host/account-settings
assert.ok(
  headerSource.includes('!pathname?.startsWith("/host/account-settings")'),
  "app-header.tsx guest menu must exclude /host/account-settings from active highlighting"
);
console.log("✓ Header navigation separation for Hosting vs Traveling mode verified");

// -----------------------------------------------------------------------------
// [4] Server-Side Route Protection Verification
// -----------------------------------------------------------------------------
console.log("\n--- [4] Server-Side Role Protection ---");

const layoutSource = fs.readFileSync(
  path.join(process.cwd(), "app/(protected)/host/account-settings/layout.tsx"),
  "utf-8"
);
assert.ok(
  layoutSource.includes("requirePageRole([Role.HOST, Role.ADMIN])"),
  "Root layout must enforce requirePageRole([Role.HOST, Role.ADMIN])"
);

const mainPageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(protected)/host/account-settings/page.tsx"),
  "utf-8"
);
assert.ok(
  mainPageSource.includes("requirePageRole([Role.HOST, Role.ADMIN])"),
  "Main landing page must enforce requirePageRole([Role.HOST, Role.ADMIN])"
);
console.log("✓ Server-side route guards strictly enforced");

// -----------------------------------------------------------------------------
// [5] Six Main Navigation Sections Verification
// -----------------------------------------------------------------------------
console.log("\n--- [5] Six Main Navigation Sections on Landing Page ---");

const sections = [
  { title: "Payout Settings", href: "/host/account-settings/payouts" },
  { title: "Tax Information", href: "/host/account-settings/taxes" },
  { title: "Earnings Reports & Documents", href: "/host/account-settings/earnings-reports" },
  { title: "Hosting Preferences", href: "/host/account-settings/hosting-preferences" },
  { title: "Financial Permissions", href: "/host/account-settings/permissions" },
  { title: "Notifications & Help", href: "/host/account-settings/notifications" },
];

for (const section of sections) {
  assert.ok(
    mainPageSource.includes(section.title),
    `Main landing page must render section title: "${section.title}"`
  );
  assert.ok(
    mainPageSource.includes(section.href),
    `Main landing page must link to section route: "${section.href}"`
  );
}
console.log("✓ All 6 required navigation sections verified on landing page");

// -----------------------------------------------------------------------------
// [6] Existing System Integrity & Non-Duplication Verification
// -----------------------------------------------------------------------------
console.log("\n--- [6] Existing System Integrity & Non-Duplication ---");

// Host Earnings must remain intact
assert.ok(
  fs.existsSync(path.join(process.cwd(), "app/(protected)/host/earnings/page.tsx")),
  "Existing /host/earnings/page.tsx must remain intact"
);
assert.ok(
  fs.existsSync(path.join(process.cwd(), "app/(protected)/host/earnings/reports/page.tsx")),
  "Existing /host/earnings/reports/page.tsx must remain intact"
);

// Guest Profile Account Settings must remain intact
assert.ok(
  fs.existsSync(path.join(process.cwd(), "app/(protected)/profile/profile-client.tsx")),
  "Existing /profile/profile-client.tsx must remain intact"
);

// Listing Tax Settings must remain intact
assert.ok(
  fs.existsSync(path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/TaxesManager.tsx")),
  "Existing TaxesManager.tsx must remain intact"
);
console.log("✓ Existing authoritative earnings, reports, guest profile, and listing taxes preserved");

// -----------------------------------------------------------------------------
// [7] Accessibility & Responsive Markup Verification
// -----------------------------------------------------------------------------
console.log("\n--- [7] Accessibility & Semantic Markup ---");

const navSource = fs.readFileSync(
  path.join(process.cwd(), "components/host/account-settings/host-settings-navigation.tsx"),
  "utf-8"
);
assert.ok(navSource.includes('aria-label="Host settings tabs"'), "Mobile navigation must have aria-label");
assert.ok(navSource.includes('aria-label="Host settings menu"'), "Desktop navigation must have aria-label");
assert.ok(navSource.includes('aria-current='), "Active nav item must announce aria-current");

const cardSource = fs.readFileSync(
  path.join(process.cwd(), "components/host/account-settings/settings-section-card.tsx"),
  "utf-8"
);
assert.ok(cardSource.includes('aria-label='), "Section card link must have accessible aria-label");

console.log("✓ Semantic navigation and ARIA attributes verified");

console.log("\n==================================================================");
console.log("   ALL PHASE 2 ACCEPTANCE CRITERIA SUCCESSFULLY VERIFIED!         ");
console.log("==================================================================\n");

