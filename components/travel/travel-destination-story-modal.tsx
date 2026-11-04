"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
const X = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
const ChevronLeft = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);
const ChevronRight = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);
import type { TravelPhotoDTO } from "@/types/travel";
import { toast } from "@/components/ui/toast";

interface TravelDestinationStoryModalProps {
  country: string;
  userId?: string;
  isOpen: boolean;
  onClose: () => void;
  reloadKey?: number;
  isOwner?: boolean;
  onUploadPhotos?: (country: string) => void;
  onManageTrips?: (country: string) => void;
}

export function TravelDestinationStoryModal({
  country,
  userId,
  isOpen,
  onClose,
  reloadKey = 0,
  isOwner = false,
  onUploadPhotos,
  onManageTrips,
}: TravelDestinationStoryModalProps) {
  const [photos, setPhotos] = useState<TravelPhotoDTO[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const photosCacheRef = useRef(new Map<string, TravelPhotoDTO[]>());
  const touchStartXRef = useRef<number | null>(null);

  const loadPhotos = useCallback(async () => {
    if (!isOpen || !country) return;
    const requestId = ++requestIdRef.current;
    const cacheKey = `${userId || "current"}:${country.toLowerCase()}:${reloadKey}`;
    const cached = photosCacheRef.current.get(cacheKey);
    if (cached) {
      setPhotos(cached);
      setCurrentIndex(0);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ country, limit: "50" });
      if (userId) params.set("userId", userId);
      const res = await fetch(`/api/v1/travel-media/photos?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load photos");
      if (requestId !== requestIdRef.current) return;
      const receivedPhotos = data.photos || [];
      photosCacheRef.current.set(cacheKey, receivedPhotos);
      setPhotos(receivedPhotos);
      setCurrentIndex(0);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      toast.error(
        err instanceof Error
          ? err.message
          : "Unable to load destination photos",
      );
      setPhotos([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load destination photos",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [country, isOpen, reloadKey, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPhotos(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPhotos]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")
        setCurrentIndex((i) =>
          photos.length ? (i - 1 + photos.length) % photos.length : i,
        );
      if (e.key === "ArrowRight")
        setCurrentIndex((i) => (photos.length ? (i + 1) % photos.length : i));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, photos.length]);

  if (!isOpen) return null;

  const photo = photos[currentIndex];
  const goPrevious = () =>
    setCurrentIndex((index) =>
      photos.length ? (index - 1 + photos.length) % photos.length : index,
    );
  const goNext = () =>
    setCurrentIndex((index) =>
      photos.length ? (index + 1) % photos.length : index,
    );

  const handleTouchEnd = (event: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    const distance = event.changedTouches[0]?.clientX - startX;
    if (Math.abs(distance) < 40 || photos.length < 2) return;
    if (distance > 0) goPrevious();
    else goNext();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${country} travel story`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium">
        {country}
      </div>
      {photos.length > 0 && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex gap-1">
          {photos.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 w-12 rounded-full ${i === currentIndex ? "bg-white" : "bg-white/40"}`}
            />
          ))}
        </div>
      )}
      {loading ? (
        <div className="text-white/80 text-sm">Loading...</div>
      ) : photos.length === 0 ? (
        <div className="w-full max-w-sm px-6 text-center text-white">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-white/10 text-2xl">
            ✈️
          </div>
          <h2 className="mt-4 text-lg font-medium">No travel photos yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            {error || "You haven't added any photos for this destination."}
          </p>
          {isOwner && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {onUploadPhotos && (
                <button
                  type="button"
                  onClick={() => onUploadPhotos(country)}
                  className="rounded-full bg-white px-4 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200"
                >
                  Upload Photos
                </button>
              )}
              
            </div>
          )}
        </div>
      ) : (
        <div
          className="relative w-full h-full max-w-4xl max-h-[90vh] flex items-center justify-center px-10"
          onTouchStart={(event) => {
            touchStartXRef.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={handleTouchEnd}
        >
          {photos.length > 1 && (
            <button
              type="button"
              onClick={goPrevious}
              aria-label="Previous destination photo"
              className="absolute left-2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="relative w-full h-full">
            <Image
              src={photo.mediumUrl || photo.url}
              alt={photo.caption || country}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
          {photos.length > 1 && (
            <button
              type="button"
              onClick={goNext}
              aria-label="Next destination photo"
              className="absolute right-2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-xs text-center max-w-md px-4">
            <div className="font-medium">{photo.location || country}</div>
            {photo.tripTitle && (
              <div className="mt-1 text-white/70">{photo.tripTitle}</div>
            )}
            {photo.caption && (
              <div className="mt-1 opacity-90">{photo.caption}</div>
            )}
            <div className="mt-1 opacity-70">
              {currentIndex + 1} / {photos.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
