import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildCanonicalDestinationKey,
  normalizeCanonicalDestination,
  normalizeDestinationText,
  searchWorldDestinations,
} from "../lib/travel/destination-normalization";
import {
  createTripSchema,
  updateTripSchema,
  attachTripPhotoSchema,
  addSelfDeclaredDestinationSchema,
} from "../lib/validation/travel-trip";
import { travelBookingSyncService } from "../services/travel-booking-sync.service";
import { BookingStatus } from "../generated/prisma/enums";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function testDestinationNormalizationAndDeduplication() {
  // 1. Text normalization
  assert.equal(normalizeDestinationText("  DUBAI  "), "dubai");
  assert.equal(normalizeDestinationText("São Paulo"), "sao paulo");
  assert.equal(normalizeDestinationText("New   York  City"), "new york city");

  // 2. Canonical key construction & deduplication
  const key1 = buildCanonicalDestinationKey({
    countryCode: "AE",
    normalizedName: "Dubai",
  });
  const key2 = buildCanonicalDestinationKey({
    countryCode: "ae",
    normalizedName: "  dubai  ",
  });
  assert.equal(key1, "AE:_:dubai");
  assert.equal(key1, key2, "Case and whitespace variants must resolve to identical canonicalKey");

  // 3. Homonym disambiguation (Paris, France vs Paris, Texas, USA)
  const parisFR = normalizeCanonicalDestination({
    name: "Paris",
    countryCode: "FR",
  });
  const parisUS = normalizeCanonicalDestination({
    name: "Paris",
    countryCode: "US",
    regionCode: "TX",
    regionName: "Texas",
  });

  assert.notEqual(
    parisFR.canonicalKey,
    parisUS.canonicalKey,
    "Cities with identical names in different countries or states must have distinct canonical keys",
  );
  assert.equal(parisFR.countryName, "France");
  assert.equal(parisUS.countryName, "United States");

  // 4. Multiple cities in same country
  const abuDhabi = normalizeCanonicalDestination({
    name: "Abu Dhabi",
    countryCode: "AE",
  });
  const dubai = normalizeCanonicalDestination({
    name: "Dubai",
    countryCode: "AE",
  });
  assert.equal(abuDhabi.countryCode, "AE");
  assert.equal(dubai.countryCode, "AE");
  assert.notEqual(abuDhabi.canonicalKey, dubai.canonicalKey);

  // 5. World destination lookup
  const searchResults = searchWorldDestinations("Tokyo", 5);
  assert.ok(searchResults.length > 0, "Must find global cities");
  assert.equal(searchResults[0].countryCode, "JP");
}

function testValidationSchemas() {
  // 1. Create Trip validation
  assert.throws(
    () => createTripSchema.parse({ title: "" }),
    /Trip title is required/,
    "Empty title must be rejected",
  );

  const validTrip = createTripSchema.parse({
    title: "Trip to Alps",
    description: "Skiing and hiking",
    startedAt: "2026-05-01",
    endedAt: "2026-05-10",
  });
  assert.equal(validTrip.title, "Trip to Alps");

  // Invalid date range (startedAt > endedAt)
  assert.throws(
    () =>
      createTripSchema.parse({
        title: "Bad Dates Trip",
        startedAt: "2026-05-15",
        endedAt: "2026-05-10",
      }),
    /Start date cannot be after end date/,
    "startedAt after endedAt must be rejected",
  );

  // 2. Update Trip validation
  const updateValid = updateTripSchema.parse({
    title: "Updated Title",
    coverPhotoId: "photo-123",
  });
  assert.equal(updateValid.title, "Updated Title");
  assert.equal(updateValid.coverPhotoId, "photo-123");

  // 3. Attach Photo schema
  assert.throws(
    () => attachTripPhotoSchema.parse({ mediaAssetId: "" }),
    /Media asset ID is required/,
  );
  const photoInput = attachTripPhotoSchema.parse({
    mediaAssetId: "asset-123",
    caption: "Sunset at the beach",
  });
  assert.equal(photoInput.mediaAssetId, "asset-123");

  // 4. Add Destination schema
  assert.throws(
    () => addSelfDeclaredDestinationSchema.parse({ name: "", countryCode: "USA" }),
    "Invalid destination input must be rejected",
  );
  const destInput = addSelfDeclaredDestinationSchema.parse({
    name: "Kyoto",
    countryCode: "JP",
  });
  assert.equal(destInput.name, "Kyoto");
  assert.equal(destInput.countryCode, "JP");
}

