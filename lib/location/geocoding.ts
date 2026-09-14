/**
 * Centralized Structured Location & Geocoding Utilities for Homyz
 * Standardizes place search, autocomplete, address details, reverse geocoding, and lat/lng coordinates.
 */

export type StructuredLocation = {
  locationName: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress: string;
};

export type StructuredAddress = {
  formattedAddress: string;
  streetAddress: string;
  apartment?: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
};

// Fallback curated global travel destinations for instant matching & offline safety
export const POPULAR_GLOBAL_DESTINATIONS: StructuredLocation[] = [
  { locationName: "Riyadh", city: "Riyadh", state: "Riyadh Region", country: "Saudi Arabia", countryCode: "SA", latitude: 24.7136, longitude: 46.6753, formattedAddress: "Riyadh, Saudi Arabia" },
  { locationName: "Jeddah", city: "Jeddah", state: "Makkah Region", country: "Saudi Arabia", countryCode: "SA", latitude: 21.5433, longitude: 39.1728, formattedAddress: "Jeddah, Saudi Arabia" },
  { locationName: "Dammam", city: "Dammam", state: "Eastern Province", country: "Saudi Arabia", countryCode: "SA", latitude: 26.4207, longitude: 50.0888, formattedAddress: "Dammam, Saudi Arabia" },
  { locationName: "Al Khobar", city: "Al Khobar", state: "Eastern Province", country: "Saudi Arabia", countryCode: "SA", latitude: 26.2172, longitude: 50.1971, formattedAddress: "Al Khobar, Saudi Arabia" },
  { locationName: "Paris", city: "Paris", state: "Île-de-France", country: "France", countryCode: "FR", latitude: 48.8566, longitude: 2.3522, formattedAddress: "Paris, Île-de-France, France" },
  { locationName: "London", city: "London", state: "Greater London", country: "United Kingdom", countryCode: "GB", latitude: 51.5074, longitude: -0.1278, formattedAddress: "London, England, United Kingdom" },
  { locationName: "Dubai", city: "Dubai", state: "Dubai", country: "United Arab Emirates", countryCode: "AE", latitude: 25.2048, longitude: 55.2708, formattedAddress: "Dubai, United Arab Emirates" },
  { locationName: "New York", city: "New York", state: "New York", country: "United States", countryCode: "US", latitude: 40.7128, longitude: -74.006, formattedAddress: "New York, NY, United States" },
  { locationName: "Rome", city: "Rome", state: "Lazio", country: "Italy", countryCode: "IT", latitude: 41.9028, longitude: 12.4964, formattedAddress: "Rome, Lazio, Italy" },
  { locationName: "Barcelona", city: "Barcelona", state: "Catalonia", country: "Spain", countryCode: "ES", latitude: 41.3851, longitude: 2.1734, formattedAddress: "Barcelona, Catalonia, Spain" },
  { locationName: "Tokyo", city: "Tokyo", state: "Kanto", country: "Japan", countryCode: "JP", latitude: 35.6762, longitude: 139.6503, formattedAddress: "Tokyo, Japan" },
  { locationName: "Istanbul", city: "Istanbul", state: "Marmara", country: "Turkey", countryCode: "TR", latitude: 41.0082, longitude: 28.9784, formattedAddress: "Istanbul, Turkey" },
  { locationName: "Zurich", city: "Zurich", state: "Zurich", country: "Switzerland", countryCode: "CH", latitude: 47.3769, longitude: 8.5417, formattedAddress: "Zurich, Switzerland" },
];

// In-memory caches to prevent redundant network requests
const searchCache = new Map<string, StructuredAddress[]>();
const reverseCache = new Map<string, StructuredAddress>();
const forwardCache = new Map<string, StructuredAddress>();

/**
 * Parses raw Nominatim API response item into a clean StructuredAddress.
 */
