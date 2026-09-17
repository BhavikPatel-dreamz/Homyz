import { prisma } from "@/lib/db/prisma";
import { getCounter, getOrSetCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";
import { CACHE_TTL } from "@/lib/redis/ttl";
import { BookingStatus, ListingStatus } from "@/generated/prisma/enums";
import { parseCutoffHour, parseRequiredAdvanceDays } from "@/services/booking.service";
import { favoriteService } from "@/services/favorite.service";
import { getHomepagePopularHomesConfig, type HomepagePopularHomesConfig } from "@/services/app-settings.service";
import { reverseGeocodeLocation } from "@/lib/location/geocoding";

const SECTION_LIMIT = 12;
const CANDIDATE_LIMIT = 150;

export type HomepageProperty = {
  id: string;
  slug: string | null;
  title: string;
  city: string | null;
  area: string | null;
  country: string | null;
  mainImage: string;
  price: number;
  currency: "SAR";
  maxGuests: number;
  propertyType: string | null;
  featured: boolean;
  favoriteStatus: boolean;
};

export type HomepageSection = {
  id: string;
  title: string;
  type: "FEATURED" | "LOCATION" | "WEEKEND" | "THIS_MONTH" | "NEXT_MONTH";
  properties: HomepageProperty[];
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

export type HomepageData = {
  location: { city: string | null };
  sections: HomepageSection[];
  trendingLocations: TrendingLocation[];
};

type DiscoveryListing = {
  id: string;
  customSlug: string | null;
  title: string;
  city: string | null;
  district: string | null;
  country: string | null;
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

function hasBookableRange(listing: DiscoveryListing, windowStart: Date, windowEnd: Date): boolean {
  const minNights = Math.max(1, listing.minNights || 1);
  const maxNights = Math.max(minNights, listing.maxNights || 365);
  const blocked = new Set(listing.blockedDates);
  const advanceDays = parseRequiredAdvanceDays(listing.advanceNotice);
  const now = new Date();
  const today = startOfDay(now);
  const earliestCheckIn = addDays(today, advanceDays);

  for (let checkIn = new Date(windowStart); addDays(checkIn, minNights) <= windowEnd; checkIn = addDays(checkIn, 1)) {
    if (checkIn < earliestCheckIn || minNights > maxNights) continue;
    if (checkIn.getTime() === today.getTime()) {
      const currentHour = now.getHours() + now.getMinutes() / 60;
      if (!listing.allowSameDayRequests || currentHour >= parseCutoffHour(listing.sameDayCutoff)) continue;
    }
    const checkOut = addDays(checkIn, minNights);
    let blockedOrBooked = false;
    for (let date = new Date(checkIn); date < checkOut; date = addDays(date, 1)) {
      if (blocked.has(dateKey(date))) {
        blockedOrBooked = true;
        break;
      }
    }
    if (blockedOrBooked) continue;

    const overlapsReservation = listing.bookings.some(
      (booking) => booking.startDate < checkOut && booking.endDate > checkIn,
    );
    if (!overlapsReservation) return true;
  }

  return false;
}

function toProperty(listing: DiscoveryListing): HomepageProperty {
  return {
    id: listing.id,
    slug: listing.customSlug,
    title: listing.title,
    city: listing.city,
    area: listing.district,
    country: listing.country,
    mainImage: listing.photos[0],
    price: listing.weekdayBasePrice ?? listing.price,
    currency: "SAR",
    maxGuests: listing.guests,
    propertyType: listing.propertyType,
    featured: listing.isFeatured,
    favoriteStatus: false,
  };
}

function uniqueProperties(listings: DiscoveryListing[]): HomepageProperty[] {
  return listings.slice(0, SECTION_LIMIT).map(toProperty);
}

function normalizeCityName(value?: string | null): string | null {
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

function getWeekendWindow(today: Date): { start: Date; end: Date } {
  const daysUntilFriday = (5 - today.getDay() + 7) % 7;
  const start = addDays(today, daysUntilFriday);
  return { start, end: addDays(start, 3) };
}

async function loadTrendingLocations(): Promise<TrendingLocation[]> {
  const searchAnalyticsKey = CACHE_KEYS.SEARCH_ANALYTICS();
  const recentSearches: Array<{
    destination?: string | null;
    city?: string | null;
    country?: string | null;
    placeName?: string | null;
  }> = (await getOrSetCache(searchAnalyticsKey, async () => [], { ttl: CACHE_TTL.HOMEPAGE_DISCOVERY })) as Array<{
    destination?: string | null;
    city?: string | null;
    country?: string | null;
    placeName?: string | null;
  }> | null ?? [];

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
    const fallbackCities: Array<{ city: string | null; country: string | null; photos: string[] }> = await prisma.listing.findMany({
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

  const rankedCities: Array<{ city: string; country: string; count: number }> = [...cityCounts.values()]
    .sort((a: { city: string; country: string; count: number }, b: { city: string; country: string; count: number }) => b.count - a.count)
    .slice(0, 6);

  const cityDetails: Array<{ id: string; city: string | null; country: string | null; photos: string[]; title: string }> = await prisma.listing.findMany({
    where: {
      published: true,
      status: ListingStatus.ACTIVE,
      isPaused: false,
      deletedAt: null,
      photos: { isEmpty: false },
      OR: rankedCities.map((entry: { city: string; country: string; count: number }) => ({ city: { equals: entry.city, mode: "insensitive" } })),
    },
    select: { id: true, city: true, country: true, photos: true, title: true },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
  });

  return rankedCities.map((entry: { city: string; country: string; count: number }) => {
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

async function loadHomepageData(
  city?: string,
  requestContext?: HomepageRequestContext,
): Promise<HomepageData> {
  const today = startOfDay();
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const weekend = getWeekendWindow(today);
  const popularHomesConfig = await getHomepagePopularHomesConfig();
  const popularHomesResolution = await resolvePopularHomesCity(popularHomesConfig, {
    ...requestContext,
    city: requestContext?.city || city || null,
    destination: requestContext?.destination || city || null,
  });
  const popularHomesCity = popularHomesResolution.city;
  const popularHomesTitle = popularHomesResolution.title;

  const listings = await prisma.listing.findMany({
    where: {
      published: true,
      status: ListingStatus.ACTIVE,
      isPaused: false,
      deletedAt: null,
      photos: { isEmpty: false },
      ...(city?.trim() ? { city: { contains: city.trim(), mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      customSlug: true,
      title: true,
      city: true,
      district: true,
      country: true,
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
      bookings: {
        where: {
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          startDate: { lt: nextMonthEnd },
          endDate: { gt: today },
        },
        select: { startDate: true, endDate: true, status: true },
      },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: CANDIDATE_LIMIT,
  }) as DiscoveryListing[];

  const resolvedCity = city?.trim() || listings.find((listing) => listing.city?.trim())?.city || null;
  const locationListings = resolvedCity
    ? listings.filter((listing) => listing.city?.toLocaleLowerCase() === resolvedCity.toLocaleLowerCase())
    : listings;
  const sections: HomepageSection[] = [];
  const addSection = (
    id: HomepageSection["id"],
    title: string,
    type: HomepageSection["type"],
    source: DiscoveryListing[],
    seeAllHref: string,
  ) => {
    const properties = uniqueProperties(source);
    if (properties.length) {
      const previewImages = source
        .flatMap((listing) => listing.photos || [])
        .filter(Boolean)
        .slice(0, 3);

      sections.push({
        id,
        title,
        type,
        properties,
        seeAllHref,
        previewImages,
        totalCount: source.length,
      });
    }
  };

  const popularListings = popularHomesCity
    ? listings.filter((listing) => listing.city?.toLocaleLowerCase() === popularHomesCity.toLocaleLowerCase())
    : listings.filter((listing) => listing.isFeatured);
  const featuredSource = popularListings.length > 0 ? popularListings : listings.filter((listing) => listing.isFeatured);
  const featureSectionTitle = popularHomesResolution.enabled && (popularHomesTitle || popularHomesCity)
    ? popularHomesTitle
    : resolvedCity
      ? `Popular homes in ${resolvedCity}`
      : "Featured stays";
  const featuredHref = popularHomesCity
    ? `/listings?featured=true&city=${encodeURIComponent(popularHomesCity)}&destination=${encodeURIComponent(popularHomesCity)}`
    : resolvedCity
      ? `/listings?featured=true&city=${encodeURIComponent(resolvedCity)}&destination=${encodeURIComponent(resolvedCity)}`
      : "/listings?featured=true";
  addSection(
    "featured",
    featureSectionTitle,
    "FEATURED",
    featuredSource,
    featuredHref,
  );

  if (resolvedCity) {
    const cityHref = `/listings?city=${encodeURIComponent(resolvedCity)}&destination=${encodeURIComponent(resolvedCity)}`;
    addSection(
      `city-${resolvedCity.toLowerCase()}`,
      `Explore stays in ${resolvedCity}`,
      "LOCATION",
      locationListings,
      cityHref,
    );
  }

  const weekendHref = `/listings?checkIn=${dateKey(weekend.start)}&checkOut=${dateKey(weekend.end)}${resolvedCity ? `&city=${encodeURIComponent(resolvedCity)}&destination=${encodeURIComponent(resolvedCity)}` : ""}&sortBy=recommended`;
  addSection(
    "weekend",
    "Available this weekend",
    "WEEKEND",
    locationListings.filter((listing) => hasBookableRange(listing, weekend.start, weekend.end)),
    weekendHref,
  );

  if (thisMonthEnd > today) {
    const thisMonthHref = `/listings?checkIn=${dateKey(today)}&checkOut=${dateKey(thisMonthEnd)}${resolvedCity ? `&city=${encodeURIComponent(resolvedCity)}&destination=${encodeURIComponent(resolvedCity)}` : ""}&sortBy=recommended`;
    addSection(
      "this-month",
      resolvedCity ? `Available this month in ${resolvedCity}` : "Available this month",
      "THIS_MONTH",
      locationListings.filter((listing) => hasBookableRange(listing, today, thisMonthEnd)),
      thisMonthHref,
    );
  }

  const nextMonthHref = `/listings?checkIn=${dateKey(nextMonthStart)}&checkOut=${dateKey(nextMonthEnd)}${resolvedCity ? `&city=${encodeURIComponent(resolvedCity)}&destination=${encodeURIComponent(resolvedCity)}` : ""}&sortBy=recommended`;
  addSection(
    "next-month",
    resolvedCity ? `Available next month in ${resolvedCity}` : "Available next month",
    "NEXT_MONTH",
    locationListings.filter((listing) => hasBookableRange(listing, nextMonthStart, nextMonthEnd)),
    nextMonthHref,
  );

  const trendingLocations = await loadTrendingLocations();
  return { location: { city: resolvedCity }, sections, trendingLocations };
}

async function getHomepageData(
  input: {
    city?: string;
    userId?: string;
    requestContext?: HomepageRequestContext;
  } = {},
): Promise<HomepageData> {
  const city = input.city?.trim().toLocaleLowerCase() || "all";
  const version = await getCounter(CACHE_KEYS.LISTINGS_PUBLIC_VER());
  const publicData = await getOrSetCache(
    CACHE_KEYS.HOMEPAGE_DISCOVERY(version, city),
    () => loadHomepageData(input.city, input.requestContext),
    { ttl: CACHE_TTL.HOMEPAGE_DISCOVERY },
  );
  if (!input.userId) return publicData;

  const listingIds = publicData.sections.flatMap((section) => section.properties.map((property) => property.id));
  const favoriteIds = await favoriteService.getFavoriteListingIds(input.userId, listingIds);
  return {
    ...publicData,
    sections: publicData.sections.map((section) => ({
      ...section,
      properties: section.properties.map((property) => ({
        ...property,
        favoriteStatus: favoriteIds.has(property.id),
      })),
    })),
  };
}

export const homepageService = { getHomepageData };
