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
  bedrooms?: number | null;
  bathrooms?: number | null;
  propertyType: string | null;
  placeCategory?: string | null;
  amenities?: string[];
  description?: string | null;
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
 * Multi-signal popularity score calculation (bookings, guest review count, ratings, and featured status).
 */
function calculatePopularityScore(listing: DiscoveryListing): number {
  const bookingsCount = listing.bookings?.length || 0;
  const hostProfile = (listing.host?.publicProfile || {}) as Record<string, unknown>;
  const rating = typeof hostProfile.rating === "number" && hostProfile.rating > 0 ? hostProfile.rating : 4.5;
  const reviewCount =
    typeof hostProfile.reviewCount === "number"
      ? hostProfile.reviewCount
      : typeof hostProfile.reviewsCount === "number"
      ? hostProfile.reviewsCount
      : 0;
  const isFav = listing.isFeatured ? 5 : 1;
  return bookingsCount * 4 + rating * 3 + Math.min(reviewCount, 25) * 0.5 + isFav * 2;
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

/**
 * Cached candidate listing fetcher (L1 memory + Redis).
 * Reused by both assembleHomepageData and getRecentSearchSections,
 * preventing duplicate database scans on the same page load.
 */
export async function getDiscoveryCandidateListings(): Promise<DiscoveryListing[]> {
  const version = await getCounter(CACHE_KEYS.LISTINGS_PUBLIC_VER());
  const cacheKey = `homyz:discovery:candidates:${version}`;
  return getOrSetCache(
    cacheKey,
    async () => {
      return (await prisma.listing.findMany({
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
          bedrooms: true,
          bathrooms: true,
          propertyType: true,
          placeCategory: true,
          amenities: true,
          description: true,
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
    },
    { ttl: CACHE_TTL.HOMEPAGE_DISCOVERY },
  );
}

async function loadTrendingLocations(): Promise<TrendingLocation[]> {
  const version = await getCounter(CACHE_KEYS.LISTINGS_PUBLIC_VER());
  const cacheKey = `homyz:discovery:trending_locations:${version}`;
  return getOrSetCache(
    cacheKey,
    async () => {
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
    },
    { ttl: CACHE_TTL.HOMEPAGE_DISCOVERY },
  );
}

/**
 * Priority Hierarchy Reference for Discovery & Search-Aware Engine:
 * - priority: 20 -> Based on search ("Based on your {location} search" or "Homes near {landmark}")
 * - priority: 30 -> Available for selected dates (exact match)
 * - priority: 40 -> Available for similar dates
 * - priority: 50 -> Guest favourites in searched location
 * - priority: 60 -> Popular stays in searched location
 * - priority: 70 -> Child areas/neighborhoods (group.length >= 5)
 * - priority: 80 -> Nearby destinations (d >= 20 && d <= 250)
 * - priority: 100 -> Current location stays
 * - priority: 110 -> Current country trending
 * - priority: 120 -> Global trending discovery
 * - priority: 150 -> Recommended for you
 *
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

  // Fetch candidate published listings (cached across requests)
  const allListings = await getDiscoveryCandidateListings();

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

    // 2. Section 2 & 3 for the searched destination (capped strictly to 2–3 sections total for this location)
    let locationSectionCount = 1; // Section 1 (Based on your search) is already added

    // If user searched with checkIn and checkOut dates, prioritize date availability as Section 2
    if (hasDates) {
      const exactAvailable = destinationCandidates.filter((c) =>
        isListingAvailable(c.listing, parsedIn!, parsedOut!, guestCount),
      );
      if (exactAvailable.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "available-selected-dates",
          title: `Available for your dates in ${displayName}`,
          type: "LOCATION",
          source: "DATE",
          priority: 30,
          candidates: exactAvailable.map((c) => ({ listing: c.listing })),
          seeAllHref: `${searchHrefBase}&sortBy=recommended`,
        });
        locationSectionCount++;
      }
    }

    // Guest favourites in {location}
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
    if (locationSectionCount < 3 && guestFavourites.length >= MIN_PROPERTY_CAROUSEL) {
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
      locationSectionCount++;
    }

    // Popular stays in {location} (to reach 2–3 sections for this destination)
    if (locationSectionCount < 3 && destinationCandidates.length >= MIN_PROPERTY_CAROUSEL) {
      addSection({
        id: "popular-stays-search",
        title: `Popular stays in ${displayName}`,
        type: "LOCATION",
        source: "SEARCH",
        priority: 60,
        candidates: destinationCandidates.map((c) => ({ listing: c.listing })),
        seeAllHref: `${searchHrefBase}&sortBy=top_rated`,
      });
      locationSectionCount++;
    }

    // Curated discovery sections shared across DEFAULT and SEARCH mode ("Others" block)
    const addCuratedDiscoverySections = (priorityBase: number = 0) => {
      // 1. Popular homes / Most popular stays (Centralized Popularity Score)
      const hasCityPopularHomes = sections.some((s) => s.id === "popular-homes");
      const popularRankedListings = allListings.slice().sort(
        (a, b) => calculatePopularityScore(b) - calculatePopularityScore(a),
      );
      addSection({
        id: hasCityPopularHomes ? "most-popular-stays" : "popular-homes-global",
        title: hasCityPopularHomes ? "Most popular stays" : "Popular homes",
        type: "FEATURED",
        source: "RECOMMENDATION",
        priority: priorityBase > 0 ? 122 : 85,
        candidates: popularRankedListings.map((listing) => ({ listing })),
        seeAllHref: "/listings?sortBy=most_reviewed",
      });

      // 2. Luxury villas & private estates
      const villaCandidates = allListings
        .filter((l) => {
          const pt = (l.propertyType || "").toUpperCase();
          const titleLower = l.title.toLowerCase();
          const hasPool = Boolean(l.amenities && (l.amenities.includes("private_pool") || l.amenities.includes("pool")));
          return (
            pt === "VILLA" ||
            pt === "ESTATE" ||
            titleLower.includes("villa") ||
            titleLower.includes("estate") ||
            hasPool ||
            (l.price >= 25000 && l.guests >= 4)
          );
        })
        .sort((a, b) => b.price - a.price);

      if (villaCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "luxury-villas",
          title: "Luxury villas & private estates",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 125,
          candidates: villaCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?propertyType=VILLA",
        });
      }

      // 3. Top-rated 5-star stays
      const topRatedCandidates = allListings
        .slice()
        .filter((l) => {
          const hostProfile = (l.host?.publicProfile || {}) as Record<string, unknown>;
          const r = typeof hostProfile.rating === "number" ? hostProfile.rating : null;
          return r != null && r >= 4.7;
        })
        .sort((a, b) => {
          const rA = ((a.host?.publicProfile || {}) as any).rating || 0;
          const rB = ((b.host?.publicProfile || {}) as any).rating || 0;
          return rB - rA;
        });

      if (topRatedCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "top-rated-stays",
          title: "Top-rated 5-star stays",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 130,
          candidates: topRatedCandidates.map((listing) => ({
            listing,
            extra: { badge: "guest_favorite" as const },
          })),
          seeAllHref: "/listings?sortBy=top_rated",
        });
      }

      // 4. City lofts & modern apartments
      const apartmentCandidates = allListings.filter((l) => {
        const pt = (l.propertyType || "").toUpperCase();
        const titleLower = l.title.toLowerCase();
        return (
          pt === "APARTMENT" ||
          pt === "LOFT" ||
          pt === "STUDIO" ||
          pt === "PENTHOUSE" ||
          titleLower.includes("apartment") ||
          titleLower.includes("loft") ||
          titleLower.includes("studio") ||
          titleLower.includes("penthouse") ||
          titleLower.includes("flat")
        );
      });

      if (apartmentCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "city-apartments",
          title: "City lofts & modern apartments",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 135,
          candidates: apartmentCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?propertyType=APARTMENT",
        });
      }

      // 5. Cozy cabins & countryside retreats
      const cabinCandidates = allListings.filter((l) => {
        const pt = (l.propertyType || "").toUpperCase();
        const titleLower = l.title.toLowerCase();
        const descLower = (l.description || "").toLowerCase();
        return (
          pt === "CABIN" ||
          pt === "GUEST_HOUSE" ||
          pt === "COTTAGE" ||
          pt === "HOUSE" ||
          titleLower.includes("cabin") ||
          titleLower.includes("cottage") ||
          titleLower.includes("chalet") ||
          titleLower.includes("retreat") ||
          titleLower.includes("countryside") ||
          titleLower.includes("woodland") ||
          descLower.includes("cabin") ||
          descLower.includes("cottage")
        );
      });

      if (cabinCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "cozy-cabins",
          title: "Cozy cabins & countryside retreats",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 140,
          candidates: cabinCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?propertyType=CABIN",
        });
      }

      // 6. Spacious family-friendly homes
      const familyCandidates = allListings
        .filter((l) => l.guests >= 4 || (typeof l.bedrooms === "number" && l.bedrooms >= 2))
        .sort((a, b) => b.guests - a.guests);

      if (familyCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "family-friendly-homes",
          title: "Spacious family-friendly homes",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 145,
          candidates: familyCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?guests=4",
        });
      }

      // 7. Recommended stays (Priority 150)
      addSection({
        id: "recommended-for-you",
        title: "Recommended stays",
        type: "PROPERTY",
        source: "RECOMMENDATION",
        priority: 150,
        candidates: allListings.map((listing) => ({ listing })),
        seeAllHref: "/listings?sortBy=recommended",
      });

      // 8. Stays hosted by Superhosts
      const superhostCandidates = allListings.filter((l) => qualificationService.isSuperhost(l.host));
      if (superhostCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "superhost-stays",
          title: "Stays hosted by Superhosts",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 155,
          candidates: superhostCandidates.map((listing) => ({
            listing,
            extra: { badge: "superhost" as const },
          })),
          seeAllHref: "/listings?featured=true",
        });
      }

      // 9. Great value stays
      const sortedByPrice = allListings
        .slice()
        .sort((a, b) => (a.weekdayBasePrice ?? a.price) - (b.weekdayBasePrice ?? b.price));
      const affordableCutoff = sortedByPrice[Math.floor(sortedByPrice.length * 0.5)]?.price || 18000;
      const greatValueCandidates = allListings
        .filter((l) => (l.weekdayBasePrice ?? l.price) <= affordableCutoff)
        .sort((a, b) => calculatePopularityScore(b) - calculatePopularityScore(a));

      if (greatValueCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "great-value-stays",
          title: "Great value stays",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 160,
          candidates: greatValueCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?sortBy=price_low",
        });
      }

      // 10. Newly added stays
      const newlyAdded = allListings
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (newlyAdded.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "newly-added-stays",
          title: "Newly added stays",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 165,
          candidates: newlyAdded.map((listing) => ({ listing })),
          seeAllHref: "/listings?sortBy=newest",
        });
      }
    };

    // Global trending discovery under "Others"
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

    // Add all discovery rows to SEARCH mode under "Others" (priority >= 100)
    addCuratedDiscoverySections(100);

  } else {
    // =========================================================================
    // DEFAULT HOMEPAGE ENGINE (User has not searched anything yet)
    // =========================================================================
    const popularHomesConfig = await getHomepagePopularHomesConfig();
    const popularHomesResolution = await resolvePopularHomesCity(popularHomesConfig, {
      ...requestContext,
    });

    // Curated discovery sections for DEFAULT mode
    const addCuratedDiscoverySections = (priorityBase: number = 0) => {
      // 1. Popular homes / Most popular stays (Centralized Popularity Score)
      const hasCityPopularHomes = sections.some((s) => s.id === "popular-homes");
      const popularRankedListings = allListings.slice().sort(
        (a, b) => calculatePopularityScore(b) - calculatePopularityScore(a),
      );
      addSection({
        id: hasCityPopularHomes ? "most-popular-stays" : "popular-homes-global",
        title: hasCityPopularHomes ? "Most popular stays" : "Popular homes",
        type: "FEATURED",
        source: "RECOMMENDATION",
        priority: priorityBase > 0 ? 122 : 85,
        candidates: popularRankedListings.map((listing) => ({ listing })),
        seeAllHref: "/listings?sortBy=most_reviewed",
      });

      // 2. Luxury villas & private estates
      const villaCandidates = allListings
        .filter((l) => {
          const pt = (l.propertyType || "").toUpperCase();
          const titleLower = l.title.toLowerCase();
          const hasPool = Boolean(l.amenities && (l.amenities.includes("private_pool") || l.amenities.includes("pool")));
          return (
            pt === "VILLA" ||
            pt === "ESTATE" ||
            titleLower.includes("villa") ||
            titleLower.includes("estate") ||
            hasPool ||
            (l.price >= 25000 && l.guests >= 4)
          );
        })
        .sort((a, b) => b.price - a.price);

      if (villaCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "luxury-villas",
          title: "Luxury villas & private estates",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 125,
          candidates: villaCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?propertyType=VILLA",
        });
      }

      // 3. Top-rated 5-star stays
      const topRatedCandidates = allListings
        .slice()
        .filter((l) => {
          const hostProfile = (l.host?.publicProfile || {}) as Record<string, unknown>;
          const r = typeof hostProfile.rating === "number" ? hostProfile.rating : null;
          return r != null && r >= 4.7;
        })
        .sort((a, b) => {
          const rA = ((a.host?.publicProfile || {}) as any).rating || 0;
          const rB = ((b.host?.publicProfile || {}) as any).rating || 0;
          return rB - rA;
        });

      if (topRatedCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "top-rated-stays",
          title: "Top-rated 5-star stays",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 130,
          candidates: topRatedCandidates.map((listing) => ({
            listing,
            extra: { badge: "guest_favorite" as const },
          })),
          seeAllHref: "/listings?sortBy=top_rated",
        });
      }

      // 4. City lofts & modern apartments
      const apartmentCandidates = allListings.filter((l) => {
        const pt = (l.propertyType || "").toUpperCase();
        const titleLower = l.title.toLowerCase();
        return (
          pt === "APARTMENT" ||
          pt === "LOFT" ||
          pt === "STUDIO" ||
          pt === "PENTHOUSE" ||
          titleLower.includes("apartment") ||
          titleLower.includes("loft") ||
          titleLower.includes("studio") ||
          titleLower.includes("penthouse") ||
          titleLower.includes("flat")
        );
      });

      if (apartmentCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "city-apartments",
          title: "City lofts & modern apartments",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 135,
          candidates: apartmentCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?propertyType=APARTMENT",
        });
      }

      // 5. Cozy cabins & countryside retreats
      const cabinCandidates = allListings.filter((l) => {
        const pt = (l.propertyType || "").toUpperCase();
        const titleLower = l.title.toLowerCase();
        const descLower = (l.description || "").toLowerCase();
        return (
          pt === "CABIN" ||
          pt === "GUEST_HOUSE" ||
          pt === "COTTAGE" ||
          pt === "HOUSE" ||
          titleLower.includes("cabin") ||
          titleLower.includes("cottage") ||
          titleLower.includes("chalet") ||
          titleLower.includes("retreat") ||
          titleLower.includes("countryside") ||
          titleLower.includes("woodland") ||
          descLower.includes("cabin") ||
          descLower.includes("cottage")
        );
      });

      if (cabinCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "cozy-cabins",
          title: "Cozy cabins & countryside retreats",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 140,
          candidates: cabinCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?propertyType=CABIN",
        });
      }

      // 6. Spacious family-friendly homes
      const familyCandidates = allListings
        .filter((l) => l.guests >= 4 || (typeof l.bedrooms === "number" && l.bedrooms >= 2))
        .sort((a, b) => b.guests - a.guests);

      if (familyCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "family-friendly-homes",
          title: "Spacious family-friendly homes",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 145,
          candidates: familyCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?guests=4",
        });
      }

      // 7. Recommended stays (Priority 150)
      addSection({
        id: "recommended-for-you",
        title: "Recommended stays",
        type: "PROPERTY",
        source: "RECOMMENDATION",
        priority: 150,
        candidates: allListings.map((listing) => ({ listing })),
        seeAllHref: "/listings?sortBy=recommended",
      });

      // 8. Stays hosted by Superhosts
      const superhostCandidates = allListings.filter((l) => qualificationService.isSuperhost(l.host));
      if (superhostCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "superhost-stays",
          title: "Stays hosted by Superhosts",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 155,
          candidates: superhostCandidates.map((listing) => ({
            listing,
            extra: { badge: "superhost" as const },
          })),
          seeAllHref: "/listings?featured=true",
        });
      }

      // 9. Great value stays
      const sortedByPrice = allListings
        .slice()
        .sort((a, b) => (a.weekdayBasePrice ?? a.price) - (b.weekdayBasePrice ?? b.price));
      const affordableCutoff = sortedByPrice[Math.floor(sortedByPrice.length * 0.5)]?.price || 18000;
      const greatValueCandidates = allListings
        .filter((l) => (l.weekdayBasePrice ?? l.price) <= affordableCutoff)
        .sort((a, b) => calculatePopularityScore(b) - calculatePopularityScore(a));

      if (greatValueCandidates.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "great-value-stays",
          title: "Great value stays",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 160,
          candidates: greatValueCandidates.map((listing) => ({ listing })),
          seeAllHref: "/listings?sortBy=price_low",
        });
      }

      // 10. Newly added stays
      const newlyAdded = allListings
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (newlyAdded.length >= MIN_PROPERTY_CAROUSEL) {
        addSection({
          id: "newly-added-stays",
          title: "Newly added stays",
          type: "PROPERTY",
          source: "RECOMMENDATION",
          priority: 165,
          candidates: newlyAdded.map((listing) => ({ listing })),
          seeAllHref: "/listings?sortBy=newest",
        });
      }
    };

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

    // 2. Priority 80: Popular homes in nearby / prominent cities
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

    // 3. Priority 100: Popular stays near you (if current location detected)
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

    // 4. Priority 110: Trending in your country (if country known)
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

    // 5. Priority 120: Trending stays (scored centrally)
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

    // 6. Curated discovery rows for DEFAULT mode (Popular homes, Villas, Top-rated, City lofts, Cabins, Family homes, Recommended, Superhosts, Great value, Newly added)
    addCuratedDiscoverySections(0);
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

async function getRecentSearchSections(params: {
  searches: Array<SearchContext | any>;
  userId?: string;
  currentLocationQuery?: string | null;
  limit?: number;
}): Promise<HomepageSection[]> {
  const { searches = [], userId, currentLocationQuery, limit = 4 } = params;
  if (!searches.length) return [];

  const normCurrent = currentLocationQuery?.trim().toLowerCase() || "";
  const seenLocations = new Set<string>();
  if (normCurrent) {
    seenLocations.add(normCurrent);
  }

  // Filter valid, unique past searches
  const uniqueSearches: Array<SearchContext | any> = [];
  for (const s of searches) {
    const locName = (s.city || s.displayName || s.query || "").trim();
    if (!locName || locName === "Stays" || locName === "All") continue;
    const norm = locName.toLowerCase();
    if (seenLocations.has(norm)) continue;
    seenLocations.add(norm);
    uniqueSearches.push(s);
    if (uniqueSearches.length >= limit) break;
  }

  if (!uniqueSearches.length) return [];

  // Fetch candidate active listings (reusing cached discovery listings)
  const allListings = await getDiscoveryCandidateListings();

  // For user favorites if logged in
  let favoriteIds = new Set<string>();
  if (userId) {
    try {
      const allIds = allListings.map((l) => l.id);
      favoriteIds = await favoriteService.getFavoriteListingIds(userId, allIds);
    } catch {}
  }

  const sections: HomepageSection[] = [];

  for (const s of uniqueSearches) {
    const locName = (s.city || s.displayName || s.query || "").trim();
    const isLandmark = s.placeType === "landmark";
    const searchedLat = typeof s.latitude === "number" ? s.latitude : null;
    const searchedLng = typeof s.longitude === "number" ? s.longitude : null;
    const searchedCountry = s.country?.trim().toLowerCase() || "";
    const normCity = (s.city || "").trim().toLowerCase();
    const normQuery = (s.query || s.displayName || "").trim().toLowerCase();

    // Match listings strictly to this searched location across multi-level entities:
    // landmark / coordinates, city, area/district, neighborhood, state, country
    const matched = allListings.filter((l) => {
      // 1. Proximity match for landmarks or coordinates
      if (searchedLat != null && searchedLng != null && l.latitude != null && l.longitude != null) {
        const dist = calculateDistance(searchedLat, searchedLng, l.latitude, l.longitude);
        if (dist <= 35) return true;
      }

      // 2. Country-level filter
      if (searchedCountry && l.country) {
        const lcCountry = l.country.trim().toLowerCase();
        if (searchedCountry === lcCountry) {
          if (normQuery === searchedCountry || normCity === searchedCountry || s.placeType === "country") {
            return true;
          }
        } else if (normQuery !== searchedCountry && normCity !== searchedCountry) {
          // If searching a specific city in a known country, prevent cross-country false positives
          return false;
        }
      }

      // 3. Multi-level text matching: city, district, neighborhood, state, address, locationSearch
      const searchTokens = [
        normCity,
        normQuery,
        s.district?.trim().toLowerCase(),
        s.neighborhood?.trim().toLowerCase(),
        s.state?.trim().toLowerCase(),
      ].filter(Boolean) as string[];

      for (const token of searchTokens) {
        if (!token || token.length < 2) continue;
        if (l.city) {
          const lc = l.city.trim().toLowerCase();
          if (lc === token || lc.includes(token) || token.includes(lc)) return true;
        }
        if (l.district) {
          const ld = l.district.trim().toLowerCase();
          if (ld === token || ld.includes(token) || token.includes(ld)) return true;
        }
        if (l.title) {
          const lt = l.title.trim().toLowerCase();
          if (lt.includes(token)) return true;
        }
        if (l.country) {
          const lco = l.country.trim().toLowerCase();
          if (lco === token) return true;
        }
      }

      return false;
    });

    if (matched.length === 0) continue; // Do not render empty carousel rows

    const title = isLandmark ? `Stays near ${s.displayName || locName}` : `Stays in ${locName}`;
    const sp = new URLSearchParams();
    if (s.displayName || s.query) sp.set("destination", s.displayName || s.query);
    if (s.city) sp.set("city", s.city);
    if (s.placeType) sp.set("locationType", s.placeType);
    if (searchedLat != null) sp.set("lat", String(searchedLat));
    if (searchedLng != null) sp.set("lng", String(searchedLng));
    if (s.checkIn) sp.set("checkIn", s.checkIn);
    if (s.checkOut) sp.set("checkOut", s.checkOut);
    if (s.guests && s.guests > 1) sp.set("guests", String(s.guests));

    const properties = matched.slice(0, 10).map((l) => {
      const prop = toProperty(l);
      if (favoriteIds.has(l.id)) {
        prop.favoriteStatus = true;
        prop.isFavorite = true;
      }
      return prop;
    });

    sections.push({
      id: `recent-search-${locName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      title,
      subtitle: s.checkIn && s.checkOut ? `Available stays for your dates` : undefined,
      type: "PROPERTY",
      source: "RECOMMENDATION",
      priority: 105,
      properties,
      items: properties,
      seeAllHref: `/listings?${sp.toString()}`,
      previewImages: matched.slice(0, 3).flatMap((l) => l.photos || []).filter(Boolean),
      totalCount: matched.length,
    });

    if (sections.length >= limit) break;
  }

  return sections;
}

export const homepageService = {
  getHomepageData,
  getRecentSearchSections,
  resolvePopularHomesCity,
};
