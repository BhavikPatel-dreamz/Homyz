import assert from "node:assert/strict";
import test from "node:test";
import { qualificationService } from "../services/qualification.service";
import {
  toPublicListingCardDTO,
  toPublicListingDTO,
  type PublicListingCardDTO,
} from "../services/mappers";
import { keys } from "../lib/redis/keys";

test("Phase 8: Badge Source of Truth and Independence", () => {
  // 1. Authoritative Guest Favorite: Listing level
  const gfListing = { id: "listing-1", isGuestFavorite: true };
  const nonGfListing = { id: "listing-2", isGuestFavorite: false };
  assert.equal(qualificationService.isGuestFavorite(gfListing), true);
  assert.equal(qualificationService.isGuestFavorite(nonGfListing), false);

  // 2. Authoritative Superhost: Host level
  const superHost = { id: "host-1", isSuperhost: true };
  const regularHost = { id: "host-2", isSuperhost: false };
  assert.equal(qualificationService.isSuperhost(superHost), true);
  assert.equal(qualificationService.isSuperhost(regularHost), false);

  // 3. Independence: Listing can have any of the 4 badge states
  // Case A: Both GF + Superhost
  assert.equal(qualificationService.isGuestFavorite(gfListing), true);
  assert.equal(qualificationService.isSuperhost(superHost), true);

  // Case B: GF only
  assert.equal(qualificationService.isGuestFavorite(gfListing), true);
  assert.equal(qualificationService.isSuperhost(regularHost), false);

  // Case C: Superhost only
  assert.equal(qualificationService.isGuestFavorite(nonGfListing), false);
  assert.equal(qualificationService.isSuperhost(superHost), true);

  // Case D: Neither
  assert.equal(qualificationService.isGuestFavorite(nonGfListing), false);
  assert.equal(qualificationService.isSuperhost(regularHost), false);
});

test("Phase 8: Public Listing Card DTO mapping & Privacy", () => {
  const mockDbListing = {
    id: "l-100",
    customSlug: "luxury-villa",
    title: "Luxury Villa",
    photos: ["https://example.com/photo1.jpg"],
    city: "Riyadh",
    country: "Saudi Arabia",
    propertyType: "Villa",
    listingType: "Entire place",
    price: 50000,
    weekdayBasePrice: 50000,
    weekendPrice: null,
    weekendPremium: null,
    customPrices: null,
    rating: 4.95,
    reviewsCount: 42,
    isFeatured: true,
    isGuestFavorite: true,
    latitude: 24.7136,
    longitude: 46.6753,
    host: {
      isSuperhost: true,
    },
    // Internal qualification diagnostics that MUST NOT be exposed
    qualityIncidentCount: 0,
    internalCompositeScore: 98.5,
    cancellationCount: 0,
    responseRateDiagnostics: "100%",
    accountStandingReason: "in_good_standing",
    evaluationFailureReasons: [],
  };

  const cardDto = toPublicListingCardDTO(mockDbListing as any);

  // Final boolean badges are mapped correctly
  assert.equal(cardDto.isGuestFavorite, true);
  assert.equal(cardDto.isSuperhost, true);
  assert.equal(cardDto.title, "Luxury Villa");

  // Verify internal diagnostic fields are NOT exposed on public DTO
  const publicKeys = Object.keys(cardDto);
  assert.equal(publicKeys.includes("qualityIncidentCount"), false);
  assert.equal(publicKeys.includes("internalCompositeScore"), false);
  assert.equal(publicKeys.includes("cancellationCount"), false);
  assert.equal(publicKeys.includes("responseRateDiagnostics"), false);
  assert.equal(publicKeys.includes("accountStandingReason"), false);
  assert.equal(publicKeys.includes("evaluationFailureReasons"), false);
});

test("Phase 8: Four Badge Combinations Mapping Matrix", () => {
  const baseListing = {
    id: "test-id",
    title: "Test Property",
    photos: [],
    price: 10000,
    rating: 4.8,
    reviewsCount: 15,
  };

  // Case A: [GF=true, Superhost=true]
  const cardA = toPublicListingCardDTO({
    ...baseListing,
    isGuestFavorite: true,
    host: { isSuperhost: true },
  } as any);
  assert.equal(cardA.isGuestFavorite, true);
  assert.equal(cardA.isSuperhost, true);

  // Case B: [GF=true, Superhost=false]
  const cardB = toPublicListingCardDTO({
    ...baseListing,
    isGuestFavorite: true,
    host: { isSuperhost: false },
  } as any);
  assert.equal(cardB.isGuestFavorite, true);
  assert.equal(cardB.isSuperhost, false);

  // Case C: [GF=false, Superhost=true]
  const cardC = toPublicListingCardDTO({
    ...baseListing,
    isGuestFavorite: false,
    host: { isSuperhost: true },
  } as any);
  assert.equal(cardC.isGuestFavorite, false);
  assert.equal(cardC.isSuperhost, true);

  // Case D: [GF=false, Superhost=false]
  const cardD = toPublicListingCardDTO({
    ...baseListing,
    isGuestFavorite: false,
    host: { isSuperhost: false },
  } as any);
  assert.equal(cardD.isGuestFavorite, false);
  assert.equal(cardD.isSuperhost, false);
});

test("Phase 8: Cache invalidation key consistency", () => {
  // listingsPublicVersion key is shared across homepage and public search
  const versionKey = keys.listingsPublicVersion();
  assert.equal(typeof versionKey, "string");
  assert.match(versionKey, /homyz:listings:published:ver/);
});
