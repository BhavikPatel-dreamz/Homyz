"use client";

import React, { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CountryHighlightDTO, TravelPhotoDTO, TravelProfileDTO, TravelProfileStatsDTO, TravelerDestinationStatsDTO, UserTravelStampDTO } from "@/types/travel";
import { TravelCountryCarousel } from "./travel-country-carousel";
import { TravelPhotoDetailModal } from "./travel-photo-detail-modal";
import { TravelPhotoUploadModal } from "./travel-photo-upload-modal";
import { TravelProfileHeader } from "./travel-profile-header";
import { TravelStampsSection } from "./travel-stamps-section";
import { toast } from "@/components/ui/toast";

interface TravelProfileViewProps {
  initialProfile: TravelProfileDTO;
  initialStats: TravelProfileStatsDTO;
  initialPhotos?: TravelPhotoDTO[];
  initialPhotosNextCursor?: string | null;
  initialHighlights?: CountryHighlightDTO[];
  initialStamps?: UserTravelStampDTO[];
  initialDestinationStats?: TravelerDestinationStatsDTO | null;
  isOwner?: boolean;
}

export function TravelProfileView({
  initialProfile,
  initialStats,
  initialPhotos = [],
  initialPhotosNextCursor = null,
  initialHighlights = [],
  initialStamps = [],
  initialDestinationStats = null,
  isOwner = true,
}: TravelProfileViewProps) {
  void initialDestinationStats;
  const router = useRouter();
  const [photos, setPhotos] = useState<TravelPhotoDTO[]>(initialPhotos);
  const [photosNextCursor, setPhotosNextCursor] = useState<string | null>(initialPhotosNextCursor);
  const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);
  const [highlights, setHighlights] = useState<CountryHighlightDTO[]>(initialHighlights);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryPhotos, setCountryPhotos] = useState<TravelPhotoDTO[] | null>(null);
  const [countryPhotosNextCursor, setCountryPhotosNextCursor] = useState<string | null>(null);
  const [loadingCountryPhotos, setLoadingCountryPhotos] = useState(false);
  const [stamps, setStamps] = useState<UserTravelStampDTO[]>(initialStamps);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [replacingPhoto, setReplacingPhoto] = useState<TravelPhotoDTO | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  React.useEffect(() => {
    setStamps(initialStamps);
  }, [initialStamps]);

  const filteredPhotos = selectedCountry ? countryPhotos || [] : photos;

  const handleCountrySelection = useCallback(async (country: string | null) => {
    setSelectedCountry(country);
    if (!country) {
      setCountryPhotos(null);
      setCountryPhotosNextCursor(null);
      return;
    }
    setLoadingCountryPhotos(true);
    setCountryPhotos(null);
    try {
      const res = await fetch(`/api/v1/travel-media/photos?${new URLSearchParams({ country, limit: "20" })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load country memories");
      setCountryPhotos(data.photos as TravelPhotoDTO[]);
      setCountryPhotosNextCursor(data.nextCursor || null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unable to load country memories");
      setCountryPhotos([]);
    } finally {
      setLoadingCountryPhotos(false);
    }
  }, []);

  const handleLoadMorePhotos = async () => {
    const cursor = selectedCountry ? countryPhotosNextCursor : photosNextCursor;
    if (!cursor || loadingMorePhotos) return;
    setLoadingMorePhotos(true);
    try {
      const params = new URLSearchParams({ limit: "20", cursor });
      if (selectedCountry) params.set("country", selectedCountry);
      const res = await fetch(`/api/v1/travel-media/photos?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load more photos");
      const merge = (current: TravelPhotoDTO[]) => {
        const ids = new Set(current.map((photo) => photo.id));
        return [...current, ...(data.photos as TravelPhotoDTO[]).filter((photo) => !ids.has(photo.id))];
      };
      if (selectedCountry) {
        setCountryPhotos((current) => merge(current || []));
        setCountryPhotosNextCursor(data.nextCursor || null);
      } else {
        setPhotos(merge);
        setPhotosNextCursor(data.nextCursor || null);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading more photos");
    } finally {
      setLoadingMorePhotos(false);
    }
  };

  const handlePhotosUploaded = (newPhotos: TravelPhotoDTO[]) => {
    setPhotos((current) => {
      const ids = new Set(current.map((photo) => photo.id));
      return [...newPhotos.filter((photo) => !ids.has(photo.id)), ...current];
    });
    fetch("/api/v1/travel-media/highlights")
      .then((res) => res.json())
      .then((data) => data.highlights && setHighlights(data.highlights))
      .catch(() => {});
  };

  const handlePhotoUpdated = (updated: TravelPhotoDTO) => {
    setPhotos((current) => current.map((photo) => (photo.id === updated.id ? updated : photo)));
  };
  const handlePhotoDeleted = (id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setCountryPhotos((current) => current?.filter((photo) => photo.id !== id) || null);
    if (activePhotoId === id) setActivePhotoId(null);
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

      <TravelCountryCarousel highlights={highlights} selectedCountry={selectedCountry} onSelectCountry={handleCountrySelection} />

      <section className="mt-6 mb-12" aria-labelledby="trip-photo-gallery-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="trip-photo-gallery-heading" className="text-lg font-bold text-zinc-900 sm:text-xl">Trip photo gallery</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Memories shared from verified journeys and trips.</p>
          </div>
          {isOwner && <button type="button" onClick={() => setIsUploadModalOpen(true)} className="shrink-0 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-black">Upload photos</button>}
        </div>

        {loadingCountryPhotos ? (
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-10 text-center text-sm text-zinc-500">Loading memories from {selectedCountry}…</div>
        ) : filteredPhotos.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
              {filteredPhotos.map((photo) => (
                <button key={photo.id} type="button" onClick={() => setActivePhotoId(photo.id)} className="group relative aspect-square overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-100 text-left shadow-2xs transition hover:shadow-md">
                  <Image src={photo.thumbnailUrl || photo.mediumUrl || photo.url} alt={photo.caption || "Travel photo"} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">{photo.location ? `📍 ${photo.location}` : `♥ ${photo.likesCount ?? 0}`}</span>
                </button>
              ))}
            </div>
            {(selectedCountry ? countryPhotosNextCursor : photosNextCursor) && (
              <div className="flex justify-center pt-2"><button type="button" onClick={handleLoadMorePhotos} disabled={loadingMorePhotos} className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:bg-zinc-100 disabled:opacity-50">{loadingMorePhotos ? "Loading more memories..." : "Load more photos"}</button></div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/70 p-10 text-center sm:p-14">
            <h3 className="text-base font-semibold text-zinc-900">{selectedCountry ? `No photos found for ${selectedCountry}` : "No travel photos yet"}</h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-zinc-500">{selectedCountry ? "Try clearing the country filter to view all travel photos." : "Upload up to five photos to each trip to build your gallery."}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {selectedCountry ? <button type="button" onClick={() => setSelectedCountry(null)} className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100">Clear filter</button> : isOwner ? <button type="button" onClick={() => setIsUploadModalOpen(true)} className="rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-black">Upload photos</button> : null}
              {isOwner && <Link href="/profile/tab/profile_management/trip_photos" className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100">Manage trip photos</Link>}
            </div>
          </div>
        )}
      </section>

      <TravelStampsSection stamps={stamps} showStamps={initialProfile.showStamps ?? true} isOwner={isOwner} onRefresh={() => router.refresh()} />

      {activePhotoId && <TravelPhotoDetailModal photoId={activePhotoId} isOwner={isOwner} onClose={() => setActivePhotoId(null)} onNavigate={setActivePhotoId} onPhotoUpdated={handlePhotoUpdated} onPhotoDeleted={handlePhotoDeleted} onRequestReplace={setReplacingPhoto} />}
      {replacingPhoto && <TravelPhotoUploadModal onClose={() => setReplacingPhoto(null)} replaceTargetPhoto={replacingPhoto} initialTripId={replacingPhoto.tripId} onSuccess={(updated) => { if (updated[0]) handlePhotoUpdated(updated[0]); setReplacingPhoto(null); }} />}
      {isUploadModalOpen && <TravelPhotoUploadModal onClose={() => setIsUploadModalOpen(false)} onSuccess={(newPhotos) => { handlePhotosUploaded(newPhotos); setIsUploadModalOpen(false); }} />}
    </div>
  );
}
