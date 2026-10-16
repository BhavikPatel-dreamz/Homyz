"use client";

import { useCurrency } from "@/lib/currency-context";

type CurrencyPriceProps = {
  amountMinorUnits: number;
  sourceCurrency?: string | null;
  fractionDigits?: number;
};

/** A currency-aware price for server-rendered pages. */
export function CurrencyPrice({ amountMinorUnits, sourceCurrency, fractionDigits = 0 }: CurrencyPriceProps) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(amountMinorUnits, sourceCurrency, fractionDigits)}</>;
}
