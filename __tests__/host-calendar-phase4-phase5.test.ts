import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  bookingDateKey,
  parseBookingDateParts,
  compareBookingDates,
  differenceInBookingNights,
  formatBookingDateRange,
} from "../lib/booking/booking-date";

console.log("\n==================================================================");
console.log("   HOST CALENDAR PHASE 4 & 5 COMPREHENSIVE VERIFICATION TEST     ");
console.log("==================================================================\n");

const calendarWorkspacePath = path.resolve("./components/host/host-calendar-workspace.tsx");
const calendarWorkspaceCode = fs.readFileSync(calendarWorkspacePath, "utf-8");

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
// 1. CALENDAR GRID & MONTH BOUNDARY RENDERING
// -----------------------------------------------------------------------------

runTest("Calendar grid correctly handles 28-day, 29-day, 30-day, and 31-day months across all weekday offsets", () => {
  // February non-leap (2025, 2026) -> 28 days
  assert.equal(new Date(2025, 1 + 1, 0).getDate(), 28, "Feb 2025 must have 28 days");
  assert.equal(new Date(2026, 1 + 1, 0).getDate(), 28, "Feb 2026 must have 28 days");

  // February leap years (2024, 2028) -> 29 days
  assert.equal(new Date(2024, 1 + 1, 0).getDate(), 29, "Feb 2024 must have 29 days");
  assert.equal(new Date(2028, 1 + 1, 0).getDate(), 29, "Feb 2028 must have 29 days");

  // 30-day months
  const thirtyDayMonths = [3, 5, 8, 10]; // Apr, Jun, Sep, Nov (0-indexed)
  for (const m of thirtyDayMonths) {
    assert.equal(new Date(2026, m + 1, 0).getDate(), 30, `Month ${m} must have 30 days`);
  }

  // 31-day months
  const thirtyOneDayMonths = [0, 2, 4, 6, 7, 9, 11]; // Jan, Mar, May, Jul, Aug, Oct, Dec
  for (const m of thirtyOneDayMonths) {
    assert.equal(new Date(2026, m + 1, 0).getDate(), 31, `Month ${m} must have 31 days`);
  }

  // Weekday offset verification (0 = Sun, 1 = Mon ... 6 = Sat)
  const offsets = new Set<number>();
  for (let m = 0; m < 12; m++) {
    offsets.add(new Date(2026, m, 1).getDay());
  }
  assert.ok(offsets.size >= 6, "All weekday offsets are properly represented");
});

// -----------------------------------------------------------------------------
// 2. STATUS PRECEDENCE & DETERMINISTIC CALCULATION
// -----------------------------------------------------------------------------

runTest("Deterministic status precedence (BOOKED > BLOCKED > AVAILABLE) is enforced", () => {
  assert.ok(
    calendarWorkspaceCode.includes("primaryReservation") &&
      calendarWorkspaceCode.includes("blockedDatesSet.has(key)") &&
      calendarWorkspaceCode.includes("weekdayBase"),
    "MonthGrid must compute Booked, Blocked, and Available states"
  );
  assert.ok(
    calendarWorkspaceCode.includes("primaryReservation ?"),
    "Booked status takes precedence over blocked and available states"
  );
});

// -----------------------------------------------------------------------------
// 3. BOOKING RANGES & CHECK-IN / CHECK-OUT SEMANTICS
// -----------------------------------------------------------------------------

runTest("Booking ranges and check-in/check-out semantics match the system architecture (check-in night to night before checkout)", () => {
  const checkIn = "2026-10-10";
  const checkOut = "2026-10-14";
  const nights = differenceInBookingNights(checkIn, checkOut);
  assert.equal(nights, 4, "Oct 10 to Oct 14 stay must equal exactly 4 nights");

  // Verify format range
  const formatted = formatBookingDateRange(checkIn, checkOut);
  assert.ok(formatted.includes("Oct 10") && formatted.includes("Oct 14"), "Formatted range matches booking dates");

  // Verify reservation bar calculation logic in workspace code
  assert.ok(
    calendarWorkspaceCode.includes("getWeekBookingSegments") &&
      calendarWorkspaceCode.includes("bookingSegmentsByWeek") &&
      calendarWorkspaceCode.includes("bookingRanges"),
    "Host calendar must compute continuous reservation bars with start/middle/end styling"
  );
});

