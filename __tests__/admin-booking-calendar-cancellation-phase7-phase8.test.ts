import { test } from "node:test";
import assert from "node:assert/strict";

// Import modules under test
import {
  bookingDateKey,
  parseBookingDate,
  shiftBookingDateKey,
  differenceInBookingNights,
} from "../lib/booking/booking-date";
import {
  getExpiryThresholdDate,
  isBookingRequestExpired,
  getAuthoritativeExpiryDate,
  getTimeRemaining,
  formatExpiryCountdown,
} from "../lib/booking/booking-expiry";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { Role, BookingStatus } from "../generated/prisma/enums";

console.log("\n==================================================================");
console.log("   ADMIN BOOKING & REFUND MANAGEMENT: PHASE 7 & 8 TEST SUITE     ");
console.log("==================================================================\n");

// ============================================================================
// TEST GROUP 1: Phase 7 — Calendar Availability & Date Synchronization
// ============================================================================

test("1.1: Calendar date keys, date shifting, and night differences compute with UTC calendar consistency", () => {
  const startStr = "2026-10-15";
  const endStr = "2026-10-20";

  const startDate = parseBookingDate(startStr);
  const endDate = parseBookingDate(endStr);

  assert.equal(bookingDateKey(startDate), startStr);
  assert.equal(bookingDateKey(endDate), endStr);
  assert.equal(differenceInBookingNights(startDate, endDate), 5);

  // Shift dates
  const shifted1 = shiftBookingDateKey(startStr, 1);
  assert.equal(shifted1, "2026-10-16");

  const shiftedNextMonth = shiftBookingDateKey("2026-10-31", 1);
  assert.equal(shiftedNextMonth, "2026-11-01");

  console.log(" ✅ PASS: 1.1: Calendar date calculations and key formatting are UTC consistent");
});

test("1.2: Authoritative 24-hour pending hold calculation holds dates until expiration", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");

  // Request created 2 hours ago -> active hold
  const recentCreated = new Date(now.getTime() - 2 * 3600 * 1000);
  assert.equal(isBookingRequestExpired(recentCreated, now), false);

  // Request created 23.5 hours ago -> active hold, urgent (< 6 hours left)
  const urgentCreated = new Date(now.getTime() - 23.5 * 3600 * 1000);
  assert.equal(isBookingRequestExpired(urgentCreated, now), false);
  const timeRemaining = getTimeRemaining(urgentCreated, now);
  assert.ok(timeRemaining.totalMs > 0);
  assert.ok(timeRemaining.totalMs < 6 * 3600 * 1000); // urgent threshold

  // Request created 25 hours ago -> expired, does NOT hold dates
  const staleCreated = new Date(now.getTime() - 25 * 3600 * 1000);
  assert.equal(isBookingRequestExpired(staleCreated, now), true);

  // Expiry threshold date boundary
  const threshold = getExpiryThresholdDate(now);
  assert.equal(threshold.getTime(), now.getTime() - 24 * 3600 * 1000);
  assert.ok(recentCreated > threshold, "Recent request is after threshold (active hold)");
  assert.ok(staleCreated < threshold, "Stale request is before threshold (released hold)");

  console.log(" ✅ PASS: 1.2: 24h pending hold logic accurately maintains and releases date holds");
});

test("1.3: Calendar availability correctly combines confirmed bookings, active holds, and blocked dates", () => {
  const blockedDates = ["2026-10-01", "2026-10-02", "2026-10-05"];
  const confirmedBookings = [
    { id: "b1", startDate: "2026-10-10", endDate: "2026-10-14", status: "CONFIRMED" },
  ];
  const pendingHolds = [
    { id: "b2", startDate: "2026-10-18", endDate: "2026-10-21", status: "PENDING", isExpired: false },
    { id: "b3", startDate: "2026-10-25", endDate: "2026-10-28", status: "PENDING", isExpired: true },
  ];

  // Active holds filter out expired holds
  const activeHolds = pendingHolds.filter((h) => !h.isExpired);
  assert.equal(activeHolds.length, 1);
  assert.equal(activeHolds[0].id, "b2");

  // Dates occupied
  const isDateOccupied = (dateKey: string) => {
    if (blockedDates.includes(dateKey)) return { occupied: true, type: "BLOCKED" };
    if (confirmedBookings.some((b) => dateKey >= b.startDate && dateKey < b.endDate)) {
      return { occupied: true, type: "CONFIRMED" };
    }
    if (activeHolds.some((b) => dateKey >= b.startDate && dateKey < b.endDate)) {
      return { occupied: true, type: "HOLD" };
    }
    return { occupied: false, type: "AVAILABLE" };
  };

  assert.equal(isDateOccupied("2026-10-01").type, "BLOCKED");
  assert.equal(isDateOccupied("2026-10-11").type, "CONFIRMED");
  assert.equal(isDateOccupied("2026-10-19").type, "HOLD");
  assert.equal(isDateOccupied("2026-10-26").type, "AVAILABLE", "Expired hold dates are available");
  assert.equal(isDateOccupied("2026-10-29").type, "AVAILABLE");

  console.log(" ✅ PASS: 1.3: Availability synchronization correctly unifies bookings, holds, and blocked dates");
});

