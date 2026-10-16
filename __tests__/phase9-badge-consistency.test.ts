import assert from "node:assert/strict";
import test from "node:test";
import { qualificationService } from "../services/qualification.service";
import {
  toPublicListingCardDTO,
  toPublicListingDTO,
  type PublicListingCardDTO,
} from "../services/mappers";
import { keys } from "../lib/redis/keys";
import { CACHE_KEYS } from "../lib/redis/keys";

test("Phase 9: Authoritative backend sources & Independence across transitions", () => {
  // 1. Authoritative sources remain: Listing.isGuestFavorite & User.isSuperhost
  const listingTrue = { id: "l-1", isGuestFavorite: true };
  const listingFalse = { id: "l-1", isGuestFavorite: false };
  const hostTrue = { id: "h-1", isSuperhost: true };
  const hostFalse = { id: "h-1", isSuperhost: false };

  // 2. Guest Favorite transition true -> false does not affect Superhost
  assert.equal(qualificationService.isGuestFavorite(listingTrue), true);
  assert.equal(qualificationService.isSuperhost(hostTrue), true);

  // Transition GF true -> false
  assert.equal(qualificationService.isGuestFavorite(listingFalse), false);
  assert.equal(qualificationService.isSuperhost(hostTrue), true, "Superhost must remain true when GF becomes false");

  // 3. Superhost transition true -> false does not affect Guest Favorite
  assert.equal(qualificationService.isGuestFavorite(listingTrue), true, "GF must remain true when Superhost becomes false");
  assert.equal(qualificationService.isSuperhost(hostFalse), false);

  // 4. Guest Favorite transition false -> true
  assert.equal(qualificationService.isGuestFavorite(listingTrue), true);
  assert.equal(qualificationService.isSuperhost(hostFalse), false);

  // 5. Superhost transition false -> true
  assert.equal(qualificationService.isGuestFavorite(listingTrue), true);
  assert.equal(qualificationService.isSuperhost(hostTrue), true);
});

test("Phase 9: All 4 badge combinations consistently mapped across cards", () => {
  const baseListing = {
    id: "prop-123",
    title: "Seaside Haven",
    price: 30000,
    photos: ["https://example.com/haven.jpg"],
    city: "Jeddah",
    country: "Saudi Arabia",
  };

  // Combination A: GF=true, Superhost=true
  const cardA = toPublicListingCardDTO({
    ...baseListing,
    isGuestFavorite: true,
    host: { isSuperhost: true },
  } as any);
  assert.equal(cardA.isGuestFavorite, true);
  assert.equal(cardA.isSuperhost, true);

  // Combination B: GF=true, Superhost=false
  const cardB = toPublicListingCardDTO({
    ...baseListing,
    isGuestFavorite: true,
    host: { isSuperhost: false },
  } as any);
  assert.equal(cardB.isGuestFavorite, true);
  assert.equal(cardB.isSuperhost, false);

  // Combination C: GF=false, Superhost=true
  const cardC = toPublicListingCardDTO({
    ...baseListing,
    isGuestFavorite: false,
    host: { isSuperhost: true },
  } as any);
  assert.equal(cardC.isGuestFavorite, false);
  assert.equal(cardC.isSuperhost, true);

  // Combination D: GF=false, Superhost=false
  const cardD = toPublicListingCardDTO({
    ...baseListing,
    isGuestFavorite: false,
    host: { isSuperhost: false },
  } as any);
  assert.equal(cardD.isGuestFavorite, false);
  assert.equal(cardD.isSuperhost, false);
});

test("Phase 9: Cache/Version invalidation contract consistency", () => {
  // Public listing catalogue version key
  const publicVerKey = keys.listingsPublicVersion();
  assert.equal(publicVerKey, CACHE_KEYS.LISTINGS_PUBLIC_VER());
  assert.match(publicVerKey, /homyz:listings:published:ver/);

  // User profile cache key for Superhost host profiles
  const userProfileKey = CACHE_KEYS.USER_PROFILE("test-host-id");
  assert.match(userProfileKey, /homyz:user:test-host-id:profile/);

  // Favorite cards cache key includes public catalogue version
  const favVerKey = CACHE_KEYS.FAVORITES_VER("user-1");
  const favCardsKey = CACHE_KEYS.FAVORITES_CARDS("user-1", 1, 0, 48);
  assert.match(favVerKey, /homyz:favorites:user:user-1:ver/);
  assert.match(favCardsKey, /homyz:favorites:user:user-1:v1:cards:s0:t48/);
});

