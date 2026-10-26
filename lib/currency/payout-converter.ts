/**
 * SAMA Official SAR-to-USD Payout Currency Conversion Engine
 *
 * In Saudi Arabia, the Saudi Riyal (SAR) has been officially pegged to the
 * US Dollar (USD) by the Saudi Central Bank (SAMA) since June 1986 at the
 * fixed exchange rate of:
 *
 *   1 USD = 3.7500 SAR  (1 SAR = 4/15 USD = 0.266667 USD)
 *
 * This engine performs deterministic integer minor-currency-unit (halalas to cents)
 * conversion. It preserves the original SAR booking entitlement in the immutable ledger,
 * while computing the exact USD settlement amount and documenting the exchange rate
 * and fee policy.
 */

export const SAMA_SAR_USD_PEG = 3.75;
export const SAMA_PEG_RATIO = "1 USD = 3.75 SAR";
export const SAMA_EXCHANGE_RATE_SOURCE = "SAMA_OFFICIAL_FIXED_PEG";

export interface PayoutConversionResult {
  /** Original amount in Saudi Riyal halalas (minor units) */
  originalSarHalalas: number;
  /** Converted amount in US Dollar cents (minor units) */
  settlementUsdCents: number;
  /** Official SAMA peg rate (3.75 SAR per 1 USD) */
  exchangeRatePeg: number;
  /** Effective rate: USD per 1 SAR (0.266667) */
  effectiveRate: number;
  /** Documented mathematical peg formula */
  pegFormula: string;
  /** Currency source identifier */
  rateSource: string;
  /** Documented platform or provider conversion fee in cents */
  feeCents: number;
  /** Converted timestamp */
  convertedAt: string;
}

/**
 * Converts Saudi Riyal halalas to US Dollar cents using the exact SAMA fixed peg.
 *
 * Formula:
 *   3.75 SAR = 375 halalas = 1.00 USD = 100 USD cents
 *   usdCents = Math.round((sarHalalas * 100) / 375) = Math.round((sarHalalas * 4) / 15)
 *
 * Examples:
 *   37,500 halalas (375.00 SAR)  => 10,000 USD cents ($100.00 USD)
 *   15,000 halalas (150.00 SAR)  => 4,000 USD cents ($40.00 USD)
 *   1,000 halalas (10.00 SAR)    => 267 USD cents ($2.67 USD)
 *   375 halalas (3.75 SAR)       => 100 USD cents ($1.00 USD)
 */
export function convertSarHalalasToUsdCents(
  sarHalalas: number,
  options: { feePercentage?: number } = {},
): PayoutConversionResult {
  const safeHalalas = Math.max(0, Math.round(Number(sarHalalas) || 0));

  // Exact rational conversion using integer multiplication: (sarHalalas * 4) / 15
  const rawUsdCents = Math.round((safeHalalas * 4) / 15);

  const feePct = options.feePercentage ?? 0;
  const feeCents = feePct > 0 ? Math.round((rawUsdCents * feePct) / 100) : 0;
  const settlementUsdCents = Math.max(0, rawUsdCents - feeCents);

  return {
    originalSarHalalas: safeHalalas,
    settlementUsdCents,
    exchangeRatePeg: SAMA_SAR_USD_PEG,
    effectiveRate: 4 / 15,
    pegFormula: `${SAMA_PEG_RATIO} (Exact integer arithmetic: (halalas * 4) / 15)`,
    rateSource: SAMA_EXCHANGE_RATE_SOURCE,
    feeCents,
    convertedAt: new Date().toISOString(),
  };
}

/**
 * Inverse conversion: Converts USD cents back to SAR halalas using the official SAMA peg.
 *
 * Formula:
 *   sarHalalas = Math.round((usdCents * 375) / 100) = Math.round((usdCents * 15) / 4)
 */
export function convertUsdCentsToSarHalalas(usdCents: number): number {
  const safeCents = Math.max(0, Math.round(Number(usdCents) || 0));
  return Math.round((safeCents * 15) / 4);
}