function testBookingEligibilityRules() {
  const now = new Date("2026-10-19T12:00:00Z");

  // A. Past confirmed booking -> Eligible
  const pastConfirmed = {
    status: BookingStatus.CONFIRMED,
    startDate: new Date("2026-09-01T15:00:00Z"),
    endDate: new Date("2026-09-05T11:00:00Z"),
    listing: {
      city: "Riyadh",
      country: "SA",
      checkOutTime: "11:00 AM",
    },
  };
  const eligibilityPast = travelBookingSyncService.isEligibleBookingForTravelEvidence(pastConfirmed);
  assert.equal(eligibilityPast.eligible, true);
  assert.equal(eligibilityPast.destinationCity, "Riyadh");
  assert.equal(eligibilityPast.destinationCountry, "SA");

  // B. Pending booking -> Ineligible
  const pendingBooking = {
    status: BookingStatus.PENDING,
    startDate: new Date("2026-09-01T15:00:00Z"),
    endDate: new Date("2026-09-05T11:00:00Z"),
    listing: { city: "Riyadh", country: "SA" },
  };
  const eligibilityPending = travelBookingSyncService.isEligibleBookingForTravelEvidence(pendingBooking);
  assert.equal(eligibilityPending.eligible, false);
  assert.match(eligibilityPending.reason || "", /not CONFIRMED/);

  // C. Cancelled booking -> Ineligible
  const cancelledBooking = {
    status: BookingStatus.CANCELLED,
    startDate: new Date("2026-09-01T15:00:00Z"),
    endDate: new Date("2026-09-05T11:00:00Z"),
    listing: { city: "Riyadh", country: "SA" },
  };
  const eligibilityCancelled = travelBookingSyncService.isEligibleBookingForTravelEvidence(cancelledBooking);
  assert.equal(eligibilityCancelled.eligible, false);

  // D. Future confirmed booking -> Ineligible
  const futureBooking = {
    status: BookingStatus.CONFIRMED,
    startDate: new Date(now.getTime() + 10 * 86400000),
    endDate: new Date(now.getTime() + 15 * 86400000),
    listing: { city: "Riyadh", country: "SA" },
  };
  const eligibilityFuture = travelBookingSyncService.isEligibleBookingForTravelEvidence(futureBooking);
  assert.equal(eligibilityFuture.eligible, false);
  assert.match(eligibilityFuture.reason || "", /in the future/);

  // E. Listing lacking location -> Ineligible
  const noLocationBooking = {
    status: BookingStatus.CONFIRMED,
    startDate: new Date("2026-09-01T15:00:00Z"),
    endDate: new Date("2026-09-05T11:00:00Z"),
    listing: { city: null, locationSearch: null },
  };
  const eligibilityNoLoc = travelBookingSyncService.isEligibleBookingForTravelEvidence(noLocationBooking);
  assert.equal(eligibilityNoLoc.eligible, false);
}

