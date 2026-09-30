import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingService } from "@/services/listing.service";
import { PublicListingDetailClient } from "@/app/listings/[id]/public-listing-detail-client";

import { cookies } from "next/headers";
import { LAST_SEARCH_COOKIE, parseServerLastSearch } from "@/lib/storage/client-history";

export const dynamic = "force-dynamic";

interface StaySlugPageProps {
  params: Promise<{ slug: string }>;
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

export async function generateMetadata({ params }: StaySlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const listing = await listingService.getPublicListingBySlug(slug);
    const locationStr = listing.city
      ? `${listing.city}${listing.country ? `, ${listing.country}` : ""}`
      : "Saudi Arabia";

    return {
      title: `${listing.title} — Stay in ${locationStr} | Homyz`,
      description: listing.description
        ? listing.description.slice(0, 160)
        : `Book ${listing.title} on Homyz. Real vacation rental in ${locationStr}.`,
      alternates: {
        canonical: `/listings/${listing.id}`,
      },
      openGraph: {
        title: `${listing.title} — ${locationStr}`,
        description: listing.description ? listing.description.slice(0, 160) : undefined,
        images: Array.isArray(listing.photos) && listing.photos.length > 0 ? [listing.photos[0]] : [],
      },
    };
  } catch {
    return {
      title: "Listing Details — Homyz",
      description: "Explore vacation rentals on Homyz.",
    };
  }
}

export default async function StaySlugPage({ params, searchParams }: StaySlugPageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const cookieStore = await cookies();
  const serverLastSearch = parseServerLastSearch(cookieStore.get(LAST_SEARCH_COOKIE)?.value);

  const searchCheckIn = sp.checkIn || sp.checkin || sp.startDate || serverLastSearch?.checkIn || undefined;
  const searchCheckOut = sp.checkOut || sp.checkout || sp.endDate || serverLastSearch?.checkOut || undefined;
  const searchGuests = sp.guests
    ? parseInt(sp.guests, 10)
    : serverLastSearch?.guests || undefined;
  const searchAdults = sp.adults ? parseInt(sp.adults, 10) : serverLastSearch?.adults || undefined;
  const searchChildren = sp.children ? parseInt(sp.children, 10) : serverLastSearch?.children || undefined;
  const searchInfants = sp.infants ? parseInt(sp.infants, 10) : serverLastSearch?.infants || undefined;
  const searchPets = sp.pets ? parseInt(sp.pets, 10) : serverLastSearch?.pets || undefined;
  const specialOfferId = sp.specialOfferId || undefined;

  let listing: Awaited<ReturnType<typeof listingService.getPublicListingBySlug>> | null = null;

  try {
    listing = await listingService.getPublicListingBySlug(slug);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; status?: number; message?: string } | null;
    if (error?.statusCode === 404 || error?.status === 404 || error?.message?.includes("not available")) {
      notFound();
    }
    console.error("Failed to load listing by slug:", err);
    notFound();
  }

  if (!listing) {
    notFound();
  }

  return (
    <PublicListingDetailClient
      listing={listing}
      searchCheckIn={searchCheckIn}
      searchCheckOut={searchCheckOut}
      searchGuests={searchGuests}
      searchAdults={searchAdults}
      searchChildren={searchChildren}
      searchInfants={searchInfants}
      searchPets={searchPets}
      initialSpecialOfferId={specialOfferId}
    />
  );
}
