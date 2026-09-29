import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertOwnership } from "@/lib/permissions/authorize";
import { prisma } from "@/lib/db/prisma";
import { getOrSetCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";
import { CACHE_TTL } from "@/lib/redis/ttl";
import { invalidateBookingCache } from "@/lib/redis/invalidation";
import type { CreateBookingInput } from "@/lib/validation/booking";

import { reviveBookingDTO, toBookingDTO, type BookingDTO } from "./mappers";

import { BookingStatus, ListingStatus, NotificationType, Role, ConversationStatus, SpecialOfferStatus } from "@/generated/prisma/enums";
import { notificationService } from "./notification.service";
import { messagingService } from "./messaging.service";

import type { Prisma } from "@/generated/prisma/client";
import { resolveTaxJurisdiction } from "@/lib/tax/jurisdiction-resolver";
import { TaxCalculator } from "@/lib/tax/tax-calculator";
import type { CalculatedTaxItem, HostPayoutBreakdown, ListingTaxDTO } from "@/lib/tax/types";
import { getHostServiceFeePercentage } from "@/services/app-settings.service";
import { getNonRefundableDiscountPercentage } from "@/services/app-settings.service";
import { calculateBookingPrice, calculateSpecialOffer, type AppliedDiscount, type NightRateBreakdown } from "@/services/pricing.service";
import { getCurrencyForCountry } from "@/lib/currency";
import {
  computeBookingStatus,
  getBookingAvailableActions,
  type BookingStatusDetails,
  type BookingAvailableActions,
} from "@/lib/booking/booking-status";
import {
  getAuthoritativePriceBreakdown,
  type AuthoritativePriceBreakdown,
} from "@/lib/booking/booking-price";

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
  petFee?: number; // cents
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
  nonRefundableAvailable: boolean;
  isNonRefundable: boolean;
  nonRefundableDiscount: AppliedDiscount | null;
  isSpecialOffer?: boolean;
  specialOfferId?: string | null;
  specialOfferAmount?: number | null;
  breakdown: Array<{
    date: string;
    isWeekend: boolean;
    price: number;
    rateSource?: "CUSTOM" | "WEEKEND" | "WEEKDAY" | "SPECIAL_OFFER";
  }>;
};

export function parseCutoffHour(cutoff: string | null | undefined): number {
  switch (cutoff?.trim().toUpperCase()) {
    case "6:00 AM":
      return 6;
    case "12:00 PM":
      return 12;
    case "3:00 PM":
      return 15;
    case "6:00 PM":
      return 18;
    case "9:00 PM":
      return 21;
    case "12:00 AM":
    default:
      return 24;
  }
}

export function parseRequiredAdvanceDays(notice: string | null | undefined): number {
  switch (notice?.trim()) {
    case "1 day":
    case "At least 1 day":
      return 1;
    case "2 days":
    case "At least 2 days":
      return 2;
    case "3 days":
    case "At least 3 days":
      return 3;
    case "7 days":
    case "At least 7 days":
      return 7;
    case "Same day":
    default:
      return 0;
  }
}

/**
 * Booking dates are calendar days, never instants. Zod parses an ISO date as
 * UTC, so rebuild it from UTC components before using local date arithmetic.
 * This prevents a browser/server timezone from turning Oct 10 into Oct 9.
 */
