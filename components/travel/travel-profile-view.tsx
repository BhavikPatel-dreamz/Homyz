"use client";

import React, { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
const Grid3X3 = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);
const Film = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
    <line x1="7" y1="2" x2="7" y2="22"></line>
    <line x1="17" y1="2" x2="17" y2="22"></line>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <line x1="2" y1="7" x2="7" y2="7"></line>
    <line x1="2" y1="17" x2="7" y2="17"></line>
    <line x1="17" y1="17" x2="22" y2="17"></line>
    <line x1="17" y1="7" x2="22" y2="7"></line>
  </svg>
);
const Users = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);
import type {
  CountryHighlightDTO,
  TravelPhotoDTO,
  TravelProfileDTO,
  TravelProfileStatsDTO,
  TravelerDestinationStatsDTO,
  UserTravelStampDTO,
  TravelTripDTO,
} from "@/types/travel";
import { TravelCountryCarousel } from "./travel-country-carousel";
import { TravelPhotoDetailModal } from "./travel-photo-detail-modal";
import { TravelPhotoUploadModal } from "./travel-photo-upload-modal";
import { TravelProfileHeader } from "./travel-profile-header";
import { TravelStampsSection } from "./travel-stamps-section";
import { TravelDestinationStoryModal } from "./travel-destination-story-modal";
import { TravelTripSliderModal } from "./travel-trip-slider-modal";
import { TravelTripManageModal } from "./travel-trip-manage-modal";
import { toast } from "@/components/ui/toast";

const EMPTY_PHOTOS: TravelPhotoDTO[] = [];
const EMPTY_TRIPS: TravelTripDTO[] = [];

interface TravelProfileViewProps {
  initialProfile: TravelProfileDTO;
  initialStats: TravelProfileStatsDTO;
  initialPhotos?: TravelPhotoDTO[];
  initialPhotosNextCursor?: string | null;
  initialHighlights?: CountryHighlightDTO[];
  initialStamps?: UserTravelStampDTO[];
  initialStampsNextCursor?: string | null;
  initialStampsTotalCount?: number;
  initialDestinationStats?: TravelerDestinationStatsDTO | null;
  initialTrips?: TravelTripDTO[];
  initialLikedPhotos?: TravelPhotoDTO[];
  initialLikedPhotosNextCursor?: string | null;
  isOwner?: boolean;
}

