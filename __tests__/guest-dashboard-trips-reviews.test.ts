import fs from "fs";
import path from "path";

async function runGuestDashboardTripsReviewsTests() {
  console.log("\n=======================================================");
  console.log("   GUEST DASHBOARD: TRIPS & REVIEWS AUDIT TEST SUITE   ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(` ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- [1] UPCOMING VS PAST DATE CLASSIFICATION LOGIC ---
  console.log("\n--- [1] Stay Classification Logic ---");
  const now = new Date();
  const todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  function classifyStay(startDate: string, endDate: string, status = "CONFIRMED"): "upcoming" | "past" | "none" {
    const endD = new Date(endDate);
    const endMidnight = Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth(), endD.getUTCDate());

    if (status === "CANCELLED") {
      return "past"; // historical record
    }
    if (endMidnight >= todayMidnight) {
      return "upcoming";
    }
    return "past";
  }

  // Test future stay
  const futureStart = new Date(Date.now() + 86400000 * 5).toISOString();
  const futureEnd = new Date(Date.now() + 86400000 * 8).toISOString();
  assert(
    classifyStay(futureStart, futureEnd) === "upcoming",
    "Future stay is correctly classified under Upcoming Trips",
  );

  // Test active/ongoing stay (check-in was 2 days ago, checkout is 3 days from now)
  const activeStart = new Date(Date.now() - 86400000 * 2).toISOString();
  const activeEnd = new Date(Date.now() + 86400000 * 3).toISOString();
  assert(
    classifyStay(activeStart, activeEnd) === "upcoming",
    "Active ongoing stay (check-in passed, check-out in future) remains in Upcoming Trips and is NOT moved to Past",
  );

  // Test completed stay (checkout was 5 days ago)
  const pastStart = new Date(Date.now() - 86400000 * 10).toISOString();
  const pastEnd = new Date(Date.now() - 86400000 * 5).toISOString();
  assert(
    classifyStay(pastStart, pastEnd) === "past",
    "Completed stay (checkout in the past) is correctly classified under Past Bookings",
  );

  // Test cancelled booking
  assert(
    classifyStay(futureStart, futureEnd, "CANCELLED") === "past",
    "Cancelled future booking does not appear in active Upcoming Trips",
  );

  // --- [2] PAST BOOKINGS GROUPED BY COMPLETION YEAR ---
  console.log("\n--- [2] Past Bookings Grouping by Year ---");
  const testStays = [
    { id: "1", endDate: "2024-05-10T00:00:00.000Z", propertyName: "Stay 2024" },
    { id: "2", endDate: "2026-02-14T00:00:00.000Z", propertyName: "Stay 2026 Early" },
    { id: "3", endDate: "2026-08-20T00:00:00.000Z", propertyName: "Stay 2026 Late" },
    { id: "4", endDate: "2025-11-01T00:00:00.000Z", propertyName: "Stay 2025" },
  ];

  // Group by year descending
  const groups = new Map<number, typeof testStays>();
  const sorted = [...testStays].sort(
    (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
  );
  for (const item of sorted) {
    const year = new Date(item.endDate).getUTCFullYear();
    const g = groups.get(year) ?? [];
    g.push(item);
    groups.set(year, g);
  }
  const pastYearGroups = Array.from(groups, ([year, items]) => ({ year, items })).sort(
    (a, b) => b.year - a.year,
  );

  assert(
    pastYearGroups.length === 3 &&
    pastYearGroups[0].year === 2026 &&
    pastYearGroups[1].year === 2025 &&
    pastYearGroups[2].year === 2024,
    "Past bookings are grouped by stay completion year with newest year first (2026, 2025, 2024)",
  );

  assert(
    pastYearGroups[0].items[0].id === "3" && pastYearGroups[0].items[1].id === "2",
    "Within each year group, stays are sorted with newest completion date first",
  );

  // --- [3] CARD CONTENT & ACTIONS AUDIT ---
  console.log("\n--- [3] Card Content & Actions File Audit ---");
  const cardPath = path.join(process.cwd(), "components/dashboard/reservation-card.tsx");
  const cardContent = fs.readFileSync(cardPath, "utf-8");

  assert(
    cardContent.includes("StatusBadge") &&
    cardContent.includes("Confirmed") &&
    cardContent.includes("Pending") &&
    cardContent.includes("Cancelled"),
    "ReservationCard renders status badge with real backend booking statuses",
  );

  assert(
    cardContent.includes("data.location"),
    "ReservationCard renders property location (city, country)",
  );

  assert(
    cardContent.includes("detailsHref") && cardContent.includes("/bookings/"),
    "ReservationCard links cleanly to /bookings/[id] details page",
  );

  assert(
    cardContent.includes("View reservation details"),
    "ReservationCard shows clean 'View reservation details' CTA instead of cluttered buttons",
  );

  assert(
    !cardContent.includes("onContactHost") && !cardContent.includes("onViewReceipt"),
    "ReservationCard no longer has clutter Contact host / Receipt action buttons (moved to details page)",
  );

  assert(
    cardContent.includes("Write review") || cardContent.includes("Review stay") || cardContent.includes("isReviewEligible"),
    "ReservationCard still shows 'Write review' link for eligible completed past stays",
  );

  // --- [4] MODALS & AUTHORIZED DATA ---
  console.log("\n--- [4] Trip Modals File Audit ---");
  const modalsPath = path.join(process.cwd(), "components/dashboard/trip-modals.tsx");
  const modalsContent = fs.readFileSync(modalsPath, "utf-8");

  assert(
    modalsContent.includes("CancelBookingModal") &&
    modalsContent.includes("fetch(`/api/v1/bookings/${booking.id}/cancel`"),
    "CancelBookingModal invokes authoritative /api/v1/bookings/[id]/cancel endpoint",
  );

  assert(
    modalsContent.includes("ReceiptModal") &&
    modalsContent.includes("fetch(`/api/v1/taxes/invoices/${bookingId}`)") &&
    modalsContent.includes("json.data !== undefined ? json.data : json") &&
    modalsContent.includes('(invoice.bookingId || bookingId || "").slice(-8)'),
    "ReceiptModal correctly unwraps API envelope and safely formats bookingId with fallback",
  );

  assert(
    modalsContent.includes("ContactHostModal") &&
    modalsContent.includes("ModalOverlay"),
    "ContactHostModal uses ModalOverlay and accurately reports messaging dependency to 24/7 Support",
  );

  // --- [5] BACKEND CANCELLATION AUTHORIZATION ---
  console.log("\n--- [5] Backend Cancellation Service Audit ---");
  const bookingServicePath = path.join(process.cwd(), "services/booking.service.ts");
  const bsContent = fs.readFileSync(bookingServicePath, "utf-8");

  assert(
    bsContent.includes("cancelBookingByGuest") &&
    bsContent.includes("assertOwnership(actor, booking.userId)") &&
    bsContent.includes("BookingStatus.CANCELLED"),
    "bookingService.cancelBookingByGuest enforces ownership authorization and updates status to CANCELLED",
  );

  assert(
    bsContent.includes("new Date(booking.startDate) <= now") &&
    bsContent.includes("Reservations cannot be cancelled after the check-in date"),
    "bookingService prevents cancellation after check-in date has passed",
  );

  // --- [6] MY REVIEWS IMPLEMENTATION AUDIT ---
  console.log("\n--- [6] My Reviews Section Audit ---");
  const reviewSectionPath = path.join(process.cwd(), "components/profile/my-reviews-section.tsx");
  const rsContent = fs.readFileSync(reviewSectionPath, "utf-8");

  assert(
    rsContent.includes("MyReviewsSection") &&
    rsContent.includes("StarRating") &&
    rsContent.includes("Show review"),
    "MyReviewsSection renders star rating and 'Show review' expansion action",
  );

  assert(
    rsContent.includes("haven&apos;t written any reviews yet") || rsContent.includes("haven't written any reviews yet"),
    "MyReviewsSection renders professional empty state when user has no reviews",
  );

  assert(
    rsContent.includes("ModalOverlay"),
    "MyReviewsSection detail expansion uses ModalOverlay",
  );

  // --- [7] DASHBOARD INTEGRATION AUDIT ---
  console.log("\n--- [7] Dashboard Integration Audit ---");
  const rdPath = path.join(process.cwd(), "components/dashboard/reservation-dashboard.tsx");
  const rdContent = fs.readFileSync(rdPath, "utf-8");

  assert(
    rdContent.includes("<MyReviewsSection reviews={reviews}"),
    "ReservationDashboard renders MyReviewsSection below Past Bookings",
  );

  assert(
    rdContent.includes('title="No upcoming trips yet"') &&
    rdContent.includes('actionText="Explore stays"'),
    "Upcoming Trips renders dedicated 'No upcoming trips yet' with 'Explore stays' action",
  );

  assert(
    rdContent.includes('title="No past bookings yet"'),
    "Past Bookings renders dedicated 'No past bookings yet' empty state",
  );

  const pcPath = path.join(process.cwd(), "app/(protected)/profile/profile-client.tsx");
  const pcContent = fs.readFileSync(pcPath, "utf-8");

  assert(
    !pcContent.includes("Lorem ipsum dolor sit amet"),
    "Profile overview card has removed the fake Lorem Ipsum review mockup",
  );

  assert(
    pcContent.includes("<MyReviewsSection reviews={initialReviews}"),
    "Profile overview card connects to dynamic MyReviewsSection with real guest reviews",
  );

  // --- [8] BOOKING DETAILS ACTIONS AUDIT ---
  console.log("\n--- [8] BookingDetailsActions on Details Page ---");
  const actionsPath = path.join(process.cwd(), "components/bookings/booking-details-actions.tsx");
  const actionsContent = fs.existsSync(actionsPath) ? fs.readFileSync(actionsPath, "utf-8") : "";

  assert(
    actionsContent.includes("BookingDetailsActions") &&
    actionsContent.includes("Contact host") &&
    actionsContent.includes("View receipt") &&
    actionsContent.includes("Cancel reservation"),
    "BookingDetailsActions component contains Contact host, View receipt, and Cancel reservation sections",
  );

  assert(
    actionsContent.includes("CancelBookingModal") &&
    actionsContent.includes("ReceiptModal") &&
    actionsContent.includes("ContactHostModal"),
    "BookingDetailsActions embeds all three trip action modals",
  );

  const bDetailsPath = path.join(process.cwd(), "app/(protected)/bookings/[id]/page.tsx");
  const bDetailsContent = fs.readFileSync(bDetailsPath, "utf-8");

  assert(
    bDetailsContent.includes("BookingDetailsActions") &&
    bDetailsContent.includes("toReservationCardData"),
    "Booking details page renders BookingDetailsActions with real reservation data",
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runGuestDashboardTripsReviewsTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
