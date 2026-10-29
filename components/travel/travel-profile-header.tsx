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
  activeTab,
  onSelectTab,
}: {
  profile: TravelProfileDTO;
  stats: TravelProfileStatsDTO;
  isOwner?: boolean;
  onPhotosUploaded?: (photos: TravelPhotoDTO[]) => void;
  activeTab?: string;
  onSelectTab?: (tab: "photos" | "trips" | "likes" | "reviews") => void;
}) {
  const [profile, setProfile] = useState<TravelProfileDTO>(initialProfile);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
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
    <div className="w-full max-w-[1261px] mx-auto">
      {/* 1. HERO COVER BANNER (Landscape Rounded Rectangle matching Figma) */}
      <div className="relative w-full h-[280px] sm:h-[210px] md:h-[360px] lg:h-[400px] rounded-[24px] sm:rounded-[32px] md:rounded-[36px] overflow-hidden bg-zinc-100 shadow-sm">
        {profile.coverUrl && profile.coverUrl !== failedCoverUrl ? (
          <Image
            src={profile.coverUrl}
            alt={`${displayName}'s travel cover banner`}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1261px) 100vw, 1261px"
            onError={() => setFailedCoverUrl(profile.coverUrl)}
          />
        ) : (
          <div className="relative w-full h-full">
            <Image
              src="/images/auth-traveler-water.jpg"
              alt="Default travel scenery cover"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1261px) 100vw, 1261px"
            />
            <div className="absolute inset-0 bg-black/10" />
          </div>
        )}

        {/* Update Cover Button (Owner only) */}
        {isOwner && (
          <label
            aria-label="Update cover image"
            className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xs text-white text-xs font-medium cursor-pointer transition shadow-sm"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
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

      {/* 2. OVERLAPPING AVATAR & IDENTITY / ACTIONS INLINE ROW (Figma matching) */}
      {/* Centered vertically stacked on mobile (matching mobile Figma), inline on desktop */}
      <div className="relative px-4 sm:px-8 lg:pl-[118px] lg:pr-8">
        <div className="pt-0 lg:pt-[32px] flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
          {/* Identity: Avatar + (Name, Surname & Town, Country) */}
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6 text-center lg:text-left min-w-0">
            {/* Circular Overlapping Avatar (overlapping cover image, centered on mobile, inline at bottom on desktop) */}
            <div className="relative -mt-[110px] lg:mt-0 w-[220px] h-[220px] lg:h-[48px] shrink-0 mx-auto lg:mx-0">
              <div className="relative lg:absolute lg:-bottom-1/2 lg:left-0 size-[220px] w-[220px] h-[220px] rounded-full border-[10px] border-white bg-white shadow-md z-10 flex items-center justify-center group">
                <div className="relative size-[200px] w-[200px] h-[200px] rounded-full border-2 border-[#1f1f1f] overflow-hidden">
                  {profile.user.image && profile.user.image !== failedAvatarUrl ? (
                    <Image
                      src={profile.user.image}
                      alt={displayName}
                      fill
                      priority
                      className="object-cover"
                      sizes="200px"
                      onError={() => setFailedAvatarUrl(profile.user.image)}
                    />
                  ) : (
                    <Image
                      src="/images/header-user-avatar.jpg"
                      alt={displayName}
                      fill
                      priority
                      className="object-cover"
                      sizes="200px"
                    />
                  )}
                </div>

                {/* Avatar Change Photo Button (Owner only) */}
                {isOwner && (
                  <label
                    title="Change profile photo"
                    className="absolute bottom-3 right-3 z-20 size-8 rounded-full bg-zinc-900/90 hover:bg-black border-2 border-white text-white flex items-center justify-center cursor-pointer transition shadow-md"
                  >
                    {isUploadingAvatar ? (
                      <span className="animate-spin text-xs">⌛</span>
                    ) : (
                      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
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
            </div>

            {/* Name, Surname & Town, Country */}
            <div className="min-w-0 flex flex-col justify-center items-center lg:items-start">
              <div className="flex flex-wrap items-baseline justify-center lg:justify-start gap-x-2">
                <h1 className="not-italic font-medium text-[18px] leading-[23px] text-[#1F1F1F] whitespace-nowrap">
                  {displayName}
                </h1>
                {profile.handle && (
                  <span className="shrink-0 text-xs font-normal text-[#727272]">
                    @{profile.handle}
                  </span>
                )}
              </div>
              <p className="truncate font-normal text-[16px] leading-[24px] text-[#1F1F1F]">
                {homeLocation}
              </p>
            </div>
          </div>

          {/* Right: Exactly 3 Action Buttons (Edit Profile, Share Profile, Upload) */}
          <div className="flex items-center justify-center lg:justify-end gap-3 sm:gap-4 shrink-0 mt-2 lg:mt-0">
            {/* 1. Edit Profile */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                title="Edit Profile"
                className="flex items-center justify-center size-12 sm:size-auto sm:w-[172px] sm:h-[48px] bg-[#F3F4F5] hover:bg-[#dbdbdb] rounded-full sm:rounded-[30px] sm:px-5 sm:py-3 sm:gap-2 font-normal text-base text-[#1F1F1F] transition cursor-pointer shrink-0"
              >
                <Image src="/images/icons/streamline-freehand/edit-pencil--Streamline-Freehand.svg" alt="edit-pencil--Streamline-Freehand.svg" width={22} height={22} className="size-5 sm:size-[22px]" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
            )}

            {/* 2. Share Profile */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              title="Share Profile"
              className="flex items-center justify-center size-12 sm:size-auto sm:w-[172px] sm:h-[48px] bg-[#F3F4F5] hover:bg-[#dbdbdb] rounded-full sm:rounded-[30px] sm:px-5 sm:py-3 sm:gap-2 font-normal text-base text-[#1F1F1F] transition cursor-pointer shrink-0"
            >
              <Image src="/images/icons/streamline-freehand/share-circles--Streamline-Freehand.svg" alt="share-circles--Streamline-Freehand.svg" width={22} height={22} className="size-5 sm:size-[22px]" />
              <span className="hidden sm:inline">Share Profile</span>
            </button>

            {/* 3. Upload */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                title="Upload"
                className="flex items-center justify-center size-12 sm:size-auto sm:w-[172px] sm:h-[48px] bg-[#F3F4F5] hover:bg-[#dbdbdb] rounded-full sm:rounded-[30px] sm:px-5 sm:py-3 sm:gap-2 font-normal text-base text-[#1F1F1F] transition cursor-pointer shrink-0"
              >
                <Image src="/images/icons/upload-icon.svg" alt="upload-icon.svg" width={22} height={22} className="size-5 sm:size-[22px]" />
                <span className="hidden sm:inline">Upload</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. TRIPS, LIKES AND REVIEWS TABS SECTION */}
        {/* space above is 44px, space below is 64px, space between tabs is 48px */}
        <div className="flex items-center justify-center gap-8 sm:gap-[48px] mt-6 sm:mt-[44px] mb-8 sm:mb-[64px]">
          {/* Trips Tab */}
          <button
            type="button"
            onClick={() => onSelectTab?.("trips")}
            className="group flex flex-col items-center cursor-pointer transition focus:outline-none"
          >
            <div className="min-w-20 sm:min-w-22.5 min-h-11 px-4 py-0.5 rounded-full bg-[#FCDF9C] text-center font-normal sm:font-medium text-lg sm:text-xl text-[#1F1F1F] group-hover:text-white group-hover:bg-[#1f1f1f] transition-all duration-200 flex items-center justify-center">
              {stats.trips}
            </div>
            <span className="sm:font-medium font-normal text-lg sm:text-[20px] leading-[28px] text-[#1F1F1F] mt-2 group-hover:opacity-80 transition-opacity">
              Trips
            </span>
          </button>

          {/* Likes Tab */}
          <button
            type="button"
            onClick={() => onSelectTab?.("likes")}
            className="group flex flex-col items-center cursor-pointer transition focus:outline-none"
          >
            <div className="min-w-20 sm:min-w-22.5 min-h-11 px-4 py-0.5 rounded-full bg-[#FCDF9C] text-center font-normal sm:font-medium text-lg sm:text-xl text-[#1F1F1F] group-hover:text-white group-hover:bg-[#1f1f1f] transition-all duration-200 flex items-center justify-center">
              {stats.likes}
            </div>
            <span className="sm:font-medium font-normal text-lg sm:text-[20px] leading-[28px] text-[#1F1F1F] mt-2 group-hover:opacity-80 transition-opacity">
              Likes
            </span>
          </button>

          {/* Reviews Tab */}
          <div className="group flex flex-col items-center cursor-pointer transition focus:outline-none">
            <div className="min-w-20 sm:min-w-22.5 min-h-11 px-4 py-0.5 rounded-full bg-[#FCDF9C] text-center font-normal sm:font-medium text-lg sm:text-xl text-[#1F1F1F] group-hover:text-white group-hover:bg-[#1f1f1f] transition-all duration-200 flex items-center justify-center">
              {stats.reviews}
            </div>
            <span className="sm:font-medium font-normal text-lg sm:text-[20px] leading-[28px] text-[#1F1F1F] mt-2">
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
