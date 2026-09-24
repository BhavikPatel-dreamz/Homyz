"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";

type Props = {
  photos: string[];
  listingTitle?: string;
  onShare?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  saveDisabled?: boolean;
};

export function ListingGallery({ photos, listingTitle, onShare, onSave, isSaved = false, saveDisabled = false }: Props) {
  const router = useRouter();
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
    <div className="relative mb-6 lg:mb-8">
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
            <button type="button" onClick={handleOpenLightbox} className="absolute bottom-5 right-5 z-10 inline-flex items-center gap-2 rounded-full border border-[#1F1F1F] bg-white/95 px-4 py-1.5 text-base font-normal text-[#1f1f1f] transition hover:bg-white">
              <Image src="/images/icons/camera-mode.svg" alt="" width={18} height={18} className="size-[18px]" />
              Show all {total} photos
            </button>
          )}
        </div>}

        {total > 0 && (
          <button
            type="button"
            onClick={handleOpenLightbox}
            className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1f1f]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>{total > 1 ? `Show all ${total} photos` : "Show photo"}</span>
          </button>
        )}
      </div>

      <div className="absolute left-0 top-0 z-10 flex w-full items-start justify-between px-3 pt-3 md:hidden">
        <button type="button" onClick={() => router.back()} aria-label="Go back" className="flex size-9 items-center justify-center rounded-full border border-[#1f1f1f]/30 bg-white/95 text-[#1f1f1f] shadow-sm">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onShare} aria-label="Share this listing" className="flex size-9 items-center justify-center rounded-full border border-[#1f1f1f]/20 bg-white/95 text-[#1f1f1f] shadow-sm">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" className="size-5"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.6 6.8-4.1M8.6 13.4l6.8 4.1" /></svg>
          </button>
          <button type="button" onClick={onSave} disabled={saveDisabled} aria-pressed={isSaved} aria-label={isSaved ? "Remove from wishlist" : "Save listing"} className={`flex size-9 items-center justify-center rounded-full border bg-white/95 shadow-sm disabled:opacity-50 ${isSaved ? "border-amber-300 text-amber-800" : "border-[#1f1f1f]/20 text-[#1f1f1f]"}`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.55" className="size-5"><path d="M12 20.5 3.8 12a5.2 5.2 0 0 1 7.4-7.3L12 5.5l.8-.8a5.2 5.2 0 0 1 7.4 7.3L12 20.5Z" /></svg>
          </button>
        </div>
      </div>

      <button type="button" onClick={handleOpenLightbox} className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-[#1f1f1f] shadow-sm md:hidden">
        <Image src="/images/icons/camera-mode.svg" alt="" width={18} height={18} className="size-[18px]" />
        {selectedIndex + 1}/{total}
      </button>

      {/* Thumbnails on mobile below main image */}
      <div className="hidden mt-2 gap-2 overflow-x-auto pb-1">
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
          <div className="max-w-5xl w-full h-full mx-auto my-8">
            <div className="flex items-center justify-between text-white sticky top-0 bg-black/60 backdrop-blur-md py-3 px-2 z-10">
              <span className="font-semibold text-sm">{selectedIndex + 1} / {total}</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous photo" disabled={!canGoPrevious} onClick={goToPrevious} className="px-3 py-2 disabled:opacity-35">←</button>
                <button type="button" aria-label="Next photo" disabled={!canGoNext} onClick={goToNext} className="px-3 py-2 disabled:opacity-35">→</button>
                <button aria-label="Close gallery" onClick={() => setLightboxOpen(false)} className="px-3 py-2">✕</button>
              </div>
            </div>

            <div className="mt-4 w-full h-full max-h-[75vh]">
              <div className="rounded-2xl overflow-hidden bg-zinc-900 h-full">
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
