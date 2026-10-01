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

export function createQuoteRequestKey(selection: BookingQuoteSelection): string {
  return selectionKey(selection);
}

const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Deduplicates in-flight quote requests. If an identical quote request is already
 * in flight, reuses the pending Promise rather than initiating a duplicate fetch.
 */
export async function fetchAuthoritativeQuote<T>(
  selection: BookingQuoteSelection,
  options?: { signal?: AbortSignal },
): Promise<T> {
  const key = selectionKey(selection);
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const specialOfferParam = selection.specialOfferId ? `&specialOfferId=${encodeURIComponent(selection.specialOfferId)}` : "";
  const url = `/api/v1/listings/${selection.listingId}/quote?checkIn=${encodeURIComponent(selection.checkIn)}&checkOut=${encodeURIComponent(selection.checkOut)}&guests=${selection.guests}&pets=${selection.pets}&nonRefundable=${selection.nonRefundable}${specialOfferParam}`;

  const requestPromise = (async () => {
    try {
      const res = await fetch(url, { signal: options?.signal, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.error || !json.data) {
        throw new Error(json.error?.message || "Selected dates are not available.");
      }
      saveBookingQuote(selection, json.data);
      return json.data as T;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, requestPromise);
  return requestPromise;
}
