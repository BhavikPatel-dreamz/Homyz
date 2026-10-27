"use client";

import React, { useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import { updateTravelProfileAction } from "@/actions/travel/travelProfile";
import type { TravelProfileDTO } from "@/types/travel";

export function TravelProfileEditModal({
  profile,
  onClose,
  onProfileUpdated,
}: {
  profile: TravelProfileDTO;
  onClose: () => void;
  onProfileUpdated: (updated: TravelProfileDTO) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [handle, setHandle] = useState(profile.handle || "");
  const [homeLocation, setHomeLocation] = useState(profile.homeLocation || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.user?.image || "");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE" | "FOLLOWERS_ONLY">(
    profile.visibility || "PUBLIC",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/travel-media/cover", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.coverUrl) {
        throw new Error(data?.error || "Failed to upload cover banner");
      }
      setCoverUrl(data.coverUrl);
      toast.success("Cover banner uploaded!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload cover");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/upload/avatar", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to upload profile photo");
      }
      setAvatarUrl(data.url);
      toast.success("Profile photo uploaded!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleHandleChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    setHandle(cleaned);
    if (cleaned && (cleaned.length < 3 || cleaned.length > 30)) {
      setHandleError("Handle must be between 3 and 30 characters.");
    } else {
      setHandleError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (handleError) return;

    setIsSaving(true);
    try {
      const res = await updateTravelProfileAction({
        displayName: displayName.trim() || null,
        handle: handle.trim() || null,
        homeLocation: homeLocation.trim() || null,
        bio: bio.trim() || null,
        coverUrl: coverUrl.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        visibility,
      });

      if (!res.ok) {
        throw new Error(res.error || "Failed to update profile.");
      }

      toast.success("Travel profile updated successfully!");
      if (res.data) {
        onProfileUpdated(res.data);
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-zinc-900 relative my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
              Edit Travel Profile
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Update your public traveler identity and details
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar and Cover Banner Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-200">
            {/* Avatar Photo */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Profile Photo
              </label>
              <div className="flex items-center gap-3">
                <div className="relative size-12 rounded-full overflow-hidden bg-zinc-200 border border-zinc-300 shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar preview" className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center text-zinc-400 text-xs">👤</div>
                  )}
                </div>
                <label className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 hover:bg-zinc-100 cursor-pointer transition">
                  <span>{isUploadingAvatar ? "Uploading..." : "Change Photo"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={handleAvatarFileChange}
                    disabled={isUploadingAvatar}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Cover Banner */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Cover Banner
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-zinc-200 border border-zinc-300 shrink-0">
                  {coverUrl ? (
                    <img src={coverUrl} alt="Cover preview" className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center text-zinc-400 text-xs">🏔️</div>
                  )}
                </div>
                <label className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 hover:bg-zinc-100 cursor-pointer transition">
                  <span>{isUploadingCover ? "Uploading..." : "Change Banner"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={handleCoverFileChange}
                    disabled={isUploadingCover}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-800 mb-1">
              Display Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              required
              placeholder="e.g. Sarah Jenkins"
              className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
            />
          </div>

          {/* Profile Handle */}
          <div>
            <label className="block text-xs font-medium text-zinc-800 mb-1">
              Travel Handle
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-medium text-zinc-400">
                @
              </span>
              <input
                type="text"
                value={handle}
                onChange={(e) => handleHandleChange(e.target.value)}
                maxLength={30}
                placeholder="yourhandle"
                className={`w-full rounded-xl border pl-8 pr-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none transition ${
                  handleError
                    ? "border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    : "border-zinc-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                }`}
              />
            </div>
            {handleError ? (
              <p className="text-xs text-rose-500 mt-1">{handleError}</p>
            ) : (
              <p className="text-[11px] text-zinc-400 mt-1">
                Your vanity handle for sharing your public travel diary (3-30 letters, numbers, or dashes).
              </p>
            )}
          </div>

          {/* Home Location */}
          <div>
            <label className="block text-xs font-medium text-zinc-800 mb-1">
              Home Location (Town, Country)
            </label>
            <input
              type="text"
              value={homeLocation}
              onChange={(e) => setHomeLocation(e.target.value)}
              maxLength={120}
              placeholder="e.g. Zurich, Switzerland"
              className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
            />
          </div>

          {/* Travel Bio */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-zinc-800">
                Travel Bio
              </label>
              <span className="text-[11px] text-zinc-400">
                {bio.length} / 500
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Share a short intro about your travel style, favorite places, or adventures..."
              className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-none transition"
            />
          </div>

          {/* Visibility Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-800 mb-1">
              Travel Profile Visibility
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setVisibility("PUBLIC")}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  visibility === "PUBLIC"
                    ? "border-amber-400 bg-amber-50/50 font-semibold text-zinc-900"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <span>🌐</span>
                  <span>Public</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Anyone can view your travel diary and highlights.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  visibility === "PRIVATE"
                    ? "border-amber-400 bg-amber-50/50 font-semibold text-zinc-900"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <span>🔒</span>
                  <span>Private</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Only you can view your travel diary.
                </p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2 rounded-full border border-zinc-300 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || Boolean(handleError)}
              className="bg-[#FCDF9C] hover:bg-[#F7D37D] text-zinc-900 text-xs font-semibold px-6 py-2 rounded-full transition shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

