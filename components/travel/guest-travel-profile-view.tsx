"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { TravelCoverUploadModal } from "@/components/travel/travel-cover-upload-modal";
import { TravelProfileEditModal } from "@/components/travel/travel-profile-edit-modal";
import { TravelPhotoUploadModal } from "@/components/travel/travel-photo-upload-modal";
import { TravelPhotoDetailModal } from "@/components/travel/travel-photo-detail-modal";
import type {
  TravelTripOwnerDto,
  TravelPhotoOwnerDto,
  UserDestinationDto,
  TravelProfileDto,
} from "@/lib/validation/travel-trip";
import type { LikedProfileItem, LikedPhotoItem } from "@/services/travel-social-likes.service";
import type { LegacyTripPhotoOwnerDto } from "@/services/travel-trip.service";

export interface GuestTravelProfileUser {
  id: string;
  name: string | null;
  image: string | null;
  email: string | null;
  createdAt?: Date | string;
  role?: string;
}

export interface GuestTravelProfileStats {
  trips: number;
  likes: number | null;
  likesSupported?: boolean;
  reviews: number;
  yearsOnHomyz?: number;
}

type ProfileTab = "grid" | "curation" | "likes";
type OwnerTravelDraft = {
  id: string;
  originalFileName: string;
  thumbnailUrl: string | null;
};

