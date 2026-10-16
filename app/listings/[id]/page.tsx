import React, { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingService } from "@/services/listing.service";
import { bookingService, type BookingQuote } from "@/services/booking.service";
import { PublicListingDetailClient } from "./public-listing-detail-client";
import { cookies } from "next/headers";
import { LAST_SEARCH_COOKIE, parseServerLastSearch } from "@/lib/storage/client-history";
import { bookingDateKey, isBookingDatePast, parseBookingDate } from "@/lib/booking/booking-date";

interface ListingDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    checkin?: string;
    checkIn?: string;
    startDate?: string;
    checkout?: string;
    checkOut?: string;
    endDate?: string;
    guests?: string;
    adults?: string;
    children?: string;
    infants?: string;
    pets?: string;
    specialOfferId?: string;
  }>;
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined);
}

function isValidDateKey(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseBookingDate(value);
  return !Number.isNaN(date.getTime()) && bookingDateKey(date) === value;
}

function parseGuestParam(
  value: string | undefined,
  label: string,
  minimum: number,
  maximum: number,
): { value?: number; error?: string } {
  if (value === undefined) return {};
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return { error: `${label} must be a whole number between ${minimum} and ${maximum}.` };
  }
  return { value: parsed };
}

/**
 * Resolve a listing by either its database `id` or human-readable `customSlug`.
 * Fast-paths slug lookups for slug-formatted identifiers to avoid double queries and 404 throws.
 */
const resolveListing = cache(async (idOrSlug: string) => {
  const isSlug = idOrSlug.includes("-") && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  if (isSlug) {
    try {
      return await listingService.getPublicListingBySlug(idOrSlug);
    } catch (error: unknown) {
      const status = error && typeof error === "object" && "status" in error
        ? (error as { status?: number }).status
        : undefined;
      if (status !== 404) throw error;
      return await listingService.getPublicListingById(idOrSlug);
    }
  }

  try {
    return await listingService.getPublicListingById(idOrSlug);
  } catch (error: unknown) {
    const status = error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status
      : undefined;
    if (status !== 404) throw error;
    return await listingService.getPublicListingBySlug(idOrSlug);
  }
});

export async function generateMetadata({ params }: ListingDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const listing = await resolveListing(id);
    const locationStr = [listing.city, listing.country]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(", ");
    const title = locationStr
      ? `${listing.title} — Stay in ${locationStr} | Homyz`
      : `${listing.title} | Homyz`;
    const fallbackDescription = locationStr
      ? `Book ${listing.title} on Homyz. Verified vacation rental in ${locationStr}. Check availability, pricing, photos, and reviews.`
      : `Book ${listing.title} on Homyz. Verified accommodation marketplace.`;
    const description = listing.description
      ? listing.description.slice(0, 160)
      : fallbackDescription;
    const primaryImage = Array.isArray(listing.photos) && listing.photos.length > 0 ? [listing.photos[0]] : [];
    const canonicalPath = `/listings/${listing.customSlug || listing.id}`;

    return {
      title,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title: locationStr ? `${listing.title} — ${locationStr}` : listing.title,
        description,
        url: canonicalPath,
        siteName: "Homyz",
        images: primaryImage,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: locationStr ? `${listing.title} — ${locationStr}` : listing.title,
        description,
        images: primaryImage,
      },
    };
  } catch {
    return {
      title: "Listing Details — Homyz",
      description: "Explore vacation rentals on Homyz.",
    };
  }
}

