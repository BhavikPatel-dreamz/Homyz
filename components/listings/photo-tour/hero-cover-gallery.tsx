"use client";

import React, { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export type HeroCoverGalleryProps = {
  photos: string[];
  listingTitle?: string;
  onOpenPhotoTour: () => void;
  onSelectPhoto: (index: number) => void;
  onShare?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  saveDisabled?: boolean;
};

export function HeroCoverGallery({
  photos,
  listingTitle,
  onOpenPhotoTour,
  onSelectPhoto,
  onShare,
  onSave,
  isSaved = false,
  saveDisabled = false,
}: HeroCoverGalleryProps) {
  const router = useRouter();
  const [mobileIndex, setMobileIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [unoptimizedMap, setUnoptimizedMap] = useState<Record<number, boolean>>({});

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const total = photos.length;

  const handleImgError = useCallback((index: number) => {
    if (!unoptimizedMap[index]) {
      setUnoptimizedMap((prev) => ({ ...prev, [index]: true }));
    } else {
      setFailed((prev) => ({ ...prev, [index]: true }));
    }
  }, [unoptimizedMap]);

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

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX > 0) {
        setMobileIndex((prev) => Math.max(0, prev - 1));
      } else {
        setMobileIndex((prev) => Math.min(total - 1, prev + 1));
      }
    }
  };

  if (total === 0) {
    return (
      <div className="relative mb-6 lg:mb-8">
        <div className="aspect-[4/3] sm:aspect-[21/9] w-full rounded-2xl border border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center text-center p-6 shadow-2xs">
          <div className="size-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl mb-3 shadow-2xs">
            🏡
          </div>
          <p className="text-base font-medium text-[#1f1f1f]">
            Photos not available
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm font-normal">
            Photos for this listing are currently unavailable or being updated by the host.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-6 lg:mb-8" aria-label="Property photos collage">
      {/* MOBILE EXPERIENCE (< 768px): Swipeable Carousel */}
      <div className="block md:hidden">
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-zinc-100"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {!failed[mobileIndex] ? (
            <button
              type="button"
              onClick={() => onSelectPhoto(mobileIndex)}
              aria-label={`Open photo ${mobileIndex + 1} of ${total}`}
              className="relative h-full w-full block cursor-pointer p-0 m-0"
            >
              <Image
                src={photos[mobileIndex]}
                alt={listingTitle ? `${listingTitle} — Photo ${mobileIndex + 1}` : `Photo ${mobileIndex + 1}`}
                fill
                style={{ objectFit: "cover" }}
                sizes="100vw"
                priority={mobileIndex === 0}
                unoptimized={Boolean(unoptimizedMap[mobileIndex])}
                onError={() => handleImgError(mobileIndex)}
              />
            </button>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-400 text-xs">
              Photo unavailable
            </div>
          )}

          {/* Mobile Top Controls: Back, Share, Save */}
          <div className="absolute left-0 top-0 z-10 flex w-full items-center justify-between p-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex size-9 items-center justify-center rounded-full bg-white/90 text-[#1f1f1f] shadow-sm backdrop-blur-xs cursor-pointer"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {onShare && (
                <button
                  type="button"
                  onClick={onShare}
                  aria-label="Share listing"
                  className="flex size-9 items-center justify-center rounded-full bg-white/90 text-[#1f1f1f] shadow-sm backdrop-blur-xs cursor-pointer"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="m8.6 10.6 6.8-4.1M8.6 13.4l6.8 4.1" />
                  </svg>
                </button>
              )}

              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saveDisabled}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? "Remove from wishlist" : "Save listing"}
                  className={`flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-xs transition cursor-pointer ${
                    isSaved ? "text-red-600" : "text-[#1f1f1f]"
                  }`}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" className="size-4">
                    <path d="M12 20.5 3.8 12a5.2 5.2 0 0 1 7.4-7.3L12 5.5l.8-.8a5.2 5.2 0 0 1 7.4 7.3L12 20.5Z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Bottom Badge: Counter & Show Tour Trigger */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenPhotoTour}
              aria-label={`Show all ${total} photos`}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white shadow-sm cursor-pointer hover:bg-black/80 transition"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span>{mobileIndex + 1} / {total}</span>
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP & TABLET EXPERIENCE (>= 768px): Airbnb Hero Grid */}
      <div className="hidden md:block">
        {/* 1 Photo Layout */}
        {total === 1 && (
          <div className="aspect-[21/9] w-full relative overflow-hidden rounded-2xl bg-zinc-100">
            <HeroImageCard
              url={photos[0]}
              index={0}
              total={1}
              listingTitle={listingTitle}
              onClick={() => onSelectPhoto(0)}
              priority
              failed={failed[0]}
              unoptimized={Boolean(unoptimizedMap[0])}
              onError={() => handleImgError(0)}
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
          </div>
        )}

        {/* 2 Photos Layout */}
        {total === 2 && (
          <div className="grid grid-cols-2 gap-2 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-zinc-100">
            {photos.slice(0, 2).map((url, idx) => (
              <div key={idx} className="relative h-full w-full overflow-hidden">
                <HeroImageCard
                  url={url}
                  index={idx}
                  total={2}
                  listingTitle={listingTitle}
                  onClick={() => onSelectPhoto(idx)}
                  priority={idx === 0}
                  failed={failed[idx]}
                  unoptimized={Boolean(unoptimizedMap[idx])}
                  onError={() => handleImgError(idx)}
                  sizes="50vw"
                />
              </div>
            ))}
          </div>
        )}

        {/* 3 Photos Layout */}
        {total === 3 && (
          <div className="grid grid-cols-3 gap-2 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-zinc-100">
            <div className="col-span-2 relative h-full w-full overflow-hidden">
              <HeroImageCard
                url={photos[0]}
                index={0}
                total={3}
                listingTitle={listingTitle}
                onClick={() => onSelectPhoto(0)}
                priority
                failed={failed[0]}
                unoptimized={Boolean(unoptimizedMap[0])}
                onError={() => handleImgError(0)}
                sizes="66vw"
              />
            </div>
            <div className="flex flex-col gap-2 h-full">
              {photos.slice(1, 3).map((url, idx) => {
                const globalIdx = idx + 1;
                return (
                  <div key={globalIdx} className="relative flex-1 w-full overflow-hidden">
                    <HeroImageCard
                      url={url}
                      index={globalIdx}
                      total={3}
                      listingTitle={listingTitle}
                      onClick={() => onSelectPhoto(globalIdx)}
                      failed={failed[globalIdx]}
                      unoptimized={Boolean(unoptimizedMap[globalIdx])}
                      onError={() => handleImgError(globalIdx)}
                      sizes="33vw"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4 Photos Layout */}
        {total === 4 && (
          <div className="grid grid-cols-4 gap-2 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-zinc-100">
            <div className="col-span-2 relative h-full w-full overflow-hidden">
              <HeroImageCard
                url={photos[0]}
                index={0}
                total={4}
                listingTitle={listingTitle}
                onClick={() => onSelectPhoto(0)}
                priority
                failed={failed[0]}
                unoptimized={Boolean(unoptimizedMap[0])}
                onError={() => handleImgError(0)}
                sizes="50vw"
              />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-2 h-full">
              {photos.slice(1, 4).map((url, idx) => {
                const globalIdx = idx + 1;
                const isSpanTwo = idx === 0;
                return (
                  <div
                    key={globalIdx}
                    className={`relative w-full overflow-hidden ${
                      isSpanTwo ? "col-span-2 h-full" : "h-full"
                    }`}
                  >
                    <HeroImageCard
                      url={url}
                      index={globalIdx}
                      total={4}
                      listingTitle={listingTitle}
                      onClick={() => onSelectPhoto(globalIdx)}
                      failed={failed[globalIdx]}
                      unoptimized={Boolean(unoptimizedMap[globalIdx])}
                      onError={() => handleImgError(globalIdx)}
                      sizes="25vw"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5+ Photos Airbnb Layout (1 Left, 4 Right in 2x2 grid) */}
        {total >= 5 && (
          <div className="grid grid-cols-4 gap-2 aspect-[21/9] min-h-[420px] max-h-[560px] w-full overflow-hidden rounded-2xl bg-zinc-100">
            {/* Primary Cover Image: Left col-span-2 */}
            <div className="col-span-2 relative h-full w-full overflow-hidden">
              <HeroImageCard
                url={photos[0]}
                index={0}
                total={total}
                listingTitle={listingTitle}
                onClick={() => onSelectPhoto(0)}
                priority
                failed={failed[0]}
                unoptimized={Boolean(unoptimizedMap[0])}
                onError={() => handleImgError(0)}
                sizes="(max-width: 1200px) 50vw, 600px"
              />
            </div>

            {/* 4 Supporting Images: Right 2x2 grid */}
            <div className="col-span-2 grid grid-cols-2 grid-rows-2 gap-2 h-full">
              {photos.slice(1, 5).map((url, i) => {
                const index = i + 1;
                return (
                  <div key={index} className="relative h-full w-full overflow-hidden">
                    <HeroImageCard
                      url={url}
                      index={index}
                      total={total}
                      listingTitle={listingTitle}
                      onClick={() => onSelectPhoto(index)}
                      failed={failed[index]}
                      unoptimized={Boolean(unoptimizedMap[index])}
                      onError={() => handleImgError(index)}
                      sizes="(max-width: 1200px) 25vw, 300px"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* "Show all photos" floating action button (bottom-right) */}
        {total > 1 && (
          <button
            type="button"
            onClick={onOpenPhotoTour}
            aria-label={`Show all ${total} photos`}
            className="absolute bottom-5 right-5 z-10 inline-flex items-center gap-2 rounded-xl border border-zinc-900/20 bg-white/95 px-4 py-2 text-sm font-medium text-[#1f1f1f] shadow-sm backdrop-blur-xs transition hover:bg-white hover:scale-[1.02] cursor-pointer"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>Show all {total} photos</span>
          </button>
        )}
      </div>
    </div>
  );
}

type HeroImageCardProps = {
  url: string;
  index: number;
  total: number;
  listingTitle?: string;
  onClick: () => void;
  priority?: boolean;
  failed?: boolean;
  unoptimized?: boolean;
  onError: () => void;
  sizes: string;
};

function HeroImageCard({
  url,
  index,
  total,
  listingTitle,
  onClick,
  priority = false,
  failed = false,
  unoptimized = false,
  onError,
  sizes,
}: HeroImageCardProps) {
  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-400 text-xs">
        Photo unavailable
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View photo ${index + 1} of ${total}`}
      className="group relative h-full w-full block cursor-pointer p-0 m-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
    >
      <Image
        src={url}
        alt={listingTitle ? `${listingTitle} — Photo ${index + 1}` : `Property photo ${index + 1}`}
        fill
        style={{ objectFit: "cover" }}
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        unoptimized={unoptimized}
        onError={onError}
        className="transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
    </button>
  );
}

export default HeroCoverGallery;

