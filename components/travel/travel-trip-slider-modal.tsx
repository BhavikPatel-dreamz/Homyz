"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { TravelTripDTO } from "@/types/travel";
import { toast } from "@/components/ui/toast";

interface TravelTripSliderModalProps {
  trip: TravelTripDTO;
  isOpen: boolean;
  onClose: () => void;
  onOpenPhotoDetail?: (photoId: string) => void;
  onTripLikeUpdated?: (update: { tripId: string; liked: boolean; likesCount: number; profileLikes?: number | null }) => void;
  shareUrl?: string | null;
  canLike?: boolean;
  isOwner?: boolean;
  onManageTrip?: () => void;
}

export function TravelTripSliderModal({
  trip,
  isOpen,
  onClose,
  onOpenPhotoDetail,
  onTripLikeUpdated,
  shareUrl = null,
  canLike = false,
  isOwner = false,
  onManageTrip,
}: TravelTripSliderModalProps) {
  const photos = trip.photos || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState(Boolean(trip.isLiked));
  const [likesCount, setLikesCount] = useState(trip.likesCount || 0);
  const [isLiking, setIsLiking] = useState(false);
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
  const toggleLike = async () => {
    if (isLiking) return;
    const previous = { liked, likesCount };
    const nextLiked = !liked;
    const nextCount = Math.max(0, likesCount + (liked ? -1 : 1));
    setIsLiking(true); setLiked(nextLiked); setLikesCount(nextCount);
    onTripLikeUpdated?.({ tripId: trip.id, liked: nextLiked, likesCount: nextCount });
    try {
      const response = await fetch(`/api/v1/travel-media/trips/${trip.id}/like`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update trip like.");
      setLiked(data.liked); setLikesCount(data.count);
      onTripLikeUpdated?.({ tripId: trip.id, liked: data.liked, likesCount: data.count, profileLikes: data.profileLikes });
    } catch (error) { setLiked(previous.liked); setLikesCount(previous.likesCount); onTripLikeUpdated?.({ tripId: trip.id, liked: previous.liked, likesCount: previous.likesCount }); toast.error(error instanceof Error ? error.message : "Unable to update trip like."); }
    finally { setIsLiking(false); }
  };
  const shareTrip = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: trip.title, text: `Explore ${trip.title} on Homyz`, url: shareUrl });
      else await navigator.clipboard.writeText(shareUrl);
    } catch { /* cancellation is not an error */ }
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
              {trip.destination?.countryName ? ` · ${trip.destination.countryName}` : ""}
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

        <div className="absolute right-16 top-4 z-10 flex gap-2">
          {shareUrl && <button type="button" onClick={() => void shareTrip()} className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700">Share</button>}
          {canLike && <button type="button" onClick={() => void toggleLike()} disabled={isLiking} aria-pressed={liked} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${liked ? "bg-rose-500 text-white" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"}`}>♥ {likesCount}</button>}
          {isOwner && onManageTrip && <button type="button" onClick={onManageTrip} className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700">Manage</button>}
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