export function TravelProfileView({
  initialProfile,
  initialStats,
  initialPhotos = EMPTY_PHOTOS,
  initialPhotosNextCursor = null,
  initialHighlights = [],
  initialStamps = [],
  initialStampsNextCursor = null,
  initialStampsTotalCount = initialStamps.length,
  initialDestinationStats = null,
  initialTrips = EMPTY_TRIPS,
  initialLikedPhotos = EMPTY_PHOTOS,
  initialLikedPhotosNextCursor = null,
  isOwner = true,
}: TravelProfileViewProps) {
  void initialDestinationStats;
  const router = useRouter();
  const [photos, setPhotos] = useState<TravelPhotoDTO[]>(initialPhotos);
  const [photosNextCursor, setPhotosNextCursor] = useState<string | null>(
    initialPhotosNextCursor,
  );
  const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);
  const photosLoadMoreRef = React.useRef<HTMLDivElement | null>(null);
  const [highlights, setHighlights] =
    useState<CountryHighlightDTO[]>(initialHighlights);
  const [stamps] = useState<UserTravelStampDTO[]>(initialStamps);
  const [trips, setTrips] = useState<TravelTripDTO[]>(initialTrips);
  const [tripsLoaded, setTripsLoaded] = useState(initialTrips.length > 0);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [likedPhotos, setLikedPhotos] =
    useState<TravelPhotoDTO[]>(initialLikedPhotos);
  const [likedPhotosNextCursor, setLikedPhotosNextCursor] = useState<
    string | null
  >(initialLikedPhotosNextCursor);
  const [loadingMoreLikes, setLoadingMoreLikes] = useState(false);
  const [likesLoaded, setLikesLoaded] = useState(initialLikedPhotos.length > 0);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [likesError, setLikesError] = useState<string | null>(null);
  const tripsLoadStateRef = React.useRef<"idle" | "loading" | "loaded">(
    initialTrips.length > 0 ? "loaded" : "idle",
  );
  const likesLoadStateRef = React.useRef<"idle" | "loading" | "loaded">(
    initialLikedPhotos.length > 0 ? "loaded" : "idle",
  );
  const likesLoadMoreRef = React.useRef<HTMLDivElement | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [activeTripSlider, setActiveTripSlider] =
    useState<TravelTripDTO | null>(null);
  const [tripToManage, setTripToManage] = useState<TravelTripDTO | null>(null);
  const [manageTripDelete, setManageTripDelete] = useState(false);
  const [openTripMenuId, setOpenTripMenuId] = useState<string | null>(null);
  const [uploadTripId, setUploadTripId] = useState<string | null>(null);
  const [replacingPhoto, setReplacingPhoto] = useState<TravelPhotoDTO | null>(
    null,
  );
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"photos" | "trips" | "likes">(
    "photos",
  );
  const [storyCountry, setStoryCountry] = useState<string | null>(null);
  const [uploadDestinationCountry, setUploadDestinationCountry] = useState<
    string | null
  >(null);
  const [storyReloadKey, setStoryReloadKey] = useState(0);

  const loadTrips = useCallback(async () => {
    if (tripsLoadStateRef.current !== "idle") return;
    tripsLoadStateRef.current = "loading";
    setLoadingTrips(true);
    setTripsError(null);
    try {
      const response = await fetch("/api/v1/travel-media/trips");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load trips");
      setTrips(Array.isArray(data.trips) ? data.trips : []);
      setTripsLoaded(true);
      tripsLoadStateRef.current = "loaded";
    } catch (error) {
      tripsLoadStateRef.current = "idle";
      setTripsError(error instanceof Error ? error.message : "Failed to load trips");
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  const loadLikes = useCallback(async () => {
    if (likesLoadStateRef.current !== "idle") return;
    likesLoadStateRef.current = "loading";
    setLoadingLikes(true);
    setLikesError(null);
    try {
      const response = await fetch("/api/v1/travel-media/likes?limit=12");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load liked photos");
      setLikedPhotos(Array.isArray(data.photos) ? data.photos : []);
      setLikedPhotosNextCursor(data.nextCursor || null);
      setLikesLoaded(true);
      likesLoadStateRef.current = "loaded";
    } catch (error) {
      likesLoadStateRef.current = "idle";
      setLikesError(error instanceof Error ? error.message : "Failed to load liked photos");
    } finally {
      setLoadingLikes(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeTab === "trips") void loadTrips();
      if (activeTab === "likes") void loadLikes();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadLikes, loadTrips]);

  // Likes received in another session are re-read when this tab becomes active.
  // This is deliberately focus-based rather than polling, so it cannot create
  // a refresh loop or interrupt a gallery/modal the owner is using.
  React.useEffect(() => {
    const revalidateOnFocus = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", revalidateOnFocus);
    document.addEventListener("visibilitychange", revalidateOnFocus);
    return () => {
      window.removeEventListener("focus", revalidateOnFocus);
      document.removeEventListener("visibilitychange", revalidateOnFocus);
    };
  }, [router]);

  // Keep the visible galleries in step with refreshed server data (including
  // likes received in another browser) without changing the selected tab or
  // closing an open photo modal.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhotos(initialPhotos);
      setPhotosNextCursor(initialPhotosNextCursor);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialPhotos, initialPhotosNextCursor]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setLikedPhotos(initialLikedPhotos);
      setLikedPhotosNextCursor(initialLikedPhotosNextCursor);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialLikedPhotos, initialLikedPhotosNextCursor]);

  // Destination highlights are stories, not main-gallery filters. Keeping this
  // separate means closing a story always restores the exact tab and gallery state.
  const handleCountrySelection = useCallback((country: string) => {
    setStoryCountry(country);
  }, []);

  const handleLoadMorePhotos = useCallback(async () => {
    const cursor = photosNextCursor;
    if (!cursor || loadingMorePhotos) return;
    setLoadingMorePhotos(true);
    try {
      const params = new URLSearchParams({ limit: "20", cursor });
      const res = await fetch(`/api/v1/travel-media/photos?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load more photos");
      const merge = (current: TravelPhotoDTO[]) => {
        const ids = new Set(current.map((photo) => photo.id));
        return [
          ...current,
          ...(data.photos as TravelPhotoDTO[]).filter(
            (photo) => !ids.has(photo.id),
          ),
        ];
      };
      setPhotos(merge);
      setPhotosNextCursor(data.nextCursor || null);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error loading more photos",
      );
    } finally {
      setLoadingMorePhotos(false);
    }
  }, [loadingMorePhotos, photosNextCursor]);

  const handleLoadMoreLikes = useCallback(async () => {
    if (!likedPhotosNextCursor || loadingMoreLikes) return;
    setLoadingMoreLikes(true);
    try {
      const res = await fetch(
        `/api/v1/travel-media/likes?${new URLSearchParams({ limit: "20", cursor: likedPhotosNextCursor })}`,
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to load more liked photos");
      setLikedPhotos((current) => {
        const ids = new Set(current.map((photo) => photo.id));
        return [
          ...current,
          ...(data.photos as TravelPhotoDTO[]).filter(
            (photo) => !ids.has(photo.id),
          ),
        ];
      });
      setLikedPhotosNextCursor(data.nextCursor || null);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error loading more liked photos",
      );
    } finally {
      setLoadingMoreLikes(false);
    }
  }, [likedPhotosNextCursor, loadingMoreLikes]);

  React.useEffect(() => {
    const target = photosLoadMoreRef.current;
    if (
      activeTab !== "photos" ||
      !target ||
      !photosNextCursor ||
      loadingMorePhotos
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void handleLoadMorePhotos();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, handleLoadMorePhotos, loadingMorePhotos, photosNextCursor]);

  React.useEffect(() => {
    const target = likesLoadMoreRef.current;
    if (
      activeTab !== "likes" ||
      !target ||
      !likedPhotosNextCursor ||
      loadingMoreLikes
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void handleLoadMoreLikes();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, handleLoadMoreLikes, likedPhotosNextCursor, loadingMoreLikes]);

  const refreshTravelCollections = useCallback(async () => {
    const [tripsResponse, highlightsResponse] = await Promise.all([
      fetch("/api/v1/travel-media/trips"),
      fetch("/api/v1/travel-media/highlights"),
    ]);
    const [tripsData, highlightsData] = await Promise.all([
      tripsResponse.json(),
      highlightsResponse.json(),
    ]);
    if (tripsResponse.ok && Array.isArray(tripsData.trips))
      setTrips(tripsData.trips);
    if (highlightsResponse.ok && Array.isArray(highlightsData.highlights))
      setHighlights(highlightsData.highlights);
  }, []);

  const handlePhotosUploaded = (newPhotos: TravelPhotoDTO[]) => {
    setPhotos((current) => {
      const ids = new Set(current.map((photo) => photo.id));
      return [...newPhotos.filter((photo) => !ids.has(photo.id)), ...current];
    });
    void refreshTravelCollections().catch(() => {});
    router.refresh();
  };

  const handlePhotoUpdated = (updated: TravelPhotoDTO) => {
    setPhotos((current) =>
      current.map((photo) => (photo.id === updated.id ? updated : photo)),
    );
    setLikedPhotos((current) =>
      updated.isLiked === false
        ? current.filter((photo) => photo.id !== updated.id)
        : current.map((photo) => (photo.id === updated.id ? updated : photo)),
    );
  };
  const handlePhotoDeleted = (id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setLikedPhotos((current) => current.filter((photo) => photo.id !== id));
    if (activePhotoId === id) setActivePhotoId(null);
    void refreshTravelCollections().catch(() => {});
    router.refresh();
  };

  return (
    <div className="w-full max-w-[1180px] mx-auto pb-16 px-4 sm:px-6 lg:px-8 font-sans">
      <TravelProfileHeader
        key={`${initialProfile.updatedAt}-${initialProfile.coverUrl}-${initialProfile.displayName}`}
        profile={initialProfile}
        stats={initialStats}
        isOwner={isOwner}
        onPhotosUploaded={handlePhotosUploaded}
      />

      <TravelCountryCarousel
        highlights={highlights}
        onSelectCountry={handleCountrySelection}
      />

      <section className="mt-6 mb-10">
        <div className="flex items-center justify-center gap-8 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setActiveTab("photos")}
            className={`flex items-center gap-2 pb-2 text-xs font-semibold transition ${activeTab === "photos" ? "border-b-2 border-zinc-900 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}
          >
            <Grid3X3 className="w-4 h-4" />
            <span>Photos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trips")}
            className={`flex items-center gap-2 pb-2 text-xs font-semibold transition ${activeTab === "trips" ? "border-b-2 border-zinc-900 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}
          >
            <Film className="w-4 h-4" />
            <span>Trips</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("likes")}
            className={`flex items-center gap-2 pb-2 text-xs font-semibold transition ${activeTab === "likes" ? "border-b-2 border-zinc-900 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}
          >
            <Users className="w-4 h-4" />
            <span>Likes</span>
          </button>
        </div>
      </section>

      {activeTab === "photos" && (
        <section className="mb-12" aria-labelledby="trip-photo-gallery-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2
                id="trip-photo-gallery-heading"
                className="text-lg font-bold text-zinc-900 sm:text-xl"
              >
                Trip photo gallery
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Memories shared from verified journeys and trips.
              </p>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="shrink-0 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-black"
              >
                Upload photos
              </button>
            )}
          </div>

          {photos.length > 0 ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1 md:grid-cols-4 lg:grid-cols-5">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setActivePhotoId(photo.id)}
                    className="group relative aspect-square overflow-hidden bg-zinc-100 text-left"
                  >
                    <Image
                      src={photo.thumbnailUrl || photo.mediumUrl || photo.url}
                      alt={photo.caption || "Travel photo"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                    />
                  </button>
                ))}
              </div>
              {photosNextCursor && (
                <div ref={photosLoadMoreRef} className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleLoadMorePhotos}
                    disabled={loadingMorePhotos}
                    className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {loadingMorePhotos
                      ? "Loading more memories..."
                      : "Load more photos"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/70 p-10 text-center sm:p-14">
              <h3 className="text-base font-semibold text-zinc-900">
                No travel photos yet
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
                Upload up to five photos to each trip to build your gallery.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-black"
                  >
                    Upload photos
                  </button>
                ) : null}
                {isOwner && (
                  <Link
                    href="/profile/tab/profile_management/trip_photos?travelTab=trips"
                    className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100"
                  >
                    Manage trip photos
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "trips" && (
        <section className="mb-12" aria-labelledby="trips-heading">
          <h2 id="trips-heading" className="sr-only">
            Your Trips
          </h2>
          {loadingTrips && !tripsLoaded ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading trips">
              {[0, 1, 2].map((index) => <div key={index} className="aspect-square animate-pulse rounded-2xl bg-zinc-100" />)}
            </div>
          ) : tripsError ? (
            <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-8 text-center">
              <p className="text-sm font-semibold text-zinc-900">Couldn&apos;t load trips</p>
              <button type="button" onClick={() => void loadTrips()} className="mt-3 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800">Try again</button>
            </div>
          ) : trips.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs transition hover:shadow-md text-left"
                >
                  <button
                    type="button"
                    onClick={() => setActiveTripSlider(trip)}
                    className="block w-full text-left"
                  >
                  <div className="aspect-square relative overflow-hidden bg-zinc-100">
                    {trip.coverUrl ? (
                      <Image
                        src={trip.coverUrl}
                        alt={trip.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl">
                        ✈️
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-zinc-900 truncate">
                      {trip.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {trip.photoCount || 0} photo
                      {trip.photoCount === 1 ? "" : "s"} ·{" "}
                      {trip.remainingCapacity ?? 5} slot
                      {trip.remainingCapacity === 1 ? "" : "s"} left
                    </p>
                    {(trip.photos?.find((photo) => photo.location)?.location ||
                      trip.startDate ||
                      trip.endDate) && (
                      <p className="mt-1 truncate text-[11px] text-zinc-400">
                        {trip.photos?.find((photo) => photo.location)
                          ?.location || "Destination"}
                        {trip.startDate
                          ? ` · ${new Date(trip.startDate).toLocaleDateString()}`
                          : ""}
                        {trip.endDate
                          ? ` – ${new Date(trip.endDate).toLocaleDateString()}`
                          : ""}
                      </p>
                    )}
                  </div>
                  </button>
                  {isOwner && (
                    <div className="absolute right-3 top-3">
                      <button
                        type="button"
                        aria-label={`Manage ${trip.title}`}
                        aria-expanded={openTripMenuId === trip.id}
                        onClick={() => setOpenTripMenuId((current) => current === trip.id ? null : trip.id)}
                        className="flex size-8 items-center justify-center rounded-full bg-black/55 text-lg font-bold text-white shadow-sm backdrop-blur-sm transition hover:bg-black/75"
                      >
                        ⋯
                      </button>
                      {openTripMenuId === trip.id && (
                        <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-zinc-200 bg-white p-1.5 text-xs shadow-xl">
                          <button type="button" onClick={() => { setOpenTripMenuId(null); setManageTripDelete(false); setTripToManage(trip); }} className="w-full rounded-lg px-3 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-100">Edit trip</button>
                          <button type="button" onClick={() => { setOpenTripMenuId(null); setManageTripDelete(false); setTripToManage(trip); }} className="w-full rounded-lg px-3 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-100">Manage photos</button>
                          <button type="button" onClick={() => { setOpenTripMenuId(null); setManageTripDelete(true); setTripToManage(trip); }} className="w-full rounded-lg px-3 py-2 text-left font-medium text-rose-600 hover:bg-rose-50">Delete trip</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/70 p-10 text-center sm:p-14">
              <h3 className="text-base font-semibold text-zinc-900">
                No trips yet
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Create a trip album to organize your travel memories.
              </p>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="mt-5 rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-black"
                >
                  Upload photos
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "likes" && (
        <section className="mb-12" aria-labelledby="likes-heading">
          <h2 id="likes-heading" className="sr-only">
            Photos that received likes
          </h2>
          {loadingLikes && !likesLoaded ? (
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-label="Loading liked photos">
              {Array.from({ length: 10 }, (_, index) => <div key={index} className="aspect-square animate-pulse bg-zinc-100" />)}
            </div>
          ) : likesError ? (
            <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-8 text-center">
              <p className="text-sm font-semibold text-zinc-900">Couldn&apos;t load liked photos</p>
              <button type="button" onClick={() => void loadLikes()} className="mt-3 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800">Try again</button>
            </div>
          ) : likedPhotos.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1 md:grid-cols-4 lg:grid-cols-5">
                {likedPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setActivePhotoId(photo.id)}
                    className="group relative aspect-square overflow-hidden bg-zinc-100 text-left"
                  >
                    <Image
                      src={photo.thumbnailUrl || photo.mediumUrl || photo.url}
                      alt={photo.caption || "Photo that received likes"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                    />
                  </button>
                ))}
              </div>
              {likedPhotosNextCursor && (
                <div ref={likesLoadMoreRef} className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMoreLikes}
                    disabled={loadingMoreLikes}
                    className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {loadingMoreLikes
                      ? "Loading more likes..."
                      : "Load more photos with likes"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/70 p-10 text-center sm:p-14">
              <h3 className="text-base font-semibold text-zinc-900">
                No likes on your photos yet
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Photos that people like will appear here.
              </p>
            </div>
          )}
        </section>
      )}

      <TravelStampsSection
        stamps={stamps}
        initialNextCursor={initialStampsNextCursor}
        totalCount={initialStampsTotalCount}
        showStamps={initialProfile.showStamps ?? true}
        isOwner={isOwner}
        onRefresh={() => router.refresh()}
      />

      {activeTripSlider && (
        <TravelTripSliderModal
          key={activeTripSlider.id}
          trip={activeTripSlider}
          isOpen={!!activeTripSlider}
          onClose={() => setActiveTripSlider(null)}
          onOpenPhotoDetail={(id) => {
            setActiveTripSlider(null);
            setActivePhotoId(id);
          }}
          isOwner={isOwner}
          onManageTrip={() => {
            setManageTripDelete(false);
            setTripToManage(activeTripSlider);
            setActiveTripSlider(null);
          }}
          shareUrl={initialProfile.visibility === "PUBLIC" && activeTripSlider.visibility === "PUBLIC" ? `${typeof window === "undefined" ? "" : window.location.origin}/travelers/${encodeURIComponent(initialProfile.publicProfileId)}?trip=${encodeURIComponent(activeTripSlider.id)}` : null}
        />
      )}

      <TravelDestinationStoryModal
        country={storyCountry || ""}
        userId={initialProfile.userId}
        isOpen={!!storyCountry}
        onClose={() => setStoryCountry(null)}
        reloadKey={storyReloadKey}
        isOwner={isOwner}
        onUploadPhotos={(country) => {
          setUploadDestinationCountry(country);
          setStoryCountry(null);
          setIsUploadModalOpen(true);
        }}
        onManageTrips={(country) => {
          router.push(
            `/profile/tab/profile_management/trip_photos?${new URLSearchParams({ travelTab: "trips", destination: country })}`,
          );
        }}
      />
      {activePhotoId && (
        <TravelPhotoDetailModal
          photoId={activePhotoId}
          isOwner={isOwner}
          onClose={() => setActivePhotoId(null)}
          onNavigate={setActivePhotoId}
          onPhotoUpdated={handlePhotoUpdated}
          onPhotoDeleted={handlePhotoDeleted}
          onRequestReplace={setReplacingPhoto}
          shareUrl={initialProfile.visibility === "PUBLIC" ? `${typeof window === "undefined" ? "" : window.location.origin}/travelers/${encodeURIComponent(initialProfile.publicProfileId)}?photo=${encodeURIComponent(activePhotoId)}` : null}
        />
      )}
      {replacingPhoto && (
        <TravelPhotoUploadModal
          onClose={() => setReplacingPhoto(null)}
          replaceTargetPhoto={replacingPhoto}
          initialTripId={replacingPhoto.tripId}
          onSuccess={(updated) => {
            if (updated[0]) handlePhotoUpdated(updated[0]);
            setReplacingPhoto(null);
          }}
        />
      )}
      {isUploadModalOpen && (
        <TravelPhotoUploadModal
          existingTrips={trips}
          initialTripId={uploadTripId}
          initialDestinationCountry={uploadDestinationCountry}
          onClose={() => {
            setIsUploadModalOpen(false);
            setUploadDestinationCountry(null);
            setUploadTripId(null);
          }}
          onSuccess={(newPhotos) => {
            handlePhotosUploaded(newPhotos);
            if (uploadDestinationCountry) {
              setStoryReloadKey((key) => key + 1);
              setStoryCountry(uploadDestinationCountry);
            }
            setUploadDestinationCountry(null);
            setUploadTripId(null);
            setIsUploadModalOpen(false);
          }}
        />
      )}
      {tripToManage && (
        <TravelTripManageModal
          key={`${tripToManage.id}-${manageTripDelete ? "delete" : "edit"}`}
          trip={tripToManage}
          startWithDeleteConfirmation={manageTripDelete}
          onClose={() => { setManageTripDelete(false); setTripToManage(null); }}
          onTripUpdated={() => {
            setManageTripDelete(false);
            setTripToManage(null);
            void refreshTravelCollections();
          }}
          onTripDeleted={() => {
            setManageTripDelete(false);
            setTripToManage(null);
            void refreshTravelCollections();
          }}
          onAddPhotosClick={(tripId) => {
            setManageTripDelete(false);
            setTripToManage(null);
            setUploadTripId(tripId);
            setIsUploadModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
