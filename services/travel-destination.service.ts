import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { BookingStatus, TravelEvidenceSource, TravelVerificationStatus } from "@/generated/prisma/client";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";
import { ADDRESS_COUNTRIES } from "@/lib/location/address-countries";

export interface DestinationDTO {
  id: string;
  countryName: string;
  countryCode: string;
  cityName: string | null;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  parentCountryId: string | null;
}

export interface UserDestinationDTO {
  id: string;
  userId: string;
  destinationId: string;
  countryName: string;
  countryCode: string;
  cityName: string | null;
  evidenceSource: TravelEvidenceSource;
  verificationStatus: TravelVerificationStatus;
  firstQualifyingVisitDate: Date | null;
  latestQualifyingVisitDate: Date | null;
  visitCount: number;
}

import type { TravelerDestinationStatsDTO } from "@/types/travel";
export type { TravelerDestinationStatsDTO };

export interface VisitedCountryGroupDTO {
  countryCode: string;
  countryName: string;
  cities: string[];
  totalVisits: number;
  firstVisit: Date | null;
  latestVisit: Date | null;
  isVerified: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Country & City Normalization
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_LOOKUP = new Map<string, { countryCode: string; countryName: string }>();

// Prepopulate from ADDRESS_COUNTRIES
for (const item of ADDRESS_COUNTRIES) {
  COUNTRY_LOOKUP.set(item.iso2.toUpperCase(), { countryCode: item.iso2.toUpperCase(), countryName: item.name });
  COUNTRY_LOOKUP.set(item.name.toLowerCase(), { countryCode: item.iso2.toUpperCase(), countryName: item.name });
}

// Additional common aliases
COUNTRY_LOOKUP.set("usa", { countryCode: "US", countryName: "United States" });
COUNTRY_LOOKUP.set("united states of america", { countryCode: "US", countryName: "United States" });
COUNTRY_LOOKUP.set("uk", { countryCode: "GB", countryName: "United Kingdom" });
COUNTRY_LOOKUP.set("great britain", { countryCode: "GB", countryName: "United Kingdom" });
COUNTRY_LOOKUP.set("ksa", { countryCode: "SA", countryName: "Saudi Arabia" });
COUNTRY_LOOKUP.set("uae", { countryCode: "AE", countryName: "United Arab Emirates" });

export function normalizeCountry(
  countryInput?: string | null,
  countryCodeInput?: string | null,
): { countryCode: string; countryName: string } | null {
  if (countryCodeInput && countryCodeInput.trim().length === 2) {
    const code = countryCodeInput.trim().toUpperCase();
    const match = COUNTRY_LOOKUP.get(code);
    if (match) return match;
    return { countryCode: code, countryName: countryInput?.trim() || code };
  }

  if (!countryInput || typeof countryInput !== "string") return null;

  const trimmed = countryInput.trim();
  // Check for "Country - XX" suffix (standard homyz address format)
  const codeMatch = trimmed.match(/\s-\s([A-Za-z]{2})$/);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    const match = COUNTRY_LOOKUP.get(code);
    if (match) return match;
  }

  // Lookup by full name or alias
  const match = COUNTRY_LOOKUP.get(trimmed.toLowerCase());
  if (match) return match;

  // Fallback: If 2 letters, treat as code
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    return { countryCode: code, countryName: trimmed };
  }

  // If we can't reliably resolve an ISO code, return null to avoid fabricating destinations
  return null;
}

