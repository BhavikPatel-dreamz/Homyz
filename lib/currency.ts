export const LISTING_CURRENCY = "SAR";

/** USD value of one unit of each supported currency. Used for display conversion only. */
const USD_PER_CURRENCY_UNIT: Record<string, number> = {
  SAR: 1 / 3.75, AED: 1 / 3.6725, USD: 1, EUR: 1.09, GBP: 1.28,
  CAD: 0.74, AUD: 0.65, INR: 0.012, JPY: 0.0067, CHF: 1.13,
  KWD: 3.25, QAR: 1 / 3.64, BHD: 2.65, OMR: 2.6, EGP: 0.02, JOD: 1.41,
};

export function normalizeCurrencyCode(currencyCode?: string | null): string {
  return currencyCode?.trim().toUpperCase() || LISTING_CURRENCY;
}

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

const CURRENCY_SYMBOLS: Record<string, string> = {
  SAR: "SAR",
  AED: "AED",
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  KWD: "KWD",
  QAR: "QAR",
  BHD: "BHD",
  OMR: "OMR",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  CHF: "CHF",
};

export function getCurrencySymbol(currencyCode?: string | null): string {
  if (!currencyCode) return "SAR";
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode.toUpperCase();
}

/** Formats a listing amount persisted in minor units (e.g. cents/halalas) using dynamic currency. */
export function formatListingPrice(
  amountMinorUnits: number,
  currencyCode: string = LISTING_CURRENCY,
  fractionDigits = 0,
): string {
  const safeAmount = Number.isFinite(amountMinorUnits) ? amountMinorUnits / 100 : 0;
  const currency = normalizeCurrencyCode(currencyCode);
  const symbol = CURRENCY_SYMBOLS[currency];

  const formattedNum = new Intl.NumberFormat("en", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safeAmount);

  if (symbol) {
    if (["$", "€", "£", "₹", "¥"].includes(symbol)) {
      return `${symbol}${formattedNum}`;
    }
    return `${symbol} ${formattedNum}`;
  }

  return `${currency} ${formattedNum}`;
}

/**
 * Converts a persisted minor-unit amount for interface display.  This must not
 * be used to change booking totals or settlement amounts.
 */
export function formatConvertedListingPrice(
  amountMinorUnits: number,
  sourceCurrency: string | null | undefined,
  displayCurrency: string | null | undefined,
  fractionDigits = 0,
): string {
  const source = normalizeCurrencyCode(sourceCurrency);
  const target = normalizeCurrencyCode(displayCurrency);
  const amount = Number.isFinite(amountMinorUnits) ? amountMinorUnits : 0;
  const sourceRate = USD_PER_CURRENCY_UNIT[source];
  const targetRate = USD_PER_CURRENCY_UNIT[target];

  if (!sourceRate || !targetRate) return formatListingPrice(amount, target, fractionDigits);
  const convertedMinorUnits = (amount / 100) * sourceRate / targetRate * 100;
  return formatListingPrice(convertedMinorUnits, target, fractionDigits);
}