function toCalendarDate(value: Date | string): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return parsed;
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function getBookingQuote(opts: {
  listingId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guests?: number;
  pets?: number;
  nonRefundable?: boolean;
  specialOfferId?: string;
  actor?: AuthUser;
}): Promise<BookingQuote> {
  const listing = await prisma.listing.findUnique({
    where: { id: opts.listingId },
    include: { taxes: { where: { isActive: true } } },
  });

  if (!listing || !listing.published || listing.status !== ListingStatus.ACTIVE || listing.isPaused) {
    throw AppError.notFound("Listing is not available or does not exist");
  }

  const cIn = toCalendarDate(opts.checkIn);
  const cOut = toCalendarDate(opts.checkOut);

  if (isNaN(cIn.getTime()) || isNaN(cOut.getTime())) {
    throw AppError.badRequest("Invalid check-in or check-out date");
  }

  // Normalize to the local start of the requested calendar day.
  cIn.setHours(0, 0, 0, 0);
  cOut.setHours(0, 0, 0, 0);

  const diffMs = cOut.getTime() - cIn.getTime();
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (nights < 1) {
    throw AppError.badRequest("Checkout date must be after check-in date");
  }

  let validatedOffer: any = null;
  if (opts.specialOfferId) {
    const offer = await prisma.specialOffer.findUnique({
      where: { id: opts.specialOfferId },
    });
    if (!offer) {
      throw AppError.notFound("Special offer not found or invalid");
    }
    if (offer.listingId !== listing.id) {
      throw AppError.badRequest("This special offer does not apply to this property");
    }
    if (offer.hostId !== listing.hostId) {
      throw AppError.badRequest("This special offer host does not match property host");
    }
    // Authorization check for quote calculation:
    // Allow the recipient guest, the host who sent the offer, and administrators.
    // Allow unauthenticated preview so guests clicking email/message links see the agreed offer price before logging in.
    if (opts.actor) {
      const isRecipient = offer.guestId === opts.actor.id;
      const isHost = offer.hostId === opts.actor.id;
      const isAdmin = opts.actor.role === Role.ADMIN;
      if (!isRecipient && !isHost && !isAdmin) {
        throw AppError.forbidden("This special offer was sent to a different guest");
      }
    }
    if (offer.status !== SpecialOfferStatus.ACCEPTED && offer.status !== SpecialOfferStatus.PENDING) {
      throw AppError.badRequest(`This special offer is no longer valid (${offer.status.toLowerCase()})`);
    }
    if (offer.expiresAt && offer.expiresAt < new Date()) {
      await prisma.specialOffer.update({
        where: { id: offer.id },
        data: { status: SpecialOfferStatus.EXPIRED },
      });
      throw AppError.badRequest("This special offer has expired");
    }
    const offerStartKey = calendarDateKey(toCalendarDate(offer.startDate));
    const offerEndKey = calendarDateKey(toCalendarDate(offer.endDate));
    const requestedStartKey = calendarDateKey(cIn);
    const requestedEndKey = calendarDateKey(cOut);
    if (offerStartKey !== requestedStartKey || offerEndKey !== requestedEndKey) {
      throw AppError.badRequest("Booking dates do not match the special offer dates");
    }
    if ((opts.guests ?? 1) > offer.guests) {
      throw AppError.badRequest(`This special offer is for up to ${offer.guests} guest${offer.guests > 1 ? "s" : ""}`);
    }
    validatedOffer = offer;
  }

  const minN = listing.minNights || 1;
  const maxN = listing.maxNights || 365;

  if (!validatedOffer && nights < minN) {
    throw AppError.badRequest(`Minimum stay is ${minN} ${minN === 1 ? "night" : "nights"}`);
  }
  if (!validatedOffer && nights > maxN) {
    throw AppError.badRequest(`Maximum stay is ${maxN} ${maxN === 1 ? "night" : "nights"}`);
  }

  // Validate availability constraints: advance notice & same-day settings
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const checkInDate = new Date(cIn.getFullYear(), cIn.getMonth(), cIn.getDate());
  const daysDifference = Math.round((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDifference < 0) {
    throw AppError.badRequest("Check-in date cannot be in the past");
  }

  const requiredAdvanceDays = parseRequiredAdvanceDays(listing.advanceNotice);

  if (daysDifference === 0) {
    // Same-day check-in requested
    if (listing.allowSameDayRequests === false) {
      throw AppError.badRequest("Same-day bookings are not allowed for this property");
    }
    if (requiredAdvanceDays > 0) {
      throw AppError.badRequest(
        `This property requires at least ${requiredAdvanceDays} ${requiredAdvanceDays === 1 ? "day" : "days"} advance notice before arrival`
      );
    }
    const cutoffHour = parseCutoffHour(listing.sameDayCutoff);
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (currentHour >= cutoffHour) {
      throw AppError.badRequest(
        `Same-day bookings for today closed at ${listing.sameDayCutoff || "12:00 AM"}`
      );
    }
  } else if (daysDifference < requiredAdvanceDays) {
    throw AppError.badRequest(
      `This property requires at least ${requiredAdvanceDays} ${requiredAdvanceDays === 1 ? "day" : "days"} advance notice before arrival`
    );
  }

  const requestedGuests = opts.guests ?? 1;
  const baseGuests = listing.guests || 1;
  if (requestedGuests > baseGuests) {
    throw AppError.badRequest(`Property accommodates a maximum of ${baseGuests} guests`);
  }

  // Quotes are used to decide whether Reserve is enabled, so they must use the
  // same availability rules as final booking creation. The transaction in
  // create() rechecks this again to close the select-to-reserve race window.
  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      listingId: listing.id,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      startDate: { lt: cOut },
      endDate: { gt: cIn },
    },
    select: { id: true },
  });
  if (overlappingBooking) throw AppError.conflict("The selected dates are not available");

  const blockedDates = new Set(Array.isArray(listing.blockedDates) ? listing.blockedDates : []);
  for (let date = new Date(cIn); date < cOut; date.setDate(date.getDate() + 1)) {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (blockedDates.has(dateKey)) {
      throw AppError.conflict(`The date ${dateKey} is not available for booking`);
    }
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
  const rawNonRefundable = listing.discounts && typeof listing.discounts === "object"
    ? (listing.discounts as Record<string, unknown>).non_refundable
    : null;
  const listingOffersNonRefundable = rawNonRefundable === true || (
    typeof rawNonRefundable === "object" && rawNonRefundable !== null &&
    (rawNonRefundable as Record<string, unknown>).enabled === true
  );
  const legacyPercentage = typeof rawNonRefundable === "object" && rawNonRefundable !== null
    ? (rawNonRefundable as Record<string, unknown>).percentage
    : null;
  const listingConfiguredPercentage = typeof legacyPercentage === "number" && legacyPercentage > 0 && legacyPercentage <= 100
    ? legacyPercentage
    : null;
  const configuredNonRefundablePercentage = listingConfiguredPercentage ?? await getNonRefundableDiscountPercentage();
  const nonRefundableAvailable = cancellationPolicyType === "SHORT_TERM"
    && listingOffersNonRefundable
    && configuredNonRefundablePercentage !== null;
  if (opts.nonRefundable && !nonRefundableAvailable) {
    throw AppError.badRequest("A non-refundable reservation is not available for this stay.");
  }

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
  const pricing = validatedOffer
    ? await calculateSpecialOffer({
        specialOfferAmount: validatedOffer.subtotalPrice,
        nights,
        cleaningFee: listing.cleaningFee,
        extraGuestFee: (listing as any).extraGuestFee,
        petFee: listing.petFee,
        guests: requestedGuests,
        taxRules: resolved.systemRules,
        hostTaxes,
        currency: getCurrencyForCountry(listing.country),
      })
    : await calculateBookingPrice({
        // Pricing consumes date-only strings so it keeps the guest's selected
        // calendar day intact in every server timezone.
        checkIn: calendarDateKey(cIn),
        checkOut: calendarDateKey(cOut),
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
        includeNewListingPromotion: false,
        taxRules: resolved.systemRules,
        hostTaxes,
        nonRefundableDiscountPercentage: opts.nonRefundable ? configuredNonRefundablePercentage : null,
        currency: getCurrencyForCountry(listing.country),
      });

  const subtotal = pricing.accommodationSubtotal + pricing.cleaningFee + pricing.extraGuestFee + pricing.petFee;

  return {
    listingId: listing.id,
    checkIn: calendarDateKey(cIn),
    checkOut: calendarDateKey(cOut),
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
    petFee: pricing.petFee,
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
    nonRefundableAvailable,
    isNonRefundable: Boolean(opts.nonRefundable),
    nonRefundableDiscount: pricing.nonRefundableDiscount,
    isSpecialOffer: Boolean(validatedOffer),
    specialOfferId: validatedOffer ? validatedOffer.id : null,
    specialOfferAmount: validatedOffer ? validatedOffer.subtotalPrice : null,
    breakdown: pricing.breakdown.length > 0 ? pricing.breakdown.map((b) => ({
      date: b.date,
      isWeekend: b.isWeekend,
      price: b.price,
      rateSource: b.rateSource,
    })) : Array.from({ length: nights }, (_, i) => {
      const d = new Date(cIn);
      d.setDate(d.getDate() + i);
      const isWeekend = d.getDay() === 5 || d.getDay() === 6;
      return {
        date: calendarDateKey(d),
        isWeekend,
        price: Math.round((validatedOffer?.subtotalPrice ?? pricing.staySubtotal) / nights),
        rateSource: "SPECIAL_OFFER" as const,
      };
    }),
  };
}

