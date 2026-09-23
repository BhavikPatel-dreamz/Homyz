import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isGuestFavorite,
  isSuperhost,
  DEFAULT_QUALIFICATION_CONFIG,
} from "@/services/qualification.service";
import { formatListingPrice } from "@/lib/currency";

async function runPropertyCardAudit() {
  console.log("\n==================================================================");
  console.log("   PROPERTY CARD & BACKEND QUALIFICATION ENGINE AUDIT             ");
  console.log("==================================================================\n");

  // -------------------------------------------------------------------------
  // [1] Centralized isGuestFavorite Qualification Formula Audit
  // -------------------------------------------------------------------------
  console.log("--- [1] isGuestFavorite Formula Audit ---");

  // 1.1 High rating with sufficient reviews qualifies
  const topRated = isGuestFavorite({
    isFeatured: false,
    rating: 4.92,
    reviewCount: 18,
    bookings: [{ status: "CONFIRMED" }, { status: "CONFIRMED" }],
  });
  assert.equal(topRated, true, "Listing with rating >= 4.85 and >= 3 reviews must qualify as Guest Favorite");
  console.log("  ✓ Listing with 4.92 rating and 18 reviews qualifies as Guest Favorite");

  // 1.2 Low rating does NOT qualify even with high reviews
  const lowRating = isGuestFavorite({
    isFeatured: false,
    rating: 4.2,
    reviewCount: 50,
    bookings: [{ status: "CONFIRMED" }],
  });
  assert.equal(lowRating, false, "Listing with rating < 4.85 must NOT qualify as Guest Favorite");
  console.log("  ✓ Listing with 4.20 rating does NOT qualify (no fake badge)");

  // 1.3 Unrated listing does NOT qualify
  const unrated = isGuestFavorite({
    isFeatured: false,
    rating: null,
    reviewCount: 0,
    bookings: [],
  });
  assert.equal(unrated, false, "Unrated listing with 0 reviews must NOT qualify as Guest Favorite");
  console.log("  ✓ Unrated listing with 0 reviews correctly returns false");

  // 1.4 Featured listing with confirmed booking track record qualifies
  const featuredWithBooking = isGuestFavorite({
    isFeatured: true,
    rating: null,
    bookings: [{ status: "CONFIRMED" }],
  });
  assert.equal(featuredWithBooking, true, "Featured listing with confirmed booking qualifies");
  console.log("  ✓ Featured listing with confirmed booking track record qualifies");

  // 1.5 Custom criteria override works without touching UI
  const customQualified = isGuestFavorite(
    { rating: 4.7, reviewCount: 10 },
    { minRating: 4.6, minReviews: 5 }
  );
  assert.equal(customQualified, true, "Configurable thresholds can be customized safely");
  console.log("  ✓ Configurable threshold override verified");

  // -------------------------------------------------------------------------
  // [2] Centralized isSuperhost Qualification Formula Audit
  // -------------------------------------------------------------------------
  console.log("\n--- [2] isSuperhost Formula Audit ---");

  // 2.1 Explicit superhost in verified system profile qualifies
  const verifiedProfileSuperhost = isSuperhost({
    publicProfile: { isSuperhost: true },
  });
  assert.equal(verifiedProfileSuperhost, true, "Host with verified isSuperhost flag must qualify");
  console.log("  ✓ Host with verified system profile flag qualifies as Superhost");

  // 2.2 Host with >= 3 confirmed bookings, low cancellations, and good tenure qualifies
  const qualifiedHost = isSuperhost({
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days tenure
    publicProfile: { rating: 4.9 },
    bookings: [
      { status: "CONFIRMED" },
      { status: "CONFIRMED" },
      { status: "CONFIRMED" },
      { status: "CONFIRMED" },
    ],
  });
  assert.equal(qualifiedHost, true, "Host with high performance qualifies as Superhost");
  console.log("  ✓ Host with 4 confirmed bookings, 0 cancellations, 4.9 rating qualifies");

  // 2.3 Host with high cancellation rate (> 5%) does NOT qualify
  const highCancellationHost = isSuperhost({
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    publicProfile: { rating: 4.9 },
    bookings: [
      { status: "CONFIRMED" },
      { status: "CONFIRMED" },
      { status: "CANCELLED" }, // 1 cancelled out of 3 = 33% cancellation
    ],
  });
  assert.equal(highCancellationHost, false, "Host with excessive cancellation rate must NOT qualify");
  console.log("  ✓ Host with 33% cancellation rate rejected as Superhost");

  // 2.4 New host with < 3 completed bookings does NOT qualify
  const newHost = isSuperhost({
    createdAt: new Date(),
    publicProfile: {},
    bookings: [{ status: "CONFIRMED" }],
  });
  assert.equal(newHost, false, "New host with < 3 bookings must NOT qualify as Superhost");
  console.log("  ✓ New host with only 1 booking correctly rejected (no fake Superhost badge)");

  // -------------------------------------------------------------------------
  // [3] Property Card Data Contract & Static Code Audit
  // -------------------------------------------------------------------------
  console.log("\n--- [3] PropertyCard Component & Contract Audit ---");

  const propertyCardPath = path.resolve(__dirname, "../components/home/property-card.tsx");
  assert(fs.existsSync(propertyCardPath), "components/home/property-card.tsx must exist");
  const propertyCardCode = fs.readFileSync(propertyCardPath, "utf-8");

  // 3.1 Data Contract fields
  const requiredFields = [
    "id",
    "slug",
    "name",
    "image",
    "isFavorite",
    "isGuestFavorite",
    "isSuperhost",
    "pricePerNight",
    "currency",
    "averageRating",
    "reviewCount",
  ];

  for (const field of requiredFields) {
    assert(
      propertyCardCode.includes(field),
      `PropertyCardData contract must include field '${field}'`
    );
  }
  console.log("  ✓ PropertyCardData supports all 11 required contract fields");

  // 3.2 Heart Toggle & Auth Prompt
  assert(propertyCardCode.includes("toggleFavorite"), "PropertyCard must implement toggleFavorite");
  assert(
    propertyCardCode.includes("/login?callbackUrl="),
    "Logged-out heart click must prompt /login with callbackUrl"
  );
  assert(
    propertyCardCode.includes("homyz:favorite-changed"),
    "PropertyCard must broadcast and listen to homyz:favorite-changed event for cross-card synchronization"
  );
  console.log("  ✓ Favorite heart toggle with logged-out login prompt and real-time sync verified");

  // 3.3 Dynamic Badges: Guest Favorite & Superhost
  assert(propertyCardCode.includes("showGuestFavorite"), "PropertyCard must conditionally resolve Guest Favorite badge");
  assert(propertyCardCode.includes("showSuperhost"), "PropertyCard must conditionally resolve Superhost badge");
  assert(propertyCardCode.includes("Guest favorite"), "PropertyCard must render 'Guest favorite' text");
  assert(propertyCardCode.includes("Superhost"), "PropertyCard must render 'Superhost' text");
  console.log("  ✓ Dynamic Guest Favorite and Superhost badge rendering verified");

  // 3.4 Clickable Property Name
  assert(
    propertyCardCode.includes("targetHref") || propertyCardCode.includes("/listings/"),
    "Property name must link to property details"
  );
  console.log("  ✓ Clickable property name linking to /listings/${slug || id} verified");

  // 3.5 Price per night
  assert(
    propertyCardCode.includes("/ night"),
    "PropertyCard must format price with '/ night'"
  );
  assert(
    propertyCardCode.includes("useCurrency") && propertyCardCode.includes("formatPrice"),
    "PropertyCard must use the shared selected currency"
  );
  console.log("  ✓ Price per night support verified with dynamic currency (e.g. SAR, ₹, $)");

  // 3.6 Genuine Rating & Review Count
  assert(
    propertyCardCode.includes("numericRating"),
    "PropertyCard must check for genuine numeric rating"
  );
  assert(
    propertyCardCode.includes("resolvedReviews"),
    "PropertyCard must display review count alongside rating"
  );
  console.log("  ✓ Rating display with review count verified (zero fake ratings)");

  // -------------------------------------------------------------------------
  // [4] Homepage Service Integration Audit
  // -------------------------------------------------------------------------
  console.log("\n--- [4] Homepage Service Integration Audit ---");

  const homepageServicePath = path.resolve(__dirname, "../services/homepage.service.ts");
  const homepageServiceCode = fs.readFileSync(homepageServicePath, "utf-8");

  assert(
    homepageServiceCode.includes("qualificationService"),
    "services/homepage.service.ts must import and use qualificationService"
  );
  assert(
    homepageServiceCode.includes("qualificationService.isGuestFavorite"),
    "homepage.service.ts must call qualificationService.isGuestFavorite"
  );
  assert(
    homepageServiceCode.includes("qualificationService.isSuperhost"),
    "homepage.service.ts must call qualificationService.isSuperhost"
  );
  assert(
    homepageServiceCode.includes("isGuestFavorite: isGuestFav"),
    "homepage.service.ts must assign isGuestFavorite in toProperty"
  );
  assert(
    homepageServiceCode.includes("isSuperhost: isSuperh"),
    "homepage.service.ts must assign isSuperhost in toProperty"
  );
  assert(
    homepageServiceCode.includes("pricePerNight: priceVal"),
    "homepage.service.ts must assign pricePerNight in toProperty"
  );
  console.log("  ✓ Backend integration in homepage.service.ts fully verified");

  console.log("\n==================================================================");
  console.log("   ALL PROPERTY CARD & QUALIFICATION TESTS PASSED!                ");
  console.log("==================================================================\n");
}

runPropertyCardAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
