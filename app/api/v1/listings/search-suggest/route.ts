import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { ListingStatus } from "@/generated/prisma/enums";
import { getCache, setCache } from "@/lib/redis/cache";
import {
  searchPlacesAutocomplete,
  type UnifiedLocationSuggestion,
  type LocationType,
} from "@/lib/location/places-provider";
// Compatibility exports for regression tests: searchWorldCities, searchAddressAutocomplete
export { searchPlacesAutocomplete as searchAddressAutocomplete } from "@/lib/location/places-provider";
export { searchWorldCities } from "@/lib/location/world-cities";

export interface SuggestionItem {
  id?: string;
  name: string;
  city: string;
  fullLabel: string;
  region?: string | null;
  state?: string | null;
  country: string | null;
  countryCode?: string | null;
  locality?: string | null;
  latitude: number;
  longitude: number;
  subtitle?: string;
  badge?: string;
  locationType: LocationType;
  providerPlaceId: string;
  type: LocationType;
  distanceKm?: number;
}

function getLocationBadge(type: LocationType): string {
  switch (type) {
    case "city":
      return "City";
    case "neighborhood":
      return "Neighborhood";
    case "beach":
      return "Beach";
    case "station":
      return "Station";
    case "airport":
      return "Airport";
    case "mall":
      return "Mall";
    case "university":
      return "University";
    case "hospital":
      return "Hospital";
    case "street":
      return "Street";
    case "landmark":
      return "Landmark";
    case "area":
      return "Area";
    case "district":
      return "District";
    case "country":
      return "Country";
    case "stay":
      return "Stay";
    case "poi":
      return "Attraction";
    default:
      return "Place";
  }
}

/**
 * GET /api/v1/listings/search-suggest?q=surat
 * Returns Airbnb-style destination and granular place / neighborhood / POI lists.
 * Powered by World Landmarks Registry, Mapbox Search, and active database listings.
 */
export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  const where = {
    published: true,
    status: ListingStatus.ACTIVE,
    isPaused: false,
    deletedAt: null,
  } as const;

  // For empty queries, return dynamic popular destinations & DB stays
  if (q.length < 2) {
    const dbCities = await prisma.listing.findMany({
      where,
      select: { city: true, country: true, district: true, latitude: true, longitude: true },
      distinct: ["city"],
      take: 8,
      orderBy: { city: "asc" },
    }).catch(() => []);

    const cities: SuggestionItem[] = dbCities.length > 0
      ? (dbCities as Array<{ city: string | null; country: string | null; district: string | null; latitude: number | null; longitude: number | null }>)
          .filter((c) => Boolean(c.city))
          .map((c) => ({
            name: c.city as string,
            city: c.city as string,
            fullLabel: `${c.city}${c.country ? `, ${c.country}` : ""}`,
            country: c.country || "Available stays",
            subtitle: "Verified stays in Homyz",
            badge: "Available Stays",
            latitude: c.latitude || 0,
            longitude: c.longitude || 0,
            locationType: "city",
            providerPlaceId: `db:${c.city}`,
            type: "city",
          }))
      : [];

    return ok({
      primaryCity: null,
      places: [],
      districts: [],
      cities,
      properties: [],
    });
  }

  // Check Redis cache for fast response (fail-open)
  const cacheKey = `homyz:loc:suggest:${q.toLowerCase()}`;
  try {
    const cached = await getCache<any>(cacheKey);
    if (cached) return ok(cached);
  } catch {}

  // 1. Query Places Autocomplete Provider (World Landmarks + Mapbox + Nominatim + CSC)
  const placesPromise = searchPlacesAutocomplete(q, { limit: 12 });

  // 2. Query DB listings for matching cities, districts, and property titles
  const dbPromise = Promise.all([
    prisma.listing.findMany({
      where: {
        ...where,
        OR: [
          { city: { contains: q, mode: "insensitive" } },
          { district: { contains: q, mode: "insensitive" } },
          { address: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { city: true, country: true, district: true, latitude: true, longitude: true },
      distinct: ["city"],
      take: 4,
      orderBy: { city: "asc" },
    }).catch(() => []),
    prisma.listing.findMany({
      where: {
        ...where,
        title: { contains: q, mode: "insensitive" },
      },
      select: { id: true, title: true, city: true, district: true, latitude: true, longitude: true },
      take: 4,
      orderBy: { isFeatured: "desc" },
    }).catch(() => []),
  ]);

  const [placesData, [dbCityRows, dbPropertyRows]] = await Promise.all([
    placesPromise,
    dbPromise,
  ]);

  const formattedPlaces: SuggestionItem[] = placesData.map((item) => ({
    id: item.id,
    name: item.name,
    city: item.city,
    fullLabel: item.fullAddress,
    state: item.state,
    region: item.state,
    country: item.country,
    countryCode: item.countryCode,
    locality: item.locality,
    latitude: item.latitude,
    longitude: item.longitude,
    locationType: item.locationType,
    providerPlaceId: item.providerPlaceId,
    type: item.locationType,
    subtitle: item.fullAddress,
    badge: getLocationBadge(item.locationType),
    distanceKm: item.distanceKm,
  }));

  // Identify primary city match if present
  const primaryCity = formattedPlaces.find((p) => p.locationType === "city") || null;
  const places = formattedPlaces.filter(
    (p) =>
      p.locationType !== "city" &&
      p.locationType !== "district" &&
      p.locationType !== "country",
  );
  const districts = formattedPlaces.filter((p) => p.locationType === "district");

  const properties = (
    dbPropertyRows as Array<{ id: string; title: string; city: string | null; district: string | null; latitude: number | null; longitude: number | null }>
  ).map((r) => ({
    id: r.id,
    title: r.title,
    city: r.district ? `${r.district}, ${r.city}` : r.city,
    latitude: r.latitude,
    longitude: r.longitude,
  }));

  const payload = {
    suggestions: formattedPlaces,
    primaryCity,
    places,
    districts,
    cities: formattedPlaces,
    properties,
  };

  try {
    await setCache(cacheKey, payload, 86400);
  } catch {}

  return ok(payload);
});
