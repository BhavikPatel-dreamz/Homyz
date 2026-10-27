"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { TravelTripDTO } from "@/types/travel";

interface TravelTripSliderModalProps {
  trip: TravelTripDTO;
  isOpen: boolean;
  onClose: () => void;
  onOpenPhotoDetail?: (photoId: string) => void;
}

export function TravelTripSliderModal({
  trip,
  isOpen,
  onClose,
  onOpenPhotoDetail,
}: TravelTripSliderModalProps) {
  const photos = trip.photos || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (photos.length < 2) return;
      if (event.key === "ArrowLeft") setCurrentIndex((index) => (index - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") setCurrentIndex((index) => (index + 1) % photos.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, photos.length]);

  if (!isOpen) return null;

  const currentPhoto = photos[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null || photos.length < 2) return;
    const distance = event.changedTouches[0]?.clientX - startX;
    if (Math.abs(distance) < 40) return;
    setCurrentIndex((index) => distance > 0
      ? (index - 1 + photos.length) % photos.length
      : (index + 1) % photos.length);
  };

  return (
    <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in">
      <div
        className="relative flex flex-col max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-zinc-950 text-white shadow-2xl border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4 bg-zinc-900/60">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span>✈️</span> {trip.title}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {photos.length} photo{photos.length === 1 ? "" : "s"}
              {trip.destinationId ? ` · ${trip.destinationId}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trip slider"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Main Body */}
        <div className="relative flex-1 flex flex-col items-center justify-center min-h-[360px] sm:min-h-[460px] bg-black">
          {photos.length > 0 && currentPhoto ? (
            <>
              {/* Photo View */}
              <div
                className="relative w-full h-[360px] sm:h-[480px] cursor-pointer"
                onClick={() => onOpenPhotoDetail?.(currentPhoto.id)}
                onTouchStart={(event) => { touchStartXRef.current = event.touches[0]?.clientX ?? null; }}
                onTouchEnd={handleTouchEnd}
              >
                <Image
                  src={currentPhoto.url || currentPhoto.mediumUrl || ""}
                  alt={currentPhoto.caption || trip.title}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 896px"
                  priority
                />
              </div>

              {/* Navigation arrows */}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous photo"
                    className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 backdrop-blur-xs transition shadow-lg"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next photo"
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 backdrop-blur-xs transition shadow-lg"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Caption Overlay */}
              <div className="w-full bg-zinc-900/90 border-t border-zinc-800 px-6 py-3 flex items-center justify-between text-xs text-zinc-300">
                <div className="truncate">
                  {currentPhoto.caption ? (
                    <span className="font-medium text-white">{currentPhoto.caption}</span>
                  ) : (
                    <span className="text-zinc-500 italic">No caption</span>
                  )}
                  {currentPhoto.location && (
                    <span className="ml-2 text-zinc-400">📍 {currentPhoto.location}</span>
                  )}
                </div>
                <div className="shrink-0 font-mono text-[11px] text-zinc-400">
                  {currentIndex + 1} / {photos.length}
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-zinc-400">
              <p className="text-sm">No photos uploaded to this trip yet.</p>
            </div>
          )}
        </div>

        {/* Thumbnail bar */}
        {photos.length > 1 && (
          <div className="flex gap-2 p-3 bg-zinc-900 border-t border-zinc-800 overflow-x-auto no-scrollbar justify-center">
            {photos.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                  idx === currentIndex
                    ? "border-amber-400 opacity-100 scale-105"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <Image
                  src={p.thumbnailUrl || p.mediumUrl || p.url}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
