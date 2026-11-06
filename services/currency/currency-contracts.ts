export type SupportedCurrency = "SAR" | "USD" | "EUR" | "AED" | "GBP";

export type RateFreshnessStatus = "LIVE" | "CACHED" | "STALE_FALLBACK";

export interface ExchangeRateSnapshot {
  baseCurrency: SupportedCurrency;
  rates: Record<SupportedCurrency, number>; // Rate: 1 unit of baseCurrency = rates[TARGET] units of TARGET
  fetchedAt: string; // ISO timestamp
  source: string; // "SAMA_OFFICIAL_PEG" | "OPEN_EXCHANGE_RATES" | "ECB_REFERENCE" | "FALLBACK_CACHE"
  isStale: boolean;
  ttlSeconds: number;
}

export interface CurrencyConversionResult {
  originalAmountCents: number;
  originalCurrency: SupportedCurrency;
  convertedAmountCents: number;
  targetCurrency: SupportedCurrency;
  exchangeRateUsed: number;
  rateDateKey: string;
  rateTimestamp: string;
  rateSource: string;
  isStaleRate: boolean;
  precision: number; // minor units (2 for SAR/USD/EUR/GBP/AED)
}

export interface ExchangeRateProvider {
  name: string;
  getLatestRates(base?: SupportedCurrency): Promise<ExchangeRateSnapshot>;
  getHistoricalRates(dateKey: string, base?: SupportedCurrency): Promise<ExchangeRateSnapshot>;
}

