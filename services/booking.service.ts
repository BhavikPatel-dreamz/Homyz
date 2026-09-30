import { AppError, ErrorCode } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertOwnership } from "@/lib/permissions/authorize";
import { prisma } from "@/lib/db/prisma";
import { getOrSetCache } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";
import { CACHE_TTL } from "@/lib/redis/ttl";
import { invalidateBookingCache } from "@/lib/redis/invalidation";
import type { CreateBookingInput } from "@/lib/validation/booking";

import { reviveBookingDTO, toBookingDTO, type BookingDTO } from "./mappers";

import { BookingStatus, ListingStatus, NotificationType, Role, ConversationStatus, SpecialOfferStatus, MessageType } from "@/generated/prisma/enums";
import { notificationService } from "./notification.service";
import { messagingService } from "./messaging.service";
import { auditService } from "./audit.service";

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
  getBookingStatusTimeline,
  type BookingStatusDetails,
  type BookingAvailableActions,
  type BookingStatusTimelineEvent,
} from "@/lib/booking/booking-status";
import {
  getAuthoritativePriceBreakdown,
  type AuthoritativePriceBreakdown,
} from "@/lib/booking/booking-price";
import { resolveBookingMode } from "@/lib/booking/booking-mode";
import {
  bookingDateKey,
  differenceInBookingNights,
  parseBookingDate,
} from "@/lib/booking/booking-date";
import { validateHostMessage } from "@/lib/booking/host-message";
import { getPaymentPolicy } from "@/lib/booking/payment-policy";
import {
  REQUEST_TO_BOOK_RESPONSE_HOURS,
  REQUEST_EXPIRY_MS,
  getAuthoritativeExpiryDate,
  getExpiryThresholdDate,
  isBookingRequestExpired,
  formatExpiryCountdown,
} from "@/lib/booking/booking-expiry";

export type BookingQuote = {
  listingId: string;
  bookingMode: "INSTANT_BOOK" | "REQUEST_TO_BOOK";
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

  const cIn = parseBookingDate(opts.checkIn);
  const cOut = parseBookingDate(opts.checkOut);

  if (isNaN(cIn.getTime()) || isNaN(cOut.getTime())) {
    throw AppError.badRequest("Invalid check-in or check-out date");
  }

  const nights = differenceInBookingNights(cIn, cOut);

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
    const offerStartKey = bookingDateKey(offer.startDate);
    const offerEndKey = bookingDateKey(offer.endDate);
    const requestedStartKey = bookingDateKey(cIn);
    const requestedEndKey = bookingDateKey(cOut);
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
  const today = parseBookingDate(now);
  const checkInDate = parseBookingDate(cIn);
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
  const expiryThreshold = getExpiryThresholdDate();
  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      listingId: listing.id,
      startDate: { lt: cOut },
      endDate: { gt: cIn },
      OR: [
        { status: BookingStatus.CONFIRMED },
        { status: BookingStatus.PENDING, createdAt: { gt: expiryThreshold } },
      ],
    },
    select: { id: true },
  });
  if (overlappingBooking) throw AppError.conflict("The selected dates are not available");

  const blockedDates = new Set(Array.isArray(listing.blockedDates) ? listing.blockedDates : []);
  for (let date = new Date(cIn); date < cOut; date.setUTCDate(date.getUTCDate() + 1)) {
    const dateKey = bookingDateKey(date);
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
        checkIn: bookingDateKey(cIn),
        checkOut: bookingDateKey(cOut),
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
    bookingMode: resolveBookingMode(listing),
    checkIn: bookingDateKey(cIn),
    checkOut: bookingDateKey(cOut),
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
      d.setUTCDate(d.getUTCDate() + i);
      const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
      return {
        date: bookingDateKey(d),
        isWeekend,
        price: Math.round((validatedOffer?.subtotalPrice ?? pricing.staySubtotal) / nights),
        rateSource: "SPECIAL_OFFER" as const,
      };
    }),
  };
}

