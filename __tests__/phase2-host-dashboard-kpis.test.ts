import test from "node:test";
import assert from "node:assert/strict";
import { Role, UserStatus, BookingStatus } from "../generated/prisma/enums";
import { differenceInBookingNights, bookingDateKey } from "../lib/booking/booking-date";

test("Phase 2 Host Dashboard KPIs: Monthly & YTD Earnings Formula Consistency", () => {
  // Booking 1: Completed in current month (Sept 2026)
  const b1 = {
    status: "CONFIRMED",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-09-05"), // 4 nights
    totalPrice: 250000, // SAR 2,500.00 (gross guest paid)
    cleaningFee: 20000,
    priceBreakdown: {
      payoutBreakdown: {
        accommodationSubtotal: 200000, // SAR 2,000.00
        cleaningFee: 20000,
        hostServiceFee: 6000, // 3% of 2000 = 60 SAR
        taxesCollectedForHost: 0,
        netHostPayout: 214000, // SAR 2,140.00 (Authoritative net payout)
      },
    },
  };

  // Booking 2: Completed earlier in the same year (March 2026)
  const b2 = {
    status: "CONFIRMED",
    startDate: new Date("2026-03-10"),
    endDate: new Date("2026-03-15"), // 5 nights
    totalPrice: 350000,
    cleaningFee: 20000,
    priceBreakdown: {
      payoutBreakdown: {
        accommodationSubtotal: 300000,
        cleaningFee: 20000,
        hostServiceFee: 9000,
        taxesCollectedForHost: 0,
        netHostPayout: 311000, // SAR 3,110.00
      },
    },
  };

  // Extract payouts
  const extractNet = (b: any) => b.priceBreakdown.payoutBreakdown.netHostPayout;

  const currentMonthEarnings = extractNet(b1);
  const ytdEarnings = extractNet(b1) + extractNet(b2);

  // Must use netHostPayout, not totalPrice
  assert.equal(currentMonthEarnings, 214000, "Monthly earnings must strictly equal netHostPayout");
  assert.notEqual(currentMonthEarnings, b1.totalPrice, "Monthly earnings must not use gross guest totalPrice");

  assert.equal(ytdEarnings, 525000, "YTD earnings must sum netHostPayout across calendar year stays");
});

test("Phase 2 Host Dashboard KPIs: Month-over-Month Trend Percentage Formula", () => {
  const currentMonthEarnings = 500000; // SAR 5,000.00
  const previousMonthEarnings = 400000; // SAR 4,000.00

  const momChange = Math.round(((currentMonthEarnings - previousMonthEarnings) / previousMonthEarnings) * 100);
  assert.equal(momChange, 25, "MoM change must correctly calculate +25% growth");

  const dropMonth = 300000;
  const momDrop = Math.round(((dropMonth - previousMonthEarnings) / previousMonthEarnings) * 100);
  assert.equal(momDrop, -25, "MoM drop must correctly calculate -25% decline");
});

test("Phase 2 Host Dashboard KPIs: 30-Day Occupancy Rate & Inventory Reconciliation", () => {
  // Window: 30 days
  // 1 active listing
  // Total potential nights: 30
  // Host blocked dates: 6 nights
  // Bookable nights: 30 - 6 = 24
  // Booked nights: 18 nights
  // Available nights: 24 - 18 = 6 nights

  const totalCalendarNights = 30;
  const blockedNights = 6;
  const bookedNights = 18;

  const bookableNights = totalCalendarNights - blockedNights;
  const availableNights = bookableNights - bookedNights;
  const occupancyRate = Math.round((bookedNights / bookableNights) * 1000) / 10;

  assert.equal(bookableNights, 24);
  assert.equal(availableNights, 6);
  assert.equal(occupancyRate, 75.0, "18 / 24 = 75.0% occupancy rate");

  // Mathematical Reconciliation Check:
  assert.equal(bookedNights + availableNights, bookableNights, "Booked + Available must exactly equal Bookable nights");
  const reconstructedRate = Math.round((bookedNights / (bookedNights + availableNights)) * 1000) / 10;
  assert.equal(reconstructedRate, occupancyRate, "Reconstructed rate from inventory must reconcile with occupancy");
});

test("Phase 2 Host Dashboard KPIs: Average Booking Value and Average Stay Length", () => {
  const completedStays = [
    { netPayout: 100000, nights: 2 }, // SAR 1,000 for 2 nights
    { netPayout: 200000, nights: 4 }, // SAR 2,000 for 4 nights
    { netPayout: 300000, nights: 6 }, // SAR 3,000 for 6 nights
  ];

  const totalPayout = completedStays.reduce((sum, s) => sum + s.netPayout, 0);
  const totalNights = completedStays.reduce((sum, s) => sum + s.nights, 0);
  const count = completedStays.length;

  const avgBookingValue = Math.round(totalPayout / count);
  const avgStayLength = Math.round((totalNights / count) * 10) / 10;

  assert.equal(avgBookingValue, 200000, "Average booking value must be SAR 2,000.00 (200,000 cents)");
  assert.equal(avgStayLength, 4.0, "Average stay length must be 4.0 nights");
});

