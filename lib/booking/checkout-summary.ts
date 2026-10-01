import { formatBookingDate, formatBookingDateRange } from "@/lib/booking/booking-date";

export type CheckoutSummaryTax = {
  taxName: string;
  taxAmount: number;
  exemptionApplied?: boolean;
  exemptionReason?: string;
  zeroReason?: string;
};

export type CheckoutSummaryQuote = {
  nights: number;
  baseNightlyPrice: number;
  nightlySubtotal: number;
  discountAmount?: number;
  /** @deprecated Ignored. Cleaning fees are no longer displayed or charged. */
  cleaningFee?: number;
  extraGuestFee: number;
  petFee?: number;
  hostServiceFee: number;
  taxes: CheckoutSummaryTax[];
  taxTotal: number;
  guestTotal: number;
  currency: string;
  isSpecialOffer?: boolean;
  breakdown?: Array<{ date: string; price: number; rateSource?: string }>;
};

export type CheckoutPriceRow = {
  id: string;
  label: string;
  amount: number;
  subtract?: boolean;
  unitPrice?: number;
  units?: number;
};

export function formatCheckoutDateRange(checkIn: string, checkOut: string, locale = "en-US"): string {
  const formatted = formatBookingDateRange(checkIn, checkOut, locale);
  return formatted === "Dates TBD" ? "Select dates" : formatted;
}

export function formatCheckoutDate(value: string, locale = "en-US"): string {
  const formatted = formatBookingDate(value, { locale, weekday: true });
  return formatted === "Not available" ? "Select date" : formatted;
}

export function formatCheckoutGuests(guests: {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}): string {
  const capacityGuests = guests.adults + guests.children;
  const parts = [`${capacityGuests} ${capacityGuests === 1 ? "guest" : "guests"}`];
  if (guests.infants > 0) parts.push(`${guests.infants} ${guests.infants === 1 ? "infant" : "infants"}`);
  if (guests.pets > 0) parts.push(`${guests.pets} ${guests.pets === 1 ? "pet" : "pets"}`);
  return parts.join(", ");
}

export function getCheckoutPriceRows(
  quote: CheckoutSummaryQuote,
  options: { itemizeTaxes?: boolean } = {},
): CheckoutPriceRow[] {
  const nightlyPrices = new Set((quote.breakdown || []).map((night) => night.price));
  const fixedNightlyPrice = nightlyPrices.size === 1
    ? quote.breakdown?.[0]?.price ?? quote.baseNightlyPrice
    : quote.baseNightlyPrice;
  const accommodationLabel = quote.isSpecialOffer
    ? `Special offer accommodation (${quote.nights} ${quote.nights === 1 ? "night" : "nights"})`
    : nightlyPrices.size <= 1
      ? "Accommodation"
      : `Accommodation (${quote.nights} nights, varying rates)`;

  const rows: CheckoutPriceRow[] = [
    {
      id: "accommodation",
      label: accommodationLabel,
      amount: quote.nightlySubtotal,
      unitPrice: !quote.isSpecialOffer && nightlyPrices.size <= 1 ? fixedNightlyPrice : undefined,
      units: !quote.isSpecialOffer && nightlyPrices.size <= 1 ? quote.nights : undefined,
    },
  ];
  if ((quote.discountAmount || 0) > 0) rows.push({ id: "discount", label: "Discount", amount: quote.discountAmount || 0, subtract: true });
  if (quote.extraGuestFee > 0) rows.push({ id: "extra-guests", label: "Extra guest fee", amount: quote.extraGuestFee });
  if ((quote.petFee || 0) > 0) rows.push({ id: "pets", label: "Pet fee", amount: quote.petFee || 0 });

  if (quote.taxes.length > 0) {
    if (options.itemizeTaxes && quote.taxes.length > 0) {
      quote.taxes.forEach((tax, index) => rows.push({
        id: `tax-${index}`,
        label: `${tax.taxName || "Tax"}${tax.exemptionApplied && tax.exemptionReason ? ` · ${tax.exemptionReason}` : ""}`,
        amount: tax.taxAmount,
      }));
    } else {
      const allExempt = quote.taxes.every((tax) => tax.exemptionApplied && tax.taxAmount === 0);
      rows.push({ id: "taxes", label: allExempt ? "Taxes · exemption applied" : "Taxes", amount: quote.taxTotal });
    }
  }
  return rows;
}
