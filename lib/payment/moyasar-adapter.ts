import crypto from "node:crypto";
import { PaymentProvider, PaymentStatus, RefundStatus } from "@/generated/prisma/enums";
import type {
  PaymentProviderInterface,
  GatewayCapabilities,
  CreatePaymentParams,
  PaymentResult,
  PaymentVerificationResult,
  PaymentCaptureResult,
  PaymentVoidResult,
  CreateRefundParams,
  RefundResult,
  WebhookEventPayload,
} from "./provider-interface";

export class MoyasarAdapter implements PaymentProviderInterface {
  readonly providerName = PaymentProvider.MOYASAR;

  readonly capabilities: GatewayCapabilities = {
    createPayment: true,
    paymentAuthorization: true,
    delayedCapture: true,
    partialCapture: true,
    authorizationVoid: true,
    fullRefund: true,
    partialRefund: true,
    refundStatusWebhooks: true,
    paymentStatusWebhooks: true,
    marketplaceSplitPayments: false, // Standard Moyasar does not split to sub-merchants
    connectedHostAccounts: false, // Standard Moyasar has no host sub-account API
    hostTransfersPayouts: false, // Acquiring gateway only, requires Saudi corporate banking
    payoutStatusTracking: false,
    paymentReconciliation: true,
    idempotencyKeys: true,
  };

  private get apiKey(): string | undefined {
    return process.env.MOYASAR_API_KEY?.trim() || undefined;
  }

  private get webhookSecret(): string | undefined {
    return process.env.MOYASAR_WEBHOOK_SECRET?.trim() || undefined;
  }

  private get baseUrl(): string {
    return process.env.MOYASAR_API_URL?.trim() || "https://api.moyasar.com/v1";
  }

