"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import type { PublicTravelProfileDTO, PublicTravelPhotoDTO, TravelTripDTO } from "@/types/travel";
import {
  followTravelerAction,
  unfollowTravelerAction,
} from "@/actions/travel/travelPrivacy";
import { toast } from "@/components/ui/toast";
import { TravelCountryCarousel } from "./travel-country-carousel";
import { TravelDestinationStoryModal } from "./travel-destination-story-modal";
import { TravelPhotoDetailModal } from "./travel-photo-detail-modal";
import { TravelProfileShareModal } from "./travel-profile-share-modal";
import { TravelStampsSection } from "./travel-stamps-section";
import { TravelFollowListModal } from "./travel-follow-list-modal";
import { TravelTripSliderModal } from "./travel-trip-slider-modal";

interface PublicTravelProfileClientProps {
  profile: PublicTravelProfileDTO;
  currentUserId?: string | null;
}

export function PublicTravelProfileClient({
  profile,
  currentUserId,
}: PublicTravelProfileClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [storyCountry, setStoryCountry] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [publicPhotos, setPublicPhotos] = useState<PublicTravelPhotoDTO[]>(profile.photos);
  const publicPhotosRef = useRef(publicPhotos);
  const [profileLikes, setProfileLikes] = useState(profile.stats.likes);
  const profileLikesRef = useRef(profile.stats.likes);
  const [pendingPhotoLikeIds, setPendingPhotoLikeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const pendingPhotoLikeIdsRef = useRef(new Set<string>());
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(profile.isFollowing);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(profile.followersCount || 0);
  const [followListKind, setFollowListKind] = useState<"followers" | "following" | null>(null);
  const [sharedTrip, setSharedTrip] = useState<TravelTripDTO | null>(null);
  const sharedTripRef = useRef<TravelTripDTO | null>(null);
  const isOwner = Boolean(currentUserId && currentUserId === profile.userId);

  useEffect(() => {
    publicPhotosRef.current = publicPhotos;
  }, [publicPhotos]);

  useEffect(() => {
    profileLikesRef.current = profileLikes;
  }, [profileLikes]);

  useEffect(() => {
    sharedTripRef.current = sharedTrip;
  }, [sharedTrip]);

  // A server refresh can deliver likes added in another session. Do not replace
  // an optimistic mutation while the current browser is still reconciling it.
  useEffect(() => {
    if (pendingPhotoLikeIdsRef.current.size > 0) return;
    publicPhotosRef.current = profile.photos;
    setPublicPhotos(profile.photos);
    profileLikesRef.current = profile.stats.likes;
    setProfileLikes(profile.stats.likes);
  }, [profile]);

  // There is no shared client cache or realtime channel for public profiles.
  // Revalidate only when a backgrounded tab becomes active, which keeps other
  // sessions eventually consistent without polling or interrupting the gallery.
  useEffect(() => {
    const revalidateOnFocus = () => {
      if (document.visibilityState === "visible" && pendingPhotoLikeIdsRef.current.size === 0) {
        router.refresh();
      }
    };
    window.addEventListener("focus", revalidateOnFocus);
    document.addEventListener("visibilitychange", revalidateOnFocus);
    return () => {
      window.removeEventListener("focus", revalidateOnFocus);
      document.removeEventListener("visibilitychange", revalidateOnFocus);
    };
  }, [router]);

  useEffect(() => {
    const tripId = searchParams.get("trip");
    if (!tripId) return;
    void fetch(`/api/v1/travel-media/trips/${encodeURIComponent(tripId)}/public`)
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) setSharedTrip(data.trip);
      })
      .catch(() => {});
  }, [searchParams]);
  useEffect(() => {
    const photoId = searchParams.get("photo");
    if (!photoId || !publicPhotos.some((photo) => photo.id === photoId)) return;
    const timer = window.setTimeout(() => setActivePhotoId(photoId), 0);
    return () => window.clearTimeout(timer);
  }, [publicPhotos, searchParams]);

  const setPhotoLikePending = useCallback((photoId: string, pending: boolean) => {
    const next = new Set(pendingPhotoLikeIdsRef.current);
    if (pending) next.add(photoId);
    else next.delete(photoId);
    pendingPhotoLikeIdsRef.current = next;
    setPendingPhotoLikeIds(next);
  }, []);

  const applyPhotoLikeUpdate = useCallback((update: Pick<PublicTravelPhotoDTO, "id" | "isLiked" | "likesCount">) => {
    const previous = publicPhotosRef.current.find((photo) => photo.id === update.id);
    if (!previous) return;

    const nextPhotos = publicPhotosRef.current.map((photo) =>
      photo.id === update.id
        ? { ...photo, isLiked: update.isLiked, likesCount: update.likesCount }
        : photo,
    );
    publicPhotosRef.current = nextPhotos;
    setPublicPhotos(nextPhotos);

    const delta = Number(update.isLiked) - Number(previous.isLiked);
    if (delta !== 0) {
      const nextTotal = Math.max(0, profileLikesRef.current + delta);
      profileLikesRef.current = nextTotal;
      setProfileLikes(nextTotal);
    }
  }, []);

  const persistPhotoLike = useCallback(async (photoId: string) => {
    if (pendingPhotoLikeIdsRef.current.has(photoId)) {
      throw new Error("This photo is already being updated.");
    }
    setPhotoLikePending(photoId, true);
    try {
      const response = await fetch(`/api/v1/travel-media/photos/${photoId}/like`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update like.");
      if (typeof data.profileLikes === "number") {
        profileLikesRef.current = data.profileLikes;
        setProfileLikes(data.profileLikes);
      }
      return data as { liked: boolean; count: number };
    } finally {
      setPhotoLikePending(photoId, false);
    }
  }, [setPhotoLikePending]);

  const toggleGalleryLike = async (photoId: string) => {
    if (!currentUserId || isOwner) {
      if (!currentUserId) {
        router.push(`/login?callbackUrl=/travelers/${encodeURIComponent(profile.publicProfileId)}`);
      }
      return;
    }
    if (pendingPhotoLikeIdsRef.current.has(photoId)) return;

    const photo = publicPhotosRef.current.find((item) => item.id === photoId);
    if (!photo) return;
    const previous = { id: photo.id, isLiked: photo.isLiked, likesCount: photo.likesCount };
    applyPhotoLikeUpdate({
      id: photo.id,
      isLiked: !photo.isLiked,
      likesCount: Math.max(0, photo.likesCount + (photo.isLiked ? -1 : 1)),
    });
    try {
      const data = await persistPhotoLike(photo.id);
      applyPhotoLikeUpdate({ id: photo.id, isLiked: data.liked, likesCount: data.count });
    } catch (error) {
      applyPhotoLikeUpdate(previous);
      toast.error(error instanceof Error ? error.message : "Unable to update like.");
    }
  };

  const handlePhotoUpdated = useCallback((updated: { id: string; isLiked?: boolean; likesCount?: number }) => {
    if (typeof updated.isLiked !== "boolean" || typeof updated.likesCount !== "number") return;
    applyPhotoLikeUpdate({
      id: updated.id,
      isLiked: updated.isLiked,
      likesCount: updated.likesCount,
    });
  }, [applyPhotoLikeUpdate]);

  const handleTripLikeUpdated = useCallback((update: { tripId: string; liked: boolean; likesCount: number; profileLikes?: number | null }) => {
    const previous = sharedTripRef.current;
    if (!previous || previous.id !== update.tripId) return;
    const delta = Number(update.liked) - Number(Boolean(previous.isLiked));
    const nextTrip = { ...previous, isLiked: update.liked, likesCount: update.likesCount };
    sharedTripRef.current = nextTrip;
    setSharedTrip(nextTrip);
    if (typeof update.profileLikes === "number") {
      profileLikesRef.current = update.profileLikes;
      setProfileLikes(update.profileLikes);
    } else if (delta !== 0) {
      const nextTotal = Math.max(0, profileLikesRef.current + delta);
      profileLikesRef.current = nextTotal;
      setProfileLikes(nextTotal);
    }
  }, []);

  const handleFollowToggle = async () => {
    if (!currentUserId) {
      router.push(
        `/login?callbackUrl=/travelers/${encodeURIComponent(profile.publicProfileId)}`,
      );
      return;
    }
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowTravelerAction(profile.userId);
        setIsFollowing(false);
        setFollowersCount((count) => Math.max(0, count - 1));
        toast.success(`Unfollowed @${profile.handle}`);
      } else {
        await followTravelerAction(profile.userId);
        setIsFollowing(true);
        setFollowersCount((count) => count + 1);
        toast.success(`Following @${profile.handle}`);
      }
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update follow status",
      );
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleCountrySelect = (country: string) => setStoryCountry(country);

  return (
    <div className="mx-auto w-full max-w-[1261px] px-4 pb-16 font-sans sm:px-6 lg:px-8">
      <header className="relative mb-8">
        <div className="relative h-44 w-full overflow-hidden rounded-3xl border border-zinc-200/60 bg-zinc-100 shadow-md sm:h-56 md:h-72">
          {profile.coverUrl ? (
            <Image
              src={profile.coverUrl}
              alt={`${profile.displayName}'s travel cover`}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1261px) 100vw, 1261px"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-tr from-amber-900/40 via-zinc-800 to-zinc-900 text-4xl text-white/20">
              🏔️
            </div>
          )}
        </div>
        <div className="relative px-4 sm:px-8 lg:pl-[118px] lg:pr-8">
          <div className="pt-0 lg:pt-[32px] flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
            {/* Left: Avatar + (Name, Surname & Town, Country) */}
            <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6 text-center lg:text-left min-w-0">
              <div className="relative -mt-[110px] lg:mt-0 w-[220px] h-[220px] lg:h-[48px] shrink-0 mx-auto lg:mx-0">
                <div className="relative lg:absolute lg:bottom-0 lg:left-0 size-[220px] w-[220px] h-[220px] rounded-full border-[10px] border-white bg-white shadow-md z-10 flex items-center justify-center">
                  <div className="relative size-[200px] w-[200px] h-[200px] rounded-full border-2 border-[#1f1f1f] overflow-hidden bg-zinc-200">
                    {profile.avatarUrl ? (
                      <Image
                        src={profile.avatarUrl}
                        alt={profile.displayName}
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-amber-100 text-4xl font-medium text-amber-800">
                        {profile.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex flex-col justify-center items-center lg:items-start">
                <div className="flex flex-wrap items-baseline justify-center lg:justify-start gap-x-2">
                  <h1 className="not-italic font-medium text-[18px] leading-[23px] text-[#1F1F1F] whitespace-nowrap">
                    {profile.displayName}
                  </h1>
                  {profile.handle && (
                    <span className="shrink-0 text-xs font-normal text-[#727272]">
                      @{profile.handle}
                    </span>
                  )}
                </div>
                <p className="truncate font-normal text-[16px] leading-[24px] text-[#1F1F1F]">
                  {profile.homeLocation || "Town, Country"}
                </p>
              </div>
            </div>

            {/* Right: Actions (Follow & Share) */}
            <div className="flex items-center justify-center lg:justify-end gap-3 sm:gap-4 shrink-0 mt-2 lg:mt-0">
              {!isOwner && (
                <button
                  type="button"
                  disabled={isFollowLoading}
                  onClick={handleFollowToggle}
                  className={`flex flex-row items-center justify-center px-5 py-3 gap-2 w-auto min-w-[120px] sm:w-[172px] h-[48px] rounded-[30px] font-medium text-sm transition cursor-pointer shrink-0 disabled:opacity-60 ${
                    isFollowing
                      ? "bg-[#F3F4F5] hover:bg-[#EAEAEA] text-[#1F1F1F]"
                      : "bg-[#1F1F1F] text-white hover:bg-black"
                  }`}
                >
                  {isFollowing ? "Following" : "+ Follow"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="flex flex-row items-center justify-center px-5 py-3 gap-2 w-auto min-w-[140px] sm:w-[172px] h-[48px] bg-[#F3F4F5] hover:bg-[#EAEAEA] rounded-[30px] font-medium text-sm text-[#1F1F1F] transition cursor-pointer shrink-0"
              >
                <span>↗</span> Share profile
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8 sm:gap-[48px] mt-6 sm:mt-[44px] mb-8 sm:mb-[64px]">
            <button
              type="button"
              onClick={() => setFollowListKind("followers")}
              className="group flex flex-col items-center cursor-pointer transition focus:outline-none"
            >
              <span className="min-w-14 sm:min-w-16 px-4 py-0.5 rounded-full bg-[#FCDF9C] text-center font-medium text-sm sm:text-base text-[#1F1F1F] shadow-2xs group-hover:scale-105 transition-transform">
                {followersCount}
              </span>
              <span className="sm:font-medium font-normal text-lg sm:text-[20px] leading-[28px] text-[#1F1F1F] mt-2 group-hover:opacity-80 transition-opacity">
                Followers
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFollowListKind("following")}
              className="group flex flex-col items-center cursor-pointer transition focus:outline-none"
            >
              <span className="min-w-14 sm:min-w-16 px-4 py-0.5 rounded-full bg-[#FCDF9C] text-center font-medium text-sm sm:text-base text-[#1F1F1F] shadow-2xs group-hover:scale-105 transition-transform">
                {profile.followingCount || 0}
              </span>
              <span className="sm:font-medium font-normal text-lg sm:text-[20px] leading-[28px] text-[#1F1F1F] mt-2 group-hover:opacity-80 transition-opacity">
                Following
              </span>
            </button>
            {(
              [
                [profile.stats.trips, "Trips"],
                [profileLikes, "Likes", profile.stats.likes],
                [profile.stats.reviews, "Reviews"],
              ] as const
            ).map(([value, label]) => (
              <div
                key={label}
                className="flex flex-col items-center"
              >
                <span className="min-w-14 sm:min-w-16 px-4 py-0.5 rounded-full bg-[#FCDF9C] bg-[#E4C882]/35 text-center font-medium text-sm sm:text-base text-[#1F1F1F] shadow-2xs">
                  {value}
                </span>
                <span className="font-medium text-[20px] leading-[28px] text-[#1F1F1F] mt-2">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {!profile.canViewContent ? (
        <section className="mx-auto my-8 max-w-md rounded-3xl border border-zinc-200 bg-zinc-50 px-6 py-16 text-center shadow-2xs">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
            🔒
          </div>
          <h2 className="text-base font-medium text-zinc-900">
            {profile.restrictionReason === "FOLLOWERS_ONLY"
              ? "Followers only profile"
              : "Private travel profile"}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
            {profile.restrictionReason === "FOLLOWERS_ONLY"
              ? "Follow this traveler to view their travel photos and destination stamps."
              : "This traveler’s profile content is private."}
          </p>
          {profile.restrictionReason === "FOLLOWERS_ONLY" && !isOwner && (
            <button
              type="button"
              disabled={isFollowLoading}
              onClick={handleFollowToggle}
              className="mt-5 rounded-full bg-amber-500 px-6 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-amber-600"
            >
              {isFollowing ? "Request sent" : "Follow to view"}
            </button>
          )}
        </section>
      ) : (
        <>
          {profile.highlights.length > 0 && (
            <TravelCountryCarousel
              highlights={profile.highlights}
              onSelectCountry={handleCountrySelect}
            />
          )}
          <section
            className="my-8"
            aria-labelledby="public-trip-photo-gallery-heading"
          >
            <div className="mb-5">
              <h2
                id="public-trip-photo-gallery-heading"
                className="text-lg font-medium text-zinc-900 sm:text-xl"
              >
                Trip photo gallery
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Travel memories shared with the Homyz community.
              </p>
            </div>
            {publicPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 lg:gap-2 justify-items-center">
                {publicPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-square aspect-[233/246] w-full max-w-[233px] lg:w-[233px] lg:h-[246px] overflow-hidden rounded-[10px] border border-zinc-200/80 bg-zinc-100 text-left shadow-2xs transition hover:shadow-md"
                  >
                    <button type="button" onClick={() => setActivePhotoId(photo.id)} aria-label={`Open ${photo.caption || "travel photo"}`} className="absolute inset-0">
                      <Image
                        src={photo.thumbnailUrl || photo.mediumUrl || photo.url}
                        alt={photo.caption || "Travel photo"}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                      />
                      {/* Action icons bar with 20% black blur background (Figma matching) */}
                      <div className="absolute inset-x-0 bottom-0 flex h-[40px] items-center justify-between rounded-b-[10px] bg-black/20 px-6 py-[6px] backdrop-blur-[3.5px]">
                        <span className="flex items-center justify-center transition-transform hover:scale-110">
                          <Image
                            src="/images/icons/heart-fill.svg"
                            alt="Like"
                            width={16}
                            height={14}
                            className="size-4 object-contain drop-shadow-xs"
                          />
                        </span>
                        <span className="flex items-center justify-center transition-transform hover:scale-110">
                          <Image
                            src="/images/icons/message-fill.svg"
                            alt="Comment"
                            width={16}
                            height={15}
                            className="size-4 object-contain drop-shadow-xs"
                          />
                        </span>
                        <span className="flex items-center justify-center transition-transform hover:scale-110">
                          <Image
                            src="/images/icons/share-fill.svg"
                            alt="Share"
                            width={17}
                            height={17}
                            className="size-4 object-contain drop-shadow-xs"
                          />
                        </span>
                      </div>
                    </button>
                    <button type="button" aria-label={photo.isLiked ? "Unlike photo" : "Like photo"} onClick={(event) => { event.stopPropagation(); void toggleGalleryLike(photo.id); }} disabled={pendingPhotoLikeIds.has(photo.id)} className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[11px] font-medium shadow transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 ${photo.isLiked ? "bg-rose-500 text-white" : "bg-white/90 text-zinc-700"}`}>♥ {photo.likesCount}</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-12 text-center text-xs text-zinc-500">
                No public photos shared yet.
              </div>
            )}
          </section>
          {profile.showStamps && profile.stamps.length > 0 && (
            <TravelStampsSection
              stamps={profile.stamps.map((stamp) => ({
                id: stamp.id,
                userId: profile.userId,
                stampId: stamp.id,
                stamp: {
                  id: stamp.id,
                  slug: stamp.slug,
                  displayName: stamp.displayName,
                  description: stamp.description,
                  countryCode: null,
                  iconUrl: stamp.iconUrl,
                  category: stamp.category,
                  eligibilityRule: "VISIT_COUNTRY",
                  ruleThreshold: 1,
                },
                awardedAt: stamp.awardedAt,
                isPinned: stamp.isPinned,
                displayOrder: 0,
                isPublic: stamp.isPublic,
                isManual: stamp.isManual,
                visitDate: null,
                personalDescription: null,
              }))}
              showStamps={profile.showStamps}
              isOwner={false}
            />
          )}
        </>
      )}

      <TravelProfileShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        displayName={profile.displayName}
        publicProfileId={profile.publicProfileId}
        handle={profile.handle}
        avatarUrl={profile.avatarUrl}
        visibility={profile.visibility}
      />
      <TravelDestinationStoryModal
        country={storyCountry || ""}
        userId={profile.userId}
        isOpen={Boolean(storyCountry)}
        onClose={() => setStoryCountry(null)}
      />
      {activePhotoId && (
        <TravelPhotoDetailModal
          photoId={activePhotoId}
          isOwner={isOwner}
          onClose={() => setActivePhotoId(null)}
          onNavigate={setActivePhotoId}
          onPhotoUpdated={handlePhotoUpdated}
          onToggleLike={persistPhotoLike}
          isPhotoLikePending={(photoId) => pendingPhotoLikeIds.has(photoId)}
          shareUrl={profile.visibility === "PUBLIC" ? `${typeof window === "undefined" ? "" : window.location.origin}/travelers/${encodeURIComponent(profile.publicProfileId)}?photo=${encodeURIComponent(activePhotoId)}` : null}
        />
      )}
      {followListKind && <TravelFollowListModal userId={profile.userId} kind={followListKind} isOpen onClose={() => setFollowListKind(null)} />}
      {sharedTrip && <TravelTripSliderModal trip={sharedTrip} isOpen onClose={() => setSharedTrip(null)} onOpenPhotoDetail={setActivePhotoId} onTripLikeUpdated={handleTripLikeUpdated} canLike={Boolean(currentUserId && currentUserId !== sharedTrip.userId)} shareUrl={profile.visibility === "PUBLIC" && sharedTrip.visibility === "PUBLIC" ? `${typeof window === "undefined" ? "" : window.location.origin}/travelers/${encodeURIComponent(profile.publicProfileId)}?trip=${encodeURIComponent(sharedTrip.id)}` : null} />}
    </div>
  );
}
