"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";
import type { PhotoRoomAssignment } from "@/lib/listing/photo-room-assignments";
import {
  buildPhotoTourViewModel,
  type RoomItemLike,
} from "@/lib/listing/photo-tour-view-model";
import { HeroCoverGallery } from "@/components/listings/photo-tour/hero-cover-gallery";
import { PhotoTourModal } from "@/components/listings/photo-tour/photo-tour-modal";
import { FullscreenPhotoViewer } from "@/components/listings/photo-tour/fullscreen-photo-viewer";

export type ListingGalleryProps = {
  photos: string[];
  photoRoomAssignments?: PhotoRoomAssignment[];
  rooms?: RoomItemLike[];
  amenities?: string[];
  listingTitle?: string;
  listingId?: string;
  listingSlug?: string;
  onShare?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  saveDisabled?: boolean;
};

export function ListingGallery({
  photos,
  photoRoomAssignments = [],
  rooms = [],
  amenities = [],
  listingTitle,
  listingId,
  listingSlug,
  onShare,
  onSave,
  isSaved = false,
  saveDisabled = false,
}: ListingGalleryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tourHistoryEntryRef = useRef(false);

  // Mode A: Dedicated room-by-room photo tour
  const [isTourOpen, setIsTourOpen] = useState(() => {
    const photosParam = searchParams?.get("photos") || searchParams?.get("photoTour");
    return photosParam === "tour" || photosParam === "true" || photosParam === "open";
  });

  // Mode B: Fullscreen single photo viewer
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Build the unified view model
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

  // Small screens use the native-feeling overlay, so opening it preserves the
  // detail page and its exact scroll position. Desktop keeps the established
  // dedicated tour route.
  const handleOpenTour = useCallback(() => {
    const targetSlug = listingSlug || listingId;
    trackListingEvent({
      eventType: "gallery_opened",
      metadata: { totalPhotos: viewModel.totalPhotos, initialIndex: 0, mode: "tour" },
    });

    const isMobileOrTablet = typeof window !== "undefined"
      && window.matchMedia("(max-width: 1023px)").matches;
    if (targetSlug && !isMobileOrTablet) {
      router.push(`/listings/${targetSlug}/photos`);
    } else {
      setIsTourOpen(true);
      if (typeof window !== "undefined") {
        window.history.pushState({ modal: "photo-tour" }, "", window.location.href);
        tourHistoryEntryRef.current = true;
      }
    }
  }, [router, listingSlug, listingId, viewModel.totalPhotos]);

  // Close Mode A
  const handleCloseTour = useCallback(() => {
    setIsTourOpen(false);
    if (tourHistoryEntryRef.current && typeof window !== "undefined") {
      tourHistoryEntryRef.current = false;
      window.history.back();
    }
  }, []);

  const handleReserveFromTour = useCallback(() => {
    handleCloseTour();
    window.setTimeout(() => {
      document.getElementById("availability-heading")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 380);
  }, [handleCloseTour]);

  // Open Mode B (Fullscreen Viewer)
  const handleOpenFullscreen = useCallback(
    (globalIndex: number) => {
      setSelectedPhotoIndex(globalIndex);
      setIsFullscreenOpen(true);

      trackListingEvent({
        eventType: "gallery_photo_changed",
        metadata: { selectedIndex: globalIndex, totalPhotos: viewModel.totalPhotos },
      });

      if (typeof window !== "undefined") {
        window.history.pushState({ modal: "photo-viewer", index: globalIndex }, "", window.location.href);
      }
    },
    [viewModel.totalPhotos],
  );

  // Close Mode B
  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreenOpen(false);
  }, []);

  // Browser back navigation synchronization
  useEffect(() => {
    const handlePopState = () => {
      if (isFullscreenOpen) {
        setIsFullscreenOpen(false);
      } else if (isTourOpen) {
        setIsTourOpen(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isFullscreenOpen, isTourOpen]);

  return (
    <>
      {/* If Tour is open in-page, show the non-overlapping PhotoTourModal */}
      {isTourOpen ? (
        <PhotoTourModal
          viewModel={viewModel}
          isOpen={isTourOpen}
          onClose={handleCloseTour}
          listingTitle={listingTitle}
          onShare={onShare}
          onSave={onSave}
          isSaved={isSaved}
          saveDisabled={saveDisabled}
          onReserve={handleReserveFromTour}
          reserveLabel="Reserve"
        />
      ) : (
        /* Otherwise show the 5-image hero collage on the listing page */
        <HeroCoverGallery
          photos={viewModel.allPhotos.map((p) => p.url)}
          listingTitle={listingTitle}
          onOpenPhotoTour={handleOpenTour}
          onSelectPhoto={(idx) => handleOpenFullscreen(idx)}
          onShare={onShare}
          onSave={onSave}
          isSaved={isSaved}
          saveDisabled={saveDisabled}
        />
      )}

      {/* Mode B: Fullscreen Individual Photo Viewer */}
      {isFullscreenOpen && (
        <FullscreenPhotoViewer
          key={`viewer-${selectedPhotoIndex}`}
          photos={viewModel.allPhotos}
          initialIndex={selectedPhotoIndex}
          isOpen={isFullscreenOpen}
          onClose={handleCloseFullscreen}
          listingTitle={listingTitle}
          onShare={onShare}
        />
      )}
    </>
  );
}

export default ListingGallery;
