import { Prisma } from "@/generated/prisma/client";
import {
  BookingVisitEvidenceStatus,
  DestinationClassificationType,
  TaxonomyRecordStatus,
  TravelAchievementCategory,
  TravelAchievementDefinitionStatus,
  TravelAchievementStatus,
} from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import {
  generateDestinationSlug,
  normalizeCityName,
  normalizeCountry,
} from "@/services/travel-destination.service";

export const DESTINATION_INTELLIGENCE_DATASET_VERSION = "stayelite-destination-v1";

export type DestinationAchievementDefinition = {
  key: string;
  name: string;
  description: string;
  category: TravelAchievementCategory;
  threshold: number;
  kind: "CITY" | "CATEGORY" | "DISTINCT_CITY_CATEGORY" | "DISTINCT_CONTINENT" | "LISTING_CATEGORY";
  destinations?: ReadonlyArray<{ countryCode: string; citySlug: string }>;
  classificationType?: DestinationClassificationType;
  policyBlocked?: boolean;
};

export const CITY_STICKER_DEFINITIONS: readonly DestinationAchievementDefinition[] = [
  { key: "STICKER_PARISIAN_PULSE_V1", name: "Parisian Pulse", description: "A verified stay in Paris, France.", category: TravelAchievementCategory.CITIES, threshold: 1, kind: "CITY", destinations: [{ countryCode: "FR", citySlug: "paris" }] },
  { key: "STICKER_LONDON_CALLING_V1", name: "London Calling", description: "A verified stay in London, United Kingdom.", category: TravelAchievementCategory.CITIES, threshold: 1, kind: "CITY", destinations: [{ countryCode: "GB", citySlug: "london" }] },
  { key: "STICKER_STATUE_SEEKER_V1", name: "Statue Seeker", description: "A verified stay in New York, United States.", category: TravelAchievementCategory.CITIES, threshold: 1, kind: "CITY", destinations: [{ countryCode: "US", citySlug: "new-york" }] },
  { key: "STICKER_DESERT_DREAMS_V1", name: "Desert Dreams", description: "A verified stay in Riyadh or Dubai.", category: TravelAchievementCategory.CITIES, threshold: 1, kind: "CITY", destinations: [{ countryCode: "SA", citySlug: "riyadh" }, { countryCode: "AE", citySlug: "dubai" }] },
  { key: "STICKER_TOKYO_LIGHTS_V1", name: "Tokyo Lights", description: "A verified stay in Tokyo, Japan.", category: TravelAchievementCategory.CITIES, threshold: 1, kind: "CITY", destinations: [{ countryCode: "JP", citySlug: "tokyo" }] },
  { key: "STICKER_MIAMI_HEAT_V1", name: "Miami Heat", description: "A verified stay in Miami, United States.", category: TravelAchievementCategory.CITIES, threshold: 1, kind: "CITY", destinations: [{ countryCode: "US", citySlug: "miami" }] },
  { key: "STICKER_GOLDEN_VIEW_V1", name: "Golden View", description: "A verified stay in San Francisco, United States.", category: TravelAchievementCategory.CITIES, threshold: 1, kind: "CITY", destinations: [{ countryCode: "US", citySlug: "san-francisco" }] },
  { key: "STICKER_VENEZIA_VIBES_V1", name: "Venezia Vibes", description: "A verified stay in Venice, Italy.", category: TravelAchievementCategory.CITIES, threshold: 1, kind: "CITY", destinations: [{ countryCode: "IT", citySlug: "venice" }] },
];

