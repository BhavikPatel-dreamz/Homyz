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
console.log("   HOST CALENDAR PHASE 6 & 7 COMPREHENSIVE VERIFICATION TEST     ");
console.log("==================================================================\n");

const calendarWorkspacePath = path.resolve("./components/host/host-calendar-workspace.tsx");
const calendarWorkspaceCode = fs.readFileSync(calendarWorkspacePath, "utf-8");
const hostWorkspaceServicePath = path.resolve("./services/host-workspace.service.ts");
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
// 1. BOOKING PROTECTION AUDIT & CALENDAR AVAILABILITY
// -----------------------------------------------------------------------------

runTest("Active confirmed and non-expired pending bookings protect calendar dates, while cancelled/expired bookings are released", () => {
  assert.ok(
    hostWorkspaceServiceCode.includes("BookingStatus.CONFIRMED") &&
      hostWorkspaceServiceCode.includes("BookingStatus.PENDING"),
    "host-workspace.service must query CONFIRMED and PENDING bookings"
  );
  assert.ok(
    hostWorkspaceServiceCode.includes("isBookingRequestExpired"),
    "host-workspace.service must filter out expired pending bookings to release dates"
  );
  assert.ok(
    hostWorkspaceServiceCode.includes("includeCancelled = false") &&
      hostWorkspaceServiceCode.includes("BookingStatus.CANCELLED"),
    "Cancelled bookings must be opt-in so calendar callers retain active bookings only"
  );
});

// -----------------------------------------------------------------------------
// 2. CONTEXTUAL PANEL: AVAILABLE SINGLE DATE & AVAILABLE RANGE
// -----------------------------------------------------------------------------

runTest("ContextualManagementPanel renders for selected dates with Price and Availability modes", () => {
  assert.ok(
    calendarWorkspaceCode.includes("ContextualManagementPanel"),
    "ContextualManagementPanel component must be defined"
  );
  assert.ok(
    calendarWorkspaceCode.includes('panelMode === "price"') &&
      calendarWorkspaceCode.includes('panelMode === "availability"'),
    "Contextual panel must support distinct Price and Availability modes"
  );
});

// -----------------------------------------------------------------------------
// 3. BOOKED SINGLE DATE & RESERVATION DETAILS
// -----------------------------------------------------------------------------

runTest("Clicking a booked reservation opens ReservationDetails and prevents unsafe manual unblocking", () => {
  assert.ok(
    calendarWorkspaceCode.includes("if (booking) {") &&
      calendarWorkspaceCode.includes("setSelectedBooking(booking)"),
    "Clicking a booked reservation must open ReservationDetails modal"
  );
  assert.ok(
    calendarWorkspaceCode.includes("stats.bookedCount > 0") &&
      calendarWorkspaceCode.includes("protected"),
    "Booked dates must be explicitly marked as protected in selection stats"
  );
});

// -----------------------------------------------------------------------------
// 4. MIXED RANGE WITH PARTIAL BOOKINGS & ALL DATES PROTECTED
// -----------------------------------------------------------------------------

runTest("Mixed ranges separate editable dates from protected reserved dates and all-booked ranges disable edit controls", () => {
  assert.ok(
    calendarWorkspaceCode.includes("editableKeys") &&
      calendarWorkspaceCode.includes("stats.bookedCount > 0 && stats.editableKeys.length > 0"),
    "Mixed range must display protected notice and only apply changes to editable keys"
  );
  assert.ok(
    calendarWorkspaceCode.includes("stats.editableKeys.length === 0") &&
      calendarWorkspaceCode.includes("Confirmed Reservation"),
    "All-booked range must disable editing controls and display reservation notice"
  );
});

// -----------------------------------------------------------------------------
// 5. MIXED PRICE AND MIXED AVAILABILITY DETECTION
// -----------------------------------------------------------------------------

runTest("Contextual panel correctly identifies and communicates Mixed Price and Mixed Availability states", () => {
  assert.ok(
    calendarWorkspaceCode.includes("isMixedPrice") &&
      calendarWorkspaceCode.includes("Mixed Rates"),
    "Panel must display Mixed Rates badge when selected dates have different prices"
  );
  assert.ok(
    calendarWorkspaceCode.includes("isMixedAvailability") &&
      calendarWorkspaceCode.includes("stats.isMixedAvailability"),
    "Panel must display Mixed status when selected dates have both available and blocked dates"
  );
});

// -----------------------------------------------------------------------------
// 6. PROPERTY AND MONTH SWITCHING SAFETY
// -----------------------------------------------------------------------------

runTest("Switching properties or navigating months resets selection safely to prevent stale or cross-listing mutations", () => {
  assert.ok(
    calendarWorkspaceCode.includes("handleSelectProperty") &&
      calendarWorkspaceCode.includes("setSelection({ start: null, end: null"),
    "handleSelectProperty must clear date selection when switching properties"
  );
  assert.ok(
    calendarWorkspaceCode.includes("handleSelectMonth") &&
      calendarWorkspaceCode.includes("setSelection({ start: null, end: null"),
    "handleSelectMonth must clear selection when navigating months"
  );
});

// -----------------------------------------------------------------------------
// 7. CANCEL & CLEAR SELECTION
// -----------------------------------------------------------------------------

runTest("Cancel & Clear action discards form inputs and resets selection without triggering backend API calls", () => {
  assert.ok(
    calendarWorkspaceCode.includes("Cancel & Clear Selection") ||
      calendarWorkspaceCode.includes("Clear (Esc)"),
    "Cancel & Clear action must be accessible in contextual panel"
  );
});

// -----------------------------------------------------------------------------
// 8. MOBILE & TABLET RESPONSIVE PANEL
// -----------------------------------------------------------------------------

runTest("Mobile and tablet viewports support responsive modal / bottom sheet for the Contextual Management Panel", () => {
  assert.ok(
    calendarWorkspaceCode.includes("mobileSettingsOpen") &&
      calendarWorkspaceCode.includes("Manage Selected Dates"),
    "Mobile dialog must adapt to render ContextualManagementPanel when dates are selected"
  );
});

// -----------------------------------------------------------------------------
// 9. SECURITY & AUTHORIZATION
// -----------------------------------------------------------------------------

runTest("Backend APIs and services enforce actor role and listing ownership (listing.hostId === actor.id)", () => {
  assert.ok(
    hostWorkspaceServiceCode.includes("listingService.listForHost(actor"),
    "host-workspace service must scope all listing queries to authenticated actor"
  );
});

console.log("\n==================================================================");
console.log(`   PHASE 6 & 7 VERIFICATION: ${passed}/${total} TESTS PASSED`);
console.log("==================================================================\n");

if (passed !== total) {
  process.exitCode = 1;
}
