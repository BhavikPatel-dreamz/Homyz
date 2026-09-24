"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatConvertedListingPrice, LISTING_CURRENCY, normalizeCurrencyCode } from "@/lib/currency";

const STORAGE_KEY = "homyz.display-currency";

export const DISPLAY_CURRENCIES = ["SAR", "USD", "EUR", "GBP", "CAD", "AUD", "INR"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

type CurrencyContextValue = {
  currency: DisplayCurrency;
  setCurrency: (currency: string) => void;
  formatPrice: (amountMinorUnits: number, sourceCurrency?: string | null, fractionDigits?: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function asDisplayCurrency(value: string | null | undefined): DisplayCurrency {
  const normalized = normalizeCurrencyCode(value);
  return DISPLAY_CURRENCIES.includes(normalized as DisplayCurrency)
    ? (normalized as DisplayCurrency)
    : LISTING_CURRENCY;
}

/**
 * Stores the traveller's display-currency preference once for the entire app.
 * Transaction data remains in its listing/booking currency; this context only
 * converts values shown in the interface.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(LISTING_CURRENCY);

  useEffect(() => {
    const savedCurrency = asDisplayCurrency(window.localStorage.getItem(STORAGE_KEY));
    if (savedCurrency === LISTING_CURRENCY) return;
    const timeout = window.setTimeout(() => setCurrencyState(savedCurrency), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const setCurrency = useCallback((nextCurrency: string) => {
    const next = asDisplayCurrency(nextCurrency);
    setCurrencyState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const formatPrice = useCallback(
    (amountMinorUnits: number, sourceCurrency: string | null | undefined = LISTING_CURRENCY, fractionDigits = 0) =>
      formatConvertedListingPrice(amountMinorUnits, sourceCurrency, currency, fractionDigits),
    [currency],
  );

  const value = useMemo(() => ({ currency, setCurrency, formatPrice }), [currency, setCurrency, formatPrice]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
