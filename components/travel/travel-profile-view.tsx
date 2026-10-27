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
import { toast } from "@/components/ui/toast";

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
  initialPhotos = [],
  initialPhotosNextCursor = null,
  initialHighlights = [],
  initialStamps = [],
  initialStampsNextCursor = null,
  initialStampsTotalCount = initialStamps.length,
  initialDestinationStats = null,
  initialTrips = [],
  initialLikedPhotos = [],
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
  const [highlights, setHighlights] =
    useState<CountryHighlightDTO[]>(initialHighlights);
  const [stamps] = useState<UserTravelStampDTO[]>(initialStamps);
  const [trips, setTrips] = useState<TravelTripDTO[]>(initialTrips);
  const [likedPhotos, setLikedPhotos] =
    useState<TravelPhotoDTO[]>(initialLikedPhotos);
  const [likedPhotosNextCursor, setLikedPhotosNextCursor] = useState<
    string | null
  >(initialLikedPhotosNextCursor);
  const [loadingMoreLikes, setLoadingMoreLikes] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [activeTripSlider, setActiveTripSlider] =
    useState<TravelTripDTO | null>(null);
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

  // Destination highlights are stories, not main-gallery filters. Keeping this
  // separate means closing a story always restores the exact tab and gallery state.
  const handleCountrySelection = useCallback((country: string) => {
    setStoryCountry(country);
  }, []);

  const handleLoadMorePhotos = async () => {
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
  };

  const handleLoadMoreLikes = async () => {
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
  };

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
    setCountryPhotos(
      (current) =>
        current?.map((photo) => (photo.id === updated.id ? updated : photo)) ||
        null,
    );
    setLikedPhotos((current) =>
      updated.isLiked === false
        ? current.filter((photo) => photo.id !== updated.id)
        : current.map((photo) => (photo.id === updated.id ? updated : photo)),
    );
  };
  const handlePhotoDeleted = (id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setCountryPhotos(
      (current) => current?.filter((photo) => photo.id !== id) || null,
    );
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
                <div className="flex justify-center pt-2">
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
          {trips.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => setActiveTripSlider(trip)}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs transition hover:shadow-md text-left"
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
                      {trip.remainingCapacity || 5} slot
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
            Your Likes
          </h2>
          {likedPhotos.length > 0 ? (
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
                      alt={photo.caption || "Liked photo"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                    />
                  </button>
                ))}
              </div>
              {likedPhotosNextCursor && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMoreLikes}
                    disabled={loadingMoreLikes}
                    className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {loadingMoreLikes
                      ? "Loading more likes..."
                      : "Load more liked photos"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/70 p-10 text-center sm:p-14">
              <h3 className="text-base font-semibold text-zinc-900">
                No liked photos yet
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Photos you like will appear here.
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
          initialDestinationCountry={uploadDestinationCountry}
          onClose={() => {
            setIsUploadModalOpen(false);
            setUploadDestinationCountry(null);
          }}
          onSuccess={(newPhotos) => {
            handlePhotosUploaded(newPhotos);
            if (uploadDestinationCountry) {
              setStoryReloadKey((key) => key + 1);
              setStoryCountry(uploadDestinationCountry);
            }
            setUploadDestinationCountry(null);
            setIsUploadModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
