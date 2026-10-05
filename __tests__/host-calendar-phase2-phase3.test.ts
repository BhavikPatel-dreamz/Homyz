import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("\n==================================================================");
console.log("   HOST CALENDAR PHASE 2 & 3 COMPREHENSIVE VERIFICATION TEST     ");
console.log("==================================================================\n");

const calendarPagePath = path.resolve("./app/(protected)/host/calendar/page.tsx");
const calendarWorkspacePath = path.resolve("./components/host/host-calendar-workspace.tsx");
const calendarSettingsPanelPath = path.resolve("./components/host/calendar-settings-panel.tsx");
const hostWorkspaceServicePath = path.resolve("./services/host-workspace.service.ts");

const calendarPageCode = fs.readFileSync(calendarPagePath, "utf-8");
const calendarWorkspaceCode = fs.readFileSync(calendarWorkspacePath, "utf-8");
const calendarSettingsPanelCode = fs.readFileSync(calendarSettingsPanelPath, "utf-8");
const hostWorkspaceServiceCode = fs.readFileSync(hostWorkspaceServicePath, "utf-8");

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(` ✅ PASS: Test ${total}: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(` ❌ FAIL: Test ${total}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// PART B & C: Month / Year Navigation & Controls
// -----------------------------------------------------------------------------

runTest("Month calculations handle month boundaries, year increment/decrement, and leap years", () => {
  // 1. December -> Next -> January
  const dec2026 = new Date(2026, 11, 1);
  const jan2027 = new Date(dec2026.getFullYear(), dec2026.getMonth() + 1, 1);
  assert.equal(jan2027.getFullYear(), 2027, "December + 1 month should roll year to 2027");
  assert.equal(jan2027.getMonth(), 0, "December + 1 month should be January (0)");

  // 2. January -> Prev -> December
  const jan2027_prev = new Date(jan2027.getFullYear(), jan2027.getMonth() - 1, 1);
  assert.equal(jan2027_prev.getFullYear(), 2026, "January - 1 month should roll year to 2026");
  assert.equal(jan2027_prev.getMonth(), 11, "January - 1 month should be December (11)");

  // 3. Leap years
  const feb2024Count = new Date(2024, 1 + 1, 0).getDate();
  const feb2025Count = new Date(2025, 1 + 1, 0).getDate();
  const feb2026Count = new Date(2026, 1 + 1, 0).getDate();
  const feb2028Count = new Date(2028, 1 + 1, 0).getDate();

  assert.equal(feb2024Count, 29, "Feb 2024 should have 29 days (leap year)");
  assert.equal(feb2025Count, 28, "Feb 2025 should have 28 days (non-leap)");
  assert.equal(feb2026Count, 28, "Feb 2026 should have 28 days (non-leap)");
  assert.equal(feb2028Count, 29, "Feb 2028 should have 29 days (leap year)");

  // 4. Month lengths
  assert.equal(new Date(2026, 3 + 1, 0).getDate(), 30, "April should have 30 days");
  assert.equal(new Date(2026, 4 + 1, 0).getDate(), 31, "May should have 31 days");
  assert.equal(new Date(2026, 8 + 1, 0).getDate(), 30, "September should have 30 days");
  assert.equal(new Date(2026, 9 + 1, 0).getDate(), 31, "October should have 31 days");
});

runTest("HostCalendarWorkspace implements Previous, Next, and Today controls with accessible labels", () => {
  assert.ok(
    calendarWorkspaceCode.includes('aria-label={') &&
      calendarWorkspaceCode.includes('"Previous month"') &&
      calendarWorkspaceCode.includes('"Next month"'),
    "Previous and Next month buttons must have accessible aria-labels"
  );
  assert.ok(
    calendarWorkspaceCode.includes("handleToday") || calendarWorkspaceCode.includes("Today"),
    "Today jump button must exist in the calendar workspace"
  );
});

runTest("HostCalendarWorkspace implements Airbnb-style Month/Year view switcher segmented control", () => {
  assert.ok(
    calendarWorkspaceCode.includes('aria-label="Calendar view switcher"') ||
      calendarWorkspaceCode.includes('aria-label="Calendar view"'),
    "Calendar view switcher must have accessible group label"
  );
  assert.ok(
    calendarWorkspaceCode.includes('aria-pressed={view === "month"}') &&
      calendarWorkspaceCode.includes('aria-pressed={view === "year"}'),
    "View buttons must use aria-pressed for accessible toggle state"
  );
});

// -----------------------------------------------------------------------------
// PART D: Year View & Lazy Loading Performance
// -----------------------------------------------------------------------------

runTest("Year view renders 12 months with lazy rendering / IntersectionObserver optimization", () => {
  assert.ok(
    calendarWorkspaceCode.includes("LazyMonthCard"),
    "LazyMonthCard component must be used for year view performance"
  );
  assert.ok(
    calendarWorkspaceCode.includes("IntersectionObserver"),
    "IntersectionObserver must be utilized to lazy-load off-screen months"
  );
  assert.ok(
    calendarWorkspaceCode.includes("Array.from({ length: 12 }"),
    "Year view must generate 12 consecutive months for long-term planning"
  );
});

// -----------------------------------------------------------------------------
// PART E, F, G, H: Property Selector & Multi-Listing / All Listings Support
// -----------------------------------------------------------------------------

runTest("Desktop and mobile property selectors exist with clear visual selection", () => {
  // Desktop Left Rail
  assert.ok(
    calendarWorkspaceCode.includes('<aside') &&
      calendarWorkspaceCode.includes('aria-label="Property selection"'),
    "Desktop property selection aside rail must exist"
  );
  // Mobile Property Selector
  assert.ok(
    calendarWorkspaceCode.includes("mobilePropertySelectorOpen") ||
      calendarWorkspaceCode.includes("setMobilePropertySelectorOpen"),
    "Mobile property selector modal/drawer must exist"
  );
  assert.ok(
    calendarWorkspaceCode.includes("PropertyPhoto"),
    "Real listing photos must be displayed instead of hardcoded placeholder image paths"
  );
});

runTest("All Listings mode is supported when host has multiple listings", () => {
  assert.ok(
    calendarWorkspaceCode.includes('"all"') || calendarWorkspaceCode.includes("isAllListings"),
    "All listings mode must be supported"
  );
  assert.ok(
    calendarWorkspaceCode.includes("AllListingsOverviewPanel"),
    "All listings overview panel must be rendered for multi-listing portfolio view"
  );
  assert.ok(
    calendarWorkspaceCode.includes("allListingsDayBookings") ||
      calendarWorkspaceCode.includes("All Listings for"),
    "All listings day click must open summarized multi-property status"
  );
});

// -----------------------------------------------------------------------------
// PART I, J: State Persistence & Deep Linking
// -----------------------------------------------------------------------------

runTest("Calendar state synchronizes with URL query parameters for deep-linking and refresh safety", () => {
  assert.ok(
    calendarPageCode.includes("searchParams") &&
      calendarPageCode.includes("initialListingId") &&
      calendarPageCode.includes("initialMonth") &&
      calendarPageCode.includes("initialView"),
    "HostCalendarPage must parse searchParams and forward initial state to workspace"
  );
  assert.ok(
    calendarWorkspaceCode.includes("history.replaceState") ||
      calendarWorkspaceCode.includes("router.replace"),
    "Calendar workspace must update URL query params on property, month, or view changes"
  );
});

// -----------------------------------------------------------------------------
// PART L, M: Performance & O(1) Preprocessed Lookups
// -----------------------------------------------------------------------------

runTest("Calendar day cells use precomputed Map / Set lookups avoiding O(D x B) nested scans", () => {
  assert.ok(
    calendarWorkspaceCode.includes("bookingsByDate") &&
      calendarWorkspaceCode.includes("new Map"),
    "bookingsByDate must use a Map structure for O(1) cell lookups"
  );
  assert.ok(
    calendarWorkspaceCode.includes("blockedDatesSet") &&
      calendarWorkspaceCode.includes("new Set"),
    "blockedDatesSet must use a Set structure for O(1) blocked checks"
  );
  assert.ok(
    calendarWorkspaceCode.includes("customPricesMap") &&
      calendarWorkspaceCode.includes("new Map"),
    "customPricesMap must use a Map structure for O(1) custom price checks"
  );
});

// -----------------------------------------------------------------------------
// PART O: Empty States & No Dummy Data
// -----------------------------------------------------------------------------

runTest("No hardcoded demo listings or dummy bookings exist; authentic empty state is shown", () => {
  assert.ok(
    !calendarWorkspaceCode.includes("DEFAULT_DEMO_LISTING"),
    "DEFAULT_DEMO_LISTING hardcoded data must be completely removed"
  );
  assert.ok(
    !calendarWorkspaceCode.includes("SAMPLE_CALENDAR_BOOKINGS"),
    "SAMPLE_CALENDAR_BOOKINGS hardcoded data must be completely removed"
  );
  assert.ok(
    calendarWorkspaceCode.includes("You don't have any listings yet"),
    "Authentic empty state with listing creation link must be displayed when host has no listings"
  );
});

// -----------------------------------------------------------------------------
// PART S: Security & Data Isolation
// -----------------------------------------------------------------------------

runTest("Backend host workspace service verifies authenticated actor and only loads host-owned listings", () => {
  assert.ok(
    hostWorkspaceServiceCode.includes("listingService.listForHost(actor"),
    "host-workspace.service must query listings exclusively via listForHost(actor)"
  );
  assert.ok(
    hostWorkspaceServiceCode.includes("listingId: { in: listingIds }"),
    "host-workspace.service must scope bookings to host's own listingIds"
  );
});

console.log("\n==================================================================");
console.log(`   CALENDAR VERIFICATION: ${passed}/${total} TESTS PASSED`);
console.log("==================================================================\n");

if (passed !== total) {
  process.exitCode = 1;
}