type CreateBookingRequest = Omit<CreateBookingInput, "nonRefundable"> & { nonRefundable?: boolean };

async function create(
  actor: AuthUser,
  input: CreateBookingRequest,
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

  if (input.specialOfferId) {
    const offer = await prisma.specialOffer.findUnique({
      where: { id: input.specialOfferId },
    });
    if (!offer || offer.guestId !== actor.id) {
      throw AppError.forbidden("This special offer was sent to a different guest");
    }
  }

  // Calculate authoritative quote
  const quote = await getBookingQuote({
    listingId: input.listingId,
    checkIn: input.startDate,
    checkOut: input.endDate,
    guests: input.guests,
    pets: input.pets,
    nonRefundable: input.nonRefundable ?? false,
    specialOfferId: input.specialOfferId,
    actor,
  });
  const bookingCheckIn = toCalendarDate(input.startDate);
  const bookingCheckOut = toCalendarDate(input.endDate);

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
    const conflict = await tx.booking.findFirst({ where: { listingId: input.listingId, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] }, startDate: { lt: bookingCheckOut }, endDate: { gt: bookingCheckIn } } });
    if (conflict) throw AppError.conflict("The selected dates are no longer available");

    const approvedBookings = bookingApprovalMode === "FIRST_THREE"
      ? await tx.booking.count({ where: { listingId: input.listingId, status: BookingStatus.CONFIRMED } })
      : 0;
    const automaticallyApprove = bookingApprovalMode === "INSTANT"
      || (bookingApprovalMode === "FIRST_THREE" && approvedBookings >= 3);

    const createdBooking = await tx.booking.create({ data: {
      userId: actor.id,
      listingId: input.listingId,
      startDate: bookingCheckIn,
      endDate: bookingCheckOut,
      guests: quote.guests,
      totalPrice: quote.guestTotal,
      nightlyPrice: quote.baseNightlyPrice,
      cleaningFee: quote.cleaningFee,
      currency: quote.currency,
      priceBreakdown: quote as unknown as Prisma.InputJsonValue,
      cancellationPolicy: quote.cancellationPolicy,
      isNonRefundable: quote.isNonRefundable,
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

    if (input.specialOfferId) {
      await tx.specialOffer.update({
        where: { id: input.specialOfferId },
        data: { status: SpecialOfferStatus.ACCEPTED },
      });
    }

    return createdBooking;
  });

  // Invalidate booking caches after creation
  await invalidateBookingCache(booking.id, actor.id, listing.hostId);

  // Link or create conversation for this booking and persist checkout message if provided
  try {
    const isAutoConfirmed = booking.status === BookingStatus.CONFIRMED;
    await messagingService.getOrCreateBookingConversation({
      guestId: actor.id,
      hostId: listing.hostId,
      listingId: input.listingId,
      bookingId: booking.id,
      messageContent: input.message,
      isConfirmed: isAutoConfirmed,
      guestName: actor.name || "A guest",
    });
  } catch (convErr) {
    console.error("Failed to link conversation for booking:", convErr);
  }


  // Trigger booking notification for guest
  try {
    const isAutoConfirmed = booking.status === BookingStatus.CONFIRMED;
    await notificationService.create({
      userId: actor.id,
      type: NotificationType.BOOKING,
      title: isAutoConfirmed
        ? `Reservation Confirmed: ${listing.title}`
        : `Booking Request Submitted: ${listing.title}`,
      message: isAutoConfirmed
        ? `Your stay at ${listing.title} from ${input.startDate} to ${input.endDate} is confirmed.`
        : `Your request for ${listing.title} has been submitted for host approval.`,
      entityId: booking.id,
      entityType: "booking",
      link: "/profile/tab/upcoming",
      metadata: {
        bookingId: booking.id,
        listingId: listing.id,
        status: booking.status,
        role: "guest",
      },
    });

    // Also trigger booking notification for HOST
    if (listing.hostId && listing.hostId !== actor.id) {
      const guestName = actor.name || "A guest";
      await notificationService.create({
        userId: listing.hostId,
        type: NotificationType.BOOKING,
        title: isAutoConfirmed
          ? `New Reservation: ${listing.title}`
          : `New Booking Request: ${listing.title}`,
        message: isAutoConfirmed
          ? `${guestName} booked ${listing.title} from ${input.startDate} to ${input.endDate}.`
          : `${guestName} requested to book ${listing.title} from ${input.startDate} to ${input.endDate}. Review request now.`,
        entityId: booking.id,
        entityType: "host_booking",
        link: "/host/bookings",
        metadata: {
          bookingId: booking.id,
          listingId: listing.id,
          guestId: actor.id,
          guestName,
          status: booking.status,
          role: "host",
        },
      });
    }
  } catch (err) {
    console.warn("[booking.service] Failed to create booking notification:", err);
  }

  return toBookingDTO(booking);
}

