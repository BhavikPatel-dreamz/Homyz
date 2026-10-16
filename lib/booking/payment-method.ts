import { getPaymentPolicy } from "./payment-policy";

export type PaymentAuthorizationStatus =
  | "NOT_STARTED"
  | "AUTHORIZING"
  | "AUTHORIZED"
  | "FAILED"
  | "EXPIRED"
  | "CAPTURED"
  | "RELEASED";

export type PaymentMethodType =
  | "MOCK_CARD"
  | "MOCK_MADA"
  | "MOCK_APPLE_PAY"
  | "MOCK_GOOGLE_PAY";

export type AvailablePaymentMethod = {
  type: string;
  provider: string;
  displayLabel: string;
};

export type SafePaymentSummary = {
  type: PaymentMethodType;
  brand: "Visa" | "Mastercard" | "mada" | "Apple Pay" | "Google Pay" | "Card";
  last4?: string;
  displayLabel: string;
  paymentMode: "DEFERRED" | "MOCK";
  paymentStatus: "PAYMENT_PENDING";
};

export const PAYMENT_PROVIDER_UNAVAILABLE_MESSAGE =
  "Online payment is not available yet. A secure payment provider must be configured before checkout can continue.";

export const REQUEST_TO_BOOK_NO_PAYMENT_MESSAGE =
  "Test payment mode is active. No real payment is collected when you send this request.";

export const TEST_PAYMENT_MODE_BANNER =
  "Test payment mode — No real payment will be processed. Use mock test card 4242 4242 4242 4242.";

/**
 * Detects card brand from number prefix for UI preview.
 */
export function detectCardBrand(cleanNumber: string): "Visa" | "Mastercard" | "mada" | "Card" {
  if (/^4/.test(cleanNumber)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(cleanNumber)) return "Mastercard";
  if (/^(5888|4847|5892|4008)/.test(cleanNumber)) return "mada";
  return "Card";
}

/**
 * Validates mock test card inputs in UI simulation only.
 * Rejects obviously broken input while accepting standard test card 4242 4242 4242 4242.
 */
export function validateMockCard(input: {
  number: string;
  expiry: string;
  cvc: string;
  name?: string;
}): { valid: boolean; error?: string; brand: "Visa" | "Mastercard" | "mada" | "Card"; last4: string } {
  const cleanNumber = (input.number || "").replace(/\s+/g, "");
  const cleanCvc = (input.cvc || "").trim();
  const cleanExpiry = (input.expiry || "").trim();

  if (cleanNumber.length < 13 || cleanNumber.length > 19 || !/^\d+$/.test(cleanNumber)) {
    return {
      valid: false,
      error: "Please enter a valid card number (e.g. 4242 4242 4242 4242).",
      brand: "Card",
      last4: cleanNumber.slice(-4) || "4242",
    };
  }

  const expiryMatch = cleanExpiry.match(/^(\d{1,2})\/(\d{2})$/);
  if (!expiryMatch) {
    return {
      valid: false,
      error: "Please enter an expiry date in MM/YY format (e.g. 12/30).",
      brand: detectCardBrand(cleanNumber),
      last4: cleanNumber.slice(-4),
    };
  }
  const month = parseInt(expiryMatch[1], 10);
  if (month < 1 || month > 12) {
    return {
      valid: false,
      error: "Please enter a valid month (01–12).",
      brand: detectCardBrand(cleanNumber),
      last4: cleanNumber.slice(-4),
    };
  }

  if (cleanCvc.length < 3 || cleanCvc.length > 4 || !/^\d+$/.test(cleanCvc)) {
    return {
      valid: false,
      error: "Please enter a valid 3 or 4-digit CVC.",
      brand: detectCardBrand(cleanNumber),
      last4: cleanNumber.slice(-4),
    };
  }

  return {
    valid: true,
    brand: detectCardBrand(cleanNumber),
    last4: cleanNumber.slice(-4),
  };
}

/**
 * Creates safe, non-sensitive payment display information.
 * NEVER stores full card numbers, CVCs, or expiry dates.
 */
export function createSafePaymentSelection(
  method: "card" | "mada" | "apple_pay" | "google_pay",
  brand?: "Visa" | "Mastercard" | "mada" | "Card",
  last4?: string,
): SafePaymentSummary {
  if (method === "apple_pay") {
    return {
      type: "MOCK_APPLE_PAY",
      brand: "Apple Pay",
      displayLabel: "Apple Pay",
      paymentMode: "DEFERRED",
      paymentStatus: "PAYMENT_PENDING",
    };
  }
  if (method === "google_pay") {
    return {
      type: "MOCK_GOOGLE_PAY",
      brand: "Google Pay",
      displayLabel: "Google Pay",
      paymentMode: "DEFERRED",
      paymentStatus: "PAYMENT_PENDING",
    };
  }
  if (method === "mada") {
    const cardLast4 = last4 || "4242";
    return {
      type: "MOCK_MADA",
      brand: "mada",
      last4: cardLast4,
      displayLabel: `mada •••• ${cardLast4}`,
      paymentMode: "DEFERRED",
      paymentStatus: "PAYMENT_PENDING",
    };
  }
  const cardBrand = brand || "Visa";
  const cardLast4 = last4 || "4242";
  return {
    type: "MOCK_CARD",
    brand: cardBrand,
    last4: cardLast4,
    displayLabel: `${cardBrand} •••• ${cardLast4}`,
    paymentMode: "DEFERRED",
    paymentStatus: "PAYMENT_PENDING",
  };
}

/**
 * Returns available online payment methods from configured real providers.
 * Returns empty array because no real payment gateway (Moyasar) is configured yet.
 */
export function getAvailablePaymentMethods(): readonly AvailablePaymentMethod[] {
  const policy = getPaymentPolicy();
  if (policy.providerConfigured && policy.paymentMode === "ONLINE_AUTHORIZATION") {
    // Moyasar gateway methods when implemented in future
    return [];
  }
  return [];
}

/**
 * Returns supported mock / deferred payment options for development/testing mode.
 */
export function getMockPaymentMethods(): readonly AvailablePaymentMethod[] {
  return [
    { type: "MOCK_CARD", provider: "MOCK", displayLabel: "Credit / Debit Card (Visa, Mastercard)" },
    { type: "MOCK_MADA", provider: "MOCK", displayLabel: "mada" },
    { type: "MOCK_APPLE_PAY", provider: "MOCK", displayLabel: "Apple Pay" },
    { type: "MOCK_GOOGLE_PAY", provider: "MOCK", displayLabel: "Google Pay" },
  ];
}
