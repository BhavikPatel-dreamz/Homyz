"use client";

import React, { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import useWishlist from "@/hooks/useWishlist";
import type { PhotoRoomAssignment } from "@/lib/listing/photo-room-assignments";
import {
  buildPhotoTourViewModel,
  type RoomItemLike,
} from "@/lib/listing/photo-tour-view-model";
import { PhotoTourView } from "@/components/listings/photo-tour/photo-tour-view";

export type ListingPhotosClientProps = {
  photos: string[];
  photoRoomAssignments?: PhotoRoomAssignment[];
  rooms?: RoomItemLike[];
  amenities?: string[];
  listingTitle?: string;
  listingId: string;
  listingSlug?: string | null;
};

export function ListingPhotosClient({
  photos,
  photoRoomAssignments = [],
  rooms = [],
  amenities = [],
  listingTitle,
  listingId,
  listingSlug,
}: ListingPhotosClientProps) {
  const router = useRouter();
  const wishlist = useWishlist();
  const viewModel = useMemo(
    () =>
      buildPhotoTourViewModel({
        photos,
        photoRoomAssignments,
        rooms,
        amenities,
        listingTitle,
      }),
    [photos, photoRoomAssignments, rooms, amenities, listingTitle],
  );

  const backHref = `/listings/${listingSlug || listingId}`;
  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: listingTitle || "Photo tour", url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch (error) {
      // Closing the native share sheet is not an application error.
      if ((error as DOMException | undefined)?.name !== "AbortError") {
        console.error("Unable to share photo tour", error);
      }
    }
  }, [listingTitle]);

  const handleReserve = useCallback(() => {
    router.push(`${backHref}#availability-heading`);
  }, [backHref, router]);

  const handleSave = useCallback(async () => {
    if (wishlist.has(listingId)) await wishlist.remove(listingId);
    else await wishlist.add(listingId);
  }, [listingId, wishlist]);

  return (
    <div className="w-full bg-white">
      <PhotoTourView
        viewModel={viewModel}
        listingTitle={listingTitle}
        backHref={backHref}
        onShare={handleShare}
        onSave={() => void handleSave()}
        isSaved={wishlist.has(listingId)}
        saveDisabled={wishlist.adding.has(listingId) || wishlist.removeInFlight.has(listingId)}
        onReserve={handleReserve}
      />
    </div>
  );
}

export default ListingPhotosClient;
