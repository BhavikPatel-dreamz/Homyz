import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeHandle, validateHandle } from "@/services/travel-profile.service";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";
import { BookingStatus } from "@/generated/prisma/client";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

// ============================================================================
// 1. HANDLE NORMALIZATION & VALIDATION
// ============================================================================

test("TravelProfile: Handle normalization and validation enforces lowercase and permitted characters", () => {
  // Normalization
  assert.equal(normalizeHandle("TravelerAlex"), "traveleralex");
  assert.equal(normalizeHandle("  johndoe_99  "), "johndoe_99");
  assert.equal(normalizeHandle("@jane.smith-wander"), "jane.smith-wander");
  assert.equal(normalizeHandle(null), null);
  assert.equal(normalizeHandle(""), null);

  // Validation
  assert.equal(validateHandle("TravelerAlex"), "traveleralex");
  assert.equal(validateHandle("@alex_123"), "alex_123");

  // Rejects invalid short/long handles
  assert.throws(() => validateHandle("ab"), /3-30 characters long/);
  assert.throws(() => validateHandle("a".repeat(31)), /3-30 characters long/);

  // Rejects special characters
  assert.throws(() => validateHandle("john!doe"), /lowercase letters, numbers, underscores, dashes, or dots/);
  assert.throws(() => validateHandle("john doe"), /lowercase letters, numbers, underscores, dashes, or dots/);
  assert.throws(() => validateHandle("user#name"), /lowercase letters, numbers, underscores, dashes, or dots/);
});

// ============================================================================
// 2. TRUTHFUL STATISTICS ENGINE: COMPLETED STAYS, LIKES & REVIEWS
// ============================================================================

test("TravelProfile: Trips statistic accurately counts only completed confirmed stays", () => {
  const now = new Date();
  const pastStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const pastEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const futureStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const futureEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Confirmed booking in the past -> Completed stay
  assert.equal(
    isCompletedConfirmedBooking({
      dbStatus: BookingStatus.CONFIRMED,
      startDate: pastStart,
      endDate: pastEnd,
    }),
    true,
    "Past confirmed booking must count as a completed trip"
  );

  // Confirmed booking in the future -> NOT completed yet
  assert.equal(
    isCompletedConfirmedBooking({
      dbStatus: BookingStatus.CONFIRMED,
      startDate: futureStart,
      endDate: futureEnd,
    }),
    false,
    "Future confirmed booking must not count as a completed trip"
  );

  // Pending booking in the past -> NOT completed
  assert.equal(
    isCompletedConfirmedBooking({
      dbStatus: BookingStatus.PENDING,
      startDate: pastStart,
      endDate: pastEnd,
    }),
    false,
    "Pending booking must never count towards completed trips"
  );

  // Cancelled booking in the past -> NOT completed
  assert.equal(
    isCompletedConfirmedBooking({
      dbStatus: BookingStatus.CANCELLED,
      startDate: pastStart,
      endDate: pastEnd,
    }),
    false,
    "Cancelled booking must never count towards completed trips"
  );

  // Rejected/Declined booking in the past -> NOT completed
  assert.equal(
    isCompletedConfirmedBooking({
      dbStatus: "REJECTED" as unknown as BookingStatus,
      startDate: pastStart,
      endDate: pastEnd,
    }),
    false,
    "Rejected booking must never count towards completed trips"
  );
});

test("TravelProfile Service: Source code verifies real DB relationships without hardcoded statistics", () => {
  const serviceCode = read("services/travel-profile.service.ts");

  // No hardcoded 12, 168, 98
  assert.doesNotMatch(serviceCode, /trips:\s*12\b/);
  assert.doesNotMatch(serviceCode, /likes:\s*168\b/);
  assert.doesNotMatch(serviceCode, /reviews:\s*98\b/);

  // No Math.max(tripsCount, photosCount) fabrication
  assert.doesNotMatch(serviceCode, /Math\.max\(.*photosCount.*\)/);

  // Validates queries
  assert.match(serviceCode, /prisma\.booking\.findMany/);
  assert.match(serviceCode, /isCompletedConfirmedBooking/);
  assert.match(serviceCode, /prisma\.profileLike\.count/);
  assert.match(serviceCode, /prisma\.review\.count/);
  assert.match(serviceCode, /ReviewStatus\.PUBLISHED/);
});

// ============================================================================
// 3. PRIVACY BOUNDARY & SECURITY CHECKS
// ============================================================================

test("TravelProfile Service: Prevents self-likes and enforces actor validation", () => {
  const serviceCode = read("services/travel-profile.service.ts");

  // Prevents self-likes
  assert.match(serviceCode, /actorId === targetUserId/);
  assert.match(serviceCode, /cannot like your own/i);

  // Idempotent like toggle
  assert.match(serviceCode, /prisma\.profileLike\.delete/);
  assert.match(serviceCode, /prisma\.profileLike\.create/);
});