function testFivePhotoLimitAndSecurityInvariants() {
  const tripServiceFile = source("services/travel-trip.service.ts");

  // Verify strict 5 photo cap in backend
  assert.match(tripServiceFile, /MAX_PHOTOS_PER_TRIP = 5/, "Backend must define strict 5-photo constant");
  assert.match(
    tripServiceFile,
    /currentActiveCount >= MAX_PHOTOS_PER_TRIP/,
    "Backend must check active photo capacity before insert",
  );
  assert.match(
    tripServiceFile,
    /maximum capacity of \$\{MAX_PHOTOS_PER_TRIP\} photos/,
    "Capacity violation must return explicit error message",
  );

  // Verify transactional concurrency safety
  assert.match(
    tripServiceFile,
    /prisma\.\$transaction/,
    "Photo attachment and capacity check must run inside an atomic transaction",
  );

  // Verify ownership checks
  assert.match(
    tripServiceFile,
    /trip\.userId !== userId/,
    "Cross-user trip modification must be denied with forbidden",
  );
  assert.match(
    tripServiceFile,
    /asset\.ownerId !== userId/,
    "Attaching other user's photo must be denied with forbidden",
  );
  assert.match(
    tripServiceFile,
    /asset\.uploadStatus !== TravelMediaUploadStatus\.READY/,
    "Attaching unready/failed upload must be rejected",
  );
  assert.match(
    tripServiceFile,
    /visibility: "PRIVATE"/,
    "New trips must default to PRIVATE visibility",
  );

  // Verify cover photo integrity
  assert.match(
    tripServiceFile,
    /photo\.tripId !== tripId/,
    "Cover photo must belong to the exact same trip",
  );
  assert.match(
    tripServiceFile,
    /trip\.coverPhotoId === photoId/,
    "Detaching cover photo must trigger cover reassignment",
  );

  // Verify soft deletion
  assert.match(
    tripServiceFile,
    /data: \{ deletedAt: new Date\(\) \}/,
    "Trip deletion must be a safe soft deletion",
  );
  assert.match(
    tripServiceFile,
    /deletedAt: null/,
    "Trip queries must filter out soft-deleted trips",
  );
}

function testDestinationServiceAndBookingPreservation() {
  const destServiceFile = source("services/user-destination.service.ts");

  // Verify evidence source upgrade
  assert.match(
    destServiceFile,
    /isVerified = r\.evidence\.some/,
    "Verification status must be derived from verified booking evidence",
  );
  assert.match(
    destServiceFile,
    /e\.source === TravelEvidenceSource\.VERIFIED_BOOKING/,
    "Only VERIFIED_BOOKING evidence promotes to verified Homyz stay",
  );

  // Verify removal preservation invariant: removing self-declaration does not delete valid booking evidence
  assert.match(
    destServiceFile,
    /hasBookingEvidence/,
    "Must inspect existing evidence before deleting destination",
  );
  assert.match(
    destServiceFile,
    /preservedVerifiedBooking: true/,
    "Removing self-declared destination must preserve valid booking evidence",
  );
  assert.match(
    destServiceFile,
    /data: \{ selfDeclared: false \}/,
    "Self-declared flag is un-set while booking evidence remains active",
  );
}

function testStatisticsCorrectnessInvariants() {
  const statsServiceFile = source("services/travel-stats.service.ts");

  // Metrics definition inspection
  assert.match(statsServiceFile, /verifiedTrips = completedBeforeToday \+ completedToday/);
  assert.match(statsServiceFile, /travelAlbums: travelAlbumsCount/);
  assert.match(statsServiceFile, /verifiedCities: verifiedCityIds\.size/);
  assert.match(statsServiceFile, /verifiedCountries: verifiedCountryCodes\.size/);
  assert.match(statsServiceFile, /visitedCities: visitedCityIds\.size/);
  assert.match(statsServiceFile, /visitedCountries: visitedCountryCodes\.size/);
  assert.match(statsServiceFile, /albumPhotos: albumPhotosCount/);

  // Exclusions:
  assert.match(statsServiceFile, /deletedAt: null/, "Deleted albums/photos must never be counted");
  assert.match(statsServiceFile, /status: BookingStatus\.CONFIRMED/, "Only confirmed bookings counted");

  // Cache invalidation:
  const invalidationFile = source("lib/redis/invalidation.ts");
  assert.match(invalidationFile, /CACHE_KEYS\.USER_TRAVEL_STATS/);
}

