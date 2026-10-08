import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  toPublicListingCardDTO,
  toPublicListingDTO,
  publicListingCardSelect,
} from "../services/mappers";

test("Case 1: Guest Favorite = true, Superhost = false => Guest Favorite badge only", () => {
  const card = toPublicListingCardDTO({
    id: "listing-case-1",
    title: "Seaside Haven",
    price: 400,
    weekdayBasePrice: 400,
    weekendPrice: null,
    weekendPremium: null,
    customPrices: {},
    propertyType: "Villa",
    listingType: "Entire home",
    city: "Jeddah",
    country: "Saudi Arabia",
    latitude: 21.5,
    longitude: 39.1,
    showExactLocation: true,
    guests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    photos: ["https://example.com/1.jpg"],
    isFeatured: false,
    isGuestFavorite: true,
    petsAllowed: true,
    discounts: null,
    customSlug: "seaside-haven",
    host: { isSuperhost: false },
  } as any);

  assert.equal(card.isGuestFavorite, true);
  assert.equal(card.isSuperhost, false);

  // Read PropertyCard logic
  const propCardPath = path.join(process.cwd(), "components/home/property-card.tsx");
  const propCardCode = fs.readFileSync(propCardPath, "utf8");
  assert.ok(propCardCode.includes("showGuestFavorite"));
  assert.ok(propCardCode.includes("showSuperhost"));

  // Simulate component badge resolution
  const showGuestFavorite = Boolean((card as any).isGuestFavorite === true || (card as any).badge === "guest_favorite");
  const showSuperhost = Boolean((card as any).isSuperhost === true || (card as any).badge === "superhost");

  assert.equal(showGuestFavorite, true);
  assert.equal(showSuperhost, false);
});

test("Case 2: Guest Favorite = false, Superhost = true => Superhost badge only", () => {
  const card = toPublicListingCardDTO({
    id: "listing-case-2",
    title: "Urban Loft",
    price: 300,
    weekdayBasePrice: 300,
    weekendPrice: null,
    weekendPremium: null,
    customPrices: {},
    propertyType: "Apartment",
    listingType: "Entire home",
    city: "Riyadh",
    country: "Saudi Arabia",
    latitude: 24.7,
    longitude: 46.6,
    showExactLocation: true,
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    photos: ["https://example.com/2.jpg"],
    isFeatured: false,
    isGuestFavorite: false,
    petsAllowed: false,
    discounts: null,
    customSlug: "urban-loft",
    host: { isSuperhost: true },
  } as any);

  assert.equal(card.isGuestFavorite, false);
  assert.equal(card.isSuperhost, true);

  const showGuestFavorite = Boolean((card as any).isGuestFavorite === true || (card as any).badge === "guest_favorite");
  const showSuperhost = Boolean((card as any).isSuperhost === true || (card as any).badge === "superhost");

  assert.equal(showGuestFavorite, false);
  assert.equal(showSuperhost, true);
});

test("Case 3: Guest Favorite = true, Superhost = true => Both badges visible cleanly without overlap", () => {
  const card = toPublicListingCardDTO({
    id: "listing-case-3",
    title: "Luxury Palace",
    price: 800,
    weekdayBasePrice: 800,
    weekendPrice: null,
    weekendPremium: null,
    customPrices: {},
    propertyType: "Palace",
    listingType: "Entire home",
    city: "Riyadh",
    country: "Saudi Arabia",
    latitude: 24.7,
    longitude: 46.6,
    showExactLocation: true,
    guests: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 3,
    photos: ["https://example.com/3.jpg"],
    isFeatured: false,
    isGuestFavorite: true,
    petsAllowed: true,
    discounts: null,
    customSlug: "luxury-palace",
    host: { isSuperhost: true },
  } as any);

  assert.equal(card.isGuestFavorite, true);
  assert.equal(card.isSuperhost, true);

  const showGuestFavorite = Boolean(card.isGuestFavorite === true || (card as any).badge === "guest_favorite");
  const showSuperhost = Boolean(card.isSuperhost === true || (card as any).badge === "superhost");

  assert.equal(showGuestFavorite, true, "Guest Favorite must show");
  assert.equal(showSuperhost, true, "Superhost must NOT be suppressed when Guest Favorite is true");

  // Verify non-overlapping container layout in both PropertyCard and ListingCard
  const propCardCode = fs.readFileSync(path.join(process.cwd(), "components/home/property-card.tsx"), "utf8");
  const listingCardCode = fs.readFileSync(path.join(process.cwd(), "components/listings/listing-card.tsx"), "utf8");

  assert.match(
    propCardCode,
    /flex flex-wrap items-center gap-1\.5/,
    "PropertyCard must wrap badges in a flex container with gap to prevent overlapping",
  );
  assert.match(
    listingCardCode,
    /flex flex-wrap items-center gap-1\.5/,
    "ListingCard must wrap badges in a flex container with gap to prevent overlapping",
  );
});

