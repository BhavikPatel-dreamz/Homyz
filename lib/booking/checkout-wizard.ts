import type { BookingMode } from "./booking-mode";
import { FULL_PAYMENT_TIMING, isPaymentTiming, type PaymentTiming } from "./payment-timing";
import type { SafePaymentSummary } from "./payment-method";

export const REQUEST_BOOK_STEPS = [
  { id: "paymentTiming", number: 1, title: "Choose when to pay" },
  { id: "paymentMethod", number: 2, title: "Payment method" },
  { id: "hostMessage", number: 3, title: "Write a message to the host" },
  { id: "review", number: 4, title: "Review your request" },
] as const;

export type CheckoutStepNumber = (typeof REQUEST_BOOK_STEPS)[number]["number"];
export type CheckoutStepStatus = "LOCKED" | "ACTIVE" | "COMPLETED";
export type SafeCheckoutDraft = {
  version: 1;
  intentSignature: string;
  bookingMode: BookingMode;
  activeStep: CheckoutStepNumber;
  completedSteps: CheckoutStepNumber[];
  paymentTiming: PaymentTiming;
  paymentMethod: SafePaymentSummary | null;
  hostMessage: string;
  requestSubmissionId: string;
};

export function createRequestSubmissionId(): string {
  return crypto.randomUUID();
}

export function getCheckoutSteps(mode: BookingMode) {
  void mode;
  return REQUEST_BOOK_STEPS;
}

export function getCheckoutStepStatus(
  step: CheckoutStepNumber,
  activeStep: CheckoutStepNumber,
  completedSteps: ReadonlySet<number>,
): CheckoutStepStatus {
  if (step === activeStep) return "ACTIVE";
  if (completedSteps.has(step)) return "COMPLETED";
  return "LOCKED";
}

export function canActivateCheckoutStep(
  step: CheckoutStepNumber,
  mode: BookingMode,
  completedSteps: ReadonlySet<number>,
): boolean {
  void mode;
  if (step === 1) return true;
  for (let prerequisite = 1; prerequisite < step; prerequisite += 1) {
    if (!completedSteps.has(prerequisite)) return false;
  }
  return true;
}

export function parseSafeCheckoutDraft(
  raw: unknown,
  expectedIntentSignature: string,
  expectedMode: BookingMode,
): SafeCheckoutDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<SafeCheckoutDraft>;
  if (value.version !== 1 || value.intentSignature !== expectedIntentSignature || value.bookingMode !== expectedMode) {
    return null;
  }

  const activeStep = Number(value.activeStep) as CheckoutStepNumber;
  if (![1, 2, 3, 4].includes(activeStep)) return null;

  const completedSteps = Array.isArray(value.completedSteps)
    ? [...new Set(value.completedSteps.filter((step): step is CheckoutStepNumber => (
        Number.isInteger(step) && step >= 1 && step <= 4
      )))]
    : [];
  const completedSet = new Set<number>(completedSteps);
  for (const completedStep of completedSteps) {
    for (let prerequisite = 1; prerequisite < completedStep; prerequisite += 1) {
      if (!completedSet.has(prerequisite)) return null;
    }
  }
  if (!canActivateCheckoutStep(activeStep, expectedMode, completedSet)) return null;

  if (!isPaymentTiming(value.paymentTiming)) return null;

  const safeCompletedSteps = completedSteps;
  const safeActiveStep = activeStep;

  let safePaymentMethod: SafePaymentSummary | null = null;
  if (value.paymentMethod && typeof value.paymentMethod === "object" && "displayLabel" in value.paymentMethod) {
    const rawMethod = value.paymentMethod as Record<string, unknown>;
    const allowedTypes: SafePaymentSummary["type"][] = ["MOCK_CARD", "MOCK_MADA", "MOCK_APPLE_PAY", "MOCK_GOOGLE_PAY"];
    const allowedBrands: SafePaymentSummary["brand"][] = ["Visa", "Mastercard", "mada", "Apple Pay", "Google Pay", "Card"];
    const type = allowedTypes.includes(rawMethod.type as SafePaymentSummary["type"])
      ? rawMethod.type as SafePaymentSummary["type"]
      : "MOCK_CARD";
    const brand = allowedBrands.includes(rawMethod.brand as SafePaymentSummary["brand"])
      ? rawMethod.brand as SafePaymentSummary["brand"]
      : "Visa";
    safePaymentMethod = {
      type,
      brand,
      last4: typeof rawMethod.last4 === "string" ? rawMethod.last4 : "4242",
      displayLabel: typeof rawMethod.displayLabel === "string" ? rawMethod.displayLabel : "Visa •••• 4242",
      paymentMode: "DEFERRED",
      paymentStatus: "PAYMENT_PENDING",
    };
  }

  return {
    version: 1,
    intentSignature: expectedIntentSignature,
    bookingMode: expectedMode,
    activeStep: safeActiveStep,
    completedSteps: safeCompletedSteps,
    paymentTiming: value.paymentTiming || FULL_PAYMENT_TIMING,
    paymentMethod: safePaymentMethod,
    hostMessage: typeof value.hostMessage === "string" ? value.hostMessage.slice(0, 1000) : "",
    requestSubmissionId: typeof value.requestSubmissionId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestSubmissionId)
      ? value.requestSubmissionId
      : createRequestSubmissionId(),
  };
}

export function checkoutDraftStorageKey(listingId: string): string {
  return `homyz_checkout_draft_v1:${listingId}`;
}
