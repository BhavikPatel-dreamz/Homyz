"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";

type Props = {
  photos: string[];
  listingTitle?: string;
};

export function ListingGallery({ photos, listingTitle }: Props) {
  // Listing.photos is an ordered array: the host editor keeps index 0 as the
  // cover photo. Remove invalid/duplicate URLs without changing that order.
  const galleryPhotos = useMemo(
    () => Array.from(new Set(photos.filter((photo): photo is string => typeof photo === "string" && photo.trim().length > 0))),
    [photos],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleOpenLightbox = useCallback(() => {
    setLightboxOpen(true);
    trackListingEvent({
      eventType: "gallery_opened",
      metadata: { totalPhotos: galleryPhotos.length, initialIndex: selectedIndex },
    });
  }, [galleryPhotos.length, selectedIndex]);

  const handleSelectPhoto = useCallback((index: number) => {
    setSelectedIndex(index);
    trackListingEvent({
      eventType: "gallery_photo_changed",
      metadata: { selectedIndex: index, totalPhotos: galleryPhotos.length },
    });
  }, [galleryPhotos.length]);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const photosRef = useRef(galleryPhotos);
  const touchStartX = useRef<number | null>(null);

  // Reset selection when photos list changes (navigating properties)
  useEffect(() => {
    if (photosRef.current !== galleryPhotos) {
      setSelectedIndex(0);
      setLightboxOpen(false);
      setFailed({});
      photosRef.current = galleryPhotos;
    }
  }, [galleryPhotos]);

  // Preload adjacent images for smooth navigation
  useEffect(() => {
    if (galleryPhotos.length === 0) return;
    const next = galleryPhotos[selectedIndex + 1];
    const prev = galleryPhotos[selectedIndex - 1];
    [prev, next].forEach((src) => {
      if (!src) return;
      const img = new window.Image();
      img.src = src;
    });
  }, [selectedIndex, galleryPhotos]);

  // keyboard handling for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
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
  }, [lightboxOpen, galleryPhotos.length]);

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
    setFailed((p) => ({ ...p, [index]: true }));
  };

  const renderFallback = () => (
    <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-400">
      <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="M3 17l3-3 3 3 4-5 5 6" />
      </svg>
    </div>
  );

  if (total === 0) {
    return (
      <div className="relative mb-8">
        <div className="aspect-[21/9] w-full bg-zinc-100 flex flex-col items-center justify-center text-zinc-400">
          <span className="text-4xl mb-2">🏡</span>
          <span className="text-xs font-medium">No property photos uploaded</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-8">
      <div className="grid grid-cols-1 gap-4 aspect-[4/3] sm:aspect-[21/9] md:grid-cols-4">
        <div className={`${total > 1 ? "md:col-span-2" : "md:col-span-4"} relative h-full overflow-hidden rounded-[20px] bg-zinc-100`}>
          {!failed[selectedIndex] ? (
            <button
              type="button"
              aria-label={`Open photo ${selectedIndex + 1} of ${total}`}
              onClick={handleOpenLightbox}
              onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
              onTouchEnd={handleTouchEnd}
              className="w-full h-full p-0 m-0 block"
            >
              <div className="relative w-full h-[100%] min-h-[220px]">
                <Image
                  src={galleryPhotos[selectedIndex]}
                  alt={listingTitle ? `${listingTitle} — Photo ${selectedIndex + 1}` : `Photo ${selectedIndex + 1}`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  fill
                  style={{ objectFit: "cover" }}
                  priority={selectedIndex === 0}
                  onError={() => handleImgError(selectedIndex)}
                />
              </div>
            </button>
          ) : (
            renderFallback()
          )}
        </div>

        {total > 1 && <div className="relative hidden h-full grid-cols-2 gap-4 md:col-span-2 md:grid">
          {galleryPhotos.slice(1, 5).map((photo, i) => {
            const index = i + 1;
            const isActive = index === selectedIndex;
            return (
              <button
                type="button"
                key={index}
                onClick={() => handleSelectPhoto(index)}
                aria-label={`Select photo ${index + 1}`}
                className={`relative h-full overflow-hidden bg-zinc-100 cursor-pointer hover:opacity-95 transition-opacity rounded-[10px] ${isActive ? "ring-2 ring-amber-400" : ""}`}
              >
                {!failed[index] ? (
                  <Image
                    src={photo}
                    alt={listingTitle ? `${listingTitle} — Photo ${index + 1}` : `Photo ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    style={{ objectFit: "cover" }}
                    loading={index === 0 ? "eager" : "lazy"}
                    onError={() => handleImgError(index)}
                  />
                ) : (
                  renderFallback()
                )}
              </button>
            );
          })}
          {total > 5 && (
            <button type="button" onClick={handleOpenLightbox} className="absolute bottom-4 right-4 z-10 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-white">
              Show all {total} photos
            </button>
          )}
        </div>}
      </div>

      {/* Thumbnails on mobile below main image */}
      <div className="md:hidden mt-2 flex gap-2 overflow-x-auto pb-1">
        {galleryPhotos.map((p, i) => (
          <button
            type="button"
            key={i}
            onClick={() => handleSelectPhoto(i)}
            aria-label={`Select photo ${i + 1}`}
            className={`relative shrink-0 w-20 h-12 rounded overflow-hidden border ${i === selectedIndex ? "ring-2 ring-amber-400" : "border-zinc-200"}`}
          >
            {!failed[i] ? (
              <Image
                src={p}
                alt={listingTitle ? `${listingTitle} — Photo ${i + 1}` : `Photo ${i + 1}`}
                fill
                sizes="80px"
                style={{ objectFit: "cover" }}
                loading="lazy"
                onError={() => handleImgError(i)}
              />
            ) : (
              <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-400">—</div>
            )}
          </button>
        ))}
      </div>

      {/* Counter & Open */}
      {/* <div className="absolute right-4 bottom-4 rounded-full bg-white/90 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-md hover:bg-white transition-all cursor-pointer border border-zinc-200 flex items-center gap-2">
        <span>{selectedIndex + 1} / {total}</span>
        <button type="button" onClick={handleOpenLightbox} className="text-xs font-medium text-zinc-700 underline">Open</button>
      </div>*/}

      {lightboxOpen && (
        <ModalOverlay role="dialog" aria-modal="true" aria-label={`${listingTitle || "Property"} photo gallery`} className="fixed inset-0 z-50 overflow-y-auto bg-black/90 p-4">
          <div className="max-w-5xl w-full mx-auto my-8">
            <div className="flex items-center justify-between text-white sticky top-0 bg-black/60 backdrop-blur-md py-3 px-2 z-10">
              <span className="font-semibold text-sm">{selectedIndex + 1} / {total}</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous photo" disabled={!canGoPrevious} onClick={goToPrevious} className="px-3 py-2 disabled:opacity-35">←</button>
                <button type="button" aria-label="Next photo" disabled={!canGoNext} onClick={goToNext} className="px-3 py-2 disabled:opacity-35">→</button>
                <button aria-label="Close gallery" onClick={() => setLightboxOpen(false)} className="px-3 py-2">✕</button>
              </div>
            </div>

            <div className="mt-4">
              <div className="rounded-2xl overflow-hidden bg-zinc-900">
                {!failed[selectedIndex] ? (
                  <div className="relative w-full h-[70vh]">
                    <Image
                      src={galleryPhotos[selectedIndex]}
                      alt={listingTitle ? `${listingTitle} — Photo ${selectedIndex + 1}` : `Photo ${selectedIndex + 1}`}
                      fill
                      style={{ objectFit: "contain" }}
                      sizes="100vw"
                      onError={() => handleImgError(selectedIndex)}
                    />
                  </div>
                ) : (
                  renderFallback()
                )}
              </div>

              {/* Lightbox thumbnails */}
              <div className="mt-4 flex gap-2 overflow-x-auto pt-2">
                {galleryPhotos.map((pp, ii) => (
                  <button type="button" key={ii} onClick={() => setSelectedIndex(ii)} className={`relative shrink-0 w-20 h-12 rounded overflow-hidden border ${ii === selectedIndex ? "ring-2 ring-amber-400" : "border-zinc-200"}`} aria-label={`Lightbox select ${ii + 1}`}>
                    {!failed[ii] ? (
                      <Image src={pp} alt={`Photo ${ii + 1}`} fill style={{ objectFit: "cover" }} sizes="80px" loading="lazy" onError={() => handleImgError(ii)} />
                    ) : (
                      <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-400">—</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

export default ListingGallery;
