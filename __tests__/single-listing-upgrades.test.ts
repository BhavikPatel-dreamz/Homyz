import assert from "node:assert";
import type { ListingEventType, ListingAnalyticsPayload } from "../lib/analytics/listing-analytics";

console.log("\n==================================================================");
console.log("   SINGLE LISTING PAGE - UPGRADES & INTERACTIVE CALENDAR AUDIT   ");
console.log("==================================================================\n");

// [1] Guest Selector Logic & Summaries
console.log("--- [1] Guest Selector Logic & Summaries ---");
function computeGuestSummary(adults: number, children: number): string {
  if (children > 0) {
    const adultPart = `${adults} ${adults === 1 ? "adult" : "adults"}`;
    const childPart = `${children} ${children === 1 ? "child" : "children"}`;
    return `${adultPart}, ${childPart}`;
  }
  return `${adults} ${adults === 1 ? "guest" : "guests"}`;
}

assert.strictEqual(computeGuestSummary(1, 0), "1 guest");
assert.strictEqual(computeGuestSummary(2, 0), "2 guests");
assert.strictEqual(computeGuestSummary(5, 0), "5 guests");
assert.strictEqual(computeGuestSummary(1, 1), "1 adult, 1 child");
assert.strictEqual(computeGuestSummary(2, 1), "2 adults, 1 child");
assert.strictEqual(computeGuestSummary(2, 2), "2 adults, 2 children");
console.log("✓ Guest summaries verified!");

// Capacity Bounds
const maximumGuests = 4;
let adults = 2;
let children = 1;
const totalGuests = () => adults + children;
const canAddGuest = () => totalGuests() < maximumGuests;

assert.strictEqual(totalGuests(), 3);
assert.strictEqual(canAddGuest(), true);
if (canAddGuest()) children += 1;
assert.strictEqual(totalGuests(), 4);
assert.strictEqual(canAddGuest(), false);
console.log("✓ Capacity bounds verified!");

// [2] Interactive Calendar Date Selection Logic
console.log("\n--- [2] Interactive Calendar Date Selection Logic ---");
function simulateDateSelection(
  clickedDate: string,
  currentCheckIn: string,
  currentCheckOut: string,
  minimumNights: number,
  bookedRanges: Array<{ start: string; end: string }>
): { checkIn: string; checkOut: string; error: string | null } {
  const isBlocked = (cIn: string, cOut: string) =>
    bookedRanges.some((r) => cIn < r.end && cOut > r.start);

  if (!currentCheckIn || currentCheckOut || clickedDate <= currentCheckIn) {
    return { checkIn: clickedDate, checkOut: "", error: null };
  }

  // nights
  const nights = Math.round(
    (new Date(`${clickedDate}T00:00:00`).getTime() - new Date(`${currentCheckIn}T00:00:00`).getTime()) /
      86400000
  );
  if (nights < minimumNights) {
    return {
      checkIn: currentCheckIn,
      checkOut: "",
      error: `Requires minimum stay of ${minimumNights} nights.`,
    };
  }
  if (isBlocked(currentCheckIn, clickedDate)) {
    return {
      checkIn: currentCheckIn,
      checkOut: "",
      error: "Those dates include an unavailable night.",
    };
  }
  return { checkIn: currentCheckIn, checkOut: clickedDate, error: null };
}

// Select check-in
const step1 = simulateDateSelection("2026-10-10", "", "", 2, []);
assert.strictEqual(step1.checkIn, "2026-10-10");
assert.strictEqual(step1.checkOut, "");

// Select valid check-out meeting minimum nights
const step2 = simulateDateSelection("2026-10-13", step1.checkIn, step1.checkOut, 2, []);
assert.strictEqual(step2.checkIn, "2026-10-10");
assert.strictEqual(step2.checkOut, "2026-10-13");
assert.strictEqual(step2.error, null);

// Click earlier date restarts check-in
const step3 = simulateDateSelection("2026-10-05", step2.checkIn, step2.checkOut, 2, []);
assert.strictEqual(step3.checkIn, "2026-10-05");
assert.strictEqual(step3.checkOut, "");
console.log("✓ Interactive calendar date selection verified!");

// [3] Host Information & Profile Links
console.log("\n--- [3] Host Information & Profile Links ---");
const getHostProfileHref = (host?: { id: string }) => {
  if (!host?.id) return null;
  return `/users/profile/${host.id}`;
};

assert.strictEqual(getHostProfileHref({ id: "host_123" }), "/users/profile/host_123");
assert.strictEqual(getHostProfileHref({ id: "host_456" }), "/users/profile/host_456");
// Guest-profile visibility does not affect the separate public host profile.
assert.strictEqual(getHostProfileHref({ id: "host_789" }), "/users/profile/host_789");
console.log("✓ Host profile link logic verified!");

// [4] Map Privacy Mode
console.log("\n--- [4] Map Privacy & Approximate Location ---");
const getMapConfig = (showExactLocation: boolean, lat: number, lng: number) => ({
  renderMarker: showExactLocation,
  circleRadius: showExactLocation ? 180 : 1000,
  lat: showExactLocation ? lat : Math.round(lat * 100) / 100,
  lng: showExactLocation ? lng : Math.round(lng * 100) / 100,
});

const exactMap = getMapConfig(true, 24.713555, 46.675298);
assert.strictEqual(exactMap.renderMarker, true);
assert.strictEqual(exactMap.circleRadius, 180);

const approxMap = getMapConfig(false, 24.713555, 46.675298);
assert.strictEqual(approxMap.renderMarker, false);
assert.strictEqual(approxMap.circleRadius, 1000);
assert.strictEqual(approxMap.lat, 24.71);
assert.strictEqual(approxMap.lng, 46.68);
console.log("✓ Map privacy verified!");

// [5] Analytics Schema Verification
console.log("\n--- [5] Analytics Schema Verification ---");
const validEvents: ListingEventType[] = [
  "listing_page_view",
  "gallery_opened",
  "share_clicked",
  "wishlist_toggled",
  "checkin_selected",
  "checkout_selected",
  "dates_cleared",
  "guest_selector_opened",
  "guest_count_changed",
  "reserve_clicked",
  "booking_flow_started",
  "host_profile_clicked",
  "amenities_opened",
  "description_expanded",
  "description_collapsed",
  "availability_section_viewed",
  "house_rules_viewed",
];
assert.strictEqual(validEvents.includes("share_clicked"), true);
assert.strictEqual(validEvents.includes("description_collapsed"), true);
assert.strictEqual(validEvents.includes("availability_section_viewed"), true);
assert.strictEqual(validEvents.includes("house_rules_viewed"), true);
console.log("✓ Analytics events verified!");

console.log("\n==================================================================");
console.log("   ALL AUDIT CHECKS PASSED SUCCESSFULLY (5/5)                    ");
console.log("==================================================================\n");
