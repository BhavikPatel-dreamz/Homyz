import { prisma } from "@/lib/db/prisma";
import { getCounter, getOrSetCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";
import { CACHE_TTL } from "@/lib/redis/ttl";
import { BookingStatus, ListingStatus } from "@/generated/prisma/enums";
import { parseCutoffHour, parseRequiredAdvanceDays } from "@/services/booking.service";
import { favoriteService } from "@/services/favorite.service";

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

export type HomepageData = {
  location: { city: string | null };
  sections: HomepageSection[];
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

function getWeekendWindow(today: Date): { start: Date; end: Date } {
  const daysUntilFriday = (5 - today.getDay() + 7) % 7;
  const start = addDays(today, daysUntilFriday);
  return { start, end: addDays(start, 3) };
}

async function loadHomepageData(city?: string): Promise<HomepageData> {
  const today = startOfDay();
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const weekend = getWeekendWindow(today);

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

  const featuredHref = resolvedCity
    ? `/listings?featured=true&city=${encodeURIComponent(resolvedCity)}&destination=${encodeURIComponent(resolvedCity)}`
    : "/listings?featured=true";
  addSection(
    "featured",
    "Featured stays",
    "FEATURED",
    listings.filter((listing) => listing.isFeatured),
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

  return { location: { city: resolvedCity }, sections };
}

async function getHomepageData(input: { city?: string; userId?: string } = {}): Promise<HomepageData> {
  const city = input.city?.trim().toLocaleLowerCase() || "all";
  const version = await getCounter(CACHE_KEYS.LISTINGS_PUBLIC_VER());
  const publicData = await getOrSetCache(
    CACHE_KEYS.HOMEPAGE_DISCOVERY(version, city),
    () => loadHomepageData(input.city),
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
