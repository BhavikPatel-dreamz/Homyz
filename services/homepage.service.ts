import { prisma } from "@/lib/db/prisma";
import { getCounter, getOrSetCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";
import { CACHE_TTL } from "@/lib/redis/ttl";
import { BookingStatus, ListingStatus } from "@/generated/prisma/enums";
import { parseCutoffHour, parseRequiredAdvanceDays } from "@/services/booking.service";
import { favoriteService } from "@/services/favorite.service";
import { getHomepagePopularHomesConfig, type HomepagePopularHomesConfig } from "@/services/app-settings.service";
import { reverseGeocodeLocation } from "@/lib/location/geocoding";
import { calculateDistance } from "@/lib/location/places-search";
import { getCurrencyForCountry } from "@/lib/currency";
import type { SearchContext } from "@/lib/location/search-context";
import { qualificationService } from "@/services/qualification.service";

export const SECTION_LIMIT = 12;
const CANDIDATE_LIMIT = 200;
const MIN_PROPERTY_CAROUSEL = 3;

export type HomepageProperty = {
  id: string;
  slug: string | null;
  name: string;
  title: string;
  city: string | null;
  area: string | null;
  country: string | null;
  image: string;
  imageUrl: string;
  mainImage: string;
  price: number;
  pricePerNight: number;
  currency: string;
  maxGuests: number;
  propertyType: string | null;
  featured: boolean;
  isFavorite: boolean;
  favoriteStatus: boolean;
  isGuestFavorite: boolean;
  isSuperhost: boolean;
  averageRating: number | null;
  rating: number | null;
  reviewCount: number | null;
  badge?: "guest_favorite" | "superhost" | "featured" | null;
  alternativeDates?: string | null;
  distanceKm?: number;
};

export type HomepageSectionType =
  | "PROPERTY"
  | "DESTINATION"
  | "PROMOTION"
  | "FEATURED"
  | "LOCATION"
  | "WEEKEND"
  | "THIS_MONTH"
  | "NEXT_MONTH";

export type HomepageSectionSource =
  | "SEARCH"
  | "DATE"
  | "SIMILAR_DATE"
  | "AREA"
  | "NEARBY"
  | "CURRENT_LOCATION"
  | "TRENDING"
  | "RECENT"
  | "RECOMMENDATION";

export type HomepageSection = {
  id: string;
  title: string;
  subtitle?: string;
  type: HomepageSectionType;
  source: HomepageSectionSource;
  priority: number;
  properties: HomepageProperty[];
  items?: HomepageProperty[];
  seeAllHref: string;
  previewImages: string[];
  totalCount: number;
};

export type TrendingLocation = {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  count: number;
};

export type UserLocationContext = {
  city: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type HomepageData = {
  mode: "DEFAULT" | "SEARCH";
  searchContext?: SearchContext | null;
  currentLocation?: UserLocationContext | null;
  location: { city: string | null };
  sections: HomepageSection[];
  trendingLocations: TrendingLocation[];
};

export type DiscoveryListing = {
  id: string;
  customSlug: string | null;
  title: string;
  city: string | null;
  district: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: string[];
  price: number;
  weekdayBasePrice: number | null;
  guests: number;
  propertyType: string | null;
  isFeatured: boolean;
  blockedDates: string[];
  minNights: number;
  maxNights: number;
  advanceNotice: string;
  sameDayCutoff: string | null;
  allowSameDayRequests: boolean;
  createdAt: Date;
  host?: {
    id: string;
    name: string | null;
    createdAt: Date;
    publicProfile: Record<string, unknown> | null;
    bookings?: Array<{ status: BookingStatus }>;
  } | null;
  bookings: Array<{ startDate: Date; endDate: Date; status: BookingStatus }>;
};

function startOfDay(value = new Date()): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDateShort(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

function toProperty(
  listing: DiscoveryListing,
  extra?: {
    alternativeDates?: string | null;
    distanceKm?: number;
    badge?: "guest_favorite" | "superhost" | "featured" | null;
  },
): HomepageProperty {
  const currency = getCurrencyForCountry(listing.country);
  const hostProfile = (listing.host?.publicProfile || {}) as Record<string, unknown>;
  const genuineRating =
    typeof hostProfile.rating === "number" && hostProfile.rating > 0 ? hostProfile.rating : null;
  const genuineReviews =
    typeof hostProfile.reviewCount === "number"
      ? hostProfile.reviewCount
      : typeof hostProfile.reviewsCount === "number"
      ? hostProfile.reviewsCount
      : null;

  const isGuestFav = qualificationService.isGuestFavorite({
    isFeatured: listing.isFeatured,
    rating: genuineRating,
    reviewCount: genuineReviews,
    bookings: listing.bookings,
    status: ListingStatus.ACTIVE,
    published: true,
  });

  const isSuperh = qualificationService.isSuperhost(listing.host);

  const calculatedBadge: "guest_favorite" | "superhost" | "featured" | null =
    extra?.badge ?? (isGuestFav ? "guest_favorite" : isSuperh ? "superhost" : listing.isFeatured ? "featured" : null);

  const priceVal = listing.weekdayBasePrice ?? listing.price;
  const mainPhoto = listing.photos[0] ?? "/images/home/hero-banner.png";

  return {
    id: listing.id,
    slug: listing.customSlug,
    name: listing.title,
    title: listing.title,
    city: listing.city,
    area: listing.district,
    country: listing.country,
    image: mainPhoto,
    imageUrl: mainPhoto,
    mainImage: mainPhoto,
    price: priceVal,
    pricePerNight: priceVal,
    currency,
    maxGuests: listing.guests,
    propertyType: listing.propertyType,
    featured: listing.isFeatured,
    favoriteStatus: false,
    isFavorite: false,
    isGuestFavorite: isGuestFav,
    isSuperhost: isSuperh,
    averageRating: genuineRating,
    rating: genuineRating,
    reviewCount: genuineReviews,
    badge: calculatedBadge,
    alternativeDates: extra?.alternativeDates ?? null,
    distanceKm: extra?.distanceKm,
  };
}

export function normalizeCityName(value?: string | null): string | null {
  const cleaned = (value || "").trim();
  if (!cleaned) return null;
  const blocked = new Set(["Nearby", "Recent searches", "Suggested destinations", "Current location"]);
  return blocked.has(cleaned) ? null : cleaned;
}

export type HomepageRequestContext = {
  city?: string | null;
  destination?: string | null;
  placeName?: string | null;
  lat?: number | null;
  lng?: number | null;
  ip?: string | null;
  country?: string | null;
};

export async function resolvePopularHomesCity(
  config: HomepagePopularHomesConfig | null | undefined,
  requestContext: HomepageRequestContext = {},
  locationResolver: (lat: number, lng: number) => Promise<string | null> = async (lat, lng) => {
    const resolved = await reverseGeocodeLocation(lat, lng);
    return normalizeCityName(resolved?.city || null);
  },
): Promise<{ city: string | null; title: string; enabled: boolean }> {
  if (!config?.enabled) {
    return { city: null, title: "Popular homes", enabled: false };
  }

  const explicitCity = normalizeCityName(requestContext.city || requestContext.destination || requestContext.placeName);
  const staticCity = normalizeCityName(config.city);
  const coordsCity =
    typeof requestContext.lat === "number" && typeof requestContext.lng === "number" &&
    Number.isFinite(requestContext.lat) && Number.isFinite(requestContext.lng)
      ? await locationResolver(requestContext.lat, requestContext.lng)
      : null;

  switch (config.mode) {
    case "USER_LOCATION":
      return {
        city: explicitCity || coordsCity || staticCity || null,
        title: (config.title || (explicitCity || coordsCity || staticCity ? `Popular homes in ${explicitCity || coordsCity || staticCity}` : "Popular homes")).trim(),
        enabled: true,
      };
    case "USER_IP": {
      const ipAwareCity = explicitCity || coordsCity || staticCity || null;
      return {
        city: ipAwareCity,
        title: (config.title || (ipAwareCity ? `Popular homes in ${ipAwareCity}` : "Popular homes")).trim(),
        enabled: true,
      };
    }
    case "STATIC":
    default:
      return {
        city: staticCity || explicitCity || coordsCity || null,
        title: (config.title || (staticCity || explicitCity || coordsCity ? `Popular homes in ${staticCity || explicitCity || coordsCity}` : "Popular homes")).trim(),
        enabled: true,
      };
  }
}

/**
 * Checks genuine availability of a listing for an exact date range.
 * Respects: bookings, blocked dates, min/max nights, advance notice, same-day cutoffs, guest capacity.
 */
function isListingAvailable(
  listing: DiscoveryListing,
  cIn: Date,
  cOut: Date,
  requiredGuests: number = 1,
): boolean {
  if (listing.guests < requiredGuests) return false;

  const nights = Math.round((cOut.getTime() - cIn.getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) return false;

  const minNights = Math.max(1, listing.minNights || 1);
  const maxNights = Math.max(minNights, listing.maxNights || 365);
  if (nights < minNights || nights > maxNights) return false;

  const now = new Date();
  const today = startOfDay(now);
  const advanceDays = parseRequiredAdvanceDays(listing.advanceNotice);
  const earliestCheckIn = addDays(today, advanceDays);
  if (cIn < earliestCheckIn) return false;

  if (cIn.getTime() === today.getTime()) {
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (!listing.allowSameDayRequests || currentHour >= parseCutoffHour(listing.sameDayCutoff)) {
      return false;
    }
  }

  // Blocked dates check
  const blocked = new Set(listing.blockedDates);
  for (let d = new Date(cIn); d < cOut; d = addDays(d, 1)) {
    if (blocked.has(dateKey(d))) return false;
  }

  // Overlapping confirmed or pending bookings
  const hasConflict = listing.bookings.some(
    (b) => b.startDate < cOut && b.endDate > cIn,
  );
  return !hasConflict;
}

/**
 * Flexible / Similar date search:
 * Checks if a listing is available for dates slightly shifted (±1 or ±2 days).
 */
function findSimilarDateRange(
  listing: DiscoveryListing,
  origIn: Date,
  origOut: Date,
  guests: number,
): { checkIn: Date; checkOut: Date; label: string } | null {
  const nights = Math.round((origOut.getTime() - origIn.getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) return null;

  const offsets = [1, -1, 2, -2];
  for (const offset of offsets) {
    const testIn = addDays(origIn, offset);
    const testOut = addDays(testIn, nights);
    if (testIn >= startOfDay() && isListingAvailable(listing, testIn, testOut, guests)) {
      return {
        checkIn: testIn,
        checkOut: testOut,
        label: `${formatDateShort(testIn)} – ${formatDateShort(testOut)}`,
      };
    }
  }
  return null;
}

/**
 * Multi-signal trending score calculation
 */
function calculateTrendingScore(listing: DiscoveryListing, searchFrequency: number = 0): number {
  const searchWeight = 3.0;
  const bookingWeight = 4.0;
  const favoriteWeight = 2.5;
  const ratingWeight = 5.0;

  const bookingsCount = listing.bookings.length;
  const favoritesCount = listing.isFeatured ? 5 : 1;
  const ratingScore = listing.isFeatured ? 5.0 : 4.5;

  return (
    searchFrequency * searchWeight +
    bookingsCount * bookingWeight +
    favoritesCount * favoriteWeight +
    ratingScore * ratingWeight
  );
}

/**
 * Reusable helper to build a section and deduplicate cards across sections.
 */
function createSectionBuilder(seenListingIds: Set<string>, sections: HomepageSection[]) {
  return function addSection(params: {
    id: string;
    title: string;
    subtitle?: string;
    type: HomepageSectionType;
    source: HomepageSectionSource;
    priority: number;
    candidates: Array<{ listing: DiscoveryListing; extra?: { alternativeDates?: string | null; distanceKm?: number; badge?: "guest_favorite" | "superhost" | "featured" | null } }>;
    seeAllHref: string;
    minItems?: number;
  }) {
    const { id, title, subtitle, type, source, priority, candidates, seeAllHref, minItems = MIN_PROPERTY_CAROUSEL } = params;

    // Prioritize unseen listings
    const unseen = candidates.filter((c) => !seenListingIds.has(c.listing.id));
    const chosen = unseen.length >= minItems ? unseen : candidates;

    if (chosen.length < minItems) return; // Do not show sparse/empty rows

    const sliced = chosen.slice(0, SECTION_LIMIT);
    const properties = sliced.map((c) => toProperty(c.listing, c.extra));
    const previewImages = sliced
      .flatMap((c) => c.listing.photos || [])
      .filter(Boolean)
      .slice(0, 3);

    // Track chosen properties for deduplication
    for (const p of properties) {
      seenListingIds.add(p.id);
    }

    sections.push({
      id,
      title,
      subtitle,
      type,
      source,
      priority,
      properties,
      items: properties,
      seeAllHref,
      previewImages,
      totalCount: chosen.length,
    });
  };
}

async function loadTrendingLocations(): Promise<TrendingLocation[]> {
  const searchAnalyticsKey = CACHE_KEYS.SEARCH_ANALYTICS();
  const recentSearches: Array<{
    destination?: string | null;
    city?: string | null;
    country?: string | null;
    placeName?: string | null;
  }> = ((await getOrSetCache(searchAnalyticsKey, async () => [], { ttl: CACHE_TTL.HOMEPAGE_DISCOVERY })) as Array<{
    destination?: string | null;
    city?: string | null;
    country?: string | null;
    placeName?: string | null;
  }> | null) ?? [];

  const cityCounts = new Map<string, { city: string; country: string; count: number }>();
  for (const item of recentSearches) {
    const city = (item.city || item.destination || item.placeName || "").trim();
    if (!city) continue;
    const country = item.country?.trim() || "";
    const entry = cityCounts.get(city.toLowerCase()) ?? { city, country, count: 0 };
    entry.count += 1;
    cityCounts.set(city.toLowerCase(), entry);
  }

  if (cityCounts.size === 0) {
    const fallbackCities = await prisma.listing.findMany({
      where: {
        published: true,
        status: ListingStatus.ACTIVE,
        isPaused: false,
        deletedAt: null,
        photos: { isEmpty: false },
      },
      select: { city: true, country: true, photos: true },
      distinct: ["city"],
      take: 6,
      orderBy: { city: "asc" },
    });

    return fallbackCities
      .filter((entry: { city: string | null; country: string | null; photos: string[] }) => Boolean(entry.city))
      .map((entry: { city: string | null; country: string | null; photos: string[] }) => ({
        id: `trend-${entry.city}`,
        name: entry.city as string,
        subtitle: entry.country || "Popular destination",
        imageUrl: entry.photos[0] ?? "/images/home/hero-banner.png",
        href: `/listings?city=${encodeURIComponent(entry.city as string)}&destination=${encodeURIComponent(entry.city as string)}`,
        count: 1,
      }));
  }

  const rankedCities = [...cityCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const cityDetails: Array<{ id: string; city: string | null; country: string | null; photos: string[]; title: string }> = await prisma.listing.findMany({
    where: {
      published: true,
      status: ListingStatus.ACTIVE,
      isPaused: false,
      deletedAt: null,
      photos: { isEmpty: false },
      OR: rankedCities.map((entry) => ({ city: { equals: entry.city, mode: "insensitive" } })),
    },
    select: { id: true, city: true, country: true, photos: true, title: true },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
  });

  return rankedCities.map((entry) => {
    const item = cityDetails.find((listing: { city: string | null; country: string | null; photos: string[]; title: string }) => listing.city?.toLowerCase() === entry.city.toLowerCase());
    const city = entry.city;
    return {
      id: `trend-${city}`,
      name: city,
      subtitle: entry.country || item?.country || "Popular destination",
      imageUrl: item?.photos[0] ?? "/images/home/hero-banner.png",
      href: `/listings?city=${encodeURIComponent(city)}&destination=${encodeURIComponent(city)}`,
      count: entry.count,
    };
  });
}

/**
 * Builds the complete dynamic discovery rows.
 * Seamlessly handles DEFAULT mode and SEARCH-AWARE mode with exact priority ordering.
 */
async function assembleHomepageData(params: {
  searchContext?: SearchContext | null;
  requestContext?: HomepageRequestContext;
  userId?: string;
}): Promise<HomepageData> {
  const { searchContext, requestContext } = params;
  const isSearchAware = Boolean(
    searchContext &&
    (searchContext.query || searchContext.city || (searchContext.latitude != null && searchContext.longitude != null)),
  );

  // Fetch candidate published listings from database
  const allListings = (await prisma.listing.findMany({
    where: {
      published: true,
      status: ListingStatus.ACTIVE,
      isPaused: false,
      deletedAt: null,
      photos: { isEmpty: false },
    },
    select: {
      id: true,
      customSlug: true,
      title: true,
      city: true,
      district: true,
      country: true,
      latitude: true,
      longitude: true,
      photos: true,
      price: true,
      weekdayBasePrice: true,
      guests: true,
      propertyType: true,
      isFeatured: true,
      blockedDates: true,
      minNights: true,
      maxNights: true,
      advanceNotice: true,
      sameDayCutoff: true,
      allowSameDayRequests: true,
      createdAt: true,
      host: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          publicProfile: true,
          bookings: {
            select: { status: true },
          },
        },
      },
      bookings: {
        select: { startDate: true, endDate: true, status: true },
      },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: CANDIDATE_LIMIT,
  })) as DiscoveryListing[];

  // Detect user current location (distinct from searched location)
  const userLocation: UserLocationContext = {
    city: normalizeCityName(requestContext?.city),
    country: requestContext?.country || null,
    latitude: requestContext?.lat ?? null,
    longitude: requestContext?.lng ?? null,
  };

  const sections: HomepageSection[] = [];
  const seenListingIds = new Set<string>();
  const addSection = createSectionBuilder(seenListingIds, sections);

  if (isSearchAware && searchContext) {
    // =========================================================================
    // SEARCH-AWARE HOMEPAGE ENGINE
    // =========================================================================
    const searchedCity = searchContext.city?.trim() || "";
    const searchedCountry = searchContext.country?.trim() || "";
    const searchedLat = searchContext.latitude;
    const searchedLng = searchContext.longitude;
    const isLandmark = searchContext.placeType === "landmark";
    const displayName = searchContext.displayName || searchedCity || searchContext.query;
    const searchNeighborhood = (searchContext.neighborhood || searchContext.district || "").trim().toLowerCase();

    const parsedIn = searchContext.checkIn ? new Date(searchContext.checkIn) : null;
    const parsedOut = searchContext.checkOut ? new Date(searchContext.checkOut) : null;
    const hasDates = Boolean(parsedIn && parsedOut && !isNaN(parsedIn.getTime()) && !isNaN(parsedOut.getTime()) && parsedOut > parsedIn);
    const guestCount = searchContext.guests || 1;

    // Strict maximum proximity radius:
    // Landmark or neighborhood: max 20km
    // City or general: max 35km (or searchContext.radiusKm if provided and realistic)
    const maxRadiusKm =
      searchContext.radiusKm && searchContext.radiusKm > 0 && searchContext.radiusKm <= 50
        ? searchContext.radiusKm
        : isLandmark || searchNeighborhood
        ? 20
        : 35;

    // Filter destination candidates strictly matching the searched location
    const destinationCandidates: Array<{ listing: DiscoveryListing; distanceKm?: number }> = [];

    for (const l of allListings) {
      // Discard listings from a different country if country is known
      if (searchedCountry && l.country && l.country.toLowerCase() !== searchedCountry.toLowerCase()) {
        continue;
      }

      let isMatch = false;
      let dist: number | undefined = undefined;

      // 1. Geographic distance check (must be within maxRadiusKm)
      if (searchedLat != null && searchedLng != null && l.latitude != null && l.longitude != null) {
        dist = calculateDistance(searchedLat, searchedLng, l.latitude, l.longitude);
        if (dist <= maxRadiusKm) {
          isMatch = true;
        }
      }

      // 2. City match
      if (!isMatch && searchedCity && l.city) {
        const normCity = l.city.trim().toLowerCase();
        const normSearchCity = searchedCity.trim().toLowerCase();
        if (
          normCity === normSearchCity ||
          (normCity.length >= 4 && normSearchCity.includes(normCity)) ||
          (normSearchCity.length >= 4 && normCity.includes(normSearchCity))
        ) {
          if (dist == null || dist <= 80) {
            isMatch = true;
            dist = dist ?? 10;
          }
        }
      }

      // 3. District / Neighborhood match
      if (!isMatch && searchNeighborhood && l.district) {
        const normDist = l.district.trim().toLowerCase();
        if (
          normDist === searchNeighborhood ||
          (normDist.length >= 4 && searchNeighborhood.includes(normDist)) ||
          (searchNeighborhood.length >= 4 && normDist.includes(searchNeighborhood))
        ) {
          if (dist == null || dist <= 50) {
            isMatch = true;
            dist = dist ?? 10;
          }
        }
      }

      // 4. Query text match if city was not explicitly extracted
      if (!isMatch && !searchedCity && searchContext.query) {
        const q = searchContext.query.trim().toLowerCase();
        const normCity = (l.city || "").toLowerCase();
        const normDist = (l.district || "").toLowerCase();
        const matchesQuery =
          (normCity && (normCity === q || (normCity.length >= 4 && (normCity.includes(q) || q.includes(normCity))))) ||
          (normDist && (normDist === q || (normDist.length >= 4 && (normDist.includes(q) || q.includes(normDist)))));
        if (matchesQuery && (dist == null || dist <= 80)) {
          isMatch = true;
          dist = dist ?? 15;
        }
      }

      if (isMatch) {
        destinationCandidates.push({ listing: l, distanceKm: dist });
      }
    }

    destinationCandidates.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

    const searchHrefBase = `/listings?destination=${encodeURIComponent(displayName)}${searchedCity ? `&city=${encodeURIComponent(searchedCity)}` : ""}${hasDates ? `&checkIn=${dateKey(parsedIn!)}&checkOut=${dateKey(parsedOut!)}` : ""}&guests=${guestCount}`;

    // 1. Priority 20: Based on your {location} search (or "Homes near {landmark}")
    const basedOnSearchTitle = isLandmark ? `Homes near ${displayName}` : `Based on your ${displayName} search`;
    addSection({
      id: `based-on-search-${displayName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      title: basedOnSearchTitle,
      type: "LOCATION",
      source: "SEARCH",
      priority: 20,
      candidates: destinationCandidates.map((c) => ({
        listing: c.listing,
        extra: { distanceKm: c.distanceKm },
      })),
      seeAllHref: searchHrefBase,
    });

    // 2. Priority 30: Available for your selected dates (Exact match)
    if (hasDates) {
      const exactAvailable = destinationCandidates.filter((c) =>
        isListingAvailable(c.listing, parsedIn!, parsedOut!, guestCount),
      );
      addSection({
        id: "available-selected-dates",
        title: `Available for your dates in ${displayName}`,
        type: "LOCATION",
        source: "DATE",
        priority: 30,
        candidates: exactAvailable.map((c) => ({ listing: c.listing })),
        seeAllHref: `${searchHrefBase}&sortBy=recommended`,
      });

      // 3. Priority 40: Available for similar dates (Flexible ±1–2 days)
      const similarDateCandidates: Array<{ listing: DiscoveryListing; extra: { alternativeDates: string } }> = [];
      for (const c of destinationCandidates) {
        // Only test listings that were either not bookable on exact dates or additional inventory
        const isExact = isListingAvailable(c.listing, parsedIn!, parsedOut!, guestCount);
        if (!isExact) {
          const sim = findSimilarDateRange(c.listing, parsedIn!, parsedOut!, guestCount);
          if (sim) {
            similarDateCandidates.push({
              listing: c.listing,
              extra: { alternativeDates: sim.label },
            });
          }
        }
      }

      addSection({
        id: "available-similar-dates",
        title: "Available for similar dates",
        subtitle: "Flexible date options near your selected stay",
        type: "LOCATION",
        source: "SIMILAR_DATE",
        priority: 40,
        candidates: similarDateCandidates,
        seeAllHref: `/listings?destination=${encodeURIComponent(displayName)}&flexibleDates=true&guests=${guestCount}`,
      });
    }

    // 4. Priority 50: Guest favourites in {location}
    const guestFavourites = destinationCandidates.filter((c) =>
      qualificationService.isGuestFavorite({
        isFeatured: c.listing.isFeatured,
        rating: (c.listing.host?.publicProfile as any)?.rating,
        reviewCount: (c.listing.host?.publicProfile as any)?.reviewCount,
        bookings: c.listing.bookings,
        status: ListingStatus.ACTIVE,
        published: true,
      }),
    );
    addSection({
      id: "guest-favourites-search",
      title: `Guest favourites in ${displayName}`,
      type: "PROPERTY",
      source: "SEARCH",
      priority: 50,
      candidates: guestFavourites.map((c) => ({
        listing: c.listing,
        extra: { badge: "guest_favorite" as const },
      })),
      seeAllHref: `${searchHrefBase}&featured=true`,
    });

    // 5. Priority 60: Popular stays in {location}
    addSection({
      id: "popular-stays-search",
      title: `Popular stays in ${displayName}`,
      type: "LOCATION",
      source: "SEARCH",
      priority: 60,
      candidates: destinationCandidates.map((c) => ({ listing: c.listing })),
      seeAllHref: `${searchHrefBase}&sortBy=top_rated`,
    });

    // 6. Priority 70: Popular child areas/neighborhoods inside {location} (min 5 properties)
    const neighborhoodGroups = new Map<string, DiscoveryListing[]>();
    for (const c of destinationCandidates) {
      const dist = c.listing.district?.trim();
      if (dist) {
        const group = neighborhoodGroups.get(dist.toLowerCase()) || [];
        group.push(c.listing);
        neighborhoodGroups.set(dist.toLowerCase(), group);
      }
    }

    for (const [distKey, group] of neighborhoodGroups.entries()) {
      if (group.length >= 5) {
        const districtName = group[0].district || distKey;
        addSection({
          id: `area-${distKey}`,
          title: `Stay in ${districtName}`,
          type: "LOCATION",
          source: "AREA",
          priority: 70,
          candidates: group.map((listing) => ({ listing })),
          seeAllHref: `/listings?city=${encodeURIComponent(searchedCity || displayName)}&district=${encodeURIComponent(districtName)}`,
        });
      }
    }

    // 7. Priority 80: Nearby destinations from {search location}
    if (searchedLat != null && searchedLng != null) {
      const nearbyListings = allListings
        .filter((l) => {
          if (!l.city || l.city.toLowerCase() === searchedCity.toLowerCase()) return false;
          if (l.latitude == null || l.longitude == null) return false;
          if (searchedCountry && l.country && l.country.toLowerCase() !== searchedCountry.toLowerCase()) {
            return false;
          }
          const d = calculateDistance(searchedLat, searchedLng, l.latitude, l.longitude);
          return d >= 20 && d <= 250;
        })
        .map((l) => ({
          listing: l,
          distanceKm: calculateDistance(searchedLat, searchedLng, l.latitude!, l.longitude!),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);

      addSection({
        id: "nearby-destinations-search",
        title: `Nearby destinations from ${displayName}`,
        type: "DESTINATION",
        source: "NEARBY",
        priority: 80,
        candidates: nearbyListings.map((c) => ({
          listing: c.listing,
          extra: { distanceKm: c.distanceKm },
        })),
        seeAllHref: `/listings?lat=${searchedLat}&lng=${searchedLng}&radius=150`,
      });
    }

    // 8. Priority 100: Popular stays near your current location (separate from search destination)
    if (userLocation.city && userLocation.city.toLowerCase() !== searchedCity.toLowerCase()) {
      const userLocListings = allListings.filter(
        (l) => l.city?.toLowerCase() === userLocation.city!.toLowerCase(),
      );
      addSection({
        id: "popular-near-user-location",
        title: `Popular stays near ${userLocation.city}`,
        subtitle: "Based on your current location",
        type: "LOCATION",
        source: "CURRENT_LOCATION",
        priority: 100,
        candidates: userLocListings.map((listing) => ({ listing })),
        seeAllHref: `/listings?city=${encodeURIComponent(userLocation.city)}`,
      });
    }

    // 9. Priority 110: Trending in your current country (separate from search destination)
    if (userLocation.country && userLocation.country.toLowerCase() !== searchContext.country?.toLowerCase()) {
      const countryListings = allListings.filter(
        (l) => l.country?.toLowerCase() === userLocation.country!.toLowerCase(),
      );
      addSection({
        id: "trending-user-country",
        title: `Trending in ${userLocation.country}`,
        type: "PROPERTY",
        source: "TRENDING",
        priority: 110,
        candidates: countryListings.map((listing) => ({ listing })),
        seeAllHref: `/listings?country=${encodeURIComponent(userLocation.country)}`,
      });
    }

    // 10. Priority 120: Global trending discovery
    const trendingRanked = allListings.slice().sort(
      (a, b) => calculateTrendingScore(b) - calculateTrendingScore(a),
    );
    addSection({
      id: "global-trending-stays",
      title: "Trending stays",
      type: "PROPERTY",
      source: "TRENDING",
      priority: 120,
      candidates: trendingRanked.map((listing) => ({ listing })),
      seeAllHref: "/listings?sortBy=top_rated",
    });

    // 11. Priority 150: Recommended for you
    addSection({
      id: "recommended-stays-search",
      title: "Recommended stays",
      type: "PROPERTY",
      source: "RECOMMENDATION",
      priority: 150,
      candidates: allListings.map((listing) => ({ listing })),
      seeAllHref: "/listings?sortBy=recommended",
    });

  } else {
    // =========================================================================
    // DEFAULT HOMEPAGE ENGINE (User has not searched anything yet)
    // =========================================================================
    const popularHomesConfig = await getHomepagePopularHomesConfig();
    const popularHomesResolution = await resolvePopularHomesCity(popularHomesConfig, {
      ...requestContext,
    });

    // 1. Priority 50: Guest favourites
    const guestFavourites = allListings.filter((l) =>
      qualificationService.isGuestFavorite({
        isFeatured: l.isFeatured,
        rating: (l.host?.publicProfile as any)?.rating,
        reviewCount: (l.host?.publicProfile as any)?.reviewCount,
        bookings: l.bookings,
        status: ListingStatus.ACTIVE,
        published: true,
      }),
    );
    if (guestFavourites.length >= MIN_PROPERTY_CAROUSEL) {
      addSection({
        id: "guest-favourites",
        title: "Guest favourites",
        type: "FEATURED",
        source: "RECOMMENDATION",
        priority: 50,
        candidates: guestFavourites.map((listing) => ({
          listing,
          extra: { badge: "guest_favorite" as const },
        })),
        seeAllHref: "/listings?featured=true",
      });
    }

    // 2. Priority 100: Popular stays near you (if current location detected)
    if (userLocation.city) {
      const nearUserListings = allListings.filter(
        (l) => l.city?.toLowerCase() === userLocation.city!.toLowerCase(),
      );
      addSection({
        id: "popular-stays-near-you",
        title: `Popular stays near ${userLocation.city}`,
        subtitle: "Based on your current location",
        type: "LOCATION",
        source: "CURRENT_LOCATION",
        priority: 100,
        candidates: nearUserListings.map((listing) => ({ listing })),
        seeAllHref: `/listings?city=${encodeURIComponent(userLocation.city)}`,
      });
    }

    // 3. Priority 110: Trending in your country (if country known)
    if (userLocation.country) {
      const inCountryListings = allListings.filter(
        (l) => l.country?.toLowerCase() === userLocation.country!.toLowerCase(),
      );
      addSection({
        id: "trending-in-country",
        title: `Trending in ${userLocation.country}`,
        type: "PROPERTY",
        source: "TRENDING",
        priority: 110,
        candidates: inCountryListings.map((listing) => ({ listing })),
        seeAllHref: `/listings?country=${encodeURIComponent(userLocation.country)}`,
      });
    }

    // 4. Priority 120: Trending stays (scored centrally)
    const trendingListings = allListings.slice().sort(
      (a, b) => calculateTrendingScore(b) - calculateTrendingScore(a),
    );
    addSection({
      id: "trending-stays",
      title: "Trending properties",
      type: "PROPERTY",
      source: "TRENDING",
      priority: 120,
      candidates: trendingListings.map((listing) => ({ listing })),
      seeAllHref: "/listings?sortBy=top_rated",
    });

    // 5. Priority 80: Popular homes in nearby / prominent cities
    if (popularHomesResolution.enabled && popularHomesResolution.city) {
      const popularCityListings = allListings.filter(
        (l) => l.city?.toLowerCase() === popularHomesResolution.city!.toLowerCase(),
      );
      if (popularCityListings.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "popular-homes",
          title: popularHomesResolution.title || `Popular homes in ${popularHomesResolution.city}`,
          type: "FEATURED",
          source: "NEARBY",
          priority: 80,
          candidates: popularCityListings.map((listing) => ({
            listing,
          })),
          seeAllHref: `/listings?city=${encodeURIComponent(popularHomesResolution.city)}`,
        });
      }
    }

    // 6. Priority 150: Recommended for you
    addSection({
      id: "recommended-for-you",
      title: "Recommended stays",
      type: "PROPERTY",
      source: "RECOMMENDATION",
      priority: 150,
      candidates: allListings.map((listing) => ({ listing })),
      seeAllHref: "/listings?sortBy=recommended",
    });
  }

  // Sort all sections strictly by priority
  sections.sort((a, b) => a.priority - b.priority);

  const trendingLocations = await loadTrendingLocations();
  const fallbackCity = searchContext?.city || userLocation.city || allListings.find((l) => l.city)?.city || null;

  return {
    mode: isSearchAware ? "SEARCH" : "DEFAULT",
    searchContext: searchContext || null,
    currentLocation: userLocation,
    location: { city: fallbackCity },
    sections,
    trendingLocations,
  };
}

async function getHomepageData(input: {
  city?: string;
  userId?: string;
  searchContext?: SearchContext | null;
  requestContext?: HomepageRequestContext;
} = {}): Promise<HomepageData> {
  const version = await getCounter(CACHE_KEYS.LISTINGS_PUBLIC_VER());
  const cacheKeyCity = input.searchContext?.city?.toLowerCase() || input.city?.trim().toLowerCase() || "all";
  const cacheMode = input.searchContext ? "search" : "default";
  const cacheQuery = input.searchContext?.query?.toLowerCase().replace(/[^a-z0-9]/g, "_") || "";
  const cacheKey = `${CACHE_KEYS.HOMEPAGE_DISCOVERY(version, cacheKeyCity)}:${cacheMode}:${cacheQuery}`;

  // Cache public discovery response
  const publicData = await getOrSetCache(
    cacheKey,
    () => assembleHomepageData({
      searchContext: input.searchContext,
      requestContext: input.requestContext,
      userId: input.userId,
    }),
    { ttl: CACHE_TTL.HOMEPAGE_DISCOVERY },
  );

  if (!input.userId) return publicData;

  try {
    const listingIds = publicData.sections.flatMap((s) => s.properties.map((p) => p.id));
    const favoriteIds = await favoriteService.getFavoriteListingIds(input.userId, listingIds);

    return {
      ...publicData,
      sections: publicData.sections.map((section) => ({
        ...section,
        properties: section.properties.map((property) => ({
          ...property,
          favoriteStatus: favoriteIds.has(property.id),
          isFavorite: favoriteIds.has(property.id),
        })),
        items: section.properties.map((property) => ({
          ...property,
          favoriteStatus: favoriteIds.has(property.id),
          isFavorite: favoriteIds.has(property.id),
        })),
      })),
    };
  } catch {
    return publicData;
  }
}

export const homepageService = {
  getHomepageData,
  resolvePopularHomesCity,
};
