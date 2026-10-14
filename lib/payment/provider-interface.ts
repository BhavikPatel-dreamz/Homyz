import type { PaymentProvider, PaymentStatus, RefundStatus } from "@/generated/prisma/enums";

export interface GatewayCapabilities {
  /** Can create payment charge or checkout session */
  createPayment: boolean;
  /** Can pre-authorize without immediate capture */
  paymentAuthorization: boolean;
  /** Supports delayed capture within an authorization window */
  delayedCapture: boolean;
  /** Supports capturing less than the authorized amount */
  partialCapture: boolean;
  /** Supports releasing/voiding an uncaptured authorization */
  authorizationVoid: boolean;
  /** Supports 100% full refund of captured charge */
  fullRefund: boolean;
  /** Supports partial refund of captured charge */
  partialRefund: boolean;
  /** Sends asynchronous webhooks for refund status changes */
  refundStatusWebhooks: boolean;
  /** Sends asynchronous webhooks for payment status changes */
  paymentStatusWebhooks: boolean;
  /** Supports multi-vendor split payments at capture time */
  marketplaceSplitPayments: boolean;
  /** Supports connecting third-party host bank/merchant accounts */
  connectedHostAccounts: boolean;
  /** Supports direct platform-to-host bank payouts/transfers */
  hostTransfersPayouts: boolean;
  /** Can track payout status via gateway API */
  payoutStatusTracking: boolean;
  /** Supports automated settlement and reconciliation reports */
  paymentReconciliation: boolean;
  /** Supports gateway-level idempotency keys on requests */
  idempotencyKeys: boolean;
}

export type CapabilityVerificationStatus =
  | "VERIFIED_SUPPORTED"
  | "SUPPORTED_UNTESTED"
  | "UNSUPPORTED"
  | "REQUIRES_PROVIDER_ACTIVATION"
  | "REQUIRES_MORE_INFORMATION";

export interface GatewayCapabilityMatrixEntry {
  capability: keyof GatewayCapabilities;
  status: CapabilityVerificationStatus;
  notes: string;
}

/**
 * Authoritative capability matrix for Moyasar (SAMA-regulated payment gateway in Saudi Arabia).
 * Distinguishes verified payment gateway features from marketplace transfer limitations.
 */
export const MOYASAR_CAPABILITY_MATRIX: GatewayCapabilityMatrixEntry[] = [
  {
    capability: "createPayment",
    status: "VERIFIED_SUPPORTED",
    notes: "Supported via Moyasar REST API (/v1/payments) for mada, Visa, Mastercard, and Apple Pay.",
  },
  {
    capability: "paymentAuthorization",
    status: "VERIFIED_SUPPORTED",
    notes: "Supported via 'capture: false' parameter at payment creation on credit cards and mada.",
  },
  {
    capability: "delayedCapture",
    status: "VERIFIED_SUPPORTED",
    notes: "Supported via POST /v1/payments/{id}/capture within the standard 7-day card authorization window.",
  },
  {
    capability: "partialCapture",
    status: "VERIFIED_SUPPORTED",
    notes: "Supported via POST /v1/payments/{id}/capture with explicit integer amount parameter.",
  },
  {
    capability: "authorizationVoid",
    status: "VERIFIED_SUPPORTED",
    notes: "Supported via POST /v1/payments/{id}/void to release authorization hold before capture.",
  },
  {
    capability: "fullRefund",
    status: "VERIFIED_SUPPORTED",
    notes: "Supported via POST /v1/payments/{id}/refund for settled/captured charges.",
  },
  {
    capability: "partialRefund",
    status: "VERIFIED_SUPPORTED",
    notes: "Supported via POST /v1/payments/{id}/refund with amount parameter in minor units (halalas).",
  },
  {
    capability: "refundStatusWebhooks",
    status: "VERIFIED_SUPPORTED",
    notes: "Supported via webhook event 'payment.refunded' with HMAC-SHA256 signature verification.",
  },
  {
    capability: "paymentStatusWebhooks",
    status: "VERIFIED_SUPPORTED",
    notes: "Supported via webhook events: 'payment.paid', 'payment.failed', 'payment.captured'.",
  },
  {
    capability: "marketplaceSplitPayments",
    status: "UNSUPPORTED",
    notes: "Standard Moyasar merchant accounts do not support automatic split payments to host sub-accounts.",
  },
  {
    capability: "connectedHostAccounts",
    status: "UNSUPPORTED",
    notes: "Moyasar does not provide an automated Stripe Connect-style sub-merchant onboarding API in KSA.",
  },
  {
    capability: "hostTransfersPayouts",
    status: "UNSUPPORTED",
    notes: "Moyasar is an acquiring gateway only. Host payouts require corporate banking B2B (SARIE) integration.",
  },
  {
    capability: "payoutStatusTracking",
    status: "UNSUPPORTED",
    notes: "Cannot track host payouts through Moyasar. Tracked authoritatively in Homyz admin settlement layer.",
  },
  {
    capability: "paymentReconciliation",
    status: "SUPPORTED_UNTESTED",
    notes: "Settlement invoices and invoices API (/v1/invoices) are supported by Moyasar but require live merchant setup.",
  },
  {
    capability: "idempotencyKeys",
    status: "SUPPORTED_UNTESTED",
    notes: "Moyasar supports request deduplication; Homyz enforces local database uniqueness on idempotencyKey.",
  },
];

