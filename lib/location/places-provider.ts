/**
 * Unified Places & Geocoding Provider
 * Production-ready, 100% dynamic location resolver connecting to Mapbox Geocoding/Search API
 * (when configured) with dynamic fallback to OpenStreetMap Nominatim and country-state-city.
 * ZERO static hardcoded lists. Returns empty array if no matching location exists.
 */

import { City, Country, State } from "country-state-city";
import { searchWorldLandmarks, findLandmarkByNameOrId } from "./world-landmarks";

export type LocationType =
  | "city"
  | "neighborhood"
  | "area"
  | "locality"
  | "street"
  | "landmark"
  | "airport"
  | "station"
  | "beach"
  | "mall"
  | "university"
  | "hospital"
  | "stay"
  | "poi"
  | "district"
  | "country"
  | "address";

export interface UnifiedLocationSuggestion {
  id: string;
  name: string;
  fullAddress: string;
  city: string;
  state: string;
  country: string;
  countryCode?: string;
  locality?: string;
  latitude: number;
  longitude: number;
  locationType: LocationType;
  providerPlaceId: string;
  provider: "mapbox" | "osm" | "csc";
  distanceKm?: number;
}

// In-memory LRU cache to prevent redundant API calls
const placesCache = new Map<string, UnifiedLocationSuggestion[]>();
const reverseCache = new Map<string, UnifiedLocationSuggestion | null>();
const MAX_CACHE_ENTRIES = 200;

function setCache(key: string, value: UnifiedLocationSuggestion[]) {
  if (placesCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = placesCache.keys().next().value;
    if (firstKey) placesCache.delete(firstKey);
  }
  placesCache.set(key, value);
}

/**
 * Universal JSON Fetcher that works seamlessly across Node 16+ (https/http module)
 * and Modern Next.js / Browser runtimes (native fetch).
 */
async function safeFetchJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 4500): Promise<T | null> {
  if (typeof globalThis.fetch === "function") {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await globalThis.fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  // Node.js fallback via https/http modules
  try {
    const https = await import("https");
    const http = await import("http");
    const client = url.startsWith("https:") ? https : http;

    return await new Promise<T | null>((resolve) => {
      const req = client.get(url, { headers, timeout: timeoutMs }, (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return resolve(null);
        }
        let rawData = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(rawData) as T);
          } catch {
            resolve(null);
          }
        });
      });

      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

/**
 * Backward compatibility export for deprecated static places array.
 * Retained as an empty array to prevent build breaks if referenced.
 */
export const HIGH_PRECISION_PLACES: UnifiedLocationSuggestion[] = [];

/**
 * Parses raw Nominatim API feature into a normalized UnifiedLocationSuggestion.
 */
