import "server-only";

import { BookingStatus, ListingStatus, ReviewDirection, ReviewStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { differenceInBookingNights, bookingDateKey, parseBookingDate, shiftBookingDateKey } from "@/lib/booking/booking-date";
import { validateStayAvailability } from "@/lib/booking/availability";
import { resolvePropertyCurrency } from "@/lib/currency";
import { prisma } from "@/lib/db/prisma";
import { resolveNightlyPrice } from "@/lib/pricing/price-tips";
import { listingService } from "@/services/listing.service";

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
    differenceCents: number | null;
    differencePercentage: number | null;
    comparableCount: number;
    criteria: string[];
    observedAt: string;
    message: string;
  };
  comparisonBenchmarks: {
    ratingCategories: Partial<Record<RatingCategory, { yourRating: number; comparableAverage: number; comparableCount: number }>>;
    missingCommonAmenities: Array<{ amenity: string; comparableSharePercentage: number; comparableCount: number }>;
  };
  quickFixes: ListingPerformanceQuickFix[];
};

type PerformanceOptions = { listingId?: string | null; checkIn?: string; checkOut?: string; guests?: number };

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

async function getOwnedListing(actor: AuthUser, listingId?: string | null) {
  const owned = await prisma.listing.findMany({
    where: { hostId: actor.id, deletedAt: null },
    select: {
      id: true, title: true, photos: true, city: true, district: true, country: true, propertyType: true,
      guests: true, bedrooms: true, amenities: true, price: true, weekdayBasePrice: true, weekendPrice: true,
      weekendPremium: true, customPrices: true, published: true, status: true, isPaused: true, blockedDates: true,
      minNights: true, maxNights: true, advanceNotice: true, sameDayCutoff: true, allowSameDayRequests: true,
      discounts: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!owned.length) return null;
  if (listingId) return owned.find((listing) => listing.id === listingId) ?? null;
  return owned.find((listing) => listing.published && listing.status === ListingStatus.ACTIVE && !listing.isPaused) ?? owned[0];
}

async function selectComparables(
  listing: NonNullable<Awaited<ReturnType<typeof getOwnedListing>>>,
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
    },
    take: 100,
  });
  const currency = resolvePropertyCurrency(listing);
  return candidates.filter((candidate) => {
    if (resolvePropertyCurrency(candidate) !== currency) return false;
    return validateStayAvailability({ listing: candidate, ...context, now }).available;
  });
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

export const hostListingPerformanceService = {
  async getListingPerformance(actor: AuthUser, options: PerformanceOptions = {}): Promise<ListingPerformanceData | null> {
    const listing = await getOwnedListing(actor, options.listingId);
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
      differencePercentage: differenceCents !== null && comparableAverage ? rounded((differenceCents / comparableAverage) * 100) : null,
      comparableCount: comparablePrices.length,
      criteria: ["Same city", "Same property type", "Within one bedroom", "Compatible guest capacity", "Available for selected stay", "Same listing currency"],
      observedAt: now.toISOString(),
      message: enoughComparables && yourNightlyPriceCents !== null
        ? "Comparison uses available Similar Homyz Listings only; it is not a whole-market average."
        : "Not enough comparable listings available for this date range.",
    };

    const comparableIds = comparables.map((candidate) => candidate.id);
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

    return { ...base, searchRanking, priceComparison, comparisonBenchmarks: { ratingCategories, missingCommonAmenities }, quickFixes };
  },
};