type CreateBookingRequest = Omit<CreateBookingInput, "nonRefundable"> & {
  nonRefundable?: boolean;
  expectedGuestTotal?: number;
  expectedCurrency?: string;
};

async function create(
  actor: AuthUser,
  input: CreateBookingRequest,
): Promise<BookingDTO> {
  if (input.requestSubmissionId) {
    const existingSubmission = await prisma.booking.findUnique({
      where: { submissionId: input.requestSubmissionId },
      select: { id: true },
    });
    if (existingSubmission) {
      throw AppError.checkoutConflict(ErrorCode.DUPLICATE_REQUEST, "This booking request has already been submitted.");
    }
  }
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

  // The listing is always authoritative. The request intentionally carries no
  // booking-mode switch that a guest could tamper with.
  const bookingMode = resolveBookingMode(listing);

  if (bookingMode === "REQUEST_TO_BOOK") {
    const messageValidation = validateHostMessage(input.message || "");
    if (!messageValidation.valid) throw AppError.badRequest(messageValidation.error);
    input.message = messageValidation.value;
  } else if (typeof input.message === "string" && input.message.trim()) {
    const messageValidation = validateHostMessage(input.message);
    if (!messageValidation.valid) throw AppError.badRequest(messageValidation.error);
    input.message = messageValidation.value;
  } else {
    input.message = undefined;
  }

  if (bookingMode === "INSTANT_BOOK" && listing.requireGoodTrackRecord) {
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
  if (
    input.expectedGuestTotal !== undefined
    && (quote.guestTotal !== input.expectedGuestTotal || quote.currency !== input.expectedCurrency)
  ) {
    throw AppError.checkoutConflict(
      ErrorCode.PRICE_CHANGED,
      "The price changed while you were reviewing. Review the updated total before submitting again.",
    );
  }
  const bookingCheckIn = parseBookingDate(input.startDate);
  const bookingCheckOut = parseBookingDate(input.endDate);

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
    if (input.requestSubmissionId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.requestSubmissionId}))`;
      const existingSubmission = await tx.booking.findUnique({
        where: { submissionId: input.requestSubmissionId },
        select: { id: true },
      });
      if (existingSubmission) {
        throw AppError.checkoutConflict(ErrorCode.DUPLICATE_REQUEST, "This booking request has already been submitted.");
      }
    }
    // Serialize booking attempts per listing so concurrent overlap checks cannot both win.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.listingId}))`;
    const expiryThreshold = getExpiryThresholdDate();
    const conflict = await tx.booking.findFirst({
      where: {
        listingId: input.listingId,
        startDate: { lt: bookingCheckOut },
        endDate: { gt: bookingCheckIn },
        OR: [
          { status: BookingStatus.CONFIRMED },
          { status: BookingStatus.PENDING, createdAt: { gt: expiryThreshold } },
        ],
      },
    });
    if (conflict) throw AppError.conflict("The selected dates are no longer available");

    const automaticallyApprove = bookingMode === "INSTANT_BOOK";

    const createdBooking = await tx.booking.create({ data: {
      submissionId: input.requestSubmissionId,
      userId: actor.id,
      listingId: input.listingId,
      startDate: bookingCheckIn,
      endDate: bookingCheckOut,
      guests: quote.guests,
      totalPrice: quote.guestTotal,
      nightlyPrice: quote.baseNightlyPrice,
      cleaningFee: quote.cleaningFee,
      currency: quote.currency,
      priceBreakdown: {
        ...quote,
        paymentPlan: input.paymentPlan ?? "FULL",
        paymentMode: "DEFERRED",
        paymentStatus: "PAYMENT_PENDING",
        paymentProvider: null,
        bookingMode,
        expiresAt: automaticallyApprove ? null : getAuthoritativeExpiryDate(new Date()).toISOString(),
      } as unknown as Prisma.InputJsonValue,
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

    // Persist the request message and its booking relationship atomically. A
    // booking request must never succeed with a disconnected host message.
    await messagingService.getOrCreateBookingConversation({
      guestId: actor.id,
      hostId: listing.hostId,
      listingId: input.listingId,
      bookingId: createdBooking.id,
      messageContent: input.message,
      isConfirmed: automaticallyApprove,
      guestName: actor.name || "A guest",
      db: tx,
    });

    return createdBooking;
  });

  // Invalidate booking caches after creation
  await invalidateBookingCache(booking.id, actor.id, listing.hostId);

  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "BOOKING_REQUEST_CREATED",
      resourceType: "BOOKING",
      resourceId: booking.id,
      description: "Guest submitted booking request.",
      status: "SUCCESS",
      metadata: {
        bookingId: booking.id,
        listingId: listing.id,
        status: booking.status,
      },
    });
  } catch {}

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
        event: isAutoConfirmed ? "BOOKING_CONFIRMED" : "BOOKING_REQUEST_CREATED",
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
        type: NotificationType.BOOKING, // NotificationType.BOOKING_REQUEST
        title: isAutoConfirmed
          ? `New Reservation: ${listing.title}`
          : `New Booking Request: ${listing.title}`,
        message: isAutoConfirmed
          ? `${guestName} booked ${listing.title} from ${input.startDate} to ${input.endDate}.`
          : `${guestName} requested to book ${listing.title} from ${input.startDate} to ${input.endDate}. Review request now.`,
        entityId: booking.id,
        entityType: "host_booking",
        link: `/host/bookings/${booking.id}`,
        metadata: {
          event: isAutoConfirmed ? "BOOKING_CONFIRMED" : "BOOKING_REQUEST_CREATED",
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
  opts: { skip: number; take: number; view?: "ALL" | "UPCOMING" },
): Promise<{ items: BookingDTO[]; total: number }> {
  const view = opts.view ?? "ALL";
  const cacheKey = CACHE_KEYS.BOOKINGS_USER(actor.id, view.toLowerCase(), opts.skip, opts.take);

  return getOrSetCache(
    cacheKey,
    async () => {
      const today = parseBookingDate(new Date());
      const expiryThreshold = getExpiryThresholdDate();
      const where: Prisma.BookingWhereInput = view === "UPCOMING"
        ? {
            userId: actor.id,
            endDate: { gte: today },
            OR: [
              { status: BookingStatus.CONFIRMED },
              { status: BookingStatus.PENDING, createdAt: { gt: expiryThreshold } },
            ],
          }
        : { userId: actor.id };
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
  totalPrice?: number | null;
  currency?: string;
  status?: BookingStatus;
  createdAt: Date;
  expiresAt: Date;
  isExpired: boolean;
  guest: { name: string | null; image: string | null };
  listing: { title: string; city: string | null; country: string | null; photos: string[] };
};

export type HostBookingRequestDetails = {
  id: string;
  startDate: Date;
  endDate: Date;
  guests: number;
  totalPrice: number | null;
  nightlyPrice: number | null;
  cleaningFee: number | null;
  currency: string;
  status: BookingStatus;
  cancellationPolicy: string | null;
  isNonRefundable: boolean;
  createdAt: Date;
  expiresAt: Date;
  isExpired: boolean;
  guest: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
    createdAt: Date;
  };
  listing: {
    id: string;
    title: string;
    city: string | null;
    country: string | null;
    address: string | null;
    photos: string[];
    price: number;
  };
  guestMessage: string | null;
  conversationId: string | null;
  priceBreakdown: any;
  timeline: BookingStatusTimelineEvent[];
  statusDetails?: BookingStatusDetails;
};

/** Pending, future-facing, unexpired requests owned by the authenticated host. */
async function listPendingForHost(actor: AuthUser): Promise<HostPendingBooking[]> {
  const now = new Date();
  const expiryThreshold = getExpiryThresholdDate(now);

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      endDate: { gt: now }, // endDate: { gt: new Date() }
      createdAt: { gt: expiryThreshold },
      listing: { hostId: actor.id },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      guests: true,
      totalPrice: true,
      currency: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, image: true } },
      listing: { select: { title: true, city: true, country: true, photos: true } },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });

  return bookings.map((booking: any) => {
    const expiresAt = getAuthoritativeExpiryDate(booking.createdAt);
    const isExpired = isBookingRequestExpired(booking.createdAt, now, booking.endDate);
    return {
      ...booking,
      expiresAt,
      isExpired,
      guest: booking.user,
    };
  });
}

