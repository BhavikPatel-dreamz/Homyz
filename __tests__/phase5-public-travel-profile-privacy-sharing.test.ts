import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  canViewTravelProfile,
  canAccessTravelPhoto,
  canAccessTravelTrip,
} from "@/services/travel-privacy.service";
import {
  getCanonicalProfileUrl,
  normalizePublicProfileId,
} from "@/services/public-travel-profile.service";
import { normalizeHandle, validateHandle } from "@/services/travel-profile.service";
import { TravelProfileVisibility, TravelFollowStatus } from "@/generated/prisma/client";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

// ============================================================================
// 1. UNIQUE HANDLE NORMALIZATION & CANONICAL URLS
// ============================================================================

test("Handle display names and canonical public IDs are independently stable", () => {
  assert.equal(normalizeHandle("  @John-Traveler  "), "john-traveler");
  assert.equal(normalizeHandle("SARAH_VOYAGER"), "sarah_voyager");
  assert.equal(normalizeHandle("@nomad.lens"), "nomad.lens");
  assert.equal(normalizeHandle(null), null);
  assert.equal(normalizeHandle(""), null);

  assert.equal(validateHandle("@alice_wanderer"), "alice_wanderer");
  assert.throws(() => validateHandle("a"), /3-30 characters/);
  assert.throws(() => validateHandle("user with spaces!"), /lowercase letters, numbers/);

  // Canonical profile URL
  const publicProfileId = "trv_a8f29b7c1234abcd";
  assert.equal(normalizePublicProfileId(publicProfileId.toUpperCase()), publicProfileId);
  assert.equal(normalizePublicProfileId("traveler"), null);
  const canonical = getCanonicalProfileUrl(publicProfileId);
  assert.match(canonical, /\/travelers\/trv_a8f29b7c1234abcd$/);
});

// ============================================================================
// 2. CENTRALIZED ACCESS CONTROL MATRIX & PRIVACY HIERARCHY
// ============================================================================

