import { findLandmarkByNameOrId } from "./world-landmarks";
import {
  forwardGeocodeQuery,
  reverseGeocodeCoords,
  type LocationType,
  type UnifiedLocationSuggestion,
} from "./places-provider";

export interface SearchContext {
  query: string;
  placeId?: string | null;
  placeType: LocationType | "general";
  displayName: string;
  latitude?: number | null;
  longitude?: number | null;
  boundingBox?: { neLat: number; neLng: number; swLat: number; swLng: number } | null;
  neighborhood?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number;
  adults?: number;
  children?: number;
  infants?: number;
  pets?: number;
  radiusKm?: number;
}

export interface RawSearchInput {
  query?: string | null;
  destination?: string | null;
  city?: string | null;
  placeName?: string | null;
  placeId?: string | null;
  locationType?: string | null;
  fullAddress?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  radius?: number | string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | string | null;
  adults?: number | string | null;
  children?: number | string | null;
  infants?: number | string | null;
  pets?: number | string | null;
}

function parseNumber(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim()) {
    const parsed = parseFloat(val.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeText(val?: string | null): string | null {
  const cleaned = (val || "").trim();
  if (!cleaned) return null;
  const blocked = new Set([
    "Nearby",
    "Recent searches",
    "Suggested destinations",
    "Current location",
    "undefined",
    "null",
  ]);
  return blocked.has(cleaned) ? null : cleaned;
}

/**
 * Resolves any raw user search input into a complete, structured, normalized SearchContext.
 * Supports world landmarks, cities, districts, coordinates, dates, and guests without hardcoding.
 */
export async function resolveSearchContext(raw: RawSearchInput): Promise<SearchContext | null> {
  const explicitQuery = normalizeText(raw.destination || raw.query || raw.placeName || raw.city);
  const lat = parseNumber(raw.lat);
  const lng = parseNumber(raw.lng);
  const radiusKm = parseNumber(raw.radius);
  const checkIn = normalizeText(raw.checkIn);
  const checkOut = normalizeText(raw.checkOut);

  const adults = parseNumber(raw.adults) ?? 0;
  const children = parseNumber(raw.children) ?? 0;
  const infants = parseNumber(raw.infants) ?? 0;
  const pets = parseNumber(raw.pets) ?? 0;
  const rawGuests = parseNumber(raw.guests);
  const totalGuests = Math.max(1, rawGuests ?? (adults + children > 0 ? adults + children : 1));

  // If there's neither a query nor coordinates nor dates, no search context exists
  if (!explicitQuery && (lat == null || lng == null) && !checkIn && !checkOut) {
    return null;
  }

  let resolvedPlaceType: LocationType | "general" = (normalizeText(raw.locationType) as LocationType) || "general";
  let resolvedDisplayName = explicitQuery || (lat != null && lng != null ? "Nearby stays" : "Stays");
  let resolvedCity = normalizeText(raw.city);
  let resolvedDistrict: string | null = null;
  let resolvedNeighborhood: string | null = null;
  let resolvedState: string | null = null;
  let resolvedCountry: string | null = null;
  let resolvedCountryCode: string | null = null;
  let resolvedLat: number | null = lat;
  let resolvedLng: number | null = lng;
  let resolvedPlaceId: string | null = normalizeText(raw.placeId);

  // 1. If explicit query provided, check if it matches a known World Landmark or City
  if (explicitQuery) {
    const landmark = findLandmarkByNameOrId(explicitQuery);
    if (landmark) {
      resolvedPlaceType = landmark.type;
      resolvedDisplayName = landmark.name;
      resolvedCity = landmark.city;
      resolvedState = landmark.state || null;
      resolvedCountry = landmark.country;
      resolvedCountryCode = landmark.countryCode;
      resolvedLat = landmark.latitude;
      resolvedLng = landmark.longitude;
      resolvedPlaceId = `landmark:${landmark.id}`;
    } else {
      // Forward geocode if coordinates are missing or need enrichment
      try {
        const geocoded = await forwardGeocodeQuery(explicitQuery);
        if (geocoded) {
          resolvedPlaceType = geocoded.locationType || resolvedPlaceType;
          resolvedDisplayName = geocoded.name || resolvedDisplayName;
          resolvedCity = geocoded.city || resolvedCity;
          resolvedDistrict = geocoded.locality || null;
          resolvedState = geocoded.state || null;
          resolvedCountry = geocoded.country || null;
          resolvedCountryCode = geocoded.countryCode || null;
          if (resolvedLat == null || resolvedLng == null) {
            resolvedLat = geocoded.latitude;
            resolvedLng = geocoded.longitude;
          }
          if (!resolvedPlaceId) {
            resolvedPlaceId = geocoded.providerPlaceId || geocoded.id;
          }
        }
      } catch {}
    }
  }

  // 2. If coordinates are available but city / country are missing, reverse geocode
  if (resolvedLat != null && resolvedLng != null && (!resolvedCity || !resolvedCountry)) {
    try {
      const rev = await reverseGeocodeCoords(resolvedLat, resolvedLng);
      if (rev) {
        resolvedCity = resolvedCity || rev.city || null;
        resolvedDistrict = resolvedDistrict || rev.locality || null;
        resolvedState = resolvedState || rev.state || null;
        resolvedCountry = resolvedCountry || rev.country || null;
        resolvedCountryCode = resolvedCountryCode || rev.countryCode || null;
      }
    } catch {}
  }

  // 3. Fallback: Parse query comma separation (e.g. "Dumas, Surat" or "Marina, Dubai")
  if (explicitQuery && !resolvedDistrict && explicitQuery.includes(",")) {
    const parts = explicitQuery.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      resolvedNeighborhood = parts[0];
      if (!resolvedCity) resolvedCity = parts[1];
    }
  }

  return {
    query: explicitQuery || resolvedCity || "Stays",
    placeId: resolvedPlaceId,
    placeType: resolvedPlaceType,
    displayName: resolvedDisplayName,
    latitude: resolvedLat,
    longitude: resolvedLng,
    neighborhood: resolvedNeighborhood,
    district: resolvedDistrict,
    city: resolvedCity,
    state: resolvedState,
    country: resolvedCountry,
    countryCode: resolvedCountryCode,
    checkIn: checkIn || null,
    checkOut: checkOut || null,
    guests: totalGuests,
    adults: adults || totalGuests,
    children,
    infants,
    pets,
    radiusKm: radiusKm ?? undefined,
  };
}

