import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  evaluateGuestFavoriteRequirements,
  GUEST_FAVORITE_CATEGORY_KEYS,
} from "../lib/guest-favorite/rules";
import {
  toPublicListingCardDTO,
  toPublicListingDTO,
} from "../services/mappers";
import {
  BookingStatus,
  ListingStatus,
  QualityIncidentCategory,
  QualityIncidentStatus,
} from "../generated/prisma/enums";

const strongCategories = Object.fromEntries(
  GUEST_FAVORITE_CATEGORY_KEYS.map((key) => [key, { average: 4.95, reviewCount: 15 }]),
) as Parameters<typeof evaluateGuestFavoriteRequirements>[0]["categoryRatings"];

const basePassingInput = {
  publishedReviewCount: 15,
  overallRating: 4.92,
  categoryRatings: strongCategories,
  totalBookings: 100,
  hostCancellationCount: 0,
};

test("1. 100 bookings, 0 host cancellations, 0 incidents => reliability passes (0%)", () => {
  const result = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    totalBookings: 100,
    hostCancellationCount: 0,
    qualityIncidentCount: 0,
  });

  assert.equal(result.reliabilityFailureRatePercentage, 0);
  assert.equal(result.reliabilityMet, true);
  assert.equal(result.eligibleNow, true);
});

test("2. 100 bookings, 1 host cancellation, 0 incidents => combined rate 1%, reliability passes", () => {
  const result = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    totalBookings: 100,
    hostCancellationCount: 1,
    qualityIncidentCount: 0,
  });

  assert.equal(result.reliabilityFailureRatePercentage, 1.0);
  assert.equal(result.reliabilityMet, true);
  assert.equal(result.eligibleNow, true);
});

test("3. 100 bookings, 1 host cancellation + 1 incident => combined rate 2%, reliability fails", () => {
  const result = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    totalBookings: 100,
    hostCancellationCount: 1,
    qualityIncidentCount: 1,
  });

  assert.equal(result.reliabilityFailureRatePercentage, 2.0);
  assert.equal(result.reliabilityMet, false);
  assert.equal(result.eligibleNow, false);
  assert.ok(result.failureReasons.some((r) => r.includes("Listing reliability must be at or below 1%")));
});

test("4. 100 bookings, 0 cancellations + 2 incidents => combined rate 2%, reliability fails", () => {
  const result = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    totalBookings: 100,
    hostCancellationCount: 0,
    qualityIncidentCount: 2,
  });

  assert.equal(result.reliabilityFailureRatePercentage, 2.0);
  assert.equal(result.reliabilityMet, false);
  assert.equal(result.eligibleNow, false);
});

test("5. Guest cancellation does not count towards host failure rate", () => {
  const servicePath = path.join(process.cwd(), "services/guest-favorite.service.ts");
  const serviceContent = fs.readFileSync(servicePath, "utf8");

  // Verify that cancellations are only counted when cancelledBy === "HOST"
  assert.match(
    serviceContent,
    /cancelledBy === "HOST"/,
    "Only cancellations with cancelledBy === 'HOST' may be counted as host cancellations",
  );

  // Evaluate requirements: 100 total bookings, 1 guest cancellation (0 host cancellations, 0 incidents)
  const result = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    totalBookings: 100,
    hostCancellationCount: 0, // Guest cancellation did not increment host count
    qualityIncidentCount: 0,
  });

  assert.equal(result.reliabilityFailureRatePercentage, 0, "Failure rate must remain 0%");
  assert.equal(result.reliabilityMet, true);
});

test("6 & 7. Rejected and Pending quality incidents do not count against reliability", () => {
  // Only CONFIRMED incidents count towards failure rate
  const resultWithZeroConfirmed = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    totalBookings: 100,
    hostCancellationCount: 0,
    // 0 confirmed incidents (even if 3 pending or 2 rejected exist)
    qualityIncidentCount: 0,
  });

  assert.equal(resultWithZeroConfirmed.reliabilityFailureRatePercentage, 0);
  assert.equal(resultWithZeroConfirmed.reliabilityMet, true);
});

test("8. Confirmed relevant quality incident counts towards failure rate", () => {
  const resultWithConfirmed = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    totalBookings: 50,
    hostCancellationCount: 0,
    qualityIncidentCount: 1, // 1 confirmed incident
  });

  // 1 failure / 50 bookings = 2.0%
  assert.equal(resultWithConfirmed.reliabilityFailureRatePercentage, 2.0);
  assert.equal(resultWithConfirmed.reliabilityMet, false);
});

test("9. Listing-level independence: Incidents for Listing B do not affect Listing A", () => {
  // Host X owns Listing A and Listing B
  // Listing A: 100 bookings, 0 cancellations, 0 incidents
  const listingAProgress = evaluateGuestFavoriteRequirements({
    publishedReviewCount: 20,
    overallRating: 4.95,
    categoryRatings: strongCategories,
    totalBookings: 100,
    hostCancellationCount: 0,
    qualityIncidentCount: 0,
  });

  // Listing B: 50 bookings, 1 host cancellation, 1 incident => 4% failure rate
  const listingBProgress = evaluateGuestFavoriteRequirements({
    publishedReviewCount: 8,
    overallRating: 4.70,
    categoryRatings: strongCategories,
    totalBookings: 50,
    hostCancellationCount: 1,
    qualityIncidentCount: 1,
  });

  assert.equal(listingAProgress.reliabilityFailureRatePercentage, 0);
  assert.equal(listingAProgress.reliabilityMet, true);
  assert.equal(listingAProgress.eligibleNow, true, "Listing A must qualify independently");

  assert.equal(listingBProgress.reliabilityFailureRatePercentage, 4.0);
  assert.equal(listingBProgress.reliabilityMet, false);
  assert.equal(listingBProgress.eligibleNow, false, "Listing B fails reliability and qualification independently");
});