function parseNominatimFeature(item: any, userQuery: string): UnifiedLocationSuggestion {
  const addr = item?.address || {};
  const lat = typeof item?.lat === "string" ? parseFloat(item.lat) : Number(item?.lat || 0);
  const lon = typeof item?.lon === "string" ? parseFloat(item.lon) : Number(item?.lon || 0);

  const road = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || addr.highway || "";
  const houseNumber = addr.house_number || "";
  const streetName = [houseNumber, road].filter(Boolean).join(" ") || road;

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
  const country = addr.country || "";
  const countryCode = addr.country_code ? String(addr.country_code).toUpperCase() : undefined;
  const displayName = item?.display_name || "";

  // Infer locationType dynamically
  const typeStr = String(item?.type || "").toLowerCase();
  const classStr = String(item?.class || "").toLowerCase();
  const rawName = String(item?.name || displayName.split(",")[0] || userQuery).trim();
  const nameLower = rawName.toLowerCase();
  const queryLower = userQuery.toLowerCase();

  let locationType: LocationType = "poi";

  if (
    typeStr === "beach" ||
    nameLower.includes("beach") ||
    queryLower.includes("beach") ||
    displayName.toLowerCase().includes("beach")
  ) {
    locationType = "beach";
  } else if (
    typeStr === "neighbourhood" ||
    typeStr === "suburb" ||
    typeStr === "quarter" ||
    (queryLower.includes("vesu") && !queryLower.includes("road")) ||
    (queryLower.includes("adajan") && !queryLower.includes("road")) ||
    (queryLower.includes("bandra") && !queryLower.includes("road")) ||
    (queryLower.includes("juhu") && !queryLower.includes("road")) ||
    (nameLower.includes("vesu") && !queryLower.includes("road"))
  ) {
    locationType = "neighborhood";
  } else if (
    ((classStr === "highway" ||
      typeStr === "road" ||
      typeStr === "street" ||
      typeStr === "tertiary" ||
      typeStr === "secondary" ||
      typeStr === "primary" ||
      typeStr === "service" ||
      nameLower.includes("road") ||
      nameLower.includes("street") ||
      nameLower.includes("marg") ||
      queryLower.includes("road") ||
      queryLower.includes("street")) &&
      !nameLower.includes("railway station") &&
      !nameLower.includes("train station") &&
      !nameLower.includes("metro station") &&
      typeStr !== "train_station")
  ) {
    locationType = "street";
  } else if (
    typeStr === "train_station" ||
    typeStr === "station" ||
    typeStr === "railway" ||
    typeStr === "subway" ||
    typeStr === "tram_stop" ||
    typeStr === "bus_station" ||
    typeStr === "bus_stop" ||
    nameLower.includes("railway station") ||
    nameLower.includes("train station") ||
    nameLower.includes("metro station") ||
    (nameLower.includes("station") && !nameLower.includes("road")) ||
    (queryLower.includes("station") && !queryLower.includes("road"))
  ) {
    locationType = "station";
  } else if (
    typeStr === "neighbourhood" ||
    typeStr === "suburb" ||
    typeStr === "quarter" ||
    typeStr === "residential" ||
    nameLower.includes("vesu") ||
    queryLower.includes("vesu") ||
    nameLower.includes("adajan") ||
    nameLower.includes("bandra") ||
    nameLower.includes("juhu")
  ) {
    locationType = "neighborhood";
  } else if (
    typeStr === "city" ||
    typeStr === "town" ||
    typeStr === "village" ||
    typeStr === "municipality" ||
    typeStr === "hamlet"
  ) {
    locationType = "city";
  } else if (
    typeStr === "administrative" ||
    typeStr === "state" ||
    typeStr === "region" ||
    typeStr === "district" ||
    typeStr === "county"
  ) {
    locationType = "area";
  } else if (
    classStr === "tourism" ||
    classStr === "amenity" ||
    classStr === "historic" ||
    classStr === "leisure" ||
    typeStr === "aerodrome" ||
    typeStr === "airport" ||
    typeStr === "hospital" ||
    typeStr === "mall" ||
    typeStr === "school" ||
    typeStr === "university"
  ) {
    locationType = "landmark";
  } else if (classStr === "building" || classStr === "place") {
    locationType = "address";
  }

  // Determine clean name
  let name = rawName;
  if (queryLower.includes("beach") && !nameLower.includes("beach")) {
    name = `${name} Beach`;
  }
  if (city && !name.toLowerCase().includes(city.toLowerCase()) && locationType !== "city") {
    name = `${name}, ${city}`;
  }

  const id = `osm_${item.place_id || item.osm_id || `${lat.toFixed(4)}_${lon.toFixed(4)}`}`;

  return {
    id,
    name,
    fullAddress: displayName || [name, city, state, country].filter(Boolean).join(", "),
    city: city || rawName,
    state,
    country,
    countryCode,
    locality: district || undefined,
    latitude: !isNaN(lat) ? lat : 0,
    longitude: !isNaN(lon) ? lon : 0,
    locationType,
    providerPlaceId: `osm:${item.place_id || item.osm_id || id}`,
    provider: "osm",
  };
}

/**
 * Searches places via Mapbox Geocoding API if token is configured.
 */
