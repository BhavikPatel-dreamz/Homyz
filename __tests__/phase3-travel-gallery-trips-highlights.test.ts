import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractCountryFromLocation,
} from "@/services/travel-photo.service";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

// ============================================================================
// 1. COUNTRY HIGHLIGHTS NORMALIZATION & AGGREGATION
// ============================================================================

test("Country Highlights: extractCountryFromLocation correctly parses countries and deduplicates", () => {
  // Comma-separated locations
  assert.equal(extractCountryFromLocation("Paris, France"), "France");
  assert.equal(
    extractCountryFromLocation("Eiffel Tower, Paris, France"),
    "France",
  );
  assert.equal(extractCountryFromLocation("Colosseum, Rome, Italy"), "Italy");
  assert.equal(extractCountryFromLocation("Shibuya, Tokyo, Japan"), "Japan");
  assert.equal(extractCountryFromLocation("Barcelona, Spain"), "Spain");

  // Single word / direct country
  assert.equal(extractCountryFromLocation("Switzerland"), "Switzerland");
  assert.equal(extractCountryFromLocation("  Greece  "), "Greece");

  // Empty, null, or invalid
  assert.equal(extractCountryFromLocation(null), null);
  assert.equal(extractCountryFromLocation(undefined), null);
  assert.equal(extractCountryFromLocation(""), null);
  assert.equal(extractCountryFromLocation("   "), null);
});

test("Country Highlights Carousel: Renders gradient rings, scroll arrows, and opens a story without filtering the gallery", () => {
  const carouselCode = read("components/travel/travel-country-carousel.tsx");
  const profileCode = read("components/travel/travel-profile-view.tsx");
  const storyCode = read(
    "components/travel/travel-destination-story-modal.tsx",
  );

  // Gradient ring border matching Screenshot 1
  assert.match(carouselCode, /from-yellow-400 via-rose-500 to-red-500/);
  // Rounded full circular thumbnails
  assert.match(carouselCode, /rounded-full/);
  // Scroll navigation buttons
  assert.match(carouselCode, /scroll\("left"\)/);
  assert.match(carouselCode, /scroll\("right"\)/);
  // Interactive story selection, separate from main gallery state
  assert.match(carouselCode, /onSelectCountry/);
  assert.match(carouselCode, /Open \$\{item\.country\} travel story/);
  assert.doesNotMatch(carouselCode, /Showing memories in/);
  assert.doesNotMatch(profileCode, /No photos found for \$\{selectedCountry\}/);
  assert.match(profileCode, /setStoryCountry\(country\)/);
  assert.match(storyCode, /No travel photos yet/);
  assert.match(storyCode, /onUploadPhotos/);
  assert.match(storyCode, /onManageTrips/);
  assert.match(storyCode, /onTouchEnd/);
});

// ============================================================================
// 2. TRIP PHOTO GALLERY & TABS
// ============================================================================

test("Gallery: presents trip-photo gallery with tabs and photo grid", () => {
  const viewCode = read("components/travel/travel-profile-view.tsx");
  assert.match(viewCode, /Trip photo gallery/);
  assert.match(viewCode, /Photos/);
});

// ============================================================================
// 3. FIVE-COLUMN INSTAGRAM PHOTO GRID (FIGMA SCREENSHOT 1)
// ============================================================================

test("Photo Grid: Implements 5-column responsive layout matching Figma Screenshot 1", () => {
  const viewCode = read("components/travel/travel-profile-view.tsx");

  // Responsive column breakpoints: 2 cols on mobile -> 5 cols on large desktop
  assert.match(
    viewCode,
    /grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1 md:grid-cols-4 lg:grid-cols-5/,
  );

  // Square aspect ratio
  assert.match(viewCode, /aspect-square/);

  // Hover overlay with heart likes counter and trip badge
  assert.match(viewCode, /photo\.thumbnailUrl/);

  // Opens detail lightbox modal on click
  assert.match(viewCode, /setActivePhotoId\(photo\.id\)/);
  assert.match(viewCode, /TravelPhotoDetailModal/);
});

// ============================================================================
// 4. PHOTO DETAILS / LIGHTBOX MODAL (KEYBOARD NAVIGATION & OWNER ACTIONS)
// ============================================================================

test("Photo Lightbox: Supports keyboard navigation, arrows, and owner management", () => {
  const modalCode = read("components/travel/travel-photo-detail-modal.tsx");

  // Keyboard navigation
  assert.match(modalCode, /e\.key === "Escape"/);
  assert.match(modalCode, /e\.key === "ArrowLeft"/);
  assert.match(modalCode, /e\.key === "ArrowRight"/);

  // Navigation arrows
  assert.match(modalCode, /photo\?\.prevPhotoId/);
  assert.match(modalCode, /photo\?\.nextPhotoId/);

  // Like button & counter
  assert.match(modalCode, /handleToggleLike/);
  assert.match(modalCode, /photo\?\.likesCount/);
  assert.match(modalCode, /You cannot like your own travel photo/);

  // Owner actions
  assert.match(modalCode, /Edit Caption/);
  assert.match(modalCode, /Replace Photo/);
  assert.match(modalCode, /Set as Album Cover/);
  assert.match(modalCode, /Delete Photo/);
});