export const GEOGRAPHICAL_STICKER_DEFINITIONS: readonly DestinationAchievementDefinition[] = [
  { key: "STICKER_BEACH_BUM_V1", name: "Beach Bum", description: "A verified stay at an active curated beach destination.", category: TravelAchievementCategory.EXPLORER, threshold: 1, kind: "CATEGORY", classificationType: DestinationClassificationType.BEACH, policyBlocked: true },
  { key: "STICKER_MOUNTAIN_MOVER_V1", name: "Mountain Mover", description: "A verified stay at an active curated mountain destination.", category: TravelAchievementCategory.EXPLORER, threshold: 1, kind: "CATEGORY", classificationType: DestinationClassificationType.MOUNTAIN, policyBlocked: true },
  { key: "STICKER_CITY_LIGHTS_V1", name: "City Lights", description: "Five distinct curated metropolitan cities.", category: TravelAchievementCategory.EXPLORER, threshold: 5, kind: "DISTINCT_CITY_CATEGORY", classificationType: DestinationClassificationType.METROPOLITAN, policyBlocked: true },
  { key: "STICKER_NATURE_NOMAD_V1", name: "Nature Nomad", description: "A verified stay at a curated nature-surrounded property.", category: TravelAchievementCategory.EXPLORER, threshold: 1, kind: "LISTING_CATEGORY", classificationType: DestinationClassificationType.NATURE, policyBlocked: true },
  { key: "STICKER_CULTURAL_EXPLORER_V1", name: "Cultural Explorer", description: "A verified stay at an active curated cultural destination.", category: TravelAchievementCategory.EXPLORER, threshold: 1, kind: "CATEGORY", classificationType: DestinationClassificationType.CULTURAL, policyBlocked: true },
  { key: "STICKER_CONTINENT_COLLECTOR_V1", name: "Continent Collector", description: "Three distinct curated continents.", category: TravelAchievementCategory.EXPLORER, threshold: 3, kind: "DISTINCT_CONTINENT", classificationType: DestinationClassificationType.CONTINENT, policyBlocked: true },
];

export const DESTINATION_ACHIEVEMENT_DEFINITIONS = [
  ...CITY_STICKER_DEFINITIONS,
  ...GEOGRAPHICAL_STICKER_DEFINITIONS,
] as const;

const KNOWN_CITY_ALIASES: ReadonlyArray<{ countryCode: string; citySlug: string; aliases: readonly string[] }> = [
  { countryCode: "FR", citySlug: "paris", aliases: ["Paris", "Paris City"] },
  { countryCode: "GB", citySlug: "london", aliases: ["London", "Greater London"] },
  { countryCode: "US", citySlug: "new-york", aliases: ["New York", "New York City", "NYC"] },
  { countryCode: "SA", citySlug: "riyadh", aliases: ["Riyadh"] },
  { countryCode: "AE", citySlug: "dubai", aliases: ["Dubai", "Dubai City"] },
  { countryCode: "JP", citySlug: "tokyo", aliases: ["Tokyo", "Tokyo Metropolis"] },
  { countryCode: "US", citySlug: "miami", aliases: ["Miami", "City of Miami"] },
  { countryCode: "US", citySlug: "san-francisco", aliases: ["San Francisco", "San Francisco City"] },
  { countryCode: "IT", citySlug: "venice", aliases: ["Venice", "Venezia"] },
];

