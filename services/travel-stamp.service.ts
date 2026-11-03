import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { deleteManagedMediaUrl, parseManagedMediaUrl } from "@/lib/storage/media";
import {
  Prisma,
  TravelEvidenceSource,
  TravelStampCategory,
  TravelStampOwnership,
  TravelVerificationStatus,
} from "@/generated/prisma/client";
import {
  getOrCreateDestination,
  getTravelerDestinationStats,
  getTravelerVisitedDestinations,
  normalizeCityName,
  normalizeCountry,
} from "./travel-destination.service";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";

import type {
  AdminTravelStampDTO,
  TravelStampDTO,
  TravelStampPickerItemDTO,
  TravelStampPickerPageDTO,
  UserTravelStampDTO,
} from "@/types/travel";
export type {
  AdminTravelStampDTO,
  TravelStampDTO,
  TravelStampPickerItemDTO,
  TravelStampPickerPageDTO,
  UserTravelStampDTO,
};

export interface StampCatalogDefinition {
  slug: string;
  displayName: string;
  title?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  description: string;
  qualifyingCities?: string[];
  qualifyingCountryCodes?: string[];
  category: TravelStampCategory | string;
  eligibilityRule: string;
  ruleThreshold?: number;
  iconUrl: string;
  displayOrder?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stamp Catalog Definitions (Matching Figma Screenshot 1 & Client Spec)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_STAMP_CATALOG: StampCatalogDefinition[] = [
  {
    slug: "stamp-paris",
    displayName: "Paris",
    title: "Paris Explorer",
    city: "Paris",
    country: "France",
    countryCode: "FR",
    description:
      "Awarded for discovering Paris, Eiffel Tower views, and authentic French bistros.",
    qualifyingCities: ["Paris"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl: "/uploads/stamp-icons/stamp_1788426489452_bz1kfx.png",
    displayOrder: 1,
  },
  {
    slug: "stamp-coffee",
    displayName: "Coffee",
    title: "Artisan Coffee",
    city: null,
    country: null,
    countryCode: null,
    description:
      "Awarded for discovering local artisan coffee cultures and cozy neighborhood cafes on your travels.",
    category: TravelStampCategory.THEME,
    eligibilityRule: "COMPLETED_STAYS",
    ruleThreshold: 1,
    iconUrl: "/uploads/stamp-icons/stamp_1788428359986_2bb4gt.png",
    displayOrder: 2,
  },
  {
    slug: "stamp-riyadh",
    displayName: "Riyadh",
    title: "Desert Dreams",
    city: "Riyadh",
    country: "Saudi Arabia",
    countryCode: "SA",
    description:
      "Awarded for memories made in Riyadh, Kingdom Centre, and the golden Arabian dunes.",
    qualifyingCities: ["Riyadh"],
    qualifyingCountryCodes: ["SA"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl: "/uploads/stamp-icons/stamp_1789539620193_gf5zbl.png",
    displayOrder: 3,
  },
  {
    slug: "stamp-london-calling",
    displayName: "London",
    title: "London Calling",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
    description:
      "Awarded for a journey across London, Big Ben, and the Thames.",
    qualifyingCities: ["London"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
    displayOrder: 4,
  },
  {
    slug: "stamp-dubai-skyline",
    displayName: "Dubai",
    title: "Dubai Skyline",
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    description:
      "A passport stamp for memories made in Dubai and modern architectural wonders.",
    qualifyingCities: ["Dubai"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
    displayOrder: 5,
  },
  {
    slug: "stamp-istanbul-crossroads",
    displayName: "Istanbul",
    title: "Istanbul Crossroads",
    city: "Istanbul",
    country: "Türkiye",
    countryCode: "TR",
    description:
      "A passport stamp for memories made in Istanbul, bridging two continents.",
    qualifyingCities: ["Istanbul"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
    displayOrder: 6,
  },
  {
    slug: "stamp-tokyo-lights",
    displayName: "Tokyo",
    title: "Tokyo Lights",
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    description:
      "Awarded for exploring Tokyo's neon streets, Shibuya crossing, and tranquil shrines.",
    qualifyingCities: ["Tokyo"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
    displayOrder: 6,
  },
  {
    slug: "stamp-mumbai-mosaic",
    displayName: "Mumbai",
    title: "Mumbai Mosaic",
    city: "Mumbai",
    country: "India",
    countryCode: "IN",
    description:
      "A passport stamp for vibrant memories made in Mumbai by the Arabian Sea.",
    qualifyingCities: ["Mumbai"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
    displayOrder: 7,
  },
  {
    slug: "stamp-statue-seeker",
    displayName: "Statue Seeker",
    description:
      "Awarded for a verified completed stay in New York, United States.",
    countryCode: "US",
    qualifyingCities: ["New York"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
  },
  {
    slug: "stamp-miami-heat",
    displayName: "Miami Heat",
    description:
      "Awarded for a verified completed stay in Miami, United States.",
    countryCode: "US",
    qualifyingCities: ["Miami"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
  },
  {
    slug: "stamp-golden-view",
    displayName: "Golden View",
    description:
      "Awarded for a verified completed stay in San Francisco, United States.",
    countryCode: "US",
    qualifyingCities: ["San Francisco"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
  },
  {
    slug: "stamp-venezia-vibes",
    displayName: "Venezia Vibes",
    description: "Awarded for a verified completed stay in Venice, Italy.",
    countryCode: "IT",
    qualifyingCities: ["Venice"],
    category: TravelStampCategory.CITY,
    eligibilityRule: "VISIT_CITY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
  },
  {
    slug: "stamp-france",
    displayName: "France",
    description: "Awarded for completing a verified journey across France.",
    countryCode: "FR",
    category: TravelStampCategory.COUNTRY,
    eligibilityRule: "VISIT_COUNTRY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
  },
  {
    slug: "stamp-saudi-arabia",
    displayName: "Saudi Arabia",
    description:
      "Awarded for completing a verified journey across the Kingdom of Saudi Arabia.",
    countryCode: "SA",
    category: TravelStampCategory.COUNTRY,
    eligibilityRule: "VISIT_COUNTRY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
  },
  {
    slug: "stamp-usa",
    displayName: "United States",
    description:
      "Awarded for completing a verified journey across the United States.",
    countryCode: "US",
    category: TravelStampCategory.COUNTRY,
    eligibilityRule: "VISIT_COUNTRY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
  },
  {
    slug: "stamp-japan",
    displayName: "Japan",
    description:
      "Awarded for exploring Japan's serene temples, bustling metropolises, and vibrant culture.",
    countryCode: "JP",
    category: TravelStampCategory.COUNTRY,
    eligibilityRule: "VISIT_COUNTRY",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/office-stamp-document--Streamline-Freehand.svg",
  },
  {
    slug: "stamp-first-stay",
    displayName: "First Stamp",
    description:
      "Welcome to Homyz travels! Awarded upon completing your first verified stay.",
    countryCode: null,
    category: TravelStampCategory.MILESTONE,
    eligibilityRule: "COMPLETED_STAYS",
    ruleThreshold: 1,
    iconUrl:
      "/images/icons/streamline-freehand/stamps-portrait--Streamline-Freehand.svg",
  },
];

export async function ensureStampCatalog(): Promise<void> {
  // Static/demo catalog seeding disabled. Stamps are created/managed by Admin only.
  return;
}

// ─────────────────────────────────────────────────────────────────────────────
// Automatic, booking-backed stamp qualification
// ─────────────────────────────────────────────────────────────────────────────

type QualifyingStay = {
  id: string;
  startDate: Date;
  endDate: Date;
  propertyTimeZone: string;
  checkOutTime: string;
  listing: { country: string | null; city: string | null };
};

function configuredCitiesForStamp(stamp: { slug: string; city: string | null }) {
  const definition = DEFAULT_STAMP_CATALOG.find((candidate) => candidate.slug === stamp.slug);
  // City is the authoritative admin configuration. The legacy static catalog
  // provides a compatibility mapping only for its named records (for example
  // stamp-paris); we never infer a city from arbitrary marketing copy.
  return (stamp.city ? [stamp.city] : definition?.qualifyingCities ?? [])
    .map(normalizeCityName)
    .filter((city): city is string => Boolean(city));
}

/**
 * Awards only catalog rules satisfied by completed, confirmed booking/listing
 * data. It intentionally does not read profile locations, manual stamps, or
 * photos. The unique system-owned projection makes retries and concurrent
 * workers idempotent while preserving any separately user-managed selection.
 */
export async function awardSystemTravelStamps(userId: string, now = new Date()): Promise<{
  awardedCount: number;
  totalSystemAwardedCount: number;
  missingConfiguration: string[];
}> {
  if (!userId) throw AppError.badRequest("userId is required");

  const [bookings, stamps] = await Promise.all([
    prisma.booking.findMany({
      where: { userId, status: "CONFIRMED" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        propertyTimeZone: true,
        checkOutTime: true,
        listing: { select: { country: true, city: true } },
      },
    }),
    prisma.travelStamp.findMany({ where: { isActive: true, isCustom: false } }),
  ]);

  const stays = bookings.flatMap((booking) => {
    if (!isCompletedConfirmedBooking({
      dbStatus: "CONFIRMED",
      startDate: booking.startDate,
      endDate: booking.endDate,
      checkOutTime: booking.checkOutTime,
      propertyTimeZone: booking.propertyTimeZone,
      now,
    })) return [];
    const country = normalizeCountry(booking.listing.country);
    if (!country) return [];
    return [{ ...booking, country, city: normalizeCityName(booking.listing.city) }];
  });

  const missingConfiguration = new Set<string>();
  // France/Paris are existing catalog concepts, not implicit business rules.
  // If a completed stay reaches either destination but its enabled catalog rule
  // is absent, surface that fact to the worker/reconciliation report instead
  // of creating a replacement definition.
  const hasCountryRule = (countryCode: string) => stamps.some((stamp) =>
    stamp.eligibilityRule.trim().toUpperCase() === "VISIT_COUNTRY" &&
    stamp.countryCode?.trim().toUpperCase() === countryCode,
  );
  const hasCityRule = (countryCode: string, cityName: string) => stamps.some((stamp) =>
    stamp.eligibilityRule.trim().toUpperCase() === "VISIT_CITY" &&
    stamp.countryCode?.trim().toUpperCase() === countryCode &&
    configuredCitiesForStamp(stamp).some((city) => city.toLocaleLowerCase() === cityName.toLocaleLowerCase()),
  );
  if (stays.some((stay) => stay.country.countryCode === "FR") && !hasCountryRule("FR")) {
    missingConfiguration.add("No active VISIT_COUNTRY France travel stamp is configured.");
  }
  if (stays.some((stay) => stay.country.countryCode === "FR" && stay.city?.toLocaleLowerCase() === "paris") && !hasCityRule("FR", "Paris")) {
    missingConfiguration.add("No active VISIT_CITY Paris, France travel stamp is configured.");
  }
  let awardedCount = 0;

  for (const stamp of stamps) {
    const rule = stamp.eligibilityRule.trim().toUpperCase();
    let qualifyingStay: (typeof stays)[number] | undefined;
    if (rule === "VISIT_COUNTRY") {
      if (!stamp.countryCode?.trim()) {
        missingConfiguration.add(`Stamp ${stamp.slug} uses VISIT_COUNTRY without countryCode.`);
        continue;
      }
      qualifyingStay = stays.find((stay) => stay.country.countryCode === stamp.countryCode!.trim().toUpperCase());
    } else if (rule === "VISIT_CITY") {
      const cities = configuredCitiesForStamp(stamp);
      if (!stamp.countryCode?.trim() || !cities.length) {
        missingConfiguration.add(`Stamp ${stamp.slug} uses VISIT_CITY without an explicit countryCode and city mapping.`);
        continue;
      }
      const normalizedCities = new Set(cities.map((city) => city.toLocaleLowerCase()));
      qualifyingStay = stays.find((stay) =>
        stay.country.countryCode === stamp.countryCode!.trim().toUpperCase() &&
        Boolean(stay.city && normalizedCities.has(stay.city.toLocaleLowerCase())),
      );
    } else if (rule === "COMPLETED_STAYS") {
      const threshold = Math.max(1, stamp.ruleThreshold || 1);
      if (stays.length >= threshold) qualifyingStay = stays[threshold - 1];
    } else {
      continue;
    }

    if (!qualifyingStay) continue;
    const evidenceMetadata: Prisma.InputJsonValue = {
      source: "VERIFIED_BOOKING",
      isPublic: true,
      bookingId: qualifyingStay.id,
      rule,
      countryCode: qualifyingStay.country.countryCode,
      cityName: qualifyingStay.city,
      awardedAt: now.toISOString(),
    };
    try {
      await prisma.userTravelStamp.create({
        data: {
          userId,
          stampId: stamp.id,
          ownership: TravelStampOwnership.SYSTEM_AWARDED,
          awardedAt: now,
          evidenceMetadata,
        },
      });
      awardedCount += 1;
    } catch (error: unknown) {
      // Parallel completion/reconciliation workers converge on the single
      // system projection. Do not mask unrelated database failures.
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }

  return {
    awardedCount,
    totalSystemAwardedCount: await prisma.userTravelStamp.count({
      where: { userId, ownership: TravelStampOwnership.SYSTEM_AWARDED, revokedAt: null },
    }),
    missingConfiguration: [...missingConfiguration],
  };
}

/** Backwards-compatible entry point used by older reconciliation callers. */
export async function evaluateAndAwardStamps(userId: string) {
  const result = await awardSystemTravelStamps(userId);
  return { awardedCount: result.awardedCount, totalStampsCount: result.totalSystemAwardedCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stamp Collection Retrieval & Management
// ─────────────────────────────────────────────────────────────────────────────

type StampEvidence = {
  source?: "MANUAL_DECLARATION" | "USER_SELECTED" | "VERIFIED_BOOKING" | string;
  isPublic?: boolean;
  visitDate?: string | null;
  personalDescription?: string | null;
};

function readStampEvidence(value: Prisma.JsonValue | null): StampEvidence {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as StampEvidence)
    : {};
}

function toUserTravelStampDTO(record: {
  id: string;
  userId: string;
  stampId: string;
  awardedAt: Date;
  isPinned: boolean;
  displayOrder: number;
  evidenceMetadata: Prisma.JsonValue | null;
  ownership: TravelStampOwnership;
  stamp: {
    id: string;
    slug: string;
    displayName: string;
    title?: string | null;
    city?: string | null;
    country?: string | null;
    description: string | null;
    countryCode: string | null;
    iconUrl: string | null;
    imageUrl?: string | null;
    category: string;
    eligibilityRule: string;
    ruleThreshold: number;
    isActive?: boolean;
    displayOrder?: number;
    isCustom?: boolean;
  };
}): UserTravelStampDTO {
  const evidence = readStampEvidence(record.evidenceMetadata);
  return {
    id: record.id,
    userId: record.userId,
    stampId: record.stampId,
    stamp: {
      id: record.stamp.id,
      slug: record.stamp.slug,
      displayName: record.stamp.displayName,
      title: record.stamp.title || record.stamp.displayName,
      city: record.stamp.city,
      country: record.stamp.country,
      description: record.stamp.description,
      countryCode: record.stamp.countryCode,
      iconUrl: record.stamp.iconUrl || record.stamp.imageUrl || null,
      category: record.stamp.category,
      eligibilityRule: record.stamp.eligibilityRule,
      ruleThreshold: record.stamp.ruleThreshold,
      isActive: record.stamp.isActive,
      displayOrder: record.stamp.displayOrder,
      isCustom: record.stamp.isCustom,
    },
    awardedAt: record.awardedAt,
    isPinned: record.isPinned,
    displayOrder: record.displayOrder,
    isPublic: evidence.isPublic !== false,
    isManual: evidence.source === "MANUAL_DECLARATION",
    isSystemAwarded: record.ownership === TravelStampOwnership.SYSTEM_AWARDED,
    visitDate: evidence.visitDate || null,
    personalDescription: evidence.personalDescription || null,
  };
}

export async function getTravelerStamps(
  userId: string,
  options?: { publicOnly?: boolean },
): Promise<UserTravelStampDTO[]> {
  const records = await prisma.userTravelStamp.findMany({
    where: { userId, revokedAt: null },
    include: {
      stamp: true,
    },
    orderBy: [
      { isPinned: "desc" },
      { displayOrder: "asc" },
      { awardedAt: "desc" },
    ],
  });

  const stamps = records.map(toUserTravelStampDTO);
  return options?.publicOnly
    ? stamps.filter((stamp) => stamp.isPublic)
    : stamps;
}

export async function getPaginatedTravelerStamps(
  userId: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<{
  items: UserTravelStampDTO[];
  nextCursor: string | null;
  totalCount: number;
}> {
  const limit = Math.min(48, Math.max(1, Math.floor(options.limit || 12)));
  const [totalCount, records] = await Promise.all([
    prisma.userTravelStamp.count({ where: { userId, revokedAt: null } }),
    prisma.userTravelStamp.findMany({
      where: { userId, revokedAt: null },
      include: { stamp: true },
      orderBy: [
        { isPinned: "desc" },
        { displayOrder: "asc" },
        { awardedAt: "desc" },
        { id: "asc" },
      ],
      cursor: options.cursor ? { id: options.cursor } : undefined,
      skip: options.cursor ? 1 : 0,
      take: limit + 1,
    }),
  ]);
  const hasMore = records.length > limit;
  const items = records.slice(0, limit).map(toUserTravelStampDTO);
  return {
    items,
    nextCursor: hasMore ? items.at(-1)?.id || null : null,
    totalCount,
  };
}

export const MAX_PINNED_STAMPS = 6;

export async function toggleStampPinned(
  userId: string,
  userStampId: string,
): Promise<UserTravelStampDTO> {
  const userStamp = await prisma.userTravelStamp.findUnique({
    where: { id: userStampId },
    include: { stamp: true },
  });

  if (!userStamp || userStamp.userId !== userId) {
    throw AppError.notFound("Travel stamp not found or unauthorized");
  }
  if (userStamp.ownership === TravelStampOwnership.SYSTEM_AWARDED) {
    throw AppError.forbidden("System-awarded stamps cannot be modified.");
  }

  const willBePinned = !userStamp.isPinned;

  if (willBePinned) {
    const currentPinnedCount = await prisma.userTravelStamp.count({
      where: { userId, isPinned: true },
    });
    if (currentPinnedCount >= MAX_PINNED_STAMPS) {
      throw AppError.badRequest(
        `You can pin a maximum of ${MAX_PINNED_STAMPS} featured stamps on your profile.`,
      );
    }
  }

  const updated = await prisma.userTravelStamp.update({
    where: { id: userStampId },
    data: { isPinned: willBePinned },
    include: { stamp: true },
  });

  return toUserTravelStampDTO(updated);
}

export async function setStampsSectionVisibility(
  userId: string,
  showStamps: boolean,
): Promise<boolean> {
  await prisma.travelProfile.upsert({
    where: { userId },
    update: { showStamps },
    create: {
      userId,
      showStamps,
    },
  });
  return showStamps;
}

const MAX_STAMP_MUTATIONS_PER_REQUEST = 24;

function destinationStampSlug(destinationSlug: string): string {
  return `personal-destination-${destinationSlug}`;
}

function normalizeVisitDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date > new Date()) {
    throw AppError.badRequest("Visit date must be a valid date in the past.");
  }
  return date;
}

async function getOrCreateDestinationStamp(destination: {
  id: string;
  slug: string;
  countryCode: string;
  countryName: string;
  cityName: string | null;
}) {
  const displayName = destination.cityName || destination.countryName;
  return prisma.travelStamp.upsert({
    where: { slug: destinationStampSlug(destination.slug) },
    update: {
      displayName,
      countryCode: destination.countryCode,
      destinationId: destination.id,
    },
    create: {
      slug: destinationStampSlug(destination.slug),
      displayName,
      description: `A personal travel memory from ${destination.cityName ? `${destination.cityName}, ` : ""}${destination.countryName}.`,
      countryCode: destination.countryCode,
      destinationId: destination.id,
      category: destination.cityName
        ? TravelStampCategory.CITY
        : TravelStampCategory.COUNTRY,
      eligibilityRule: "MANUAL_DECLARATION",
      ruleThreshold: 1,
      // These records are intentionally outside the automatic award catalog.
      isActive: false,
    },
  });
}

function stampMatchesDestination(
  stamp: {
    destinationId: string | null;
    countryCode: string | null;
    slug: string;
    category: string;
  },
  destination: { id: string; countryCode: string; cityName: string | null },
): boolean {
  if (stamp.destinationId === destination.id) return true;
  const definition = DEFAULT_STAMP_CATALOG.find(
    (item) => item.slug === stamp.slug,
  );
  if (definition) {
    const allowedCountries =
      definition.qualifyingCountryCodes ??
      (definition.countryCode ? [definition.countryCode] : []);
    if (
      !allowedCountries.some(
        (countryCode) =>
          countryCode.toUpperCase() === destination.countryCode.toUpperCase(),
      )
    )
      return false;
    if (!destination.cityName)
      return definition.category === TravelStampCategory.COUNTRY;
    return Boolean(
      definition.qualifyingCities?.some(
        (city) => city.toLowerCase() === destination.cityName?.toLowerCase(),
      ),
    );
  }
  return Boolean(
    stamp.countryCode &&
    stamp.countryCode.toUpperCase() === destination.countryCode.toUpperCase() &&
    !destination.cityName &&
    stamp.category === TravelStampCategory.COUNTRY,
  );
}

async function assertDestinationNotCollected(
  userId: string,
  destination: { id: string; countryCode: string; cityName: string | null },
  exceptUserStampId?: string,
) {
  const existing = await prisma.userTravelStamp.findMany({
    where: {
      userId,
      ...(exceptUserStampId ? { id: { not: exceptUserStampId } } : {}),
    },
    include: {
      stamp: {
        select: {
          destinationId: true,
          countryCode: true,
          slug: true,
          category: true,
        },
      },
    },
  });
  if (
    existing.some((userStamp) =>
      stampMatchesDestination(userStamp.stamp, destination),
    )
  ) {
    throw AppError.conflict(
      "You already collected a stamp for this destination.",
    );
  }
}

function manualEvidence(input: {
  countryName: string;
  countryCode: string;
  cityName: string | null;
  visitDate?: Date | null;
  personalDescription?: string | null;
  isPublic?: boolean;
}): Prisma.InputJsonObject {
  return {
    source: "MANUAL_DECLARATION",
    verificationStatus: "UNVERIFIED",
    isPublic: input.isPublic ?? true,
    countryName: input.countryName,
    countryCode: input.countryCode,
    cityName: input.cityName,
    visitDate: input.visitDate?.toISOString() || null,
    personalDescription:
      input.personalDescription?.trim().slice(0, 280) || null,
  };
}

export async function getTravelStampPickerItems(
  userId: string,
  search = "",
  country = "",
): Promise<TravelStampPickerItemDTO[]> {
  await ensureStampCatalog();
  const needle = search.trim().toLowerCase();
  const countryFilter = country.trim().toLowerCase();

  const [stamps, userStamps] = await Promise.all([
    prisma.travelStamp.findMany({
      where: {
        isActive: true,
        OR: [{ isCustom: false }, { ownerId: userId }],
      },
      orderBy: [{ displayOrder: "asc" }, { displayName: "asc" }],
    }),
    prisma.userTravelStamp.findMany({
      where: { userId },
      select: { stampId: true },
    }),
  ]);

  const collectedStampIds = new Set(userStamps.map((item) => item.stampId));

  const filtered = stamps.filter((stamp) => {
    if (countryFilter && countryFilter !== "all") {
      const matchCountry =
        stamp.country?.toLowerCase() === countryFilter ||
        stamp.countryCode?.toLowerCase() === countryFilter;
      if (!matchCountry) return false;
    }

    if (!needle) return true;

    return (
      stamp.displayName.toLowerCase().includes(needle) ||
      stamp.title?.toLowerCase().includes(needle) ||
      stamp.city?.toLowerCase().includes(needle) ||
      stamp.country?.toLowerCase().includes(needle) ||
      stamp.description?.toLowerCase().includes(needle) ||
      stamp.category.toLowerCase().includes(needle)
    );
  });

  return filtered.map((stamp) => ({
    id: stamp.id,
    kind: "CATALOG",
    displayName: stamp.title || stamp.displayName,
    description: stamp.description,
    countryName: stamp.country || stamp.countryCode,
    cityName:
      stamp.city || (stamp.category === "CITY" ? stamp.displayName : null),
    iconUrl: stamp.iconUrl || stamp.imageUrl,
    category: stamp.category,
    isAlreadyCollected: collectedStampIds.has(stamp.id),
    isVerifiedSuggestion: false,
    isCustom: stamp.isCustom,
  }));
}

/**
 * Loads a single catalog page.  Keeping filtering in Prisma is important here:
 * the picker can contain thousands of admin-curated stamps, while the modal only
 * renders the nine cards visible to the traveller.
 */
export async function getTravelStampPickerPage(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    country?: string;
  } = {},
): Promise<TravelStampPickerPageDTO> {
  await ensureStampCatalog();

  const page = Math.max(1, Math.floor(options.page || 1));
  const limit = Math.min(24, Math.max(1, Math.floor(options.limit || 9)));
  const search = options.search?.trim() || "";
  const country = options.country?.trim() || "";
  const where: Prisma.TravelStampWhereInput = {
    isActive: true,
    OR: [{ isCustom: false }, { ownerId: userId }],
  };
  const conditions: Prisma.TravelStampWhereInput[] = [];

  if (country && country.toLowerCase() !== "all") {
    conditions.push({
      OR: [
        { country: { equals: country, mode: "insensitive" } },
        { countryCode: { equals: country, mode: "insensitive" } },
        {
          destination: {
            is: { countryName: { equals: country, mode: "insensitive" } },
          },
        },
        {
          destination: {
            is: { countryCode: { equals: country, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  if (search) {
    conditions.push({
      OR: [
        { displayName: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
        {
          destination: {
            is: { countryName: { contains: search, mode: "insensitive" } },
          },
        },
        {
          destination: {
            is: { cityName: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    });
  }
  if (conditions.length) where.AND = conditions;

  const [totalCount, stamps] = await Promise.all([
    prisma.travelStamp.count({ where }),
    prisma.travelStamp.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { displayName: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        destination: {
          select: { countryName: true, countryCode: true, cityName: true },
        },
      },
    }),
  ]);
  const collected = stamps.length
    ? await prisma.userTravelStamp.findMany({
        where: { userId, stampId: { in: stamps.map((stamp) => stamp.id) } },
        select: { stampId: true },
      })
    : [];
  const collectedIds = new Set(collected.map((stamp) => stamp.stampId));
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return {
    items: stamps.map((stamp) => ({
      id: stamp.id,
      kind: "CATALOG",
      displayName: stamp.title || stamp.displayName,
      description: stamp.description,
      countryName:
        stamp.country ||
        stamp.destination?.countryName ||
        stamp.countryCode ||
        stamp.destination?.countryCode ||
        null,
      cityName:
        stamp.city ||
        stamp.destination?.cityName ||
        (stamp.category === "CITY" ? stamp.displayName : null),
      iconUrl: stamp.iconUrl || stamp.imageUrl,
      category: stamp.category,
      isAlreadyCollected: collectedIds.has(stamp.id),
      isVerifiedSuggestion: false,
      isCustom: stamp.isCustom,
    })),
    page: Math.min(page, totalPages),
    limit,
    totalCount,
    totalPages,
    hasMore: page < totalPages,
  };
}

/** Database-driven country options, without loading the stamp catalog into the client. */
export async function getTravelStampPickerCountries(userId: string): Promise<string[]> {
  await ensureStampCatalog();
  const [catalogCountries, destinationCountries] = await Promise.all([
    prisma.travelStamp.findMany({
      where: {
        isActive: true,
        isUserSelectable: true,
        country: { not: null },
        OR: [{ isCustom: false }, { ownerId: userId }],
      },
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
    }),
    prisma.destination.findMany({
      where: { stamps: { some: { isActive: true } } },
      select: { countryName: true },
      distinct: ["countryName"],
      orderBy: { countryName: "asc" },
    }),
  ]);
  return [
    ...new Set([
      ...catalogCountries
        .map((stamp) => stamp.country)
        .filter((country): country is string => Boolean(country)),
      ...destinationCountries.map((destination) => destination.countryName),
    ]),
  ].sort((left, right) => left.localeCompare(right));
}

export async function addTravelStampSelections(
  userId: string,
  input: {
    catalogStampIds?: string[];
    stampIds?: string[];
    destinationIds?: string[];
  },
): Promise<UserTravelStampDTO[]> {
  const ids = input.catalogStampIds || input.stampIds || [];
  const requestedIds = [...new Set(ids)].slice(
    0,
    MAX_STAMP_MUTATIONS_PER_REQUEST,
  );
  if (!requestedIds.length) {
    throw AppError.badRequest("Select at least one travel stamp.");
  }

  // Strictly enforce that only active admin stamps can be collected
  const validStamps = await prisma.travelStamp.findMany({
    where: {
      id: { in: requestedIds },
      isActive: true,
      isUserSelectable: true,
      OR: [{ isCustom: false }, { ownerId: userId }],
    },
  });

  if (validStamps.length === 0) {
    throw AppError.badRequest(
      "Selected destination stamps are unavailable or inactive.",
    );
  }

  const existing = await prisma.userTravelStamp.findMany({
    where: { userId, ownership: TravelStampOwnership.USER_MANAGED },
    select: { stampId: true },
  });
  const existingStampIds = new Set(existing.map((item) => item.stampId));

  const currentCount = await prisma.userTravelStamp.count({
    where: { userId, revokedAt: null },
  });
  let order = currentCount;

  await prisma.$transaction(async (tx) => {
    for (const stamp of validStamps) {
      if (existingStampIds.has(stamp.id)) continue;
      await tx.userTravelStamp.create({
        data: {
          userId,
          stampId: stamp.id,
          displayOrder: order++,
          evidenceMetadata: {
            source: "USER_SELECTED",
            isPublic: true,
          },
        },
      });
      existingStampIds.add(stamp.id);
    }
  });

  return getTravelerStamps(userId);
}

function customStampSlug(userId: string, displayName: string): string {
  const name = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "stamp";
  return `custom-${userId.slice(-8)}-${Date.now()}-${name}`;
}

async function resolveCustomStampArtwork(userId: string, input: {
  artworkUrl?: string | null;
  sourcePhotoId?: string | null;
}): Promise<string> {
  if (input.sourcePhotoId) {
    const photo = await prisma.travelPhoto.findFirst({
      where: { id: input.sourcePhotoId, userId },
      select: { url: true, mediumUrl: true },
    });
    if (!photo) throw AppError.forbidden("You can only use one of your own travel photos.");
    return photo.mediumUrl || photo.url;
  }

  const artworkUrl = input.artworkUrl?.trim() || "";
  const parsed = parseManagedMediaUrl(artworkUrl);
  const fileName = parsed?.fileName.split("/").at(-1) || "";
  if (
    !artworkUrl ||
    parsed?.kind !== "stamp-icons" ||
    parsed.visibility !== "public" ||
    !fileName.startsWith(`custom_stamp_${userId}_`)
  ) {
    throw AppError.badRequest("Upload custom stamp artwork before saving it.");
  }
  return artworkUrl;
}

export async function createCustomTravelStamp(
  userId: string,
  input: {
    displayName: string;
    country?: string | null;
    city?: string | null;
    artworkUrl?: string | null;
    sourcePhotoId?: string | null;
    isPublic?: boolean;
  },
): Promise<UserTravelStampDTO> {
  const displayName = input.displayName.trim().slice(0, 60);
  if (!displayName) throw AppError.badRequest("Custom stamp name is required.");
  const iconUrl = await resolveCustomStampArtwork(userId, input);

  const existing = await prisma.travelStamp.findFirst({
    where: { ownerId: userId, isCustom: true, displayName, iconUrl },
    include: { userStamps: { where: { userId }, include: { stamp: true } } },
  });
  if (existing?.userStamps[0]) return toUserTravelStampDTO(existing.userStamps[0]);

  const displayOrder = await prisma.userTravelStamp.count({ where: { userId } });
  const created = await prisma.$transaction(async (tx) => {
    const stamp = await tx.travelStamp.upsert({
      where: {
        ownerId_displayName_iconUrl: { ownerId: userId, displayName, iconUrl },
      },
      update: {},
      create: {
        slug: customStampSlug(userId, displayName),
        ownerId: userId,
        isCustom: true,
        displayName,
        title: displayName,
        country: input.country?.trim().slice(0, 80) || null,
        city: input.city?.trim().slice(0, 80) || null,
        description: "Personal travel stamp.",
        // Keep the value compatible with the legacy enum-backed database;
        // ownership is represented by isCustom/ownerId, not category.
        category: "THEME",
        eligibilityRule: "USER_CUSTOM",
        ruleThreshold: 0,
        iconUrl,
        isActive: true,
      },
    });
    return tx.userTravelStamp.upsert({
      where: {
        userId_stampId_ownership: {
          userId,
          stampId: stamp.id,
          ownership: TravelStampOwnership.USER_MANAGED,
        },
      },
      update: {},
      create: {
        userId,
        stampId: stamp.id,
        displayOrder,
        evidenceMetadata: {
          source: "USER_CUSTOM",
          isPublic: input.isPublic !== false,
        },
      },
      include: { stamp: true },
    });
  });
  return toUserTravelStampDTO(created);
}

export async function updateCustomTravelStamp(
  userId: string,
  stampId: string,
  input: {
    displayName?: string | null;
    country?: string | null;
    city?: string | null;
    artworkUrl?: string | null;
    sourcePhotoId?: string | null;
  },
): Promise<UserTravelStampDTO> {
  const current = await prisma.userTravelStamp.findFirst({
    where: {
      userId,
      stampId,
      ownership: TravelStampOwnership.USER_MANAGED,
      stamp: { is: { isCustom: true, ownerId: userId } },
    },
    include: { stamp: true },
  });
  if (!current) throw AppError.notFound("Custom stamp not found.");
  const nextArtwork = input.artworkUrl || input.sourcePhotoId
    ? await resolveCustomStampArtwork(userId, input)
    : current.stamp.iconUrl || current.stamp.imageUrl;
  if (!nextArtwork) throw AppError.badRequest("Custom stamp artwork is required.");
  const updated = await prisma.travelStamp.update({
    where: { id: stampId },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName?.trim().slice(0, 60) || current.stamp.displayName, title: input.displayName?.trim().slice(0, 60) || current.stamp.title } : {}),
      ...(input.country !== undefined ? { country: input.country?.trim().slice(0, 80) || null } : {}),
      ...(input.city !== undefined ? { city: input.city?.trim().slice(0, 80) || null } : {}),
      ...(nextArtwork !== (current.stamp.iconUrl || current.stamp.imageUrl) ? { iconUrl: nextArtwork } : {}),
    },
  });
  const userStamp = await prisma.userTravelStamp.findUnique({ where: { id: current.id }, include: { stamp: true } });
  if (!userStamp) throw AppError.notFound("Custom stamp not found.");
  if (updated.iconUrl !== current.stamp.iconUrl && isOwnedCustomArtwork(current.stamp.iconUrl, userId)) {
    await deleteManagedMediaUrl(current.stamp.iconUrl).catch(() => {});
  }
  return toUserTravelStampDTO(userStamp);
}

export async function deleteCustomTravelStamp(userId: string, stampId: string): Promise<void> {
  const stamp = await prisma.travelStamp.findFirst({
    where: {
      id: stampId,
      ownerId: userId,
      isCustom: true,
      userStamps: { none: { ownership: TravelStampOwnership.SYSTEM_AWARDED } },
    },
  });
  if (!stamp) throw AppError.notFound("Custom stamp not found.");
  await prisma.travelStamp.delete({ where: { id: stamp.id } });
  if (isOwnedCustomArtwork(stamp.iconUrl, userId)) {
    await deleteManagedMediaUrl(stamp.iconUrl).catch(() => {});
  }
}

function isOwnedCustomArtwork(url: string | null | undefined, userId: string) {
  const parsed = parseManagedMediaUrl(url);
  return (
    parsed?.kind === "stamp-icons" &&
    parsed.visibility === "public" &&
    (parsed.fileName.split("/").at(-1) || "").startsWith(`custom_stamp_${userId}_`)
  );
}

export async function createManualTravelStamp(
  userId: string,
  input: {
    country: string;
    city?: string | null;
    visitDate?: string | null;
    description?: string | null;
  },
): Promise<UserTravelStampDTO> {
  const country = normalizeCountry(input.country);
  if (!country) throw AppError.badRequest("Choose a valid country.");
  const cityName = normalizeCityName(input.city);
  const visitDate = normalizeVisitDate(input.visitDate);
  const description = input.description?.trim().slice(0, 280) || null;
  const destination = await getOrCreateDestination({ ...country, cityName });
  await assertDestinationNotCollected(userId, destination);
  const stamp = await getOrCreateDestinationStamp(destination);
  await prisma.userDestination.upsert({
    where: {
      userId_destinationId_evidenceSource: {
        userId,
        destinationId: destination.id,
        evidenceSource: TravelEvidenceSource.MANUAL_DECLARATION,
      },
    },
    update: {
      verificationStatus: TravelVerificationStatus.UNVERIFIED,
      latestQualifyingVisitDate: visitDate || undefined,
      ...(visitDate ? { firstQualifyingVisitDate: visitDate } : {}),
    },
    create: {
      userId,
      destinationId: destination.id,
      evidenceSource: TravelEvidenceSource.MANUAL_DECLARATION,
      verificationStatus: TravelVerificationStatus.UNVERIFIED,
      firstQualifyingVisitDate: visitDate,
      latestQualifyingVisitDate: visitDate,
    },
  });
  const displayOrder = await prisma.userTravelStamp.count({
    where: { userId },
  });
  const created = await prisma.userTravelStamp.create({
    data: {
      userId,
      stampId: stamp.id,
      displayOrder,
      evidenceMetadata: manualEvidence({
        ...country,
        cityName,
        visitDate,
        personalDescription: description,
      }),
    },
    include: { stamp: true },
  });
  return toUserTravelStampDTO(created);
}

export async function updateManualTravelStamp(
  userId: string,
  userStampId: string,
  input: {
    country: string;
    city?: string | null;
    visitDate?: string | null;
    description?: string | null;
  },
): Promise<UserTravelStampDTO> {
  const current = await prisma.userTravelStamp.findFirst({
    where: { id: userStampId, userId },
    include: { stamp: true },
  });
  if (!current) throw AppError.notFound("Travel stamp not found.");
  if (current.ownership !== TravelStampOwnership.USER_MANAGED) {
    throw AppError.forbidden("System-awarded stamps cannot be edited.");
  }
  if (
    readStampEvidence(current.evidenceMetadata).source !== "MANUAL_DECLARATION"
  )
    throw AppError.badRequest("Only manually added stamps can be edited.");
  const country = normalizeCountry(input.country);
  if (!country) throw AppError.badRequest("Choose a valid country.");
  const cityName = normalizeCityName(input.city);
  const visitDate = normalizeVisitDate(input.visitDate);
  const description = input.description?.trim().slice(0, 280) || null;
  const destination = await getOrCreateDestination({ ...country, cityName });
  await assertDestinationNotCollected(userId, destination, userStampId);
  const stamp = await getOrCreateDestinationStamp(destination);
  const updated = await prisma.userTravelStamp.update({
    where: { id: userStampId },
    data: {
      stampId: stamp.id,
      evidenceMetadata: manualEvidence({
        ...country,
        cityName,
        visitDate,
        personalDescription: description,
        isPublic: readStampEvidence(current.evidenceMetadata).isPublic,
      }),
    },
    include: { stamp: true },
  });
  return toUserTravelStampDTO(updated);
}

export async function removeTravelStamp(
  userId: string,
  userStampId: string,
): Promise<void> {
  const result = await prisma.userTravelStamp.deleteMany({
    where: {
      id: userStampId,
      userId,
      ownership: TravelStampOwnership.USER_MANAGED,
    },
  });
  if (!result.count) {
    const exists = await prisma.userTravelStamp.findFirst({
      where: { id: userStampId, userId },
      select: { id: true },
    });
    if (exists) throw AppError.forbidden("System-awarded stamps cannot be removed.");
    throw AppError.notFound("Travel stamp not found.");
  }
}

export async function setStampPublic(
  userId: string,
  userStampId: string,
  isPublic: boolean,
): Promise<UserTravelStampDTO> {
  const current = await prisma.userTravelStamp.findFirst({
    where: { id: userStampId, userId },
    include: { stamp: true },
  });
  if (!current) throw AppError.notFound("Travel stamp not found.");
  const updated = await prisma.userTravelStamp.update({
    where: { id: userStampId },
    data: {
      evidenceMetadata: {
        ...readStampEvidence(current.evidenceMetadata),
        isPublic,
      },
    },
    include: { stamp: true },
  });
  return toUserTravelStampDTO(updated);
}

export async function reorderTravelStamps(
  userId: string,
  userStampIds: string[],
): Promise<UserTravelStampDTO[]> {
  const uniqueIds = [...new Set(userStampIds)];
  const owned = await prisma.userTravelStamp.findMany({
    where: { userId },
    select: { id: true },
  });
  if (
    uniqueIds.length !== owned.length ||
    uniqueIds.some((id) => !owned.some((stamp) => stamp.id === id))
  ) {
    throw AppError.badRequest("Stamp order does not match your collection.");
  }
  await prisma.$transaction(
    uniqueIds.map((id, displayOrder) =>
      prisma.userTravelStamp.update({ where: { id }, data: { displayOrder } }),
    ),
  );
  return getTravelerStamps(userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Travel Stamp Management
// ─────────────────────────────────────────────────────────────────────────────

export async function listAdminTravelStamps(filters: {
  search?: string;
  country?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE";
}): Promise<AdminTravelStampDTO[]> {
  await ensureStampCatalog();
  const needle = filters.search?.trim().toLowerCase();
  const country = filters.country?.trim().toLowerCase();
  const status = filters.status || "ALL";

  const stamps = await prisma.travelStamp.findMany({
    where: {
      ...(status === "ACTIVE"
        ? { isActive: true }
        : status === "INACTIVE"
          ? { isActive: false }
          : {}),
      ...(country && country !== "all"
        ? {
            OR: [
              { country: { equals: country, mode: "insensitive" } },
              { countryCode: { equals: country, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(needle
        ? {
            OR: [
              { displayName: { contains: needle, mode: "insensitive" } },
              { title: { contains: needle, mode: "insensitive" } },
              { city: { contains: needle, mode: "insensitive" } },
              { country: { contains: needle, mode: "insensitive" } },
              { description: { contains: needle, mode: "insensitive" } },
              { slug: { contains: needle, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: {
        select: { userStamps: true },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return stamps.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.displayName,
    title: s.title,
    city: s.city,
    country: s.country,
    countryCode: s.countryCode,
    destinationId: s.destinationId,
    description: s.description,
    iconUrl: s.iconUrl,
    imageUrl: s.imageUrl,
    category: s.category,
    isActive: s.isActive,
    displayOrder: s.displayOrder,
    collectorCount: s._count.userStamps,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

export async function createAdminTravelStamp(input: {
  displayName: string;
  title?: string | null;
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  description?: string | null;
  category?: string;
  iconUrl: string;
  imageUrl?: string | null;
  destinationId?: string | null;
  eligibilityRule?: string;
  ruleThreshold?: number;
  displayOrder?: number;
  isActive?: boolean;
}): Promise<TravelStampDTO> {
  const name = input.displayName.trim();
  if (!name) throw AppError.badRequest("Stamp name is required.");
  if (!input.iconUrl?.trim())
    throw AppError.badRequest("Stamp image/design is required.");
  if (input.destinationId) {
    const destination = await prisma.destination.findUnique({ where: { id: input.destinationId }, select: { id: true } });
    if (!destination) throw AppError.validation("Canonical destination mapping was not found.");
  }

  const baseSlug =
    "stamp-" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.travelStamp.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const created = await prisma.travelStamp.create({
    data: {
      slug,
      displayName: name,
      title: input.title?.trim() || name,
      country: input.country?.trim() || null,
      countryCode: input.countryCode?.trim() || null,
      city: input.city?.trim() || null,
      description: input.description?.trim() || null,
      category: input.category?.trim() || "DESTINATION",
      iconUrl: input.iconUrl.trim(),
      imageUrl: input.imageUrl?.trim() || null,
      destinationId: input.destinationId ?? null,
      eligibilityRule: input.eligibilityRule?.trim() || "COMPLETED_STAYS",
      ruleThreshold: input.ruleThreshold ?? 1,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });

  return {
    id: created.id,
    slug: created.slug,
    displayName: created.displayName,
    title: created.title,
    city: created.city,
    country: created.country,
    countryCode: created.countryCode,
    destinationId: created.destinationId,
    description: created.description,
    iconUrl: created.iconUrl,
    category: created.category,
    eligibilityRule: created.eligibilityRule,
    ruleThreshold: created.ruleThreshold,
    isActive: created.isActive,
    displayOrder: created.displayOrder,
  };
}

export async function updateAdminTravelStamp(
  id: string,
  input: {
    displayName?: string;
    title?: string | null;
    country?: string | null;
    countryCode?: string | null;
    city?: string | null;
    description?: string | null;
    category?: string;
    iconUrl?: string;
    imageUrl?: string | null;
    destinationId?: string | null;
    eligibilityRule?: string;
    ruleThreshold?: number;
    displayOrder?: number;
    isActive?: boolean;
  },
): Promise<TravelStampDTO> {
  const existing = await prisma.travelStamp.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Travel stamp not found.");
  if (input.destinationId) {
    const destination = await prisma.destination.findUnique({ where: { id: input.destinationId }, select: { id: true } });
    if (!destination) throw AppError.validation("Canonical destination mapping was not found.");
  }

  const updated = await prisma.travelStamp.update({
    where: { id },
    data: {
      ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
      ...(input.title !== undefined
        ? { title: input.title?.trim() || null }
        : {}),
      ...(input.country !== undefined
        ? { country: input.country?.trim() || null }
        : {}),
      ...(input.countryCode !== undefined
        ? { countryCode: input.countryCode?.trim() || null }
        : {}),
      ...(input.city !== undefined ? { city: input.city?.trim() || null } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.category ? { category: input.category.trim() } : {}),
      ...(input.iconUrl ? { iconUrl: input.iconUrl.trim() } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl?.trim() || null } : {}),
      ...(input.destinationId !== undefined ? { destinationId: input.destinationId || null } : {}),
      ...(input.eligibilityRule ? { eligibilityRule: input.eligibilityRule.trim() } : {}),
      ...(input.ruleThreshold !== undefined ? { ruleThreshold: input.ruleThreshold } : {}),
      ...(input.displayOrder !== undefined
        ? { displayOrder: input.displayOrder }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  return {
    id: updated.id,
    slug: updated.slug,
    displayName: updated.displayName,
    title: updated.title,
    city: updated.city,
    country: updated.country,
    countryCode: updated.countryCode,
    destinationId: updated.destinationId,
    description: updated.description,
    iconUrl: updated.iconUrl,
    category: updated.category,
    eligibilityRule: updated.eligibilityRule,
    ruleThreshold: updated.ruleThreshold,
    isActive: updated.isActive,
    displayOrder: updated.displayOrder,
  };
}

export async function toggleAdminTravelStampActive(
  id: string,
): Promise<TravelStampDTO> {
  const existing = await prisma.travelStamp.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Travel stamp not found.");

  const updated = await prisma.travelStamp.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  return {
    id: updated.id,
    slug: updated.slug,
    displayName: updated.displayName,
    title: updated.title,
    city: updated.city,
    country: updated.country,
    countryCode: updated.countryCode,
    destinationId: updated.destinationId,
    description: updated.description,
    iconUrl: updated.iconUrl,
    category: updated.category,
    eligibilityRule: updated.eligibilityRule,
    ruleThreshold: updated.ruleThreshold,
    isActive: updated.isActive,
    displayOrder: updated.displayOrder,
  };
}

export async function archiveAdminTravelStamp(id: string): Promise<void> {
  const existing = await prisma.travelStamp.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Travel stamp not found.");

  await prisma.travelStamp.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function deleteAdminTravelStamp(
  id: string,
): Promise<{ archived: boolean }> {
  const existing = await prisma.travelStamp.findUnique({
    where: { id },
    include: { _count: { select: { userStamps: true } } },
  });
  if (!existing) throw AppError.notFound("Travel stamp not found.");

  if (existing._count.userStamps > 0) {
    await prisma.travelStamp.update({
      where: { id },
      data: { isActive: false },
    });
    return { archived: true };
  }

  await prisma.travelStamp.delete({ where: { id } });
  return { archived: false };
}