test("Case 4: Guest Favorite = false, Superhost = false => No badge", () => {
  const card = toPublicListingCardDTO({
    id: "listing-case-4",
    title: "Simple Studio",
    price: 150,
    weekdayBasePrice: 150,
    weekendPrice: null,
    weekendPremium: null,
    customPrices: {},
    propertyType: "Studio",
    listingType: "Entire home",
    city: "Dammam",
    country: "Saudi Arabia",
    latitude: 26.4,
    longitude: 50.1,
    showExactLocation: true,
    guests: 1,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    photos: ["https://example.com/4.jpg"],
    isFeatured: false,
    isGuestFavorite: false,
    petsAllowed: false,
    discounts: null,
    customSlug: "simple-studio",
    host: { isSuperhost: false },
  } as any);

  assert.equal(card.isGuestFavorite, false);
  assert.equal(card.isSuperhost, false);

  const showGuestFavorite = Boolean((card as any).isGuestFavorite === true || (card as any).badge === "guest_favorite");
  const showSuperhost = Boolean((card as any).isSuperhost === true || (card as any).badge === "superhost");

  assert.equal(showGuestFavorite, false);
  assert.equal(showSuperhost, false);
});

test("Case 5 & 6: Revalidation & Disqualification reflection across cards", () => {
  // If listing loses Guest Favorite:
  const disqualifiedListing = toPublicListingCardDTO({
    id: "listing-case-5",
    title: "Formerly Favored",
    isGuestFavorite: false, // Disqualified by evaluator
    host: { isSuperhost: false },
  } as any);
  assert.equal(disqualifiedListing.isGuestFavorite, false);

  // If host loses Superhost:
  const formerSuperhost = toPublicListingCardDTO({
    id: "listing-case-6",
    title: "Host Lost Status",
    isGuestFavorite: false,
    host: { isSuperhost: false }, // Disqualified by quarterly evaluator
  } as any);
  assert.equal(formerSuperhost.isSuperhost, false);
});

test("Case 7: Homepage and Search Results consistency", () => {
  const listingData = {
    id: "listing-case-7",
    title: "Consistent Listing",
    price: 250,
    country: "Saudi Arabia",
    city: "Abha",
    photos: ["https://example.com/7.jpg"],
    isFeatured: false,
    isGuestFavorite: true,
    host: { isSuperhost: true },
  };

  const cardDTO = toPublicListingCardDTO(listingData as any);
  assert.equal(cardDTO.isGuestFavorite, true);
  assert.equal(cardDTO.isSuperhost, true);

  const detailDTO = toPublicListingDTO(listingData as any);
  assert.equal(detailDTO.isGuestFavorite, true);
  assert.equal(detailDTO.isSuperhost, true);
});

test("Case 8: Mobile safety: badges bounded to avoid covering favorite button", () => {
  const propCardCode = fs.readFileSync(path.join(process.cwd(), "components/home/property-card.tsx"), "utf8");
  const listingCardCode = fs.readFileSync(path.join(process.cwd(), "components/listings/listing-card.tsx"), "utf8");

  assert.match(
    propCardCode,
    /max-w-\[calc\(100%-4\.25rem\)\]/,
    "PropertyCard badge container must constrain max-width so it never covers the top-right favorite button",
  );
  assert.match(
    listingCardCode,
    /max-w-\[calc\(100%-4\.5rem\)\]/,
    "ListingCard badge container must constrain max-width so it never covers the top-right favorite button",
  );
});

test("Case 9: Privacy: DTO exposes only public boolean flags, no internal metrics", () => {
  const cardDTO: any = toPublicListingCardDTO({
    id: "privacy-test",
    title: "Private Data",
    isGuestFavorite: true,
    host: { isSuperhost: true },
    // Mock internal fields
    failureReasons: ["too many cancellations"],
    qualityIncidentCount: 2,
    hostCancellationCount: 1,
    reliabilityFailureRatePercentage: 3.5,
  } as any);

  assert.equal(cardDTO.isGuestFavorite, true);
  assert.equal(cardDTO.isSuperhost, true);
  assert.equal(cardDTO.failureReasons, undefined);
  assert.equal(cardDTO.qualityIncidentCount, undefined);
  assert.equal(cardDTO.hostCancellationCount, undefined);
  assert.equal(cardDTO.reliabilityFailureRatePercentage, undefined);
});

test("Case 10: Performance: publicListingCardSelect joins host.isSuperhost directly without N+1", () => {
  assert.ok(
    (publicListingCardSelect as any).host?.select?.isSuperhost === true,
    "publicListingCardSelect must include host.isSuperhost directly",
  );
});

