"use client";

import React, { useMemo } from "react";
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

  return (
    <div className="w-full bg-white">
      <PhotoTourView
        viewModel={viewModel}
        listingTitle={listingTitle}
        backHref={backHref}
      />
    </div>
  );
}

export default ListingPhotosClient;
