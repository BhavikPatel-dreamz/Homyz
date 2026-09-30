import { getPaymentPolicy } from "./payment-policy";

export const FULL_PAYMENT_TIMING = "FULL_NOW" as const;
export const PARTIAL_PAYMENT_TIMING = "PARTIAL" as const;
export const PAY_OVER_TIME_PAYMENT_TIMING = "PAY_OVER_TIME" as const;

export type PaymentTiming =
  | typeof FULL_PAYMENT_TIMING
  | typeof PARTIAL_PAYMENT_TIMING
  | typeof PAY_OVER_TIME_PAYMENT_TIMING;
export type BookingApiPaymentPlan = "FULL" | "SPLIT" | "PAY_OVER_TIME";

export type PaymentTimingOption = {
  type: PaymentTiming;
  apiValue: BookingApiPaymentPlan;
  title: string;
};

export function getAvailablePaymentTimingOptions(): readonly PaymentTimingOption[] {
  return [
    {
      type: FULL_PAYMENT_TIMING,
      apiValue: "FULL",
      title: "Pay now",
    },
    {
      type: PARTIAL_PAYMENT_TIMING,
      apiValue: "SPLIT",
      title: "Pay part now, part later",
    },
    {
      type: PAY_OVER_TIME_PAYMENT_TIMING,
      apiValue: "PAY_OVER_TIME",
      title: "Pay over time",
    },
  ];
}

export function isPaymentTiming(value: unknown): value is PaymentTiming {
  return value === FULL_PAYMENT_TIMING
    || value === PARTIAL_PAYMENT_TIMING
    || value === PAY_OVER_TIME_PAYMENT_TIMING;
}

export function getBookingApiPaymentPlan(timing: PaymentTiming): BookingApiPaymentPlan {
  if (timing === FULL_PAYMENT_TIMING) return "FULL";
  if (timing === PARTIAL_PAYMENT_TIMING) return "SPLIT";
  if (timing === PAY_OVER_TIME_PAYMENT_TIMING) return "PAY_OVER_TIME";
  throw new Error("Unsupported payment timing");
}

export function getPaymentTimingTitle(timing: PaymentTiming): string {
  if (timing === FULL_PAYMENT_TIMING) return "Pay now";
  if (timing === PARTIAL_PAYMENT_TIMING) return "Pay part now, part later";
  if (timing === PAY_OVER_TIME_PAYMENT_TIMING) return "Pay over time";
  return "Payment timing unavailable";
}

export function getPaymentTimingSummary(timing: PaymentTiming, formattedTotal: string): string {
  const policy = getPaymentPolicy();
  const deferredSuffix = policy.onlinePaymentRequired ? "" : " (payment pending)";
  if (timing === FULL_PAYMENT_TIMING) return `Pay ${formattedTotal} now${deferredSuffix}`;
  if (timing === PARTIAL_PAYMENT_TIMING) return `Pay part now, part later${deferredSuffix}`;
  if (timing === PAY_OVER_TIME_PAYMENT_TIMING) return `Pay over time${deferredSuffix}`;
  return "Payment timing unavailable";
}
