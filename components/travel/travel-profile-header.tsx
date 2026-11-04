"use client";

import React, { useState } from "react";
import Image from "next/image";
import type {
  TravelProfileDTO,
  TravelProfileStatsDTO,
  TravelPhotoDTO,
} from "@/types/travel";
import { TravelProfileEditModal } from "./travel-profile-edit-modal";
import { TravelPhotoUploadModal } from "./travel-photo-upload-modal";
import { TravelProfileShareModal } from "./travel-profile-share-modal";
import { TravelPrivacySettingsModal } from "./travel-privacy-settings-modal";
import { toast } from "@/components/ui/toast";
import { updateTravelProfileAction } from "@/actions/travel/travelProfile";

export function TravelProfileHeader({
  profile: initialProfile,
  stats,
  isOwner = true,
  onPhotosUploaded,
}: {
  profile: TravelProfileDTO;
  stats: TravelProfileStatsDTO;
  isOwner?: boolean;
  onPhotosUploaded?: (photos: TravelPhotoDTO[]) => void;
}) {
  const [profile, setProfile] = useState<TravelProfileDTO>(initialProfile);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setProfile((prev) => ({ ...prev, coverUrl: data.coverUrl }));
      toast.success("Cover banner updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload cover banner");
    } finally {
      setIsUploadingCover(false);
      e.target.value = "";
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const saveRes = await updateTravelProfileAction({
        avatarUrl: data.url,
      });
      if (!saveRes.ok) {
        throw new Error(saveRes.error || "Failed to save profile photo");
      }

      setProfile((prev) => ({
        ...prev,
        user: { ...prev.user, image: data.url },
      }));
      setFailedAvatarUrl(null);
      toast.success("Profile photo updated successfully!");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("homyz:profile-updated", { detail: { image: data.url } }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload profile photo");
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const displayName = profile.displayName || profile.user.name || "Name, Surname";
  const homeLocation = profile.homeLocation || "Town, Country";

  return (
    <div className="w-full">
      {/* 1. HERO COVER BANNER (Landscape Rounded Rectangle matching Screenshot 1) */}
      <div className="relative w-full h-[210px] sm:h-[300px] md:h-[350px] rounded-[24px] overflow-hidden bg-zinc-200 shadow-sm">
        {profile.coverUrl ? (
          <Image
            src={profile.coverUrl}
            alt={`${displayName}'s travel cover banner`}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1200px) 100vw, 1200px"
          />
        ) : (
          <div className="relative w-full h-full">
            <Image
              src="/images/auth-traveler-water.jpg"
              alt="Default travel scenery cover"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
            <div className="absolute inset-0 bg-black/15" />
          </div>
        )}

        {/* Update Cover Button (Owner only) */}
        {isOwner && (
          <label
            aria-label="Update cover image"
            className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-xs text-white text-xs font-medium cursor-pointer transition shadow-md"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>{isUploadingCover ? "Uploading..." : "Update Cover"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleCoverUpload}
              disabled={isUploadingCover}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* 2. OVERLAPPING AVATAR & IDENTITY / ACTIONS ROW (Screenshot 1) */}
      <div className="relative px-2 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 md:gap-6 -mt-14 sm:-mt-16 md:-mt-20 mb-7">
          {/* Avatar + Name / Location */}
          <div className="flex min-w-0 flex-1 flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
            {/* Circular Overlapping Avatar with white border ring */}
            <div className="relative size-28 sm:size-32 md:size-36 rounded-full border-4 border-white overflow-hidden bg-white shadow-sm shrink-0 group">
              {profile.user.image && profile.user.image !== failedAvatarUrl ? (
                <Image
                  src={profile.user.image}
                  alt={displayName}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 640px) 112px, 144px"
                  onError={() => setFailedAvatarUrl(profile.user.image)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-500 font-medium text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Avatar Change Photo Button (Owner only) */}
              {isOwner && (
                <label
                  title="Change profile photo"
                  className="absolute bottom-1 right-1 z-10 size-8 rounded-full bg-zinc-900/90 hover:bg-black border-2 border-white text-white flex items-center justify-center cursor-pointer transition shadow-md"
                >
                  {isUploadingAvatar ? (
                    <span className="animate-spin text-xs">⌛</span>
                  ) : (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Name, Surname & Town, Country */}
            <div className="min-w-0 max-w-[320px] mb-2 lg:max-w-[360px]">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="truncate text-lg sm:text-xl font-medium text-zinc-900 tracking-tight">
                  {displayName}
                </h1>
                {profile.handle && (
                  <span className="shrink-0 text-xs font-normal text-zinc-400">
                    @{profile.handle}
                  </span>
                )}
              </div>
              <p className="truncate text-xs sm:text-sm text-zinc-500 font-normal mt-0.5">
                {homeLocation}
              </p>
              {profile.bio && (
                <p className="text-xs sm:text-sm text-zinc-600 font-normal mt-1 line-clamp-2">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Three Pill Action Buttons matching Screenshot 1 */}
          <div className="flex w-full flex-wrap items-center justify-center gap-2.5 md:mb-2 md:w-[430px] md:flex-none md:justify-start lg:w-[510px]">
            {/* 1. Edit Profile */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex shrink-0 whitespace-nowrap h-9 sm:h-10 items-center gap-1.5 rounded-full bg-[#f3f4f6] hover:bg-zinc-200 border border-zinc-200/60 px-4 sm:px-5 text-xs sm:text-sm font-medium text-zinc-800 transition cursor-pointer shadow-2xs"
              >
                <svg className="size-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Edit Profile</span>
              </button>
            )}

            {/* 2. Share Profile */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex shrink-0 whitespace-nowrap h-9 sm:h-10 items-center gap-1.5 rounded-full bg-[#f3f4f6] hover:bg-zinc-200 border border-zinc-200/60 px-4 sm:px-5 text-xs sm:text-sm font-medium text-zinc-800 transition cursor-pointer shadow-2xs"
            >
              <svg className="size-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share Profile</span>
            </button>

            {/* Privacy Controls (Phase 5) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(true)}
                className="inline-flex shrink-0 whitespace-nowrap h-9 sm:h-10 items-center gap-1.5 rounded-full bg-[#f3f4f6] hover:bg-zinc-200 border border-zinc-200/60 px-3.5 sm:px-4 text-xs sm:text-sm font-medium text-zinc-800 transition cursor-pointer shadow-2xs"
              >
                <span className="text-xs">🔒</span>
                <span>Privacy</span>
              </button>
            )}

            {/* 3. [↑] Upload */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex shrink-0 whitespace-nowrap h-9 sm:h-10 items-center gap-1.5 rounded-full bg-[#f3f4f6] hover:bg-zinc-200 border border-zinc-200/60 px-4 sm:px-5 text-xs sm:text-sm font-medium text-zinc-800 transition cursor-pointer shadow-2xs"
              >
                <svg className="size-3.5 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Upload</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. PROFILE STATS: THREE GOLD OVAL PILLS (Screenshot 1) */}
        <div className="flex items-center justify-center gap-8 sm:gap-14 my-8">
          {/* Trips */}
          <div className="flex flex-col items-center">
            <div className="w-14 sm:w-16 py-1 rounded-full bg-[#FCDF9C] text-center font-medium text-sm sm:text-base text-zinc-900 shadow-2xs">
              {stats.trips}
            </div>
            <span className="text-xs sm:text-sm font-medium text-zinc-800 mt-1.5">
              Trips
            </span>
          </div>

          {/* Likes */}
          <div className="flex flex-col items-center">
            <div className="w-14 sm:w-16 py-1 rounded-full bg-[#FCDF9C] text-center font-medium text-sm sm:text-base text-zinc-900 shadow-2xs">
              {stats.likes}
            </div>
            <span className="text-xs sm:text-sm font-medium text-zinc-800 mt-1.5">
              Likes
            </span>
          </div>

          {/* Reviews */}
          <div className="flex flex-col items-center">
            <div className="w-14 sm:w-16 py-1 rounded-full bg-[#FCDF9C] text-center font-medium text-sm sm:text-base text-zinc-900 shadow-2xs">
              {stats.reviews}
            </div>
            <span className="text-xs sm:text-sm font-medium text-zinc-800 mt-1.5">
              Reviews
            </span>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {isEditModalOpen && (
        <TravelProfileEditModal
          profile={profile}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdated={(updated) => {
            setProfile(updated);
          }}
        />
      )}

      {/* SHARE PROFILE MODAL (Phase 5) */}
      <TravelProfileShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        displayName={displayName}
        publicProfileId={profile.publicProfileId}
        handle={profile.handle || ""}
        avatarUrl={profile.user.image}
        visibility={profile.visibility}
      />

      {/* PRIVACY SETTINGS MODAL (Phase 5) */}
      {isOwner && (
        <TravelPrivacySettingsModal
          isOpen={isPrivacyModalOpen}
          onClose={() => setIsPrivacyModalOpen(false)}
          currentVisibility={profile.visibility}
          onVisibilityUpdated={(newVis) => {
            setProfile((prev) => ({ ...prev, visibility: newVis }));
          }}
        />
      )}

      {/* TRAVEL PHOTO UPLOAD MODAL (Phase 2 Full Implementation) */}
      {isUploadModalOpen && (
        <TravelPhotoUploadModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={(newPhotos) => {
            onPhotosUploaded?.(newPhotos);
          }}
        />
      )}
    </div>
  );
}