export function normalizeDestinationAlias(value: string): string {
  return value.normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export type CanonicalDestinationResolution = {
  status: "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS";
  reason?: string;
  countryCode?: string;
  countryName?: string;
  citySlug?: string;
  cityName?: string;
  destinationId?: string;
  matchedBy?: "DESTINATION" | "ALIAS" | "CURATED_ALIAS";
};

export function resolveCuratedCityAlias(input: {
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
}): CanonicalDestinationResolution {
  const country = normalizeCountry(input.country, input.countryCode);
  const city = normalizeCityName(input.city);
  if (!country || !city) return { status: "UNRESOLVED", reason: "COUNTRY_AND_CITY_REQUIRED" };
  const normalizedAlias = normalizeDestinationAlias(city);
  const curated = KNOWN_CITY_ALIASES.find((entry) =>
    entry.countryCode === country.countryCode && entry.aliases.some((aliasValue) => normalizeDestinationAlias(aliasValue) === normalizedAlias),
  );
  if (!curated) return { status: "UNRESOLVED", reason: "NO_COUNTRY_SCOPED_CANONICAL_MATCH", countryCode: country.countryCode };
  return {
    status: "RESOLVED", countryCode: country.countryCode, countryName: country.countryName,
    citySlug: curated.citySlug, cityName: city, matchedBy: "CURATED_ALIAS",
  };
}

/** Country is mandatory: city strings are never globally matched. */
export async function resolveCanonicalDestination(input: {
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
}): Promise<CanonicalDestinationResolution> {
  const country = normalizeCountry(input.country, input.countryCode);
  const city = normalizeCityName(input.city);
  if (!country || !city) {
    return { status: "UNRESOLVED", reason: "COUNTRY_AND_CITY_REQUIRED" };
  }
  const normalizedAlias = normalizeDestinationAlias(city);
  const now = new Date();
  const alias = await prisma.destinationAlias.findFirst({
    where: {
      countryCode: country.countryCode,
      normalizedAlias,
      status: TaxonomyRecordStatus.ACTIVE,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    include: { destination: true },
    orderBy: { datasetVersion: "desc" },
  });
  if (alias) {
    return {
      status: "RESOLVED", countryCode: country.countryCode, countryName: country.countryName,
      citySlug: alias.destination.slug.replace(`city-${country.countryCode.toLowerCase()}-`, ""),
      cityName: alias.destination.cityName ?? city, destinationId: alias.destinationId, matchedBy: "ALIAS",
    };
  }

  const direct = await prisma.destination.findUnique({
    where: { slug: generateDestinationSlug(country.countryCode, city) },
  });
  if (direct) {
    return { status: "RESOLVED", countryCode: country.countryCode, countryName: country.countryName, citySlug: direct.slug.replace(`city-${country.countryCode.toLowerCase()}-`, ""), cityName: direct.cityName ?? city, destinationId: direct.id, matchedBy: "DESTINATION" };
  }
  return resolveCuratedCityAlias({ countryCode: country.countryCode, country: country.countryName, city });
}

type EvidenceInput = { id: string; destinationId: string | null; listingId: string; countryCode: string | null; cityName: string | null; status: BookingVisitEvidenceStatus };
type ClassificationInput = { subject: string; destinationId: string | null; listingId: string | null; countryCode: string | null; classificationType: DestinationClassificationType; classificationValue: string | null };

export type DestinationAchievementProgress = {
  key: string;
  progress: number;
  threshold: number;
  status: TravelAchievementStatus;
  evidenceIds: string[];
  blockedByPolicy: boolean;
  reason?: string;
};

function citySlugForEvidence(evidence: EvidenceInput): string | null {
  if (!evidence.countryCode || !evidence.cityName) return null;
  return generateDestinationSlug(evidence.countryCode, evidence.cityName).replace(`city-${evidence.countryCode.toLowerCase()}-`, "");
}

function hasClassification(evidence: EvidenceInput, classifications: readonly ClassificationInput[], type: DestinationClassificationType, scope: "DESTINATION" | "LISTING" | "COUNTRY" = "DESTINATION") {
  return classifications.some((item) =>
    item.classificationType === type && item.subject === scope && (
      scope === "DESTINATION" ? item.destinationId === evidence.destinationId :
      scope === "LISTING" ? item.listingId === evidence.listingId :
      item.countryCode === evidence.countryCode
    ),
  );
}

export function evaluateDestinationAchievementProgress(input: {
  evidence: readonly EvidenceInput[];
  classifications: readonly ClassificationInput[];
  earnedDefinitionKeys?: ReadonlySet<string>;
}): DestinationAchievementProgress[] {
  const evidence = input.evidence.filter((row) => row.status === BookingVisitEvidenceStatus.QUALIFIED);
  const earned = input.earnedDefinitionKeys ?? new Set<string>();
  return DESTINATION_ACHIEVEMENT_DEFINITIONS.map((definition) => {
    let matching = evidence;
    if (definition.kind === "CITY") {
      matching = evidence.filter((row) => definition.destinations?.some((destination) =>
        destination.countryCode === row.countryCode && destination.citySlug === citySlugForEvidence(row),
      ));
    } else if (definition.kind === "CATEGORY") {
      matching = evidence.filter((row) => hasClassification(row, input.classifications, definition.classificationType!));
    } else if (definition.kind === "LISTING_CATEGORY") {
      matching = evidence.filter((row) => hasClassification(row, input.classifications, definition.classificationType!, "LISTING"));
    }
    const progress = definition.kind === "DISTINCT_CITY_CATEGORY"
      ? new Set(evidence.filter((row) => hasClassification(row, input.classifications, definition.classificationType!)).map((row) => row.destinationId).filter(Boolean)).size
      : definition.kind === "DISTINCT_CONTINENT"
        ? new Set(evidence.flatMap((row) => input.classifications.filter((item) => item.subject === "COUNTRY" && item.classificationType === DestinationClassificationType.CONTINENT && item.countryCode === row.countryCode).map((item) => item.classificationValue).filter(Boolean))).size
        : matching.length;
    const capped = Math.min(progress, definition.threshold);
    const isEarned = earned.has(definition.key);
    return {
      key: definition.key,
      progress: capped,
      threshold: definition.threshold,
      status: isEarned ? TravelAchievementStatus.UNLOCKED : capped >= definition.threshold ? TravelAchievementStatus.ELIGIBLE : capped > 0 ? TravelAchievementStatus.IN_PROGRESS : TravelAchievementStatus.LOCKED,
      evidenceIds: matching.map((row) => row.id),
      blockedByPolicy: Boolean(definition.policyBlocked),
      reason: definition.policyBlocked ? "TAXONOMY_AND_COMPLETION_POLICY_NOT_APPROVED_FOR_PRODUCTION_AWARDING" : undefined,
    };
  });
}

export async function evaluateDestinationAchievementsForEvidence(evidenceId: string, options: { includeCandidateEvidence?: boolean } = {}) {
  const target = await prisma.bookingVisitEvidence.findUnique({ where: { id: evidenceId } });
  if (!target) throw AppError.notFound("Booking visit evidence not found.");
  if (target.status !== BookingVisitEvidenceStatus.QUALIFIED && !options.includeCandidateEvidence) {
    return { evidenceId, evaluated: false, reason: "COMPLETION_POLICY_PENDING", results: [] as DestinationAchievementProgress[] };
  }
  const allowedStatuses = options.includeCandidateEvidence
    ? [BookingVisitEvidenceStatus.QUALIFIED, BookingVisitEvidenceStatus.CANDIDATE]
    : [BookingVisitEvidenceStatus.QUALIFIED];
  const evidence = await prisma.bookingVisitEvidence.findMany({ where: { userId: target.userId, status: { in: allowedStatuses } } });
  const destinationIds = evidence.map((row) => row.destinationId).filter((id): id is string => Boolean(id));
  const listingIds = evidence.map((row) => row.listingId);
  const countryCodes = evidence.map((row) => row.countryCode).filter((code): code is string => Boolean(code));
  const classifications = await prisma.destinationClassification.findMany({
    where: {
      status: TaxonomyRecordStatus.ACTIVE,
      OR: [{ destinationId: { in: destinationIds } }, { listingId: { in: listingIds } }, { countryCode: { in: countryCodes } }],
    },
    select: { subject: true, destinationId: true, listingId: true, countryCode: true, classificationType: true, classificationValue: true },
  });
  const awards = await prisma.achievementAward.findMany({ where: { userId: target.userId, status: "ACTIVE" }, include: { achievement: { select: { key: true } } } });
  return {
    evidenceId,
    evaluated: true,
    results: evaluateDestinationAchievementProgress({ evidence, classifications, earnedDefinitionKeys: new Set(awards.map((award) => award.achievement.key)) }),
  };
}

/** Explicit catalog seed; never called by profile reads, booking flow, or jobs. */
export async function seedDestinationAchievementDefinitions() {
  for (const definition of DESTINATION_ACHIEVEMENT_DEFINITIONS) {
    await prisma.travelAchievement.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key, name: definition.name, description: definition.description,
        category: definition.category, eligibilityRule: "DESTINATION_INTELLIGENCE", threshold: definition.threshold,
        isActive: false, definitionStatus: TravelAchievementDefinitionStatus.DRAFT, awardEnabled: false,
        eligibilityMetadata: { datasetVersion: DESTINATION_INTELLIGENCE_DATASET_VERSION, kind: definition.kind, destinations: definition.destinations ?? [], classificationType: definition.classificationType ?? null, policyBlocked: Boolean(definition.policyBlocked) },
      },
      update: {},
    });
  }
  return { seededDefinitions: DESTINATION_ACHIEVEMENT_DEFINITIONS.length, activatedDefinitions: 0 };
}

