import { City, Country, State } from "country-state-city";

/**
 * Dynamic Global Cities & Location Search Engine powered by `country-state-city`.
 * Provides Airbnb-style destination and granular place / neighborhood lists for any city in the world.
 */

export type SuggestionType = "city" | "neighborhood" | "district" | "country" | "stay";

export interface WorldCity {
  city: string;
  region?: string;
  country: string;
  countryCode?: string;
  type?: SuggestionType;
  subtitle?: string;
  badge?: string;
  distanceKm?: number;
  fullLabel?: string;
}

export interface PlaceSuggestionItem {
  id: string;
  name: string;
  fullLabel: string;
  city: string;
  region?: string;
  country: string;
  countryCode?: string;
  type: SuggestionType;
  subtitle?: string;
  badge?: string;
  distanceKm?: number;
}

export interface AirbnbDestinationResult {
  primary?: PlaceSuggestionItem;
  places: PlaceSuggestionItem[];
  districts: PlaceSuggestionItem[];
  allSuggestions: PlaceSuggestionItem[];
}

/**
 * Well-known urban localities and neighborhoods for major metropolitan hubs
 * to complement municipal data with standard local search terminology.
 */
const METRO_URBAN_LOCALITIES: Record<string, string[]> = {
  surat: [
    "Adajan",
    "Vesu",
    "Piplod",
    "Varachha",
    "Dumas Road",
    "Pal",
    "Katargam",
    "Rander",
    "Athwa",
    "Ghod Dod Road",
    "City Light",
    "Althan",
    "Udhna",
  ],
  mumbai: [
    "Bandra",
    "Juhu",
    "Andheri",
    "Powai",
    "Colaba",
    "Worli",
    "Marine Drive",
    "Dadar",
    "Chembur",
    "Malad",
    "Borivali",
    "Ghatkopar",
    "Lower Parel",
    "Santacruz",
    "Khar",
  ],
  riyadh: [
    "Al Olaya",
    "Al Malqa",
    "Hittin",
    "Diplomatic Quarter",
    "Al Nakheel",
    "Al Yasmin",
    "Al Sulaimaniyah",
    "Al Sahafah",
    "Al Murabba",
  ],
  dubai: [
    "Downtown Dubai",
    "Dubai Marina",
    "Palm Jumeirah",
    "Business Bay",
    "Jumeirah Beach Residence",
    "Deira",
    "Al Barsha",
    "Jumeirah Lakes Towers",
  ],
  london: [
    "Westminster",
    "Soho",
    "Camden Town",
    "Chelsea",
    "Kensington",
    "Greenwich",
    "Shoreditch",
    "Canary Wharf",
    "Notting Hill",
    "Covent Garden",
  ],
  paris: [
    "Montmartre",
    "Le Marais",
    "Latin Quarter",
    "Saint-Germain-des-Prés",
    "Champs-Élysées",
    "Belleville",
    "Montparnasse",
    "Bastille",
  ],
  "new york": [
    "Manhattan",
    "Brooklyn",
    "Queens",
    "Williamsburg",
    "SoHo",
    "Greenwich Village",
    "Upper East Side",
    "Chelsea",
    "DUMBO",
  ],
  delhi: [
    "Connaught Place",
    "Hauz Khas",
    "South Extension",
    "Vasant Kunj",
    "Saket",
    "Karol Bagh",
    "Chandni Chowk",
    "Dwarka",
    "Rohini",
  ],
  bangalore: [
    "Indiranagar",
    "Koramangala",
    "Whitefield",
    "HSR Layout",
    "Jayanagar",
    "Electronic City",
    "MG Road",
    "Malleshwaram",
  ],
};

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Priority country codes for common homonymous global cities (e.g. London UK vs London Ontario).
 */
const HOMONYM_COUNTRY_PREFERENCE: Record<string, string> = {
  london: "GB",
  paris: "FR",
  rome: "IT",
  barcelona: "ES",
  sydney: "AU",
  melbourne: "AU",
  toronto: "CA",
  vancouver: "CA",
  cairo: "EG",
  dublin: "IE",
  berlin: "DE",
  amsterdam: "NL",
  madrid: "ES",
  vienna: "AT",
};

