import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingService } from "@/services/listing.service";
import { PublicListingDetailClient } from "./public-listing-detail-client";

export const dynamic = "force-dynamic";

interface ListingDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ListingDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const listing = await listingService.getPublicListingById(id);
    const locationStr = listing.city
      ? `${listing.city}${listing.country ? `, ${listing.country}` : ""}`
      : "Saudi Arabia";

    return {
      title: `${listing.title} — Stay in ${locationStr} | Homyz`,
      description: listing.description
        ? listing.description.slice(0, 160)
        : `Book ${listing.title} on Homyz. Real vacation rental in ${locationStr}.`,
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

export default async function PublicListingPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  let listing: Awaited<ReturnType<typeof listingService.getPublicListingById>> | null = null;

  try {
    listing = await listingService.getPublicListingById(id);
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

  return <PublicListingDetailClient listing={listing} />;
}