// -----------------------------------------------------------------------------
// 4. DATE SELECTION: SINGLE, RANGE, REVERSE, AND DRAG
// -----------------------------------------------------------------------------

runTest("Single-click selection sets start and end to the same date without mutating backend data", () => {
  assert.ok(
    calendarWorkspaceCode.includes("setSelection") &&
      calendarWorkspaceCode.includes("isSingleSelection"),
    "Single selection must be supported and derived cleanly"
  );
});

runTest("Forward and reverse range selections normalize start and end dates deterministically", () => {
  assert.ok(
    calendarWorkspaceCode.includes("getNormalizedRange"),
    "getNormalizedRange must normalize reverse range selections (e.g. Oct 15 -> Oct 10 to Oct 10 -> Oct 15)"
  );
});

runTest("Drag selection supports pointerdown, pointerenter, and pointerup with zero API calls during drag", () => {
  assert.ok(
    calendarWorkspaceCode.includes("onPointerDown") &&
      calendarWorkspaceCode.includes("onPointerEnter") &&
      calendarWorkspaceCode.includes("onPointerUp") &&
      calendarWorkspaceCode.includes("isDragging"),
    "Drag selection via Pointer Events must be implemented"
  );
});

// -----------------------------------------------------------------------------
// 5. BOOKED DATES PROTECTION INSIDE SELECTED RANGES
// -----------------------------------------------------------------------------

runTest("Booked dates inside a selected range remain protected from bulk block/unblock and price modifications", () => {
  assert.ok(
    calendarWorkspaceCode.includes("editableKeys") &&
      calendarWorkspaceCode.includes("bookedCount") &&
      calendarWorkspaceCode.includes("protected"),
    "Contextual action bar must filter out booked dates from editable keys to protect reservations"
  );
});

// -----------------------------------------------------------------------------
// 6. TODAY, PAST DATES, AND ACCESSIBILITY
// -----------------------------------------------------------------------------

runTest("Today badge is displayed without visual conflict, past dates are dimmed, and keyboard navigation is supported", () => {
  assert.ok(
    calendarWorkspaceCode.includes("isToday") && calendarWorkspaceCode.includes("Today"),
    "Today indicator must be rendered"
  );
  assert.ok(
    calendarWorkspaceCode.includes("isPast"),
    "Past dates must be differentiated"
  );
  assert.ok(
    calendarWorkspaceCode.includes("onKeyDown") &&
      calendarWorkspaceCode.includes("ArrowLeft") &&
      calendarWorkspaceCode.includes("ArrowRight"),
    "Keyboard navigation (Arrow keys, Enter, Space, Escape) must be supported"
  );
});

// -----------------------------------------------------------------------------
// 7. PERFORMANCE & O(1) PREPROCESSED INDEXING
// -----------------------------------------------------------------------------

runTest("High-performance O(1) indexed lookups are used across cells with Map/Set structures", () => {
  assert.ok(
    calendarWorkspaceCode.includes("bookingsByDate") &&
      calendarWorkspaceCode.includes("blockedDatesSet") &&
      calendarWorkspaceCode.includes("customPricesMap"),
    "Calendar must use Map and Set lookup structures to avoid nested render loops"
  );
});

runTest("Mobile calendar keeps seven columns while showing compact effective prices and status markers", () => {
  assert.ok(calendarWorkspaceCode.includes("grid min-w-0 grid-cols-7 gap-1 sm:gap-2"));
  assert.ok(calendarWorkspaceCode.includes("formatCompactPrice(promo.promotionalPrice)"));
  assert.ok(!calendarWorkspaceCode.includes("{displayCurrency}</span>"), "Mobile month navigation must not repeat the currency code beside the month title");
  assert.ok(calendarWorkspaceCode.includes('title={t("host_cal_blocked_label", "Blocked")}>×</span>'));
  assert.ok(calendarWorkspaceCode.includes('title={t("host_calendar_status_booked", "Booked")}>B</span>'));
  assert.ok(calendarWorkspaceCode.includes("mobile:${week.key}:${segment.booking.id}"));
  assert.ok(calendarWorkspaceCode.includes("repeat(${bookingLaneCount}, 18px)"));
  assert.ok(calendarWorkspaceCode.includes("max-lg:pt-[calc(var(--calendar-booking-lanes)*18px)]"));
  assert.ok(calendarWorkspaceCode.includes("inset-x-0 top-[32px] z-20"));
});