/** Detailed view of a single pending request owned by the authenticated host. */
async function getRequestDetailsForHost(actor: AuthUser, id: string): Promise<HostBookingRequestDetails> {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          id: true,
          hostId: true,
          title: true,
          city: true,
          country: true,
          address: true,
          photos: true,
          price: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          email: true,
          createdAt: true,
        },
      },
    },
  });

  if (!booking) {
    throw AppError.notFound("Booking request not found");
  }

  if (booking.listing.hostId !== actor.id) {
    throw AppError.forbidden("You do not have permission to view this booking request");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { bookingId: booking.id },
    include: {
      messages: {
        where: { type: MessageType.BOOKING_REQUEST },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const REQUEST_EXPIRY_MS = 24 * 60 * 60 * 1000;
  const expiresAt = new Date(booking.createdAt.getTime() + REQUEST_EXPIRY_MS);
  const isExpired = Date.now() > expiresAt.getTime();

  const statusDetails = computeBookingStatus({
    dbStatus: booking.status,
    startDate: booking.startDate,
    endDate: booking.endDate,
    createdAt: booking.createdAt,
    isExpired,
  });

  const timeline = getBookingStatusTimeline({
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    statusDetails,
    priceBreakdown: booking.priceBreakdown,
  });

  return {
    id: booking.id,
    startDate: booking.startDate,
    endDate: booking.endDate,
    guests: booking.guests,
    totalPrice: booking.totalPrice,
    nightlyPrice: booking.nightlyPrice,
    cleaningFee: booking.cleaningFee,
    currency: booking.currency,
    status: booking.status,
    cancellationPolicy: booking.cancellationPolicy,
    isNonRefundable: booking.isNonRefundable,
    createdAt: booking.createdAt,
    expiresAt,
    isExpired,
    guest: booking.user,
    listing: {
      id: booking.listing.id,
      title: booking.listing.title,
      city: booking.listing.city,
      country: booking.listing.country,
      address: booking.listing.address,
      photos: booking.listing.photos,
      price: booking.listing.price,
    },
    guestMessage: conversation?.messages[0]?.content || null,
    conversationId: conversation?.id || null,
    priceBreakdown: booking.priceBreakdown,
    timeline,
    statusDetails,
  };
}

/** Validates host acceptance preconditions and confirms booking (with deferred payment or online capture). */
async function acceptBookingRequest(
  actor: AuthUser,
  id: string,
): Promise<{ success: boolean; status: "CONFIRMED"; bookingId: string }> {
  // Dispatches BOOKING_CONFIRMED notification via notificationService.create to guest upon host acceptance
  const policy = getPaymentPolicy();

  const confirmedBooking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;

    const booking = await tx.booking.findUnique({
      where: { id },
      include: { listing: true, user: true },
    });

    if (!booking) {
      throw AppError.notFound("Booking request not found");
    }

    if (booking.listing.hostId !== actor.id) {
      throw AppError.forbidden("You do not have permission to accept this booking request");
    }

    // if (booking.status !== BookingStatus.PENDING) { throw AppError.conflict("Booking request is no longer pending"); }
    if (booking.status !== BookingStatus.PENDING) {
      throw AppError.checkoutConflict(ErrorCode.REQUEST_ALREADY_PROCESSED, "Booking request is no longer pending");
    }

    const isExpired = isBookingRequestExpired(booking.createdAt, new Date(), booking.endDate);
    if (isExpired) {
      const existingBreakdown = (booking.priceBreakdown as Record<string, any>) || {};
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          priceBreakdown: {
            ...existingBreakdown,
            rejection: {
              rejectedAt: new Date().toISOString(),
              rejectedBy: "SYSTEM",
              reason: "EXPIRED",
            },
            expiredAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      // throw AppError.badRequest("This booking request has expired");
      throw AppError.checkoutConflict(
        ErrorCode.REQUEST_EXPIRED,
        "This booking request has expired and can no longer be accepted.",
      );
    }

    if (!booking.listing.published || booking.listing.status !== ListingStatus.ACTIVE || booking.listing.isPaused) {
      throw new AppError(
        ErrorCode.PROPERTY_NOT_AVAILABLE,
        "This property is no longer available for booking.",
        409,
      );
    }

    const conflict = await tx.booking.findFirst({
      where: {
        id: { not: booking.id },
        listingId: booking.listingId,
        status: BookingStatus.CONFIRMED,
        startDate: { lt: booking.endDate },
        endDate: { gt: booking.startDate },
      },
    });
    if (conflict) {
      throw AppError.conflict("Dates are no longer available for this property.");
    }

    if (policy.onlinePaymentRequired && policy.paymentMode === "ONLINE_AUTHORIZATION") {
      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "BOOKING_REQUEST_ACCEPT_ATTEMPTED",
        resourceType: "BOOKING",
        resourceId: booking.id,
        description: "Host attempted to accept booking request, but payment authorization is required.",
        status: "FAILURE",
        metadata: {
          bookingId: booking.id,
          reason: "BLOCKED_BY_PROVIDER",
        },
      });

      throw AppError.checkoutValidation(
        ErrorCode.PAYMENT_AUTHORIZATION_REQUIRED,
        "Payment authorization is required before this booking request can be accepted. Payment capture is currently blocked by provider.",
      );
    }

    const existingBreakdown = (booking.priceBreakdown as Record<string, any>) || {};
    const priceBreakdown = {
      ...existingBreakdown,
      paymentMode: "DEFERRED",
      paymentStatus: "PAYMENT_PENDING",
      paymentProvider: null,
      acceptance: {
        acceptedAt: new Date().toISOString(),
        acceptedBy: "HOST",
        hostId: actor.id,
      },
    } as Prisma.InputJsonValue;

    const updated = await tx.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CONFIRMED,
        priceBreakdown,
      },
    });

    return { ...updated, listing: booking.listing, user: booking.user };
  });

  await invalidateBookingCache(confirmedBooking.id, confirmedBooking.userId, confirmedBooking.listing.hostId);

  try {
    await notificationService.create({
      userId: confirmedBooking.userId,
      type: NotificationType.BOOKING,
      title: `Reservation Confirmed: ${confirmedBooking.listing.title}`,
      message: `Your booking request for ${confirmedBooking.listing.title} has been accepted by the host. Your reservation is confirmed!`,
      entityId: confirmedBooking.id,
      entityType: "booking",
      link: "/profile/tab/upcoming",
      metadata: {
        event: "BOOKING_REQUEST_ACCEPTED",
        type: "BOOKING_CONFIRMED",
        bookingId: confirmedBooking.id,
        listingId: confirmedBooking.listingId,
        status: BookingStatus.CONFIRMED,
        paymentStatus: "PAYMENT_PENDING",
        role: "guest",
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to send guest approval notification:", err);
  }

  try {
    await messagingService.recordBookingStatusMessage({
      bookingId: confirmedBooking.id,
      statusText: "Host accepted your booking request. Your reservation is confirmed!",
      newBookingStatus: BookingStatus.CONFIRMED,
      conversationStatus: ConversationStatus.CONFIRMED,
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record conversation confirmation status:", err);
  }

  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "BOOKING_REQUEST_ACCEPTED",
      resourceType: "BOOKING",
      resourceId: confirmedBooking.id,
      description: "Host accepted booking request without online payment gateway (DEFERRED mode).",
      status: "SUCCESS",
      metadata: {
        bookingId: confirmedBooking.id,
        previousStatus: BookingStatus.PENDING,
        newStatus: BookingStatus.CONFIRMED,
        paymentMode: "DEFERRED",
        paymentStatus: "PAYMENT_PENDING",
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record audit log for accept:", err);
  }

  return {
    success: true,
    status: "CONFIRMED",
    bookingId: confirmedBooking.id,
  };
}

/** Rejects a pending request, releases held inventory, and notifies the guest. */
async function rejectBookingRequest(
  actor: AuthUser,
  id: string,
  reason?: string,
): Promise<{ success: boolean; status: "REJECTED"; bookingId: string }> {
  const cancelled = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const b = await tx.booking.findUnique({
      where: { id },
      include: { listing: true, user: true },
    });
    if (!b) throw AppError.notFound("Booking request not found");
    if (b.listing.hostId !== actor.id) {
      throw AppError.forbidden("You do not have permission to reject this booking request");
    }
    if (b.status !== BookingStatus.PENDING) {
      if (b.status === BookingStatus.CANCELLED) {
        // Idempotent rejection: return existing cancelled/rejected booking
        return { ...b, listing: b.listing, user: b.user };
      }
      // if (b.status !== BookingStatus.PENDING) { throw AppError.conflict("Booking request is not in a pending state"); }
      throw AppError.checkoutConflict(ErrorCode.REQUEST_NOT_PENDING, "Booking request is not in a pending state");
    }

    const isExpired = isBookingRequestExpired(b.createdAt, new Date(), b.endDate);
    const existingBreakdown = (b.priceBreakdown as Record<string, any>) || {};
    const priceBreakdown = {
      ...existingBreakdown,
      paymentMode: "DEFERRED",
      paymentStatus: "PAYMENT_PENDING",
      rejection: {
        rejectedAt: new Date().toISOString(),
        rejectedBy: "HOST",
        hostId: actor.id,
        reason: reason?.trim() || (isExpired ? "EXPIRED" : null),
      },
      ...(isExpired ? { expiredAt: new Date().toISOString() } : {}),
    } as Prisma.InputJsonValue;

    const updated = await tx.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        priceBreakdown,
      },
    });

    return { ...updated, listing: b.listing, user: b.user };
  });

  await invalidateBookingCache(cancelled.id, cancelled.userId, cancelled.listing.hostId);

  const trimmedReason = reason?.trim();

  try {
    const existingBooking = cancelled;
    await notificationService.create({
      userId: existingBooking.userId,
      type: NotificationType.BOOKING,
      title: `Booking Request Declined: ${cancelled.listing.title}`,
      message: trimmedReason
        ? `Your booking request for ${cancelled.listing.title} was declined: "${trimmedReason}"`
        : `Your booking request for ${cancelled.listing.title} was declined by the host.`,
      entityId: cancelled.id,
      entityType: "booking",
      link: "/profile/tab/past",
      metadata: {
        event: "BOOKING_REQUEST_REJECTED",
        bookingId: cancelled.id,
        listingId: cancelled.listingId,
        status: BookingStatus.CANCELLED,
        declined: true,
        reason: trimmedReason || null,
        role: "guest",
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to create rejection notification:", err);
  }

  try {
    await messagingService.recordBookingStatusMessage({
      bookingId: cancelled.id,
      statusText: trimmedReason
        ? `Host declined this booking request. Reason: ${trimmedReason}`
        : "Host declined this booking request.",
      newBookingStatus: BookingStatus.CANCELLED,
      conversationStatus: ConversationStatus.DECLINED,
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record conversation status for rejection:", err);
  }

  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "BOOKING_REQUEST_REJECTED",
      resourceType: "BOOKING",
      resourceId: cancelled.id,
      description: "Host rejected pending booking request.",
      status: "SUCCESS",
      metadata: {
        bookingId: cancelled.id,
        reason: trimmedReason || null,
        previousStatus: BookingStatus.PENDING,
        newStatus: BookingStatus.CANCELLED,
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record audit log for rejection:", err);
  }

  return {
    success: true,
    status: "REJECTED",
    bookingId: cancelled.id,
  };
}

/** Confirms every active pending booking belonging to the authenticated host. */
async function approveAllPendingForHost(actor: AuthUser): Promise<{ approved: number }> {
  const now = new Date();
  const expiryThreshold = getExpiryThresholdDate(now);

  const pendingBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      endDate: { gt: now },
      createdAt: { gt: expiryThreshold },
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

/**
 * Expires an individual pending booking request transactionally:
 * - Locks booking record with advisory lock
 * - Updates status to CANCELLED with rejection.rejectedBy = "SYSTEM", reason = "EXPIRED"
 * - Sets priceBreakdown.expiredAt
 * - Releases held dates
 * - Sends guest notification
 * - Records conversation status EXPIRED
 * - Records audit log
 * - Invalidates caches
 */
async function expireBookingRequest(
  id: string,
): Promise<{ success: boolean; status: "EXPIRED"; bookingId: string } | null> {
  const expiredBooking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const b = await tx.booking.findUnique({
      where: { id },
      include: { listing: true, user: true },
    });
    if (!b) return null;
    if (b.status !== BookingStatus.PENDING) return null;

    const existingBreakdown = (b.priceBreakdown as Record<string, any>) || {};
    const priceBreakdown = {
      ...existingBreakdown,
      paymentMode: "DEFERRED",
      paymentStatus: "PAYMENT_PENDING",
      rejection: {
        rejectedAt: new Date().toISOString(),
        rejectedBy: "SYSTEM",
        reason: "EXPIRED",
      },
      expiredAt: new Date().toISOString(),
    } as Prisma.InputJsonValue;

    const updated = await tx.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        priceBreakdown,
      },
    });

    return { ...updated, listing: b.listing, user: b.user };
  });

  if (!expiredBooking) return null;

  await invalidateBookingCache(expiredBooking.id, expiredBooking.userId, expiredBooking.listing.hostId);

  try {
    const existingBooking = expiredBooking;
    await notificationService.create({
      userId: existingBooking.userId,
      type: NotificationType.BOOKING,
      title: `Booking Request Expired: ${expiredBooking.listing.title}`,
      message: `Your booking request for ${expiredBooking.listing.title} expired because the host did not respond within 24 hours.`,
      entityId: expiredBooking.id,
      entityType: "booking",
      link: "/profile/tab/past",
      metadata: {
        event: "BOOKING_REQUEST_EXPIRED",
        bookingId: expiredBooking.id,
        listingId: expiredBooking.listingId,
        status: BookingStatus.CANCELLED,
        expired: true,
        role: "guest",
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to create expiry notification:", err);
  }

  try {
    await messagingService.recordBookingStatusMessage({
      bookingId: expiredBooking.id,
      statusText: "Booking request expired. The host did not respond within 24 hours.",
      newBookingStatus: BookingStatus.CANCELLED,
      conversationStatus: ConversationStatus.EXPIRED,
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record conversation status for expiry:", err);
  }

  try {
    await auditService.record({
      actorId: "SYSTEM",
      actorEmail: "system@homyz.internal",
      action: "BOOKING_REQUEST_EXPIRED",
      resourceType: "BOOKING",
      resourceId: expiredBooking.id,
      description: "Booking request expired after 24-hour response window elapsed.",
      status: "SUCCESS",
      metadata: {
        bookingId: expiredBooking.id,
        previousStatus: BookingStatus.PENDING,
        newStatus: BookingStatus.CANCELLED,
        reason: "EXPIRED",
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record audit log for expiry:", err);
  }

  return {
    success: true,
    status: "EXPIRED",
    bookingId: expiredBooking.id,
  };
}

/**
 * Scans for active pending booking requests that have exceeded their 24-hour response deadline
 * or whose stay dates have passed, and idempotently transitions them to EXPIRED.
 */
async function expireStaleBookingRequests(limit = 100): Promise<{ expiredCount: number; bookingIds: string[] }> {
  const now = new Date();
  const expiryThreshold = getExpiryThresholdDate(now);

  const staleBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      OR: [
        { createdAt: { lte: expiryThreshold } },
        { endDate: { lte: now } },
      ],
    },
    take: limit,
    select: { id: true },
  });

  const bookingIds: string[] = [];
  for (const b of staleBookings) {
    const res = await expireBookingRequest(b.id);
    if (res?.success) {
      bookingIds.push(b.id);
    }
  }

  return { expiredCount: bookingIds.length, bookingIds };
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
    if (bookingDateKey(booking.startDate) <= bookingDateKey(now)) {
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
  guestMessage: string | null;
  conversationId: string | null;
  timeline: BookingStatusTimelineEvent[];
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

  // If stay has completed or response deadline passed and DB was PENDING, lazily expire
  const isExpired = b.status === BookingStatus.PENDING && isBookingRequestExpired(b.createdAt, new Date(), b.endDate);
  if (isExpired) {
    try {
      const existingBreakdown = (b.priceBreakdown as Record<string, any>) || {};
      await prisma.booking.update({
        where: { id: b.id },
        data: {
          status: BookingStatus.CANCELLED,
          priceBreakdown: {
            ...existingBreakdown,
            rejection: {
              rejectedAt: new Date().toISOString(),
              rejectedBy: "SYSTEM",
              reason: "EXPIRED",
            },
            expiredAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      b.status = BookingStatus.CANCELLED;
      (b as any).priceBreakdown = {
        ...existingBreakdown,
        rejection: {
          rejectedAt: new Date().toISOString(),
          rejectedBy: "SYSTEM",
          reason: "EXPIRED",
        },
        expiredAt: new Date().toISOString(),
      };
    } catch {
      // non-fatal
    }
  }

  const existingReview = b.reviews.find((r: { id: string; rating: number; authorId: string }) => r.authorId === b.userId) || b.reviews[0] || null;
  const hasReview = Boolean(existingReview);

  const breakdown = (b.priceBreakdown as Record<string, any>) || {};
  const rejection = breakdown.rejection || {};
  const cancellation = breakdown.cancellation || {};

  const statusDetails = computeBookingStatus({
    dbStatus: b.status,
    startDate: b.startDate,
    endDate: b.endDate,
    checkInStart: b.listing.checkInStart,
    checkOutTime: b.listing.checkOutTime,
    createdAt: b.createdAt,
    rejectionReason: rejection.reason || cancellation.reason || null,
    rejectionBy: rejection.rejectedBy || cancellation.cancelledBy || null,
    isExpired: Boolean(breakdown.expiredAt || rejection.reason === "EXPIRED" || isExpired),
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

  const conversation = await prisma.conversation.findFirst({
    where: { bookingId: b.id },
    include: {
      messages: {
        where: { type: MessageType.BOOKING_REQUEST },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const timeline = getBookingStatusTimeline({
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    statusDetails,
    priceBreakdown: b.priceBreakdown,
  });

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
    guestMessage: conversation?.messages[0]?.content || null,
    conversationId: conversation?.id || null,
    timeline,
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

  const checkIn = parseBookingDate(input.startDate);
  const checkOut = parseBookingDate(input.endDate);
  const today = parseBookingDate(new Date());

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

  const checkIn = parseBookingDate(input.startDate);
  const checkOut = parseBookingDate(input.endDate);
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
      message: `Your reservation dates have been changed to ${bookingDateKey(checkIn)} – ${bookingDateKey(checkOut)}.`,
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
  getRequestDetailsForHost,
  acceptBookingRequest,
  rejectBookingRequest,
  approveAllPendingForHost,
  getById,
  getBookingDetails,
  changeBookingReservationPreview,
  changeBookingReservation,
  getQuote: getBookingQuote,
  getBookingQuote,
  expireBookingRequest,
  expireStaleBookingRequests,
  cancelNonRefundableByGuest,
  cancelBookingByGuest,
  listForAdminDashboard,
};