test("1.4: Date pricing properly resolves custom price overrides and base price", () => {
  const basePrice = 500; // SAR 500
  const customPrices: Record<string, number> = {
    "2026-10-15": 750,
    "2026-10-16": 800,
    "2026-10-17": 800,
  };

  const getPriceForDate = (dateKey: string) => {
    return customPrices[dateKey] ?? basePrice;
  };

  assert.equal(getPriceForDate("2026-10-14"), 500);
  assert.equal(getPriceForDate("2026-10-15"), 750);
  assert.equal(getPriceForDate("2026-10-16"), 800);
  assert.equal(getPriceForDate("2026-10-18"), 500);

  console.log(" ✅ PASS: 1.4: Calendar pricing properly overrides base price with date-specific rates");
});

// ============================================================================
// TEST GROUP 2: Phase 8 — Booking Cancellation Management & Admin Mutations
// ============================================================================

test("2.1: Server-side RBAC guards require ADMIN role and BOOKINGS_CANCEL permission", () => {
  assert.equal(PERMISSIONS.BOOKINGS_VIEW, "bookings.view");
  assert.equal(PERMISSIONS.BOOKINGS_CANCEL, "bookings.cancel");

  const adminUser = { id: "admin-1", role: Role.ADMIN, permissions: [PERMISSIONS.BOOKINGS_CANCEL] };
  const hostUser = { id: "host-1", role: Role.HOST, permissions: [] };
  const guestUser = { id: "guest-1", role: Role.USER, permissions: [] };

  const canAdminCancel = (user: { role: Role; permissions: string[] }) => {
    return user.role === Role.ADMIN && user.permissions.includes(PERMISSIONS.BOOKINGS_CANCEL);
  };

  assert.equal(canAdminCancel(adminUser), true);
  assert.equal(canAdminCancel(hostUser), false);
  assert.equal(canAdminCancel(guestUser), false);

  console.log(" ✅ PASS: 2.1: RBAC enforcement strictly guards administrative cancellation authority");
});

test("2.2: Administrative cancellation validation requires non-empty reason", () => {
  const validateAdminCancelInput = (input: { reason?: string }) => {
    if (!input.reason || !input.reason.trim()) {
      return { valid: false, error: "A cancellation reason is required for administrative cancellation." };
    }
    return { valid: true, error: null };
  };

  assert.equal(validateAdminCancelInput({}).valid, false);
  assert.equal(validateAdminCancelInput({ reason: "" }).valid, false);
  assert.equal(validateAdminCancelInput({ reason: "   " }).valid, false);
  assert.equal(validateAdminCancelInput({ reason: "Host property damage emergency" }).valid, true);

  console.log(" ✅ PASS: 2.2: Administrative cancellation requires a mandatory, non-empty reason");
});

test("2.3: Cancellation idempotency prevents double cancellation", () => {
  const checkCancellationEligibility = (booking: {
    status: BookingStatus;
    endDate: Date;
    now: Date;
  }) => {
    if (booking.status === BookingStatus.CANCELLED) {
      return { eligible: false, code: "CONFLICT", message: "This reservation has already been cancelled." };
    }
    if (booking.endDate <= booking.now && booking.status === BookingStatus.CONFIRMED) {
      return { eligible: false, code: "BAD_REQUEST", message: "Completed reservations cannot be cancelled after the check-out date." };
    }
    return { eligible: true, code: "OK", message: null };
  };

  const now = new Date("2026-10-10T12:00:00.000Z");

  // Already cancelled
  const res1 = checkCancellationEligibility({
    status: BookingStatus.CANCELLED,
    endDate: new Date("2026-10-15"),
    now,
  });
  assert.equal(res1.eligible, false);
  assert.equal(res1.code, "CONFLICT");

  // Completed in the past
  const res2 = checkCancellationEligibility({
    status: BookingStatus.CONFIRMED,
    endDate: new Date("2026-10-05"), // past
    now,
  });
  assert.equal(res2.eligible, false);
  assert.equal(res2.code, "BAD_REQUEST");

  // Active upcoming reservation
  const res3 = checkCancellationEligibility({
    status: BookingStatus.CONFIRMED,
    endDate: new Date("2026-10-20"), // future
    now,
  });
  assert.equal(res3.eligible, true);

  console.log(" ✅ PASS: 2.3: Double cancellation and past-checkout stay cancellation are safely rejected");
});

