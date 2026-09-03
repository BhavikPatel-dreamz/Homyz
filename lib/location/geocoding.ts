/**
 * Centralized Structured Location & Geocoding Utilities for Homyz
 * Standardizes place search, autocomplete, address details, and lat/lng coordinates across all services.
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

// Fallback curated global travel destinations for instant matching & offline safety
export const POPULAR_GLOBAL_DESTINATIONS: StructuredLocation[] = [
  { locationName: "Paris", city: "Paris", state: "Île-de-France", country: "France", countryCode: "FR", latitude: 48.8566, longitude: 2.3522, formattedAddress: "Paris, Île-de-France, France" },
  { locationName: "Rome", city: "Rome", state: "Lazio", country: "Italy", countryCode: "IT", latitude: 41.9028, longitude: 12.4964, formattedAddress: "Rome, Lazio, Italy" },
  { locationName: "Barcelona", city: "Barcelona", state: "Catalonia", country: "Spain", countryCode: "ES", latitude: 41.3851, longitude: 2.1734, formattedAddress: "Barcelona, Catalonia, Spain" },
  { locationName: "Tokyo", city: "Tokyo", state: "Kanto", country: "Japan", countryCode: "JP", latitude: 35.6762, longitude: 139.6503, formattedAddress: "Tokyo, Japan" },
  { locationName: "New York", city: "New York", state: "New York", country: "United States", countryCode: "US", latitude: 40.7128, longitude: -74.006, formattedAddress: "New York, NY, United States" },
  { locationName: "London", city: "London", state: "Greater London", country: "United Kingdom", countryCode: "GB", latitude: 51.5074, longitude: -0.1278, formattedAddress: "London, England, United Kingdom" },
  { locationName: "Dubai", city: "Dubai", state: "Dubai", country: "United Arab Emirates", countryCode: "AE", latitude: 25.2048, longitude: 55.2708, formattedAddress: "Dubai, United Arab Emirates" },
  { locationName: "Istanbul", city: "Istanbul", state: "Marmara", country: "Turkey", countryCode: "TR", latitude: 41.0082, longitude: 28.9784, formattedAddress: "Istanbul, Turkey" },
  { locationName: "Bali", city: "Denpasar", state: "Bali", country: "Indonesia", countryCode: "ID", latitude: -8.4095, longitude: 115.1889, formattedAddress: "Bali, Indonesia" },
  { locationName: "Sydney", city: "Sydney", state: "New South Wales", country: "Australia", countryCode: "AU", latitude: -33.8688, longitude: 151.2093, formattedAddress: "Sydney, NSW, Australia" },
  { locationName: "Bucharest", city: "Bucharest", state: "Ilfov", country: "Romania", countryCode: "RO", latitude: 44.4268, longitude: 26.1025, formattedAddress: "Bucharest, Romania" },
  { locationName: "Cape Town", city: "Cape Town", state: "Western Cape", country: "South Africa", countryCode: "ZA", latitude: -33.9249, longitude: 18.4241, formattedAddress: "Cape Town, South Africa" },
  { locationName: "Amsterdam", city: "Amsterdam", state: "North Holland", country: "Netherlands", countryCode: "NL", latitude: 52.3676, longitude: 4.9041, formattedAddress: "Amsterdam, Netherlands" },
  { locationName: "Kyoto", city: "Kyoto", state: "Kansai", country: "Japan", countryCode: "JP", latitude: 35.0116, longitude: 135.7681, formattedAddress: "Kyoto, Japan" },
  { locationName: "Athens", city: "Athens", state: "Attica", country: "Greece", countryCode: "GR", latitude: 37.9838, longitude: 23.7275, formattedAddress: "Athens, Greece" },
  { locationName: "Riyadh", city: "Riyadh", state: "Riyadh Region", country: "Saudi Arabia", countryCode: "SA", latitude: 24.7136, longitude: 46.6753, formattedAddress: "Riyadh, Saudi Arabia" },
  { locationName: "Zurich", city: "Zurich", state: "Zurich", country: "Switzerland", countryCode: "CH", latitude: 47.3769, longitude: 8.5417, formattedAddress: "Zurich, Switzerland" },
  { locationName: "Milan", city: "Milan", state: "Lombardy", country: "Italy", countryCode: "IT", latitude: 45.4642, longitude: 9.19, formattedAddress: "Milan, Lombardy, Italy" },
];

/**
 * Searches locations using OpenStreetMap Nominatim API with fallback to popular global travel destinations.
 */
export async function searchLocations(query: string): Promise<StructuredLocation[]> {
  if (!query || query.trim().length < 2) {
    return POPULAR_GLOBAL_DESTINATIONS;
  }

  const cleanQuery = query.trim();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        cleanQuery
      )}&addressdetails=1&limit=8`,
      {
        headers: {
          "User-Agent": "HomyzTravelApp/1.0",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => {
          const addr = item.address || {};
          const city = addr.city || addr.town || addr.village || addr.municipality || item.name;
          const state = addr.state || addr.region || addr.county;
          const country = addr.country;
          const countryCode = addr.country_code ? addr.country_code.toUpperCase() : undefined;

          return {
            locationName: item.name || city || cleanQuery,
            city,
            state,
            country,
            countryCode,
            latitude: item.lat ? parseFloat(item.lat) : undefined,
            longitude: item.lon ? parseFloat(item.lon) : undefined,
            formattedAddress: item.display_name || `${city}, ${country}`,
          };
        });
      }
    }
  } catch {
    // Ignore network error / timeout and fallback to filter
  }

  // Fallback local match
  const q = cleanQuery.toLowerCase();
  return POPULAR_GLOBAL_DESTINATIONS.filter(
    (dest) =>
      dest.formattedAddress.toLowerCase().includes(q) ||
      dest.locationName.toLowerCase().includes(q) ||
      dest.country?.toLowerCase().includes(q)
  );
}

/**
 * Normalizes an arbitrary string location into a clean formatted string.
 */
export function formatLocationString(location?: string | null): string {
  if (!location) return "";
  return location.trim();
}