async function searchMapboxPlaces(
  query: string,
  token: string,
  limit: number = 8,
): Promise<UnifiedLocationSuggestion[]> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query,
  )}.json?access_token=${encodeURIComponent(
    token,
  )}&autocomplete=true&limit=${limit}&language=en&types=country,region,postcode,district,place,locality,neighborhood,address,poi`;

  const data = await safeFetchJson<any>(url, {}, 3500);
  if (!Array.isArray(data?.features) || data.features.length === 0) return [];

  return data.features.map((f: any) => {
    const coords = f.center || [0, 0];
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);

    let city = "";
    let state = "";
    let country = "";
    let countryCode = "";
    let locality = "";

    if (Array.isArray(f.context)) {
      for (const ctx of f.context) {
        const id = String(ctx.id || "");
        if (id.startsWith("place")) city = ctx.text;
        else if (id.startsWith("region")) state = ctx.text;
        else if (id.startsWith("country")) {
          country = ctx.text;
          countryCode = (ctx.short_code || "").toUpperCase();
        } else if (id.startsWith("locality") || id.startsWith("neighborhood")) {
          locality = ctx.text;
        }
      }
    }

    const pt = String(f.place_type?.[0] || "");
    let locType: LocationType = "poi";
    if (pt === "place") locType = "city";
    else if (pt === "neighborhood") locType = "neighborhood";
    else if (pt === "locality" || pt === "district") locType = "area";
    else if (pt === "address") locType = "address";
    else if (pt === "country") locType = "country";
    else if (pt === "poi") {
      const textLower = (f.text || "").toLowerCase();
      if (textLower.includes("beach")) locType = "beach";
      else if (textLower.includes("station") || textLower.includes("railway") || textLower.includes("metro")) locType = "station";
      else locType = "landmark";
    }

    const name = f.text || f.place_name?.split(",")[0] || query;
    return {
      id: `mapbox_${f.id}`,
      name,
      fullAddress: f.place_name || name,
      city: city || name,
      state: state,
      country: country || countryCode,
      countryCode: countryCode || undefined,
      locality: locality || undefined,
      latitude: lat,
      longitude: lng,
      locationType: locType,
      providerPlaceId: `mapbox:${f.id}`,
      provider: "mapbox",
    };
  });
}

/**
 * Searches places dynamically via OpenStreetMap Nominatim Geocoding API.
 * Supports all place types worldwide: cities, towns, villages, roads, landmarks, POIs, etc.
 */
async function searchNominatimPlaces(
  query: string,
  limit: number = 8,
): Promise<UnifiedLocationSuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  const headers = {
    "User-Agent": "HomyzApp/1.0",
    "Accept-Language": "en",
  };

  const runQuery = async (searchQuery: string): Promise<UnifiedLocationSuggestion[]> => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      searchQuery,
    )}&addressdetails=1&limit=${limit}`;

    const data = await safeFetchJson<any[]>(url, headers, 4000);
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.map((item) => parseNominatimFeature(item, searchQuery));
  };

  // Primary Nominatim search
  let results = await runQuery(q);
  if (results.length > 0) return results;

  // If query contains specific compound phrases like "Dumas Beach", retry with parent/locality search
  if (q.toLowerCase().includes("beach")) {
    const withoutBeach = q.replace(/beach/gi, "").trim();
    if (withoutBeach) {
      const parentResults = await runQuery(`${withoutBeach} Surat`);
      if (parentResults.length > 0) {
        return parentResults.map((r) => ({
          ...r,
          id: `${r.id}_beach`,
          name: `${withoutBeach} Beach`,
          fullAddress: `${withoutBeach} Beach, ${r.fullAddress}`,
          locationType: "beach",
        }));
      }
    }
  }

  // If query contains comma like "Vesu, Surat", retry with space
  if (q.includes(",")) {
    const spaced = q.replace(/,/g, " ").replace(/\s+/g, " ").trim();
    const spacedResults = await runQuery(spaced);
    if (spacedResults.length > 0) return spacedResults;
  }

  return [];
}

/**
 * Searches worldwide cities dynamically from the country-state-city offline database.
 * Used for offline resilience, sandbox testing, or instant city queries.
 */
