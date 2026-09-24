import React, { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingService } from "@/services/listing.service";
import { PublicListingDetailClient } from "./public-listing-detail-client";

interface ListingDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    checkIn?: string;
    startDate?: string;
    checkOut?: string;
    endDate?: string;
    guests?: string;
  }>;
}

/**
 * Resolve a listing by either its real `id` or a `customSlug`.
 * Cards across the site link to `/listings/${customSlug || id}`, so the route
 * segment may be either a CUID-style id OR a human-readable customSlug such as
 * "seed-search-test-100-v1-015". We attempt an id-based lookup first; if that
 * 404s we fall back to a slug-based lookup before giving up.
 */
const resolveListing = cache(async (idOrSlug: string) => {
  try {
    return await listingService.getPublicListingById(idOrSlug);
  } catch (error: unknown) {
    const status = error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status
      : undefined;
    if (status !== 404) throw error;
    // Not found by id — try treating the segment as a customSlug
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
      ? `Book ${listing.title} on Homyz. Real vacation rental in ${locationStr}.`
      : `Book ${listing.title} on Homyz.`;

    return {
      title,
      description: listing.description
        ? listing.description.slice(0, 160)
        : fallbackDescription,
      openGraph: {
        title: locationStr ? `${listing.title} — ${locationStr}` : listing.title,
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

export default async function PublicListingPage({ params, searchParams }: ListingDetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;

  // Pre-fill booking widget from search URL params
  const searchCheckIn = sp.checkIn || sp.startDate || undefined;
  const searchCheckOut = sp.checkOut || sp.endDate || undefined;
  const searchGuests = sp.guests ? parseInt(sp.guests, 10) : undefined;

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

  return (
    <div suppressHydrationWarning={process.env.NODE_ENV === "development"}>
      <PublicListingDetailClient
        listing={listing}
        searchCheckIn={searchCheckIn}
        searchCheckOut={searchCheckOut}
        searchGuests={searchGuests}
      />
    </div>
  );
}
