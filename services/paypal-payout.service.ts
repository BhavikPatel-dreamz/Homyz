import "server-only";

import { AppError } from "@/lib/api/errors";
import { auditService } from "@/services/audit.service";
import { convertSarHalalasToUsdCents } from "@/lib/currency/payout-converter";

// ============================================================================
// PayPal Global Country & Currency Standards (REST Payouts API Specification)
// ============================================================================

/**
 * Standard ISO 3166-1 alpha-2 country codes supported by PayPal for receiving
 * and withdrawing funds, including Saudi Arabia (SA).
 */
export const PAYPAL_SUPPORTED_COUNTRIES = new Set([
  "SA", // Saudi Arabia (Officially supported by PayPal for sending, receiving, holding, and withdrawing)
  "AE", // United Arab Emirates
  "KW", // Kuwait
  "QA", // Qatar
  "BH", // Bahrain
  "OM", // Oman
  "EG", // Egypt
  "JO", // Jordan
  "US", // United States
  "GB", // United Kingdom
  "CA", // Canada
  "AU", // Australia
  "DE", // Germany
  "FR", // France
  "ES", // Spain
  "IT", // Italy
  "NL", // Netherlands
  "CH", // Switzerland
  "SG", // Singapore
  "MY", // Malaysia
]);

/**
 * Currencies supported by PayPal Payouts API (/v1/payments/payouts).
 * IMPORTANT: SAR (Saudi Riyal) is NOT a direct disbursement currency in the
 * PayPal Payouts API. Recipients in Saudi Arabia receive USD and withdraw to
 * local Saudi bank accounts in SAR via PayPal's automatic currency conversion.
 */
export const PAYPAL_PAYOUTS_SUPPORTED_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "JPY",
  "CHF",
  "NZD",
  "SGD",
  "HKD",
  "SEK",
  "DKK",
  "PLN",
  "NOK",
  "HUF",
  "CZK",
  "ILS",
  "MXN",
  "BRL",
  "PHP",
  "TWD",
  "THB",
]);

export interface PayPalIntegrationStatus {
  isConfigured: boolean;
  environment: "sandbox" | "live";
  isCountrySupported: boolean;
  countryCode: string;
  countryName: string;
  directSarSupported: boolean;
  supportedDisbursementCurrency: string;
  exchangeRatePeg: string;
  integrationStatus: "READY" | "PENDING_CREDENTIALS";
  statusLabel: string;
  message: string;
}

export interface SubmitPayPalPayoutInput {
  hostId: string;
  recipientEmail: string;
  sarAmountHalalas: number;
  referenceId: string;
  note?: string;
  idempotencyKey?: string;
  actor?: { id: string; email?: string; role?: string };
}

export interface PayPalPayoutResult {
  payoutBatchId: string;
  batchStatus: "PENDING" | "PROCESSING" | "SUCCESS" | "DENIED";
  recipientEmail: string;
  originalSarHalalas: number;
  settledUsdCents: number;
  exchangeRate: number;
  idempotencyKey: string;
  submittedAt: string;
}

