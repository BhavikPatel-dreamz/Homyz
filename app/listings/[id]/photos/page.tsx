import React, { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingService } from "@/services/listing.service";
import type { PhotoRoomAssignment } from "@/lib/listing/photo-room-assignments";
import type { RoomItemLike } from "@/lib/listing/photo-tour-view-model";
import { AppHeader } from "@/components/dashboard/app-header";
import { ListingPhotosClient } from "./listing-photos-client";

interface ListingPhotosPageProps {
  params: Promise<{ id: string }>;
}

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

export async function generateMetadata({ params }: ListingPhotosPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const listing = await resolveListing(id);
    const locationStr = [listing.city, listing.country]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(", ");
    const title = locationStr
      ? `Photo Tour — ${listing.title} in ${locationStr} | Homyz`
      : `Photo Tour — ${listing.title} | Homyz`;
    const canonicalPath = `/listings/${listing.customSlug || listing.id}/photos`;
    const primaryImage = Array.isArray(listing.photos) && listing.photos.length > 0 ? [listing.photos[0]] : [];

    return {
      title,
      description: `Explore all room photos for ${listing.title}. Verified vacation rental photos and room tour.`,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title,
        images: primaryImage,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        images: primaryImage,
      },
    };
  } catch {
    return {
      title: "Photo Tour — Homyz",
      description: "Explore vacation rental photos on Homyz.",
    };
  }
}

export default async function ListingPhotosPage({ params }: ListingPhotosPageProps) {
  const { id } = await params;

  let listing;
  try {
    listing = await resolveListing(id);
  } catch {
    notFound();
  }

  if (!listing) {
    notFound();
  }

  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const rawListing = listing as unknown as Record<string, unknown>;
  const photoRoomAssignments = Array.isArray(rawListing.photoRoomAssignments)
    ? (rawListing.photoRoomAssignments as PhotoRoomAssignment[])
    : [];
  const rooms = Array.isArray(rawListing.rooms)
    ? (rawListing.rooms as RoomItemLike[])
    : [];
  const amenities = Array.isArray(rawListing.amenities)
    ? (rawListing.amenities as string[])
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <div className="hidden lg:block">
        <AppHeader />
      </div>
      <main className="w-full flex-1">
        <ListingPhotosClient
          photos={photos}
          photoRoomAssignments={photoRoomAssignments}
          rooms={rooms}
          amenities={amenities}
          listingTitle={listing.title}
          listingId={listing.id}
          listingSlug={listing.customSlug || null}
        />
      </main>
    </div>
  );
}
