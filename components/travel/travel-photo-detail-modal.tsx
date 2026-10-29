"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import { TravelPhotoComments } from "./travel-photo-comments";
import type { TravelPhotoDTO } from "@/types/travel";

interface TravelPhotoDetailModalProps {
  photoId: string;
  isOwner?: boolean;
  onClose: () => void;
  onPhotoUpdated?: (updated: TravelPhotoDTO) => void;
  onPhotoDeleted?: (deletedId: string) => void;
  onRequestReplace?: (photo: TravelPhotoDTO) => void;
  onNavigate?: (newPhotoId: string) => void;
  onToggleLike?: (photoId: string) => Promise<{ liked: boolean; count: number }>;
  isPhotoLikePending?: (photoId: string) => boolean;
  shareUrl?: string | null;
}

export function TravelPhotoDetailModal({
  photoId,
  isOwner = false,
  onClose,
  onPhotoUpdated,
  onPhotoDeleted,
  onRequestReplace,
  onNavigate,
  onToggleLike,
  isPhotoLikePending,
  shareUrl = null,
}: TravelPhotoDetailModalProps) {
  const [photo, setPhoto] = useState<TravelPhotoDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const photoRef = useRef<TravelPhotoDTO | null>(null);
  const onCloseRef = useRef(onClose);
  const onPhotoUpdatedRef = useRef(onPhotoUpdated);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => {
    onCloseRef.current = onClose;
    onPhotoUpdatedRef.current = onPhotoUpdated;
    onNavigateRef.current = onNavigate;
  }, [onClose, onNavigate, onPhotoUpdated]);

  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);

  // Fetch photo details
  const loadPhoto = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/travel-media/photos/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load photo details");
      photoRef.current = data.photo;
      setPhoto(data.photo);
      setEditCaption(data.photo.caption || "");
      setEditLocation(data.photo.location || "");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading photo");
      onCloseRef.current();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPhoto(photoId), 0);
    return () => window.clearTimeout(timer);
  }, [photoId, loadPhoto]);

  // Keyboard navigation: Escape to close, Left/Right arrows to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
      } else if (e.key === "ArrowLeft" && photo?.prevPhotoId) {
        if (onNavigateRef.current) onNavigateRef.current(photo.prevPhotoId);
        else void loadPhoto(photo.prevPhotoId);
      } else if (e.key === "ArrowRight" && photo?.nextPhotoId) {
        if (onNavigateRef.current) onNavigateRef.current(photo.nextPhotoId);
        else void loadPhoto(photo.nextPhotoId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photo, loadPhoto]);

  const handleCommentsCountChange = useCallback((commentsCount: number) => {
    const currentPhoto = photoRef.current;
    if (!currentPhoto) return;
    const updated = { ...currentPhoto, commentsCount };
    photoRef.current = updated;
    setPhoto(updated);
    onPhotoUpdatedRef.current?.(updated);
  }, []);

  const handleToggleLike = async () => {
    if (!photo || isLiking || isPhotoLikePending?.(photo.id)) return;
    if (isOwner) {
      toast.info("You cannot like your own travel photo.");
      return;
    }

    setIsLiking(true);
    // Optimistic toggle
    const prevLiked = photo.isLiked;
    const prevCount = photo.likesCount || 0;
    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    const optimisticPhoto = { ...photo, isLiked: nextLiked, likesCount: nextCount };
    photoRef.current = optimisticPhoto;
    setPhoto(optimisticPhoto);
    onPhotoUpdatedRef.current?.(optimisticPhoto);

    try {
      const data = onToggleLike
        ? await onToggleLike(photo.id)
        : await (async () => {
            const res = await fetch(`/api/v1/travel-media/photos/${photo.id}/like`, {
              method: "POST",
            });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || "Failed to toggle like");
            return payload as { liked: boolean; count: number };
          })();
      const reconciledPhoto = { ...photo, isLiked: data.liked, likesCount: data.count };
      photoRef.current = reconciledPhoto;
      setPhoto(reconciledPhoto);
      onPhotoUpdatedRef.current?.(reconciledPhoto);
    } catch (err: unknown) {
      // Revert optimistic update
      const revertedPhoto = { ...photo, isLiked: prevLiked, likesCount: prevCount };
      photoRef.current = revertedPhoto;
      setPhoto(revertedPhoto);
      onPhotoUpdatedRef.current?.(revertedPhoto);
      toast.error(err instanceof Error ? err.message : "Error liking photo");
    } finally {
      setIsLiking(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!photo) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/travel-media/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: editCaption.trim() || null,
          location: editLocation.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update details");

      const updated = {
        ...photo,
        caption: editCaption.trim() || null,
        location: editLocation.trim() || null,
      };
      setPhoto(updated);
      setIsEditing(false);
      onPhotoUpdated?.(updated);
      toast.success("Photo details updated!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!photo) return;
    if (!confirm("Are you sure you want to permanently delete this photo?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/travel-media/photos/${photo.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete photo");

      toast.success("Photo deleted.");
      onPhotoDeleted?.(photo.id);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setIsDeleting(false);
    }
  };

  const handleSetCover = async () => {
    if (!photo || !photo.tripId) {
      toast.error("This photo is not currently associated with a trip album.");
      return;
    }

    try {
      const res = await fetch(`/api/v1/travel-media/trips/${photo.tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverPhotoId: photo.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set cover");
      toast.success("Set as trip album cover!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error setting cover");
    }
  };

  const navigatePrevious = () => {
    if (!photo?.prevPhotoId) return;
    if (onNavigateRef.current) onNavigateRef.current(photo.prevPhotoId);
    else void loadPhoto(photo.prevPhotoId);
  };

  const navigateNext = () => {
    if (!photo?.nextPhotoId) return;
    if (onNavigateRef.current) onNavigateRef.current(photo.nextPhotoId);
    else void loadPhoto(photo.nextPhotoId);
  };

  const handleImageTouchEnd = (event: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    const distance = event.changedTouches[0]?.clientX - startX;
    if (Math.abs(distance) < 40) return;
    if (distance > 0) navigatePrevious();
    else navigateNext();
  };
  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: photo?.caption || "Travel memory", text: "View this travel memory on Homyz", url: shareUrl });
      else await navigator.clipboard.writeText(shareUrl);
    } catch { /* user cancelled */ }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col md:flex-row max-h-[92vh]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition cursor-pointer"
        >
          ✕
        </button>

        {/* Previous Photo Button */}
        {photo?.prevPhotoId && (
          <button
            type="button"
            onClick={navigatePrevious}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition cursor-pointer"
          >
            ‹
          </button>
        )}

        {/* Next Photo Button */}
        {photo?.nextPhotoId && (
          <button
            type="button"
            onClick={navigateNext}
            aria-label="Next photo"
            className="absolute right-3 md:right-[340px] top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition cursor-pointer"
          >
            ›
          </button>
        )}

        {/* Left: Large Image Container */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] sm:min-h-[460px] md:min-h-[560px] p-2">
          {loading ? (
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400" />
          ) : photo ? (
            <div className="relative w-full h-full min-h-[300px] sm:min-h-[460px] md:min-h-[560px]" onTouchStart={(event) => { touchStartXRef.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={handleImageTouchEnd}>
              <Image
                src={photo.url}
                alt={photo.caption || "Travel memory"}
                fill
                priority
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 70vw"
              />
            </div>
          ) : null}
        </div>

        {/* Right: Sidebar Metadata & Controls */}
        <div className="w-full md:w-[340px] bg-white p-5 flex flex-col justify-between overflow-y-auto max-h-[40vh] md:max-h-[560px]">
          <div>
            {/* Header: Author & Trip */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="relative size-9 rounded-full overflow-hidden bg-zinc-200">
                  <Image
                    src={photo?.author?.image || "/images/auth-traveler-water.jpg"}
                    alt={photo?.author?.name || "Author"}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-medium text-zinc-900 leading-tight">
                    {photo?.author?.name || "Traveler"}
                  </h4>
                  {photo?.tripTitle && (
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full inline-block mt-0.5">
                      {photo.tripTitle}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Details: Location & Caption */}
            {isEditing ? (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-[11px] font-medium text-zinc-700 block mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="e.g. Venice, Italy"
                    className="w-full text-xs rounded-xl border border-zinc-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-700 block mb-1">
                    Caption
                  </label>
                  <textarea
                    rows={3}
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Add story..."
                    className="w-full text-xs rounded-xl border border-zinc-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 rounded-full border border-zinc-300 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="px-4 py-1 rounded-full bg-zinc-900 hover:bg-black text-white text-xs font-medium disabled:opacity-50"
                  >
                    {isSavingEdit ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {photo?.location && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                    <svg className="size-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{photo.location}</span>
                  </div>
                )}
                {photo?.caption ? (
                  <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                    {photo.caption}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No caption provided.</p>
                )}
                {photo?.taggedPeople && photo.taggedPeople.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1" aria-label="People tagged in this photo">
                    {photo.taggedPeople.map((person) => (
                      <span key={person.id} className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900">
                        {person.name || person.handle || "Traveler"}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-[10px] text-zinc-400 block pt-1">
                  Uploaded on {photo?.createdAt ? new Date(photo.createdAt).toLocaleDateString() : ""}
                </span>
              </div>
            )}

            {/* Real Likes Interaction */}
            <div className="flex items-center justify-between border-t border-b border-zinc-100 py-3 my-2">
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={isLiking || Boolean(photo && isPhotoLikePending?.(photo.id))}
                className="flex items-center gap-2 group cursor-pointer transition"
              >
                <div
                  className={`size-8 rounded-full flex items-center justify-center transition-all ${
                    photo?.isLiked
                      ? "bg-rose-50 text-rose-600 scale-110"
                      : "bg-zinc-100 text-zinc-500 group-hover:text-rose-500"
                  }`}
                >
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill={photo?.isLiked ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
                <span className="text-xs sm:text-sm font-medium text-zinc-800">
                  {photo?.likesCount ?? 0} {photo?.likesCount === 1 ? "like" : "likes"}
                </span>
              </button>

              <span className="text-[11px] text-zinc-400">
                {photo?.isLiked ? "You liked this" : isOwner ? "Your photo" : "Click to like"}
              </span>
            </div>
            {shareUrl && photo?.visibility === "PUBLIC" && <button type="button" onClick={() => void handleShare()} className="mb-3 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Share photo</button>}
            {photo && <TravelPhotoComments key={photo.id} photoId={photo.id} onCountChange={handleCommentsCountChange} />}
          </div>

          {/* Owner Management Actions */}
          {isOwner && photo && !isEditing && (
            <div className="pt-3 border-t border-zinc-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full py-1.5 px-3 rounded-full border border-zinc-300 hover:bg-zinc-100 text-xs font-medium text-zinc-700 transition cursor-pointer text-center"
                >
                  Edit Caption
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRequestReplace?.(photo);
                    onClose();
                  }}
                  className="w-full py-1.5 px-3 rounded-full border border-zinc-300 hover:bg-zinc-100 text-xs font-medium text-zinc-700 transition cursor-pointer text-center"
                >
                  Replace Photo
                </button>
              </div>

              {photo.tripId && (
                <button
                  type="button"
                  onClick={handleSetCover}
                  className="w-full py-1.5 px-3 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-medium transition cursor-pointer text-center"
                >
                  Set as Album Cover
                </button>
              )}

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-1.5 px-3 rounded-full border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-medium transition cursor-pointer text-center disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Photo"}
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