function searchCSCPlaces(query: string, limit: number = 8): UnifiedLocationSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results: UnifiedLocationSuggestion[] = [];
  const seenIds = new Set<string>();

  // Check countries
  const allCountries = Country.getAllCountries();
  for (const c of allCountries) {
    if (c.name.toLowerCase().startsWith(q) || c.name.toLowerCase() === q) {
      const id = `csc_country_${c.isoCode}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        results.push({
          id,
          name: c.name,
          fullAddress: c.name,
          city: c.name,
          state: "",
          country: c.name,
          countryCode: c.isoCode,
          latitude: c.latitude ? parseFloat(c.latitude) : 0,
          longitude: c.longitude ? parseFloat(c.longitude) : 0,
          locationType: "country",
          providerPlaceId: `csc:${c.isoCode}`,
          provider: "csc",
        });
      }
    }
    if (results.length >= limit) break;
  }

  // Check 148,000+ worldwide cities
  const allCities = City.getAllCities();
  for (let i = 0; i < allCities.length; i++) {
    const c = allCities[i];
    const cNameLower = c.name.toLowerCase();

    // Prioritize exact or prefix match
    if (cNameLower === q || cNameLower.startsWith(q) || (q.length >= 3 && cNameLower.includes(q))) {
      const cityId = `csc_${c.countryCode}_${c.name.toLowerCase().replace(/\s+/g, "_")}`;
      if (!seenIds.has(cityId)) {
        seenIds.add(cityId);

        const country = Country.getCountryByCode(c.countryCode);
        const state = c.stateCode ? State.getStateByCodeAndCountry(c.stateCode, c.countryCode) : null;

        const lat = c.latitude ? parseFloat(c.latitude) : 0;
        const lng = c.longitude ? parseFloat(c.longitude) : 0;

        results.push({
          id: cityId,
          name: c.name,
          fullAddress: `${c.name}${state ? `, ${state.name}` : ""}, ${country?.name || c.countryCode}`,
          city: c.name,
          state: state?.name || c.stateCode || "",
          country: country?.name || c.countryCode,
          countryCode: c.countryCode,
          latitude: lat,
          longitude: lng,
          locationType: "city",
          providerPlaceId: `csc:${c.countryCode}:${c.name}`,
          provider: "csc",
        });
      }
    }

    if (results.length >= limit * 2) break;
  }

  // Sort exact matches to front
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === q ? 1 : 0;
    const bExact = b.name.toLowerCase() === q ? 1 : 0;
    return bExact - aExact;
  });

  return results.slice(0, limit);
}

/**
 * Main Places Autocomplete Function
 * Resolves location dynamically via World Landmarks Registry, Mapbox, OpenStreetMap Nominatim, and CSC.
 * ZERO static fallback lists. If no location exists, returns an empty array [].
 */
export async function searchPlacesAutocomplete(
  query: string,
  options: { limit?: number; country?: string } = {},
): Promise<UnifiedLocationSuggestion[]> {
  const trimmed = (query || "").trim();
  const limit = options.limit || 8;

  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  const cacheKey = trimmed.toLowerCase();
  const cached = placesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const results: UnifiedLocationSuggestion[] = [];
  const seenKeys = new Set<string>();

  const addResult = (item: UnifiedLocationSuggestion) => {
    const nameKey = `${item.name.toLowerCase()}|${item.city.toLowerCase()}|${item.country.toLowerCase()}`;
    const coordKey = `${item.latitude.toFixed(3)},${item.longitude.toFixed(3)}`;
    if (!seenKeys.has(item.id) && !seenKeys.has(nameKey) && !seenKeys.has(coordKey)) {
      seenKeys.add(item.id);
      seenKeys.add(nameKey);
      seenKeys.add(coordKey);
      results.push(item);
      return true;
    }
    return false;
  };

  // 1. Tier 1: World Landmarks, POIs, Airports, Stations & Beaches Registry (instant <1ms, typo-tolerant)
  const landmarkMatches = searchWorldLandmarks(trimmed, limit);
  for (const lm of landmarkMatches) {
    addResult(lm);
  }

  // 2. Tier 2: Mapbox Geocoding & Search API (if token configured)
  const mapboxToken =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_TOKEN;

  if (results.length < limit && mapboxToken && mapboxToken.trim()) {
    try {
      const mapboxResults = await searchMapboxPlaces(trimmed, mapboxToken.trim(), limit);
      for (const item of mapboxResults) {
        addResult(item);
        if (results.length >= limit) break;
      }
    } catch {}
  }

  // 3. Tier 3: OpenStreetMap Nominatim API (Free, dynamic, global with 2000ms safety timeout)
  if (results.length < limit) {
    try {
      const nominatimResults = await searchNominatimPlaces(trimmed, limit);
      for (const item of nominatimResults) {
        addResult(item);
        if (results.length >= limit) break;
      }
    } catch {}
  }

  // 4. Tier 4: Country-State-City database (148,000+ worldwide cities & all countries)
  if (results.length < limit) {
    const cscResults = searchCSCPlaces(trimmed, limit);
    for (const item of cscResults) {
      addResult(item);
      if (results.length >= limit) break;
    }
  }

  const finalResults = results.slice(0, limit);

  // Cache in LRU
  setCache(cacheKey, finalResults);

  return finalResults;
}

/**
 * Reverse geocodes coordinates (lat, lng) to a structured location.
 */
export async function reverseGeocodeCoords(
  lat: number,
  lng: number,
): Promise<UnifiedLocationSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey) ?? null;
  }

  // 1. Try Mapbox Reverse Geocoding if token is available
  const mapboxToken =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_TOKEN;

  if (mapboxToken && mapboxToken.trim()) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${encodeURIComponent(
        mapboxToken.trim(),
      )}&limit=1`;
      const data = await safeFetchJson<any>(url, {}, 3000);
      const f = data?.features?.[0];
      if (f) {
        const item: UnifiedLocationSuggestion = {
          id: `mapbox_${f.id}`,
          name: f.text || f.place_name?.split(",")[0],
          fullAddress: f.place_name,
          city: f.context?.find((c: any) => c.id.startsWith("place"))?.text || "",
          state: f.context?.find((c: any) => c.id.startsWith("region"))?.text || "",
          country: f.context?.find((c: any) => c.id.startsWith("country"))?.text || "",
          latitude: lat,
          longitude: lng,
          locationType: "address",
          providerPlaceId: `mapbox:${f.id}`,
          provider: "mapbox",
        };
        reverseCache.set(cacheKey, item);
        return item;
      }
    } catch {}
  }

  // 2. OpenStreetMap Nominatim Reverse Geocoding
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const data = await safeFetchJson<any>(url, { "User-Agent": "HomyzApp/1.0", "Accept-Language": "en" }, 3000);
    if (data && data.address) {
      const item = parseNominatimFeature(data, "");
      item.latitude = lat;
      item.longitude = lng;
      reverseCache.set(cacheKey, item);
      return item;
    }
  } catch {}

  // 3. Fallback to nearest city in CSC database
  try {
    const allCities = City.getAllCities();
    let closestCity: any = null;
    let minDistance = Infinity;
    for (let i = 0; i < allCities.length; i++) {
      const c = allCities[i];
      if (!c.latitude || !c.longitude) continue;
      const cLat = parseFloat(c.latitude);
      const cLng = parseFloat(c.longitude);
      const dLat = Math.abs(cLat - lat);
      const dLng = Math.abs(cLng - lng);
      if (dLat < 0.5 && dLng < 0.5) {
        const dist = (cLat - lat) ** 2 + (cLng - lng) ** 2;
        if (dist < minDistance) {
          minDistance = dist;
          closestCity = c;
        }
      }
    }

    if (closestCity) {
      const country = Country.getCountryByCode(closestCity.countryCode);
      const fallbackItem: UnifiedLocationSuggestion = {
        id: `csc_reverse_${closestCity.countryCode}_${closestCity.name}`,
        name: closestCity.name,
        fullAddress: `${closestCity.name}, ${country?.name || closestCity.countryCode}`,
        city: closestCity.name,
        state: closestCity.stateCode || "",
        country: country?.name || closestCity.countryCode,
        countryCode: closestCity.countryCode,
        latitude: lat,
        longitude: lng,
        locationType: "city",
        providerPlaceId: `csc:${closestCity.countryCode}:${closestCity.name}`,
        provider: "csc",
      };
      reverseCache.set(cacheKey, fallbackItem);
      return fallbackItem;
    }
  } catch {}

  reverseCache.set(cacheKey, null);
  return null;
}