export function GuestTravelProfileView({
  user,
  initialProfile,
  initialStats,
  isOwner = true,
}: {
  user: GuestTravelProfileUser;
  initialProfile?: TravelProfileDto | null;
  initialStats?: GuestTravelProfileStats;
  isOwner?: boolean;
}) {
  // State
  const [profile, setProfile] = useState<TravelProfileDto | null>(initialProfile || null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("grid");

  // Data collections
  const [photos, setPhotos] = useState<TravelPhotoOwnerDto[]>([]);
  const [legacyPhotos, setLegacyPhotos] = useState<LegacyTripPhotoOwnerDto[]>([]);
  const [privateDrafts, setPrivateDrafts] = useState<OwnerTravelDraft[]>([]);
  const [trips, setTrips] = useState<TravelTripOwnerDto[]>([]);
  const [destinations, setDestinations] = useState<UserDestinationDto[]>([]);

  // Social Likes
  const [likesSubTab, setLikesSubTab] = useState<"profiles" | "photos">("profiles");
  const [likedProfiles, setLikedProfiles] = useState<LikedProfileItem[]>([]);
  const [likedPhotos, setLikedPhotos] = useState<LikedPhotoItem[]>([]);
  const [photoLikesMap, setPhotoLikesMap] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [profileLiked, setProfileLiked] = useState(false);
  const [profileLikeCount, setProfileLikeCount] = useState(0);

  // Loading flags
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);

  // Modals
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeDetailPhoto, setActiveDetailPhoto] = useState<TravelPhotoOwnerDto | null>(null);

  // Active Tagging / Location editing in Row Curation View
  const [taggingPhotoId, setTaggingPhotoId] = useState<string | null>(null);
  const [tagUserQuery, setTagUserQuery] = useState("");
  const [tagSearchResults, setTagSearchResults] = useState<Array<{ id: string; name: string | null; image: string | null }>>([]);
  const [editingLocationPhotoId, setEditingLocationPhotoId] = useState<string | null>(null);
  const [editingLocationValue, setEditingLocationValue] = useState("");

  // Destination carousel scroll
  const carouselRef = useRef<HTMLDivElement>(null);

  // Stats calculation
  const stats: GuestTravelProfileStats = {
    trips: initialStats?.trips ?? trips.length,
    likes: initialStats?.likes ?? profileLikeCount,
    reviews: initialStats?.reviews ?? 0,
    likesSupported: true,
  };
  const destinationCountries = useMemo(
    () => Array.from(new Map(destinations.map((destination) => [destination.countryCode, destination])).values()),
    [destinations],
  );
  const ownerPhotoCount = photos.length + legacyPhotos.length + privateDrafts.length;

  // Refresh trips
  const loadTrips = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/travel-trips", { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // Refresh photos
  const loadPhotos = useCallback(async () => {
    try {
      const [photosRes, draftsRes] = await Promise.all([
        fetch("/api/v1/travel-trips/photos", { credentials: "include", cache: "no-store" }),
        fetch("/api/v1/travel-media", { credentials: "include", cache: "no-store" }),
      ]);
      if (photosRes.ok) {
        const data = await photosRes.json();
        setPhotos(data.photos || []);
        setLegacyPhotos(data.legacyPhotos || []);
      }
      if (draftsRes.ok) {
        const data = await draftsRes.json();
        setPrivateDrafts(data.assets || []);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingPhotos(false);
    }
  }, []);
  const loadDestinations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/travel-profiles/me/destinations", { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDestinations(data.destinations || []);
      }
    } catch {
      // Non-blocking; owner data remains private and can be refreshed on the next focus.
    }
  }, []);

  // Initial load of profile, trips, photos, and destinations.
  useEffect(() => {
    if (!isOwner) {
      return;
    }

    let ignore = false;

    async function fetchInitialData() {
      try {
        const [profRes, tripsRes, photosRes, draftsRes, destsRes] = await Promise.all([
          fetch("/api/v1/travel-profiles/me", { credentials: "include", cache: "no-store" }),
          fetch("/api/v1/travel-trips", { credentials: "include", cache: "no-store" }),
          fetch("/api/v1/travel-trips/photos", { credentials: "include", cache: "no-store" }),
          fetch("/api/v1/travel-media", { credentials: "include", cache: "no-store" }),
          fetch("/api/v1/travel-profiles/me/destinations", { credentials: "include", cache: "no-store" }),
        ]);

        if (ignore) return;

        if (profRes.ok) {
          const data = await profRes.json();
          if (data.profile) {
            setProfile(data.profile);
          }
        }
        if (tripsRes.ok) {
          const data = await tripsRes.json();
          setTrips(data.trips || []);
        }
        if (photosRes.ok) {
          const data = await photosRes.json();
          setPhotos(data.photos || []);
          setLegacyPhotos(data.legacyPhotos || []);
        }
        if (draftsRes.ok) {
          const data = await draftsRes.json();
          setPrivateDrafts(data.assets || []);
        }
        if (destsRes.ok) {
          const data = await destsRes.json();
          setDestinations(data.destinations || []);
        }
      } catch {
        // Non-blocking
      } finally {
        if (!ignore) {
          setIsLoadingPhotos(false);
        }
      }
    }

    void fetchInitialData();

    return () => {
      ignore = true;
    };
  }, [isOwner]);

  // The profile-management screen can be open in another tab. Revalidate the
  // owner-only collections when this tab regains focus without polling.
  useEffect(() => {
    if (!isOwner) return;
    const revalidateOwnerCollections = () => {
      void loadTrips();
      void loadPhotos();
      void loadDestinations();
    };
    window.addEventListener("focus", revalidateOwnerCollections);
    return () => window.removeEventListener("focus", revalidateOwnerCollections);
  }, [isOwner, loadDestinations, loadPhotos, loadTrips]);

  // Profile like status
  const profileId = profile?.id;
  useEffect(() => {
    if (!profileId) return;
    let ignore = false;

    async function fetchProfileLike() {
      try {
        const res = await fetch(`/api/v1/travel-social/likes/profiles/${profileId}`);
        if (!ignore && res.ok) {
          const data = await res.json();
          setProfileLiked(data.liked);
          setProfileLikeCount(data.likeCount);
        }
      } catch {
        // Non-blocking
      }
    }

    void fetchProfileLike();

    return () => {
      ignore = true;
    };
  }, [profileId]);

  // User liked profiles & photos (for Likes tab)
  useEffect(() => {
    if (activeTab !== "likes" || !isOwner) return;
    let ignore = false;

    async function fetchMyLikes() {
      try {
        const res = await fetch("/api/v1/travel-social/likes/me");
        if (!ignore && res.ok) {
          const data = await res.json();
          setLikedProfiles(data.likedProfiles || []);
          setLikedPhotos(data.likedPhotos || []);
        }
      } catch {
        // Non-blocking
      } finally {
        if (!ignore) {
          setIsLoadingLikes(false);
        }
      }
    }

    void fetchMyLikes();

    return () => {
      ignore = true;
    };
  }, [activeTab, isOwner]);

  // Carousel scrolling
  const scrollCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const distance = 300;
    carouselRef.current.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  // Toggle Profile Like
  const handleToggleProfileLike = async () => {
    if (!profile?.id) return;
    try {
      const res = await fetch(`/api/v1/travel-social/likes/profiles/${profile.id}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setProfileLiked(data.liked);
        setProfileLikeCount(data.likeCount);
        toast.success(data.liked ? "Liked travel profile!" : "Unliked travel profile.");
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message || "Could not like profile.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  // Toggle Photo Like
  const handleTogglePhotoLike = async (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/travel-social/likes/photos/${photoId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setPhotoLikesMap((prev) => ({
          ...prev,
          [photoId]: { liked: data.liked, count: data.likeCount },
        }));
        toast.success(data.liked ? "Liked photo!" : "Unliked photo.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  // Caption update handler for Curation View (Screenshot 5)
  const handleUpdateCaption = async (photo: TravelPhotoOwnerDto, newCaption: string) => {
    if (!isOwner || !photo.tripId) return;
    try {
      const res = await fetch(`/api/v1/travel-trips/${photo.tripId}/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: newCaption }),
      });
      if (res.ok) {
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, caption: newCaption } : p)),
        );
        toast.success("Caption saved.");
      }
    } catch {
      toast.error("Failed to save caption.");
    }
  };

  // Location update handler for Curation View (Screenshot 5)
  const handleSaveLocation = async (photo: TravelPhotoOwnerDto) => {
    if (!isOwner || !photo.tripId) return;
    try {
      const res = await fetch(`/api/v1/travel-trips/${photo.tripId}/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: editingLocationValue }),
      });
      if (res.ok) {
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, location: editingLocationValue } : p)),
        );
        setEditingLocationPhotoId(null);
        toast.success("Location updated.");
      }
    } catch {
      toast.error("Failed to update location.");
    }
  };

  // Remove photo handler for Curation View (Screenshot 5)
  const handleRemovePhoto = async (photo: TravelPhotoOwnerDto) => {
    if (!isOwner || !photo.tripId) return;
    const confirmDelete = window.confirm("Are you sure you want to remove this photo from your album?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/v1/travel-trips/${photo.tripId}/photos/${photo.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        toast.success("Photo removed from trip.");
        loadTrips();
      } else {
        toast.error("Failed to remove photo.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  // Search taggable users
  const handleSearchUsers = async (query: string) => {
    setTagUserQuery(query);
    if (query.trim().length < 2) {
      setTagSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/v1/users/search-taggable?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setTagSearchResults(data.users || []);
      }
    } catch {
      // Non-blocking
    }
  };

  // Add person tag
  const handleAddTag = async (photo: TravelPhotoOwnerDto, targetUserId: string) => {
    if (!photo.tripId) return;
    try {
      const res = await fetch(`/api/v1/travel-trips/${photo.tripId}/photos/${photo.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taggedUserId: targetUserId }),
      });
      if (res.ok) {
        toast.success("Person tagged!");
        setTaggingPhotoId(null);
        setTagUserQuery("");
        loadPhotos();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message || "Could not tag user.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  // Share profile URL
  const handleShareProfile = () => {
    const shareUrl = `${window.location.origin}/travelers/${profile?.handle || user.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Travel profile link copied to clipboard!");
    } else {
      toast.info(`Profile link: ${shareUrl}`);
    }
  };

  const displayName = profile?.displayName || profile?.user?.name || user.name || "Name, Surname";
  const homeBase =
    profile?.homeLocation ||
    (profile?.homeDestination
      ? `${profile.homeDestination.name}, ${profile.homeDestination.countryName}`
      : "Town, Country");

  return (
    <div className="w-full max-w-[1180px] mx-auto pb-16 px-4 sm:px-6 lg:px-8">
      {/* 1. COVER BANNER (Landscape rounded rectangle matching Screenshot 4) */}
      <div className="relative w-full h-[210px] sm:h-[300px] md:h-[350px] rounded-[24px] overflow-hidden bg-zinc-200">
        {profile?.coverImageUrl || profile?.coverUrl ? (
          <Image
            src={profile.coverImageUrl || profile.coverUrl || ""}
            alt="Travel Cover Banner"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1400px) 100vw, 1400px"
          />
        ) : (
          <div className="relative h-full w-full bg-gradient-to-br from-sky-700 via-indigo-800 to-emerald-900 flex items-center justify-center">
            {/* Mountain lake landscape background fallback */}
            <div className="absolute inset-0 bg-cover bg-center opacity-85" style={{ backgroundImage: "url('/images/auth-traveler-water.jpg')" }} />
            <div className="absolute inset-0 bg-black/15" />
          </div>
        )}

        {/* Change Cover Button for Owner */}
        {isOwner && (
          <button
            type="button"
            onClick={() => setIsCoverModalOpen(true)}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-white hover:bg-black/80 transition cursor-pointer shadow-md"
            title="Update banner image"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Change Cover</span>
          </button>
        )}
      </div>

      {/* 2. OVERLAPPING AVATAR & USER PROFILE INFO & ACTIONS (Matching Screenshot 4) */}
      <div className="relative px-2 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-14 sm:-mt-[4.5rem] md:-mt-20 mb-6">
          {/* Avatar + Name / Location */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
            {/* Circular Overlapping Avatar with white border */}
            <div className="relative size-28 sm:size-32 md:size-36 rounded-full border-4 border-white overflow-hidden bg-white shadow-sm shrink-0">
              {profile?.user?.image || user.image ? (
                <Image
                  src={profile?.user?.image || user.image || ""}
                  alt={displayName}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 640px) 112px, 144px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-200 text-zinc-500">
                  <svg className="size-16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Name, Surname & Town, Country */}
            <div className="mb-2">
              <h1 className="text-base sm:text-lg font-semibold text-zinc-900 tracking-tight">
                {displayName}
              </h1>
              <p className="text-xs text-zinc-500 font-normal mt-0.5">
                {homeBase}
              </p>
            </div>
          </div>

          {/* Three Pill Action Buttons matching Screenshot 4 */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
            {isOwner ? (
              <>
                {/* 1. Edit Profile */}
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition cursor-pointer"
                >
                  <svg className="size-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Edit Profile</span>
                </button>

                {/* 2. Share Profile */}
                <button
                  type="button"
                  onClick={handleShareProfile}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition cursor-pointer"
                >
                  <svg className="size-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>Share Profile</span>
                </button>

                {/* 3. [↑] Upload */}
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition cursor-pointer"
                >
                  <svg className="size-3.5 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Upload</span>
                </button>
              </>
            ) : (
              <>
                {/* Visitor actions: Like profile & Share */}
                <button
                  type="button"
                  onClick={handleToggleProfileLike}
                  className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold transition cursor-pointer shadow-2xs ${
                    profileLiked
                      ? "bg-rose-500 text-white hover:bg-rose-600"
                      : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  <svg className="size-4" fill={profileLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>{profileLiked ? "Liked" : "Like Profile"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareProfile}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition cursor-pointer shadow-2xs"
                >
                  <span>Share</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 3. PROFILE STATS: THREE GOLD OVAL PILLS (Matching Screenshot 4) */}
        <div className="flex items-center justify-center gap-7 sm:gap-12 my-8">
          {/* Trips Counter */}
          <div className="flex flex-col items-center">
            <div className="w-14 sm:w-16 py-1 rounded-full bg-[#FCDF9C] text-center font-bold text-sm sm:text-base text-zinc-900 shadow-2xs">
              {stats.trips}
            </div>
            <span className="text-xs sm:text-sm font-medium text-zinc-800 mt-1.5">
              Trips
            </span>
          </div>

          {/* Likes Counter */}
          <div className="flex flex-col items-center">
            <div className="w-14 sm:w-16 py-1 rounded-full bg-[#FCDF9C] text-center font-bold text-sm sm:text-base text-zinc-900 shadow-2xs">
              {stats.likes ?? profileLikeCount}
            </div>
            <span className="text-xs sm:text-sm font-medium text-zinc-800 mt-1.5">
              Likes
            </span>
          </div>

          {/* Reviews Counter */}
          <div className="flex flex-col items-center">
            <div className="w-14 sm:w-16 py-1 rounded-full bg-[#FCDF9C] text-center font-bold text-sm sm:text-base text-zinc-900 shadow-2xs">
              {stats.reviews}
            </div>
            <span className="text-xs sm:text-sm font-medium text-zinc-800 mt-1.5">
              Reviews
            </span>
          </div>
        </div>

        {/* 4. VISITED DESTINATIONS CAROUSEL WITH GRADIENT RINGS (Matching Screenshot 4) */}
        <div className="relative my-10 px-8 sm:px-10">
          <p className="sr-only">Visited Destinations — All Places. Photos ({ownerPhotoCount}). Trips & Albums ({trips.length}).</p>
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={() => scrollCarousel("left")}
            aria-label="Scroll left"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 size-6 rounded-full border border-[#d9bd79] bg-[#FCDF9C] hover:bg-[#f6d27e] text-zinc-800 flex items-center justify-center transition cursor-pointer"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Carousel Track */}
          <div
            ref={carouselRef}
            className="flex items-center justify-start sm:justify-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar scroll-smooth py-2"
          >
            {destinationCountries.length > 0 ? (
              destinationCountries.map((dest) => (
                <div key={dest.countryCode} className="flex flex-col items-center shrink-0">
                  {/* Circular Image with Gradient Ring Border */}
                  <div className="p-1 rounded-full bg-gradient-to-tr from-yellow-400 via-rose-500 to-red-500 shadow-2xs">
                    <div className="relative size-20 sm:size-24 rounded-full overflow-hidden bg-zinc-200">
                      {photos.find((photo) => photo.destinationId === dest.destinationId)?.thumbnailUrl ? (
                        <Image
                          src={photos.find((photo) => photo.destinationId === dest.destinationId)?.thumbnailUrl || ""}
                          alt={dest.name}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-300 text-xs font-semibold text-slate-600" aria-hidden="true">
                          {dest.countryCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-zinc-800 mt-2 truncate max-w-[110px] text-center">
                    {dest.countryName || dest.name}
                  </span>
                </div>
              ))
            ) : (
              <p className="w-full py-4 text-center text-xs text-zinc-500">No destinations added yet.</p>
            )}
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={() => scrollCarousel("right")}
            aria-label="Scroll right"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 size-6 rounded-full border border-[#d9bd79] bg-[#FCDF9C] hover:bg-[#f6d27e] text-zinc-800 flex items-center justify-center transition cursor-pointer"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 5. THREE CENTRAL NAVIGATION ICONS (Matching Screenshot 4) */}
        <div className="flex items-center justify-center gap-8 my-8 border-b border-zinc-200/80 pb-3">
          {/* Tab 1: Grid Icon (Screenshot 4: 5-Column Grid) */}
          <button
            type="button"
            onClick={() => setActiveTab("grid")}
            className={`p-2 transition cursor-pointer ${
              activeTab === "grid" ? "text-zinc-950 scale-110" : "text-zinc-400 hover:text-zinc-700"
            }`}
            title="Photo Gallery (Grid)"
            aria-label="Photo Gallery"
          >
            <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="8" height="8" rx="1.5" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" />
            </svg>
          </button>

          {/* Tab 2: Filmstrip / List Icon (Screenshot 5: Row-based Photo Management) */}
          {isOwner && <button
            type="button"
            onClick={() => setActiveTab("curation")}
            className={`p-2 transition cursor-pointer ${
              activeTab === "curation" ? "text-zinc-950 scale-110" : "text-zinc-400 hover:text-zinc-700"
            }`}
            title="Manage Photos & Details"
            aria-label="Manage Photos"
          >
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4" />
            </svg>
          </button>}

          {/* Tab 3: Likes Icon (Client Requirement: Liked Profiles & Liked Pictures) */}
          {isOwner && <button
            type="button"
            onClick={() => {
              setActiveTab("likes");
              setIsLoadingLikes(true);
            }}
            className={`p-2 transition cursor-pointer ${
              activeTab === "likes" ? "text-zinc-950 scale-110" : "text-zinc-400 hover:text-zinc-700"
            }`}
            title="Likes (Profiles & Pictures)"
            aria-label="Social Likes"
          >
            <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>}
        </div>

        {/* 6. TAB CONTENT */}
        <div className="mt-6 mb-12">
          {/* TAB 1: 5-COLUMN PHOTO GRID (Matching Screenshot 4) */}
          {activeTab === "grid" && (
            <div>
              {isOwner && isLoadingPhotos ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-2xl bg-zinc-200 animate-pulse" />
                  ))}
                </div>
              ) : ownerPhotoCount === 0 ? (
                /* When empty, render preview fallback or empty upload card */
                <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 p-12 text-center">
                  <p className="text-sm text-zinc-600 font-medium">No photos in your travel diary yet.</p>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition shadow-xs"
                    >
                      Upload your first 5 photos
                    </button>
                  )}
                </div>
              ) : (
                /* Album photos plus owner-only private/legacy collections. */
                <>
                {photos.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {photos.map((photo) => {
                    const likeStatus = photoLikesMap[photo.id] || { liked: false, count: 0 };
                    return (
                      <div
                        key={photo.id}
                        onClick={() => setActiveDetailPhoto(photo)}
                        className="group relative aspect-square overflow-hidden rounded-2xl bg-zinc-100 cursor-pointer shadow-2xs hover:shadow-md transition"
                      >
                        <Image
                          src={photo.mediumUrl || photo.thumbnailUrl || "/images/auth-traveler-water.jpg"}
                          alt={photo.caption || "Travel photo"}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                        />

                        {/* Bottom Overlay Icons: Heart, Comment, Share (matching Screenshot 4) */}
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent text-white text-xs">
                          {/* Heart */}
                          <button
                            type="button"
                            onClick={(e) => handleTogglePhotoLike(photo.id, e)}
                            className="flex items-center gap-1 hover:text-rose-400 transition cursor-pointer"
                            title="Like photo"
                          >
                            <svg
                              className="size-4"
                              fill={likeStatus.liked ? "currentColor" : "currentColor"}
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                          </button>

                          {/* Comment */}
                          <div className="flex items-center gap-1 opacity-90" title="Comments">
                            <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                            </svg>
                          </div>

                          {/* Share */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareProfile();
                            }}
                            className="hover:text-amber-300 transition cursor-pointer"
                            title="Share"
                          >
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>}

                {isOwner && legacyPhotos.length > 0 && (
                  <section className={photos.length || privateDrafts.length ? "mt-10 border-t border-zinc-100 pt-8" : ""} aria-labelledby="legacy-trip-photos-title">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 id="legacy-trip-photos-title" className="text-sm font-semibold text-zinc-900">Legacy trip photos</h2>
                        <p className="mt-1 text-xs text-zinc-500">Photos uploaded before travel albums. Assign one to an album before it can appear in the travel gallery.</p>
                      </div>
                      <Link href="/profile/tab/profile_management/trip_photos" className="text-xs font-semibold text-zinc-700 underline underline-offset-2 hover:text-zinc-950">
                        Manage photos
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
                      {legacyPhotos.map((photo) => (
                        <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-zinc-100">
                          <Image
                            src={photo.url}
                            alt={photo.caption || "Legacy trip photo"}
                            fill
                            unoptimized
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                          />
                          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white">Legacy photo</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {isOwner && privateDrafts.length > 0 && (
                  <section className={photos.length || legacyPhotos.length ? "mt-10 border-t border-zinc-100 pt-8" : ""} aria-labelledby="private-travel-drafts-title">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 id="private-travel-drafts-title" className="text-sm font-semibold text-zinc-900">Private travel drafts</h2>
                        <p className="mt-1 text-xs text-zinc-500">Ready uploads stay private until you attach them to an album.</p>
                      </div>
                      <Link href="/profile/tab/profile_management/trip_photos" className="text-xs font-semibold text-zinc-700 underline underline-offset-2 hover:text-zinc-950">
                        Manage photos
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
                      {privateDrafts.map((draft) => (
                        <div key={draft.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-zinc-100">
                          {draft.thumbnailUrl ? <Image src={draft.thumbnailUrl} alt={draft.originalFileName} fill unoptimized className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw" /> : <span className="flex h-full items-center justify-center text-xs text-zinc-500">Preview unavailable</span>}
                          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white">Private draft</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: ROW-BASED PHOTO MANAGEMENT & DETAILS (Matching Screenshot 5) */}
          {activeTab === "curation" && (
            <div className="space-y-5 max-w-[980px] mx-auto">
              {ownerPhotoCount === 0 ? (
                <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 p-12 text-center">
                  <p className="text-sm text-zinc-600 font-medium">No photos to manage.</p>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition shadow-xs"
                    >
                      Upload Photos
                    </button>
                  )}
                </div>
              ) : (
                <>
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="grid grid-cols-1 items-start gap-4 border-b border-zinc-100 pb-5 last:border-0 md:grid-cols-[9rem_minmax(9rem,0.7fr)_minmax(14rem,1fr)_auto] md:items-center"
                  >
                    {/* 1. Square Thumbnail with Heart, Comment, Share at bottom (Screenshot 5) */}
                    <div className="relative aspect-[3/4] w-32 sm:w-36 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
                      <Image
                        src={photo.mediumUrl || photo.thumbnailUrl || "/images/auth-traveler-water.jpg"}
                        alt={photo.caption || "Uploaded thumbnail"}
                        fill
                        className="object-cover"
                        sizes="144px"
                      />
                      {/* Overlay Icons */}
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-t from-black/75 to-transparent text-white text-xs">
                        <span className="cursor-pointer hover:text-rose-400">♥</span>
                        <span>💬</span>
                        <span className="cursor-pointer hover:text-amber-300">✈</span>
                      </div>
                    </div>

                    {/* 2. Middle Column: Tag People & Add Location */}
                    <div className="flex flex-col gap-3 min-w-[140px]">
                      {/* Tag People Button */}
                      <button
                        type="button"
                        onClick={() => setTaggingPhotoId(taggingPhotoId === photo.id ? null : photo.id)}
                        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 hover:text-zinc-950 transition cursor-pointer text-left"
                      >
                        <span className="flex size-7 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200">
                          <svg className="size-3.5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </span>
                        <span>Tag people</span>
                      </button>

                      {/* Add Location Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocationPhotoId(editingLocationPhotoId === photo.id ? null : photo.id);
                          setEditingLocationValue(photo.location || "");
                        }}
                        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 hover:text-zinc-950 transition cursor-pointer text-left"
                      >
                        <span className="flex size-7 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200">
                          <svg className="size-3.5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </span>
                        <span>{photo.location ? photo.location : "Add location"}</span>
                      </button>

                      {/* Inline Tag Search Popover */}
                      {taggingPhotoId === photo.id && (
                        <div className="mt-2 p-3 bg-zinc-50 border border-zinc-200 rounded-2xl w-64 shadow-lg animate-in fade-in">
                          <p className="text-[11px] font-semibold text-zinc-800 mb-1">Tag a Traveler</p>
                          <input
                            type="text"
                            value={tagUserQuery}
                            onChange={(e) => handleSearchUsers(e.target.value)}
                            placeholder="Type user name..."
                            className="w-full text-xs rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 focus:border-zinc-900 focus:outline-hidden"
                          />
                          {tagSearchResults.length > 0 && (
                            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                              {tagSearchResults.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => handleAddTag(photo, u.id)}
                                  className="w-full flex items-center gap-2 p-1.5 text-left rounded-lg hover:bg-zinc-200 text-xs transition cursor-pointer"
                                >
                                  <span className="size-5 rounded-full bg-zinc-300 overflow-hidden relative shrink-0">
                                    {u.image && <Image src={u.image} alt="" fill className="object-cover" />}
                                  </span>
                                  <span className="truncate">{u.name || "User"}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Inline Location Input */}
                      {editingLocationPhotoId === photo.id && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingLocationValue}
                            onChange={(e) => setEditingLocationValue(e.target.value)}
                            placeholder="Location name..."
                            className="text-xs rounded-xl border border-zinc-300 bg-white px-2.5 py-1 focus:border-zinc-900 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveLocation(photo)}
                            className="px-2.5 py-1 rounded-xl bg-zinc-900 text-white text-[11px] font-medium hover:bg-zinc-800 cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 3. Middle-Right Column: Add a Caption textarea / box */}
                    <div className="flex-1 w-full md:w-auto">
                      <textarea
                        defaultValue={photo.caption || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (photo.caption || "")) {
                            handleUpdateCaption(photo, e.target.value);
                          }
                        }}
                        placeholder="Add a caption"
                        rows={3}
                        className="min-h-24 w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden transition resize-none"
                      />
                    </div>

                    {/* 4. Right Column: Remove Image Pill Button (Screenshot 5) */}
                    {isOwner && (
                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 hover:bg-rose-50 hover:text-rose-700 px-4 py-2 text-xs font-medium text-zinc-700 transition cursor-pointer"
                        >
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Remove Image</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {legacyPhotos.length > 0 && (
                  <section className="border-t border-zinc-100 pt-5" aria-labelledby="legacy-photo-management-title">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 id="legacy-photo-management-title" className="text-sm font-semibold text-zinc-900">Legacy trip photos ({legacyPhotos.length})</h2>
                        <p className="mt-1 text-xs text-zinc-500">These historical uploads are owner-visible but must be managed through Travel Memories before they can be attached to an album.</p>
                      </div>
                      <Link href="/profile/tab/profile_management/trip_photos" className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50">
                        Open Travel Memories
                      </Link>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {legacyPhotos.map((photo) => <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl bg-zinc-100"> <Image src={photo.url} alt={photo.caption || "Legacy trip photo"} fill unoptimized className="object-cover" sizes="160px" /><span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white">Legacy</span></div>)}
                    </div>
                  </section>
                )}
                {privateDrafts.length > 0 && (
                  <section className="border-t border-zinc-100 pt-5" aria-labelledby="private-draft-management-title">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h2 id="private-draft-management-title" className="text-sm font-semibold text-zinc-900">Private drafts ({privateDrafts.length})</h2><p className="mt-1 text-xs text-zinc-500">Attach these ready uploads to an album in Travel Memories; they remain private until then.</p></div>
                      <Link href="/profile/tab/profile_management/trip_photos" className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50">Open Travel Memories</Link>
                    </div>
                  </section>
                )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: SOCIAL LIKES (Client Requirement: Profiles & Pictures) */}
          {activeTab === "likes" && (
            <div className="max-w-4xl mx-auto">
              {/* Dual Sub-Tabs */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => setLikesSubTab("profiles")}
                  className={`px-5 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                    likesSubTab === "profiles"
                      ? "bg-zinc-900 text-white shadow-2xs"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Liked Profiles ({likedProfiles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLikesSubTab("photos")}
                  className={`px-5 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                    likesSubTab === "photos"
                      ? "bg-zinc-900 text-white shadow-2xs"
                      : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Liked Pictures ({likedPhotos.length})
                </button>
              </div>

              {isLoadingLikes ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-32 rounded-2xl bg-zinc-200 animate-pulse" />
                  ))}
                </div>
              ) : likesSubTab === "profiles" ? (
                /* Liked Profiles List */
                likedProfiles.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 p-12 text-center text-xs text-zinc-500">
                    No liked travel profiles yet. Explore other travelers and give them some love!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {likedProfiles.map((lp) => (
                      <div
                        key={lp.id}
                        className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 bg-white shadow-2xs hover:shadow-xs transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative size-12 rounded-full overflow-hidden bg-zinc-200 shrink-0">
                            {lp.image ? (
                              <Image src={lp.image} alt="" fill className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-zinc-300 text-xs font-bold text-zinc-700">
                                {lp.displayName?.[0] || "U"}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-zinc-900 truncate">
                              {lp.displayName || "Traveler"}
                            </p>
                            <p className="text-[11px] text-zinc-500 truncate">
                              @{lp.handle || "traveler"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/v1/travel-social/likes/profiles/${lp.profileId}`, { method: "POST" });
                            setLikedProfiles((prev) => prev.filter((p) => p.id !== lp.id));
                            toast.success("Unliked profile.");
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        >
                          Unlike
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Liked Pictures Grid */
                likedPhotos.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 p-12 text-center text-xs text-zinc-500">
                    No liked travel pictures yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {likedPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="group relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 shadow-2xs"
                      >
                        <Image
                          src={photo.thumbnailUrl}
                          alt={photo.caption || "Liked photo"}
                          fill
                          className="object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-white text-[11px]">
                          <span className="truncate pr-2">{photo.tripTitle}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/v1/travel-social/likes/photos/${photo.photoId}`, { method: "POST" });
                              setLikedPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                              toast.success("Unliked photo.");
                            }}
                            className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                            title="Unlike"
                          >
                            ♥
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>

      </div>

      {/* MODALS */}
      {isUploadModalOpen && (
        <TravelPhotoUploadModal
          trips={trips}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            loadPhotos();
            loadTrips();
          }}
        />
      )}

      {isEditProfileModalOpen && profile && (
        <TravelProfileEditModal
          profile={profile}
          onClose={() => setIsEditProfileModalOpen(false)}
          onUpdated={(updated: TravelProfileDto) => {
            setProfile(updated);
            setIsEditProfileModalOpen(false);
          }}
        />
      )}

      {isCoverModalOpen && (
        <TravelCoverUploadModal
          currentCoverUrl={profile?.coverImageUrl || profile?.coverUrl}
          onClose={() => setIsCoverModalOpen(false)}
          onSaved={(newCoverUrl: string | null) => {
            setProfile((prev) => (prev ? { ...prev, coverImageUrl: newCoverUrl, coverUrl: newCoverUrl } : prev));
            setIsCoverModalOpen(false);
          }}
        />
      )}

      {activeDetailPhoto && (
        <TravelPhotoDetailModal
          photo={activeDetailPhoto}
          allPhotos={photos}
          trips={trips}
          onClose={() => setActiveDetailPhoto(null)}
          onPhotoUpdated={(updated: TravelPhotoOwnerDto) => {
            setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }}
          onPhotoDeleted={(deletedId: string) => {
            setPhotos((prev) => prev.filter((p) => p.id !== deletedId));
            setActiveDetailPhoto(null);
            loadTrips();
          }}
        />
      )}
    </div>
  );
}