export async function getActiveCountryLanguages(countryCode: string) {
  return prisma.countryLanguageMapping.findMany({
    where: { countryCode: countryCode.toUpperCase(), status: TaxonomyRecordStatus.ACTIVE },
    orderBy: [{ kind: "asc" }, { languageCode: "asc" }],
  });
}

function assertTaxonomyManager(actor: AuthUser) {
  if (actor.role !== "ADMIN") throw AppError.forbidden("Only an authorized administrator may manage destination taxonomy.");
}

function assertExactlyOneSubject(input: { destinationId?: string | null; listingId?: string | null; countryCode?: string | null }) {
  if ([input.destinationId, input.listingId, input.countryCode].filter(Boolean).length !== 1) {
    throw AppError.validation("A taxonomy classification must target exactly one destination, listing, or country.");
  }
}

/** Backend-only admin readiness boundary; there is intentionally no public route. */
export async function upsertDestinationClassification(
  actor: AuthUser,
  input: {
    revisionKey: string;
    destinationId?: string | null;
    listingId?: string | null;
    countryCode?: string | null;
    classificationType: DestinationClassificationType;
    classificationValue?: string | null;
    datasetVersion: string;
    sourceReference: string;
    status?: TaxonomyRecordStatus;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
  },
) {
  assertTaxonomyManager(actor);
  assertExactlyOneSubject(input);
  const subject = input.destinationId ? "DESTINATION" : input.listingId ? "LISTING" : "COUNTRY";
  return prisma.destinationClassification.upsert({
    where: { revisionKey: input.revisionKey },
    create: {
      ...input,
      countryCode: input.countryCode?.toUpperCase() ?? null,
      subject,
      status: input.status ?? TaxonomyRecordStatus.ACTIVE,
      effectiveFrom: input.effectiveFrom ?? new Date(),
    },
    update: {
      classificationValue: input.classificationValue ?? null,
      datasetVersion: input.datasetVersion,
      sourceReference: input.sourceReference,
      status: input.status ?? TaxonomyRecordStatus.ACTIVE,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      effectiveTo: input.effectiveTo ?? null,
    },
  });
}