test("Privacy Access Matrix: Source code enforces hierarchical permission (Profile -> Trip -> Photo)", () => {
  const privacyServiceCode = read("services/travel-privacy.service.ts");

  // Owner always allowed
  assert.match(privacyServiceCode, /if\s*\(isOwner\)\s*\{\s*return\s*\{\s*canView:\s*true/);

  // Bi-directional blocking check
  assert.match(privacyServiceCode, /blockerId:\s*ownerId,\s*blockedId:\s*viewerId/);
  assert.match(privacyServiceCode, /blockerId:\s*viewerId,\s*blockedId:\s*ownerId/);

  // Hierarchy: Parent profile privacy overrides photo
  assert.match(privacyServiceCode, /profileAccess\s*=\s*await canViewTravelProfile/);
  assert.match(privacyServiceCode, /if\s*\(!profileAccess\.canView\)\s*\{\s*return\s*\{\s*canAccess:\s*false/);

  // Hierarchy: Parent trip privacy overrides photo
  assert.match(privacyServiceCode, /photo\.trip\.visibility\s*===\s*TravelProfileVisibility\.PRIVATE/);
  assert.match(privacyServiceCode, /photo\.trip\.visibility\s*===\s*TravelProfileVisibility\.FOLLOWERS_ONLY/);

  // Followers-only verification uses database follow status
  assert.match(privacyServiceCode, /follow\?\.status\s*===\s*TravelFollowStatus\.ACCEPTED/);
});

// ============================================================================
// 3. USER BLOCKING SYSTEM
// ============================================================================

test("User Blocking: Prevents self-blocking and revokes follow relationships in both directions", () => {
  const privacyServiceCode = read("services/travel-privacy.service.ts");

  // Self-block prohibited
  assert.match(privacyServiceCode, /blockerId === blockedId/);
  assert.match(privacyServiceCode, /cannot block yourself/i);

  // Automatically deletes follow relationships
  assert.match(privacyServiceCode, /prisma\.travelFollow\.deleteMany/);
  assert.match(privacyServiceCode, /followerId:\s*blockerId,\s*followingId:\s*blockedId/);
  assert.match(privacyServiceCode, /followerId:\s*blockedId,\s*followingId:\s*blockerId/);

  // Idempotent upsert
  assert.match(privacyServiceCode, /prisma\.userBlock\.upsert/);
});

// ============================================================================
// 4. SECURE MEDIA AUTHORIZATION & DIRECT URL PROTECTION
// ============================================================================

test("Media Security: Authorized endpoint enforces canAccessTravelPhoto with private cache headers", () => {
  const mediaRouteCode = read("app/api/v1/travel-media/media/[id]/route.ts");

  // Checks canAccessTravelPhoto
  assert.match(mediaRouteCode, /canAccessTravelPhoto\(actor\?\.id,\s*photo\.id\)/);

  // Returns 403 Forbidden for unauthorized access
  assert.match(mediaRouteCode, /status:\s*403/);
  assert.match(mediaRouteCode, /Access to protected travel media forbidden/);

  // Serves private, non-shared cache headers
  assert.match(mediaRouteCode, /Cache-Control/);
  assert.match(mediaRouteCode, /private/);
});

// ============================================================================
// 5. PUBLIC PROFILE DATA TRANSFER OBJECTS (SECURITY & PRIVACY)
// ============================================================================

test("Public DTOs: Source code strictly projects safe fields and omits sensitive user data", () => {
  const publicServiceCode = read("services/public-travel-profile.service.ts");

  // Omission of private details on restricted profiles
  assert.match(publicServiceCode, /bio:\s*null/);
  assert.match(publicServiceCode, /homeLocation:\s*null/);
  assert.match(publicServiceCode, /coverUrl:\s*null/);
  assert.match(publicServiceCode, /canViewContent:\s*false/);

  // Never selects password, email, phone, or private tokens in User queries
  assert.doesNotMatch(publicServiceCode, /select:\s*\{[^}]*email:\s*true/);
  assert.doesNotMatch(publicServiceCode, /select:\s*\{[^}]*password/);
  assert.doesNotMatch(publicServiceCode, /select:\s*\{[^}]*phoneNumber/);

  // Parent trip privacy enforcement in photo projection
  assert.match(publicServiceCode, /photo\.trip\?\.visibility\s*===\s*TravelProfileVisibility\.PRIVATE/);
  assert.match(publicServiceCode, /photo\.trip\?\.visibility\s*===\s*TravelProfileVisibility\.FOLLOWERS_ONLY/);
});

// ============================================================================
// 6. SHARE PROFILE MODAL & PRIVACY WARNINGS
// ============================================================================

test("Share Modal: Renders canonical URL, copy action, native share, and privacy warning", () => {
  const shareModalCode = read("components/travel/travel-profile-share-modal.tsx");

  // Canonical travelers URL
  assert.match(shareModalCode, /\/travelers\//);

  // Copy link
  assert.match(shareModalCode, /handleCopy/);
  assert.match(shareModalCode, /Copied!/);

  // Native share fallback
  assert.match(shareModalCode, /navigator\.share/);
  assert.match(shareModalCode, /Share via Device/);

  // Clear privacy warning for Private & Followers Only
  assert.match(shareModalCode, /Profile is Private/);
  assert.match(shareModalCode, /Sharing this link will not grant access/);
  assert.match(shareModalCode, /Followers Only/);
});

// ============================================================================
// 7. PRIVACY SETTINGS MODAL & VISIBILITY SWITCHER
// ============================================================================

test("Privacy Settings UI: Provides Public, Followers Only, and Private modes with blocked list", () => {
  const privacyModalCode = read("components/travel/travel-privacy-settings-modal.tsx");

  assert.match(privacyModalCode, /Public/);
  assert.match(privacyModalCode, /Followers Only/);
  assert.match(privacyModalCode, /Private/);
  assert.match(privacyModalCode, /Blocked Users/);
  assert.match(privacyModalCode, /handleUnblock/);
});

// ============================================================================
// 8. OPENGRAPH & DYNAMIC METADATA
// ============================================================================

test("OpenGraph & SEO: Generates dynamic metadata with noindex on private profiles", () => {
  const pageCode = read("app/travelers/[handle]/page.tsx");

  // Metadata generation
  assert.match(pageCode, /generateMetadata/);
  assert.match(pageCode, /openGraph/);
  assert.match(pageCode, /twitter/);

  // noindex / noarchive on private and restricted profiles
  assert.match(pageCode, /index:\s*false/);
  assert.match(pageCode, /follow:\s*false/);
  assert.match(pageCode, /noarchive:\s*true/);
});

// ============================================================================
// 9. PUBLIC ROUTE ACCESSIBILITY VIA PROXY
// ============================================================================

test("Proxy Middleware: Allows public anonymous access to /travelers without auth redirect", () => {
  const proxyCode = read("proxy.ts");

  // /travel-profile is protected in matcher
  assert.match(proxyCode, /"\/travel-profile"/);

  // /travelers route is NOT in the protected matcher
  assert.doesNotMatch(proxyCode, /"\/travelers"/);
  assert.doesNotMatch(proxyCode, /"\/travelers\/:path\*"/);
});

// ============================================================================
// 10. PUBLIC TRAVELER PROFILE VIEW (READ-ONLY VISITOR MODE)
// ============================================================================

test("Public Traveler View: Renders visitor mode hiding edit/upload controls and showing follow/share", () => {
  const publicViewCode = read("components/travel/public-travel-profile-client.tsx");

  // Read-only visitor: Has Follow button and Share Profile button
  assert.match(publicViewCode, /handleFollowToggle/);
  assert.match(publicViewCode, /Share profile/);

  // Overlapping avatar and cover banner matching Screenshot 1
  assert.match(publicViewCode, /profile\.displayName/);
  assert.match(publicViewCode, /profile\.coverUrl/);

  // Statistics pills
  assert.match(publicViewCode, /profile\.stats\.trips/);
  assert.match(publicViewCode, /profile\.stats\.likes/);
  assert.match(publicViewCode, /profile\.stats\.reviews/);

  // Restricted profile screen when content restricted
  assert.match(publicViewCode, /Private travel profile/);
  assert.match(publicViewCode, /Followers only profile/);

  // Never displays Edit Profile or Upload in public view
  assert.doesNotMatch(publicViewCode, /<button[^>]*>Edit Profile<\/button>/);
  assert.doesNotMatch(publicViewCode, /<button[^>]*>Upload<\/button>/);
});
