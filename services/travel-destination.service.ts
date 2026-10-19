import { prisma } from "@/lib/db/prisma";
import {
  type CanonicalDestinationInput,
  normalizeCanonicalDestination,
  normalizeDestinationText,
  searchWorldDestinations,
} from "@/lib/travel/destination-normalization";
import { searchPlacesAutocomplete } from "@/lib/location/places-provider";
import type { DestinationDto } from "@/lib/validation/travel-trip";

export class TravelDestinationService {
  /**
   * Idempotently finds an existing canonical destination or creates a new one.
   * Concurrency-safe against race conditions using canonicalKey uniqueness.
   */
  async findOrCreateDestination(input: CanonicalDestinationInput): Promise<DestinationDto> {
    const normalized = normalizeCanonicalDestination(input);

    // 1. Search by canonicalKey
    const existing = await prisma.destination.findUnique({
      where: { canonicalKey: normalized.canonicalKey },
    });
    if (existing) {
      return this.toDto(existing);
    }

    // 2. Search by providerPlaceId if present
    if (normalized.providerPlaceId) {
      const byProvider = await prisma.destination.findFirst({
        where: { providerPlaceId: normalized.providerPlaceId },
      });
      if (byProvider) {
        return this.toDto(byProvider);
      }
    }

    // 3. Create canonical destination
    try {
      const created = await prisma.destination.create({
        data: {
          canonicalKey: normalized.canonicalKey,
          name: normalized.name,
          normalizedName: normalized.normalizedName,
          countryCode: normalized.countryCode,
          countryName: normalized.countryName,
          regionName: normalized.regionName,
          regionCode: normalized.regionCode,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          providerPlaceId: normalized.providerPlaceId,
        },
      });
      return this.toDto(created);
    } catch (error: unknown) {
      // Concurrency race: if created concurrently, return existing
      if ((error as { code?: string })?.code === "P2002") {
        const found = await prisma.destination.findUnique({
          where: { canonicalKey: normalized.canonicalKey },
        });
        if (found) return this.toDto(found);
      }
      throw error;
    }
  }

  /**
   * Retrieves destination by ID.
   */
  async getDestinationById(id: string): Promise<DestinationDto | null> {
    const found = await prisma.destination.findUnique({
      where: { id },
    });
    return found ? this.toDto(found) : null;
  }

  /**
   * Searches canonical destinations from DB first, then the same unified places
   * provider used by Homyz's general location search. This keeps travel memories
   * useful for a city, neighbourhood, address, or landmark—not only city names.
   */
  async searchDestinations(query: string, limit = 10): Promise<DestinationDto[]> {
    const q = normalizeDestinationText(query);
    if (!q) return [];

    // Query persisted destinations first
    const dbMatches = await prisma.destination.findMany({
      where: {
        OR: [
          { normalizedName: { startsWith: q } },
          { name: { contains: query, mode: "insensitive" } },
          { countryName: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: [{ countryName: "asc" }, { name: "asc" }],
    });

    const dtos: DestinationDto[] = dbMatches.map((m: (typeof dbMatches)[number]) => this.toDto(m));
    const seenKeys = new Set<string>(dbMatches.map((m: (typeof dbMatches)[number]) => m.canonicalKey));

    // Reuse the established Mapbox → OpenStreetMap → country-state-city provider.
    // Results are virtual until selected, at which point the existing destination
    // service persists the canonical record and returns its real ID.
    if (dtos.length < limit) {
      const placeMatches = await searchPlacesAutocomplete(query, { limit: limit - dtos.length });
      for (const place of placeMatches) {
        if (!place.countryCode) continue;
        const searchablePlace = normalizeDestinationText([
          place.name,
          place.city,
          place.state,
          place.country,
          place.fullAddress,
        ].filter(Boolean).join(" "));
        // The shared provider intentionally has typo-tolerant landmark matching.
        // A travel destination should stay directly relevant to the entered place.
        if (!searchablePlace.includes(q)) continue;
        const canonical = normalizeCanonicalDestination({
          name: place.name,
          countryCode: place.countryCode,
          countryName: place.country,
          regionName: place.state || null,
          latitude: Number.isFinite(place.latitude) ? place.latitude : null,
          longitude: Number.isFinite(place.longitude) ? place.longitude : null,
          providerPlaceId: place.providerPlaceId,
        });
        if (seenKeys.has(canonical.canonicalKey) || dtos.length >= limit) continue;
        seenKeys.add(canonical.canonicalKey);
        dtos.push({
          id: `temp-${canonical.canonicalKey}`,
          name: canonical.name,
          normalizedName: canonical.normalizedName,
          countryCode: canonical.countryCode,
          countryName: canonical.countryName,
          regionName: canonical.regionName,
          regionCode: canonical.regionCode,
          latitude: canonical.latitude,
          longitude: canonical.longitude,
          providerPlaceId: canonical.providerPlaceId,
        });
      }

      // Offline-safe final fallback. This is the same country-state-city data used
      // by the unified provider, retained for a useful result if an external
      // provider is unavailable or has no match.
      if (dtos.length < limit) {
        const worldMatches = searchWorldDestinations(query, limit - dtos.length);
        for (const wm of worldMatches) {
          if (seenKeys.has(wm.canonicalKey) || dtos.length >= limit) continue;
          seenKeys.add(wm.canonicalKey);
          dtos.push({
            id: `temp-${wm.canonicalKey}`,
            name: wm.name,
            normalizedName: wm.normalizedName,
            countryCode: wm.countryCode,
            countryName: wm.countryName,
            regionName: wm.regionName,
            regionCode: wm.regionCode,
            latitude: wm.latitude,
            longitude: wm.longitude,
            providerPlaceId: wm.providerPlaceId,
          });
        }
      }
    }

    return dtos;
  }

  private toDto(record: {
    id: string;
    name: string;
    normalizedName: string;
    countryCode: string;
    countryName: string;
    regionName: string | null;
    regionCode: string | null;
    latitude: number | null;
    longitude: number | null;
    providerPlaceId: string | null;
  }): DestinationDto {
    return {
      id: record.id,
      name: record.name,
      normalizedName: record.normalizedName,
      countryCode: record.countryCode,
      countryName: record.countryName,
      regionName: record.regionName,
      regionCode: record.regionCode,
      latitude: record.latitude,
      longitude: record.longitude,
      providerPlaceId: record.providerPlaceId,
    };
  }
}

export const travelDestinationService = new TravelDestinationService();
