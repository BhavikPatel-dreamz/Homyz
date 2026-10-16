"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { ReportContentModal } from "@/components/moderation/report-content-modal";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";
import { useLanguage } from "@/lib/i18n/language-context";

import {
  resolvePhotoRoomType,
  PHOTO_TOUR_CATEGORIES,
  type PhotoRoomAssignment,
  type PhotoRoomType,
} from "@/lib/listing/photo-room-assignments";

type Props = {
  photos: string[];
  photoRoomAssignments?: PhotoRoomAssignment[];
  listingTitle?: string;
  onShare?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  saveDisabled?: boolean;
};

export function ListingGallery({
  photos,
  photoRoomAssignments = [],
  listingTitle,
  onShare,
  onSave,
  isSaved = false,
  saveDisabled = false,
}: Props) {
  const router = useRouter();
  const { t } = useLanguage();

  // Listing.photos is an ordered array: the host editor keeps index 0 as the
  // cover photo. Remove invalid/duplicate URLs without changing that order.
  const galleryPhotos = useMemo(
    () =>
      Array.from(
        new Set(
          photos.filter(
            (photo): photo is string => typeof photo === "string" && photo.trim().length > 0,
          ),
        ),
      ),
    [photos],
  );

  const roomByUrl = useMemo(
    () =>
      new Map(
        photoRoomAssignments.map(({ url, roomType, roomCategory, categoryId }) => [
          url,
          resolvePhotoRoomType(roomType ?? roomCategory ?? categoryId ?? null),
        ]),
      ),
    [photoRoomAssignments],
  );

  const roomCategories = useMemo(() => {
    const presentTypes = new Set<string | null>();
    galleryPhotos.forEach((photo) => presentTypes.add(roomByUrl.get(photo) ?? null));
    return PHOTO_TOUR_CATEGORIES.filter((c) => presentTypes.has(c.id)).map((c) => ({
      id: c.id,
      label: t(`host_room_cat_${c.id}` as any, c.label),
      count: galleryPhotos.filter((p) => (roomByUrl.get(p) ?? null) === c.id).length,
    }));
  }, [galleryPhotos, roomByUrl, t]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeRoomFilter, setActiveRoomFilter] = useState<string | null>(null);
  const [reportingPhotoUrl, setReportingPhotoUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [unoptimizedMap, setUnoptimizedMap] = useState<Record<number, boolean>>({});

  const photosRef = useRef(galleryPhotos);
  const touchStartX = useRef<number | null>(null);
  const lightboxCloseBtnRef = useRef<HTMLButtonElement>(null);
  const lightboxTriggerRef = useRef<HTMLElement | null>(null);

  const handleOpenLightbox = useCallback(() => {
    lightboxTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setLightboxOpen(true);
    trackListingEvent({
      eventType: "gallery_opened",
      metadata: { totalPhotos: galleryPhotos.length, initialIndex: selectedIndex },
    });
  }, [galleryPhotos.length, selectedIndex]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    requestAnimationFrame(() => lightboxTriggerRef.current?.focus());
  }, []);

  const handleSelectPhoto = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      trackListingEvent({
        eventType: "gallery_photo_changed",
        metadata: { selectedIndex: index, totalPhotos: galleryPhotos.length },
      });
    },
    [galleryPhotos.length],
  );

  // Reset selection when photos list changes (navigating properties)
  useEffect(() => {
    if (photosRef.current !== galleryPhotos) {
      setSelectedIndex(0);
      setLightboxOpen(false);
      setFailed({});
      setUnoptimizedMap({});
      photosRef.current = galleryPhotos;
    }
  }, [galleryPhotos]);

  // Keep the initial page image budget to the visible collage. Adjacent images
  // are only preloaded after the guest intentionally opens the lightbox.
  useEffect(() => {
    if (!lightboxOpen || galleryPhotos.length === 0) return;
    const next = galleryPhotos[selectedIndex + 1];
    const prev = galleryPhotos[selectedIndex - 1];
    [prev, next].forEach((src) => {
      if (!src) return;
      const img = new window.Image();
      img.src = src;
    });
  }, [lightboxOpen, selectedIndex, galleryPhotos]);

  // Keyboard handling and focus management for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    lightboxCloseBtnRef.current?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((s) => Math.min(galleryPhotos.length - 1, s + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [lightboxOpen, galleryPhotos.length, closeLightbox]);

  const total = galleryPhotos.length;
  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex < total - 1;

  const goToPrevious = () => setSelectedIndex((index) => Math.max(0, index - 1));
  const goToNext = () => setSelectedIndex((index) => Math.min(total - 1, index + 1));

  const handleTouchEnd = (event: React.TouchEvent<HTMLButtonElement>) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0]?.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) goToPrevious();
    else goToNext();
  };

  const handleImgError = (index: number) => {
    if (!unoptimizedMap[index]) {
      // First attempt through Next.js proxy failed; retry directly in browser without optimization proxy
      setUnoptimizedMap((prev) => ({ ...prev, [index]: true }));
    } else {
      // Direct load also failed
      setFailed((p) => ({ ...p, [index]: true }));
    }
  };

  const renderSlotFallback = (label?: string) => (
    <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-100 p-3 text-center text-[#727272]">
      <div className="mb-1 flex size-8 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-400">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
      <span className="text-[10px] font-medium text-zinc-500">
        {label || t("listing_gallery_preview_unavailable" as any, "Photo unavailable")}
      </span>
    </div>
  );

  const allPhotosFailed = total > 0 && Object.keys(failed).length >= total;

  // Single intentional, professional fallback experience when no photos exist or all fail
  if (total === 0 || allPhotosFailed) {
    return (
      <div className="relative mb-6 lg:mb-8">
        <div className="aspect-[4/3] sm:aspect-[21/9] w-full rounded-[20px] border border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center text-center p-6 shadow-2xs">
          <div className="size-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl mb-3 shadow-2xs">
            🏡
          </div>
          <p className="text-base font-medium text-[#1f1f1f]">
            {t("listing_gallery_no_photos_title" as any, "Photos not available")}
          </p>
          <p className="text-xs text-[#727272] mt-1 max-w-sm">
            {t("listing_gallery_no_photos_desc" as any, "Photos for this listing are currently unavailable or being updated by the host.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-6 lg:mb-8" aria-label={t("listing_gallery_section_label" as any, "Property photo gallery")}>
      {/* 1 Photo Layout */}
      {total === 1 && (
        <div className="aspect-[4/3] sm:aspect-[21/9] w-full relative overflow-hidden rounded-[20px] bg-zinc-100">
          {!failed[0] ? (
            <button
              type="button"
              aria-label={`Open photo 1 of 1`}
              onClick={handleOpenLightbox}
              onTouchStart={(event) => {
                touchStartX.current = event.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={handleTouchEnd}
              className="h-full w-full p-0 m-0 block cursor-pointer"
            >
              <Image
                src={galleryPhotos[0]}
                alt={listingTitle ? `${listingTitle} — Photo 1` : "Property photo 1"}
                sizes="(max-width: 768px) 100vw, 1200px"
                fill
                style={{ objectFit: "cover" }}
                priority
                unoptimized={Boolean(unoptimizedMap[0])}
                onError={() => handleImgError(0)}
              />
            </button>
          ) : (
            renderSlotFallback()
          )}
        </div>
      )}

      {/* 2 Photos Layout */}
      {total === 2 && (
        <div className="grid grid-cols-1 gap-4 aspect-[4/3] sm:aspect-[21/9] sm:grid-cols-2">
          {galleryPhotos.map((photo, index) => (
            <div key={index} className="relative h-full overflow-hidden rounded-[20px] bg-zinc-100">
              {!failed[index] ? (
                <button
                  type="button"
                  aria-label={`Open photo ${index + 1} of 2`}
                  onClick={() => {
                    setSelectedIndex(index);
                    handleOpenLightbox();
                  }}
                  className="h-full w-full p-0 m-0 block cursor-pointer hover:opacity-95 transition-opacity"
                >
                  <Image
                    src={photo}
                    alt={listingTitle ? `${listingTitle} — Photo ${index + 1}` : `Photo ${index + 1}`}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    fill
                    style={{ objectFit: "cover" }}
                    priority={index === 0}
                    loading={index === 0 ? "eager" : "lazy"}
                    unoptimized={Boolean(unoptimizedMap[index])}
                    onError={() => handleImgError(index)}
                  />
                </button>
              ) : (
                renderSlotFallback()
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3 Photos Layout */}
      {total === 3 && (
        <div className="grid grid-cols-1 gap-4 aspect-[4/3] sm:aspect-[21/9] md:grid-cols-4">
          <div className="md:col-span-2 relative h-full overflow-hidden rounded-[20px] bg-zinc-100">
            {!failed[0] ? (
              <button
                type="button"
                aria-label={`Open photo 1 of 3`}
                onClick={() => {
                  setSelectedIndex(0);
                  handleOpenLightbox();
                }}
                className="h-full w-full p-0 m-0 block cursor-pointer"
              >
                <Image
                  src={galleryPhotos[0]}
                  alt={listingTitle ? `${listingTitle} — Photo 1` : "Photo 1"}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  fill
                  style={{ objectFit: "cover" }}
                  priority
                  unoptimized={Boolean(unoptimizedMap[0])}
                  onError={() => handleImgError(0)}
                />
              </button>
            ) : (
              renderSlotFallback()
            )}
          </div>
          <div className="relative hidden h-full grid-rows-2 gap-4 md:col-span-2 md:grid">
            {galleryPhotos.slice(1, 3).map((photo, i) => {
              const index = i + 1;
              return (
                <div key={index} className="relative h-full overflow-hidden rounded-[10px] bg-zinc-100">
                  {!failed[index] ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndex(index);
                        handleOpenLightbox();
                      }}
                      aria-label={`Open photo ${index + 1} of 3`}
                      className="h-full w-full p-0 m-0 block cursor-pointer hover:opacity-95 transition-opacity"
                    >
                      <Image
                        src={photo}
                        alt={listingTitle ? `${listingTitle} — Photo ${index + 1}` : `Photo ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        style={{ objectFit: "cover" }}
                        loading="lazy"
                        unoptimized={Boolean(unoptimizedMap[index])}
                        onError={() => handleImgError(index)}
                      />
                    </button>
                  ) : (
                    renderSlotFallback()
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4 Photos Layout */}
      {total === 4 && (
        <div className="grid grid-cols-1 gap-4 aspect-[4/3] sm:aspect-[21/9] md:grid-cols-4">
          <div className="md:col-span-2 relative h-full overflow-hidden rounded-[20px] bg-zinc-100">
            {!failed[0] ? (
              <button
                type="button"
                aria-label={`Open photo 1 of 4`}
                onClick={() => {
                  setSelectedIndex(0);
                  handleOpenLightbox();
                }}
                className="h-full w-full p-0 m-0 block cursor-pointer"
              >
                <Image
                  src={galleryPhotos[0]}
                  alt={listingTitle ? `${listingTitle} — Photo 1` : "Photo 1"}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  fill
                  style={{ objectFit: "cover" }}
                  priority
                  unoptimized={Boolean(unoptimizedMap[0])}
                  onError={() => handleImgError(0)}
                />
              </button>
            ) : (
              renderSlotFallback()
            )}
          </div>
          <div className="relative hidden h-full grid-cols-2 gap-4 md:col-span-2 md:grid">
            <div className="col-span-2 relative h-full overflow-hidden rounded-[10px] bg-zinc-100">
              {!failed[1] ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIndex(1);
                    handleOpenLightbox();
                  }}
                  aria-label="Open photo 2 of 4"
                  className="h-full w-full cursor-pointer hover:opacity-95 transition-opacity"
                >
                  <Image
                    src={galleryPhotos[1]}
                    alt={listingTitle ? `${listingTitle} — Photo 2` : "Photo 2"}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    style={{ objectFit: "cover" }}
                    loading="lazy"
                    unoptimized={Boolean(unoptimizedMap[1])}
                    onError={() => handleImgError(1)}
                  />
                </button>
              ) : (
                renderSlotFallback()
              )}
            </div>
            {galleryPhotos.slice(2, 4).map((photo, i) => {
              const index = i + 2;
              return (
                <div key={index} className="relative h-full overflow-hidden rounded-[10px] bg-zinc-100">
                  {!failed[index] ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndex(index);
                        handleOpenLightbox();
                      }}
                      aria-label={`Open photo ${index + 1} of 4`}
                      className="h-full w-full cursor-pointer hover:opacity-95 transition-opacity"
                    >
                      <Image
                        src={photo}
                        alt={listingTitle ? `${listingTitle} — Photo ${index + 1}` : `Photo ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 25vw, 12vw"
                        style={{ objectFit: "cover" }}
                        loading="lazy"
                        unoptimized={Boolean(unoptimizedMap[index])}
                        onError={() => handleImgError(index)}
                      />
                    </button>
                  ) : (
                    renderSlotFallback()
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Standard 5+ Photos Collage */}
      {total >= 5 && (
        <div className="grid grid-cols-1 gap-4 aspect-[4/3] sm:aspect-[21/9] md:grid-cols-4">
          <div className="md:col-span-2 relative h-full overflow-hidden rounded-[20px] bg-zinc-100">
            {!failed[selectedIndex] ? (
              <button
                type="button"
                aria-label={`Open photo ${selectedIndex + 1} of ${total}`}
                onClick={handleOpenLightbox}
                onTouchStart={(event) => {
                  touchStartX.current = event.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={handleTouchEnd}
                className="w-full h-full p-0 m-0 block cursor-pointer"
              >
                <div className="relative w-full h-full min-h-[220px]">
                  <Image
                    src={galleryPhotos[selectedIndex]}
                    alt={listingTitle ? `${listingTitle} — Photo ${selectedIndex + 1}` : `Photo ${selectedIndex + 1}`}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    fill
                    style={{ objectFit: "cover" }}
                    priority={selectedIndex === 0}
                    unoptimized={Boolean(unoptimizedMap[selectedIndex])}
                    onError={() => handleImgError(selectedIndex)}
                  />
                </div>
              </button>
            ) : (
              renderSlotFallback()
            )}
          </div>

          <div className="relative hidden h-full grid-cols-2 gap-4 md:col-span-2 md:grid">
            {galleryPhotos.slice(1, 5).map((photo, i) => {
              const index = i + 1;
              const isActive = index === selectedIndex;
              return (
                <button
                  type="button"
                  key={index}
                  onClick={() => handleSelectPhoto(index)}
                  aria-label={`Select photo ${index + 1}`}
                  className={`relative h-full overflow-hidden bg-zinc-100 cursor-pointer hover:opacity-95 transition-opacity rounded-[10px] ${
                    isActive ? "ring-2 ring-amber-400" : ""
                  }`}
                >
                  {!failed[index] ? (
                    <Image
                      src={photo}
                      alt={listingTitle ? `${listingTitle} — Photo ${index + 1}` : `Photo ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      style={{ objectFit: "cover" }}
                      loading="lazy"
                      unoptimized={Boolean(unoptimizedMap[index])}
                      onError={() => handleImgError(index)}
                    />
                  ) : (
                    renderSlotFallback()
                  )}
                </button>
              );
            })}

          </div>
        </div>
      )}

      {total > 1 && (
        <button
          type="button"
          onClick={handleOpenLightbox}
          className="absolute bottom-5 right-5 z-10 hidden items-center gap-2 rounded-full border border-[#1F1F1F] bg-white/95 px-4 py-1.5 text-base font-normal text-[#1f1f1f] shadow-xs transition hover:bg-white md:inline-flex"
        >
          <Image src="/images/icons/camera-mode.svg" alt="" width={18} height={18} className="size-[18px]" />
          {t("listing_gallery_show_all_photos", { count: total }, `Show all ${total} photos`)}
        </button>
      )}

      {/* Mobile Top Navigation & Action Controls */}
      <div className="absolute left-0 top-0 z-10 flex w-full items-start justify-between px-3 pt-3 md:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex size-9 items-center justify-center rounded-full border border-[#1f1f1f]/30 bg-white/95 text-[#1f1f1f] shadow-sm cursor-pointer"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onShare}
            aria-label="Share this listing"
            className="flex size-9 items-center justify-center rounded-full border border-[#1f1f1f]/20 bg-white/95 text-[#1f1f1f] shadow-sm cursor-pointer"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" className="size-5">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.6 10.6 6.8-4.1M8.6 13.4l6.8 4.1" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            aria-pressed={isSaved}
            aria-label={isSaved ? "Remove from wishlist" : "Save listing"}
            className={`flex size-9 items-center justify-center rounded-full border bg-white/95 shadow-sm disabled:opacity-50 cursor-pointer ${
              isSaved ? "border-amber-300 text-amber-800" : "border-[#1f1f1f]/20 text-[#1f1f1f]"
            }`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.55" className="size-5">
              <path d="M12 20.5 3.8 12a5.2 5.2 0 0 1 7.4-7.3L12 5.5l.8-.8a5.2 5.2 0 0 1 7.4 7.3L12 20.5Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Photo Counter */}
      <button
        type="button"
        onClick={handleOpenLightbox}
        className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-[#1f1f1f] shadow-sm md:hidden cursor-pointer"
      >
        <Image src="/images/icons/camera-mode.svg" alt="" width={18} height={18} className="size-[18px]" />
        {selectedIndex + 1}/{total}
      </button>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <ModalOverlay
          role="dialog"
          aria-modal="true"
          aria-label={`${listingTitle || "Property"} photo gallery`}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/90 p-4"
        >
          <div className="max-w-5xl w-full h-full mx-auto my-8">
            <div className="flex items-center justify-between text-white sticky top-0 bg-black/60 backdrop-blur-md py-3 px-2 z-10">
              <span className="font-semibold text-sm">
                {selectedIndex + 1} / {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReportingPhotoUrl(galleryPhotos[selectedIndex])}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition cursor-pointer"
                  aria-label="Report this photo"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                  Report photo
                </button>
                <button
                  type="button"
                  aria-label="Previous photo"
                  disabled={!canGoPrevious}
                  onClick={goToPrevious}
                  className="px-3 py-2 disabled:opacity-35 cursor-pointer text-lg font-bold"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  disabled={!canGoNext}
                  onClick={goToNext}
                  className="px-3 py-2 disabled:opacity-35 cursor-pointer text-lg font-bold"
                >
                  →
                </button>
                <button
                  ref={lightboxCloseBtnRef}
                  aria-label="Close gallery"
                  onClick={closeLightbox}
                  className="px-3 py-2 cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Room-based Photo Tour Filter Bar */}
            {roomCategories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto py-2.5 px-2 [scrollbar-width:none]">
                <button
                  type="button"
                  onClick={() => setActiveRoomFilter(null)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer shrink-0 ${
                    activeRoomFilter === null
                      ? "bg-white text-zinc-950 font-semibold"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  All photos ({galleryPhotos.length})
                </button>
                {roomCategories.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => {
                      setActiveRoomFilter(cat.id);
                      const firstInRoom = galleryPhotos.findIndex(
                        (p) => (roomByUrl.get(p) ?? null) === cat.id,
                      );
                      if (firstInRoom !== -1) setSelectedIndex(firstInRoom);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer shrink-0 ${
                      activeRoomFilter === cat.id
                        ? "bg-amber-400 text-zinc-950 font-semibold"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    {cat.label} ({cat.count})
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 w-full h-full max-h-[75vh]">
              <div className="rounded-2xl overflow-hidden bg-zinc-900 h-full relative">
                {!failed[selectedIndex] ? (
                  <div className="relative w-full h-[70vh]">
                    {roomByUrl.get(galleryPhotos[selectedIndex]) && (
                      <span className="absolute top-4 left-4 z-10 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-medium text-white shadow-sm border border-white/20">
                        {PHOTO_TOUR_CATEGORIES.find((c) => c.id === roomByUrl.get(galleryPhotos[selectedIndex]))?.label || "Room"}
                      </span>
                    )}
                    <Image
                      src={galleryPhotos[selectedIndex]}
                      alt={listingTitle ? `${listingTitle} — Photo ${selectedIndex + 1}` : `Photo ${selectedIndex + 1}`}
                      fill
                      style={{ objectFit: "contain" }}
                      sizes="100vw"
                      unoptimized={Boolean(unoptimizedMap[selectedIndex])}
                      onError={() => handleImgError(selectedIndex)}
                    />
                  </div>
                ) : (
                  renderSlotFallback("Full photo unavailable")
                )}
              </div>

              {/* Lightbox thumbnails */}
              <div className="mt-4 flex gap-2 overflow-x-auto pt-2">
                {galleryPhotos.map((pp, ii) => (
                  <button
                    type="button"
                    key={ii}
                    onClick={() => setSelectedIndex(ii)}
                    className={`relative shrink-0 w-20 h-12 rounded overflow-hidden border cursor-pointer ${
                      ii === selectedIndex ? "ring-2 ring-amber-400" : "border-zinc-200"
                    }`}
                    aria-label={`Lightbox select ${ii + 1}`}
                  >
                    {!failed[ii] ? (
                      <Image
                        src={pp}
                        alt={`Photo ${ii + 1}`}
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="80px"
                        loading="lazy"
                        unoptimized={Boolean(unoptimizedMap[ii])}
                        onError={() => handleImgError(ii)}
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs">—</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {reportingPhotoUrl && (
        <ReportContentModal
          isOpen={Boolean(reportingPhotoUrl)}
          onClose={() => setReportingPhotoUrl(null)}
          targetType="LISTING_PHOTO"
          targetId={reportingPhotoUrl}
          targetTitle={`${listingTitle ? `${listingTitle} — ` : ""}Photo ${selectedIndex + 1}`}
        />
      )}
    </div>
  );
}

export default ListingGallery;