  /**
   * Verifies an incoming webhook HMAC signature.
   * Uses timingSafeEqual to guard against timing analysis attacks.
   */
  verifyWebhookSignature(payload: string, signature: string, secretOverride?: string): boolean {
    const secret = secretOverride || this.webhookSecret;
    if (!secret || !signature || !payload) {
      return false;
    }

    try {
      const cleanSignature = signature.trim().toLowerCase();
      const expectedHmac = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex")
        .toLowerCase();

      const signatureBuffer = Buffer.from(cleanSignature, "hex");
      const expectedBuffer = Buffer.from(expectedHmac, "hex");

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Parses and validates raw webhook event payload into standard structure.
   */
  parseWebhookEvent(payload: string | Record<string, unknown>): WebhookEventPayload | null {
    try {
      const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
      if (!parsed || typeof parsed !== "object") return null;

      const id = String(parsed.id || parsed.data?.id || "");
      const type = String(parsed.type || parsed.event || "payment.paid");
      const data = parsed.data || parsed;

      if (!id || !data || typeof data !== "object") return null;

      return {
        id,
        type,
        created_at: String(parsed.created_at || new Date().toISOString()),
        data: {
          id: String(data.id || id),
          status: String(data.status || "initiated").toLowerCase(),
          amount: Number(data.amount) || 0,
          currency: String(data.currency || "SAR").toUpperCase(),
          fee: typeof data.fee === "number" ? data.fee : undefined,
          description: typeof data.description === "string" ? data.description : undefined,
          source: data.source && typeof data.source === "object" ? data.source : undefined,
          metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : undefined,
          refunded: typeof data.refunded === "number" ? data.refunded : undefined,
          captured: typeof data.captured === "number" ? data.captured : undefined,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Maps Moyasar string status to Homyz PaymentStatus enum.
   */
  mapPaymentStatus(moyasarStatus: string): PaymentStatus {
    const s = moyasarStatus.toLowerCase().trim();
    switch (s) {
      case "paid":
      case "captured":
        return PaymentStatus.CAPTURED;
      case "authorized":
        return PaymentStatus.AUTHORIZED;
      case "failed":
        return PaymentStatus.FAILED;
      case "voided":
        return PaymentStatus.VOIDED;
      case "refunded":
        return PaymentStatus.REFUNDED;
      case "partially_refunded":
        return PaymentStatus.PARTIALLY_REFUNDED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!this.apiKey) {
      return {
        success: false,
        providerPaymentId: "",
        provider: this.providerName,
        status: PaymentStatus.FAILED,
        amount: params.amount,
        currency: params.currency,
        capturedAmount: 0,
        errorCode: "MOYASAR_NOT_CONFIGURED",
        errorMessage: "Payment provider credentials are not configured.",
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency,
          description: params.description,
          callback_url: params.callbackUrl,
          source: params.source,
          capture: params.capture !== false,
          metadata: {
            ...params.metadata,
            bookingId: params.bookingId,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          providerPaymentId: data.id || "",
          provider: this.providerName,
          status: PaymentStatus.FAILED,
          amount: params.amount,
          currency: params.currency,
          capturedAmount: 0,
          errorCode: data.type || "PAYMENT_REJECTED",
          errorMessage: data.message || "Failed to create payment with provider.",
          rawResponse: data,
        };
      }

      const status = this.mapPaymentStatus(data.status);
      const isCaptured = status === PaymentStatus.CAPTURED;

      return {
        success: status === PaymentStatus.CAPTURED || status === PaymentStatus.AUTHORIZED,
        providerPaymentId: data.id,
        provider: this.providerName,
        status,
        amount: data.amount,
        currency: data.currency,
        capturedAmount: isCaptured ? data.amount : 0,
        paymentMethod: data.source?.type,
        paymentMethodDetails: data.source,
        fee: data.fee,
        rawResponse: data,
      };
    } catch (err: unknown) {
      return {
        success: false,
        providerPaymentId: "",
        provider: this.providerName,
        status: PaymentStatus.FAILED,
        amount: params.amount,
        currency: params.currency,
        capturedAmount: 0,
        errorCode: "PROVIDER_NETWORK_ERROR",
        errorMessage: err instanceof Error ? err.message : "Provider request failed.",
      };
    }
  }

  async verifyPayment(providerPaymentId: string): Promise<PaymentVerificationResult> {
    if (!this.apiKey) {
      throw new Error("Moyasar API key is unconfigured.");
    }

    const response = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(providerPaymentId)}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to verify payment ${providerPaymentId} with provider.`);
    }

    const data = await response.json();
    const status = this.mapPaymentStatus(data.status);

    return {
      verified: true,
      providerPaymentId: data.id,
      status,
      amount: data.amount,
      currency: data.currency,
      capturedAmount: data.status === "paid" ? data.amount : (data.captured || 0),
      refundedAmount: data.refunded || 0,
      paymentMethod: data.source?.type,
      failureReason: data.source?.message,
    };
  }

  async capturePayment(providerPaymentId: string, amount?: number): Promise<PaymentCaptureResult> {
    if (!this.apiKey) {
      return {
        success: false,
        providerPaymentId,
        capturedAmount: 0,
        currency: "SAR",
        status: PaymentStatus.FAILED,
        errorCode: "NOT_CONFIGURED",
        errorMessage: "Payment provider credentials are not configured.",
      };
    }

    const body: Record<string, unknown> = {};
    if (typeof amount === "number" && amount > 0) body.amount = amount;

    const response = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(providerPaymentId)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        providerPaymentId,
        capturedAmount: 0,
        currency: "SAR",
        status: PaymentStatus.AUTHORIZED,
        errorCode: data.type || "CAPTURE_FAILED",
        errorMessage: data.message || "Failed to capture authorization.",
      };
    }

    return {
      success: true,
      providerPaymentId: data.id,
      capturedAmount: data.amount,
      currency: data.currency,
      status: PaymentStatus.CAPTURED,
    };
  }

  async voidAuthorization(providerPaymentId: string): Promise<PaymentVoidResult> {
    if (!this.apiKey) {
      return {
        success: false,
        providerPaymentId,
        status: PaymentStatus.FAILED,
        errorCode: "NOT_CONFIGURED",
        errorMessage: "Payment provider credentials are not configured.",
      };
    }

    const response = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(providerPaymentId)}/void`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        providerPaymentId,
        status: PaymentStatus.AUTHORIZED,
        errorCode: data.type || "VOID_FAILED",
        errorMessage: data.message || "Failed to void authorization.",
      };
    }

    return {
      success: true,
      providerPaymentId: data.id,
      status: PaymentStatus.VOIDED,
    };
  }

  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    if (!this.apiKey) {
      return {
        success: false,
        providerRefundId: "",
        providerPaymentId: params.providerPaymentId,
        amount: params.amount,
        currency: params.currency,
        status: RefundStatus.FAILED,
        errorCode: "NOT_CONFIGURED",
        errorMessage: "Payment provider credentials are not configured.",
      };
    }

    const response = await fetch(
      `${this.baseUrl}/payments/${encodeURIComponent(params.providerPaymentId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: params.amount,
          reason: params.reason,
        }),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        providerRefundId: "",
        providerPaymentId: params.providerPaymentId,
        amount: params.amount,
        currency: params.currency,
        status: RefundStatus.FAILED,
        errorCode: data.type || "REFUND_FAILED",
        errorMessage: data.message || "Failed to create refund with provider.",
        rawResponse: data,
      };
    }

    return {
      success: true,
      providerRefundId: data.id,
      providerPaymentId: params.providerPaymentId,
      amount: data.amount,
      currency: data.currency,
      status: RefundStatus.SUCCEEDED,
      rawResponse: data,
    };
  }
}

export const moyasarAdapter = new MoyasarAdapter();