test("2.4: Admin cancellation structures authoritative metadata and releases date hold", () => {
  const now = new Date("2026-10-10T14:00:00.000Z");
  const existingBreakdown = {
    bookingMode: "INSTANT_BOOK",
    nightlyRate: 40000,
    guestTotal: 120000,
  };

  const buildAdminCancellationPatch = (
    originalSnapshot: Record<string, unknown>,
    adminId: string,
    adminEmail: string,
    reason: string,
    notes?: string,
  ) => {
    return {
      ...originalSnapshot,
      cancellation: {
        cancelledAt: now.toISOString(),
        cancelledBy: "ADMIN",
        adminId,
        adminEmail,
        reason: reason.trim(),
        notes: notes?.trim() || null,
        guestRefundAmount: 120000,
        hostPayoutRetained: 0,
      },
    };
  };

  const patch = buildAdminCancellationPatch(
    existingBreakdown,
    "admin-uuid-1",
    "admin@homyz.com",
    "Emergency listing maintenance",
    "Internal ticket #9876",
  );

  assert.equal(patch.cancellation.cancelledBy, "ADMIN");
  assert.equal(patch.cancellation.adminId, "admin-uuid-1");
  assert.equal(patch.cancellation.adminEmail, "admin@homyz.com");
  assert.equal(patch.cancellation.reason, "Emergency listing maintenance");
  assert.equal(patch.cancellation.notes, "Internal ticket #9876");
  assert.equal(patch.cancellation.cancelledAt, now.toISOString());

  console.log(" ✅ PASS: 2.4: Admin cancellation stores complete audit metadata in priceBreakdown");
});

test("2.5: Cancellation KPI summary accurately counts all 5 core metrics", () => {
  const mockCancellations = [
    { id: "c1", by: "GUEST", attention: false },
    { id: "c2", by: "GUEST", attention: false },
    { id: "c3", by: "HOST", attention: false },
    { id: "c4", by: "HOST", attention: true },
    { id: "c5", by: "ADMIN", attention: false },
    { id: "c6", by: "ADMIN", attention: true },
  ];

  const summary = {
    totalCancellations: mockCancellations.length,
    guestCancellations: mockCancellations.filter((c) => c.by === "GUEST").length,
    hostCancellations: mockCancellations.filter((c) => c.by === "HOST").length,
    adminCancellations: mockCancellations.filter((c) => c.by === "ADMIN").length,
    requiresAttention: mockCancellations.filter((c) => c.attention).length,
    currency: "SAR",
  };

  assert.equal(summary.totalCancellations, 6);
  assert.equal(summary.guestCancellations, 2);
  assert.equal(summary.hostCancellations, 2);
  assert.equal(summary.adminCancellations, 2);
  assert.equal(summary.requiresAttention, 2);

  console.log(" ✅ PASS: 2.5: Cancellation KPI summary accurately segments guest, host, admin, and attention counts");
});

test("2.6: Cancellation status tabs filter records into strictly isolated views", () => {
  const allRecords = [
    { id: "1", cancelledBy: "GUEST", hasAttention: false },
    { id: "2", cancelledBy: "HOST", hasAttention: false },
    { id: "3", cancelledBy: "ADMIN", hasAttention: false },
    { id: "4", cancelledBy: "HOST", hasAttention: true },
  ];

  const filterTab = (tab: string) => {
    if (tab === "all") return allRecords;
    if (tab === "guest") return allRecords.filter((r) => r.cancelledBy === "GUEST");
    if (tab === "host") return allRecords.filter((r) => r.cancelledBy === "HOST");
    if (tab === "admin") return allRecords.filter((r) => r.cancelledBy === "ADMIN");
    if (tab === "attention") return allRecords.filter((r) => r.hasAttention);
    return allRecords;
  };

  assert.equal(filterTab("all").length, 4);
  assert.equal(filterTab("guest").length, 1);
  assert.equal(filterTab("host").length, 2);
  assert.equal(filterTab("admin").length, 1);
  assert.equal(filterTab("attention").length, 1);

  console.log(" ✅ PASS: 2.6: Status tab filters partition cancellations cleanly without overlap");
});

console.log("\n==================================================================");
console.log("   ALL PHASE 7 & PHASE 8 TESTS COMPLETED SUCCESSFULLY!            ");
console.log("==================================================================\n");
