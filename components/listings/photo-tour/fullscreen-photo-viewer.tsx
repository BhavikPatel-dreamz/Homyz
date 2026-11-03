"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { ReportContentModal } from "@/components/moderation/report-content-modal";
import type { TourPhotoItem } from "@/lib/listing/photo-tour-view-model";

export type FullscreenPhotoViewerProps = {
  photos: TourPhotoItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  listingTitle?: string;
  onShare?: () => void;
};

export function FullscreenPhotoViewer({
  photos,
  initialIndex,
  isOpen,
  onClose,
  listingTitle,
  onShare,
}: FullscreenPhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, Math.min(photos.length - 1, initialIndex)),
  );
  const [reportingPhotoUrl, setReportingPhotoUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({});
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [unoptimizedMap, setUnoptimizedMap] = useState<Record<number, boolean>>({});

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button on mount
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Lock background scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const total = photos.length;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < total - 1;

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(total - 1, prev + 1));
  }, [total]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, goToPrevious, goToNext]);

  // Preload adjacent images
  useEffect(() => {
    if (!isOpen || total === 0) return;
    const nextPhoto = photos[currentIndex + 1];
    const prevPhoto = photos[currentIndex - 1];
    [prevPhoto, nextPhoto].forEach((photo) => {
      if (!photo) return;
      const img = new window.Image();
      img.src = photo.url;
    });
  }, [isOpen, currentIndex, photos, total]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (!isOpen || !thumbnailStripRef.current) return;
    const activeThumbnail = thumbnailStripRef.current.querySelector<HTMLButtonElement>(
      `[data-thumb-index="${currentIndex}"]`,
    );
    if (activeThumbnail) {
      activeThumbnail.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [isOpen, currentIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Only swipe if horizontal move is significantly larger than vertical move
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX > 0) goToPrevious();
      else goToNext();
    }
  };

  const handleImgError = (index: number) => {
    if (!unoptimizedMap[index]) {
      setUnoptimizedMap((prev) => ({ ...prev, [index]: true }));
    } else {
      setFailed((prev) => ({ ...prev, [index]: true }));
    }
  };

  if (!isOpen || total === 0) return null;

  const currentPhoto = photos[currentIndex] || photos[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${listingTitle || "Property"} fullscreen photo viewer`}
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white select-none overflow-hidden"
    >
      {/* Top Header */}
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between px-4 md:px-6 bg-black/70 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close photo viewer"
            className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <span className="text-sm font-medium text-white/90">
            {currentIndex + 1} / {total}
          </span>

          {currentPhoto.roomName && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 border border-white/10">
              {currentPhoto.roomName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              aria-label="Share listing"
              className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="m8.6 10.6 6.8-4.1M8.6 13.4l6.8 4.1" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => setReportingPhotoUrl(currentPhoto.url)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/20 transition cursor-pointer"
            aria-label="Report this photo"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            <span className="hidden sm:inline">Report photo</span>
          </button>
        </div>
      </header>

      {/* Main Image Stage */}
      <main
        className="relative flex flex-1 items-center justify-center p-3 md:p-6 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation Arrow Previous */}
        <button
          type="button"
          onClick={goToPrevious}
          disabled={!canGoPrevious}
          aria-label="Previous photo"
          className="absolute left-4 z-20 hidden md:flex size-12 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white backdrop-blur-md transition hover:bg-black/80 disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Selected Image */}
        <div className="relative h-full w-full max-h-[82vh] max-w-6xl flex items-center justify-center">
          {!failed[currentIndex] ? (
            <>
              {!imageLoaded[currentIndex] && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
              )}
              <Image
                src={currentPhoto.url}
                alt={currentPhoto.caption || `${listingTitle || "Property"} — Photo ${currentIndex + 1}`}
                fill
                style={{ objectFit: "contain" }}
                sizes="100vw"
                priority
                unoptimized={Boolean(unoptimizedMap[currentIndex])}
                onLoad={() => setImageLoaded((prev) => ({ ...prev, [currentIndex]: true }))}
                onError={() => handleImgError(currentIndex)}
                className={`transition-opacity duration-200 ${
                  imageLoaded[currentIndex] ? "opacity-100" : "opacity-0"
                }`}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 text-zinc-400">
              <div className="size-14 rounded-full bg-zinc-800 flex items-center justify-center mb-3 text-zinc-500">
                <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-300">Photo unavailable</p>
              <p className="text-xs text-zinc-500 mt-1 font-normal">This photo could not be loaded at full resolution.</p>
            </div>
          )}
        </div>

        {/* Navigation Arrow Next */}
        <button
          type="button"
          onClick={goToNext}
          disabled={!canGoNext}
          aria-label="Next photo"
          className="absolute right-4 z-20 hidden md:flex size-12 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white backdrop-blur-md transition hover:bg-black/80 disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Caption Overlay if present */}
        {currentPhoto.caption && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 max-w-lg rounded-full bg-black/60 backdrop-blur-md px-4 py-1.5 text-center text-xs font-normal text-white/90 border border-white/15">
            {currentPhoto.caption}
          </div>
        )}
      </main>

      {/* Bottom Thumbnails Strip */}
      <footer className="relative z-20 shrink-0 bg-black/80 backdrop-blur-md border-t border-white/10 px-4 py-3">
        <div
          ref={thumbnailStripRef}
          className="flex items-center gap-2 overflow-x-auto py-1 px-1 [scrollbar-width:none] max-w-5xl mx-auto"
        >
          {photos.map((item, index) => {
            const isActive = index === currentIndex;
            return (
              <button
                key={item.id}
                type="button"
                data-thumb-index={index}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Jump to photo ${index + 1}`}
                aria-current={isActive ? "true" : undefined}
                className={`relative shrink-0 h-13 w-20 rounded-lg overflow-hidden transition-all cursor-pointer ${
                  isActive
                    ? "ring-2 ring-white scale-105 opacity-100 shadow-md"
                    : "opacity-45 hover:opacity-85 border border-white/20"
                }`}
              >
                {!failed[index] ? (
                  <Image
                    src={item.url}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="80px"
                    loading="lazy"
                    unoptimized={Boolean(unoptimizedMap[index])}
                    onError={() => handleImgError(index)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[10px] text-zinc-500">
                    —
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </footer>

      {/* Report Modal Integration */}
      {reportingPhotoUrl && (
        <ReportContentModal
          isOpen={Boolean(reportingPhotoUrl)}
          onClose={() => setReportingPhotoUrl(null)}
          targetType="LISTING_PHOTO"
          targetId={reportingPhotoUrl}
          targetTitle={`${listingTitle ? `${listingTitle} — ` : ""}Photo ${currentIndex + 1}`}
        />
      )}
    </div>
  );
}

export default FullscreenPhotoViewer;