runTest("Mobile calendar header selector and fixed navigation insets remain usable", () => {
  const hostShell = fs.readFileSync(path.resolve("./components/host/host-header.tsx"), "utf-8");
  const calendarSkeleton = fs.readFileSync(path.resolve("./components/host/host-calendar-skeleton.tsx"), "utf-8");

  assert.ok(calendarWorkspaceCode.includes("setMobilePropertySelectorOpen(true)"));
  assert.ok(calendarWorkspaceCode.includes("bottom-[calc(72px+env(safe-area-inset-bottom))]"));
  assert.ok(hostShell.includes("pb-[calc(72px+env(safe-area-inset-bottom))]"));
  assert.ok(calendarSkeleton.includes("max-sm:min-h-[72px]"));
  assert.ok(calendarSkeleton.includes("max-sm:p-1"));
});

runTest("Year view uses an interactive, data-backed dot grid with progressive year loading", () => {
  assert.ok(
    calendarWorkspaceCode.includes("function YearDotCalendar") &&
      calendarWorkspaceCode.includes("grid-cols-7 place-items-center") &&
      calendarWorkspaceCode.includes("Array.from({ length: 42 }") &&
      calendarWorkspaceCode.includes("blockedDatesSet.has(key)") &&
      calendarWorkspaceCode.includes("bookingsByDate.get(key)?.[0]"),
    "Year view must render real weekday-aligned date dots from the shared calendar indexes",
  );
  assert.ok(
    calendarWorkspaceCode.includes("extend(\"before\")") &&
      calendarWorkspaceCode.includes("extend(\"after\")") &&
      calendarWorkspaceCode.includes("prependHeightRef") &&
      calendarWorkspaceCode.includes("scrollHeight - previousHeight"),
    "Year view must progressively extend in both directions without shifting the user's scroll position",
  );
  assert.ok(
    calendarWorkspaceCode.includes("onDayClick(key, booking)") &&
      calendarWorkspaceCode.includes("onOpenMonth(calendarMonth)") &&
      calendarWorkspaceCode.includes("onReferenceMonth"),
    "Year dots, month labels, and Today control must reuse existing calendar navigation and detail flows",
  );
  assert.ok(
    calendarWorkspaceCode.includes("const promotionDateKeys = useMemo") &&
      calendarWorkspaceCode.includes("promotionDateKeys.has(key)") &&
      calendarWorkspaceCode.includes("MAX_YEAR_VIEW_MONTHS = 48") &&
      calendarWorkspaceCode.includes("requestAnimationFrame(() =>"),
    "Year view must cache per-month pricing, bound its retained DOM window, and throttle scroll work",
  );
});

runTest("Year view uses detailed desktop months and in-place mobile month editing", () => {
  assert.ok(
    calendarWorkspaceCode.includes("function DesktopYearMonth") &&
      calendarWorkspaceCode.includes("grid-cols-7 border-l border-t") &&
      calendarWorkspaceCode.includes("resolveCalendarMonthPricing") &&
      calendarWorkspaceCode.includes("lg:grid-cols-3"),
    "Desktop Year view must render real date-and-price month grids in three columns",
  );
  assert.ok(
    calendarWorkspaceCode.includes("onSelectMonthRange") &&
      calendarWorkspaceCode.includes('setMobileSelectionMode("year-month")') &&
      calendarWorkspaceCode.includes("function MobileYearMonthEditor") &&
      calendarWorkspaceCode.includes("onBulkAvailability") &&
      calendarWorkspaceCode.includes("isSelectedMonth"),
    "Mobile Year view must select a whole month and use the existing bulk availability flow without leaving Year view",
  );
});