// A user's own bookings cached with Cache-Aside pattern
async function listForUser(
  actor: AuthUser,
  opts: { skip: number; take: number },
): Promise<{ items: BookingDTO[]; total: number }> {
  const cacheKey = CACHE_KEYS.BOOKINGS_USER(actor.id, opts.skip, opts.take);

  return getOrSetCache(
    cacheKey,
    async () => {
      const where = { userId: actor.id };
      const [items, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          skip: opts.skip,
          take: opts.take,
          select: {
            id: true,
            userId: true,
            listingId: true,
            status: true,
            startDate: true,
            endDate: true,
            guests: true,
            totalPrice: true,
            nightlyPrice: true,
            cleaningFee: true,
            currency: true,
            priceBreakdown: true,
            cancellationPolicy: true,
            isNonRefundable: true,
            createdAt: true,
            listing: {
              select: {
                id: true,
                customSlug: true,
                title: true,
                photos: true,
                description: true,
                price: true,
                city: true,
                country: true,
                checkInStart: true,
                checkOutTime: true,
              },
            },
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.booking.count({ where }),
      ]);
      return { items: items.map(toBookingDTO), total };
    },
    {
      ttl: CACHE_TTL.BOOKING_LIST,
      revive: (cached) => ({
        ...cached,
        items: cached.items.map(reviveBookingDTO),
      }),
    },
  );
}

export type HostPendingBooking = {
  id: string;
  startDate: Date;
  endDate: Date;
  guests: number;
  createdAt: Date;
  guest: { name: string | null; image: string | null };
  listing: { title: string; city: string | null; country: string | null; photos: string[] };
};

/** Pending, future-facing requests owned by the authenticated host. */
async function listPendingForHost(actor: AuthUser): Promise<HostPendingBooking[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      endDate: { gt: new Date() },
      listing: { hostId: actor.id },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      guests: true,
      createdAt: true,
      user: { select: { name: true, image: true } },
      listing: { select: { title: true, city: true, country: true, photos: true } },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });
  return bookings.map((booking: any) => ({ ...booking, guest: booking.user }));
}

/** Confirms every active pending booking belonging to the authenticated host. */
async function approveAllPendingForHost(actor: AuthUser): Promise<{ approved: number }> {
  const pendingBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      endDate: { gt: new Date() },
      listing: { hostId: actor.id },
    },
    select: {
      id: true,
      userId: true,
      listing: { select: { id: true, title: true } },
    },
  });
  if (pendingBookings.length === 0) return { approved: 0 };

  const result = await prisma.booking.updateMany({
    where: { id: { in: pendingBookings.map((b: { id: string }) => b.id) }, status: BookingStatus.PENDING },
    data: { status: BookingStatus.CONFIRMED },
  });
  await Promise.all(pendingBookings.map((b: { id: string; userId: string }) => invalidateBookingCache(b.id, b.userId, actor.id)));

  // Trigger targeted notification for each guest who owns that approved booking
  for (const b of pendingBookings) {
    try {
      await notificationService.create({
        userId: b.userId,
        type: NotificationType.BOOKING,
        title: `Reservation Confirmed: ${b.listing.title}`,
        message: `Your booking request for ${b.listing.title} has been approved by the host.`,
        entityId: b.id,
        entityType: "booking",
        link: "/profile/tab/upcoming",
        metadata: {
          bookingId: b.id,
          listingId: b.listing.id,
          status: BookingStatus.CONFIRMED,
        },
      });

      await messagingService.recordBookingStatusMessage({
        bookingId: b.id,
        statusText: "Host approved your booking request. Your reservation is confirmed!",
        newBookingStatus: BookingStatus.CONFIRMED,
        conversationStatus: ConversationStatus.CONFIRMED,
      });
    } catch (err) {
      console.warn("[booking.service] Failed to send guest approval notification:", err);
    }
  }


  return { approved: result.count };
}

