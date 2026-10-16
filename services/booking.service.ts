import { AppError, ErrorCode } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertOwnership, assertRole } from "@/lib/permissions/authorize";
import { sanitizeListingSecrets, resolveCancellationDetails, isAuthoritativeCancellation, type CancellationInitiator } from "@/lib/booking/booking-lifecycle";
import { prisma } from "@/lib/db/prisma";
import { getOrSetCache } from "@/lib/redis/cache";
import { CACHE_KEYS, hashFilters } from "@/lib/redis/keys";
import { CACHE_TTL } from "@/lib/redis/ttl";
import { invalidateBookingCache } from "@/lib/redis/invalidation";
import type { CreateBookingInput } from "@/lib/validation/booking";
import { ADDRESS_COUNTRIES } from "@/lib/location/address-countries";

import { reviveBookingDTO, toBookingDTO, type BookingDTO } from "./mappers";

import { BookingStatus, PaymentStatus, PaymentProvider, RefundStatus, ListingStatus, NotificationType, Role, ConversationStatus, SpecialOfferStatus, MessageType, ListingCoHostStatus, ReviewDirection } from "@/generated/prisma/enums";
import { nanoid } from "nanoid";
import { notificationService } from "./notification.service";
import { messagingService } from "./messaging.service";
import { auditService } from "./audit.service";

import { Prisma } from "@/generated/prisma/client";
import { calculateRefundEligibility } from "@/lib/refund/policy-engine";
import type { CalculatedTaxItem, HostPayoutBreakdown, ListingTaxDTO } from "@/lib/tax/types";
import { getHostServiceFeePercentage } from "@/services/app-settings.service";
import { getNonRefundableDiscountPercentage } from "@/services/app-settings.service";
import {
  calculateBookingPrice,
  calculateSpecialOffer,
  isWeekendNight,
  type AppliedDiscount,
  type SelectedDiscountQuote,
  type WinningDiscountResult,
  type DiscountEligibilityResult,
} from "@/services/pricing.service";
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
  allocateNightlyTotal,
  getAuthoritativePriceBreakdown,
  type AuthoritativePriceBreakdown,
} from "@/lib/booking/booking-price";
import { extractStoredGuestTotal } from "@/lib/booking/booking-financials";
import { resolveBookingMode } from "@/lib/booking/booking-mode";
import {
  bookingDateKey,
  differenceInBookingNights,
  parseBookingDate,
} from "@/lib/booking/booking-date";
import {
  parseCutoffHour,
  parseRequiredAdvanceDays,
  validateStayAvailability,
} from "@/lib/booking/availability";
import { validateHostMessage } from "@/lib/booking/host-message";
import { getPaymentPolicy } from "@/lib/booking/payment-policy";
import {
  REQUEST_TO_BOOK_RESPONSE_HOURS,
  REQUEST_EXPIRY_MS,
  getAuthoritativeExpiryDate,
  getExpiryThresholdDate,
  isBookingRequestExpired,
  formatExpiryCountdown,
  getTimeRemaining,
} from "@/lib/booking/booking-expiry";

/**
 * Re-evaluate only the affected listing after a host-caused cancellation.
 * The import is lazy so the booking flow stays independent of the Guest
 * Favorite evaluator and a transient evaluator failure cannot roll back a
 * completed cancellation. The daily evaluator remains the reconciliation
 * path for any failed immediate update.
 */
async function triggerGuestFavoriteReevaluation(listingId: string): Promise<void> {
  try {
    const { evaluateListingGuestFavoriteDaily } = await import(
      "@/services/guest-favorite.service"
    );
    await evaluateListingGuestFavoriteDaily(listingId);
  } catch (error) {
    console.error(
      `[booking.service] Immediate Guest Favorite recalculation failed for listing ${listingId}:`,
      error,
    );
  }
}

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
  /** Legacy response field; inclusive occupancy always returns zero. */
  extraGuestFee?: number;
  petFee?: number; // cents
  cleaningFee?: number; // cents flat per stay
  hostServiceFee: number; // cents
  hostServiceFeePercentage: number; // percentage e.g. 15
  subtotal: number; // accommodation + supported additional fees (cents)
  totalPrice: number; // cents (totalPrice before tax for compatibility)
  taxes: CalculatedTaxItem[];
  taxTotal: number; // total tax in cents
  platformRemittedTaxTotal: number; // taxes platform collects & remits
  hostRemittedTaxTotal: number; // taxes host collects & remits
  guestTotal: number; // accommodation + supported additional fees + tax (cents)
  payoutBreakdown?: HostPayoutBreakdown;
  currency: string;
  guests: number;
  pets: number;
  cancellationPolicy: string;
  cancellationPolicyType: "SHORT_TERM" | "LONG_TERM";
  nonRefundableAvailable: boolean;
  isNonRefundable: boolean;
  rateType?: "STANDARD" | "NON_REFUNDABLE" | string;
  nonRefundable?: {
    enabled: boolean;
    selected: boolean;
    percentage?: number | null;
    amount: number;
  };
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
  nightlyBreakdown?: Array<{
    date: string;
    rate: number;
    rateType?: "CUSTOM" | "WEEKEND" | "WEEKDAY" | "SPECIAL_OFFER";
  }>;
  accommodationSubtotal?: number;
  discountedAccommodationSubtotal?: number;
  feeBreakdown?: Array<{ id: string; name: string; amount: number }>;
  taxBreakdown?: CalculatedTaxItem[];
  feeTotal?: number;
  total?: number;
  selectedDiscount?: SelectedDiscountQuote | null;
  winningDiscount?: WinningDiscountResult;
  discountEligibility?: DiscountEligibilityResult;
  originalDisplayPrice?: number;
  discountedDisplayPrice?: number;
  discountType?: string | null;
  discountLabel?: string | null;
};

type QuoteListing = Prisma.ListingGetPayload<{ include: { taxes: true } }>;

export { parseCutoffHour, parseRequiredAdvanceDays };