test("TravelProfile Service: Data transfer object omits sensitive user fields", () => {
  const serviceCode = read("services/travel-profile.service.ts");

  // User select in profile fetch only selects safe identity fields
  assert.match(serviceCode, /select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*image:\s*true/);
  // Email and phone must never be part of the travel profile DTO select
  assert.doesNotMatch(serviceCode, /select:\s*\{[^}]*email:\s*true/);
  assert.doesNotMatch(serviceCode, /select:\s*\{[^}]*phone:\s*true/);
  assert.doesNotMatch(serviceCode, /select:\s*\{[^}]*passwordHash:\s*true/);
});

test("Legacy Trip Photos Action: Access control prevents raw photo enumeration outside management", () => {
  const actionCode = read("actions/user/tripPhotos.ts");

  // Authentication check
  assert.match(actionCode, /actor = await getSessionUser\(\)/);
  // Raw management records stay owner/admin-only; public projection happens elsewhere.
  assert.match(actionCode, /actor\?\.id !== userId && actor\?\.role !== "ADMIN"/);
  assert.match(actionCode, /AppError\.forbidden/);
  // Revalidation of travel profile page
  assert.match(actionCode, /revalidatePath\("\/travel-profile"\)/);
});

// ============================================================================
// 4. ROUTE PROTECTION & APP NAVIGATION INTEGRATION
// ============================================================================

test("Proxy Middleware: Protects /travel-profile route from unauthenticated access", () => {
  const proxyCode = read("proxy.ts");

  assert.match(proxyCode, /"\/travel-profile"/);
  assert.match(proxyCode, /"\/travel-profile\/:path\*"/);
});

test("App Header: Integrates Travel Profile link into user navigation menus", () => {
  const headerCode = read("components/dashboard/app-header.tsx");

  assert.match(headerCode, /href="\/travel-profile"/);
  assert.match(headerCode, /Travel Profile/);
});

// ============================================================================
// 5. PROFILE HEADER UI ARCHITECTURE (FIGMA SCREENSHOT 1 ALIGNMENT)
// ============================================================================

test("Profile Header: Renders cover banner, overlapping avatar, action buttons, and stat pills", () => {
  const headerCode = read("components/travel/travel-profile-header.tsx");

  // Cover image container with rounded corners and responsive height
  assert.match(headerCode, /rounded-\[24px\]/);
  assert.match(headerCode, /h-\[210px\]/);

  // Cover remains a static travel-profile visual; it is not editable here.
  assert.doesNotMatch(headerCode, /Change Cover/);
  assert.doesNotMatch(headerCode, /TravelCoverUploadModal/);

  // Overlapping avatar with white border ring
  assert.match(headerCode, /rounded-full border-4 border-white/);

  // 3 Header Action Pill Buttons
  assert.match(headerCode, /Edit Profile/);
  assert.match(headerCode, /Share Profile/);
  assert.match(headerCode, /Upload/);

  // 3 Gold Oval Stat Badges matching Figma Screenshot 1
  assert.match(headerCode, /bg-\[#FCDF9C\]/);
  assert.match(headerCode, /Trips/);
  assert.match(headerCode, /Likes/);
  assert.match(headerCode, /Reviews/);

  // Modals integration in Header
  assert.match(headerCode, /TravelProfileEditModal/);
  assert.doesNotMatch(headerCode, /TravelCoverUploadModal/);
});

test("Profile View: Incorporates header and roadmapped section previews", () => {
  const viewCode = read("components/travel/travel-profile-view.tsx");

  assert.match(viewCode, /TravelProfileHeader/);
  assert.match(viewCode, /TravelCountryCarousel/);
  assert.match(viewCode, /Trip photo gallery/);
  assert.match(viewCode, /TravelStampsSection/);
});

test("Database Schema & Migration: TravelProfile and ProfileLike models are properly defined", () => {
  const schemaCode = read("prisma/schema.prisma");

  assert.match(schemaCode, /model TravelProfile/);
  assert.match(schemaCode, /model ProfileLike/);
  assert.match(schemaCode, /enum TravelProfileVisibility/);
  assert.match(schemaCode, /travelProfile\s+TravelProfile\?/);
  assert.match(schemaCode, /profileLikesGiven\s+ProfileLike\[\]/);
  assert.match(schemaCode, /profileLikesReceived\s+ProfileLike\[\]/);

  const migrationCode = read("prisma/migrations/20261026150000_add_travel_profile_foundation/migration.sql");
  assert.match(migrationCode, /CREATE TABLE IF NOT EXISTS "TravelProfile"/);
  assert.match(migrationCode, /CREATE TABLE IF NOT EXISTS "ProfileLike"/);
});