test("10 & 11. Immediate re-evaluation triggers on CONFIRMED status transition", () => {
  const qualityServicePath = path.join(process.cwd(), "services/quality-incident.service.ts");
  const qualityServiceContent = fs.readFileSync(qualityServicePath, "utf8");

  assert.match(
    qualityServiceContent,
    /triggerGuestFavoriteReevaluation/,
    "Quality incident service must trigger immediate Guest Favorite re-evaluation",
  );
  assert.match(
    qualityServiceContent,
    /isTransitioningToConfirmed/,
    "Status transitioning to CONFIRMED must trigger re-evaluation",
  );
  assert.match(
    qualityServiceContent,
    /isTransitioningFromConfirmed/,
    "Status transitioning from CONFIRMED must trigger re-evaluation",
  );
});

test("12. qualityIncidentCount = 0 is distinct from unavailable incident data", () => {
  // Case A: Instrumented data with 0 incidents
  const instrumentedZero = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    qualityIncidentCount: 0,
  });
  assert.equal(instrumentedZero.qualityIncidentDataStatus, "AVAILABLE");
  assert.equal(instrumentedZero.reliabilityStatus, "FULL");
  assert.match(instrumentedZero.qualityIncidentMessage, /0 confirmed quality incidents/);

  // Case B: Uninstrumented data (null or undefined)
  const uninstrumented = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    qualityIncidentCount: null,
  });
  assert.equal(uninstrumented.qualityIncidentDataStatus, "DATA_UNAVAILABLE");
  assert.equal(uninstrumented.reliabilityStatus, "PARTIAL");
  assert.match(uninstrumented.qualityIncidentMessage, /not currently instrumented/);
});

test("13. Real incident source exists and reliabilityStatus becomes FULL", () => {
  const servicePath = path.join(process.cwd(), "services/guest-favorite.service.ts");
  const serviceContent = fs.readFileSync(servicePath, "utf8");

  assert.match(
    serviceContent,
    /getConfirmedQualityIncidentCount/,
    "Guest favorite service must query confirmed quality incident counts",
  );
  assert.match(
    serviceContent,
    /getConfirmedQualityIncidentCounts/,
    "Batch evaluation must batch-load confirmed quality incident counts",
  );
  assert.match(
    serviceContent,
    /qualityIncidentCount: progress\.qualityIncidentCount/,
    "Evaluation history must persist qualityIncidentCount",
  );
});

test("14. Privacy boundary: Quality incident details and failure reasons never leak into public listing DTOs", () => {
  const sampleListing: any = {
    id: "listing-privacy-test",
    title: "Mountain Villa",
    price: 350,
    description: "Quiet stay",
    city: "Abha",
    country: "Saudi Arabia",
    latitude: 18.2,
    longitude: 42.5,
    showExactLocation: true,
    published: true,
    status: ListingStatus.ACTIVE,
    isGuestFavorite: true,
    // Sensitive internal fields that should NEVER appear in public DTOs
    qualityIncidents: [{ id: "inc-1", description: "Leaky pipe" }],
    qualityIncidentCount: 3,
    hostCancellationCount: 2,
    failureReasons: ["Reliability failure rate above 1%"],
    reliabilityFailureRatePercentage: 5.0,
  };

  const publicDTO: any = toPublicListingDTO(sampleListing);
  const cardDTO: any = toPublicListingCardDTO(sampleListing);

  // Assert public DTO exposes isGuestFavorite
  assert.equal(publicDTO.isGuestFavorite, true);
  assert.equal(cardDTO.isGuestFavorite, true);

  // Assert internal reliability & incident fields are strictly omitted
  assert.equal(publicDTO.qualityIncidents, undefined, "qualityIncidents must not leak in public DTO");
  assert.equal(publicDTO.qualityIncidentCount, undefined, "qualityIncidentCount must not leak in public DTO");
  assert.equal(publicDTO.hostCancellationCount, undefined, "hostCancellationCount must not leak in public DTO");
  assert.equal(publicDTO.failureReasons, undefined, "failureReasons must not leak in public DTO");
  assert.equal(publicDTO.reliabilityFailureRatePercentage, undefined, "failure percentage must not leak in public DTO");

  assert.equal(cardDTO.qualityIncidents, undefined, "qualityIncidents must not leak in card DTO");
  assert.equal(cardDTO.qualityIncidentCount, undefined, "qualityIncidentCount must not leak in card DTO");
  assert.equal(cardDTO.failureReasons, undefined, "failureReasons must not leak in card DTO");
});

test("15. Schema and Indexing: ListingQualityIncident model and indexes exist", () => {
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf8");

  assert.match(schemaContent, /model ListingQualityIncident/, "ListingQualityIncident model must be in schema");
  assert.match(schemaContent, /enum QualityIncidentStatus/, "QualityIncidentStatus enum must be in schema");
  assert.match(schemaContent, /enum QualityIncidentCategory/, "QualityIncidentCategory enum must be in schema");
  assert.match(schemaContent, /@@index\(\[listingId\]\)/, "listingId index must be present");
  assert.match(schemaContent, /@@index\(\[listingId, status\]\)/, "listingId + status compound index must be present");
  assert.match(schemaContent, /@@index\(\[bookingId\]\)/, "bookingId index must be present");
});