export function parseNominatimAddress(item: any): StructuredAddress {
  const addr = item?.address || {};
  const lat = typeof item?.lat === "string" ? parseFloat(item.lat) : Number(item?.lat || 0);
  const lon = typeof item?.lon === "string" ? parseFloat(item.lon) : Number(item?.lon || 0);

  const road = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || addr.highway || "";
  const houseNumber = addr.house_number || "";
  const streetAddress = [houseNumber, road].filter(Boolean).join(" ") || addr.amenity || addr.building || road || item?.name || "";

  const district =
    addr.neighbourhood ||
    addr.suburb ||
    addr.city_district ||
    addr.district ||
    addr.quarter ||
    addr.residential ||
    "";

  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.hamlet ||
    district ||
    "";

  const state = addr.state || addr.region || addr.province || addr.state_district || addr.county || "";
  const postalCode = addr.postcode || addr["postal_code"] || "";
  const country = addr.country || "";
  const countryCode = addr.country_code ? String(addr.country_code).toUpperCase() : undefined;

  const formattedAddress =
    item?.display_name ||
    [streetAddress, district, city, state, country].filter(Boolean).join(", ");

  return {
    formattedAddress,
    streetAddress,
    district,
    city,
    state,
    postalCode,
    country,
    countryCode,
    latitude: !isNaN(lat) ? lat : 24.7136,
    longitude: !isNaN(lon) ? lon : 46.6753,
  };
}

/**
 * Searches address autocomplete with Nominatim and cached in-memory results.
 */
export async function searchAddressAutocomplete(query: string, limit: number = 6): Promise<StructuredAddress[]> {
  const clean = (query || "").trim();
  if (!clean || clean.length < 2) {
    return [];
  }

  const cacheKey = clean.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        clean
      )}&addressdetails=1&limit=${limit}`,
      {
        headers: {
          "User-Agent": "HomyzApp/1.0",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const results = data.map(parseNominatimAddress);
        searchCache.set(cacheKey, results);
        return results;
      }
    }
  } catch {
    // Network / timeout fallback
  }

  // Fallback to local destinations matching query
  const q = clean.toLowerCase();
  const fallbackResults: StructuredAddress[] = POPULAR_GLOBAL_DESTINATIONS.filter(
    (dest) =>
      dest.formattedAddress.toLowerCase().includes(q) ||
      dest.locationName.toLowerCase().includes(q) ||
      dest.country?.toLowerCase().includes(q)
  ).map((dest) => ({
    formattedAddress: dest.formattedAddress,
    streetAddress: dest.locationName,
    district: "",
    city: dest.city || dest.locationName,
    state: dest.state || "",
    postalCode: "",
    country: dest.country || "",
    countryCode: dest.countryCode,
    latitude: dest.latitude || 24.7136,
    longitude: dest.longitude || 46.6753,
  }));

  if (fallbackResults.length > 0) {
    searchCache.set(cacheKey, fallbackResults);
  }

  return fallbackResults;
}

/**
 * Reverse geocodes a latitude and longitude into structured address components.
 */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<StructuredAddress | null> {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;

  // Cache key rounded to 4 decimals (~11 meters accuracy)
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "HomyzApp/1.0",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const parsed = parseNominatimAddress(data);
        // Retain requested pin coordinates
        parsed.latitude = lat;
        parsed.longitude = lng;
        reverseCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch {
    // Network / timeout
  }

  return null;
}

/**
 * Forward geocodes an address string to obtain coordinates and structured address.
 */
export async function forwardGeocodeAddress(query: string): Promise<StructuredAddress | null> {
  const clean = (query || "").trim();
  if (!clean) return null;

  const cacheKey = clean.toLowerCase();
  const cached = forwardCache.get(cacheKey);
  if (cached) return cached;

  const results = await searchAddressAutocomplete(clean, 1);
  if (results.length > 0) {
    forwardCache.set(cacheKey, results[0]);
    return results[0];
  }

  return null;
}

/**
 * Legacy searchLocations function for backward compatibility.
 */
export async function searchLocations(query: string): Promise<StructuredLocation[]> {
  if (!query || query.trim().length < 2) {
    return POPULAR_GLOBAL_DESTINATIONS;
  }

  const results = await searchAddressAutocomplete(query, 8);
  if (results.length > 0) {
    return results.map((r) => ({
      locationName: r.streetAddress || r.city || query,
      city: r.city,
      state: r.state,
      country: r.country,
      countryCode: r.countryCode,
      latitude: r.latitude,
      longitude: r.longitude,
      formattedAddress: r.formattedAddress,
    }));
  }

  return POPULAR_GLOBAL_DESTINATIONS;
}

/**
 * Normalizes an arbitrary string location into a clean formatted string.
 */
export function formatLocationString(location?: string | null): string {
  if (!location) return "";
  return location.trim();
}
