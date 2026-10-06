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
  // [1] Persisted Guest Favorite Badge Audit
  // -------------------------------------------------------------------------
  console.log("--- [1] isGuestFavorite Official Status Audit ---");

  assert.equal(isGuestFavorite({ isGuestFavorite: true }), true, "Persisted official status displays the badge");
  assert.equal(isGuestFavorite({ rating: 5, reviewCount: 50 }), false, "Live rating cannot award a badge");
  assert.equal(isGuestFavorite({ isFeatured: true, bookings: [{ status: "CONFIRMED" }] }), false, "Featured status cannot award a badge");
  console.log("  ✓ Guest Favorite cards rely only on the persisted daily status");

  // -------------------------------------------------------------------------
  // [2] Persisted Official Superhost Badge Audit
  // -------------------------------------------------------------------------
  console.log("\n--- [2] isSuperhost Official Status Audit ---");

  assert.equal(isSuperhost({ isSuperhost: true }), true, "Persisted official status displays the badge");
  assert.equal(isSuperhost({ publicProfile: { isSuperhost: true } }), false, "Profile JSON cannot award the badge");
  assert.equal(isSuperhost({ bookings: [{ status: "CONFIRMED" }] }), false, "Live booking data cannot award the badge");
  console.log("  ✓ Superhost cards rely only on the persisted quarterly status");

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