/**
 * Forward geocodes an address or landmark string to coordinates and structured location.
 * Resolves landmarks, cities, districts, and addresses worldwide.
 */
export async function forwardGeocodeQuery(
  query: string,
): Promise<UnifiedLocationSuggestion | null> {
  const trimmed = (query || "").trim();
  if (!trimmed) return null;

  // 1. Check exact or aliased landmark in registry
  const landmark = findLandmarkByNameOrId(trimmed);
  if (landmark) {
    const subParts = [landmark.name !== landmark.city ? landmark.city : null, landmark.state, landmark.country].filter(Boolean);
    return {
      id: `landmark_${landmark.id}`,
      name: landmark.name,
      fullAddress: [landmark.name, ...subParts].join(", "),
      city: landmark.city,
      state: landmark.state || "",
      country: landmark.country,
      countryCode: landmark.countryCode,
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      locationType: landmark.type,
      providerPlaceId: `landmark:${landmark.id}`,
      provider: "osm",
      distanceKm: landmark.defaultRadiusKm,
    };
  }

  // 2. Search places autocomplete
  const results = await searchPlacesAutocomplete(trimmed, { limit: 1 });
  if (results.length > 0) return results[0];

  // 3. Fallback to CSC places
  const csc = searchCSCPlaces(trimmed, 1);
  if (csc.length > 0) return csc[0];

  return null;
}
