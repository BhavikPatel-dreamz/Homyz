import { ErrorCode, AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { resolveBookingMode } from "@/lib/booking/booking-mode";
import { validateHostMessage } from "@/lib/booking/host-message";
import { getPaymentPolicy } from "@/lib/booking/payment-policy";
import { prisma } from "@/lib/db/prisma";
import type { RequestToBookInput } from "@/lib/validation/booking";
import { BookingStatus, ListingStatus, NotificationType } from "@/generated/prisma/enums";
import { bookingService } from "./booking.service";
import { bookingDateKey } from "@/lib/booking/booking-date";

export const REQUEST_PAYMENT_GATE_STATUS = "DEFERRED" as const;

export function buildHostRequestNotification(input: {
  bookingId: string;
  listingId: string;
  listingTitle: string;
  hostId: string;
  guestId: string;
  guestName: string;
  startDate: Date;
  endDate: Date;
  guests: number;
}) {
  const start = bookingDateKey(input.startDate);
  const end = bookingDateKey(input.endDate);
  return {
    userId: input.hostId,
    type: NotificationType.BOOKING,
    title: `New Booking Request: ${input.listingTitle}`,
    message: `${input.guestName} requested ${input.listingTitle} from ${start} to ${end} for ${input.guests} ${input.guests === 1 ? "guest" : "guests"}.`,
    entityId: input.bookingId,
    entityType: "host_booking",
    link: "/host/bookings",
    metadata: {
      bookingId: input.bookingId,
      listingId: input.listingId,
      guestId: input.guestId,
      status: BookingStatus.PENDING,
      role: "host",
    },
  };
}

function mapQuoteError(error: unknown): never {
  if (!(error instanceof AppError)) throw error;
  if (error.code === ErrorCode.CONFLICT) {
    throw AppError.checkoutConflict(
      ErrorCode.DATES_NO_LONGER_AVAILABLE,
      "The selected dates are no longer available. Choose different dates to continue.",
    );
  }
  if (error.code === ErrorCode.NOT_FOUND) {
    throw new AppError(ErrorCode.PROPERTY_NOT_AVAILABLE, error.message, 404);
  }
  if (/guest|occup|pet/i.test(error.message)) {
    throw AppError.checkoutValidation(ErrorCode.INVALID_GUESTS, error.message);
  }
  if (/date|stay|check-in|checkout|advance|night/i.test(error.message)) {
    throw AppError.checkoutValidation(ErrorCode.INVALID_DATES, error.message);
  }
  throw error;
}

/**
 * Central request-to-book submission boundary. Validates all booking constraints
 * and creates the pending reservation without requiring an online payment gateway.
 */
async function createRequestToBook(actor: AuthUser, input: RequestToBookInput) {
  const duplicate = await prisma.booking.findUnique({
    where: { submissionId: input.requestSubmissionId },
    select: { id: true, userId: true },
  });
  if (duplicate) {
    throw AppError.checkoutConflict(
      ErrorCode.DUPLICATE_REQUEST,
      duplicate.userId === actor.id
        ? "This booking request has already been submitted."
        : "This submission key is already in use.",
    );
  }

  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing || !listing.published || listing.status !== ListingStatus.ACTIVE || listing.isPaused) {
    throw new AppError(
      ErrorCode.PROPERTY_NOT_AVAILABLE,
      "This property is no longer available for booking.",
      409,
    );
  }
  if (listing.hostId === actor.id) {
    throw AppError.checkoutValidation(ErrorCode.INVALID_GUESTS, "Hosts cannot request their own listing.");
  }
  if (resolveBookingMode(listing) !== "REQUEST_TO_BOOK") {
    throw AppError.checkoutConflict(
      ErrorCode.BOOKING_MODE_CHANGED,
      "This property no longer uses Request to Book. Refresh checkout to continue.",
    );
  }
  if (input.guests !== input.adults + input.children) {
    throw AppError.checkoutValidation(ErrorCode.INVALID_GUESTS, "Guest totals do not match the selected adults and children.");
  }
  if (input.guests > listing.guests) {
    throw AppError.checkoutValidation(
      ErrorCode.INVALID_GUESTS,
      `This property accommodates a maximum of ${listing.guests} guests.`,
    );
  }
  if (input.children > 0 && listing.childrenAllowed === false) {
    throw AppError.checkoutValidation(ErrorCode.INVALID_GUESTS, "Children are not allowed at this property.");
  }
  if (input.infants > 0 && listing.infantsAllowed === false) {
    throw AppError.checkoutValidation(ErrorCode.INVALID_GUESTS, "Infants are not allowed at this property.");
  }

  const message = validateHostMessage(input.message);
  if (!message.valid) {
    throw AppError.checkoutValidation(ErrorCode.INVALID_HOST_MESSAGE, message.error);
  }

  let quote;
  try {
    quote = await bookingService.getQuote({
      listingId: input.listingId,
      checkIn: input.startDate,
      checkOut: input.endDate,
      guests: input.guests,
      pets: input.pets,
      nonRefundable: input.nonRefundable,
      specialOfferId: input.specialOfferId,
      actor,
    });
  } catch (error) {
    mapQuoteError(error);
  }

  if (quote.bookingMode !== "REQUEST_TO_BOOK") {
    throw AppError.checkoutConflict(
      ErrorCode.BOOKING_MODE_CHANGED,
      "This property's booking mode changed. Refresh checkout to continue.",
    );
  }
  if (quote.guestTotal !== input.expectedGuestTotal || quote.currency !== input.expectedCurrency) {
    throw AppError.checkoutConflict(
      ErrorCode.PRICE_CHANGED,
      "The price changed while you were reviewing. Review the updated total before submitting again.",
    );
  }

  const policy = getPaymentPolicy();
  if (policy.onlinePaymentRequired) {
    throw AppError.checkoutValidation(
      ErrorCode.PAYMENT_AUTHORIZATION_REQUIRED,
      "Payment authorization is required before this booking request can be submitted.",
    );
  }

  // In DEFERRED mode, delegate to bookingService.create to persist PENDING booking,
  // hold inventory dates, link host message conversation, and emit notifications.
  return bookingService.create(actor, {
    listingId: input.listingId,
    startDate: input.startDate,
    endDate: input.endDate,
    guests: input.guests,
    pets: input.pets,
    message: input.message,
    specialOfferId: input.specialOfferId,
    nonRefundable: input.nonRefundable,
    paymentPlan: input.paymentPlan,
    requestSubmissionId: input.requestSubmissionId,
  });
}

export const requestToBookService = {
  createRequestToBook,
};