export interface CreatePaymentParams {
  bookingId: string;
  amount: number; // minor units (cents/halalas)
  currency: string;
  description: string;
  source: {
    type: "creditcard" | "applepay" | "mada" | "token";
    token?: string;
    [key: string]: unknown;
  };
  callbackUrl?: string;
  capture?: boolean; // false for authorization hold
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface PaymentResult {
  success: boolean;
  providerPaymentId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  capturedAmount: number;
  paymentMethod?: string;
  paymentMethodDetails?: Record<string, unknown>;
  fee?: number;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: unknown;
}

export interface PaymentVerificationResult {
  verified: boolean;
  providerPaymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  capturedAmount: number;
  refundedAmount: number;
  paymentMethod?: string;
  failureReason?: string;
}

export interface PaymentCaptureResult {
  success: boolean;
  providerPaymentId: string;
  capturedAmount: number;
  currency: string;
  status: PaymentStatus;
  errorCode?: string;
  errorMessage?: string;
}

export interface PaymentVoidResult {
  success: boolean;
  providerPaymentId: string;
  status: PaymentStatus;
  errorCode?: string;
  errorMessage?: string;
}

export interface CreateRefundParams {
  bookingId: string;
  providerPaymentId: string;
  amount: number; // minor units (cents/halalas)
  currency: string;
  reason: string;
  idempotencyKey?: string;
}

export interface RefundResult {
  success: boolean;
  providerRefundId: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: unknown;
}

export interface WebhookEventPayload {
  id: string;
  type: string;
  created_at: string;
  data: {
    id: string;
    status: string;
    amount: number; // minor units
    currency: string;
    fee?: number;
    description?: string;
    source?: {
      type: string;
      company?: string;
      name?: string;
      number?: string;
      message?: string;
      [key: string]: unknown;
    };
    metadata?: Record<string, unknown>;
    refunded?: number;
    refunded_at?: string;
    captured?: number;
    captured_at?: string;
    voided_at?: string;
    [key: string]: unknown;
  };
}

export interface PaymentProviderInterface {
  readonly providerName: PaymentProvider;
  readonly capabilities: GatewayCapabilities;

  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
  verifyPayment(providerPaymentId: string): Promise<PaymentVerificationResult>;
  capturePayment(providerPaymentId: string, amount?: number): Promise<PaymentCaptureResult>;
  voidAuthorization(providerPaymentId: string): Promise<PaymentVoidResult>;
  createRefund(params: CreateRefundParams): Promise<RefundResult>;
  verifyWebhookSignature(payload: string, signature: string, secret?: string): boolean;
  parseWebhookEvent(payload: string | Record<string, unknown>): WebhookEventPayload | null;
}