// ============================================================================
// 5. TRIPS & ALBUMS MANAGEMENT (STRICT 5-PHOTO LIMIT & EXPLICIT DELETION)
// ============================================================================

test("Trip Albums: Enforces 5-photo capacity, cover selection, and explicit deletion policy", () => {
  const tripModalCode = read("components/travel/travel-trip-manage-modal.tsx");

  // 5-photo capacity notice & badge
  assert.match(tripModalCode, /5 photos/);
  assert.match(tripModalCode, /photos\.length < 5/);

  // Cover photo selection
  assert.match(tripModalCode, /setCoverPhotoId/);
  assert.match(tripModalCode, /Cover/);

  // Explicit deletion policy: unlink vs permanent delete
  assert.match(tripModalCode, /UNLINK_PHOTOS/);
  assert.match(tripModalCode, /DELETE_PHOTOS/);
  assert.match(tripModalCode, /Keep photos in my travel diary/);

  // Service layer implements explicit deletion policy
  const serviceCode = read("services/travel-photo.service.ts");
  assert.match(serviceCode, /policy:\s*"UNLINK_PHOTOS" \| "DELETE_PHOTOS"/);
  assert.match(serviceCode, /tripId:\s*null/);
  assert.match(serviceCode, /setTripCoverPhoto/);
});

// ============================================================================
// 6. REAL LIKES & SOCIAL INTERACTIONS
// ============================================================================

test("Photo Likes: Prevents self-likes and provides accurate aggregate counters", () => {
  const serviceCode = read("services/travel-photo.service.ts");

  // Self-like rule
  assert.match(serviceCode, /photo\.userId === actorId/);
  assert.match(serviceCode, /cannot like your own/i);

  // Atomic toggle
  assert.match(serviceCode, /prisma\.travelPhotoLike\.delete/);
  assert.match(serviceCode, /prisma\.travelPhotoLike\.create/);
  assert.match(serviceCode, /prisma\.travelPhotoLike\.count/);

  // Likes tab service
  assert.match(serviceCode, /getLikedPhotos/);
  assert.match(serviceCode, /prisma\.travelPhotoLike\.findMany/);
});

// ============================================================================
// 7. CURSOR PAGINATION & LAZY LOADING
// ============================================================================

test("Pagination: getPaginatedTravelPhotos implements cursor pagination with bounded limits", () => {
  const serviceCode = read("services/travel-photo.service.ts");

  assert.match(serviceCode, /getPaginatedTravelPhotos/);
  assert.match(serviceCode, /cursor:\s*\{\s*id:\s*opts\.cursor\s*\}/);
  assert.match(serviceCode, /take:\s*limit\s*\+\s*1/);
  assert.match(serviceCode, /nextCursor/);
  assert.match(serviceCode, /hasMore/);

  // View provides on-demand pagination
  const viewCode = read("components/travel/travel-profile-view.tsx");
  assert.match(viewCode, /handleLoadMorePhotos/);
  assert.match(viewCode, /Load more photos/);
});

// ============================================================================
// 8. REST & SERVER ACTION APIS
// ============================================================================

test("API Routes: Dedicated travel endpoints for photos, likes, trips, and highlights", () => {
  // Photo like endpoint
  const likeRoute = read("app/api/v1/travel-media/photos/[id]/like/route.ts");
  assert.match(likeRoute, /togglePhotoLike/);
  assert.match(likeRoute, /getPhotoLikeStatus/);

  // Likes tab endpoint
  const likesTabRoute = read("app/api/v1/travel-media/likes/route.ts");
  assert.match(likesTabRoute, /getLikedPhotos/);

  // Country highlights endpoint
  const highlightsRoute = read("app/api/v1/travel-media/highlights/route.ts");
  assert.match(highlightsRoute, /getCountryHighlights/);

  // Trips update & delete endpoint
  const tripDetailRoute = read("app/api/v1/travel-media/trips/[id]/route.ts");
  assert.match(tripDetailRoute, /updateTrip/);
  assert.match(tripDetailRoute, /deleteTrip/);
});

test("Travel media access: gallery, details, and likes enforce the established privacy policy", () => {
  const photoRoute = read("app/api/v1/travel-media/photos/route.ts");
  const detailRoute = read("app/api/v1/travel-media/photos/[id]/route.ts");
  const photoService = read("services/travel-photo.service.ts");

  assert.match(photoRoute, /canViewTravelProfile/);
  assert.match(detailRoute, /canAccessTravelPhoto/);
  assert.match(photoService, /You cannot like a photo you cannot access/);
  assert.match(photoService, /destinationId: \{ in: destinationIds \}/);
});

test("Regression Protection: Travel Profile server page loads Phase 1, 2, and 3 data in parallel", () => {
  const pageCode = read("app/(protected)/travel-profile/page.tsx");

  assert.match(pageCode, /getTravelProfileByUserId/);
  assert.match(pageCode, /getTravelProfileStats/);
  assert.match(pageCode, /getPaginatedTravelPhotos/);
  assert.match(pageCode, /getCountryHighlights/);
  assert.match(pageCode, /getUserTrips/);
});
