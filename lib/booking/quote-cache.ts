const BOOKING_QUOTE_CACHE_PREFIX = "homyz_booking_quote_v1";

export type BookingQuoteSelection = {
  listingId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  nonRefundable: boolean;
  specialOfferId?: string;
};

function selectionKey(selection: BookingQuoteSelection): string {
  return JSON.stringify({
    listingId: selection.listingId,
    checkIn: selection.checkIn,
    checkOut: selection.checkOut,
    guests: selection.guests,
    pets: selection.pets,
    nonRefundable: selection.nonRefundable,
    specialOfferId: selection.specialOfferId || null,
  });
}

function storageKey(listingId: string): string {
  return `${BOOKING_QUOTE_CACHE_PREFIX}:${listingId}`;
}

/** Keeps the latest authoritative detail-page quote visible during checkout hydration. */
export function saveBookingQuote<T>(selection: BookingQuoteSelection, quote: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(selection.listingId), JSON.stringify({
      selectionKey: selectionKey(selection),
      quote,
    }));
  } catch {}
}

export function readBookingQuote<T>(selection: BookingQuoteSelection): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(selection.listingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { selectionKey?: unknown; quote?: unknown };
    return parsed.selectionKey === selectionKey(selection) && parsed.quote && typeof parsed.quote === "object"
      ? parsed.quote as T
      : null;
  } catch {
    return null;
  }
}

/** Clears a browser-local quote after the host changes pricing or taxes. */
export function clearBookingQuote(listingId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(listingId));
  } catch {}
}
