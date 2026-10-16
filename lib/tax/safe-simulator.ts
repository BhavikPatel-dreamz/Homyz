import type { CalculatedTaxItem, TaxCalculationResult } from "./types";

export function getSafeTaxItems(
  value?: Partial<TaxCalculationResult> | CalculatedTaxItem[] | null
): CalculatedTaxItem[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Array.isArray(value.taxes) ? value.taxes : [];
}