async function getById(actor: AuthUser, id: string): Promise<BookingDTO> {
  const booking = await getOrSetCache(
    CACHE_KEYS.BOOKING(id),
    async () => {
      const b = await prisma.booking.findUnique({ where: { id }, include: { listing: true } });
      if (!b) throw AppError.notFound("Booking not found");
      return toBookingDTO(b);
    },
    {
      ttl: CACHE_TTL.BOOKING_DETAIL,
      revive: reviveBookingDTO,
    },
  );

  // Authorization check must run independently of cache
  assertOwnership(actor, booking.userId);
  return booking;
}

/**
 * Cancels only a guest's own non-refundable reservation. The immutable booking
 * flag, not the listing's current offer, controls the outcome. There is no
 * payment-provider service in this project; the authoritative financial result
 * is recorded in the immutable booking pricing snapshot for downstream payout
 * processing: the guest refund is zero and the booked host payout is retained.
 */
async function cancelNonRefundableByGuest(actor: AuthUser, id: string): Promise<BookingDTO> {
  const cancelled = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      include: { listing: true },
    });
    if (!booking) throw AppError.notFound("Booking not found");
    assertOwnership(actor, booking.userId);
    if (!booking.isNonRefundable) {
      throw AppError.badRequest("This endpoint only cancels non-refundable reservations.");
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw AppError.conflict("This reservation has already been cancelled.");
    }

    const originalSnapshot = booking.priceBreakdown && typeof booking.priceBreakdown === "object" && !Array.isArray(booking.priceBreakdown)
      ? booking.priceBreakdown as Record<string, unknown>
      : {};
    const payoutBreakdown = originalSnapshot.payoutBreakdown && typeof originalSnapshot.payoutBreakdown === "object"
      ? originalSnapshot.payoutBreakdown as Record<string, unknown>
      : {};
    const hostPayoutRetained = typeof payoutBreakdown.netHostPayout === "number"
      ? payoutBreakdown.netHostPayout
      : 0;
    const priceBreakdown = {
      ...originalSnapshot,
      cancellation: {
        cancelledAt: new Date().toISOString(),
        cancelledBy: "GUEST",
        isNonRefundable: true,
        guestRefundAmount: 0,
        hostPayoutRetained,
      },
    } as Prisma.InputJsonValue;

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED, priceBreakdown },
    });
    return { ...updated, listing: booking.listing };
  });

  await invalidateBookingCache(cancelled.id, cancelled.userId, cancelled.listing.hostId);

  try {
    await notificationService.create({
      userId: cancelled.userId,
      type: NotificationType.BOOKING,
      title: `Reservation Cancelled: ${cancelled.listing.title}`,
      message: `Your reservation for ${cancelled.listing.title} has been cancelled.`,
      entityId: cancelled.id,
      entityType: "booking",
      link: "/profile/tab/past",
      metadata: {
        bookingId: cancelled.id,
        listingId: cancelled.listingId,
        status: BookingStatus.CANCELLED,
        role: "guest",
      },
    });

    // Notify host as well
    if (cancelled.listing?.hostId && cancelled.listing.hostId !== cancelled.userId) {
      await notificationService.create({
        userId: cancelled.listing.hostId,
        type: NotificationType.BOOKING,
        title: `Reservation Cancelled: ${cancelled.listing.title}`,
        message: `A guest cancelled their reservation for ${cancelled.listing.title}.`,
        entityId: cancelled.id,
        entityType: "host_booking",
        link: "/host/bookings",
        metadata: {
          bookingId: cancelled.id,
          listingId: cancelled.listingId,
          status: BookingStatus.CANCELLED,
          role: "host",
        },
      });
    }
  } catch (err) {
    console.warn("[booking.service] Failed to create cancellation notification:", err);
  }

  try {
    await messagingService.recordBookingStatusMessage({
      bookingId: cancelled.id,
      statusText: "Guest cancelled this reservation.",
      newBookingStatus: BookingStatus.CANCELLED,
      conversationStatus: ConversationStatus.CANCELLED,
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record conversation cancellation status:", err);
  }

  return toBookingDTO(cancelled);

}

async function cancelBookingByGuest(actor: AuthUser, id: string): Promise<BookingDTO> {
  const cancelled = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      include: { listing: true },
    });
    if (!booking) throw AppError.notFound("Booking not found");
    assertOwnership(actor, booking.userId);

    if (booking.status === BookingStatus.CANCELLED) {
      throw AppError.conflict("This reservation has already been cancelled.");
    }

    const now = new Date();
    if (new Date(booking.startDate) <= now) {
      throw AppError.badRequest("Reservations cannot be cancelled after the check-in date.");
    }

    const originalSnapshot =
      booking.priceBreakdown &&
      typeof booking.priceBreakdown === "object" &&
      !Array.isArray(booking.priceBreakdown)
        ? (booking.priceBreakdown as Record<string, unknown>)
        : {};
    const payoutBreakdown =
      originalSnapshot.payoutBreakdown &&
      typeof originalSnapshot.payoutBreakdown === "object"
        ? (originalSnapshot.payoutBreakdown as Record<string, unknown>)
        : {};
    const hostPayoutRetained =
      typeof payoutBreakdown.netHostPayout === "number"
        ? payoutBreakdown.netHostPayout
        : 0;

    const priceBreakdown = {
      ...originalSnapshot,
      cancellation: {
        cancelledAt: now.toISOString(),
        cancelledBy: "GUEST",
        isNonRefundable: Boolean(booking.isNonRefundable),
        policy: booking.cancellationPolicy || "FLEXIBLE",
        guestRefundAmount: booking.isNonRefundable ? 0 : (booking.totalPrice ?? 0),
        hostPayoutRetained: booking.isNonRefundable ? hostPayoutRetained : 0,
      },
    } as Prisma.InputJsonValue;

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED, priceBreakdown },
    });
    return { ...updated, listing: booking.listing };
  });

  await invalidateBookingCache(cancelled.id, cancelled.userId, cancelled.listing.hostId);

  try {
    await notificationService.create({
      userId: cancelled.userId,
      type: NotificationType.BOOKING,
      title: `Reservation Cancelled: ${cancelled.listing.title}`,
      message: `Your reservation for ${cancelled.listing.title} has been cancelled.`,
      entityId: cancelled.id,
      entityType: "booking",
      link: "/profile/tab/past",
      metadata: {
        bookingId: cancelled.id,
        listingId: cancelled.listingId,
        status: BookingStatus.CANCELLED,
        role: "guest",
      },
    });

    // Notify host as well
    if (cancelled.listing?.hostId && cancelled.listing.hostId !== cancelled.userId) {
      await notificationService.create({
        userId: cancelled.listing.hostId,
        type: NotificationType.BOOKING,
        title: `Reservation Cancelled: ${cancelled.listing.title}`,
        message: `A guest cancelled their reservation for ${cancelled.listing.title}.`,
        entityId: cancelled.id,
        entityType: "host_booking",
        link: "/host/bookings",
        metadata: {
          bookingId: cancelled.id,
          listingId: cancelled.listingId,
          status: BookingStatus.CANCELLED,
          role: "host",
        },
      });
    }
  } catch (err) {
    console.warn("[booking.service] Failed to create cancellation notification:", err);
  }

  try {
    await messagingService.recordBookingStatusMessage({
      bookingId: cancelled.id,
      statusText: "Guest cancelled this reservation.",
      newBookingStatus: BookingStatus.CANCELLED,
      conversationStatus: ConversationStatus.CANCELLED,
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record conversation cancellation status:", err);
  }

  return toBookingDTO(cancelled);

}

async function listForAdminDashboard() {
  const [bookings, totalCount, stats] = await Promise.all([
    prisma.booking.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            host: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.booking.count(),
    prisma.booking.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return { bookings, totalCount, stats };
}

export type BookingDetailsData = {
  booking: {
    id: string;
    userId: string;
    listingId: string;
    status: BookingStatus;
    startDate: Date;
    endDate: Date;
    guests: number;
    totalPrice: number | null;
    nightlyPrice: number | null;
    cleaningFee: number | null;
    currency: string;
    priceBreakdown: unknown;
    cancellationPolicy: string | null;
    isNonRefundable: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  listing: {
    id: string;
    customSlug: string | null;
    title: string;
    description: string;
    photos: string[];
    price: number;
    propertyType: string | null;
    placeCategory: string | null;
    listingType: string | null;
    bedrooms: number;
    beds: number;
    bathrooms: number;
    guests: number;
    shortAddress: string | null;
    address: string | null;
    apartment: string | null;
    city: string | null;
    district: string | null;
    postalCode: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    showExactLocation: boolean;
    checkInMethod: string | null;
    checkInStart: string | null;
    checkInEnd: string | null;
    checkOutTime: string | null;
    directions: string | null;
    parkingInstructions: string | null;
    checkInInstructions: string | null;
    checkOutInstructions: string | null;
    houseManual: string | null;
    wifiNetwork: string | null;
    wifiPassword: string | null;
    doorCode: string | null;
    lockboxCode: string | null;
    houseRules: string[];
    petsAllowed: boolean | null;
    maxPets: number | null;
    petFee: number | null;
    petRestrictions: string | null;
    smokingAllowed: boolean | null;
    smokingLocation: string | null;
    eventsAllowed: boolean | null;
    childrenAllowed: boolean | null;
    infantsAllowed: boolean | null;
    quietHours: boolean | null;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    additionalRules: string | null;
    safetyDisclosures: string[];
    safetyEquipment: string[];
    minNights: number;
    maxNights: number;
    host: {
      id: string;
      name: string | null;
      image: string | null;
      email: string | null;
      publicProfile: unknown;
      createdAt: Date;
    };
  };
  guest: {
    id: string;
    name: string | null;
    email: string | null;
  };
  review: {
    hasReview: boolean;
    reviewId: string | null;
    reviewRating: number | null;
  };
  statusDetails: BookingStatusDetails;
  actions: BookingAvailableActions;
  pricing: AuthoritativePriceBreakdown;
};

async function getBookingDetails(actor: AuthUser, id: string): Promise<BookingDetailsData> {
  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          host: {
            select: {
              id: true,
              name: true,
              image: true,
              email: true,
              publicProfile: true,
              createdAt: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reviews: {
        select: {
          id: true,
          rating: true,
          authorId: true,
        },
      },
    },
  });

  if (!b) throw AppError.notFound("Booking not found");

  const isGuest = actor.id === b.userId;
  const isHost = actor.id === b.listing.hostId;
  const isAdmin = actor.role === Role.ADMIN;
  if (!isGuest && !isHost && !isAdmin) {
    throw AppError.forbidden("You do not have permission to view this reservation.");
  }

  // If stay has completed and DB was PENDING, lazily update to CONFIRMED
  if (b.status === BookingStatus.PENDING && new Date(b.endDate) < new Date()) {
    try {
      await prisma.booking.update({
        where: { id: b.id },
        data: { status: BookingStatus.CONFIRMED },
      });
      b.status = BookingStatus.CONFIRMED;
    } catch {
      // non-fatal
    }
  }

  const existingReview = b.reviews.find((r: { id: string; rating: number; authorId: string }) => r.authorId === b.userId) || b.reviews[0] || null;
  const hasReview = Boolean(existingReview);

  const statusDetails = computeBookingStatus({
    dbStatus: b.status,
    startDate: b.startDate,
    endDate: b.endDate,
    checkInStart: b.listing.checkInStart,
    checkOutTime: b.listing.checkOutTime,
  });

  const actions = getBookingAvailableActions({
    statusDetails,
    startDate: b.startDate,
    endDate: b.endDate,
    checkInStart: b.listing.checkInStart,
    checkOutTime: b.listing.checkOutTime,
    hasReview,
    reviewId: existingReview?.id,
    isNonRefundable: b.isNonRefundable,
  });

  const pricing = getAuthoritativePriceBreakdown(b);

  return {
    booking: {
      id: b.id,
      userId: b.userId,
      listingId: b.listingId,
      status: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
      guests: b.guests,
      totalPrice: b.totalPrice,
      nightlyPrice: b.nightlyPrice,
      cleaningFee: b.cleaningFee,
      currency: b.currency,
      priceBreakdown: b.priceBreakdown,
      cancellationPolicy: b.cancellationPolicy,
      isNonRefundable: b.isNonRefundable,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    },
    listing: {
      id: b.listing.id,
      customSlug: b.listing.customSlug,
      title: b.listing.title,
      description: b.listing.description,
      photos: b.listing.photos,
      price: b.listing.price,
      propertyType: b.listing.propertyType,
      placeCategory: b.listing.placeCategory,
      listingType: b.listing.listingType,
      bedrooms: b.listing.bedrooms,
      beds: b.listing.beds,
      bathrooms: b.listing.bathrooms,
      guests: b.listing.guests,
      shortAddress: b.listing.shortAddress,
      address: b.listing.address,
      apartment: b.listing.apartment,
      city: b.listing.city,
      district: b.listing.district,
      postalCode: b.listing.postalCode,
      country: b.listing.country,
      latitude: b.listing.latitude,
      longitude: b.listing.longitude,
      showExactLocation: b.listing.showExactLocation,
      checkInMethod: b.listing.checkInMethod,
      checkInStart: b.listing.checkInStart,
      checkInEnd: b.listing.checkInEnd,
      checkOutTime: b.listing.checkOutTime,
      directions: b.listing.directions,
      parkingInstructions: b.listing.parkingInstructions,
      checkInInstructions: b.listing.checkInInstructions,
      checkOutInstructions: b.listing.checkOutInstructions,
      houseManual: b.listing.houseManual,
      // Time-gated access credentials
      wifiNetwork: actions.isArrivalInfoReleased ? b.listing.wifiNetwork : null,
      wifiPassword: actions.isArrivalInfoReleased ? b.listing.wifiPassword : null,
      doorCode: actions.isArrivalInfoReleased ? b.listing.doorCode : null,
      lockboxCode: actions.isArrivalInfoReleased ? b.listing.lockboxCode : null,
      houseRules: b.listing.houseRules,
      petsAllowed: b.listing.petsAllowed,
      maxPets: b.listing.maxPets,
      petFee: b.listing.petFee,
      petRestrictions: b.listing.petRestrictions,
      smokingAllowed: b.listing.smokingAllowed,
      smokingLocation: b.listing.smokingLocation,
      eventsAllowed: b.listing.eventsAllowed,
      childrenAllowed: b.listing.childrenAllowed,
      infantsAllowed: b.listing.infantsAllowed,
      quietHours: b.listing.quietHours,
      quietHoursStart: b.listing.quietHoursStart,
      quietHoursEnd: b.listing.quietHoursEnd,
      additionalRules: b.listing.additionalRules,
      safetyDisclosures: b.listing.safetyDisclosures,
      safetyEquipment: b.listing.safetyEquipment,
      minNights: b.listing.minNights,
      maxNights: b.listing.maxNights,
      host: b.listing.host,
    },
    guest: b.user,
    review: {
      hasReview,
      reviewId: existingReview?.id ?? null,
      reviewRating: existingReview?.rating ?? null,
    },
    statusDetails,
    actions,
    pricing,
  };
}

async function changeBookingReservationPreview(
  actor: AuthUser,
  id: string,
  input: { startDate: string | Date; endDate: string | Date; guests?: number },
): Promise<{
  available: boolean;
  reason?: string;
  oldTotal: number;
  newTotal: number;
  difference: number;
  newNights: number;
  quote?: BookingQuote;
  currency: string;
}> {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { listing: true },
  });
  if (!booking) throw AppError.notFound("Booking not found");
  assertOwnership(actor, booking.userId);

  const statusDetails = computeBookingStatus({
    dbStatus: booking.status,
    startDate: booking.startDate,
    endDate: booking.endDate,
  });
  if (statusDetails.status !== "CONFIRMED") {
    throw AppError.badRequest("Only upcoming confirmed reservations can be modified.");
  }

  const checkIn = toCalendarDate(input.startDate);
  const checkOut = toCalendarDate(input.endDate);
  const today = toCalendarDate(new Date());

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    throw AppError.badRequest("Invalid dates provided.");
  }
  if (checkIn < today) {
    throw AppError.badRequest("Check-in date cannot be in the past.");
  }
  if (checkOut <= checkIn) {
    throw AppError.badRequest("Check-out date must be after check-in date.");
  }

  const requestedGuests = input.guests ?? booking.guests;
  if (requestedGuests < 1 || requestedGuests > (booking.listing.guests || 16)) {
    throw AppError.badRequest(`Number of guests must be between 1 and ${booking.listing.guests || 16}.`);
  }

  // Check conflicting bookings on this listing (excluding this booking)
  const conflict = await prisma.booking.findFirst({
    where: {
      id: { not: booking.id },
      listingId: booking.listingId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      startDate: { lt: checkOut },
      endDate: { gt: checkIn },
    },
  });

  if (conflict) {
    return {
      available: false,
      reason: "The requested dates are no longer available. Please select different dates.",
      oldTotal: booking.totalPrice ?? 0,
      newTotal: 0,
      difference: 0,
      newNights: 0,
      currency: booking.currency,
    };
  }

  const quote = await getBookingQuote({
    listingId: booking.listingId,
    checkIn,
    checkOut,
    guests: requestedGuests,
    nonRefundable: booking.isNonRefundable,
  });

  const oldTotal = booking.totalPrice ?? 0;
  const newTotal = quote.guestTotal;
  const difference = newTotal - oldTotal;

  return {
    available: true,
    oldTotal,
    newTotal,
    difference,
    newNights: quote.nights,
    quote,
    currency: quote.currency,
  };
}

