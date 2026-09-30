import {
  formatCheckoutDate,
  formatCheckoutGuests,
  getCheckoutPriceRows,
  type CheckoutPriceRow,
  type CheckoutSummaryQuote,
} from "./checkout-summary";
import { getPaymentTimingTitle, type PaymentTiming } from "./payment-timing";
import { getPaymentPolicy } from "./payment-policy";

export const PAYMENT_AUTHORIZATION_REQUIRED_MESSAGE =
  "Payment setup is required before this booking request can be submitted.";

export type ReviewRequestData = {
  payment: {
    timing: string;
    method: string;
    authorizationValid: boolean;
  };
  message: string;
  trip: {
    checkIn: string;
    checkOut: string;
    guests: string;
  };
  pricing: {
    rows: CheckoutPriceRow[];
    total: number;
    currency: string;
  };
  canSubmitRequest: boolean;
  blocker: string | null;
};

export function createReviewRequestData(input: {
  paymentTiming: PaymentTiming;
  paymentTimingLabel?: string;
  paymentMethodLabel: string | null;
  paymentAuthorizationValid: boolean;
  paymentRequiredNow?: boolean;
  hostMessage: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  quote: CheckoutSummaryQuote;
}): ReviewRequestData {
  const policy = getPaymentPolicy();
  const paymentRequiredNow = input.paymentRequiredNow ?? policy.onlinePaymentRequired;
  const authorizationValid = input.paymentAuthorizationValid;
  const canSubmitRequest = !paymentRequiredNow || authorizationValid;

  return {
    payment: {
      timing: input.paymentTimingLabel || getPaymentTimingTitle(input.paymentTiming),
      method: input.paymentMethodLabel || (paymentRequiredNow ? "Not configured yet" : "No payment required now"),
      authorizationValid,
    },
    message: input.hostMessage.trim(),
    trip: {
      checkIn: formatCheckoutDate(input.checkIn),
      checkOut: formatCheckoutDate(input.checkOut),
      guests: formatCheckoutGuests(input),
    },
    pricing: {
      rows: getCheckoutPriceRows(input.quote),
      total: input.quote.guestTotal,
      currency: input.quote.currency,
    },
    canSubmitRequest,
    blocker: canSubmitRequest ? null : PAYMENT_AUTHORIZATION_REQUIRED_MESSAGE,
  };
}
