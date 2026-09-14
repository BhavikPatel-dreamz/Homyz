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
import type { Prisma } from "@/generated/prisma/client";
import { resolveTaxJurisdiction } from "@/lib/tax/jurisdiction-resolver";
import { TaxCalculator } from "@/lib/tax/tax-calculator";
import type { CalculatedTaxItem, HostPayoutBreakdown, ListingTaxDTO } from "@/lib/tax/types";
import { getHostServiceFeePercentage } from "@/services/app-settings.service";
import { calculateBookingPrice, type AppliedDiscount, type NightRateBreakdown } from "@/services/pricing.service";

export type BookingQuote = {
  listingId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  weekdayNights: number;
  weekendNights: number;
  customPricedNights?: number;
  baseNightlyPrice: number; // cents
  weekdayBasePrice?: number; // cents
  weekendNightlyPrice: number | null; // cents
  nightlySubtotal: number; // cents
  discountAmount: number; // cents
  discountPercentage: number;
  appliedDiscount?: AppliedDiscount | null;
  cleaningFee: number; // cents
  extraGuestFee?: number; // cents
  hostServiceFee: number; // cents
  hostServiceFeePercentage: number; // percentage e.g. 15
  subtotal: number; // nightlySubtotal - discountAmount + cleaningFee (cents)
  totalPrice: number; // cents (totalPrice before tax for compatibility)
  taxes: CalculatedTaxItem[];
  taxTotal: number; // total tax in cents
  platformRemittedTaxTotal: number; // taxes platform collects & remits
  hostRemittedTaxTotal: number; // taxes host collects & remits
  guestTotal: number; // stayAmount + cleaningFee + taxTotal + hostServiceFee (cents)
  payoutBreakdown?: HostPayoutBreakdown;
  currency: string;
  guests: number;
  pets: number;
  cancellationPolicy: string;
  cancellationPolicyType: "SHORT_TERM" | "LONG_TERM";
  breakdown: Array<{
    date: string;
    isWeekend: boolean;
    price: number;
    rateSource?: "CUSTOM" | "WEEKEND" | "WEEKDAY";
  }>;
};

