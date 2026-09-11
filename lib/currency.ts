export const LISTING_CURRENCY = "SAR";

/** Formats a value already expressed in Saudi riyals. */
export function formatSar(amount: number, fractionDigits = 2): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${LISTING_CURRENCY} ${new Intl.NumberFormat("en", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safeAmount)}`;
}

/** Formats a listing amount persisted in halalas (minor currency units). */
export function formatSarFromHalalas(amount: number, fractionDigits = 2): string {
  return formatSar(amount / 100, fractionDigits);
}