export interface DestinationIntelligenceReconciliationSummary {
  scannedEvidenceCount: number;
  qualifiedEvidenceCount: number;
  candidateEvidenceCount: number;
  unresolvedDestinationCount: number;
  missingTaxonomyEvidenceIds: string[];
  duplicateDefinitionKeys: string[];
  userProgress: Array<{ userId: string; results: DestinationAchievementProgress[] }>;
  nextCursor: string | null;
}

/**
 * Bounded report-only reconciliation. It never creates awards, changes
 * evidence, or turns a candidate stay into a qualified stay.
 */
export async function reconcileDestinationAchievementIntelligence(options: {
  userId?: string;
  cursor?: string;
  limit?: number;
} = {}): Promise<DestinationIntelligenceReconciliationSummary> {
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  const evidence = await prisma.bookingVisitEvidence.findMany({
    where: { ...(options.userId ? { userId: options.userId } : {}), ...(options.cursor ? { id: { gt: options.cursor } } : {}) },
    orderBy: { id: "asc" },
    take: limit,
  });
  const destinationIds = evidence.map((row) => row.destinationId).filter((id): id is string => Boolean(id));
  const listingIds = evidence.map((row) => row.listingId);
  const countryCodes = evidence.map((row) => row.countryCode).filter((code): code is string => Boolean(code));
  const classifications = await prisma.destinationClassification.findMany({
    where: { status: TaxonomyRecordStatus.ACTIVE, OR: [{ destinationId: { in: destinationIds } }, { listingId: { in: listingIds } }, { countryCode: { in: countryCodes } }] },
    select: { subject: true, destinationId: true, listingId: true, countryCode: true, classificationType: true, classificationValue: true },
  });
  const users = [...new Set(evidence.map((row) => row.userId))];
  const awards = users.length ? await prisma.achievementAward.findMany({ where: { userId: { in: users }, status: "ACTIVE" }, include: { achievement: { select: { key: true } } } }) : [];
  const userProgress = users.map((userId) => ({
    userId,
    results: evaluateDestinationAchievementProgress({
      evidence: evidence.filter((row) => row.userId === userId),
      classifications,
      earnedDefinitionKeys: new Set(awards.filter((award) => award.userId === userId).map((award) => award.achievement.key)),
    }),
  }));
  const definitionKeys = DESTINATION_ACHIEVEMENT_DEFINITIONS.map((definition) => definition.key);
  const duplicateDefinitionKeys = definitionKeys.filter((key, index) => definitionKeys.indexOf(key) !== index);
  const taxonomyTypes = new Set(classifications.map((row) => row.classificationType));
  const missingTaxonomyEvidenceIds = evidence
    .filter((row) => row.status === BookingVisitEvidenceStatus.QUALIFIED && !row.destinationId)
    .map((row) => row.id)
    .concat(evidence.filter((row) => row.status === BookingVisitEvidenceStatus.QUALIFIED && taxonomyTypes.size === 0).map((row) => row.id));
  return {
    scannedEvidenceCount: evidence.length,
    qualifiedEvidenceCount: evidence.filter((row) => row.status === BookingVisitEvidenceStatus.QUALIFIED).length,
    candidateEvidenceCount: evidence.filter((row) => row.status === BookingVisitEvidenceStatus.CANDIDATE).length,
    unresolvedDestinationCount: evidence.filter((row) => !row.destinationId).length,
    missingTaxonomyEvidenceIds: [...new Set(missingTaxonomyEvidenceIds)],
    duplicateDefinitionKeys,
    userProgress,
    nextCursor: evidence.length === limit ? evidence.at(-1)?.id ?? null : null,
  };
}