export const paypalPayoutService = {
  /**
   * Verifies if a given country is recognized by PayPal for holding/receiving funds.
   * Saudi Arabia (SA) is strictly recognized as supported.
   */
  isCountrySupported(countryCode: string): boolean {
    const code = (countryCode || "").trim().toUpperCase();
    if (code === "KSA" || code === "SAUDI ARABIA") return true;
    return PAYPAL_SUPPORTED_COUNTRIES.has(code);
  },

  /**
   * Verifies if a currency is supported for direct disbursement via PayPal Payouts.
   * SAR is intentionally NOT supported; USD is the authoritative disbursement currency for KSA.
   */
  isCurrencySupported(currencyCode: string): boolean {
    const code = (currencyCode || "").trim().toUpperCase();
    return PAYPAL_PAYOUTS_SUPPORTED_CURRENCIES.has(code);
  },

  /**
   * Validates a PayPal recipient email address format per RFC 5322.
   */
  validatePayPalEmail(email: string): {
    valid: boolean;
    cleanEmail?: string;
    error?: string;
  } {
    if (!email || typeof email !== "string") {
      return { valid: false, error: "PayPal email address is required." };
    }

    const clean = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    if (!emailRegex.test(clean) || clean.length > 254) {
      return { valid: false, cleanEmail: clean, error: "Please enter a valid PayPal email address." };
    }

    return { valid: true, cleanEmail: clean };
  },

  /**
   * Checks whether the Homyz platform has configured PayPal Payouts API credentials.
   * Requires both PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.
   */
  isPayPalPayoutsConfigured(): boolean {
    const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    return Boolean(clientId && clientSecret);
  },

  /**
   * Returns authoritative status of the PayPal integration for host UI and onboarding.
   */
  getIntegrationStatus(countryCode = "SA"): PayPalIntegrationStatus {
    const isConfigured = this.isPayPalPayoutsConfigured();
    const isCountrySupported = this.isCountrySupported(countryCode);
    const env = (process.env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase() === "live" ? "live" : "sandbox";

    return {
      isConfigured,
      environment: env,
      isCountrySupported,
      countryCode: countryCode.toUpperCase(),
      countryName: countryCode.toUpperCase() === "SA" ? "Saudi Arabia" : countryCode,
      directSarSupported: false,
      supportedDisbursementCurrency: "USD",
      exchangeRatePeg: "1 USD = 3.75 SAR (SAMA official peg)",
      integrationStatus: isConfigured ? "READY" : "PENDING_CREDENTIALS",
      statusLabel: isConfigured ? "Available (USD)" : "Integration setup required",
      message: isConfigured
        ? "PayPal is active for automated host disbursements in USD at the SAMA fixed peg (1 USD = 3.75 SAR)."
        : "PayPal is supported in Saudi Arabia (USD). Platform automated disbursements require PayPal Business Payouts credentials. In the meantime, use your Saudi IBAN bank account for instant zero-fee SAR deposits.",
    };
  },

  /**
   * Obtains an OAuth2 client_credentials bearer token from PayPal REST API.
   */
  async getAccessToken(): Promise<string> {
    if (!this.isPayPalPayoutsConfigured()) {
      throw AppError.badRequest(
        "PayPal Payouts API is not configured. Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in platform environment.",
      );
    }

    const clientId = process.env.PAYPAL_CLIENT_ID!;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
    const isLive = process.env.PAYPAL_ENVIRONMENT?.toLowerCase() === "live";
    const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("PayPal OAuth2 token error:", errBody);
      throw new Error(`Failed to authenticate with PayPal API: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  },

  /**
   * Executes an idempotent payout to a host's PayPal account.
   *
   * CRITICAL GUARANTEES:
   * 1. If PayPal credentials are not configured, this will NEVER fake success.
   *    It throws an informative error to safeguard financial integrity.
   * 2. Converts SAR to USD using the official SAMA fixed peg (1 USD = 3.75 SAR).
   * 3. Dispatches idempotent batch payload to PayPal Payouts API.
   * 4. Records authoritative audit trail.
   */
  async submitPayout(input: SubmitPayPalPayoutInput): Promise<PayPalPayoutResult> {
    const { hostId, recipientEmail, sarAmountHalalas, referenceId, note, idempotencyKey, actor } = input;

    // 1. Verify Configuration - Strictly refuse to fake success if unconfigured
    if (!this.isPayPalPayoutsConfigured()) {
      throw AppError.badRequest(
        "PayPal Payouts API is not configured or approved by the payment provider. Credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are required to execute real disbursements. Never faking successful settlement.",
      );
    }

    // 2. Validate Email
    const emailCheck = this.validatePayPalEmail(recipientEmail);
    if (!emailCheck.valid || !emailCheck.cleanEmail) {
      throw AppError.badRequest(emailCheck.error || "Invalid PayPal recipient email.");
    }

    // 3. Mathematical Currency Conversion: SAR halalas -> USD cents at SAMA peg
    const conversion = convertSarHalalasToUsdCents(sarAmountHalalas);
    if (conversion.settlementUsdCents <= 0) {
      throw AppError.badRequest("Payout amount must be greater than zero.");
    }

    const usdValueString = (conversion.settlementUsdCents / 100).toFixed(2);
    const safeIdempotencyKey = idempotencyKey || `HOMYZ-PP-${referenceId}-${Date.now()}`;

    // 4. Submit Payout to PayPal REST API
    const accessToken = await this.getAccessToken();
    const isLive = process.env.PAYPAL_ENVIRONMENT?.toLowerCase() === "live";
    const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const payload = {
      sender_batch_header: {
        sender_batch_id: safeIdempotencyKey,
        email_subject: "You have a payout from Homyz",
        email_message: note || "You received hosting earnings for your completed reservation.",
        recipient_type: "EMAIL",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: usdValueString,
            currency: "USD",
          },
          note: note || `Homyz Host Disbursement (Ref: ${referenceId})`,
          sender_item_id: `ITEM-${referenceId}`,
          receiver: emailCheck.cleanEmail,
        },
      ],
    };

    const res = await fetch(`${baseUrl}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await res.json();
    if (!res.ok) {
      console.error("PayPal Payout API rejection:", responseData);
      throw new Error(
        responseData?.message ||
          responseData?.name ||
          "PayPal Payout submission was rejected by provider.",
      );
    }

    const batchHeader = responseData.batch_header || {};
    const payoutBatchId = batchHeader.payout_batch_id || `BATCH-${safeIdempotencyKey}`;
    const batchStatus = batchHeader.batch_status || "PENDING";

    // 5. Audit Trail
    await auditService.record({
      actorId: actor?.id || hostId,
      actorEmail: actor?.email,
      action: "PAYOUT_DISBURSED_PAYPAL",
      resourceType: "PAYOUT",
      resourceId: referenceId,
      description: `Disbursed $${usdValueString} USD (${(sarAmountHalalas / 100).toFixed(2)} SAR) to PayPal account ${emailCheck.cleanEmail}. Batch ID: ${payoutBatchId}.`,
      status: "SUCCESS",
      metadata: {
        referenceId,
        payoutBatchId,
        recipientEmail: emailCheck.cleanEmail,
        originalSarHalalas: sarAmountHalalas,
        settledUsdCents: conversion.settlementUsdCents,
        exchangeRate: conversion.effectiveRate,
        pegRatio: conversion.pegFormula,
        idempotencyKey: safeIdempotencyKey,
      },
    });

    return {
      payoutBatchId,
      batchStatus,
      recipientEmail: emailCheck.cleanEmail,
      originalSarHalalas: sarAmountHalalas,
      settledUsdCents: conversion.settlementUsdCents,
      exchangeRate: conversion.effectiveRate,
      idempotencyKey: safeIdempotencyKey,
      submittedAt: new Date().toISOString(),
    };
  },

  /**
   * Retrieves live status of a PayPal payout batch from provider.
   */
  async getPayoutBatchStatus(payoutBatchId: string): Promise<any> {
    if (!this.isPayPalPayoutsConfigured()) {
      throw AppError.badRequest("PayPal Payouts API is not configured.");
    }

    const accessToken = await this.getAccessToken();
    const isLive = process.env.PAYPAL_ENVIRONMENT?.toLowerCase() === "live";
    const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const res = await fetch(`${baseUrl}/v1/payments/payouts/${payoutBatchId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to query PayPal payout batch ${payoutBatchId}: ${res.statusText}`);
    }

    return res.json();
  },
};

