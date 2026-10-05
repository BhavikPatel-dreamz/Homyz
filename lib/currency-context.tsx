"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  convertCurrency,
  formatConvertedListingPrice,
  LISTING_CURRENCY,
  normalizeCurrencyCode,
} from "@/lib/currency";

const STORAGE_KEY = "homyz.display-currency";
const COOKIE_KEY = "homyz_display_currency";

export const DISPLAY_CURRENCIES = [
  "SAR",
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "INR",
] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export type CurrencyContextValue = {
  currency: DisplayCurrency;
  displayCurrency: DisplayCurrency;
  setCurrency: (currency: string) => void;
  setDisplayCurrency: (currency: string) => void;
  convert: (amount: number, sourceCurrency?: string | null) => number;
  formatPrice: (
    amountMinorUnits: number,
    sourceCurrency?: string | null,
    fractionDigits?: number,
  ) => string;
  formatMoney: (
    amountMinorUnits: number,
    sourceCurrency?: string | null,
    fractionDigits?: number,
  ) => string;
  format: (
    amountMinorUnits: number,
    sourceCurrency?: string | null,
    fractionDigits?: number,
  ) => string;
  formatMajor: (
    amountMajor: number,
    sourceCurrency?: string | null,
    fractionDigits?: number,
  ) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function asDisplayCurrency(value: string | null | undefined): DisplayCurrency {
  const normalized = normalizeCurrencyCode(value);
  return DISPLAY_CURRENCIES.includes(normalized as DisplayCurrency)
    ? (normalized as DisplayCurrency)
    : LISTING_CURRENCY;
}

function getInitialDisplayCurrency(): DisplayCurrency {
  if (typeof window === "undefined") return LISTING_CURRENCY;
  try {
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (fromStorage) return asDisplayCurrency(fromStorage);
    const cookieMatch = document.cookie.match(
      new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`),
    );
    if (cookieMatch?.[1]) return asDisplayCurrency(cookieMatch[1]);
  } catch {
    // Browser storage restriction fallback
  }
  return LISTING_CURRENCY;
}

/**
 * Stores the user's display-currency preference globally once for the entire application.
 * All property cards, pricing pages, calendars, and quotes DISPLAY in this selected currency.
 * Internal transaction & database records remain stored in their authoritative native currency.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(LISTING_CURRENCY);

  useEffect(() => {
    const saved = getInitialDisplayCurrency();
    if (saved === LISTING_CURRENCY) return;
    const timeout = window.setTimeout(() => setCurrencyState(saved), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // Multi-tab synchronization
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setCurrencyState(asDisplayCurrency(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setCurrency = useCallback((nextCurrency: string) => {
    const next = asDisplayCurrency(nextCurrency);
    setCurrencyState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Storage unavailable fallback
    }
  }, []);

  const convert = useCallback(
    (amount: number, sourceCurrency?: string | null) =>
      convertCurrency(amount, sourceCurrency ?? LISTING_CURRENCY, currency),
    [currency],
  );

  const formatPrice = useCallback(
    (
      amountMinorUnits: number,
      sourceCurrency: string | null | undefined = LISTING_CURRENCY,
      fractionDigits = 0,
    ) =>
      formatConvertedListingPrice(
        amountMinorUnits,
        sourceCurrency,
        currency,
        fractionDigits,
      ),
    [currency],
  );

  const formatMajor = useCallback(
    (
      amountMajor: number,
      sourceCurrency: string | null | undefined = LISTING_CURRENCY,
      fractionDigits = 0,
    ) =>
      formatConvertedListingPrice(
        amountMajor * 100,
        sourceCurrency,
        currency,
        fractionDigits,
      ),
    [currency],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      displayCurrency: currency,
      setCurrency,
      setDisplayCurrency: setCurrency,
      convert,
      formatPrice,
      formatMoney: formatPrice,
      format: formatPrice,
      formatMajor,
    }),
    [currency, setCurrency, convert, formatPrice, formatMajor],
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
