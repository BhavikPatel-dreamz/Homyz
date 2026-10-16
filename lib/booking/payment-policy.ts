/**
 * Central Payment Policy
 *
 * Defines whether online payment is required, the current payment mode,
 * and default payment statuses.
 *
 * Current modes: MOCK / DEFERRED
 * - No real payment gateway is configured (Moyasar will be added later).
 * - Bookings and Request-to-Book workflows work end-to-end without an active gateway.
 * - Payment selection UI operates in simulated mock mode with safe test cards.
 * - Payment status is truthfully recorded as PAYMENT_PENDING / DEFERRED.
 * - No fake payment IDs, authorizations, or capture tokens are accepted.
 *
 * Future mode: ONLINE_AUTHORIZATION
 * - Moyasar will provide real payment authorizations and captures.
 */

export type PaymentMode = "MOCK" | "DEFERRED" | "ONLINE_AUTHORIZATION";

export interface PaymentPolicy {
  /** If true, online payment authorization/capture is strictly required. */
  onlinePaymentRequired: boolean;
  /** Current mode of payment processing. */
  paymentMode: PaymentMode;
  /** Truthful payment status for bookings created without gateway. */
  defaultPaymentStatus: "PAYMENT_PENDING" | "NOT_REQUIRED" | "AUTHORIZED";
  /** Whether a real online payment provider SDK is connected. */
  providerConfigured: boolean;
}

export function getPaymentMode(): PaymentMode {
  const envMode = process.env.PAYMENT_MODE?.toLowerCase();
  if (envMode === "moyasar" || envMode === "online_authorization") {
    return "ONLINE_AUTHORIZATION";
  }
  if (envMode === "mock") {
    return "MOCK";
  }
  return "DEFERRED";
}

export function getPaymentPolicy(): PaymentPolicy {
  const mode = getPaymentMode();
  if (mode === "ONLINE_AUTHORIZATION") {
    return {
      onlinePaymentRequired: true,
      paymentMode: "ONLINE_AUTHORIZATION",
      defaultPaymentStatus: "PAYMENT_PENDING",
      providerConfigured: true,
    };
  }
  return {
    onlinePaymentRequired: false,
    paymentMode: mode,
    defaultPaymentStatus: "PAYMENT_PENDING",
    providerConfigured: false,
  };
}

export const CURRENT_PAYMENT_POLICY: PaymentPolicy = {
  onlinePaymentRequired: false,
  paymentMode: "DEFERRED",
  defaultPaymentStatus: "PAYMENT_PENDING",
  providerConfigured: false,
};