/**
 * Resolves places, neighborhoods, and districts within or surrounding any city worldwide.
 */
export function getPlacesInCity(
  cityName: string,
  countryCode?: string,
  limit: number = 14,
): AirbnbDestinationResult {
  const q = (cityName || "").trim().toLowerCase();
  if (!q || q.length < 2) {
    return { places: [], districts: [], allSuggestions: [] };
  }

  const allCities = City.getAllCities();
  const preferredCountry = countryCode || HOMONYM_COUNTRY_PREFERENCE[q];

  // 1. Locate primary city (respecting preferred country for homonyms)
  let targetCity = allCities.find((c) => {
    if (c.name.toLowerCase() !== q) return false;
    if (preferredCountry && c.countryCode !== preferredCountry) return false;
    return true;
  });

  if (!targetCity) {
    targetCity =
      allCities.find((c) => c.name.toLowerCase() === q) ||
      allCities.find((c) => c.name.toLowerCase().startsWith(q));
  }

  if (!targetCity) {
    return { places: [], districts: [], allSuggestions: [] };
  }

  const countryObj = Country.getCountryByCode(targetCity.countryCode);
  const stateObj = targetCity.stateCode
    ? State.getStateByCodeAndCountry(targetCity.stateCode, targetCity.countryCode)
    : null;

  const countryName = countryObj?.name || targetCity.countryCode;
  const stateName = stateObj?.name || targetCity.stateCode || "";

  const primaryItem: PlaceSuggestionItem = {
    id: `city-${targetCity.countryCode}-${targetCity.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: targetCity.name,
    fullLabel: `${targetCity.name}${stateName ? `, ${stateName}` : ""}, ${countryName}`,
    city: targetCity.name,
    region: stateName || undefined,
    country: countryName,
    countryCode: targetCity.countryCode,
    type: "city",
    subtitle: `Explore all stays in ${targetCity.name}`,
    badge: "City",
  };

  const places: PlaceSuggestionItem[] = [];
  const districts: PlaceSuggestionItem[] = [];
  const seenPlaceNames = new Set<string>([targetCity.name.toLowerCase()]);

  // 2. Add well-known urban localities if available for this metropolis
  const cityKey = targetCity.name.toLowerCase();
  const knownLocalities = METRO_URBAN_LOCALITIES[cityKey] || [];

  for (const locName of knownLocalities) {
    const locKey = locName.toLowerCase();
    if (!seenPlaceNames.has(locKey)) {
      seenPlaceNames.add(locKey);
      places.push({
        id: `place-${targetCity.name.toLowerCase()}-${locKey.replace(/\s+/g, "-")}`,
        name: locName,
        fullLabel: `${locName}, ${targetCity.name}`,
        city: targetCity.name,
        region: stateName || undefined,
        country: countryName,
        countryCode: targetCity.countryCode,
        type: "neighborhood",
        subtitle: `Neighborhood in ${targetCity.name}`,
        badge: "Neighborhood",
      });
    }
  }

  // 3. Dynamic geo-spatial radius lookup (<35km) across all worldwide cities in that country
  if (targetCity.latitude && targetCity.longitude) {
    const lat1 = parseFloat(targetCity.latitude);
    const lon1 = parseFloat(targetCity.longitude);

    if (!isNaN(lat1) && !isNaN(lon1)) {
      const latDelta = 35 / 111;
      const lonDelta = 35 / (111 * Math.cos((lat1 * Math.PI) / 180));

      for (let i = 0; i < allCities.length; i++) {
        const c = allCities[i];
        if (c.countryCode !== targetCity.countryCode) continue;

        const cNameLower = c.name.toLowerCase();
        if (cNameLower === cityKey || seenPlaceNames.has(cNameLower)) continue;

        if (!c.latitude || !c.longitude) continue;
        const clat = parseFloat(c.latitude);
        const clon = parseFloat(c.longitude);
        if (
          clat >= lat1 - latDelta &&
          clat <= lat1 + latDelta &&
          clon >= lon1 - lonDelta &&
          clon <= lon1 + lonDelta
        ) {
          const dist = calculateHaversineDistance(lat1, lon1, clat, clon);
          if (dist <= 35) {
            seenPlaceNames.add(cNameLower);

            const isDistrict =
              cNameLower.includes("suburban") ||
              cNameLower.includes("district") ||
              cNameLower.includes("division") ||
              dist > 18;

            const cleanName = c.name
              .replace(new RegExp(`,?\\s*${targetCity.name}$`, "i"), "")
              .trim();

            const item: PlaceSuggestionItem = {
              id: `geo-${c.countryCode}-${cleanName.toLowerCase().replace(/\s+/g, "-")}`,
              name: cleanName,
              fullLabel: `${cleanName}, ${targetCity.name}`,
              city: targetCity.name,
              region: stateName || undefined,
              country: countryName,
              countryCode: targetCity.countryCode,
              type: isDistrict ? "district" : "neighborhood",
              subtitle: isDistrict
                ? `District in ${targetCity.name} region • ${Math.round(dist)} km`
                : `Area in ${targetCity.name} • ${Math.round(dist * 10) / 10} km`,
              badge: isDistrict ? "District" : "Area",
              distanceKm: Math.round(dist * 10) / 10,
            };

            if (isDistrict) {
              districts.push(item);
            } else {
              places.push(item);
            }
          }
        }
      }
    }
  }

  // Sort places and districts by distance if known
  places.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  districts.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  const trimmedPlaces = places.slice(0, limit);
  const trimmedDistricts = districts.slice(0, 6);

  return {
    primary: primaryItem,
    places: trimmedPlaces,
    districts: trimmedDistricts,
    allSuggestions: [primaryItem, ...trimmedPlaces, ...trimmedDistricts],
  };
}

/**
 * Searches worldwide cities and countries dynamically using the `country-state-city` library.
 * Prioritizes exact matches, then prefix matches, and includes country-level matches.
 */
export function searchWorldCities(query: string, limit: number = 10): WorldCity[] {
  const q = (query || "").trim().toLowerCase();
  if (!q || q.length < 2) return [];

  // Check if query matches a known urban locality directly (e.g. "Bandra", "Adajan", "Vesu", "Chelsea")
  for (const [parentCity, localities] of Object.entries(METRO_URBAN_LOCALITIES)) {
    for (const loc of localities) {
      if (loc.toLowerCase().startsWith(q) || loc.toLowerCase() === q) {
        const placesBundle = getPlacesInCity(parentCity);
        if (placesBundle.primary) {
          const directPlace = placesBundle.places.find(
            (p) => p.name.toLowerCase() === loc.toLowerCase(),
          );
          if (directPlace) {
            return [
              {
                city: directPlace.fullLabel,
                region: directPlace.region,
                country: directPlace.country,
                countryCode: directPlace.countryCode,
                type: "neighborhood",
                subtitle: directPlace.subtitle,
                badge: "Neighborhood",
                fullLabel: directPlace.fullLabel,
              },
              {
                city: placesBundle.primary.fullLabel,
                region: placesBundle.primary.region,
                country: placesBundle.primary.country,
                countryCode: placesBundle.primary.countryCode,
                type: "city",
                subtitle: placesBundle.primary.subtitle,
                badge: "City",
                fullLabel: placesBundle.primary.fullLabel,
              },
            ];
          }
        }
      }
    }
  }

  const exactMatches: WorldCity[] = [];
  const prefixMatches: WorldCity[] = [];
  const seen = new Set<string>();

  // 1. Match countries dynamically (e.g. "India", "Saudi Arabia", "United Arab Emirates", etc.)
  const allCountries = Country.getAllCountries();
  for (let i = 0; i < allCountries.length; i++) {
    const c = allCountries[i];
    const countryName = c.name.toLowerCase();
    if (countryName.startsWith(q)) {
      const key = `country:${c.isoCode}`;
      if (!seen.has(key)) {
        seen.add(key);
        exactMatches.push({
          city: c.name,
          region: "Country",
          country: c.name,
          countryCode: c.isoCode,
          type: "country",
          badge: "Country",
          fullLabel: c.name,
        });
      }
    }
    if (exactMatches.length >= 2) break;
  }

  // 2. If the query matches a city name, fetch its complete Airbnb places bundle!
  const placesBundle = getPlacesInCity(q);
  if (placesBundle.primary) {
    const p = placesBundle.primary;
    exactMatches.push({
      city: p.city,
      region: p.region,
      country: p.country,
      countryCode: p.countryCode,
      type: "city",
      subtitle: p.subtitle,
      badge: "City",
      fullLabel: p.fullLabel,
    });

    for (const pl of placesBundle.places.slice(0, 8)) {
      prefixMatches.push({
        city: pl.fullLabel,
        region: pl.region,
        country: pl.country,
        countryCode: pl.countryCode,
        type: "neighborhood",
        subtitle: pl.subtitle,
        badge: pl.badge || "Neighborhood",
        distanceKm: pl.distanceKm,
        fullLabel: pl.fullLabel,
      });
    }

    for (const dist of placesBundle.districts.slice(0, 4)) {
      prefixMatches.push({
        city: dist.fullLabel,
        region: dist.region,
        country: dist.country,
        countryCode: dist.countryCode,
        type: "district",
        subtitle: dist.subtitle,
        badge: dist.badge || "District",
        distanceKm: dist.distanceKm,
        fullLabel: dist.fullLabel,
      });
    }

    return [...exactMatches, ...prefixMatches].slice(0, limit);
  }

  // 3. Fallback: match worldwide cities dynamically from 148,000+ global cities
  const allCities = City.getAllCities();
  for (let i = 0; i < allCities.length; i++) {
    const c = allCities[i];
    const nameLower = c.name.toLowerCase();

    // Exact city match
    if (nameLower === q) {
      const key = `${c.name.toLowerCase()}:${c.countryCode}`;
      if (!seen.has(key)) {
        seen.add(key);
        const country = Country.getCountryByCode(c.countryCode);
        const state = c.stateCode
          ? State.getStateByCodeAndCountry(c.stateCode, c.countryCode)
          : null;
        exactMatches.unshift({
          city: c.name,
          region: state?.name || c.stateCode || undefined,
          country: country?.name || c.countryCode,
          countryCode: c.countryCode,
          type: "city",
          badge: "City",
          fullLabel: `${c.name}${state?.name ? `, ${state.name}` : ""}, ${country?.name || c.countryCode}`,
        });
      }
    }
    // Prefix match
    else if (nameLower.startsWith(q)) {
      const key = `${c.name.toLowerCase()}:${c.countryCode}`;
      if (!seen.has(key)) {
        seen.add(key);
        const country = Country.getCountryByCode(c.countryCode);
        const state = c.stateCode
          ? State.getStateByCodeAndCountry(c.stateCode, c.countryCode)
          : null;
        prefixMatches.push({
          city: c.name,
          region: state?.name || c.stateCode || undefined,
          country: country?.name || c.countryCode,
          countryCode: c.countryCode,
          type: "city",
          badge: "City",
          fullLabel: `${c.name}${state?.name ? `, ${state.name}` : ""}, ${country?.name || c.countryCode}`,
        });
      }
    }

    if (exactMatches.length + prefixMatches.length >= limit * 2) {
      break;
    }
  }

  return [...exactMatches, ...prefixMatches].slice(0, limit);
}

/**
 * Returns dynamic sample popular destinations derived from country-state-city.
 */
export function getPopularGlobalDestinations(): WorldCity[] {
  const sampleTargets = [
    { city: "Surat", countryCode: "IN" },
    { city: "Mumbai", countryCode: "IN" },
    { city: "Riyadh", countryCode: "SA" },
    { city: "Jeddah", countryCode: "SA" },
    { city: "Dubai", countryCode: "AE" },
    { city: "London", countryCode: "GB" },
    { city: "Paris", countryCode: "FR" },
    { city: "Tokyo", countryCode: "JP" },
  ];

  return sampleTargets.map((target) => {
    const country = Country.getCountryByCode(target.countryCode);
    return {
      city: target.city,
      country: country?.name || target.countryCode,
      countryCode: target.countryCode,
      type: "city",
      badge: "Popular Destination",
      fullLabel: `${target.city}, ${country?.name || target.countryCode}`,
    };
  });
}