async function changeBookingReservation(
  actor: AuthUser,
  id: string,
  input: { startDate: string | Date; endDate: string | Date; guests?: number },
): Promise<BookingDetailsData> {
  const preview = await changeBookingReservationPreview(actor, id, input);
  if (!preview.available || !preview.quote) {
    throw AppError.conflict(preview.reason || "The selected dates are unavailable.");
  }

  const checkIn = toCalendarDate(input.startDate);
  const checkOut = toCalendarDate(input.endDate);
  const requestedGuests = input.guests ?? 1;

  const updatedBooking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${preview.quote!.listingId}))`;

    const conflict = await tx.booking.findFirst({
      where: {
        id: { not: id },
        listingId: preview.quote!.listingId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startDate: { lt: checkOut },
        endDate: { gt: checkIn },
      },
    });
    if (conflict) throw AppError.conflict("The selected dates are no longer available.");

    return tx.booking.update({
      where: { id },
      data: {
        startDate: checkIn,
        endDate: checkOut,
        guests: requestedGuests,
        totalPrice: preview.quote!.guestTotal,
        nightlyPrice: preview.quote!.baseNightlyPrice,
        cleaningFee: preview.quote!.cleaningFee,
        priceBreakdown: preview.quote! as unknown as Prisma.InputJsonValue,
      },
      include: { listing: true },
    });
  });

  await invalidateBookingCache(updatedBooking.id, updatedBooking.userId, updatedBooking.listing.hostId);

  try {
    await notificationService.create({
      userId: updatedBooking.userId,
      type: NotificationType.BOOKING,
      title: `Reservation Updated: ${updatedBooking.listing.title}`,
      message: `Your reservation dates have been changed to ${checkIn.toISOString().slice(0, 10)} – ${checkOut.toISOString().slice(0, 10)}.`,
      entityId: updatedBooking.id,
      entityType: "booking",
      link: `/bookings/${updatedBooking.id}`,
      metadata: {
        bookingId: updatedBooking.id,
        listingId: updatedBooking.listingId,
        status: updatedBooking.status,
      },
    });
  } catch (err) {
    console.warn("Failed to send reservation update notification:", err);
  }

  return getBookingDetails(actor, id);
}

export const bookingService = {
  create,
  listForUser,
  listPendingForHost,
  approveAllPendingForHost,
  getById,
  getBookingDetails,
  changeBookingReservationPreview,
  changeBookingReservation,
  getQuote: getBookingQuote,
  getBookingQuote,
  cancelNonRefundableByGuest,
  cancelBookingByGuest,
  listForAdminDashboard,
};