export function normalizeCityName(cityName?: string | null): string | null {
  if (!cityName || typeof cityName !== "string") return null;
  const cleaned = cityName.trim();
  if (!cleaned) return null;
  // Capitalize words
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function generateDestinationSlug(countryCode: string, cityName?: string | null): string {
  const code = countryCode.trim().toLowerCase();
  if (!cityName) {
    return `country-${code}`;
  }
  const cleanCity = cityName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `city-${code}-${cleanCity}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Destination Database Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrCreateDestination(params: {
  countryCode: string;
  countryName: string;
  cityName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<DestinationDTO> {
  const { countryCode, countryName } = params;
  const cityName = normalizeCityName(params.cityName);

  // 1. Ensure Country Destination exists
  const countrySlug = generateDestinationSlug(countryCode, null);
  const countryDest = await prisma.destination.upsert({
    where: { slug: countrySlug },
    update: { countryName },
    create: {
      countryCode: countryCode.toUpperCase(),
      countryName,
      cityName: null,
      slug: countrySlug,
      latitude: cityName ? undefined : params.latitude,
      longitude: cityName ? undefined : params.longitude,
    },
  });

  if (!cityName) {
    return countryDest;
  }

  // 2. Ensure City Destination exists with parentCountryId
  const citySlug = generateDestinationSlug(countryCode, cityName);
  const cityDest = await prisma.destination.upsert({
    where: { slug: citySlug },
    update: {
      cityName,
      parentCountryId: countryDest.id,
      latitude: params.latitude ?? undefined,
      longitude: params.longitude ?? undefined,
    },
    create: {
      countryCode: countryCode.toUpperCase(),
      countryName,
      cityName,
      slug: citySlug,
      parentCountryId: countryDest.id,
      latitude: params.latitude,
      longitude: params.longitude,
    },
  });

  return cityDest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Completed Booking Verification Engine
// ─────────────────────────────────────────────────────────────────────────────

export async function verifyUserBookings(userId: string): Promise<{
  verifiedDestinationsCount: number;
  completedStaysCount: number;
}> {
  if (!userId) throw AppError.badRequest("userId is required");

  // Query all confirmed bookings for user with listing location details
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      status: BookingStatus.CONFIRMED,
    },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      propertyTimeZone: true,
      checkOutTime: true,
      listing: {
        select: {
          id: true,
          country: true,
          city: true,
          latitude: true,
          longitude: true,
        },
      },
    },
    orderBy: { endDate: "asc" },
  });

  // Filter for completed stays (checkout time in the past)
  const now = new Date();
  const completedBookings = bookings.filter((b) =>
    isCompletedConfirmedBooking({
      dbStatus: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
      checkOutTime: b.checkOutTime,
      propertyTimeZone: b.propertyTimeZone,
      now,
    }),
  );

  let verifiedDestinationsCount = 0;

  for (const booking of completedBookings) {
    const listing = booking.listing;
    if (!listing) continue;

    const resolvedCountry = normalizeCountry(listing.country);
    // If listing lacks reliable country information, skip rather than guessing
    if (!resolvedCountry) continue;

    const resolvedCity = normalizeCityName(listing.city);

    // 1. Process Country Destination
    const countryDest = await getOrCreateDestination({
      countryCode: resolvedCountry.countryCode,
      countryName: resolvedCountry.countryName,
      cityName: null,
      latitude: listing.latitude,
      longitude: listing.longitude,
    });

    const existingCountryUserDest = await prisma.userDestination.findUnique({
      where: {
        userId_destinationId_evidenceSource: {
          userId,
          destinationId: countryDest.id,
          evidenceSource: TravelEvidenceSource.VERIFIED_BOOKING,
        },
      },
    });

    if (existingCountryUserDest) {
      // A reconciliation retry must not manufacture an additional visit. The
      // destination row is an idempotent verification marker; completed stays
      // themselves remain the authoritative source for booking-based metrics.
      await prisma.userDestination.update({
        where: { id: existingCountryUserDest.id },
        data: {
          latestQualifyingVisitDate: existingCountryUserDest.latestQualifyingVisitDate && existingCountryUserDest.latestQualifyingVisitDate > booking.endDate
            ? existingCountryUserDest.latestQualifyingVisitDate
            : booking.endDate,
        },
      });
    } else {
      await prisma.userDestination.create({
        data: {
          userId,
          destinationId: countryDest.id,
          evidenceSource: TravelEvidenceSource.VERIFIED_BOOKING,
          verificationStatus: TravelVerificationStatus.VERIFIED,
          firstQualifyingVisitDate: booking.startDate,
          latestQualifyingVisitDate: booking.endDate,
          qualifyingBookingId: booking.id,
          visitCount: 1,
        },
      });
      verifiedDestinationsCount++;
    }

    // 2. Process City Destination (if city data exists)
    if (resolvedCity) {
      const cityDest = await getOrCreateDestination({
        countryCode: resolvedCountry.countryCode,
        countryName: resolvedCountry.countryName,
        cityName: resolvedCity,
        latitude: listing.latitude,
        longitude: listing.longitude,
      });

      const existingCityUserDest = await prisma.userDestination.findUnique({
        where: {
          userId_destinationId_evidenceSource: {
            userId,
            destinationId: cityDest.id,
            evidenceSource: TravelEvidenceSource.VERIFIED_BOOKING,
          },
        },
      });

      if (existingCityUserDest) {
        await prisma.userDestination.update({
          where: { id: existingCityUserDest.id },
          data: {
            latestQualifyingVisitDate: existingCityUserDest.latestQualifyingVisitDate && existingCityUserDest.latestQualifyingVisitDate > booking.endDate
              ? existingCityUserDest.latestQualifyingVisitDate
              : booking.endDate,
          },
        });
      } else {
        await prisma.userDestination.create({
          data: {
            userId,
            destinationId: cityDest.id,
            evidenceSource: TravelEvidenceSource.VERIFIED_BOOKING,
            verificationStatus: TravelVerificationStatus.VERIFIED,
            firstQualifyingVisitDate: booking.startDate,
            latestQualifyingVisitDate: booking.endDate,
            qualifyingBookingId: booking.id,
            visitCount: 1,
          },
        });
        verifiedDestinationsCount++;
      }
    }
  }

  return {
    verifiedDestinationsCount,
    completedStaysCount: completedBookings.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Destination Statistics & Queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getTravelerDestinationStats(userId: string): Promise<TravelerDestinationStatsDTO> {
  const [userDestinations, confirmedBookings] = await Promise.all([
    prisma.userDestination.findMany({
      where: {
        userId,
        verificationStatus: TravelVerificationStatus.VERIFIED,
      },
      include: {
        destination: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        propertyTimeZone: true,
        checkOutTime: true,
      },
    }),
  ]);

  const completedStays = confirmedBookings.filter((b) =>
    isCompletedConfirmedBooking({
      dbStatus: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
      checkOutTime: b.checkOutTime,
      propertyTimeZone: b.propertyTimeZone,
    }),
  ).length;

  const verifiedCountries = new Set<string>();
  const verifiedCities = new Set<string>();
  let totalVisits = 0;

  for (const ud of userDestinations) {
    if (!ud.destination) continue;
    if (ud.destination.cityName) {
      verifiedCities.add(ud.destination.slug);
    } else {
      verifiedCountries.add(ud.destination.countryCode);
      totalVisits += ud.visitCount;
    }
  }

  return {
    verifiedCountriesCount: verifiedCountries.size,
    verifiedCitiesCount: verifiedCities.size,
    completedStaysCount: completedStays,
    totalVisitsCount: totalVisits,
  };
}

export async function getTravelerVisitedDestinations(userId: string): Promise<VisitedCountryGroupDTO[]> {
  const userDestinations = await prisma.userDestination.findMany({
    where: {
      userId,
      verificationStatus: TravelVerificationStatus.VERIFIED,
    },
    include: {
      destination: true,
    },
    orderBy: { latestQualifyingVisitDate: "desc" },
  });

  const countryMap = new Map<string, VisitedCountryGroupDTO>();

  for (const ud of userDestinations) {
    const dest = ud.destination;
    if (!dest) continue;

    const code = dest.countryCode;
    let entry = countryMap.get(code);
    if (!entry) {
      entry = {
        countryCode: code,
        countryName: dest.countryName,
        cities: [],
        totalVisits: 0,
        firstVisit: ud.firstQualifyingVisitDate,
        latestVisit: ud.latestQualifyingVisitDate,
        isVerified: true,
      };
      countryMap.set(code, entry);
    }

    if (dest.cityName && !entry.cities.includes(dest.cityName)) {
      entry.cities.push(dest.cityName);
    } else if (!dest.cityName) {
      entry.totalVisits += ud.visitCount;
    }

    if (ud.firstQualifyingVisitDate && (!entry.firstVisit || ud.firstQualifyingVisitDate < entry.firstVisit)) {
      entry.firstVisit = ud.firstQualifyingVisitDate;
    }
    if (ud.latestQualifyingVisitDate && (!entry.latestVisit || ud.latestQualifyingVisitDate > entry.latestVisit)) {
      entry.latestVisit = ud.latestQualifyingVisitDate;
    }
  }

  return Array.from(countryMap.values());
}