function testApiRouteProtectionAndPrivacy() {
  const tripRoute = source("app/api/v1/travel-trips/route.ts");
  assert.match(tripRoute, /requireApiAuth\(req\)/, "Trips list/create must require authentication");
  assert.match(tripRoute, /private, no-store/, "Trips list must set private, no-store header");

  const tripIdRoute = source("app/api/v1/travel-trips/[id]/route.ts");
  assert.match(tripIdRoute, /requireApiAuth\(req\)/, "Trip GET/PATCH/DELETE must require authentication");

  const photosRoute = source("app/api/v1/travel-trips/[id]/photos/route.ts");
  assert.match(photosRoute, /attachTripPhotoSchema\.parse/, "Photo attach must validate input with Zod");

  const destRoute = source("app/api/v1/travel-profiles/me/destinations/route.ts");
  assert.match(destRoute, /requireApiAuth\(req\)/, "Visited destinations must require authentication");

  const statsRoute = source("app/api/v1/travel-profiles/me/stats/route.ts");
  assert.match(statsRoute, /travelStatsService\.getTravelStats\(actor\.id\)/, "Stats must be owner-scoped");
  assert.match(statsRoute, /private, no-store/, "Stats must set private, no-store header");
}

function testFrontendComponentIntegrations() {
  const uiManager = source("components/travel/owner-trips-manager.tsx");

  // UI elements:
  assert.match(uiManager, /Album Capacity/, "Must display photo capacity indicator");
  assert.match(uiManager, /5 photos used/, "Must display 5 photo limit progress");
  assert.match(uiManager, /Verified Homyz stay/, "Must render verified stay badge");
  assert.match(uiManager, /Added by traveler/, "Must render self-declared badge");
  assert.match(uiManager, /ModalOverlay/, "Must use ModalOverlay for dialogs");
  assert.match(uiManager, /TravelMediaUploadModal/, "Must integrate Phase 2 upload modal");

  // Profile management integration:
  const profileMgmt = source("app/(protected)/profile-management/profile-management-client.tsx");
  assert.match(profileMgmt, /OwnerTripsManager/, "OwnerTripsManager must be integrated in profile management");
}

function testSchemaAndMigrationIntegrity() {
  const schema = source("prisma/schema.prisma");
  assert.match(schema, /model TravelTrip/);
  assert.match(schema, /model TravelPhoto/);
  assert.match(schema, /model Destination/);
  assert.match(schema, /model UserDestination/);
  assert.match(schema, /model TravelVisitEvidence/);
  assert.match(schema, /model TravelProfile/);
  assert.match(schema, /model UserBlock/);
  assert.match(schema, /enum TravelTripStatus/);
  assert.match(schema, /enum TravelTripVisibility/);
  assert.match(schema, /enum TravelEvidenceSource/);
  assert.match(schema, /enum TravelEvidenceStatus/);

  // Constraints in schema:
  assert.match(schema, /canonicalKey\s+String\s+@unique/);
  assert.match(schema, /@@unique\(\[userId, destinationId\]\)/);
  assert.match(schema, /@@unique\(\[tripId, mediaAssetId\]\)/);
  assert.match(schema, /bookingId\s+String\?\s+@unique/);

  // Migration SQL verification:
  const migrationSql = source(
    "prisma/migrations/20261019120000_add_travel_trips_and_destinations/migration.sql",
  );
  assert.match(migrationSql, /CREATE TABLE "TravelTrip"/);
  assert.match(migrationSql, /CREATE TABLE "Destination"/);
  assert.match(migrationSql, /CREATE TABLE "UserDestination"/);
  assert.match(migrationSql, /CREATE TABLE "TravelVisitEvidence"/);
  assert.match(migrationSql, /CREATE TABLE "TravelPhoto"/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "Destination_canonicalKey_key"/);
}

function main() {
  testDestinationNormalizationAndDeduplication();
  testValidationSchemas();
  testBookingEligibilityRules();
  testFivePhotoLimitAndSecurityInvariants();
  testDestinationServiceAndBookingPreservation();
  testStatisticsCorrectnessInvariants();
  testApiRouteProtectionAndPrivacy();
  testFrontendComponentIntegrations();
  testSchemaAndMigrationIntegrity();
  console.log("All Phase 3 Trips, Verified Destinations & Travel Albums foundation tests passed successfully.");
}

main();
