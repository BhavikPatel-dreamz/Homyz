import { GuidebookCategoryId } from "@/lib/validation/guidebook";

export interface PlaceSearchResult {
  id: string;
  name: string;
  category: GuidebookCategoryId;
  address: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  placeProviderId: string;
  distanceKm?: number;
  relativeDistance?: string;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  osm_type: string;
  osm_id: string | number;
  name?: string;
  display_name: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
}

/**
 * Calculates straight-line distance in kilometers using the Haversine formula.
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance into an intuitive relative travel time or distance string.
 */
export function formatRelativeDistance(distanceKm: number): string {
  if (distanceKm < 0.2) return "2 min walk";
  if (distanceKm < 1.2) {
    const walkMins = Math.max(3, Math.round(distanceKm * 12));
    return `${walkMins} min walk`;
  }
  if (distanceKm < 6) {
    const driveMins = Math.max(3, Math.round(distanceKm * 2.5));
    return `${driveMins} min drive`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

/**
 * Auto-detects a guidebook category from OpenStreetMap properties.
 */
export function detectCategoryFromOsm(
  type?: string,
  osmClass?: string,
  extraTags?: Record<string, string>
): GuidebookCategoryId {
  const t = (type || "").toLowerCase();
  const c = (osmClass || "").toLowerCase();
  const amenity = (extraTags?.amenity || "").toLowerCase();
  const shop = (extraTags?.shop || "").toLowerCase();
  const tourism = (extraTags?.tourism || "").toLowerCase();
  const leisure = (extraTags?.leisure || "").toLowerCase();

  // Coffee & Cafes
  if (
    t.includes("cafe") ||
    t.includes("coffee") ||
    amenity === "cafe" ||
    shop === "coffee" ||
    shop === "bakery"
  ) {
    return "COFFEE_AND_CAFES";
  }

  // Food & Dining
  if (
    t.includes("restaurant") ||
    c === "restaurant" ||
    amenity === "restaurant" ||
    amenity === "fast_food" ||
    amenity === "food_court"
  ) {
    return "FOOD_AND_DRINK";
  }

  // Sightseeing & Culture
  if (
    tourism === "museum" ||
    tourism === "attraction" ||
    tourism === "gallery" ||
    tourism === "artwork" ||
    tourism === "monument" ||
    t.includes("museum") ||
    t.includes("monument") ||
    t.includes("historic")
  ) {
    return "SIGHTSEEING";
  }

  // Outdoors & Nature
  if (
    leisure === "park" ||
    leisure === "garden" ||
    leisure === "nature_reserve" ||
    tourism === "viewpoint" ||
    t.includes("park") ||
    t.includes("garden") ||
    t.includes("beach")
  ) {
    return "OUTDOORS";
  }

  // Shopping
  if (
    shop === "mall" ||
    shop === "supermarket" ||
    shop === "clothes" ||
    shop === "department_store" ||
    c === "shop" ||
    t.includes("mall")
  ) {
    if (shop === "supermarket" || shop === "convenience" || shop === "pharmacy") {
      return "ESSENTIALS";
    }
    return "SHOPPING";
  }

  // Essentials
  if (
    amenity === "pharmacy" ||
    amenity === "bank" ||
    amenity === "atm" ||
    amenity === "hospital" ||
    amenity === "clinic" ||
    t.includes("pharmacy") ||
    t.includes("hospital") ||
    t.includes("supermarket")
  ) {
    return "ESSENTIALS";
  }

  // Nightlife
  if (
    amenity === "bar" ||
    amenity === "pub" ||
    amenity === "nightclub" ||
    t.includes("bar") ||
    t.includes("pub")
  ) {
    return "NIGHTLIFE";
  }

  // Entertainment
  if (
    amenity === "cinema" ||
    amenity === "theatre" ||
    leisure === "bowling_alley" ||
    t.includes("cinema") ||
    t.includes("theatre")
  ) {
    return "ENTERTAINMENT";
  }

  // Wellness
  if (
    leisure === "fitness_centre" ||
    leisure === "sports_centre" ||
    shop === "beauty" ||
    t.includes("gym") ||
    t.includes("spa")
  ) {
    return "WELLNESS";
  }

  return "LOCAL_FAVORITE";
}

/**
 * Searches for places via OpenStreetMap Nominatim with category auto-detection and distance calculation.
 */
export async function searchPlaces(
  query: string,
  centerLat?: number | null,
  centerLng?: number | null
): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&addressdetails=1&extratags=1&limit=8`,
      {
        headers: {
          "User-Agent": "HomyzGuidebook/1.0",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return (data as NominatimSearchResult[]).map((item) => {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const addr = item.address || {};
          const street = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || "";
          const city = addr.city || addr.town || addr.municipality || addr.village || "";
          const country = addr.country || "";
          const shortAddress = [street, city].filter(Boolean).join(", ") || item.display_name;
          const category = detectCategoryFromOsm(item.type, item.class, item.extratags);

          let distanceKm: number | undefined;
          let relativeDistance: string | undefined;
          if (centerLat != null && centerLng != null && !isNaN(lat) && !isNaN(lon)) {
            distanceKm = calculateDistance(centerLat, centerLng, lat, lon);
            relativeDistance = formatRelativeDistance(distanceKm);
          }

          return {
            id: `osm_${item.osm_type}_${item.osm_id}`,
            name: item.name || item.display_name.split(",")[0] || trimmed,
            category,
            address: shortAddress,
            city,
            country,
            latitude: lat,
            longitude: lon,
            placeProviderId: `${item.osm_type}:${item.osm_id}`,
            distanceKm,
            relativeDistance,
          };
        });
      }
    }
  } catch {
    // Network / timeout fallback
  }

  return [];
}
