"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import { LocationSearchInput } from "@/components/ui/location-search-input";
import type { TravelPhotoOwnerDto, PhotoTagDto, TravelTripOwnerDto } from "@/lib/validation/travel-trip";

interface TaggableUser {
  id: string;
  name: string | null;
  image: string | null;
}

export function TravelPhotoDetailModal({
  photo: initialPhoto,
  allPhotos,
  trips = [],
  onClose,
  onPhotoUpdated,
  onPhotoDeleted,
  onSetCover,
}: {
  photo: TravelPhotoOwnerDto;
  allPhotos: TravelPhotoOwnerDto[];
  trips?: TravelTripOwnerDto[];
  onClose: () => void;
  onPhotoUpdated?: (updated: TravelPhotoOwnerDto) => void;
  onPhotoDeleted?: (photoId: string) => void;
  onSetCover?: (tripId: string, photoId: string) => Promise<void> | void;
}) {
  const [currentId, setCurrentId] = useState<string>(initialPhoto.id);
  const [photoMap, setPhotoMap] = useState<Map<string, TravelPhotoOwnerDto>>(() => {
    const map = new Map<string, TravelPhotoOwnerDto>();
    allPhotos.forEach((p) => map.set(p.id, p));
    map.set(initialPhoto.id, initialPhoto);
    return map;
  });

  const photo = photoMap.get(currentId) || initialPhoto;
  const currentIndex = allPhotos.findIndex((p) => p.id === currentId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allPhotos.length - 1;

  // Editing states
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(photo.caption || "");
  const [locationDraft, setLocationDraft] = useState(photo.location || "");
  const [destinationIdDraft, setDestinationIdDraft] = useState<string | null>(photo.destinationId || null);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  // People tagging states
  const [tags, setTags] = useState<PhotoTagDto[]>(photo.tags || []);
  const [isTagSearchOpen, setIsTagSearchOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<TaggableUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSettingCover, setIsSettingCover] = useState(false);

  const tagSearchRef = useRef<HTMLDivElement>(null);

  // Sync drafts when active photo changes
  const [prevPhotoId, setPrevPhotoId] = useState(photo.id);
  if (photo.id !== prevPhotoId) {
    setPrevPhotoId(photo.id);
    setCaptionDraft(photo.caption || "");
    setLocationDraft(photo.location || "");
    setDestinationIdDraft(photo.destinationId || null);
    setTags(photo.tags || []);
    setIsEditingMetadata(false);
    setIsTagSearchOpen(false);
    setShowDeleteConfirm(false);
  }

  // Handle navigation
  const handlePrev = useCallback(() => {
    if (hasPrev) {
      setCurrentId(allPhotos[currentIndex - 1].id);
    }
  }, [hasPrev, currentIndex, allPhotos]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      setCurrentId(allPhotos[currentIndex + 1].id);
    }
  }, [hasNext, currentIndex, allPhotos]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept arrow keys if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePrev, handleNext, onClose]);

  // Debounced user search for tagging
  useEffect(() => {
    if (!isTagSearchOpen) return;
    const clean = tagQuery.trim();
    if (clean.length < 1) return;

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`/api/v1/users/search-taggable?q=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out users already tagged
          const taggedUserIds = new Set(tags.map((t) => t.taggedUserId));
          const filtered = (data.users || []).filter((u: TaggableUser) => !taggedUserIds.has(u.id));
          setTagSuggestions(filtered);
        } else {
          setTagSuggestions([]);
        }
      } catch {
        setTagSuggestions([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [tagQuery, isTagSearchOpen, tags]);

  // Save Caption & Location
  const handleSaveMetadata = async () => {
    if (!photo.tripId) {
      toast.error("This photo is not attached to an album.");
      return;
    }

    setIsSavingMetadata(true);
    try {
      const res = await fetch(`/api/v1/travel-trips/${photo.tripId}/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: captionDraft.trim() || null,
          location: locationDraft.trim() || null,
          destinationId: destinationIdDraft,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update photo details");
      }

      const updated = data.photo as TravelPhotoOwnerDto;
      setPhotoMap((prev) => new Map(prev).set(updated.id, updated));
      onPhotoUpdated?.(updated);
      setIsEditingMetadata(false);
      toast.success("Photo details updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update details");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  // Add person tag
  const handleAddTag = async (user: TaggableUser) => {
    if (!photo.tripId) {
      toast.error("Cannot tag users on unassigned photos.");
      return;
    }

    setIsAddingTag(true);
    try {
      const res = await fetch(`/api/v1/travel-trips/${photo.tripId}/photos/${photo.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taggedUserId: user.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to add tag");
      }

      const newTag = data.tag as PhotoTagDto;
      const nextTags = [...tags, newTag];
      setTags(nextTags);

      const updatedPhoto = { ...photo, tags: nextTags };
      setPhotoMap((prev) => new Map(prev).set(updatedPhoto.id, updatedPhoto));
      onPhotoUpdated?.(updatedPhoto);

      setIsTagSearchOpen(false);
      setTagQuery("");
      toast.success(`Tagged ${user.name || "user"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to tag user");
    } finally {
      setIsAddingTag(false);
    }
  };

  // Remove person tag
  const handleRemoveTag = async (tagId: string) => {
    if (!photo.tripId) return;

    try {
      const res = await fetch(`/api/v1/travel-trips/${photo.tripId}/photos/${photo.id}/tags/${tagId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to remove tag");
      }

      const nextTags = tags.filter((t) => t.id !== tagId);
      setTags(nextTags);

      const updatedPhoto = { ...photo, tags: nextTags };
      setPhotoMap((prev) => new Map(prev).set(updatedPhoto.id, updatedPhoto));
      onPhotoUpdated?.(updatedPhoto);

      toast.success("Tag removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove tag");
    }
  };

  // Set as trip cover
  const handleSetCover = async () => {
    if (!photo.tripId) return;
    setIsSettingCover(true);
    try {
      if (onSetCover) {
        await onSetCover(photo.tripId, photo.id);
      } else {
        const res = await fetch(`/api/v1/travel-trips/${photo.tripId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverPhotoId: photo.id }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "Failed to set cover");
        }
      }

      // Update local state: mark this photo as cover and unset others in same trip
      setPhotoMap((prev) => {
        const next = new Map(prev);
        next.forEach((p, id) => {
          if (p.tripId === photo.tripId) {
            next.set(id, { ...p, isCover: id === photo.id });
          }
        });
        return next;
      });

      const updated = { ...photo, isCover: true };
      onPhotoUpdated?.(updated);
      toast.success("Trip cover updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set as cover");
    } finally {
      setIsSettingCover(false);
    }
  };

  // Delete photo
  const handleDeletePhoto = async () => {
    if (!photo.tripId) return;
    setIsDeletingPhoto(true);
    try {
      const res = await fetch(`/api/v1/travel-trips/${photo.tripId}/photos/${photo.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to delete photo");
      }

      toast.success("Photo deleted");
      onPhotoDeleted?.(photo.id);

      // If there are other photos, navigate to adjacent; otherwise close
      if (allPhotos.length > 1) {
        if (hasNext) {
          handleNext();
        } else if (hasPrev) {
          handlePrev();
        } else {
          onClose();
        }
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete photo");
    } finally {
      setIsDeletingPhoto(false);
      setShowDeleteConfirm(false);
    }
  };

  const currentTrip = trips.find((t) => t.id === photo.tripId);
  const displayUrl = photo.mediumUrl || photo.thumbnailUrl || photo.mediaAsset?.url || "";

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-[96vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo view"
          className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 focus:outline-none"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* LEFT / CENTER: Photo Lightbox View */}
        <div className="relative flex flex-1 items-center justify-center bg-black/90 p-4 md:p-8 select-none">
          {/* Main Photo Image */}
          <div className="relative flex h-full w-full items-center justify-center">
            {displayUrl ? (
              <Image
                src={displayUrl}
                alt={photo.caption || "Travel photo"}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 70vw"
                priority
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-zinc-900 text-zinc-500">
                <span>No preview available</span>
              </div>
            )}

            {/* Is Cover Badge */}
            {photo.isCover && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-zinc-900 shadow">
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Album Cover
              </div>
            )}

            {/* Photo Counter */}
            {allPhotos.length > 1 && (
              <div className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                {currentIndex + 1} / {allPhotos.length}
              </div>
            )}
          </div>

          {/* Prev Arrow */}
          {hasPrev && (
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/90 hover:scale-105 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next Arrow */}
          {hasNext && (
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/90 hover:scale-105 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* RIGHT: Inspector Sidebar */}
        <div className="flex w-full flex-col justify-between border-t border-zinc-800 bg-zinc-900/95 p-6 md:w-96 md:border-t-0 md:border-l md:overflow-y-auto">
          <div className="space-y-6">
            {/* Header: Album & Date */}
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
                  {currentTrip?.title || photo.tripTitle || "Travel Trip"}
                </span>
                <span className="text-xs text-zinc-400">
                  {new Date(photo.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Caption & Location (View / Edit) */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-center justify-between pb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Details</h4>
                {!isEditingMetadata ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingMetadata(true)}
                    className="flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingMetadata(false);
                        setCaptionDraft(photo.caption || "");
                        setLocationDraft(photo.location || "");
                        setDestinationIdDraft(photo.destinationId || null);
                      }}
                      className="text-xs text-zinc-400 hover:text-white"
                      disabled={isSavingMetadata}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMetadata}
                      disabled={isSavingMetadata}
                      className="rounded bg-amber-400 px-2.5 py-1 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
                    >
                      {isSavingMetadata ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>

              {!isEditingMetadata ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-zinc-500">Caption</p>
                    <p className="mt-0.5 text-sm text-zinc-200">
                      {photo.caption || <span className="italic text-zinc-500">No caption provided</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Location</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm text-zinc-200">
                      <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{photo.location || photo.destination?.name || <span className="italic text-zinc-500">No location tagged</span>}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs text-zinc-400">Caption</label>
                    <textarea
                      value={captionDraft}
                      onChange={(e) => setCaptionDraft(e.target.value)}
                      placeholder="Add a travel story or memory..."
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Location</label>
                    <div className="mt-1 text-zinc-900">
                      <LocationSearchInput
                        value={locationDraft}
                        onChange={(addr: string) => {
                          setLocationDraft(addr);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tagged People Section */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Tagged People</h4>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-300">
                    {tags.length}
                  </span>
                </div>
                {!isTagSearchOpen && (
                  <button
                    type="button"
                    onClick={() => setIsTagSearchOpen(true)}
                    className="flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Tag Person
                  </button>
                )}
              </div>

              {/* Tag Search Input */}
              {isTagSearchOpen && (
                <div ref={tagSearchRef} className="relative mt-2 mb-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tagQuery}
                      onChange={(e) => setTagQuery(e.target.value)}
                      placeholder="Search user name..."
                      autoFocus
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsTagSearchOpen(false);
                        setTagQuery("");
                      }}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Done
                    </button>
                  </div>

                  {/* Dropdown Suggestions */}
                  {isSearchingUsers ? (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-center text-xs text-zinc-400 shadow-xl">
                      Searching...
                    </div>
                  ) : tagSuggestions.length > 0 ? (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-40 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                      {tagSuggestions.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleAddTag(u)}
                          disabled={isAddingTag}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-zinc-800 disabled:opacity-50"
                        >
                          <div className="relative h-6 w-6 overflow-hidden rounded-full bg-zinc-700 shrink-0">
                            {u.image ? (
                              <Image src={u.image} alt={u.name || "User"} fill className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-300">
                                {u.name?.charAt(0) || "U"}
                              </div>
                            )}
                          </div>
                          <span className="truncate font-medium text-white">{u.name || "Homyz Member"}</span>
                        </button>
                      ))}
                    </div>
                  ) : tagQuery.trim().length > 0 ? (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-center text-xs text-zinc-400 shadow-xl">
                      No matching users found
                    </div>
                  ) : null}
                </div>
              )}

              {/* Tag List */}
              {tags.length === 0 ? (
                <p className="pt-1 text-xs italic text-zinc-500">No people tagged in this photo</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {(() => {
                          const tagUser = tag.user || tag.taggedUser;
                          return (
                            <>
                              <div className="relative h-6 w-6 overflow-hidden rounded-full bg-zinc-800 shrink-0">
                                {tagUser?.image ? (
                                  <Image
                                    src={tagUser.image}
                                    alt={tagUser.name || "Tagged user"}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-300">
                                    {tagUser?.name?.charAt(0) || "U"}
                                  </div>
                                )}
                              </div>
                              <span className="truncate font-medium text-zinc-200">
                                {tagUser?.name || "Homyz Member"}
                              </span>
                            </>
                          );
                        })()}
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${
                            tag.status === "ACCEPTED"
                              ? "bg-emerald-950 text-emerald-400"
                              : tag.status === "DECLINED"
                              ? "bg-rose-950 text-rose-400"
                              : "bg-amber-950 text-amber-400"
                          }`}
                        >
                          {tag.status.toLowerCase()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag.id)}
                        className="text-zinc-500 hover:text-rose-400 ml-2"
                        title="Remove tag"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Actions: Set as Cover & Delete Photo */}
          <div className="mt-6 space-y-2 pt-4 border-t border-zinc-800">
            {photo.tripId && !photo.isCover && (
              <button
                type="button"
                onClick={handleSetCover}
                disabled={isSettingCover}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {isSettingCover ? "Setting as Cover..." : "Set as Album Cover"}
              </button>
            )}

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-900/40 bg-rose-950/20 px-4 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-950/40"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Photo
              </button>
            ) : (
              <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-center">
                <p className="text-xs text-rose-200">Delete this photo permanently?</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeletingPhoto}
                    className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeletePhoto}
                    disabled={isDeletingPhoto}
                    className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                  >
                    {isDeletingPhoto ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