export async function getBookingQuote(opts: {
  listingId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  guests?: number;
  pets?: number;
  nonRefundable?: boolean;
  specialOfferId?: string;
  actor?: AuthUser;
  /** Internal fast path for booking submission after the listing was validated. */
  preloadedListing?: QuoteListing;
}): Promise<BookingQuote> {
  // Start the independent platform-fee lookup immediately. It affects host
  // payout only, but resolving it in parallel avoids a database waterfall.
  const hostServiceFeePromise = getHostServiceFeePercentage().catch(() => 15);
  const listing = opts.preloadedListing?.id === opts.listingId
    ? opts.preloadedListing
    : await prisma.listing.findUnique({
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

  const now = new Date();
  const requestedGuests = opts.guests ?? 1;
  // Keep the quote endpoint's capacity failure explicit. The shared validator
  // repeats this rule so search, detail, checkout, and the final transaction
  // cannot drift from one another.
  if (requestedGuests > (listing.guests || 1)) {
    throw AppError.badRequest(`Property accommodates a maximum of ${listing.guests || 1} guests`);
  }
  const ruleValidation = validateStayAvailability({
    listing,
    checkIn: bookingDateKey(cIn),
    checkOut: bookingDateKey(cOut),
    guests: requestedGuests,
    now,
    skipLengthRules: Boolean(validatedOffer),
  });
  if (!ruleValidation.available) {
    if (ruleValidation.code === "BLOCKED_DATE" || ruleValidation.code === "BOOKING_OVERLAP") {
      throw AppError.conflict(ruleValidation.message);
    }
    throw AppError.badRequest(ruleValidation.message);
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
  const hostServiceFeePercentage = await hostServiceFeePromise;

  const usesManualAdjustments = listing.smartPricing !== true;
  const pricing = validatedOffer
    ? await calculateSpecialOffer({
        specialOfferAmount: validatedOffer.subtotalPrice,
        nights,
        cleaningFee: listing.cleaningFee,
        petFee: listing.petFee,
        extraGuestFee: (listing as any).extraGuestFee,
        baseGuests: (listing.discounts as any)?.baseGuests ?? (listing.discounts as any)?.includedGuests ?? (listing as any).baseGuests,
        guests: requestedGuests,
        pets: requestedPets,
        hostServiceFeePercentage,
        taxRules: [],
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
        weekendPremium: usesManualAdjustments ? listing.weekendPremium : null,
        customPrices: (listing as any).customPrices as Record<string, number> | null,
        cleaningFee: listing.cleaningFee,
        extraGuestFee: (listing as any).extraGuestFee,
        baseGuests: (listing.discounts as any)?.baseGuests ?? (listing.discounts as any)?.includedGuests ?? (listing as any).baseGuests,
        guests: requestedGuests,
        pets: requestedPets,
        petFee: listing.petFee,
        discounts: usesManualAdjustments ? (listing.discounts as Record<string, unknown> | null) : null,
        // The new-listing promotion is a real guest-facing discount, so keep
        // it enabled in the authoritative quote used by detail and checkout.
        includeNewListingPromotion: true,
        hostServiceFeePercentage,
        taxRules: [],
        hostTaxes,
        nonRefundableDiscountPercentage: opts.nonRefundable ? configuredNonRefundablePercentage : null,
        currency: getCurrencyForCountry(listing.country),
      });

  const subtotal = pricing.accommodationSubtotal + pricing.petFee + pricing.cleaningFee + (pricing.extraGuestFee ?? 0);
  const fallbackNightlyTotal = validatedOffer?.subtotalPrice ?? pricing.staySubtotal;
  const fallbackNightlyRates = allocateNightlyTotal(fallbackNightlyTotal, nights);
  const nightlyBreakdown = pricing.nightlyBreakdown.length > 0
    ? pricing.nightlyBreakdown
    : Array.from({ length: nights }, (_, index) => {
        const date = new Date(cIn);
        date.setUTCDate(date.getUTCDate() + index);
        return {
          date: bookingDateKey(date),
          rate: fallbackNightlyRates[index],
          rateType: "SPECIAL_OFFER" as const,
        };
      });

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
    selectedDiscount: pricing.selectedDiscount,
    accommodationSubtotal: pricing.accommodationSubtotal,
    discountedAccommodationSubtotal: pricing.discountedAccommodationSubtotal,
    feeBreakdown: pricing.feeBreakdown,
    feeTotal: pricing.feeTotal,
    taxBreakdown: pricing.taxBreakdown,
    total: pricing.total,
    originalDisplayPrice: pricing.originalDisplayPrice,
    discountedDisplayPrice: pricing.discountedDisplayPrice,
    discountType: pricing.discountType,
    discountLabel: pricing.discountLabel,
    winningDiscount: pricing.winningDiscount,
    discountEligibility: pricing.discountEligibility,
    extraGuestFee: pricing.extraGuestFee,
    petFee: pricing.petFee,
    cleaningFee: pricing.cleaningFee,
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
    rateType: opts.nonRefundable ? ("NON_REFUNDABLE" as const) : ("STANDARD" as const),
    nonRefundable: pricing.nonRefundable ?? {
      enabled: nonRefundableAvailable,
      selected: Boolean(opts.nonRefundable),
      percentage: opts.nonRefundable && configuredNonRefundablePercentage ? configuredNonRefundablePercentage : 0,
      amount: pricing.nonRefundableDiscount?.amount ?? 0,
    },
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
    })) : nightlyBreakdown.map((night) => ({
        date: night.date,
        isWeekend: isWeekendNight(night.date),
        price: night.rate,
        rateSource: "SPECIAL_OFFER" as const,
      })),
    nightlyBreakdown,
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
  prevalidatedQuote?: BookingQuote,
  prevalidatedListing?: QuoteListing,
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
  const listing = prevalidatedListing?.id === input.listingId
    ? prevalidatedListing
    : await prisma.listing.findUnique({
        where: { id: input.listingId },
        include: { taxes: { where: { isActive: true } } },
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
  const quote = prevalidatedQuote ?? await getBookingQuote({
      listingId: input.listingId,
      checkIn: input.startDate,
      checkOut: input.endDate,
      guests: input.guests,
      pets: input.pets,
      nonRefundable: input.nonRefundable ?? false,
      specialOfferId: input.specialOfferId,
      actor,
      preloadedListing: listing,
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
    // Lock and reread the listing itself. Calendar/price writes that completed
    // before this point must be reflected; writes that start after this point
    // wait until the reservation transaction finishes.
    await tx.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${input.listingId} FOR SHARE`;
    const currentListing = await tx.listing.findUnique({
      where: { id: input.listingId },
      select: {
        updatedAt: true,
        guests: true,
        minNights: true,
        maxNights: true,
        advanceNotice: true,
        sameDayCutoff: true,
        allowSameDayRequests: true,
        blockedDates: true,
        discounts: true,
        published: true,
        status: true,
        isPaused: true,
        deletedAt: true,
      },
    });
    if (!currentListing || !currentListing.published || currentListing.status !== ListingStatus.ACTIVE || currentListing.isPaused || currentListing.deletedAt) {
      throw AppError.conflict("This listing is no longer available");
    }
    if (currentListing.updatedAt.getTime() !== listing.updatedAt.getTime()) {
      throw AppError.checkoutConflict(
        ErrorCode.PRICE_CHANGED,
        "The listing price or availability changed while you were reviewing. Refresh the quote before submitting again.",
      );
    }
    const latestAvailability = validateStayAvailability({
      listing: currentListing,
      checkIn: bookingCheckIn,
      checkOut: bookingCheckOut,
      guests: input.guests,
      now: new Date(),
      skipLengthRules: Boolean(input.specialOfferId),
    });
    if (!latestAvailability.available) {
      throw AppError.conflict(latestAvailability.message);
    }
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
      cleaningFee: quote.cleaningFee ?? 0,
      currency: quote.currency,
      priceBreakdown: {
        ...quote,
        pricingSnapshotVersion: "v1",
        pricingSnapshotRevision: 1,
        automaticDiscount: quote.selectedDiscount ? {
          type: quote.selectedDiscount.type,
          label: quote.selectedDiscount.label,
          percentage: quote.selectedDiscount.percentage,
          amount: quote.selectedDiscount.amount,
        } : null,
        cancellationPolicySnapshot: quote.cancellationPolicy,
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

    // Persist the canonical payment record atomically with the reservation
    const paymentPolicy = getPaymentPolicy();
    const isMockMode = paymentPolicy.paymentMode === "MOCK";
    const paymentProvider = isMockMode ? PaymentProvider.MOCK : PaymentProvider.DEFERRED;
    const isCapturedOnCreation = isMockMode && automaticallyApprove;
    const initialPaymentStatus = isCapturedOnCreation ? PaymentStatus.CAPTURED : PaymentStatus.PENDING;

    await tx.bookingPayment.create({
      data: {
        bookingId: createdBooking.id,
        provider: paymentProvider,
        status: initialPaymentStatus,
        currency: quote.currency || "SAR",
        amount: quote.guestTotal,
        capturedAmount: isCapturedOnCreation ? quote.guestTotal : 0,
        refundedAmount: 0,
        idempotencyKey: input.requestSubmissionId ? `pay_idem_${input.requestSubmissionId}` : `pay_idem_${createdBooking.id}`,
        providerPaymentId: isCapturedOnCreation ? `mock_ch_${nanoid(12)}` : null,
        capturedAt: isCapturedOnCreation ? new Date() : null,
        metadata: {
          paymentPlan: input.paymentPlan ?? "FULL",
          bookingMode,
          expectedGuestTotal: input.expectedGuestTotal,
          pricingSnapshotVersion: "v1",
        },
      },
    });

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
            reviews: {
              where: {
                authorId: actor.id,
                direction: ReviewDirection.GUEST_TO_PROPERTY,
              },
              select: { status: true },
              take: 1,
            },
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

  if (booking.listing.hostId !== actor.id && actor.role !== Role.ADMIN) {
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
      const payment = await tx.bookingPayment.findFirst({
        where: { bookingId: booking.id },
        orderBy: { createdAt: "desc" },
      });
      if (payment && (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.AUTHORIZED)) {
        await tx.bookingPayment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.VOIDED,
            voidedAt: new Date(),
          },
        });
      }

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

    const existingPayment = await tx.bookingPayment.findFirst({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
    });
    if (existingPayment) {
      if (policy.paymentMode === "MOCK" && existingPayment.status === PaymentStatus.PENDING) {
        await tx.bookingPayment.update({
          where: { id: existingPayment.id },
          data: {
            status: PaymentStatus.CAPTURED,
            capturedAmount: existingPayment.amount,
            capturedAt: new Date(),
            providerPaymentId: existingPayment.providerPaymentId || `mock_ch_${nanoid(12)}`,
          },
        });
      }
    } else {
      await tx.bookingPayment.create({
        data: {
          bookingId: booking.id,
          provider: policy.paymentMode === "MOCK" ? PaymentProvider.MOCK : PaymentProvider.DEFERRED,
          status: policy.paymentMode === "MOCK" ? PaymentStatus.CAPTURED : PaymentStatus.PENDING,
          currency: booking.currency || "SAR",
          amount: booking.totalPrice ?? 0,
          capturedAmount: policy.paymentMode === "MOCK" ? (booking.totalPrice ?? 0) : 0,
          capturedAt: policy.paymentMode === "MOCK" ? new Date() : null,
          providerPaymentId: policy.paymentMode === "MOCK" ? `mock_ch_${nanoid(12)}` : null,
          idempotencyKey: `pay_idem_${booking.id}`,
        },
      });
    }

    const existingBreakdown = (booking.priceBreakdown as Record<string, any>) || {};
    const priceBreakdown = {
      ...existingBreakdown,
      paymentMode: policy.paymentMode === "MOCK" ? "MOCK" : "DEFERRED",
      paymentStatus: policy.paymentMode === "MOCK" ? "CAPTURED" : "PAYMENT_PENDING",
      paymentProvider: policy.paymentMode === "MOCK" ? "MOCK" : null,
      acceptance: {
        acceptedAt: new Date().toISOString(),
        acceptedBy: "HOST",
        hostId: actor.id,
      },
    } as unknown as Prisma.InputJsonValue;

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

    const payment = await tx.bookingPayment.findFirst({
      where: { bookingId: b.id },
      orderBy: { createdAt: "desc" },
    });
    if (payment && (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.AUTHORIZED)) {
      await tx.bookingPayment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VOIDED,
          voidedAt: new Date(),
        },
      });
    }

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

    const payment = await tx.bookingPayment.findFirst({
      where: { bookingId: b.id },
      orderBy: { createdAt: "desc" },
    });
    if (payment && (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.AUTHORIZED)) {
      await tx.bookingPayment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VOIDED,
          voidedAt: new Date(),
        },
      });
    }

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

  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "BOOKING_CANCELLED_BY_GUEST",
      resourceType: "BOOKING",
      resourceId: cancelled.id,
      description: "Guest cancelled non-refundable reservation.",
      status: "SUCCESS",
      metadata: {
        bookingId: cancelled.id,
        listingId: cancelled.listingId,
        isNonRefundable: true,
        guestRefundAmount: 0,
        previousStatus: BookingStatus.CONFIRMED,
        newStatus: BookingStatus.CANCELLED,
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record audit log for non-refundable cancellation:", err);
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
    const originalNetHostPayout =
      typeof payoutBreakdown.netHostPayout === "number"
        ? payoutBreakdown.netHostPayout
        : 0;

    const payment = await tx.bookingPayment.findFirst({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
    });

    const nights = typeof originalSnapshot.nights === "number"
      ? originalSnapshot.nights
      : Math.max(1, Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / (86400 * 1000)));
    const cleaningFee = booking.cleaningFee ?? (typeof originalSnapshot.cleaningFee === "number" ? originalSnapshot.cleaningFee : 0);
    const serviceFee = typeof originalSnapshot.serviceFee === "number"
      ? originalSnapshot.serviceFee
      : (typeof originalSnapshot.guestServiceFee === "number" ? originalSnapshot.guestServiceFee : 0);
    const taxes = typeof originalSnapshot.taxTotal === "number" ? originalSnapshot.taxTotal : 0;
    const accommodationTotal = typeof originalSnapshot.nightlySubtotal === "number"
      ? originalSnapshot.nightlySubtotal
      : ((booking.totalPrice ?? 0) - cleaningFee - serviceFee - taxes);

    // A confirmed booking is not evidence that funds were captured. Refund
    // eligibility is constrained to the payment ledger only.
    const capturedAmount = payment?.capturedAmount ?? 0;
    const alreadyRefundedAmount = payment?.refundedAmount ?? 0;

    const eligibility = calculateRefundEligibility({
      bookingId: booking.id,
      cancellationActor: "GUEST",
      effectiveCancellationTime: now,
      policyIdSnapshot: (originalSnapshot.cancellationPolicySnapshot as string) || booking.cancellationPolicy || booking.listing.cancellationPolicy,
      policyVersion: "v1",
      isNonRefundable: Boolean(booking.isNonRefundable),
      nights,
      checkInDate: booking.startDate,
      checkInTimeStr: booking.listing.checkInStart,
      totalPrice: booking.totalPrice ?? 0,
      accommodationTotal,
      cleaningFee,
      serviceFee,
      taxes,
      currency: booking.currency || "SAR",
      capturedAmount,
      alreadyRefundedAmount,
    });

    const guestRefundAmount = eligibility.totalRefundableAmount;
    const hostPayoutRetained = booking.isNonRefundable
      ? originalNetHostPayout
      : Math.max(0, originalNetHostPayout - guestRefundAmount);

    const priceBreakdown = {
      ...originalSnapshot,
      cancellation: {
        cancelledAt: now.toISOString(),
        cancelledBy: "GUEST",
        isNonRefundable: Boolean(booking.isNonRefundable),
        policy: eligibility.policyUsed,
        policyVersion: eligibility.policyVersion,
        milestoneApplied: eligibility.milestoneApplied,
        guestRefundAmount,
        hostPayoutRetained,
        explanation: eligibility.explanation,
        requiresAttention: eligibility.status === "NEEDS_REVIEW",
      },
    } as Prisma.InputJsonValue;

    if (payment && (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.AUTHORIZED)) {
      await tx.bookingPayment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VOIDED,
          voidedAt: now,
        },
      });
    } else if (payment && (payment.status === PaymentStatus.CAPTURED || payment.status === PaymentStatus.PARTIALLY_REFUNDED) && guestRefundAmount > 0) {
      const refundStatus = RefundStatus.PENDING;

      await tx.bookingRefund.create({
        data: {
          bookingId: booking.id,
          paymentId: payment.id,
          refundReference: `REF-${nanoid(8).toUpperCase()}`,
          idempotencyKey: `idem_cancel_${booking.id}_${now.getTime()}`,
          status: refundStatus,
          currency: payment.currency || "SAR",
          amount: guestRefundAmount,
          reason: `Guest cancellation: ${eligibility.explanation}`,
          requestedById: actor.id,
          approvedById: null,
          processedAt: null,
          succeededAt: null,
          providerRefundId: null,
          metadata: {
            refundType: guestRefundAmount >= payment.capturedAmount ? "FULL" : "PARTIAL",
            milestoneApplied: eligibility.milestoneApplied,
            policyUsed: eligibility.policyUsed,
          },
        },
      });

    }

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

  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "BOOKING_CANCELLED_BY_GUEST",
      resourceType: "BOOKING",
      resourceId: cancelled.id,
      description: "Guest cancelled reservation.",
      status: "SUCCESS",
      metadata: {
        bookingId: cancelled.id,
        listingId: cancelled.listingId,
        isNonRefundable: Boolean(cancelled.isNonRefundable),
        guestRefundAmount: cancelled.isNonRefundable ? 0 : (extractStoredGuestTotal(cancelled) ?? 0),
        previousStatus: BookingStatus.CONFIRMED,
        newStatus: BookingStatus.CANCELLED,
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record audit log for guest cancellation:", err);
  }

  return toBookingDTO(cancelled);

}

async function cancelBookingByHost(
  actor: AuthUser,
  id: string,
  reason?: string,
  isExcluded = false,
): Promise<BookingDTO> {
  const cancelled = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      include: { listing: true, user: true },
    });
    if (!booking) throw AppError.notFound("Booking not found");

    if (booking.listing.hostId !== actor.id && actor.role !== Role.ADMIN) {
      const coHost = await tx.listingCoHost.findFirst({
        where: {
          listingId: booking.listingId,
          userId: actor.id,
          status: ListingCoHostStatus.ACCEPTED,
        },
      });
      if (!coHost) {
        throw AppError.forbidden("Only the listing owner or accepted co-host can cancel this reservation");
      }
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw AppError.conflict("This reservation has already been cancelled.");
    }

    const now = new Date();
    const originalSnapshot =
      booking.priceBreakdown &&
      typeof booking.priceBreakdown === "object" &&
      !Array.isArray(booking.priceBreakdown)
        ? (booking.priceBreakdown as Record<string, unknown>)
        : {};

    const payment = await tx.bookingPayment.findFirst({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
    });
    const refundDue = payment ? Math.max(0, payment.capturedAmount - payment.refundedAmount) : 0;

    const priceBreakdown = {
      ...originalSnapshot,
      cancellation: {
        cancelledAt: now.toISOString(),
        cancelledBy: "HOST",
        hostId: actor.id,
        reason: reason?.trim() || null,
        isExcluded: Boolean(isExcluded),
        guestRefundAmount: refundDue,
        hostPayoutRetained: 0,
      },
    } as Prisma.InputJsonValue;

    if (payment && (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.AUTHORIZED)) {
      await tx.bookingPayment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VOIDED,
          voidedAt: now,
        },
      });
    } else if (payment && (payment.status === PaymentStatus.CAPTURED || payment.status === PaymentStatus.PARTIALLY_REFUNDED) && refundDue > 0) {
      await tx.bookingRefund.create({
        data: {
          bookingId: booking.id,
          paymentId: payment.id,
          refundReference: `REF-${nanoid(8).toUpperCase()}`,
          idempotencyKey: `idem_host_cancel_${booking.id}_${now.getTime()}`,
          status: RefundStatus.PENDING,
          currency: payment.currency || "SAR",
          amount: refundDue,
          reason: `Host cancellation: ${reason?.trim() || "Host cancelled reservation"}`,
          requestedById: actor.id,
          approvedById: null,
          processedAt: null,
          succeededAt: null,
          providerRefundId: null,
          metadata: {
            refundType: "FULL",
            cancellationActor: "HOST",
          },
        },
      });

    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED, priceBreakdown },
    });
    return { ...updated, listing: booking.listing, user: booking.user };
  });

  await invalidateBookingCache(cancelled.id, cancelled.userId, cancelled.listing.hostId);
  await triggerGuestFavoriteReevaluation(cancelled.listingId);

  try {
    await notificationService.create({
      userId: cancelled.userId,
      type: NotificationType.BOOKING,
      title: `Reservation Cancelled by Host: ${cancelled.listing.title}`,
      message: `The host had to cancel your reservation for ${cancelled.listing.title}. Any eligible refund has been recorded and will be settled only after payment-provider confirmation.`,
      entityId: cancelled.id,
      entityType: "booking",
      link: "/profile/tab/past",
      metadata: {
        bookingId: cancelled.id,
        listingId: cancelled.listingId,
        status: BookingStatus.CANCELLED,
        cancelledBy: "HOST",
        reason: reason?.trim() || null,
        role: "guest",
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to create cancellation notification for guest:", err);
  }

  try {
    await messagingService.recordBookingStatusMessage({
      bookingId: cancelled.id,
      statusText: `Host cancelled this reservation${reason ? `: "${reason.trim()}"` : "."}`,
      newBookingStatus: BookingStatus.CANCELLED,
      conversationStatus: ConversationStatus.CANCELLED,
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record conversation cancellation status:", err);
  }

  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "BOOKING_CANCELLED_BY_HOST",
      resourceType: "BOOKING",
      resourceId: cancelled.id,
      description: `Host cancelled reservation${reason ? `: "${reason.trim()}"` : ""}.`,
      status: "SUCCESS",
      metadata: {
        bookingId: cancelled.id,
        listingId: cancelled.listingId,
        reason: reason?.trim() || null,
        isExcluded: Boolean(isExcluded),
        previousStatus: BookingStatus.CONFIRMED,
        newStatus: BookingStatus.CANCELLED,
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record audit log for host cancellation:", err);
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

export interface AdminBookingListOptions {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
  tab?: "all" | "pending" | "confirmed" | "upcoming" | "active" | "completed" | "cancelled" | "rejected" | "expired" | string;
  status?: string;
  bookingType?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  checkInFrom?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  checkOutTo?: string;
  createdFrom?: string;
  createdTo?: string;
  city?: string;
  listingId?: string;
  hostId?: string;
  guestId?: string;
  search?: string;
  sortBy?: "createdAt" | "startDate" | "endDate" | "totalPrice";
  sortOrder?: "asc" | "desc";
}

async function listForAdmin(actor: AuthUser, opts: AdminBookingListOptions = {}) {
  assertRole(actor, [Role.ADMIN]);

  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? (opts.take ?? 20)));
  const skip = opts.skip !== undefined ? opts.skip : (page - 1) * limit;
  const take = limit;
  const now = new Date();

  const where: Prisma.BookingWhereInput = {};

  const tabLower = (opts.tab || "").toLowerCase();
  if (tabLower && tabLower !== "all") {
    if (tabLower === "pending") {
      where.status = BookingStatus.PENDING;
    } else if (tabLower === "confirmed") {
      where.status = BookingStatus.CONFIRMED;
    } else if (tabLower === "upcoming") {
      where.status = BookingStatus.CONFIRMED;
      where.startDate = { gt: now };
    } else if (tabLower === "active") {
      where.status = BookingStatus.CONFIRMED;
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    } else if (tabLower === "completed") {
      where.status = BookingStatus.CONFIRMED;
      where.endDate = { lt: now };
    } else if (tabLower === "cancelled") {
      // Genuine cancellations: status=CANCELLED, but NOT a host-rejected request
      // (rejection key present) and NOT an expired request (expiredAt key present).
      // Rejected and expired requests have their own dedicated tabs.
      where.AND = [
        { status: BookingStatus.CANCELLED },
        { priceBreakdown: { path: ["rejection"], equals: Prisma.AnyNull } },
        { priceBreakdown: { path: ["expiredAt"], equals: Prisma.AnyNull } },
      ];
    } else if (tabLower === "rejected") {
      where.status = BookingStatus.CANCELLED;
      where.priceBreakdown = {
        path: ["rejection", "rejectedBy"],
        equals: "HOST",
      };
    } else if (tabLower === "expired") {
      where.status = BookingStatus.CANCELLED;
      where.priceBreakdown = {
        path: ["rejection", "reason"],
        equals: "EXPIRED",
      };
    }
  } else if (opts.status && opts.status !== "ALL") {
    const s = opts.status.toUpperCase();
    if (s === "PENDING" || s === "CONFIRMED" || s === "CANCELLED") {
      where.status = s as BookingStatus;
    } else if (s === "COMPLETED") {
      where.status = BookingStatus.CONFIRMED;
      where.endDate = { lte: now };
    }
  }

  if (opts.bookingType && opts.bookingType !== "ALL") {
    if (opts.bookingType === "INSTANT_BOOK") {
      where.priceBreakdown = {
        path: ["bookingMode"],
        equals: "INSTANT_BOOK",
      };
    } else if (opts.bookingType === "REQUEST_TO_BOOK") {
      where.priceBreakdown = {
        path: ["bookingMode"],
        equals: "REQUEST_TO_BOOK",
      };
    }
  }

  if (opts.paymentStatus && opts.paymentStatus !== "ALL") {
    where.payments = {
      some: {
        status: opts.paymentStatus as any,
      },
    };
  }

  if (opts.city && opts.city.trim()) {
    where.listing = {
      ...(where.listing as Prisma.ListingWhereInput || {}),
      city: { contains: opts.city.trim(), mode: "insensitive" },
    };
  }

  if (opts.listingId) {
    where.listingId = opts.listingId;
  }

  if (opts.guestId) {
    where.userId = opts.guestId;
  }

  if (opts.hostId) {
    where.listing = {
      ...(where.listing as Prisma.ListingWhereInput || {}),
      hostId: opts.hostId,
    };
  }

  const checkInStart = opts.checkInFrom || opts.startDate;
  const checkInEnd = opts.checkInTo || opts.endDate;
  if (checkInStart || checkInEnd) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (checkInStart) dateFilter.gte = parseBookingDate(checkInStart);
    if (checkInEnd) dateFilter.lte = parseBookingDate(checkInEnd);
    where.startDate = dateFilter;
  }

  if (opts.checkOutFrom || opts.checkOutTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (opts.checkOutFrom) dateFilter.gte = parseBookingDate(opts.checkOutFrom);
    if (opts.checkOutTo) dateFilter.lte = parseBookingDate(opts.checkOutTo);
    where.endDate = dateFilter;
  }

  if (opts.createdFrom || opts.createdTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (opts.createdFrom) dateFilter.gte = new Date(opts.createdFrom);
    if (opts.createdTo) dateFilter.lte = new Date(opts.createdTo);
    where.createdAt = dateFilter;
  }

  if (opts.search && opts.search.trim()) {
    const q = opts.search.trim();
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { submissionId: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { listing: { title: { contains: q, mode: "insensitive" } } },
      { listing: { host: { name: { contains: q, mode: "insensitive" } } } },
      { listing: { host: { email: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const orderBy: Prisma.BookingOrderByWithRelationInput[] = [];
  const sortOrder = opts.sortOrder === "asc" ? "asc" : "desc";
  const sortBy = opts.sortBy ?? "createdAt";
  if (sortBy === "startDate") orderBy.push({ startDate: sortOrder });
  else if (sortBy === "endDate") orderBy.push({ endDate: sortOrder });
  else if (sortBy === "totalPrice") orderBy.push({ totalPrice: sortOrder });
  else orderBy.push({ createdAt: sortOrder });
  orderBy.push({ id: "desc" });

  let bookings: any[];
  let total: number;
  try {
    [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        submissionId: true,
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
        cancellationPolicy: true,
        isNonRefundable: true,
        priceBreakdown: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            city: true,
            country: true,
            photos: true,
            hostId: true,
            host: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            status: true,
            amount: true,
            capturedAmount: true,
            refundedAmount: true,
            provider: true,
            createdAt: true,
          },
        },
        refunds: {
          select: {
            id: true,
            status: true,
            amount: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.booking.count({ where }),
    ]);
  } catch (error) {
    if (!isMissingBookingPaymentTable(error)) throw error;
    if (opts.paymentStatus && opts.paymentStatus !== "ALL") {
      throw AppError.badRequest("Payment-status filtering is unavailable until the BookingPayment migration is applied.");
    }

    // Legacy database compatibility: the bookings list remains useful without
    // optional payment/refund records while the foundation migration is pending.
    [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          submissionId: true,
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
          cancellationPolicy: true,
          isNonRefundable: true,
          priceBreakdown: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true, image: true, phone: true } },
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              city: true,
              country: true,
              photos: true,
              hostId: true,
              host: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      }) as any[],
      prisma.booking.count({ where }),
    ]);
  }

  const items = bookings.map((b: any) => {
    const breakdown = (b.priceBreakdown as Record<string, any>) || {};
    const rejection = breakdown.rejection || {};
    const cancellation = breakdown.cancellation || {};
    const computedStatus = computeBookingStatus({
      dbStatus: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
      createdAt: b.createdAt,
      rejectionReason: rejection.reason || cancellation.reason || null,
      rejectionBy: rejection.rejectedBy || cancellation.cancelledBy || null,
      isExpired: Boolean(breakdown.expiredAt || rejection.reason === "EXPIRED"),
    });

    const bookingType = breakdown.bookingMode || (b.status === BookingStatus.CONFIRMED && !b.submissionId ? "INSTANT_BOOK" : "REQUEST_TO_BOOK");
    const paymentStatus = breakdown.paymentStatus || (b.payments?.length > 0 ? b.payments[0].status : "UNAVAILABLE");

    return {
      id: b.id,
      submissionId: b.submissionId,
      status: b.status,
      computedStatus: computedStatus.status,
      statusDetails: computedStatus,
      bookingType,
      paymentStatus,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      guests: b.guests,
      totalPrice: b.totalPrice,
      nightlyPrice: b.nightlyPrice,
      cleaningFee: b.cleaningFee,
      currency: b.currency,
      cancellationPolicy: b.cancellationPolicy,
      isNonRefundable: b.isNonRefundable,
      user: b.user,
      listing: b.listing,
      payments: b.payments || [],
      refunds: b.refunds || [],
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getAdminBookingDetails(actor: AuthUser, id: string) {
  assertRole(actor, [Role.ADMIN]);

  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
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
          image: true,
          phone: true,
          createdAt: true,
        },
      },
      taxes: true,
      reviews: {
        select: {
          id: true,
          rating: true,
          authorId: true,
        },
      },
      payments: true,
      refunds: true,
    },
  });

  if (!b) throw AppError.notFound("Booking not found");

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
    isExpired: Boolean(breakdown.expiredAt || rejection.reason === "EXPIRED"),
  });

  const pricing = getAuthoritativePriceBreakdown(b);

  const conversation = await prisma.conversation.findFirst({
    where: { bookingId: b.id },
    select: { id: true },
  });

  const timeline = getBookingStatusTimeline({
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    statusDetails,
    priceBreakdown: b.priceBreakdown,
  });

  // Strictly sanitize private arrival guide secrets
  const sanitizedListing = sanitizeListingSecrets(b.listing);

  return {
    booking: {
      id: b.id,
      submissionId: b.submissionId,
      userId: b.userId,
      listingId: b.listingId,
      status: b.status,
      computedStatus: statusDetails.status,
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
    statusDetails,
    pricing,
    timeline,
    conversationId: conversation?.id || null,
    listing: sanitizedListing,
    guest: b.user,
    host: b.listing.host,
    taxes: b.taxes,
    reviews: b.reviews,
    payments: b.payments,
    refunds: b.refunds,
  };
}

export interface AdminBookingSummaryOptions {
  period?: "today" | "last7days" | "last30days" | "thismonth" | "all" | "custom" | string;
  from?: Date | string;
  to?: Date | string;
}

async function getAdminBookingSummary(actor: AuthUser, options: AdminBookingSummaryOptions = {}) {
  assertRole(actor, [Role.ADMIN]);

  const now = new Date();
  let createdAtFilter: Prisma.DateTimeFilter | undefined;

  if (options.period === "today") {
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    createdAtFilter = { gte: startOfToday };
  } else if (options.period === "last7days") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    createdAtFilter = { gte: sevenDaysAgo };
  } else if (options.period === "last30days") {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    createdAtFilter = { gte: thirtyDaysAgo };
  } else if (options.period === "thismonth") {
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    createdAtFilter = { gte: startOfMonth };
  } else if (options.from || options.to) {
    createdAtFilter = {};
    if (options.from) createdAtFilter.gte = new Date(options.from);
    if (options.to) createdAtFilter.lte = new Date(options.to);
  }

  const threshold24h = getExpiryThresholdDate(now);

  const [
    totalCount,
    pendingRequestsCount,
    confirmedCount,
    upcomingCount,
    activeStaysCount,
    completedCount,
    cancelledCount,
    failedPaymentsCount,
    gmvAggregate,
  ] = await Promise.all([
    // Card 1: Total Bookings (created in period)
    prisma.booking.count({
      where: createdAtFilter ? { createdAt: createdAtFilter } : {},
    }),
    // Card 2: Pending Requests (awaiting host approval, within 24h response window)
    prisma.booking.count({
      where: {
        status: BookingStatus.PENDING,
        createdAt: { gte: threshold24h },
      },
    }),
    // Card 3: Confirmed Bookings
    prisma.booking.count({
      where: {
        status: BookingStatus.CONFIRMED,
      },
    }),
    // Card 4: Upcoming Bookings (confirmed, check-in in future)
    prisma.booking.count({
      where: {
        status: BookingStatus.CONFIRMED,
        startDate: { gt: now },
      },
    }),
    // Card 5: Active Stays (confirmed, currently within stay dates)
    prisma.booking.count({
      where: {
        status: BookingStatus.CONFIRMED,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    }),
    // Card 6: Completed Bookings (confirmed, checkout in past)
    prisma.booking.count({
      where: {
        status: BookingStatus.CONFIRMED,
        endDate: { lt: now },
      },
    }),
    // Card 7: Canceled Bookings (genuine cancellations — excludes host rejections and expired requests)
    prisma.booking.count({
      where: {
        AND: [
          { status: BookingStatus.CANCELLED },
          { priceBreakdown: { path: ["rejection"], equals: Prisma.AnyNull } },
          { priceBreakdown: { path: ["expiredAt"], equals: Prisma.AnyNull } },
          ...(createdAtFilter ? [{ createdAt: createdAtFilter }] : []),
        ],
      },
    }),
    // Card 8: Payment Issues (failed payment or voided transaction records)
    (async () => {
      try {
        return await prisma.bookingPayment.count({
          where: { status: { in: [PaymentStatus.FAILED, PaymentStatus.VOIDED] } },
        });
      } catch (error) {
        const candidate = error as {
          code?: unknown;
          message?: unknown;
          meta?: { table?: unknown; cause?: unknown };
        };
        const detail = [candidate?.message, candidate?.meta?.table, candidate?.meta?.cause]
          .filter(Boolean)
          .join(" ");
        if (candidate?.code === "P2021" || /BookingPayment/i.test(detail)) return 0;
        throw error;
      }
    })(),
    // Gross Booking Value
    prisma.booking.aggregate({
      where: {
        status: BookingStatus.CONFIRMED,
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      _sum: { totalPrice: true },
    }),
  ]);

  return {
    totalBookings: totalCount,
    pendingRequests: pendingRequestsCount,
    confirmedBookings: confirmedCount,
    upcomingBookings: upcomingCount,
    activeStays: activeStaysCount,
    completedBookings: completedCount,
    canceledBookings: cancelledCount,
    paymentIssues: failedPaymentsCount,

    // Backward-compatible keys
    total: totalCount,
    pending: pendingRequestsCount,
    confirmed: confirmedCount,
    completed: completedCount,
    activeUpcoming: upcomingCount,
    cancelled: cancelledCount,
    grossBookingValue: gmvAggregate._sum.totalPrice || 0,
    currency: "SAR",
  };
}

async function getAdminPendingRequests(actor: AuthUser, limit = 5) {
  assertRole(actor, [Role.ADMIN]);
  const now = new Date();
  const boundedLimit = Math.min(20, Math.max(1, limit));

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      createdAt: { gte: getExpiryThresholdDate(now) },
    },
    take: boundedLimit,
    orderBy: [
      { createdAt: "asc" }, // Most urgent (oldest pending) first
      { startDate: "asc" },
    ],
    select: {
      id: true,
      submissionId: true,
      startDate: true,
      endDate: true,
      guests: true,
      totalPrice: true,
      currency: true,
      status: true,
      createdAt: true,
      priceBreakdown: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      listing: {
        select: {
          id: true,
          title: true,
          city: true,
          country: true,
          photos: true,
          host: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return bookings.map((b: any) => {
    const expiresAt = getAuthoritativeExpiryDate(b.createdAt);
    const countdown = formatExpiryCountdown(b.createdAt, now);
    const timeRemaining = getTimeRemaining(b.createdAt, now);
    const breakdown = (b.priceBreakdown as Record<string, any>) || {};
    const bookingType = breakdown.bookingMode || "REQUEST_TO_BOOK";

    return {
      id: b.id,
      submissionId: b.submissionId,
      status: b.status,
      bookingType,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      guests: b.guests,
      totalPrice: b.totalPrice,
      currency: b.currency,
      createdAt: b.createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      countdownText: countdown.text,
      isUrgent: timeRemaining.isUrgent,
      isExpired: countdown.isExpired,
      hoursRemaining: timeRemaining.hours,
      minutesRemaining: timeRemaining.minutes,
      user: b.user,
      listing: sanitizeListingSecrets(b.listing) as any,
    };
  });
}

async function getAdminRecentBookings(actor: AuthUser, limit = 8) {
  assertRole(actor, [Role.ADMIN]);
  const boundedLimit = Math.min(20, Math.max(1, limit));

  const recentBookingSelection = {
    id: true,
    submissionId: true,
    startDate: true,
    endDate: true,
    guests: true,
    totalPrice: true,
    currency: true,
    status: true,
    createdAt: true,
    priceBreakdown: true,
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    },
    listing: {
      select: {
        id: true,
        title: true,
        city: true,
        country: true,
        photos: true,
        host: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    },
  } as const;

  let bookings: any[];
  try {
    bookings = await prisma.booking.findMany({
    take: boundedLimit,
    orderBy: { createdAt: "desc" },
    select: {
      ...recentBookingSelection,
      payments: {
        select: {
          id: true,
          status: true,
        },
        take: 1,
      },
    },
    }) as any[];
  } catch (error) {
    if (!isMissingBookingPaymentTable(error)) throw error;
    bookings = await prisma.booking.findMany({
      take: boundedLimit,
      orderBy: { createdAt: "desc" },
      select: recentBookingSelection,
    }) as any[];
  }

  return bookings.map((b: any) => {
    const breakdown = (b.priceBreakdown as Record<string, any>) || {};
    const rejection = breakdown.rejection || {};
    const cancellation = breakdown.cancellation || {};
    const computedStatus = computeBookingStatus({
      dbStatus: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
      createdAt: b.createdAt,
      rejectionReason: rejection.reason || cancellation.reason || null,
      rejectionBy: rejection.rejectedBy || cancellation.cancelledBy || null,
      isExpired: Boolean(breakdown.expiredAt || rejection.reason === "EXPIRED"),
    });

    const bookingType = breakdown.bookingMode || (b.status === BookingStatus.CONFIRMED && !b.submissionId ? "INSTANT_BOOK" : "REQUEST_TO_BOOK");
    const paymentStatus = breakdown.paymentStatus || (b.payments?.length > 0 ? b.payments[0].status : "UNAVAILABLE");

    return {
      id: b.id,
      submissionId: b.submissionId,
      status: b.status,
      computedStatus: computedStatus.status,
      bookingType,
      paymentStatus,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      guests: b.guests,
      totalPrice: b.totalPrice,
      currency: b.currency,
      createdAt: b.createdAt.toISOString(),
      user: b.user,
      listing: sanitizeListingSecrets(b.listing) as any,
    };
  });
}

async function getAdminRecentActivity(actor: AuthUser, limit = 10) {
  assertRole(actor, [Role.ADMIN]);
  const boundedLimit = Math.min(50, Math.max(1, limit));

  const items = await prisma.auditLog.findMany({
    where: {
      resourceType: "BOOKING",
    },
    take: boundedLimit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      description: true,
      resourceId: true,
      actorEmail: true,
      actorId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return items.map((item: any) => ({
    id: item.id,
    action: item.action,
    description: item.description,
    bookingId: item.resourceId,
    actorEmail: item.actorEmail,
    actorId: item.actorId,
    metadata: item.metadata,
    createdAt: item.createdAt.toISOString(),
  }));
}

async function getAdminBookingActivity(
  actor: AuthUser,
  id: string,
  options?: { page?: number; limit?: number },
) {
  assertRole(actor, [Role.ADMIN]);

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!booking) throw AppError.notFound("Booking not found");

  return auditService.listForResource("BOOKING", id, options);
}

export interface AdminCancellationItem {
  id: string;
  submissionId: string | null;
  status: string;
  startDate: string;
  endDate: string;
  guests: number;
  totalPrice: number | null;
  nightlyPrice: number | null;
  cleaningFee: number | null;
  currency: string;
  cancellationPolicy: string | null;
  isNonRefundable: boolean;
  createdAt: string;
  updatedAt: string;
  paymentStatus: string;
  refundStatus: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    phone?: string | null;
  };
  listing: {
    id: string;
    title: string;
    city: string | null;
    country: string | null;
    photos: string[];
    price: number;
    cancellationPolicy: string | null;
    host: {
      id: string;
      name: string | null;
      email: string | null;
    };
  };
  cancellation: {
    cancelledAt: string | null;
    cancelledBy: CancellationInitiator | null;
    reason: string | null;
    notes?: string | null;
    adminId?: string | null;
    adminEmail?: string | null;
    guestRefundAmount?: number | null;
    hostPayoutRetained?: number | null;
  };
  payments: Array<{
    id: string;
    status: string;
    amount: number;
    capturedAmount: number | null;
    refundedAmount: number | null;
    provider: string | null;
    createdAt: string;
  }>;
  refunds: Array<{
    id: string;
    status: string;
    amount: number;
    reason: string | null;
    createdAt: string;
  }>;
  requiresAttention: boolean;
}

export interface AdminCancellationListOptions {
  page?: number;
  limit?: number;
  tab?: "all" | "guest" | "host" | "admin" | "attention" | string;
  initiator?: "GUEST" | "HOST" | "ADMIN" | "UNKNOWN" | "ALL";
  search?: string;
  policy?: string;
  dateFrom?: string;
  dateTo?: string;
  checkInFrom?: string;
  checkInTo?: string;
  listingId?: string;
  hostId?: string;
  guestId?: string;
  city?: string;
  country?: string;
  paymentStatus?: string;
  refundStatus?: string;
  sortBy?: "cancelledAt" | "startDate" | "totalPrice" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface AdminCancellationSummary {
  totalCancellations: number;
  guestCancellations: number;
  hostCancellations: number;
  adminCancellations: number;
  unknownCancellations: number;
  requiresAttention: number;
  currency: string;
}

export interface AdminCalendarData {
  listing: {
    id: string;
    title: string;
    city: string | null;
    district: string | null;
    country: string | null;
    photos: string[];
    price: number;
    weekdayBasePrice: number | null;
    weekendPrice: number | null;
    weekendBasePrice?: number | null;
    customPrices: Record<string, number> | null;
    blockedDates: string[];
    minNights: number | null;
    maxNights: number | null;
    cancellationPolicy: string | null;
    status: string;
    host: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  };
  bookings: Array<{
    id: string;
    submissionId: string | null;
    status: string;
    startDate: string;
    endDate: string;
    nights: number;
    guests: number;
    totalPrice: number | null;
    nightlyPrice: number | null;
    cleaningFee: number | null;
    currency: string;
    bookingType: string;
    cancellationPolicy: string | null;
    isPendingHold: boolean;
    expiresAt: string | null;
    countdownText: string | null;
    isUrgent: boolean;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      phone?: string | null;
    };
    payments?: Array<{
      id: string;
      status: string;
      amount: number;
      currency: string;
    }>;
  }>;
  blockedDates: string[];
  customPrices: Record<string, number>;
  monthKey: string;
}

export interface AdminAllPropertiesCalendarOptions {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  search?: string;
  hostId?: string;
  city?: string;
  cityKey?: string;
  country?: string;
  status?: string;
  propertyType?: string;
  bookingStatus?: string;
  filterListingId?: string;
}

export interface AdminAllPropertiesCalendarData {
  properties: Array<{
    id: string;
    title: string;
    city: string | null;
    country: string | null;
    propertyType: string | null;
    photos: string[];
    price: number;
    status: string;
    host: { id: string; name: string | null; email: string | null };
    blockedDates: string[];
    bookings: AdminCalendarData["bookings"];
  }>;
  range: { startDate: string; endDate: string };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

async function cancelBookingByAdmin(
  actor: AuthUser,
  id: string,
  reason: string,
  notes?: string,
): Promise<BookingDTO> {
  assertRole(actor, [Role.ADMIN]);
  if (!reason || !reason.trim()) {
    throw AppError.badRequest("A cancellation reason is required for administrative cancellation.");
  }

  const cancelled = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      include: { listing: true, user: true },
    });
    if (!booking) throw AppError.notFound("Booking not found");

    if (booking.status === BookingStatus.CANCELLED) {
      throw AppError.conflict("This reservation has already been cancelled.");
    }

    const now = new Date();
    if (booking.endDate <= now && booking.status === BookingStatus.CONFIRMED) {
      throw AppError.badRequest("Completed reservations cannot be cancelled after the check-out date.");
    }

    const originalSnapshot =
      booking.priceBreakdown &&
      typeof booking.priceBreakdown === "object" &&
      !Array.isArray(booking.priceBreakdown)
        ? (booking.priceBreakdown as Record<string, unknown>)
        : {};

    const payment = await tx.bookingPayment.findFirst({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
    });
    const refundDue = payment ? Math.max(0, payment.capturedAmount - payment.refundedAmount) : 0;

    const priceBreakdown = {
      ...originalSnapshot,
      cancellation: {
        cancelledAt: now.toISOString(),
        cancelledBy: "ADMIN",
        adminId: actor.id,
        adminEmail: actor.email,
        reason: reason.trim(),
        notes: notes?.trim() || null,
        guestRefundAmount: refundDue,
        hostPayoutRetained: 0,
      },
    } as Prisma.InputJsonValue;

    if (payment && (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.AUTHORIZED)) {
      await tx.bookingPayment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VOIDED,
          voidedAt: now,
        },
      });
    } else if (payment && (payment.status === PaymentStatus.CAPTURED || payment.status === PaymentStatus.PARTIALLY_REFUNDED) && refundDue > 0) {
      await tx.bookingRefund.create({
        data: {
          bookingId: booking.id,
          paymentId: payment.id,
          refundReference: `REF-${nanoid(8).toUpperCase()}`,
          idempotencyKey: `idem_admin_cancel_${booking.id}_${now.getTime()}`,
          status: RefundStatus.PENDING,
          currency: payment.currency || "SAR",
          amount: refundDue,
          reason: `Admin cancellation: ${reason.trim()}`,
          requestedById: actor.id,
          approvedById: null,
          processedAt: null,
          succeededAt: null,
          providerRefundId: null,
          metadata: {
            refundType: "FULL",
            cancellationActor: "ADMIN",
            adminNotes: notes?.trim() || null,
          },
        },
      });

    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED, priceBreakdown },
    });
    return { ...updated, listing: booking.listing, user: booking.user };
  });

  await invalidateBookingCache(cancelled.id, cancelled.userId, cancelled.listing.hostId);
  await triggerGuestFavoriteReevaluation(cancelled.listingId);

  try {
    await notificationService.create({
      userId: cancelled.userId,
      type: NotificationType.BOOKING,
      title: `Reservation Cancelled by Admin: ${cancelled.listing.title}`,
      message: `Your reservation for ${cancelled.listing.title} has been cancelled by an administrator: "${reason.trim()}".`,
      entityId: cancelled.id,
      entityType: "booking",
      link: "/profile/tab/past",
      metadata: {
        bookingId: cancelled.id,
        listingId: cancelled.listingId,
        status: BookingStatus.CANCELLED,
        cancelledBy: "ADMIN",
        reason: reason.trim(),
        role: "guest",
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to create cancellation notification for guest:", err);
  }

  if (cancelled.listing?.hostId && cancelled.listing.hostId !== cancelled.userId) {
    try {
      await notificationService.create({
        userId: cancelled.listing.hostId,
        type: NotificationType.BOOKING,
        title: `Reservation Cancelled by Admin: ${cancelled.listing.title}`,
        message: `A reservation for ${cancelled.listing.title} was cancelled by an administrator: "${reason.trim()}".`,
        entityId: cancelled.id,
        entityType: "booking",
        link: "/host/reservations",
        metadata: {
          bookingId: cancelled.id,
          listingId: cancelled.listingId,
          status: BookingStatus.CANCELLED,
          cancelledBy: "ADMIN",
          reason: reason.trim(),
          role: "host",
        },
      });
    } catch (err) {
      console.warn("[booking.service] Failed to create cancellation notification for host:", err);
    }
  }

  try {
    await messagingService.recordBookingStatusMessage({
      bookingId: cancelled.id,
      statusText: `Administrator cancelled this reservation: "${reason.trim()}"`,
      newBookingStatus: BookingStatus.CANCELLED,
      conversationStatus: ConversationStatus.CANCELLED,
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record conversation cancellation status:", err);
  }

  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "BOOKING_CANCELLED_BY_ADMIN",
      resourceType: "BOOKING",
      resourceId: cancelled.id,
      description: `Administrator cancelled reservation: "${reason.trim()}".`,
      status: "SUCCESS",
      metadata: {
        bookingId: cancelled.id,
        listingId: cancelled.listingId,
        reason: reason.trim(),
        notes: notes?.trim() || null,
        previousStatus: cancelled.status,
        newStatus: BookingStatus.CANCELLED,
      },
    });
  } catch (err) {
    console.warn("[booking.service] Failed to record audit log for admin cancellation:", err);
  }

  return toBookingDTO(cancelled);
}

function isMissingFinancialTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { table?: unknown; cause?: unknown };
  };
  const detail = [candidate.message, candidate.meta?.table, candidate.meta?.cause]
    .filter(Boolean)
    .join(" ");
  return candidate.code === "P2021" || /BookingPayment|BookingRefund/i.test(detail);
}

async function listCancellationsForAdmin(
  actor: AuthUser,
  opts: AdminCancellationListOptions = {},
): Promise<{ cancellations: AdminCancellationItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  assertRole(actor, [Role.ADMIN]);

  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;
  const take = limit;

  // Authoritative base conditions:
  // Genuine cancellations must have status CANCELLED, and must NOT be a rejected or expired booking request.
  const andConditions: Prisma.BookingWhereInput[] = [
    { status: BookingStatus.CANCELLED },
    { priceBreakdown: { path: ["rejection"], equals: Prisma.AnyNull } },
    { priceBreakdown: { path: ["expiredAt"], equals: Prisma.AnyNull } },
  ];

  const tabLower = (opts.tab || "").toLowerCase();
  const initiatorUpper = (opts.initiator || "").toUpperCase();

  // Tab and initiator filtering
  if (tabLower === "guest" || initiatorUpper === "GUEST") {
    andConditions.push({
      priceBreakdown: {
        path: ["cancellation", "cancelledBy"],
        equals: "GUEST",
      },
    });
  } else if (tabLower === "host" || initiatorUpper === "HOST") {
    andConditions.push({
      priceBreakdown: {
        path: ["cancellation", "cancelledBy"],
        equals: "HOST",
      },
    });
  } else if (tabLower === "admin" || initiatorUpper === "ADMIN") {
    andConditions.push({
      priceBreakdown: {
        path: ["cancellation", "cancelledBy"],
        equals: "ADMIN",
      },
    });
  } else if (tabLower === "attention") {
    andConditions.push({
      OR: [
        { priceBreakdown: { path: ["cancellation", "requiresAttention"], equals: true } },
        { payments: { some: { status: { in: [PaymentStatus.FAILED, PaymentStatus.VOIDED] } } } },
        { refunds: { some: { status: { in: [RefundStatus.PENDING, RefundStatus.PROCESSING, RefundStatus.FAILED] } } } },
      ],
    });
  } else if (initiatorUpper === "UNKNOWN") {
    andConditions.push({
      OR: [
        { priceBreakdown: { path: ["cancellation", "cancelledBy"], equals: Prisma.AnyNull } },
        { priceBreakdown: { path: ["cancellation"], equals: Prisma.AnyNull } },
      ],
    });
  }

  // Policy filter
  if (opts.policy && opts.policy !== "ALL") {
    andConditions.push({ cancellationPolicy: { equals: opts.policy, mode: "insensitive" } });
  }

  // Listing filter
  if (opts.listingId) {
    andConditions.push({ listingId: opts.listingId });
  }

  // Guest filter
  if (opts.guestId) {
    andConditions.push({ userId: opts.guestId });
  }

  // Host filter
  if (opts.hostId) {
    andConditions.push({ listing: { hostId: opts.hostId } });
  }

  // City filter
  if (opts.city && opts.city.trim()) {
    andConditions.push({ listing: { city: { contains: opts.city.trim(), mode: "insensitive" } } });
  }

  // Country filter
  if (opts.country && opts.country.trim()) {
    andConditions.push({ listing: { country: { contains: opts.country.trim(), mode: "insensitive" } } });
  }

  // Stay check-in date range
  if (opts.checkInFrom || opts.checkInTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (opts.checkInFrom) dateFilter.gte = parseBookingDate(opts.checkInFrom);
    if (opts.checkInTo) dateFilter.lte = parseBookingDate(opts.checkInTo);
    andConditions.push({ startDate: dateFilter });
  }

  // Cancellation date range (verified event timestamp)
  if (opts.dateFrom || opts.dateTo) {
    const dFromIso = opts.dateFrom ? new Date(opts.dateFrom).toISOString() : undefined;
    const dToIso = opts.dateTo
      ? new Date(`${opts.dateTo.slice(0, 10)}T23:59:59.999Z`).toISOString()
      : undefined;

    const dateFilter: Prisma.DateTimeFilter = {};
    const cancelAtFilter: Record<string, any> = {
      path: ["cancellation", "cancelledAt"],
    };

    if (dFromIso) {
      cancelAtFilter.gte = dFromIso;
      dateFilter.gte = new Date(dFromIso);
    }
    if (dToIso) {
      cancelAtFilter.lte = dToIso;
      dateFilter.lte = new Date(dToIso);
    }

    andConditions.push({
      OR: [
        { priceBreakdown: cancelAtFilter as any },
        {
          AND: [
            { priceBreakdown: { path: ["cancellation", "cancelledAt"], equals: Prisma.AnyNull } },
            { updatedAt: dateFilter },
          ],
        },
      ],
    });
  }

  // Search filter across booking reference, user, host, property, location
  if (opts.search && opts.search.trim()) {
    const q = opts.search.trim();
    andConditions.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { submissionId: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { listing: { title: { contains: q, mode: "insensitive" } } },
        { listing: { city: { contains: q, mode: "insensitive" } } },
        { listing: { country: { contains: q, mode: "insensitive" } } },
        { listing: { host: { name: { contains: q, mode: "insensitive" } } } },
        { listing: { host: { email: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  // Payment status filter
  if (opts.paymentStatus && opts.paymentStatus !== "ALL") {
    andConditions.push({
      OR: [
        { payments: { some: { status: opts.paymentStatus as PaymentStatus } } },
        { priceBreakdown: { path: ["paymentStatus"], equals: opts.paymentStatus } },
      ],
    });
  }

  // Refund status filter
  if (opts.refundStatus && opts.refundStatus !== "ALL") {
    andConditions.push({
      refunds: { some: { status: opts.refundStatus as RefundStatus } },
    });
  }

  const where: Prisma.BookingWhereInput = {
    AND: andConditions,
  };

  const orderBy: Prisma.BookingOrderByWithRelationInput[] = [];
  const sortOrder = opts.sortOrder === "asc" ? "asc" : "desc";
  const sortBy = opts.sortBy ?? "createdAt";

  if (sortBy === "startDate") orderBy.push({ startDate: sortOrder });
  else if (sortBy === "totalPrice") orderBy.push({ totalPrice: sortOrder });
  else orderBy.push({ updatedAt: sortOrder });
  orderBy.push({ id: "desc" });

  let bookings: any[];
  let total: number;
  try {
    [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          submissionId: true,
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
          cancellationPolicy: true,
          isNonRefundable: true,
          priceBreakdown: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              phone: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              city: true,
              country: true,
              photos: true,
              cancellationPolicy: true,
              host: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          payments: {
            select: {
              id: true,
              status: true,
              amount: true,
              capturedAmount: true,
              refundedAmount: true,
              provider: true,
              createdAt: true,
            },
          },
          refunds: {
            select: {
              id: true,
              status: true,
              amount: true,
              reason: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.booking.count({ where }),
    ]);
  } catch (error) {
    if (!isMissingFinancialTable(error)) throw error;
    // Fallback if financial tables are missing
    const fallbackWhere = { ...where };
    [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: fallbackWhere,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          submissionId: true,
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
          cancellationPolicy: true,
          isNonRefundable: true,
          priceBreakdown: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, email: true, image: true, phone: true },
          },
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              city: true,
              country: true,
              photos: true,
              cancellationPolicy: true,
              host: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }) as any[],
      prisma.booking.count({ where: fallbackWhere }),
    ]);
  }

  const cancellations: AdminCancellationItem[] = bookings.map((b: any) => {
    const details = resolveCancellationDetails(b);

    const listingData = b.listing
      ? {
          id: b.listing.id,
          title: b.listing.title || "Untitled Property",
          city: b.listing.city || null,
          country: b.listing.country || null,
          photos: sanitizeListingSecrets(b.listing).photos || [],
          price: b.listing.price || 0,
          cancellationPolicy: b.listing.cancellationPolicy || b.cancellationPolicy || "FLEXIBLE",
          host: {
            id: b.listing.host?.id || "unknown",
            name: b.listing.host?.name || "Host Profile Unavailable",
            email: b.listing.host?.email || null,
          },
        }
      : {
          id: b.listingId,
          title: "Archived Listing",
          city: null,
          country: null,
          photos: [],
          price: 0,
          cancellationPolicy: b.cancellationPolicy || "FLEXIBLE",
          host: {
            id: "unknown",
            name: "Host Profile Unavailable",
            email: null,
          },
        };

    const userData = b.user
      ? {
          id: b.user.id,
          name: b.user.name || "Guest Profile Unavailable",
          email: b.user.email || null,
          image: b.user.image || null,
          phone: b.user.phone || null,
        }
      : {
          id: b.userId,
          name: "Guest Profile Unavailable",
          email: null,
          image: null,
          phone: null,
        };

    return {
      id: b.id,
      submissionId: b.submissionId,
      status: b.status,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      guests: b.guests,
      totalPrice: b.totalPrice,
      nightlyPrice: b.nightlyPrice,
      cleaningFee: b.cleaningFee,
      currency: b.currency,
      cancellationPolicy: b.cancellationPolicy || listingData.cancellationPolicy,
      isNonRefundable: b.isNonRefundable,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      paymentStatus: details.paymentStatus,
      refundStatus: details.refundStatus,
      user: userData,
      listing: listingData,
      cancellation: {
        cancelledAt: details.cancelledAt,
        cancelledBy: details.cancelledBy,
        reason: details.reason,
        notes: details.notes,
        adminId: details.adminId,
        adminEmail: details.adminEmail,
        guestRefundAmount: details.guestRefundAmount,
        hostPayoutRetained: details.hostPayoutRetained,
      },
      payments: (b.payments || []).map((p: any) => ({
        id: p.id,
        status: p.status,
        amount: p.amount,
        capturedAmount: p.capturedAmount,
        refundedAmount: p.refundedAmount,
        provider: p.provider,
        createdAt: p.createdAt.toISOString(),
      })),
      refunds: (b.refunds || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        amount: r.amount,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
      requiresAttention: details.requiresAttention,
    };
  });

  return {
    cancellations,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function getCancellationSummaryForAdmin(actor: AuthUser): Promise<AdminCancellationSummary> {
  assertRole(actor, [Role.ADMIN]);

  const genuineBase: Prisma.BookingWhereInput = {
    status: BookingStatus.CANCELLED,
    priceBreakdown: { path: ["rejection"], equals: Prisma.AnyNull },
    AND: [
      { priceBreakdown: { path: ["expiredAt"], equals: Prisma.AnyNull } },
    ],
  };

  const [
    totalCancellations,
    guestCancellations,
    hostCancellations,
    adminCancellations,
    requiresAttention,
  ] = await Promise.all([
    prisma.booking.count({
      where: genuineBase,
    }),
    prisma.booking.count({
      where: {
        ...genuineBase,
        priceBreakdown: {
          path: ["cancellation", "cancelledBy"],
          equals: "GUEST",
        },
      },
    }),
    prisma.booking.count({
      where: {
        ...genuineBase,
        priceBreakdown: {
          path: ["cancellation", "cancelledBy"],
          equals: "HOST",
        },
      },
    }),
    prisma.booking.count({
      where: {
        ...genuineBase,
        priceBreakdown: {
          path: ["cancellation", "cancelledBy"],
          equals: "ADMIN",
        },
      },
    }),
    (async () => {
      try {
        return await prisma.booking.count({
          where: {
            ...genuineBase,
            OR: [
              { priceBreakdown: { path: ["cancellation", "requiresAttention"], equals: true } },
              { payments: { some: { status: { in: [PaymentStatus.FAILED, PaymentStatus.VOIDED] } } } },
              { refunds: { some: { status: { in: [RefundStatus.PENDING, RefundStatus.PROCESSING, RefundStatus.FAILED] } } } },
            ],
          },
        });
      } catch (error) {
        if (isMissingFinancialTable(error)) {
          return await prisma.booking.count({
            where: {
              ...genuineBase,
              priceBreakdown: { path: ["cancellation", "requiresAttention"], equals: true },
            },
          });
        }
        throw error;
      }
    })(),
  ]);

  const unknownCancellations = Math.max(
    0,
    totalCancellations - (guestCancellations + hostCancellations + adminCancellations),
  );

  return {
    totalCancellations,
    guestCancellations,
    hostCancellations,
    adminCancellations,
    unknownCancellations,
    requiresAttention,
    currency: "SAR",
  };
}

async function getAdminCalendarData(
  actor: AuthUser,
  listingId: string,
  monthKey?: string,
): Promise<AdminCalendarData> {
  assertRole(actor, [Role.ADMIN]);

  const now = new Date();
  const safeMonthKey =
    monthKey && /^\d{4}-\d{2}$/.test(monthKey)
      ? monthKey
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [yearStr, monthStr] = safeMonthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const windowStart = new Date(Date.UTC(year, month - 1, -7));
  const windowEnd = new Date(Date.UTC(year, month, 8));

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      city: true,
      district: true,
      country: true,
      photos: true,
      price: true,
      weekdayBasePrice: true,
      weekendPrice: true,
      customPrices: true,
      blockedDates: true,
      minNights: true,
      maxNights: true,
      cancellationPolicy: true,
      status: true,
      host: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  if (!listing) {
    throw AppError.notFound(`Listing ${listingId} not found`);
  }

  const expiryThreshold = getExpiryThresholdDate();

  const bookings = await findAdminCalendarBookings({
    listingId,
    endDate: { gt: windowStart },
    startDate: { lt: windowEnd },
    OR: [
      { status: BookingStatus.CONFIRMED },
      { status: BookingStatus.PENDING, createdAt: { gt: expiryThreshold } },
    ],
  });

  const customPricesObj: Record<string, number> =
    listing.customPrices && typeof listing.customPrices === "object" && !Array.isArray(listing.customPrices)
      ? (listing.customPrices as Record<string, number>)
      : {};

  const mappedBookings = bookings.map((b: any) => {
    const isPendingHold = b.status === BookingStatus.PENDING;
    const expiresAt = isPendingHold ? getAuthoritativeExpiryDate(b.createdAt).toISOString() : null;
    const isUrgent = isPendingHold && getTimeRemaining(b.createdAt).totalMs < 6 * 3600 * 1000;
    const countdownText = isPendingHold ? formatExpiryCountdown(b.createdAt).text : null;
    const nights = differenceInBookingNights(b.startDate, b.endDate);
    const breakdown = (b.priceBreakdown as Record<string, any>) || {};
    const bookingType = breakdown.bookingMode || (b.status === BookingStatus.CONFIRMED && !b.submissionId ? "INSTANT_BOOK" : "REQUEST_TO_BOOK");

    return {
      id: b.id,
      submissionId: b.submissionId,
      status: b.status,
      startDate: bookingDateKey(b.startDate),
      endDate: bookingDateKey(b.endDate),
      nights,
      guests: b.guests,
      totalPrice: b.totalPrice,
      nightlyPrice: b.nightlyPrice,
      cleaningFee: b.cleaningFee,
      currency: b.currency,
      bookingType,
      cancellationPolicy: b.cancellationPolicy,
      isPendingHold,
      expiresAt,
      countdownText,
      isUrgent,
      user: b.user,
      payments: b.payments,
    };
  });

  return {
    listing: {
      ...listing,
      weekendBasePrice: listing.weekendPrice,
      photos: sanitizeListingSecrets(listing).photos || [],
    },
    bookings: mappedBookings,
    blockedDates: listing.blockedDates || [],
    customPrices: customPricesObj,
    monthKey: safeMonthKey,
  };
}

function parseAdminCalendarDate(value: string | undefined, label: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw AppError.badRequest(`${label} must use YYYY-MM-DD.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw AppError.badRequest(`${label} is not a valid date.`);
  }
  return date;
}

type CalendarCountry = { code: string; name: string };

const calendarCountriesByCode = new Map<string, CalendarCountry>(
  ADDRESS_COUNTRIES.map((country) => [country.iso2, { code: country.iso2, name: country.name }]),
);
const calendarCountriesByName = new Map<string, CalendarCountry>(
  ADDRESS_COUNTRIES.map((country) => [country.name.toLocaleLowerCase(), { code: country.iso2, name: country.name }]),
);

function normalizeCalendarWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Calendar filters only accept countries that can be verified against the
 * application's ISO reference data. In particular, a suffix code is trusted
 * only when it agrees with the accompanying country name.
 */
function normalizeCalendarCountry(value: string | null | undefined): CalendarCountry | null {
  if (!value) return null;
  const normalized = normalizeCalendarWhitespace(value);
  if (!normalized) return null;

  if (/^[A-Za-z]{2}$/.test(normalized)) {
    return calendarCountriesByCode.get(normalized.toUpperCase()) || null;
  }

  const formatted = normalized.match(/^(.*?)\s*-\s*([A-Za-z]{2})$/);
  if (formatted) {
    const country = calendarCountriesByCode.get(formatted[2].toUpperCase());
    const suppliedName = normalizeCalendarWhitespace(formatted[1]).toLocaleLowerCase();
    if (country && suppliedName === country.name.toLocaleLowerCase()) return country;
    return null;
  }

  return calendarCountriesByName.get(normalized.toLocaleLowerCase()) || null;
}

function addCalendarListingCondition(
  where: Prisma.ListingWhereInput,
  condition: Prisma.ListingWhereInput,
): void {
  const current = where.AND;
  where.AND = current
    ? [...(Array.isArray(current) ? current : [current]), condition]
    : [condition];
}

function normalizeCalendarCity(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeCalendarWhitespace(value);
  return normalized || null;
}

function calendarCityIdentity(value: string): string {
  return normalizeCalendarWhitespace(value).toLocaleLowerCase();
}

function calendarCityKey(countryCode: string, city: string): string {
  return `${countryCode}:${encodeURIComponent(normalizeCalendarWhitespace(city))}`;
}

function parseCalendarCityKey(value: string | null | undefined): { country: CalendarCountry; city: string } | null {
  if (!value) return null;
  const match = value.match(/^([A-Za-z]{2}):(.*)$/);
  if (!match) return null;
  const country = calendarCountriesByCode.get(match[1].toUpperCase());
  if (!country) return null;
  try {
    const city = normalizeCalendarCity(decodeURIComponent(match[2]));
    return city ? { country, city } : null;
  } catch {
    return null;
  }
}

function preferredCalendarCityLabel(current: string, candidate: string): string {
  const hasLeadingCapital = (value: string) => /\p{Lu}/u.test(value.charAt(0));
  if (hasLeadingCapital(candidate) && !hasLeadingCapital(current)) return candidate;
  return candidate.localeCompare(current, undefined, { sensitivity: "variant" }) < 0 ? candidate : current;
}

async function findCalendarCountryVariants(country: CalendarCountry): Promise<string[]> {
  const rows: Array<{ country: string | null }> = await prisma.listing.findMany({
    where: { deletedAt: null, country: { not: null } },
    distinct: ["country"],
    select: { country: true },
  });
  return rows
    .map((row) => row.country)
    .filter((value): value is string => normalizeCalendarCountry(value)?.code === country.code);
}

async function findCalendarCityVariants(
  country: CalendarCountry,
  city: string,
): Promise<{ countryVariants: string[]; cityVariants: string[] }> {
  const countryVariants = await findCalendarCountryVariants(country);
  if (countryVariants.length === 0) return { countryVariants, cityVariants: [] };
  const rows: Array<{ city: string | null; country: string | null }> = await prisma.listing.findMany({
    where: {
      deletedAt: null,
      city: { not: null },
      country: { in: countryVariants },
    },
    distinct: ["city", "country"],
    select: { city: true, country: true },
  });
  const identity = calendarCityIdentity(city);
  const cityVariants = rows
    .filter((row) => normalizeCalendarCountry(row.country)?.code === country.code)
    .map((row) => row.city)
    .filter((value): value is string => Boolean(value && calendarCityIdentity(value) === identity));
  return { countryVariants, cityVariants };
}

function isMissingBookingPaymentTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { table?: unknown; cause?: unknown };
  };
  const detail = [candidate.message, candidate.meta?.table, candidate.meta?.cause]
    .filter(Boolean)
    .join(" ");

  // Prisma adapters do not all attach the missing relation name to `meta.table`.
  // This query's only optional relation is payments, so any P2021 here can use
  // the payment-free query; matching the rendered message covers adapters that
  // omit the code as well.
  return candidate.code === "P2021" || /BookingPayment/i.test(detail);
}

/**
 * Compatibility path for installations that have deployed the application but
 * not yet applied the admin-booking foundation migration. Availability does
 * not depend on payment rows, so calendar rendering remains safe; the preview
 * simply reports payment status as unavailable until the migration is applied.
 */
async function findAdminCalendarBookings(where: Prisma.BookingWhereInput): Promise<any[]> {
  const user = {
    select: { id: true, name: true, email: true, image: true, phone: true },
  };
  const payment = {
    select: { id: true, status: true, amount: true, currency: true },
    take: 1,
  };

  try {
    return await prisma.booking.findMany({
      where,
      include: { user, payments: payment },
      orderBy: { startDate: "asc" },
    }) as any[];
  } catch (error) {
    if (!isMissingBookingPaymentTable(error)) throw error;
    return await prisma.booking.findMany({
      where,
      include: { user },
      orderBy: { startDate: "asc" },
    }) as any[];
  }
}

function mapAdminCalendarBookings(bookings: any[]): AdminCalendarData["bookings"] {
  return bookings.map((booking) => {
    const isPendingHold = booking.status === BookingStatus.PENDING;
    const expiryDate = isPendingHold ? getAuthoritativeExpiryDate(booking.createdAt) : null;
    const breakdown = (booking.priceBreakdown as Record<string, any>) || {};

    return {
      id: booking.id,
      submissionId: booking.submissionId,
      status: booking.status,
      startDate: bookingDateKey(booking.startDate),
      endDate: bookingDateKey(booking.endDate),
      nights: differenceInBookingNights(booking.startDate, booking.endDate),
      guests: booking.guests,
      totalPrice: booking.totalPrice,
      nightlyPrice: booking.nightlyPrice,
      cleaningFee: booking.cleaningFee,
      currency: booking.currency,
      bookingType:
        breakdown.bookingMode ||
        (booking.status === BookingStatus.CONFIRMED && !booking.submissionId
          ? "INSTANT_BOOK"
          : "REQUEST_TO_BOOK"),
      cancellationPolicy: booking.cancellationPolicy,
      isPendingHold,
      expiresAt: expiryDate?.toISOString() ?? null,
      countdownText: isPendingHold ? formatExpiryCountdown(booking.createdAt).text : null,
      isUrgent: isPendingHold && getTimeRemaining(booking.createdAt).totalMs < 6 * 3600 * 1000,
      user: booking.user,
      payments: booking.payments,
    };
  });
}

/**
 * Returns one bounded, paginated property page and all active booking intervals
 * for that page in a single booking query. This deliberately shares the same
 * confirmed/pending-hold rule as the single-property calendar.
 */
async function getAdminAllPropertiesCalendarData(
  actor: AuthUser,
  options: AdminAllPropertiesCalendarOptions = {},
): Promise<AdminAllPropertiesCalendarData> {
  assertRole(actor, [Role.ADMIN]);

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowStart = parseAdminCalendarDate(options.startDate, "startDate") || defaultStart;
  const windowEnd = parseAdminCalendarDate(options.endDate, "endDate") || new Date(
    Date.UTC(defaultStart.getUTCFullYear(), defaultStart.getUTCMonth(), defaultStart.getUTCDate() + 14),
  );
  const durationMs = windowEnd.getTime() - windowStart.getTime();
  if (durationMs <= 0 || durationMs > 62 * 24 * 60 * 60 * 1000) {
    throw AppError.badRequest("Calendar range must be greater than zero and no longer than 62 days.");
  }

  const page = Math.max(1, Math.trunc(options.page || 1));
  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit || 20)));
  const listingWhere: Prisma.ListingWhereInput = { deletedAt: null };
  const search = options.search?.trim();

  if (search) {
    listingWhere.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { host: { name: { contains: search, mode: "insensitive" } } },
      { host: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (options.hostId?.trim()) listingWhere.hostId = options.hostId.trim();
  if (options.filterListingId?.trim()) listingWhere.id = options.filterListingId.trim();
  const selectedCountry = normalizeCalendarCountry(options.country);
  if (options.country?.trim()) {
    const countryVariants = selectedCountry ? await findCalendarCountryVariants(selectedCountry) : [];
    if (countryVariants.length > 0) addCalendarListingCondition(listingWhere, { country: { in: countryVariants } });
    else listingWhere.id = { in: [] };
  }

  const selectedCity = parseCalendarCityKey(options.cityKey);
  if (options.cityKey?.trim()) {
    if (!selectedCity) {
      listingWhere.id = { in: [] };
    } else {
      const { countryVariants, cityVariants } = await findCalendarCityVariants(selectedCity.country, selectedCity.city);
      if (cityVariants.length === 0) {
        listingWhere.id = { in: [] };
      } else {
        addCalendarListingCondition(listingWhere, { country: { in: countryVariants } });
        addCalendarListingCondition(listingWhere, { city: { in: cityVariants } });
      }
    }
  } else if (options.city?.trim()) {
    // Keep old bookmarked URLs functional while new selections use cityKey,
    // which is unambiguous when multiple countries have the same city name.
    listingWhere.city = { equals: options.city.trim(), mode: "insensitive" };
  }
  if (options.propertyType?.trim()) {
    listingWhere.propertyType = { equals: options.propertyType.trim(), mode: "insensitive" };
  }
  if (options.status?.trim()) {
    if (!Object.values(ListingStatus).includes(options.status as ListingStatus)) {
      throw AppError.badRequest("Invalid listing status filter.");
    }
    listingWhere.status = options.status as ListingStatus;
  }

  const [total, listings] = await Promise.all([
    prisma.listing.count({ where: listingWhere }),
    prisma.listing.findMany({
      where: listingWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        city: true,
        country: true,
        propertyType: true,
        photos: true,
        price: true,
        status: true,
        blockedDates: true,
        host: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const listingIds = listings.map((listing: any) => listing.id);
  const bookingStatus = options.bookingStatus?.trim();
  if (bookingStatus && bookingStatus !== BookingStatus.CONFIRMED && bookingStatus !== BookingStatus.PENDING) {
    throw AppError.badRequest("Booking status must be CONFIRMED or PENDING.");
  }

  const expiryThreshold = getExpiryThresholdDate();
  const bookings = listingIds.length === 0
    ? []
    : await findAdminCalendarBookings({
        listingId: { in: listingIds },
        endDate: { gt: windowStart },
        startDate: { lt: windowEnd },
        OR: bookingStatus === BookingStatus.CONFIRMED
          ? [{ status: BookingStatus.CONFIRMED }]
          : bookingStatus === BookingStatus.PENDING
            ? [{ status: BookingStatus.PENDING, createdAt: { gt: expiryThreshold } }]
            : [
                { status: BookingStatus.CONFIRMED },
                { status: BookingStatus.PENDING, createdAt: { gt: expiryThreshold } },
              ],
      });

  const bookingsByListing = new Map<string, AdminCalendarData["bookings"]>();
  for (const booking of bookings as any[]) {
    const current = bookingsByListing.get(booking.listingId) || [];
    current.push(mapAdminCalendarBookings([booking])[0]);
    bookingsByListing.set(booking.listingId, current);
  }

  const startDate = bookingDateKey(windowStart);
  const endDate = bookingDateKey(windowEnd);
  return {
    properties: listings.map((listing: any) => ({
      id: listing.id,
      title: listing.title,
      city: listing.city,
      country: listing.country,
      propertyType: listing.propertyType,
      photos: sanitizeListingSecrets(listing).photos || [],
      price: listing.price,
      status: listing.status,
      host: listing.host,
      blockedDates: (listing.blockedDates || []).filter((date: string) => date >= startDate && date < endDate),
      bookings: bookingsByListing.get(listing.id) || [],
    })),
    range: { startDate, endDate },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function listPropertiesForAdminCalendar(
  actor: AuthUser,
  search?: string,
  limit = 25,
) {
  assertRole(actor, [Role.ADMIN]);

  const where: Prisma.ListingWhereInput = {
    deletedAt: null,
  };

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { host: { name: { contains: q, mode: "insensitive" } } },
      { host: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const listings = await prisma.listing.findMany({
    where,
    take: Math.min(50, Math.max(1, limit)),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      city: true,
      country: true,
      photos: true,
      price: true,
      status: true,
      host: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          bookings: true,
        },
      },
    },
  });

  return listings.map((l: any) => ({
    id: l.id,
    title: l.title,
    city: l.city,
    country: l.country,
    photos: sanitizeListingSecrets(l).photos || [],
    price: l.price,
    status: l.status,
    host: l.host,
    bookingCount: l._count?.bookings ?? 0,
  }));
}

export type AdminCalendarFilterOptionType = "properties" | "hosts" | "cities" | "countries" | "propertyTypes";

export async function listAdminCalendarFilterOptions(
  actor: AuthUser,
  type: AdminCalendarFilterOptionType,
  options: { search?: string; page?: number; limit?: number; selected?: string; country?: string } = {},
) {
  assertRole(actor, [Role.ADMIN]);
  const search = options.search?.trim();
  const page = Math.max(1, Math.trunc(options.page || 1));
  const limit = Math.min(20, Math.max(1, Math.trunc(options.limit || 20)));
  const skip = (page - 1) * limit;
  const dedupe = <T extends { value: string }>(items: T[]) => Array.from(new Map(items.map((item) => [item.value, item])).values());

  if (type === "properties") {
    const where: Prisma.ListingWhereInput = { deletedAt: null };
    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }
    const [total, listings, selected] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, city: true, country: true },
      }),
      options.selected ? prisma.listing.findFirst({
        where: { id: options.selected, deletedAt: null },
        select: { id: true, title: true, city: true, country: true },
      }) : null,
    ]);
    const toOption = (listing: NonNullable<typeof selected>) => ({
      value: listing.id,
      label: listing.title.trim() || "Untitled property",
      description: [listing.city, listing.country].filter(Boolean).join(", ") || "Location unavailable",
    });
    return { options: dedupe([...(selected ? [toOption(selected)] : []), ...listings.map(toOption)]), pagination: { page, limit, hasMore: page * limit < total } };
  }

  if (type === "hosts") {
    const where: Prisma.UserWhereInput = { listings: { some: { deletedAt: null } } };
    if (search) where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
    const [total, hosts, selected] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, skip, take: limit, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
      options.selected ? prisma.user.findFirst({ where: { id: options.selected, listings: { some: { deletedAt: null } } }, select: { id: true, name: true, email: true } }) : null,
    ]);
    const toOption = (host: NonNullable<typeof selected>) => ({ value: host.id, label: host.name?.trim() || host.email || "Unnamed host", description: host.email || undefined });
    return { options: dedupe([...(selected ? [toOption(selected)] : []), ...hosts.map(toOption)]), pagination: { page, limit, hasMore: page * limit < total } };
  }

  if (type === "countries" || type === "cities") {
    const cacheKey = CACHE_KEYS.ADMIN_CALENDAR_FILTER_OPTIONS(hashFilters({
      type,
      search: search?.toLocaleLowerCase(),
      page,
      limit,
      selected: options.selected,
      country: options.country,
    }));

    return getOrSetCache(cacheKey, async () => {
      if (type === "countries") {
        // DISTINCT happens in the database. We normalize the small set of
        // distinct values before applying pagination, so country variants can
        // never consume separate pages or reappear as duplicate options.
        const rows = await prisma.listing.findMany({
          where: { deletedAt: null, country: { not: null } },
          distinct: ["country"],
          select: { country: true },
        });
        const countries = new Map<string, CalendarCountry>();
        for (const row of rows) {
          const country = normalizeCalendarCountry(row.country);
          if (country) countries.set(country.code, country);
        }
        const matching = Array.from(countries.values())
          .filter((country) => !search || `${country.name} ${country.code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
          .sort((left, right) => left.name.localeCompare(right.name));
        const selected = normalizeCalendarCountry(options.selected);
        const selectedOption = selected && countries.has(selected.code)
          ? { value: selected.code, label: selected.name }
          : null;
        const pageItems = matching.slice(skip, skip + limit + 1);
        return {
          options: dedupe([
            ...(selectedOption ? [selectedOption] : []),
            ...pageItems.slice(0, limit).map((country) => ({ value: country.code, label: country.name })),
          ]),
          pagination: { page, limit, hasMore: pageItems.length > limit },
        };
      }

      const scopedCountry = options.country?.trim()
        ? normalizeCalendarCountry(options.country)
        : null;
      if (options.country?.trim() && !scopedCountry) {
        return { options: [], pagination: { page, limit, hasMore: false } };
      }

      // As with countries, this reads only distinct city/country pairs, never
      // every listing. It must happen before pagination because whitespace and
      // capitalization variants collapse into one canonical city option.
      const where: Prisma.ListingWhereInput = {
        deletedAt: null,
        city: { not: null },
        country: { not: null },
      };
      if (scopedCountry) {
        const countryVariants = await findCalendarCountryVariants(scopedCountry);
        if (countryVariants.length === 0) {
          return { options: [], pagination: { page, limit, hasMore: false } };
        }
        where.country = { in: countryVariants };
      }
      const rows = await prisma.listing.findMany({
        where,
        distinct: ["city", "country"],
        select: { city: true, country: true },
      });

      const cities = new Map<string, { country: CalendarCountry; city: string }>();
      for (const row of rows) {
        const country = normalizeCalendarCountry(row.country);
        const city = normalizeCalendarCity(row.city);
        if (!country || !city || (scopedCountry && country.code !== scopedCountry.code)) continue;
        const key = `${country.code}:${calendarCityIdentity(city)}`;
        const current = cities.get(key);
        cities.set(key, current
          ? { ...current, city: preferredCalendarCityLabel(current.city, city) }
          : { country, city });
      }

      const matching = Array.from(cities.values())
        .filter(({ country, city }) => {
          if (!search) return true;
          const query = search.toLocaleLowerCase();
          return city.toLocaleLowerCase().includes(query) || country.name.toLocaleLowerCase().includes(query);
        })
        .sort((left, right) => left.city.localeCompare(right.city) || left.country.name.localeCompare(right.country.name));
      const selected = parseCalendarCityKey(options.selected);
      const selectedOption = selected && cities.has(`${selected.country.code}:${calendarCityIdentity(selected.city)}`)
        ? {
            value: calendarCityKey(selected.country.code, selected.city),
            label: selected.city,
            description: selected.country.name,
          }
        : null;
      const pageItems = matching.slice(skip, skip + limit + 1);
      return {
        options: dedupe([
          ...(selectedOption ? [selectedOption] : []),
          ...pageItems.slice(0, limit).map(({ country, city }) => ({
            value: calendarCityKey(country.code, city),
            label: city,
            description: country.name,
          })),
        ]),
        pagination: { page, limit, hasMore: pageItems.length > limit },
      };
    }, { ttl: CACHE_TTL.SHORT_LIVED });
  }

  const field = "propertyType";
  const listingWhere: Prisma.ListingWhereInput = {
    deletedAt: null,
    [field]: search ? { not: null, contains: search, mode: "insensitive" } : { not: null },
  };
  const values = await prisma.listing.findMany({
    where: listingWhere,
    distinct: [field],
    orderBy: { [field]: "asc" },
    skip,
    take: limit + 1,
    select: { city: true, country: true, propertyType: true },
  });
  const selectedValue = options.selected?.trim();
  const pageValues = values
    .slice(0, limit)
    .map((listing: { city: string | null; country: string | null; propertyType: string | null }) => listing[field])
    .filter((value: string | null): value is string => Boolean(value?.trim()));
  return {
    options: dedupe([...(selectedValue ? [{ value: selectedValue, label: selectedValue }] : []), ...pageValues.map((value: string) => ({ value, label: value }))]),
    pagination: { page, limit, hasMore: values.length > limit },
  };
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
  disputes: Array<{
    id: string;
    caseReference: string;
    category: string;
    status: string;
    workflowStatus: string;
    createdAt: Date;
    updatedAt: Date;
    resolutionNotes: string | null;
  }>;
  payment?: {
    id: string;
    status: PaymentStatus;
    provider: PaymentProvider;
    providerPaymentId: string | null;
    amount: number;
    capturedAmount: number;
    refundedAmount: number;
    currency: string;
    paymentMethod: string | null;
    createdAt: Date;
    capturedAt: Date | null;
    voidedAt: Date | null;
    failedAt: Date | null;
    failureReason: string | null;
  } | null;
  paymentConfirmation?: {
    status: string;
    currency: string;
  } | null;
  refunds?: Array<{
    id: string;
    refundReference: string | null;
    status: RefundStatus;
    amount: number;
    currency: string;
    reason: string | null;
    createdAt: string;
    processedAt: string | null;
    succeededAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
  }>;
  refundConfirmation?: {
    status: string;
    totalRefunded: number;
    currency: string;
  } | null;
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
      await prisma.bookingPayment.updateMany({
        where: {
          bookingId: b.id,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] },
        },
        data: {
          status: PaymentStatus.VOIDED,
          voidedAt: new Date(),
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

  const [conversation, guestDisputes, paymentRecord, bookingRefunds] = await Promise.all([
    prisma.conversation.findFirst({
      where: { bookingId: b.id },
      include: {
        messages: {
          where: { type: MessageType.BOOKING_REQUEST },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    }),
    isGuest
      ? prisma.listingQualityIncident.findMany({
          where: { bookingId: b.id, reportedById: actor.id },
          select: {
            id: true,
            category: true,
            status: true,
            resolutionNotes: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 20,
        })
      : Promise.resolve([]),
    prisma.bookingPayment.findFirst({
      where: { bookingId: b.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bookingRefund.findMany({
      where: { bookingId: b.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

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
    disputes: guestDisputes.map((dispute: {
      id: string;
      category: string;
      status: string;
      resolutionNotes: string | null;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
    }) => {
      const metadata = (dispute.metadata as Record<string, unknown>) || {};
      return {
        id: dispute.id,
        caseReference: typeof metadata.caseReference === "string" ? metadata.caseReference : `DSP-${dispute.id.slice(-6).toUpperCase()}`,
        category: dispute.category,
        status: dispute.status,
        workflowStatus: typeof metadata.disputeStatus === "string"
          ? metadata.disputeStatus
          : dispute.status === "RESOLVED" ? "RESOLVED" : "OPEN",
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
        resolutionNotes: dispute.resolutionNotes,
      };
    }),
    payment: (isGuest || isAdmin) && paymentRecord ? {
      id: paymentRecord.id,
      status: paymentRecord.status,
      provider: paymentRecord.provider,
      providerPaymentId: paymentRecord.providerPaymentId,
      amount: paymentRecord.amount,
      capturedAmount: paymentRecord.capturedAmount,
      refundedAmount: paymentRecord.refundedAmount,
      currency: paymentRecord.currency,
      paymentMethod: paymentRecord.paymentMethod,
      createdAt: paymentRecord.createdAt,
      capturedAt: paymentRecord.capturedAt,
      voidedAt: paymentRecord.voidedAt,
      failedAt: paymentRecord.failedAt,
      failureReason: paymentRecord.failureReason,
    } : null,
    paymentConfirmation: {
      status: b.status === BookingStatus.CONFIRMED ? "PAID" : "PENDING",
      currency: b.currency,
    },
    refunds: (isGuest || isAdmin)
      ? bookingRefunds.map((r: any) => ({
          id: r.id,
          refundReference: r.refundReference,
          status: r.status,
          amount: r.amount,
          currency: r.currency,
          reason: r.reason,
          createdAt: r.createdAt.toISOString(),
          processedAt: r.processedAt?.toISOString() || null,
          succeededAt: r.succeededAt?.toISOString() || null,
          failedAt: r.failedAt?.toISOString() || null,
          failureReason: r.failureReason || null,
        }))
      : [],
    refundConfirmation: isHost && bookingRefunds.some((r: any) => r.status === RefundStatus.SUCCEEDED)
      ? {
          status: "REFUNDED",
          totalRefunded: bookingRefunds
            .filter((r: any) => r.status === RefundStatus.SUCCEEDED)
            .reduce((acc: number, r: any) => acc + r.amount, 0),
          currency: b.currency,
        }
      : null,
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
  const requestedGuests = preview.quote.guests;

  const updatedBooking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${preview.quote!.listingId}))`;

    const existingBooking = await tx.booking.findUnique({
      where: { id },
      select: { priceBreakdown: true },
    });
    if (!existingBooking) throw AppError.notFound("Booking not found");

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

    const previousBreakdown = existingBooking.priceBreakdown
      && typeof existingBooking.priceBreakdown === "object"
      && !Array.isArray(existingBooking.priceBreakdown)
      ? existingBooking.priceBreakdown as Record<string, unknown>
      : {};
    const previousHistory = Array.isArray(previousBreakdown.pricingSnapshotHistory)
      ? previousBreakdown.pricingSnapshotHistory
      : [];
    const previousRevision = typeof previousBreakdown.pricingSnapshotRevision === "number"
      ? previousBreakdown.pricingSnapshotRevision
      : 1;
    const previousSnapshot = { ...previousBreakdown };
    delete previousSnapshot.pricingSnapshotHistory;
    const updatedPriceBreakdown = {
      ...previousBreakdown,
      ...preview.quote!,
      pricingSnapshotVersion: "v1",
      pricingSnapshotRevision: previousRevision + 1,
      automaticDiscount: preview.quote!.selectedDiscount ? {
        type: preview.quote!.selectedDiscount.type,
        label: preview.quote!.selectedDiscount.label,
        percentage: preview.quote!.selectedDiscount.percentage,
        amount: preview.quote!.selectedDiscount.amount,
      } : null,
      cancellationPolicySnapshot: preview.quote!.cancellationPolicy,
      pricingSnapshotHistory: [
        ...previousHistory,
        {
          revision: previousRevision,
          supersededAt: new Date().toISOString(),
          snapshot: previousSnapshot,
        },
      ],
    } as unknown as Prisma.InputJsonValue;

    return tx.booking.update({
      where: { id },
      data: {
        startDate: checkIn,
        endDate: checkOut,
        guests: requestedGuests,
        totalPrice: preview.quote!.guestTotal,
        nightlyPrice: preview.quote!.baseNightlyPrice,
        cleaningFee: preview.quote!.cleaningFee ?? 0,
        currency: preview.quote!.currency,
        cancellationPolicy: preview.quote!.cancellationPolicy,
        isNonRefundable: preview.quote!.isNonRefundable,
        priceBreakdown: updatedPriceBreakdown,
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
  cancelBookingByHost,
  cancelBookingByAdmin,
  listForAdminDashboard,
  listForAdmin,
  listCancellationsForAdmin,
  getCancellationSummaryForAdmin,
  getAdminCalendarData,
  listPropertiesForAdminCalendar,
  listAdminCalendarFilterOptions,
  getAdminBookingDetails,
  getAdminBookingSummary,
  getAdminBookingActivity,
  getAdminPendingRequests,
  getAdminRecentBookings,
  getAdminRecentActivity,
  getAdminAllPropertiesCalendarData,
};