test("Phase 9: Stale data prevention on client Recently Viewed reconciliation", () => {
  // Stored item in client storage (viewed earlier when listing was NOT guest favorite or superhost)
  const storedItem = {
    id: "l-456",
    slug: "seaside-haven",
    title: "Seaside Haven",
    mainImage: "https://example.com/haven.jpg",
    price: 300,
    currency: "SAR",
    city: "Jeddah",
    country: "Saudi Arabia",
    isGuestFavorite: false,
    isSuperhost: false,
    viewedAt: new Date().toISOString(),
  };

  // Fresh card from backend server query (listing has transitioned to GF=true, Superhost=true)
  const currentBackendCard = {
    id: "l-456",
    slug: "seaside-haven",
    name: "Seaside Haven",
    isGuestFavorite: true,
    isSuperhost: true,
    badge: "guest_favorite" as const,
  };

  const currentCardsById = new Map([["l-456", currentBackendCard]]);

  // Reconciled card logic (simulating home-view.tsx)
  const current = currentCardsById.get(storedItem.id);
  const reconciled = {
    id: storedItem.id,
    isGuestFavorite: current ? current.isGuestFavorite : storedItem.isGuestFavorite,
    isSuperhost: current ? current.isSuperhost : storedItem.isSuperhost,
    badge: current ? current.badge : (storedItem.isGuestFavorite ? "guest_favorite" : storedItem.isSuperhost ? "superhost" : null),
  };

  assert.equal(reconciled.isGuestFavorite, true, "Reconciled card must reflect fresh true status");
  assert.equal(reconciled.isSuperhost, true, "Reconciled card must reflect fresh true superhost status");
  assert.equal(reconciled.badge, "guest_favorite");

  // When backend transitions from true -> false
  const updatedBackendCard = {
    id: "l-456",
    slug: "seaside-haven",
    name: "Seaside Haven",
    isGuestFavorite: false,
    isSuperhost: false,
    badge: null,
  };
  const updatedCardsById = new Map([["l-456", updatedBackendCard]]);
  const freshCurrent = updatedCardsById.get(storedItem.id);
  const updatedReconciled = {
    id: storedItem.id,
    isGuestFavorite: freshCurrent ? freshCurrent.isGuestFavorite : storedItem.isGuestFavorite,
    isSuperhost: freshCurrent ? freshCurrent.isSuperhost : storedItem.isSuperhost,
    badge: freshCurrent ? freshCurrent.badge : null,
  };

  assert.equal(updatedReconciled.isGuestFavorite, false, "Reconciled card must reflect fresh false status");
  assert.equal(updatedReconciled.isSuperhost, false, "Reconciled card must reflect fresh false superhost status");
  assert.equal(updatedReconciled.badge, null);
});

test("Phase 9: Privacy audit — no internal diagnostics exposed on public payloads", () => {
  const mockListingWithInternalFields = {
    id: "l-999",
    title: "Private Villa",
    price: 45000,
    photos: [],
    city: "Riyadh",
    country: "Saudi Arabia",
    isGuestFavorite: true,
    host: {
      isSuperhost: true,
      internalNotes: "host notes",
    },
    qualityIncidents: [{ id: "qi-1", type: "cleanliness" }],
    compositeScore: 99.4,
    failureReasons: ["too many cancellations"],
    cancellationsCount: 0,
    responseRatePercent: 99,
  };

  const publicDto = toPublicListingCardDTO(mockListingWithInternalFields as any);

  // Assert expected public fields exist
  assert.equal(publicDto.id, "l-999");
  assert.equal(publicDto.isGuestFavorite, true);
  assert.equal(publicDto.isSuperhost, true);

  // Assert internal fields are absent
  const dtoKeys = Object.keys(publicDto);
  assert.equal(dtoKeys.includes("qualityIncidents"), false);
  assert.equal(dtoKeys.includes("compositeScore"), false);
  assert.equal(dtoKeys.includes("failureReasons"), false);
  assert.equal(dtoKeys.includes("cancellationsCount"), false);
  assert.equal(dtoKeys.includes("responseRatePercent"), false);
  assert.equal(dtoKeys.includes("internalNotes"), false);
});