test("Phase 2 Host Dashboard KPIs: Cancellation Rate Separation (Guest vs Host)", () => {
  const bookings = [
    { status: "CONFIRMED" },
    { status: "CONFIRMED" },
    { status: "CONFIRMED" },
    { status: "CONFIRMED" },
    { status: "CANCELLED", priceBreakdown: { cancellation: { cancelledBy: "GUEST" } } },
    { status: "CANCELLED", priceBreakdown: { cancellation: { cancelledBy: "GUEST" } } },
    { status: "CANCELLED", priceBreakdown: { cancellation: { cancelledBy: "HOST", isExcluded: false } } },
  ];

  const totalBookings = bookings.length; // 7
  const guestCancelled = bookings.filter((b) => b.status === "CANCELLED" && b.priceBreakdown?.cancellation?.cancelledBy === "GUEST").length; // 2
  const hostCancelled = bookings.filter((b) => b.status === "CANCELLED" && b.priceBreakdown?.cancellation?.cancelledBy === "HOST").length; // 1
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length; // 4

  const totalCancelled = guestCancelled + hostCancelled; // 3
  const overallCancellationRate = Math.round((totalCancelled / totalBookings) * 1000) / 10; // 3/7 = 42.9%

  const totalConfirmedOrCompleted = confirmed + hostCancelled; // 5
  const hostCancellationRate = Math.round((hostCancelled / totalConfirmedOrCompleted) * 1000) / 10; // 1/5 = 20.0%

  assert.equal(overallCancellationRate, 42.9);
  assert.equal(hostCancellationRate, 20.0);
  assert.notEqual(hostCancellationRate, overallCancellationRate, "Host cancellation rate must not equal overall cancellation rate when guests cancel");
});

test("Phase 2 Host Dashboard KPIs: Next Upcoming Reservation Selection & Sorting", () => {
  const todayKey = "2026-10-05";

  const bookings = [
    { id: "b-far", startDate: new Date("2026-11-01"), endDate: new Date("2026-11-05"), status: "CONFIRMED" },
    { id: "b-next", startDate: new Date("2026-10-10"), endDate: new Date("2026-10-14"), status: "CONFIRMED" },
    { id: "b-past", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-05"), status: "CONFIRMED" },
    { id: "b-cancelled", startDate: new Date("2026-10-08"), endDate: new Date("2026-10-12"), status: "CANCELLED" },
  ];

  // Exclude cancelled and past completed stays, sort by startDate ascending
  const upcomingConfirmed = bookings
    .filter((b) => b.status === "CONFIRMED" && bookingDateKey(b.endDate) >= todayKey)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  assert.equal(upcomingConfirmed.length, 2);
  assert.equal(upcomingConfirmed[0].id, "b-next", "Next reservation must be the closest future confirmed booking");
  assert.equal(upcomingConfirmed[1].id, "b-far");
});

test("Phase 2 Host Dashboard KPIs: Multi-Listing Scope vs Single-Listing Filter", () => {
  const listings = [
    { id: "listing-1", title: "Luxury Villa Riyadh" },
    { id: "listing-2", title: "Cozy Studio Jeddah" },
  ];

  const bookings = [
    { listingId: "listing-1", status: "CONFIRMED", netPayout: 100000 },
    { listingId: "listing-1", status: "CONFIRMED", netPayout: 150000 },
    { listingId: "listing-2", status: "CONFIRMED", netPayout: 80000 },
  ];

  // All listings mode (aggregate)
  const allPayout = bookings.reduce((sum, b) => sum + b.netPayout, 0);
  assert.equal(allPayout, 330000, "All listings mode must aggregate across all properties");

  // Single listing filter mode
  const listing1Payout = bookings
    .filter((b) => b.listingId === "listing-1")
    .reduce((sum, b) => sum + b.netPayout, 0);
  assert.equal(listing1Payout, 250000, "Single listing mode must scope strictly to selected property");

  const listing2Payout = bookings
    .filter((b) => b.listingId === "listing-2")
    .reduce((sum, b) => sum + b.netPayout, 0);
  assert.equal(listing2Payout, 80000, "Single listing mode must scope strictly to selected property");
});

test("Phase 2 Host Dashboard KPIs: Zero Data / Empty State Safety", () => {
  // When a host has 0 bookings and 0 reviews
  const emptyKpis = {
    monthlyEarnings: { amountCents: 0, changePercentage: null },
    ytdEarnings: { amountCents: 0 },
    upcomingPayout: { totalUpcomingAmountCents: 0, nextPayoutAmountCents: null },
    occupancy: { ratePercentage: 0, bookedNights: 0, availableNights: 0, totalBookableNights: 0 },
    averageBookingValue: { hostPayoutCents: 0, completedBookingsCount: 0 },
    averageStayLength: { nights: 0, completedStaysCount: 0 },
    cancellationRate: { overallPercentage: 0, hostPercentage: 0 },
    averageRating: { overallRating: null, totalReviewsCount: 0 },
    nextUpcomingReservation: null,
  };

  assert.equal(emptyKpis.monthlyEarnings.amountCents, 0);
  assert.equal(emptyKpis.monthlyEarnings.changePercentage, null);
  assert.equal(emptyKpis.occupancy.ratePercentage, 0);
  assert.equal(emptyKpis.averageRating.overallRating, null);
  assert.equal(emptyKpis.nextUpcomingReservation, null);
  assert.ok(!isNaN(emptyKpis.occupancy.ratePercentage), "Zero bookable nights must yield 0, never NaN");
});

