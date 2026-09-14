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

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // GCC & Middle East
  saudiarabia: "SAR",
  sa: "SAR",
  ksa: "SAR",
  unitedarabemirates: "AED",
  uae: "AED",
  ae: "AED",
  dubai: "AED",
  kuwait: "KWD",
  kw: "KWD",
  qatar: "QAR",
  qa: "QAR",
  bahrain: "BHD",
  bh: "BHD",
  oman: "OMR",
  om: "OMR",
  egypt: "EGP",
  eg: "EGP",
  jordan: "JOD",
  jo: "JOD",

  // Americas
  unitedstates: "USD",
  usa: "USD",
  us: "USD",
  canada: "CAD",
  ca: "CAD",

  // Europe
  unitedkingdom: "GBP",
  uk: "GBP",
  gb: "GBP",
  greatbritain: "GBP",
  england: "GBP",
  scotland: "GBP",
  france: "EUR",
  fr: "EUR",
  germany: "EUR",
  de: "EUR",
  italy: "EUR",
  it: "EUR",
  spain: "EUR",
  es: "EUR",
  netherlands: "EUR",
  nl: "EUR",
  switzerland: "CHF",
  ch: "CHF",

  // Asia Pacific
  australia: "AUD",
  au: "AUD",
  india: "INR",
  in: "INR",
  japan: "JPY",
  jp: "JPY",
};

/**
 * Returns the appropriate ISO currency code for a given country name or alpha code.
 * Defaults to "SAR" when country is unknown or omitted.
 */
export function getCurrencyForCountry(country?: string | null): string {
  if (!country || typeof country !== "string") return LISTING_CURRENCY;
  const normalized = country.toLowerCase().replace(/[^a-z0-9]/g, "");
  return COUNTRY_CURRENCY_MAP[normalized] || LISTING_CURRENCY;
}