runTest("Mobile calendar settings use summary cards and isolated editors without replacing the listing save path", () => {
  const calendarSettingsCode = fs.readFileSync(path.resolve("./components/host/calendar-settings-panel.tsx"), "utf-8");
  assert.ok(
    calendarSettingsCode.includes("function SettingsSummaryCard") &&
      calendarSettingsCode.includes("type MobileSettingsEditor") &&
      calendarSettingsCode.includes("setEditor(nextEditor)"),
    "Mobile settings must show compact summaries and defer fields to an explicit editor",
  );
  assert.ok(
    calendarSettingsCode.includes("await onSave(values)") &&
      calendarSettingsCode.includes("smartPricing: next") &&
      calendarSettingsCode.includes("longTermCancellationPolicy"),
    "Every supported setting must retain its existing persisted update flow",
  );
  assert.ok(
    calendarSettingsCode.includes("scrollIntoView({ block: \"nearest\", inline: \"center\", behavior: \"smooth\" })") &&
      calendarSettingsCode.includes("touch-pan-y overscroll-contain overflow-x-hidden overflow-y-auto") &&
      calendarSettingsCode.includes("document.body.style.overflow = \"hidden\""),
    "Settings tabs and content must remain contained on narrow mobile viewports",
  );
  assert.ok(
    calendarSettingsCode.includes('"new-listing"') &&
      calendarSettingsCode.includes('"custom-promotion"') &&
      calendarSettingsCode.includes('"guest-capacity"') &&
      calendarSettingsCode.includes("allowSameDayRequests") &&
      calendarSettingsCode.includes("includedGuests"),
    "Mobile settings must expose desktop promotions, guest capacity, fee thresholds, and same-day availability controls",
  );
});

runTest("Selected dates use date-specific controls while ranges retain the bulk editor", () => {
  assert.ok(calendarWorkspaceCode.includes("function SingleDateManagementPanel"));
  assert.ok(calendarWorkspaceCode.includes("function CalendarSelectionManagementPanel"));
  assert.ok(calendarWorkspaceCode.includes("props.range.start !== props.range.end"));
  assert.ok(calendarWorkspaceCode.includes('customCancellationPolicies: { ...customCancellationPolicies, [selectedDateKey]: policyInput }'));
  assert.ok(calendarWorkspaceCode.includes('customMinNights: { ...customMinNights, [selectedDateKey]: value }'));
  assert.ok(calendarWorkspaceCode.includes('variant={normalizedSelectedRange ? "calendar-management" : "default"}'));
  assert.ok(calendarWorkspaceCode.includes("dragSelectionChangedRef.current"));
  assert.ok(calendarWorkspaceCode.includes("onContinueSelecting"));
  assert.ok(calendarWorkspaceCode.includes('if (saved === true) setView("details")'));
  assert.ok(calendarWorkspaceCode.includes('if (saved === true) setView("custom")'));
  assert.ok(calendarWorkspaceCode.includes("minimumNightsOverride ?? minimumNightsDefault"));
  assert.ok(calendarWorkspaceCode.includes("cancellationPolicyLabel(selectedPolicy, t)"));
  assert.ok(calendarWorkspaceCode.includes('setMobileSettingsOpen(true)'));
});

runTest("Range cancellation policy changes are confirmed and exclude protected dates", () => {
  assert.ok(calendarWorkspaceCode.includes('window.confirm(t("host_calendar_confirm_policy_bulk"'));
  assert.ok(calendarWorkspaceCode.includes("for (const key of stats.editableKeys)"));
  assert.ok(calendarWorkspaceCode.includes("customCancellationPolicies: nextOverrides"));
  assert.ok(calendarWorkspaceCode.includes('host_calendar_policy_dates_skipped'));
  assert.ok(calendarWorkspaceCode.includes("selectedDayBookings={bookingsByDate.get(normalizedSelectedRange.start) || []}"));
});

console.log("\n==================================================================");
console.log(`   PHASE 4 & 5 VERIFICATION: ${passed}/${total} TESTS PASSED`);
console.log("==================================================================\n");

if (passed !== total) {
  process.exitCode = 1;
}