export async function getBookingQuote(opts: {
  listingId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guests?: number;
  pets?: number;
}): Promise<BookingQuote> {
  const listing = await prisma.listing.findUnique({
    where: { id: opts.listingId },
    include: { taxes: { where: { isActive: true } } },
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
  const baseGuests = listing.guests || 1;
  const extraGuestFeeRate = (listing as any).extraGuestFee ?? 0;
  if (requestedGuests > baseGuests && extraGuestFeeRate <= 0) {
    throw AppError.badRequest(`Property accommodates a maximum of ${baseGuests} guests`);
  }

  const requestedPets = opts.pets ?? 0;
  if (requestedPets > 0) {
    if (listing.petsAllowed === false) {
      throw AppError.badRequest("Pets are not allowed at this property");
    }
    if (listing.maxPets !== null && requestedPets > listing.maxPets) {
      throw AppError.badRequest(`Property accommodates a maximum of ${listing.maxPets} pets`);
    }
  }

  const cancellationPolicyType = nights >= 28 ? "LONG_TERM" : "SHORT_TERM";
  const cancellationPolicy = cancellationPolicyType === "LONG_TERM"
    ? listing.longTermCancellationPolicy || "FIRM"
    : listing.cancellationPolicy || "FLEXIBLE";

  // Resolve jurisdiction and compute deterministic taxes
  const resolved = resolveTaxJurisdiction({
    country: listing.country,
    city: listing.city,
    postalCode: listing.postalCode,
    district: listing.district,
  });

  const hostTaxes: ListingTaxDTO[] = (listing.taxes || []).map((t: any) => ({
    id: t.id,
    listingId: t.listingId,
    taxRuleId: t.taxRuleId,
    customName: t.customName,
    taxType: t.taxType,
    calculationMethod: t.calculationMethod,
    rate: t.rate,
    amount: t.amount,
    taxableComponents: t.taxableComponents as any,
    remittanceResponsibility: t.remittanceResponsibility,
    maximumAmountPerPersonPerNight: t.maximumAmountPerPersonPerNight,
    partialStayExemptionNights: t.partialStayExemptionNights,
    fullStayExemptionNights: t.fullStayExemptionNights,
    longStayExemptionNights: t.longStayExemptionNights,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const usesManualAdjustments = listing.smartPricing !== true;
  const pricing = await calculateBookingPrice({
    checkIn: cIn,
    checkOut: cOut,
    weekdayBasePrice: (listing as any).weekdayBasePrice ?? listing.price,
    weekendPrice: usesManualAdjustments ? listing.weekendPrice : null,
    customPrices: (listing as any).customPrices as Record<string, number> | null,
    cleaningFee: listing.cleaningFee,
    extraGuestFee: (listing as any).extraGuestFee,
    baseGuests,
    guests: requestedGuests,
    pets: requestedPets,
    petFee: listing.petFee,
    discounts: usesManualAdjustments ? (listing.discounts as Record<string, unknown> | null) : null,
    taxRules: resolved.systemRules,
    hostTaxes,
    currency: "SAR",
  });

  const subtotal = pricing.accommodationSubtotal + pricing.cleaningFee + pricing.extraGuestFee + pricing.petFee;

  return {
    listingId: listing.id,
    checkIn: cIn.toISOString(),
    checkOut: cOut.toISOString(),
    nights: pricing.nights,
    weekdayNights: pricing.weekdayNights,
    weekendNights: pricing.weekendNights,
    customPricedNights: pricing.customPricedNights,
    baseNightlyPrice: pricing.effectiveBasePrice,
    weekdayBasePrice: pricing.weekdayBasePrice,
    weekendNightlyPrice: pricing.weekendPrice,
    nightlySubtotal: pricing.staySubtotal,
    discountAmount: pricing.discountAmount,
    discountPercentage: pricing.discountPercentage,
    appliedDiscount: pricing.appliedDiscount,
    cleaningFee: pricing.cleaningFee,
    extraGuestFee: pricing.extraGuestFee,
    hostServiceFee: pricing.hostServiceFee,
    hostServiceFeePercentage: pricing.hostServiceFeePercentage,
    subtotal,
    totalPrice: subtotal,
    taxes: pricing.taxes,
    taxTotal: pricing.taxTotal,
    platformRemittedTaxTotal: pricing.platformRemittedTaxTotal,
    hostRemittedTaxTotal: pricing.hostRemittedTaxTotal,
    guestTotal: pricing.guestTotal,
    payoutBreakdown: pricing.payoutBreakdown,
    currency: pricing.currency,
    guests: requestedGuests,
    pets: requestedPets,
    cancellationPolicy,
    cancellationPolicyType,
    breakdown: pricing.breakdown.map((b) => ({
      date: b.date,
      isWeekend: b.isWeekend,
      price: b.price,
      rateSource: b.rateSource,
    })),
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

  const bookingApprovalMode = listing.bookingApprovalMode === "FIRST_THREE"
    ? "FIRST_THREE"
    : listing.bookingApprovalMode === "MANUAL" || !listing.instantBook ? "MANUAL"
    : "INSTANT";

  if (bookingApprovalMode === "INSTANT" && listing.requireGoodTrackRecord) {
    const completedConfirmedStay = await prisma.booking.findFirst({
      where: {
        userId: actor.id,
        status: BookingStatus.CONFIRMED,
        endDate: { lt: new Date() },
      },
      select: { id: true },
    });

    if (!completedConfirmedStay) {
      throw AppError.badRequest(
        "This listing requires guests to have at least one completed confirmed stay before using Instant Book.",
      );
    }
  }

  // Calculate authoritative quote
  const quote = await getBookingQuote({
    listingId: input.listingId,
    checkIn: input.startDate,
    checkOut: input.endDate,
    guests: input.guests,
    pets: input.pets,
  });

  // Check against listing.blockedDates
  if (Array.isArray(listing.blockedDates) && listing.blockedDates.length > 0) {
    const blockedSet = new Set(listing.blockedDates);
    for (const item of quote.breakdown) {
      if (blockedSet.has(item.date)) {
        throw AppError.conflict(`The date ${item.date} is not available for booking`);
      }
    }
  }

  const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Serialize booking attempts per listing so concurrent overlap checks cannot both win.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.listingId}))`;
    const conflict = await tx.booking.findFirst({ where: { listingId: input.listingId, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] }, startDate: { lt: input.endDate }, endDate: { gt: input.startDate } } });
    if (conflict) throw AppError.conflict("The selected dates are no longer available");

    const approvedBookings = bookingApprovalMode === "FIRST_THREE"
      ? await tx.booking.count({ where: { listingId: input.listingId, status: BookingStatus.CONFIRMED } })
      : 0;
    const automaticallyApprove = bookingApprovalMode === "INSTANT"
      || (bookingApprovalMode === "FIRST_THREE" && approvedBookings >= 3);

    const createdBooking = await tx.booking.create({ data: {
      userId: actor.id,
      listingId: input.listingId,
      startDate: input.startDate,
      endDate: input.endDate,
      guests: quote.guests,
      totalPrice: quote.guestTotal,
      nightlyPrice: quote.baseNightlyPrice,
      cleaningFee: quote.cleaningFee,
      currency: quote.currency,
      priceBreakdown: quote as unknown as Prisma.InputJsonValue,
      cancellationPolicy: quote.cancellationPolicy,
      status: automaticallyApprove ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
    } });

    // Snapshot each calculated tax item for immutable reservation auditing
    if (quote.taxes && quote.taxes.length > 0) {
      for (const tax of quote.taxes) {
        await tx.reservationTax.create({
          data: {
            bookingId: createdBooking.id,
            taxRuleId: tax.taxRuleId || null,
            taxRuleVersion: tax.taxRuleVersion || 1,
            taxName: tax.taxName,
            taxType: tax.taxType,
            calculationMethod: tax.calculationMethod,
            rate: tax.rate ?? null,
            amount: tax.amount ?? null,
            taxableBase: tax.taxableBase,
            taxAmount: tax.taxAmount,
            currency: tax.currency || "SAR",
            remittanceResponsibility: tax.remittanceResponsibility,
          },
        });
      }
    }

    return createdBooking;
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
