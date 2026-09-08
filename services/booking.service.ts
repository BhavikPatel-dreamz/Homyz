import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertOwnership } from "@/lib/permissions/authorize";
import { prisma } from "@/lib/db/prisma";
import { getOrSetCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";
import { CACHE_TTL } from "@/lib/redis/ttl";
import { invalidateBookingCache } from "@/lib/redis/invalidation";
import type { CreateBookingInput } from "@/lib/validation/booking";

import { toBookingDTO, type BookingDTO } from "./mappers";

import { BookingStatus, ListingStatus } from "@/generated/prisma/enums";

export type BookingQuote = {
  listingId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  weekdayNights: number;
  weekendNights: number;
  baseNightlyPrice: number; // cents
  weekendNightlyPrice: number | null; // cents
  nightlySubtotal: number; // cents
  cleaningFee: number; // cents
  totalPrice: number; // cents
  currency: string;
  guests: number;
  breakdown: Array<{
    date: string;
    isWeekend: boolean;
    price: number;
  }>;
};

export async function getBookingQuote(opts: {
  listingId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guests?: number;
}): Promise<BookingQuote> {
  const listing = await prisma.listing.findUnique({
    where: { id: opts.listingId },
  });

  if (!listing || !listing.published || listing.status !== ListingStatus.ACTIVE || listing.isPaused) {
    throw AppError.notFound("Listing is not available or does not exist");
  }

  const cIn = new Date(opts.checkIn);
  const cOut = new Date(opts.checkOut);

  if (isNaN(cIn.getTime()) || isNaN(cOut.getTime())) {
    throw AppError.badRequest("Invalid check-in or check-out date");
  }

  // Normalize to UTC start of day for deterministic night calculations
  cIn.setHours(0, 0, 0, 0);
  cOut.setHours(0, 0, 0, 0);

  const diffMs = cOut.getTime() - cIn.getTime();
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (nights < 1) {
    throw AppError.badRequest("Checkout date must be after check-in date");
  }

  const minN = listing.minNights || 1;
  const maxN = listing.maxNights || 365;

  if (nights < minN) {
    throw AppError.badRequest(`Minimum stay is ${minN} ${minN === 1 ? "night" : "nights"}`);
  }
  if (nights > maxN) {
    throw AppError.badRequest(`Maximum stay is ${maxN} ${maxN === 1 ? "night" : "nights"}`);
  }

  const requestedGuests = opts.guests ?? 1;
  if (requestedGuests > (listing.guests || 1)) {
    throw AppError.badRequest(`Property accommodates a maximum of ${listing.guests} guests`);
  }

  const basePrice = listing.price; // cents
  const weekendPrice = listing.weekendPrice && listing.weekendPrice > 0 ? listing.weekendPrice : null;
  const cleaningFee = listing.cleaningFee || 0; // cents

  let weekdayNights = 0;
  let weekendNights = 0;
  let nightlySubtotal = 0;
  const breakdown: BookingQuote["breakdown"] = [];

  for (let i = 0; i < nights; i++) {
    const nightDate = new Date(cIn.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = nightDate.getDay();
    // Saudi / Middle East weekend nights: Thursday (4) and Friday (5)
    const isWeekend = dayOfWeek === 4 || dayOfWeek === 5;

    let priceForNight = basePrice;
    if (isWeekend && weekendPrice !== null) {
      priceForNight = weekendPrice;
      weekendNights++;
    } else {
      weekdayNights++;
    }

    nightlySubtotal += priceForNight;
    breakdown.push({
      date: nightDate.toISOString().split("T")[0],
      isWeekend,
      price: priceForNight,
    });
  }

  const totalPrice = nightlySubtotal + cleaningFee;

  return {
    listingId: listing.id,
    checkIn: cIn.toISOString(),
    checkOut: cOut.toISOString(),
    nights,
    weekdayNights,
    weekendNights,
    baseNightlyPrice: basePrice,
    weekendNightlyPrice: weekendPrice,
    nightlySubtotal,
    cleaningFee,
    totalPrice,
    currency: "SAR",
    guests: requestedGuests,
    breakdown,
  };
}

async function create(
  actor: AuthUser,
  input: CreateBookingInput,
): Promise<BookingDTO> {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
  });
  if (!listing || !listing.published || listing.status !== ListingStatus.ACTIVE || listing.isPaused) {
    throw AppError.notFound("Listing is not available or does not exist");
  }

  // Host cannot book their own listing
  if (listing.hostId === actor.id) {
    throw AppError.badRequest("Hosts cannot book their own listings");
  }

  // Calculate authoritative quote
  const quote = await getBookingQuote({
    listingId: input.listingId,
    checkIn: input.startDate,
    checkOut: input.endDate,
    guests: input.guests,
  });

  // Verify no booking conflict (overlap check)
  const conflict = await prisma.booking.findFirst({
    where: {
      listingId: input.listingId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      startDate: { lt: input.endDate },
      endDate: { gt: input.startDate },
    },
  });

  if (conflict) {
    throw AppError.conflict("The selected dates are no longer available");
  }

  // Check against listing.blockedDates
  if (Array.isArray(listing.blockedDates) && listing.blockedDates.length > 0) {
    const blockedSet = new Set(listing.blockedDates);
    for (const item of quote.breakdown) {
      if (blockedSet.has(item.date)) {
        throw AppError.conflict(`The date ${item.date} is not available for booking`);
      }
    }
  }

  const booking = await prisma.booking.create({
    data: {
      userId: actor.id,
      listingId: input.listingId,
      startDate: input.startDate,
      endDate: input.endDate,
      guests: quote.guests,
      totalPrice: quote.totalPrice,
      nightlyPrice: quote.baseNightlyPrice,
      cleaningFee: quote.cleaningFee,
      currency: quote.currency,
      priceBreakdown: quote as any,
    },
  });

  // Invalidate booking caches after creation
  await invalidateBookingCache(booking.id, actor.id, listing.hostId);

  return toBookingDTO(booking);
}

// A user's own bookings cached with Cache-Aside pattern
async function listForUser(
  actor: AuthUser,
  opts: { skip: number; take: number },
): Promise<{ items: BookingDTO[]; total: number }> {
  const page = Math.floor(opts.skip / Math.max(1, opts.take)) + 1;
  const cacheKey = CACHE_KEYS.BOOKINGS_USER(actor.id, page);

  return getOrSetCache(
    cacheKey,
    async () => {
      const where = { userId: actor.id };
      const [items, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          skip: opts.skip,
          take: opts.take,
          include: { listing: true, user: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.booking.count({ where }),
      ]);
      return { items: items.map(toBookingDTO), total };
    },
    {
      ttl: CACHE_TTL.BOOKING_LIST,
    },
  );
}

async function getById(actor: AuthUser, id: string): Promise<BookingDTO> {
  const booking = await getOrSetCache(
    CACHE_KEYS.BOOKING(id),
    async () => {
      const b = await prisma.booking.findUnique({ where: { id } });
      if (!b) throw AppError.notFound("Booking not found");
      return toBookingDTO(b);
    },
    {
      ttl: CACHE_TTL.BOOKING_DETAIL,
    },
  );

  // Authorization check must run independently of cache
  assertOwnership(actor, booking.userId);
  return booking;
}

export const bookingService = {
  create,
  listForUser,
  getById,
  getQuote: getBookingQuote,
  getBookingQuote,
};
