import { City, Country, State } from "country-state-city";

export interface CanonicalDestinationInput {
  name: string;
  countryCode: string;
  countryName?: string | null;
  regionName?: string | null;
  regionCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  providerPlaceId?: string | null;
}

export interface CanonicalDestinationResolved {
  canonicalKey: string;
  name: string;
  normalizedName: string;
  countryCode: string;
  countryName: string;
  regionName: string | null;
  regionCode: string | null;
  latitude: number | null;
  longitude: number | null;
  providerPlaceId: string | null;
}

/**
 * Normalizes text for reliable matching (trims, collapses spaces, removes diacritics, lowercases).
 */
export function normalizeDestinationText(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Builds a deterministic non-null canonical key that safely avoids PostgreSQL nullable-unique semantics.
 * Format: `<COUNTRY_CODE>:<NORMALIZED_REGION>:<NORMALIZED_CITY>`
 * Example: `AE:dubai:dubai` or `US:tx:paris` vs `FR:ile-de-france:paris`
 */
export function buildCanonicalDestinationKey(opts: {
  countryCode: string;
  normalizedName: string;
  regionCode?: string | null;
  regionName?: string | null;
}): string {
  const cc = (opts.countryCode || "").trim().toUpperCase();
  const city = normalizeDestinationText(opts.normalizedName);
  const reg = opts.regionCode
    ? normalizeDestinationText(opts.regionCode)
    : opts.regionName
      ? normalizeDestinationText(opts.regionName)
      : "_";
  return `${cc}:${reg}:${city}`;
}

/**
 * Resolves standard metadata for a destination using ISO country data and geographic lookups.
 */
export function normalizeCanonicalDestination(
  input: CanonicalDestinationInput,
): CanonicalDestinationResolved {
  const normalizedCountryCode = (input.countryCode || "").trim().toUpperCase();
  const normalizedCity = normalizeDestinationText(input.name);

  // Authoritative country lookup
  const countryObj = Country.getCountryByCode(normalizedCountryCode);
  const canonicalCountryName =
    countryObj?.name || input.countryName?.trim() || normalizedCountryCode;

  // Title-cased display city name
  const displayName = input.name.trim();

  // Region resolution
  let regionName = input.regionName?.trim() || null;
  const regionCode = input.regionCode?.trim()?.toUpperCase() || null;

  if (regionCode && !regionName && countryObj) {
    const stateObj = State.getStateByCodeAndCountry(regionCode, normalizedCountryCode);
    if (stateObj) {
      regionName = stateObj.name;
    }
  }

  // Canonical key that isolates homonyms across states/countries
  const canonicalKey = buildCanonicalDestinationKey({
    countryCode: normalizedCountryCode,
    normalizedName: normalizedCity,
    regionCode,
    regionName,
  });

  return {
    canonicalKey,
    name: displayName,
    normalizedName: normalizedCity,
    countryCode: normalizedCountryCode,
    countryName: canonicalCountryName,
    regionName,
    regionCode,
    latitude: input.latitude ?? (countryObj?.latitude ? parseFloat(countryObj.latitude) : null),
    longitude: input.longitude ?? (countryObj?.longitude ? parseFloat(countryObj.longitude) : null),
    providerPlaceId: input.providerPlaceId?.trim() || null,
  };
}

/**
 * Searches the authoritative global dataset from country-state-city for city/destination matches.
 */
export function searchWorldDestinations(
  query: string,
  limit = 10,
): CanonicalDestinationResolved[] {
  const q = normalizeDestinationText(query);
  if (!q || q.length < 1) return [];

  const allCities = City.getAllCities();
  const results: CanonicalDestinationResolved[] = [];
  const seenKeys = new Set<string>();

  // 1. Exact or prefix match
  for (let i = 0; i < allCities.length && results.length < limit; i++) {
    const c = allCities[i];
    const cNorm = normalizeDestinationText(c.name);

    if (cNorm === q || cNorm.startsWith(q) || cNorm.includes(q)) {
      const countryObj = Country.getCountryByCode(c.countryCode);
      const stateObj = c.stateCode
        ? State.getStateByCodeAndCountry(c.stateCode, c.countryCode)
        : null;

      const resolved = normalizeCanonicalDestination({
        name: c.name,
        countryCode: c.countryCode,
        countryName: countryObj?.name,
        regionName: stateObj?.name,
        regionCode: c.stateCode,
        latitude: c.latitude ? parseFloat(c.latitude) : null,
        longitude: c.longitude ? parseFloat(c.longitude) : null,
      });

      if (!seenKeys.has(resolved.canonicalKey)) {
        seenKeys.add(resolved.canonicalKey);
        results.push(resolved);
      }
    }
  }

  return results;
}