export default async function PublicListingPage({ params, searchParams }: ListingDetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const cookieStore = await cookies();
  const serverLastSearch = parseServerLastSearch(cookieStore.get(LAST_SEARCH_COOKIE)?.value);

  // Explicit URL values take precedence over persisted state, including invalid
  // values. Invalid selections are surfaced in the reservation card rather than
  // silently replaced with an older search.
  const explicitCheckIn = firstDefined(sp.checkIn, sp.checkin, sp.startDate);
  const explicitCheckOut = firstDefined(sp.checkOut, sp.checkout, sp.endDate);
  const hasExplicitDateSelection = explicitCheckIn !== undefined || explicitCheckOut !== undefined;
  const rawCheckIn = hasExplicitDateSelection ? explicitCheckIn : serverLastSearch?.checkIn || undefined;
  const rawCheckOut = hasExplicitDateSelection ? explicitCheckOut : serverLastSearch?.checkOut || undefined;
  let initialSelectionError: string | undefined;
  let searchCheckIn = isValidDateKey(rawCheckIn) ? rawCheckIn : undefined;
  let searchCheckOut = isValidDateKey(rawCheckOut) ? rawCheckOut : undefined;
  if ((rawCheckIn !== undefined || rawCheckOut !== undefined) && (!searchCheckIn || !searchCheckOut)) {
    initialSelectionError = "Check-in and check-out must be valid YYYY-MM-DD dates and must be provided together.";
    searchCheckIn = undefined;
    searchCheckOut = undefined;
  } else if (searchCheckIn && searchCheckOut && searchCheckOut <= searchCheckIn) {
    initialSelectionError = "Check-out must be after check-in.";
    searchCheckIn = undefined;
    searchCheckOut = undefined;
  } else if (searchCheckIn && isBookingDatePast(searchCheckIn)) {
    initialSelectionError = "Check-in cannot be in the past.";
    searchCheckIn = undefined;
    searchCheckOut = undefined;
  }

  const guestsParam = parseGuestParam(
    sp.guests !== undefined ? sp.guests : undefined,
    "Guests",
    1,
    50,
  );
  const adultsParam = parseGuestParam(sp.adults !== undefined ? sp.adults : undefined, "Adults", 1, 50);
  const childrenParam = parseGuestParam(sp.children !== undefined ? sp.children : undefined, "Children", 0, 50);
  const infantsParam = parseGuestParam(sp.infants !== undefined ? sp.infants : undefined, "Infants", 0, 5);
  const petsParam = parseGuestParam(sp.pets !== undefined ? sp.pets : undefined, "Pets", 0, 20);
  initialSelectionError ||= guestsParam.error || adultsParam.error || childrenParam.error || infantsParam.error || petsParam.error;
  const searchGuests = sp.guests !== undefined ? guestsParam.value : serverLastSearch?.guests || undefined;
  const searchAdults = sp.adults !== undefined ? adultsParam.value : serverLastSearch?.adults || undefined;
  const searchChildren = sp.children !== undefined ? childrenParam.value : serverLastSearch?.children || undefined;
  const searchInfants = sp.infants !== undefined ? infantsParam.value : serverLastSearch?.infants || undefined;
  const searchPets = sp.pets !== undefined ? petsParam.value : serverLastSearch?.pets || undefined;
  const specialOfferId = sp.specialOfferId || undefined;

  let listing: Awaited<ReturnType<typeof resolveListing>> | null = null;

  try {
    listing = await resolveListing(id);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; status?: number; message?: string } | null;
    if (error?.statusCode === 404 || error?.status === 404 || error?.message?.includes("not available")) {
      notFound();
    }
    console.error("Failed to load public listing:", err);
    notFound();
  }

  if (!listing) {
    notFound();
  }

  // Pre-compute authoritative booking quote server-side when dates are valid
  let initialQuote: BookingQuote | null = null;
  const effectiveGuests = (searchAdults || 0) + (searchChildren || 0) || searchGuests || 1;
  if (
    searchCheckIn &&
    searchCheckOut &&
    /^\d{4}-\d{2}-\d{2}$/.test(searchCheckIn) &&
    /^\d{4}-\d{2}-\d{2}$/.test(searchCheckOut) &&
    searchCheckOut > searchCheckIn
  ) {
    try {
      initialQuote = await bookingService.getBookingQuote({
        listingId: listing.id,
        checkIn: searchCheckIn,
        checkOut: searchCheckOut,
        guests: effectiveGuests,
        pets: searchPets || 0,
        nonRefundable: false,
        specialOfferId,
      });
    } catch {
      // If dates unavailable or invalid, initialQuote stays null and client handles gracefully
    }
  }

  // JSON-LD structured data for rich accommodation search snippets
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: listing.title,
    description: listing.description || undefined,
    image: Array.isArray(listing.photos) ? listing.photos : [],
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.city || undefined,
      addressRegion: listing.district || undefined,
      addressCountry: listing.country || undefined,
    },
    ...(listing.rating && listing.reviewsCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: listing.rating,
            reviewCount: listing.reviewsCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    priceRange: listing.price ? `${listing.currency || "USD"} ${listing.price}` : undefined,
  };

  return (
    <div suppressHydrationWarning={process.env.NODE_ENV === "development"}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicListingDetailClient
        listing={listing}
        searchCheckIn={searchCheckIn}
        searchCheckOut={searchCheckOut}
        searchGuests={searchGuests}
        searchAdults={searchAdults}
        searchChildren={searchChildren}
        searchInfants={searchInfants}
        searchPets={searchPets}
        initialSelectionError={initialSelectionError}
        initialSpecialOfferId={specialOfferId}
        initialQuote={initialQuote}
      />
    </div>
  );
}
