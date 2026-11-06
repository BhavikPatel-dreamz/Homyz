import { defaultExchangeRateProvider } from "./exchange-rate-provider";
import type {
  CurrencyConversionResult,
  ExchangeRateProvider,
  ExchangeRateSnapshot,
  RateFreshnessStatus,
  SupportedCurrency,
} from "./currency-contracts";

const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["SAR", "USD", "EUR", "AED", "GBP"];

export class ExchangeRateService {
  private provider: ExchangeRateProvider;
  private cachedSnapshot: ExchangeRateSnapshot | null = null;
  private cacheExpiresAt = 0;

  constructor(provider: ExchangeRateProvider = defaultExchangeRateProvider) {
    this.provider = provider;
  }

  /**
   * Retrieves active exchange rate snapshot with TTL caching.
   */
  async getRates(): Promise<ExchangeRateSnapshot> {
    const now = Date.now();
    if (this.cachedSnapshot && now < this.cacheExpiresAt) {
      return this.cachedSnapshot;
    }

    try {
      const fresh = await this.provider.getLatestRates("SAR");
      this.cachedSnapshot = fresh;
      this.cacheExpiresAt = now + (fresh.ttlSeconds || 3600) * 1000;
      return fresh;
    } catch (err) {
      if (this.cachedSnapshot) {
        // Return stale cache if provider fails
        return {
          ...this.cachedSnapshot,
          isStale: true,
          source: "FALLBACK_CACHE",
        };
      }
      throw err;
    }
  }

  /**
   * Retrieves status and freshness telemetry for administrative UI.
   */
  async getRatesStatus(): Promise<{
    baseCurrency: SupportedCurrency;
    rates: Record<SupportedCurrency, number>;
    freshness: RateFreshnessStatus;
    lastUpdated: string;
    isStale: boolean;
    supportedCurrencies: SupportedCurrency[];
  }> {
    const snapshot = await this.getRates();
    const isCached = Date.now() < this.cacheExpiresAt;
    const freshness: RateFreshnessStatus = snapshot.isStale
      ? "STALE_FALLBACK"
      : isCached
        ? "CACHED"
        : "LIVE";

    return {
      baseCurrency: snapshot.baseCurrency,
      rates: snapshot.rates,
      freshness,
      lastUpdated: snapshot.fetchedAt,
      isStale: snapshot.isStale,
      supportedCurrencies: SUPPORTED_CURRENCIES,
    };
  }

  /**
   * Converts an amount in minor units (cents / halalas) safely between currencies.
   * Preserves integer cents arithmetic without uncontrolled floating-point drift.
   */
  async convertAmount(params: {
    amountCents: number;
    fromCurrency: string;
    toCurrency: string;
    rateDateKey?: string;
  }): Promise<CurrencyConversionResult> {
    const from = (params.fromCurrency.toUpperCase() as SupportedCurrency) || "SAR";
    const to = (params.toCurrency.toUpperCase() as SupportedCurrency) || "SAR";
    const amountCents = Math.round(params.amountCents);

    if (from === to) {
      return {
        originalAmountCents: amountCents,
        originalCurrency: from,
        convertedAmountCents: amountCents,
        targetCurrency: to,
        exchangeRateUsed: 1.0,
        rateDateKey: params.rateDateKey || new Date().toISOString().slice(0, 10),
        rateTimestamp: new Date().toISOString(),
        rateSource: "IDENTITY",
        isStaleRate: false,
        precision: 2,
      };
    }

    const snapshot = params.rateDateKey
      ? await this.provider.getHistoricalRates(params.rateDateKey, "SAR")
      : await this.getRates();

    const fromRateToSar = snapshot.rates[from] || 1.0;
    const toRateFromSar = snapshot.rates[to] || 1.0;

    // Direct effective cross rate: (1 unit of FROM) = (effectiveRate units of TO)
    // fromRateToSar is units of FROM per 1 SAR => SAR = amount / fromRateToSar
    // toRateFromSar is units of TO per 1 SAR => TO = SAR * toRateFromSar
    const effectiveCrossRate = toRateFromSar / fromRateToSar;

    const convertedCents = Math.round(amountCents * effectiveCrossRate);

    return {
      originalAmountCents: amountCents,
      originalCurrency: from,
      convertedAmountCents: convertedCents,
      targetCurrency: to,
      exchangeRateUsed: Math.round(effectiveCrossRate * 100000) / 100000,
      rateDateKey: params.rateDateKey || snapshot.fetchedAt.slice(0, 10),
      rateTimestamp: snapshot.fetchedAt,
      rateSource: snapshot.source,
      isStaleRate: snapshot.isStale,
      precision: 2,
    };
  }
}

export const exchangeRateService = new ExchangeRateService();

