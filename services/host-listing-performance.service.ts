import "server-only";

import { BookingStatus, ListingStatus, ReviewDirection, ReviewStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { differenceInBookingNights, bookingDateKey, parseBookingDate, shiftBookingDateKey } from "@/lib/booking/booking-date";
import { validateStayAvailability } from "@/lib/booking/availability";
import { resolvePropertyCurrency } from "@/lib/currency";
import { prisma } from "@/lib/db/prisma";
import { resolveNightlyPrice } from "@/lib/pricing/price-tips";
import { listingService } from "@/services/listing.service";
import { notificationService } from "@/services/notification.service";
import { NotificationType } from "@/generated/prisma/enums";
import { getListingAnalyticsSummary } from "@/services/listing-analytics.service";
import { accessibleHostListingWhere } from "@/lib/permissions/host-listing-access";

const MIN_COMPARABLES = 3;
const MAX_SEARCH_RESULTS_CHECKED = 100;
const COMPARISON_AMENITIES = ["wifi", "free_parking", "kitchen", "workspace", "air_conditioning"] as const;
const RATING_FIELDS = {
  cleanliness: "cleanlinessRating",
  accuracy: "accuracyRating",
  location: "locationRating",
  value: "valueRating",
} as const;

type RatingCategory = keyof typeof RATING_FIELDS;

export type ListingPerformanceQuickFix = {
  id: string;
  category: "PRICING" | "AMENITIES" | "REVIEWS";
  title: string;
  description: string;
  currentValueDescription: string;
  recommendedChangeDescription: string;
  actionLabel: string;
  actionHref: string;
  priority: "HIGH" | "MEDIUM";
};

export type ListingPerformanceData = {
  listing: { id: string; title: string; photo: string | null; city: string | null };
  context: { checkIn: string; checkOut: string; guests: number; sortBy: "recommended"; source: "Homyz public search" };
  searchRanking: {
    status: "OBSERVED" | "NOT_FOUND" | "NOT_ELIGIBLE" | "CONTEXT_UNAVAILABLE";
    position: number | null;
    resultCount: number;
    observedAt: string | null;
    message: string;
    history: Array<{ position: number | null; observedAt: string }>;
  };
  priceComparison: {
    status: "AVAILABLE" | "INSUFFICIENT_DATA";
    currency: string;
    yourNightlyPriceCents: number | null;
    comparableAverageNightlyPriceCents: number | null;
    comparableMedianNightlyPriceCents: number | null;
    comparableLowestNightlyPriceCents: number | null;
    comparableHighestNightlyPriceCents: number | null;
    differenceCents: number | null;
    differencePercentage: number | null;
    comparableCount: number;
    criteria: string[];
    observedAt: string;
    message: string;
  };
  advancedComparison: {
    status: "AVAILABLE" | "LOCKED";
    message: string;
  };
  comparisonBenchmarks: {
    ratingCategories: Partial<Record<RatingCategory, { yourRating: number; comparableAverage: number; comparableCount: number }>>;
    missingCommonAmenities: Array<{ amenity: string; comparableSharePercentage: number; comparableCount: number }>;
  };
  comparableListings: Array<{
    id: string;
    title: string;
    photo: string | null;
    nightlyPriceCents: number;
    amenities: string[];
    cancellationPolicy: string | null;
  }>;
  cancellationComparison: {
    yourPolicy: string | null;
    comparablePolicies: Array<{ policy: string; count: number }>;
    message: string;
  };
  pricingObservations: {
    extendedEmptyNights: { startDate: string; endDate: string; consecutiveNights: number } | null;
    approachingAvailableWeekend: { startDate: string; endDate: string } | null;
    leadTime: { sampleSize: number; typicalRange: string | null; medianDays: number | null; message: string };
  };
  searchPerformance: {
    status: "ACTIVE" | "DATA_UNAVAILABLE";
    message: string;
    trackingStartedAt: string | null;
    impressions: number;
    listingViews: number;
    clickThroughRatePercentage: number | null;
    attributedBookingConversionPercentage: number | null;
  };
  quickFixes: ListingPerformanceQuickFix[];
};

type PerformanceOptions = {
  listingId?: string | null;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  /** Server-resolved entitlement; never accepted from a browser query string. */
  includeAdvancedComparisons?: boolean;
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function defaultContext(listing: { guests: number }) {
  const today = bookingDateKey(new Date());
  const checkIn = shiftBookingDateKey(today, 21);
  return { checkIn, checkOut: shiftBookingDateKey(checkIn, 2), guests: Math.max(1, Math.min(listing.guests || 1, 2)) };
}

function validContext(checkIn: string, checkOut: string) {
  const start = parseBookingDate(checkIn);
  const end = parseBookingDate(checkOut);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start && differenceInBookingNights(start, end) >= 1;
}

async function getAccessibleListing(actor: AuthUser, listingId?: string | null) {
  const owned = await prisma.listing.findMany({
    where: accessibleHostListingWhere(actor),
    select: {
      id: true, title: true, photos: true, city: true, district: true, country: true, propertyType: true,
      guests: true, bedrooms: true, amenities: true, price: true, weekdayBasePrice: true, weekendPrice: true,
      weekendPremium: true, customPrices: true, published: true, status: true, isPaused: true, blockedDates: true,
      minNights: true, maxNights: true, advanceNotice: true, sameDayCutoff: true, allowSameDayRequests: true,
      discounts: true, cancellationPolicy: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!owned.length) return null;
  if (listingId) return owned.find((listing) => listing.id === listingId) ?? null;
  return owned.find((listing) => listing.published && listing.status === ListingStatus.ACTIVE && !listing.isPaused) ?? owned[0];
}

async function selectComparables(
  listing: NonNullable<Awaited<ReturnType<typeof getAccessibleListing>>>,
  context: { checkIn: string; checkOut: string; guests: number },
) {
  if (!listing.city?.trim() || !listing.propertyType?.trim()) return [];
  const now = new Date();
  const candidates = await prisma.listing.findMany({
    where: {
      id: { not: listing.id },
      deletedAt: null,
      published: true,
      status: ListingStatus.ACTIVE,
      isPaused: false,
      city: { equals: listing.city.trim(), mode: "insensitive" },
      propertyType: { equals: listing.propertyType.trim(), mode: "insensitive" },
      bedrooms: { gte: Math.max(0, listing.bedrooms - 1), lte: listing.bedrooms + 1 },
      guests: { gte: Math.max(context.guests, Math.max(1, listing.guests - 2)), lte: listing.guests + 2 },
      price: { gt: 0 },
      bookings: {
        none: {
          startDate: { lt: parseBookingDate(context.checkOut) },
          endDate: { gt: parseBookingDate(context.checkIn) },
          OR: [{ status: BookingStatus.CONFIRMED }, { status: BookingStatus.PENDING }],
        },
      },
    },
    select: {
      id: true, country: true, amenities: true, price: true, weekdayBasePrice: true, weekendPrice: true,
      weekendPremium: true, customPrices: true, guests: true, minNights: true, maxNights: true,
      advanceNotice: true, sameDayCutoff: true, allowSameDayRequests: true, blockedDates: true, discounts: true,
      title: true, photos: true, cancellationPolicy: true,
    },
    take: 100,
  });
  const currency = resolvePropertyCurrency(listing);
  return candidates.filter((candidate) => {
    if (resolvePropertyCurrency(candidate) !== currency) return false;
    return validateStayAvailability({ listing: candidate, ...context, now }).available;
  });
}

async function persistComparableObservations(input: {
  hostId: string; sourceListingId: string; checkIn: string; checkOut: string; currency: string;
  comparables: Array<{ id: string; nightlyPriceCents: number }>;
}) {
  const dayKey = new Date().toISOString().slice(0, 10);
  await Promise.all(input.comparables.map(async (comparable) => {
    const previous = await prisma.comparablePriceObservation.findFirst({
      where: { sourceListingId: input.sourceListingId, comparableListingId: comparable.id, checkIn: parseBookingDate(input.checkIn), checkOut: parseBookingDate(input.checkOut), currency: input.currency },
      orderBy: { observedAt: "desc" }, select: { nightlyPriceCents: true, observedAt: true },
    });
    await prisma.comparablePriceObservation.upsert({
      where: { observationKey: `${input.sourceListingId}:${comparable.id}:${input.checkIn}:${input.checkOut}:${dayKey}` },
      create: { hostId: input.hostId, sourceListingId: input.sourceListingId, comparableListingId: comparable.id, checkIn: parseBookingDate(input.checkIn), checkOut: parseBookingDate(input.checkOut), currency: input.currency, nightlyPriceCents: comparable.nightlyPriceCents, observationKey: `${input.sourceListingId}:${comparable.id}:${input.checkIn}:${input.checkOut}:${dayKey}` },
      update: {},
    });
    // The first observation is a baseline. Later notices are bounded to one
    // per comparable/stay context/day by the notification entity key.
    if (previous && previous.nightlyPriceCents !== comparable.nightlyPriceCents) {
      await notificationService.create({ userId: input.hostId, type: NotificationType.SYSTEM, title: "Comparable price changed", message: "A similar Homyz listing's observed price changed for your selected stay dates.", entityId: `comparable-price:${input.sourceListingId}:${comparable.id}:${input.checkIn}:${input.checkOut}:${dayKey}`, entityType: "comparable_price_change", link: `/host/insights/listing-performance?propertyId=${encodeURIComponent(input.sourceListingId)}&checkIn=${input.checkIn}&checkOut=${input.checkOut}`, metadata: { sourceListingId: input.sourceListingId, comparableListingId: comparable.id, checkIn: input.checkIn, checkOut: input.checkOut, previousNightlyPriceCents: previous.nightlyPriceCents, currentNightlyPriceCents: comparable.nightlyPriceCents, currency: input.currency } });
    }
  }));
}

function averageNightlyPrice(
  listing: { price: number; weekdayBasePrice: number | null; weekendPrice: number | null; weekendPremium: number | null; customPrices: unknown },
  context: { checkIn: string; checkOut: string },
) {
  const nights = differenceInBookingNights(context.checkIn, context.checkOut);
  if (nights < 1) return null;
  const customPrices = listing.customPrices && typeof listing.customPrices === "object" && !Array.isArray(listing.customPrices)
    ? listing.customPrices as Record<string, number> : null;
  const prices = Array.from({ length: nights }, (_, index) =>
    resolveNightlyPrice({ ...listing, customPrices }, shiftBookingDateKey(context.checkIn, index)).price,
  ).filter((price) => Number.isFinite(price) && price > 0);
  return prices.length === nights ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null;
}

async function getPricingObservations(listing: { id: string; blockedDates: string[] }, actor: AuthUser) {
  const today = bookingDateKey(new Date());
  const windowEnd = shiftBookingDateKey(today, 90);
  const bookings = await prisma.booking.findMany({
    where: { listingId: listing.id, status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] }, endDate: { gt: parseBookingDate(today) }, startDate: { lt: parseBookingDate(windowEnd) } },
    select: { startDate: true, endDate: true, createdAt: true, status: true }, take: 500,
  });
  const unavailable = new Set(listing.blockedDates || []);
  for (const booking of bookings) for (let key = bookingDateKey(booking.startDate); key < bookingDateKey(booking.endDate); key = shiftBookingDateKey(key, 1)) unavailable.add(key);
  let best: { startDate: string; endDate: string; consecutiveNights: number } | null = null;
  let currentStart: string | null = null; let count = 0;
  for (let key = today; key < windowEnd; key = shiftBookingDateKey(key, 1)) {
    if (unavailable.has(key)) { if (count >= 7 && (!best || count > best.consecutiveNights)) best = { startDate: currentStart!, endDate: key, consecutiveNights: count }; currentStart = null; count = 0; }
    else { if (!currentStart) currentStart = key; count++; }
  }
  if (count >= 7 && (!best || count > best.consecutiveNights)) best = { startDate: currentStart!, endDate: windowEnd, consecutiveNights: count };
  let weekend: { startDate: string; endDate: string } | null = null;
  for (let offset = 0; offset < 28; offset++) {
    const key = shiftBookingDateKey(today, offset); const date = parseBookingDate(key);
    if (date.getUTCDay() !== 5) continue;
    const end = shiftBookingDateKey(key, 2);
    if (![key, shiftBookingDateKey(key, 1)].some((night) => unavailable.has(night))) { weekend = { startDate: key, endDate: end }; break; }
  }
  const historical = await prisma.booking.findMany({ where: { listingId: listing.id, status: BookingStatus.CONFIRMED, startDate: { lte: new Date() } }, select: { createdAt: true, startDate: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const leadTimes = historical.map((booking) => Math.floor((booking.startDate.getTime() - booking.createdAt.getTime()) / 86_400_000)).filter((days) => days >= 0);
  const leadMedian = median(leadTimes);
  const leadTime = leadTimes.length >= 5 ? { sampleSize: leadTimes.length, medianDays: leadMedian, typicalRange: leadMedian === null ? null : leadMedian <= 7 ? "0–7 days before check-in" : leadMedian <= 14 ? "8–14 days before check-in" : leadMedian <= 30 ? "15–30 days before check-in" : "more than 30 days before check-in", message: "Based on confirmed bookings created for this listing." } : { sampleSize: leadTimes.length, medianDays: null, typicalRange: null, message: "Lead-time observations need at least five confirmed bookings." };
  const dayKey = new Date().toISOString().slice(0, 10);
  if (best) void notificationService.create({ userId: actor.id, type: NotificationType.SYSTEM, title: "Extended available nights", message: `Your listing has ${best.consecutiveNights} consecutive available nights from ${best.startDate}.`, entityId: `availability-gap:${listing.id}:${best.startDate}:${dayKey}`, entityType: "pricing_availability_alert", link: `/host/calendar?listingId=${encodeURIComponent(listing.id)}`, metadata: best }).catch(() => undefined);
  if (weekend) void notificationService.create({ userId: actor.id, type: NotificationType.SYSTEM, title: "Upcoming available weekend", message: `Your listing is available for the weekend starting ${weekend.startDate}.`, entityId: `available-weekend:${listing.id}:${weekend.startDate}:${dayKey}`, entityType: "pricing_availability_alert", link: `/host/calendar?listingId=${encodeURIComponent(listing.id)}`, metadata: weekend }).catch(() => undefined);
  return { extendedEmptyNights: best, approachingAvailableWeekend: weekend, leadTime };
}

export const hostListingPerformanceService = {
  async getListingPerformance(actor: AuthUser, options: PerformanceOptions = {}): Promise<ListingPerformanceData | null> {
    const listing = await getAccessibleListing(actor, options.listingId);
    if (!listing) return null;

    const fallback = defaultContext(listing);
    const context = {
      checkIn: options.checkIn || fallback.checkIn,
      checkOut: options.checkOut || fallback.checkOut,
      guests: Math.max(1, Math.min(options.guests || fallback.guests, listing.guests || 1)),
      sortBy: "recommended" as const,
      source: "Homyz public search" as const,
    };
    const now = new Date();
    const base = {
      listing: { id: listing.id, title: listing.title, photo: listing.photos[0] || null, city: listing.city },
      context,
    };

    const eligibleForSearch = listing.published && listing.status === ListingStatus.ACTIVE && !listing.isPaused && Boolean(listing.city?.trim());
    let searchRanking: ListingPerformanceData["searchRanking"];
    if (!eligibleForSearch || !validContext(context.checkIn, context.checkOut)) {
      searchRanking = {
        status: eligibleForSearch ? "CONTEXT_UNAVAILABLE" : "NOT_ELIGIBLE", position: null, resultCount: 0, observedAt: null,
        message: eligibleForSearch ? "Choose a valid future stay to observe this listing in search." : "Publish and activate this listing before search placement can be observed.",
        history: [],
      };
    } else {
      const results = await listingService.searchPublicListings({
        city: listing.city!, checkIn: context.checkIn, checkOut: context.checkOut, guests: context.guests,
        sortBy: context.sortBy, take: MAX_SEARCH_RESULTS_CHECKED, page: 1, includePriceRange: false,
      });
      const position = results.items.findIndex((item) => item.id === listing.id);
      const observedAt = now.toISOString();
      await prisma.listingSearchRankingObservation.create({
        data: {
          listingId: listing.id, hostId: actor.id, city: listing.city!, checkIn: context.checkIn, checkOut: context.checkOut,
          guests: context.guests, filters: { city: listing.city, checkIn: context.checkIn, checkOut: context.checkOut, guests: context.guests },
          sortBy: context.sortBy, resultPosition: position >= 0 ? position + 1 : null, resultCount: results.total,
        },
      });
      const history = await prisma.listingSearchRankingObservation.findMany({
        where: { listingId: listing.id, city: listing.city!, checkIn: context.checkIn, checkOut: context.checkOut, guests: context.guests, sortBy: context.sortBy },
        select: { resultPosition: true, observedAt: true }, orderBy: { observedAt: "desc" }, take: 12,
      });
      searchRanking = {
        status: position >= 0 ? "OBSERVED" : "NOT_FOUND", position: position >= 0 ? position + 1 : null, resultCount: results.total,
        observedAt, message: position >= 0
          ? `Observed in the ordered Homyz search results for this exact context.`
          : `Not found within the first ${Math.min(results.total, MAX_SEARCH_RESULTS_CHECKED)} checked results.`,
        history: history.reverse().map((item) => ({ position: item.resultPosition, observedAt: item.observedAt.toISOString() })),
      };
    }

    const comparables = validContext(context.checkIn, context.checkOut) ? await selectComparables(listing, context) : [];
    const yourNightlyPriceCents = averageNightlyPrice(listing, context);
    const comparablePrices = comparables.map((candidate) => averageNightlyPrice(candidate, context)).filter((price): price is number => price !== null);
    const enoughComparables = comparablePrices.length >= MIN_COMPARABLES;
    const comparableAverage = enoughComparables ? Math.round(average(comparablePrices)!) : null;
    const comparableMedian = enoughComparables ? median(comparablePrices) : null;
    const differenceCents = comparableAverage !== null && yourNightlyPriceCents !== null ? yourNightlyPriceCents - comparableAverage : null;
    const priceComparison: ListingPerformanceData["priceComparison"] = {
      status: enoughComparables && yourNightlyPriceCents !== null ? "AVAILABLE" : "INSUFFICIENT_DATA",
      currency: resolvePropertyCurrency(listing), yourNightlyPriceCents, comparableAverageNightlyPriceCents: comparableAverage,
      comparableMedianNightlyPriceCents: comparableMedian, differenceCents,
      comparableLowestNightlyPriceCents: enoughComparables ? Math.min(...comparablePrices) : null,
      comparableHighestNightlyPriceCents: enoughComparables ? Math.max(...comparablePrices) : null,
      differencePercentage: differenceCents !== null && comparableAverage ? rounded((differenceCents / comparableAverage) * 100) : null,
      comparableCount: comparablePrices.length,
      criteria: ["Same city", "Same property type", "Within one bedroom", "Compatible guest capacity", "Available for selected stay", "Same listing currency"],
      observedAt: now.toISOString(),
      message: enoughComparables && yourNightlyPriceCents !== null
        ? "Comparison uses available Similar Homyz Listings only; it is not a whole-market average."
        : "Not enough comparable listings available for this date range.",
    };
    if (priceComparison.status === "AVAILABLE" && priceComparison.differencePercentage !== null && Math.abs(priceComparison.differencePercentage) >= 10) {
      const todayKey = new Date().toISOString().slice(0, 10);
      void notificationService.create({
        userId: actor.id, type: NotificationType.SYSTEM, title: "Review your pricing", entityId: `comparable-price-difference:${listing.id}:${context.checkIn}:${context.checkOut}:${todayKey}`, entityType: "pricing_observation",
        message: `Your observed nightly price is ${Math.abs(priceComparison.differencePercentage)}% ${priceComparison.differencePercentage > 0 ? "above" : "below"} the comparable average for these stay dates.`,
        link: `/host/listings/${listing.id}/pricing`, metadata: { listingId: listing.id, checkIn: context.checkIn, checkOut: context.checkOut, differencePercentage: priceComparison.differencePercentage, comparableCount: priceComparison.comparableCount, currency: priceComparison.currency },
      }).catch(() => undefined);
    }

    const comparableIds = comparables.map((candidate) => candidate.id);
    const comparableListings = comparables.map((candidate) => ({
      id: candidate.id, title: candidate.title, photo: candidate.photos[0] || null,
      nightlyPriceCents: averageNightlyPrice(candidate, context), amenities: candidate.amenities, cancellationPolicy: candidate.cancellationPolicy,
    })).filter((candidate): candidate is { id: string; title: string; photo: string | null; nightlyPriceCents: number; amenities: string[]; cancellationPolicy: string | null } => candidate.nightlyPriceCents !== null).sort((left, right) => left.nightlyPriceCents - right.nightlyPriceCents).slice(0, 10);
    // Observations are durable only when the optional additive table is present.
    // A migration gap must not make listing performance unavailable.
    void persistComparableObservations({ hostId: actor.id, sourceListingId: listing.id, checkIn: context.checkIn, checkOut: context.checkOut, currency: resolvePropertyCurrency(listing), comparables: comparableListings }).catch(() => undefined);
    const reviews = comparableIds.length ? await prisma.review.findMany({
      where: { listingId: { in: comparableIds }, direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.PUBLISHED },
      select: { listingId: true, cleanlinessRating: true, accuracyRating: true, locationRating: true, valueRating: true },
    }) : [];
    const ownReviews = await prisma.review.findMany({
      where: { listingId: listing.id, direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.PUBLISHED },
      select: { cleanlinessRating: true, accuracyRating: true, locationRating: true, valueRating: true },
    });
    const ratingCategories: ListingPerformanceData["comparisonBenchmarks"]["ratingCategories"] = {};
    for (const [category, field] of Object.entries(RATING_FIELDS) as Array<[RatingCategory, (typeof RATING_FIELDS)[RatingCategory]]>) {
      const yourValues = ownReviews.map((review) => review[field]).filter((value): value is number => typeof value === "number");
      const comparableReviews = reviews.filter((review) => typeof review[field] === "number");
      const comparableValues = comparableReviews.map((review) => review[field] as number);
      const comparableListingCount = new Set(comparableReviews.map((review) => review.listingId)).size;
      const ownAverage = average(yourValues);
      const peerAverage = average(comparableValues);
      if (ownAverage !== null && peerAverage !== null && comparableListingCount >= MIN_COMPARABLES) {
        ratingCategories[category] = { yourRating: rounded(ownAverage), comparableAverage: rounded(peerAverage), comparableCount: comparableListingCount };
      }
    }
    const missingCommonAmenities = COMPARISON_AMENITIES.flatMap((amenity) => {
      if (listing.amenities.includes(amenity) || comparables.length < MIN_COMPARABLES) return [];
      const count = comparables.filter((candidate) => candidate.amenities.includes(amenity)).length;
      const share = Math.round((count / comparables.length) * 100);
      return share >= 60 ? [{ amenity, comparableSharePercentage: share, comparableCount: comparables.length }] : [];
    });

    const quickFixes: ListingPerformanceQuickFix[] = [];
    const valueRating = ratingCategories.value;
    if (valueRating && valueRating.yourRating < valueRating.comparableAverage) {
      quickFixes.push({
        id: `peer-value-${listing.id}`, category: "REVIEWS", priority: "HIGH", title: "Improve your Value Rating",
        description: "Your published Value rating is below the supported average for similar Homyz listings.",
        currentValueDescription: `Your rating: ${valueRating.yourRating.toFixed(1)}`,
        recommendedChangeDescription: `Similar listings: ${valueRating.comparableAverage.toFixed(1)} across ${valueRating.comparableCount} comparable listings. Review guest feedback about value, pricing, and listed amenities.`,
        actionLabel: "View Reviews", actionHref: `/host/insights?tab=reviews&propertyId=${encodeURIComponent(listing.id)}`,
      });
    }
    if (priceComparison.status === "AVAILABLE" && priceComparison.differencePercentage !== null && Math.abs(priceComparison.differencePercentage) >= 10) {
      const direction = priceComparison.differenceCents! > 0 ? "above" : "below";
      quickFixes.push({
        id: `peer-price-${listing.id}`, category: "PRICING", priority: "MEDIUM", title: "Review pricing against similar listings",
        description: `Your nightly price is ${Math.abs(priceComparison.differencePercentage)}% ${direction} the average of comparable Homyz listings for the selected stay.`,
        currentValueDescription: `Your nightly price: ${Math.round(priceComparison.yourNightlyPriceCents! / 100)} ${priceComparison.currency}`,
        recommendedChangeDescription: `Similar Homyz Listings average: ${Math.round(priceComparison.comparableAverageNightlyPriceCents! / 100)} ${priceComparison.currency}. Review pricing; no change is made automatically.`,
        actionLabel: "Review Pricing", actionHref: `/host/listings/${listing.id}/pricing`,
      });
    }
    for (const amenity of missingCommonAmenities) {
      quickFixes.push({
        id: `peer-amenity-${amenity.amenity}-${listing.id}`, category: "AMENITIES", priority: "MEDIUM", title: `Review ${amenity.amenity.replace(/_/g, " ")} availability`,
        description: `${amenity.comparableSharePercentage}% of the ${amenity.comparableCount} similar Homyz listings offer this amenity, but it is not listed on your property.`,
        currentValueDescription: `${amenity.amenity.replace(/_/g, " ")} is not listed`,
        recommendedChangeDescription: "Only add it after confirming that guests can truthfully use it.",
        actionLabel: "Manage Amenities", actionHref: `/host/listings/${listing.id}/amenities`,
      });
    }

    const policyCounts = new Map<string, number>();
    for (const comparable of comparableListings) {
      const policy = comparable.cancellationPolicy || "Not specified";
      policyCounts.set(policy, (policyCounts.get(policy) ?? 0) + 1);
    }
    const [pricingObservations, listingAnalytics] = await Promise.all([
      getPricingObservations(listing, actor),
      getListingAnalyticsSummary({ listingIds: [listing.id], startDate: new Date(Date.now() - 30 * 86_400_000), endDate: new Date() }),
    ]);
    const searchPerformance = { status: listingAnalytics.status, message: listingAnalytics.message, trackingStartedAt: listingAnalytics.trackingStartedAt, impressions: listingAnalytics.searchImpressions, listingViews: listingAnalytics.listingViews, clickThroughRatePercentage: listingAnalytics.searchImpressions > 0 ? Math.round((listingAnalytics.listingViews / listingAnalytics.searchImpressions) * 10_000) / 100 : null, attributedBookingConversionPercentage: listingAnalytics.conversionRatePercentage };
    const hasAdvancedComparisons = options.includeAdvancedComparisons === true;
    const advancedComparison = hasAdvancedComparisons
      ? { status: "AVAILABLE" as const, message: "Detailed comparison uses similar Homyz listings for the selected stay context." }
      : { status: "LOCKED" as const, message: "Detailed comparable listings, peer benchmarks, and booking lead-time analysis require Dashboard Plus." };
    const basicSearchRanking = hasAdvancedComparisons
      ? searchRanking
      : { ...searchRanking, history: [] };
    const basicPricingObservations = hasAdvancedComparisons
      ? pricingObservations
      : {
          ...pricingObservations,
          leadTime: {
            sampleSize: 0,
            medianDays: null,
            typicalRange: null,
            message: "Advanced booking lead-time analysis requires Dashboard Plus.",
          },
        };

    return {
      ...base,
      searchRanking: basicSearchRanking,
      priceComparison,
      advancedComparison,
      comparisonBenchmarks: hasAdvancedComparisons ? { ratingCategories, missingCommonAmenities } : { ratingCategories: {}, missingCommonAmenities: [] },
      comparableListings: hasAdvancedComparisons ? comparableListings : [],
      cancellationComparison: hasAdvancedComparisons
        ? { yourPolicy: listing.cancellationPolicy, comparablePolicies: Array.from(policyCounts.entries()).map(([policy, count]) => ({ policy, count })).sort((left, right) => right.count - left.count), message: "Cancellation terms are shown as configured by published similar Homyz listings; no policy is scored as better." }
        : { yourPolicy: listing.cancellationPolicy, comparablePolicies: [], message: "Comparable cancellation-policy benchmarking requires Dashboard Plus." },
      pricingObservations: basicPricingObservations,
      searchPerformance,
      quickFixes: hasAdvancedComparisons ? quickFixes : quickFixes.filter((fix) => fix.category === "PRICING"),
    };
  },
};
