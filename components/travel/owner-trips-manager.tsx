"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import { TravelMediaUploadModal } from "./travel-media-upload-modal";
import type {
  DestinationDto,
  TravelStatsDto,
  TravelTripOwnerDto,
  UserDestinationDto,
} from "@/lib/validation/travel-trip";

interface DraftAsset {
  id: string;
  originalFileName: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
}

export function OwnerTripsManager({
  onTripsChanged,
}: {
  onTripsChanged?: () => void;
} = {}) {
  // Stats state
  const [stats, setStats] = useState<TravelStatsDto | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Trips state
  const [trips, setTrips] = useState<TravelTripOwnerDto[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  // Visited Destinations state
  const [destinations, setDestinations] = useState<UserDestinationDto[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalTrip, setEditModalTrip] = useState<TravelTripOwnerDto | null>(null);
  const [deleteModalTrip, setDeleteModalTrip] = useState<TravelTripOwnerDto | null>(null);
  const [photoManagerTrip, setPhotoManagerTrip] = useState<TravelTripOwnerDto | null>(null);
  const [addDestinationModalOpen, setAddDestinationModalOpen] = useState(false);
  const [deleteDestTarget, setDeleteDestTarget] = useState<UserDestinationDto | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Drafts for photo attachment
  const [drafts, setDrafts] = useState<DraftAsset[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Load stats
  useEffect(() => {
    fetch("/api/v1/travel-profiles/me/stats", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stats) setStats(data.stats);
      })
      .catch(() => null)
      .finally(() => setStatsLoading(false));
  }, [refreshKey]);

  // Load trips
  useEffect(() => {
    fetch("/api/v1/travel-trips?limit=30", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.trips) setTrips(data.trips);
      })
      .catch(() => toast.error("Could not load your travel trips."))
      .finally(() => setTripsLoading(false));
  }, [refreshKey]);

  // Load destinations
  useEffect(() => {
    fetch("/api/v1/travel-profiles/me/destinations", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.destinations) setDestinations(data.destinations);
      })
      .catch(() => toast.error("Could not load your visited destinations."))
      .finally(() => setDestinationsLoading(false));
  }, [refreshKey]);

  // Load private drafts when photo manager opens
  useEffect(() => {
    if (!photoManagerTrip) return;
    fetch("/api/v1/travel-media", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.assets) setDrafts(data.assets);
      })
      .catch(() => null)
      .finally(() => setDraftsLoading(false));
  }, [photoManagerTrip, refreshKey]);

  const refreshAll = () => {
    setTripsLoading(true);
    setDestinationsLoading(true);
    setRefreshKey((k) => k + 1);
    onTripsChanged?.();
  };

  return (
    <div className="space-y-8">
      {/* 1. Travel Stats Summary Bar */}
      <section aria-labelledby="travel-stats-heading">
        <h3 id="travel-stats-heading" className="sr-only">Travel Statistics</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <span className="text-[11px] font-medium tracking-wide uppercase text-zinc-500">Verified Trips</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-950">
                {statsLoading ? "—" : stats?.verifiedTrips ?? 0}
              </span>
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                Homyz Verified
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">Completed booking stays</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <span className="text-[11px] font-medium tracking-wide uppercase text-zinc-500">Travel Albums</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-950">
                {statsLoading ? "—" : stats?.travelAlbums ?? 0}
              </span>
              <span className="text-xs text-zinc-500">albums</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">Personal trip collections</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <span className="text-[11px] font-medium tracking-wide uppercase text-zinc-500">Visited Cities</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-950">
                {statsLoading ? "—" : stats?.visitedCities ?? 0}
              </span>
              {stats && stats.verifiedCities > 0 && (
                <span className="text-xs text-emerald-700 font-medium">
                  ({stats.verifiedCities} verified)
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">Distinct destination cities</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <span className="text-[11px] font-medium tracking-wide uppercase text-zinc-500">Visited Countries</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-950">
                {statsLoading ? "—" : stats?.visitedCountries ?? 0}
              </span>
              {stats && stats.verifiedCountries > 0 && (
                <span className="text-xs text-emerald-700 font-medium">
                  ({stats.verifiedCountries} verified)
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">Countries & territories</p>
          </div>
        </div>
      </section>

      {/* 2. Travel Albums & Trips Section */}
      <section aria-labelledby="trips-section-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 id="trips-section-heading" className="text-lg font-bold text-zinc-950">
              Travel Albums & Trips
            </h3>
            <p className="text-xs text-zinc-600">
              Personal travel journals. Each album supports up to 5 verified photos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-[#1F1F1F] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Trip Album</span>
          </button>
        </div>

        {tripsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h4 className="mt-4 text-sm font-bold text-zinc-900">No travel albums yet</h4>
            <p className="mt-1 text-xs text-zinc-600 max-w-sm mx-auto">
              Start by creating a travel album for your recent journeys. You can attach photos and pick a cover.
            </p>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FCDF9C] px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#fae7b9] transition-colors cursor-pointer"
            >
              <span>Create your first album</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <article
                key={trip.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs hover:shadow-md transition-shadow"
              >
                <div>
                  {/* Cover image or placeholder */}
                  <div className="relative aspect-16/9 w-full bg-zinc-100 overflow-hidden">
                    {trip.coverThumbnailUrl ? (
                      <Image
                        src={trip.coverThumbnailUrl}
                        alt={trip.title}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-102 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400">
                        <span>No cover selected</span>
                      </div>
                    )}
                    <span
                      className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-xs ${
                        trip.photoCount >= 5
                          ? "bg-amber-500/90 text-white"
                          : "bg-black/60 text-white"
                      }`}
                    >
                      {trip.photoCount}/5 photos
                    </span>
                  </div>

                  <div className="p-4">
                    <h4 className="font-bold text-sm text-zinc-950 truncate">{trip.title}</h4>
                    {trip.destination && (
                      <p className="mt-0.5 text-xs text-zinc-600 flex items-center gap-1 truncate">
                        <svg className="h-3.5 w-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>
                          {trip.destination.name}, {trip.destination.countryName}
                        </span>
                      </p>
                    )}
                    {(trip.startedAt || trip.endedAt) && (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {trip.startedAt ? new Date(trip.startedAt).toLocaleDateString() : ""}
                        {trip.startedAt && trip.endedAt ? " – " : ""}
                        {trip.endedAt ? new Date(trip.endedAt).toLocaleDateString() : ""}
                      </p>
                    )}
                    {trip.description && (
                      <p className="mt-2 text-xs text-zinc-600 line-clamp-2">{trip.description}</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-100 bg-zinc-50/50 p-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch(`/api/v1/travel-trips/${trip.id}`, { credentials: "include" });
                      if (res.ok) {
                        const data = await res.json();
                        setPhotoManagerTrip(data.trip);
                      } else {
                        setPhotoManagerTrip(trip);
                      }
                    }}
                    className="rounded-full bg-white border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:border-zinc-400 transition-colors cursor-pointer"
                  >
                    Manage Photos
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditModalTrip(trip)}
                      className="p-1.5 text-zinc-600 hover:text-zinc-950 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                      title="Edit trip details"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteModalTrip(trip)}
                      className="p-1.5 text-rose-600 hover:text-rose-800 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete album"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 3. Visited Destinations Section */}
      <section aria-labelledby="destinations-section-heading" className="space-y-4 pt-4 border-t border-zinc-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 id="destinations-section-heading" className="text-lg font-bold text-zinc-950">
              Visited Cities & Destinations
            </h3>
            <p className="text-xs text-zinc-600">
              Verified bookings and self-declared visited destinations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddDestinationModalOpen(true)}
            className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 shadow-2xs hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Destination</span>
          </button>
        </div>

        {destinationsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100" />
            ))}
          </div>
        ) : destinations.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 text-center text-xs text-zinc-500">
            No visited destinations recorded yet. Completed bookings will appear here automatically, or you can add places manually.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {destinations.map((dest) => (
              <div
                key={dest.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-2xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-zinc-950 truncate">{dest.name}</span>
                    {dest.isVerified ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800 shrink-0">
                        ✓ Verified Homyz stay
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-semibold text-zinc-600 shrink-0">
                        Added by traveler
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-500 truncate">
                    {dest.regionName ? `${dest.regionName}, ` : ""}{dest.countryName}
                    {dest.tripsCount > 0 && ` • ${dest.tripsCount} trip album${dest.tripsCount === 1 ? "" : "s"}`}
                  </p>
                </div>
                {dest.selfDeclared && (
                  <button
                    type="button"
                    onClick={() => setDeleteDestTarget(dest)}
                    className="text-zinc-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                    title="Remove destination"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      {createModalOpen && (
        <CreateTripModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => {
            setCreateModalOpen(false);
            refreshAll();
          }}
        />
      )}

      {editModalTrip && (
        <EditTripModal
          trip={editModalTrip}
          onClose={() => setEditModalTrip(null)}
          onUpdated={() => {
            setEditModalTrip(null);
            refreshAll();
          }}
        />
      )}

      {deleteModalTrip && (
        <DeleteTripConfirmationModal
          trip={deleteModalTrip}
          onClose={() => setDeleteModalTrip(null)}
          onDeleted={() => {
            setDeleteModalTrip(null);
            refreshAll();
          }}
        />
      )}

      {photoManagerTrip && (
        <PhotoManagerModal
          trip={photoManagerTrip}
          drafts={drafts}
          draftsLoading={draftsLoading}
          onClose={() => setPhotoManagerTrip(null)}
          onUpdated={async () => {
            // Re-fetch trip details to update photos list
            const res = await fetch(`/api/v1/travel-trips/${photoManagerTrip.id}`, { credentials: "include" });
            if (res.ok) {
              const data = await res.json();
              setPhotoManagerTrip(data.trip);
            }
            refreshAll();
          }}
          onOpenUpload={() => setUploadModalOpen(true)}
        />
      )}

      {addDestinationModalOpen && (
        <AddDestinationModal
          onClose={() => setAddDestinationModalOpen(false)}
          onAdded={() => {
            setAddDestinationModalOpen(false);
            refreshAll();
          }}
        />
      )}

      {deleteDestTarget && (
        <DeleteDestinationModal
          destination={deleteDestTarget}
          onClose={() => setDeleteDestTarget(null)}
          onDeleted={() => {
            setDeleteDestTarget(null);
            refreshAll();
          }}
        />
      )}

      {uploadModalOpen && (
        <TravelMediaUploadModal
          onClose={() => setUploadModalOpen(false)}
          onCompleted={() => {
            setUploadModalOpen(false);
            refreshAll();
            toast.success("Photos uploaded. You can now attach them to your trip.");
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// CREATE TRIP MODAL
// -----------------------------------------------------------------------------
function CreateTripModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationResults, setDestinationResults] = useState<DestinationDto[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<DestinationDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search autocomplete
  useEffect(() => {
    if (!destinationQuery || destinationQuery.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/v1/travel-destinations/search?q=${encodeURIComponent(destinationQuery)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.destinations) setDestinationResults(data.destinations);
        })
        .catch(() => null);
    }, 250);
    return () => clearTimeout(timer);
  }, [destinationQuery]);

  const visibleDestinationResults = destinationQuery.length >= 2 ? destinationResults : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Trip title is required.");
      return;
    }
    if (startedAt && endedAt && new Date(startedAt) > new Date(endedAt)) {
      setError("Start date cannot be after end date.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalDestId = selectedDestination?.id;
      // If temporary destination selected, create it first
      if (selectedDestination && selectedDestination.id.startsWith("temp-")) {
        const destRes = await fetch("/api/v1/travel-profiles/me/destinations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: selectedDestination.name,
            countryCode: selectedDestination.countryCode,
            countryName: selectedDestination.countryName,
            regionName: selectedDestination.regionName,
          }),
        });
        if (destRes.ok) {
          const destData = await destRes.json();
          finalDestId = destData.destination.destinationId;
        }
      }

      const res = await fetch("/api/v1/travel-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          destinationId: finalDestId && !finalDestId.startsWith("temp-") ? finalDestId : null,
          startedAt: startedAt || null,
          endedAt: endedAt || null,
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message || "Could not create travel trip.");
      }

      toast.success("Trip album created.");
      onCreated();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to create trip.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <h3 className="text-base font-bold text-zinc-950">Create Trip Album</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-800">
              Trip Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Vacation in Dubai"
              maxLength={100}
              required
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-800">Destination (optional)</label>
            <div className="relative mt-1">
              <input
                type="text"
                value={selectedDestination ? `${selectedDestination.name}, ${selectedDestination.countryName}` : destinationQuery}
                onChange={(e) => {
                  setSelectedDestination(null);
                  setDestinationQuery(e.target.value);
                }}
                placeholder="Search city or destination..."
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
              {selectedDestination && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDestination(null);
                    setDestinationQuery("");
                  }}
                  className="absolute right-2.5 top-2.5 text-xs text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              )}
            </div>
            {visibleDestinationResults.length > 0 && !selectedDestination && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
                {visibleDestinationResults.map((dest) => (
                  <li key={dest.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDestination(dest);
                        setDestinationResults([]);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-50 border-b border-zinc-50 flex items-center justify-between"
                    >
                      <span className="font-medium text-zinc-900">{dest.name}</span>
                      <span className="text-zinc-500 text-[11px]">{dest.countryName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-800">Start Date</label>
              <input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-800">End Date</label>
              <input
                type="date"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-800">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell the story of this trip..."
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#1F1F1F] px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Creating..." : "Create Album"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

// -----------------------------------------------------------------------------
// EDIT TRIP MODAL
// -----------------------------------------------------------------------------
function EditTripModal({
  trip,
  onClose,
  onUpdated,
}: {
  trip: TravelTripOwnerDto;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState(trip.title);
  const [description, setDescription] = useState(trip.description || "");
  const [startedAt, setStartedAt] = useState(trip.startedAt ? trip.startedAt.slice(0, 10) : "");
  const [endedAt, setEndedAt] = useState(trip.endedAt ? trip.endedAt.slice(0, 10) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Trip title is required.");
      return;
    }
    if (startedAt && endedAt && new Date(startedAt) > new Date(endedAt)) {
      setError("Start date cannot be after end date.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/travel-trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          startedAt: startedAt || null,
          endedAt: endedAt || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || "Could not update trip.");
      }

      toast.success("Trip updated.");
      onUpdated();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to update trip.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <h3 className="text-base font-bold text-zinc-950">Edit Trip Album</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-800">
              Trip Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-800">Start Date</label>
              <input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-800">End Date</label>
              <input
                type="date"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-800">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#1F1F1F] px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

// -----------------------------------------------------------------------------
// DELETE TRIP CONFIRMATION MODAL
// -----------------------------------------------------------------------------
function DeleteTripConfirmationModal({
  trip,
  onClose,
  onDeleted,
}: {
  trip: TravelTripOwnerDto;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/travel-trips/${trip.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || "Could not delete trip.");
      }
      toast.success("Trip album deleted.");
      onDeleted();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete trip.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-zinc-950">Delete Travel Album?</h3>
        <p className="mt-2 text-xs text-zinc-600">
          Are you sure you want to delete <span className="font-semibold text-zinc-900">&ldquo;{trip.title}&rdquo;</span>? Your uploaded photos and booking history will not be deleted.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-full bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Deleting..." : "Delete Album"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// -----------------------------------------------------------------------------
// PHOTO MANAGER MODAL (Strict 5-Photo Cap Enforced)
// -----------------------------------------------------------------------------
function PhotoManagerModal({
  trip,
  drafts,
  draftsLoading,
  onClose,
  onUpdated,
  onOpenUpload,
}: {
  trip: TravelTripOwnerDto;
  drafts: DraftAsset[];
  draftsLoading: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onOpenUpload: () => void;
}) {
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [settingCoverId, setSettingCoverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activePhotos = trip.photos || [];
  const photoCount = activePhotos.length;
  const isFull = photoCount >= 5;

  const handleAttach = async (assetId: string) => {
    if (isFull) {
      setError("This trip already has the maximum of 5 photos. Remove a photo first.");
      return;
    }
    setAttachingId(assetId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/travel-trips/${trip.id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mediaAssetId: assetId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message || "Could not attach photo.");
      }
      toast.success("Photo attached to album.");
      onUpdated();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to attach photo.");
    } finally {
      setAttachingId(null);
    }
  };

  const handleDetach = async (photoId: string) => {
    setDetachingId(photoId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/travel-trips/${trip.id}/photos/${photoId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || "Could not remove photo.");
      }
      toast.success("Photo removed from album.");
      onUpdated();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to remove photo.");
    } finally {
      setDetachingId(null);
    }
  };

  const handleSetCover = async (photoId: string) => {
    setSettingCoverId(photoId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/travel-trips/${trip.id}/cover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || "Could not set cover photo.");
      }
      toast.success("Trip cover updated.");
      onUpdated();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to set cover photo.");
    } finally {
      setSettingCoverId(null);
    }
  };

  // Filter drafts not yet attached
  const attachedAssetIds = new Set(activePhotos.map((p) => p.mediaAssetId));
  const availableDrafts = drafts.filter((d) => !attachedAssetIds.has(d.id));

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div>
            <h3 className="text-base font-bold text-zinc-950">Manage Album Photos</h3>
            <p className="text-xs text-zinc-500 truncate max-w-sm">{trip.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Capacity Indicator */}
        <div className="mt-4 rounded-2xl bg-zinc-50 border border-zinc-200 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-800">
              Album Capacity: <span className="text-zinc-950 font-bold">{photoCount} of 5 photos used</span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isFull ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {isFull ? "Album Full (5/5)" : `${5 - photoCount} slot${5 - photoCount === 1 ? "" : "s"} remaining`}
            </span>
          </div>
          {/* Visual 5-segment bar */}
          <div className="mt-2 grid grid-cols-5 gap-1.5 h-2">
            {[0, 1, 2, 3, 4].map((slot) => (
              <div
                key={slot}
                className={`rounded-full transition-colors ${
                  slot < photoCount
                    ? isFull
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                    : "bg-zinc-200"
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
        )}

        {/* Active attached photos */}
        <div className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Current Photos ({activePhotos.length})
          </h4>
          {activePhotos.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-400 italic">No photos attached to this trip yet.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {activePhotos.map((photo) => (
                <div
                  key={photo.id}
                  className={`relative overflow-hidden rounded-2xl border ${
                    photo.isCover ? "border-amber-400 ring-2 ring-amber-300" : "border-zinc-200"
                  } bg-white shadow-2xs`}
                >
                  <div className="relative aspect-square w-full bg-zinc-100">
                    {photo.thumbnailUrl ? (
                      <Image
                        src={photo.thumbnailUrl}
                        alt="Trip photo"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                        No preview
                      </div>
                    )}
                    {photo.isCover && (
                      <span className="absolute top-2 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-zinc-950 shadow-xs">
                        ★ Cover
                      </span>
                    )}
                  </div>
                  <div className="p-2 flex items-center justify-between gap-1 border-t border-zinc-100">
                    {!photo.isCover ? (
                      <button
                        type="button"
                        onClick={() => handleSetCover(photo.id)}
                        disabled={settingCoverId === photo.id}
                        className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 hover:underline cursor-pointer"
                      >
                        {settingCoverId === photo.id ? "Setting..." : "Make Cover"}
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700">Album Cover</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDetach(photo.id)}
                      disabled={detachingId === photo.id}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                    >
                      {detachingId === photo.id ? "..." : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attach from drafts */}
        <div className="mt-6 pt-5 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Attach From Ready Drafts ({availableDrafts.length})
              </h4>
              <p className="text-[11px] text-zinc-500">
                Uploaded private media ready to be associated with this album.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenUpload}
              className="rounded-full bg-zinc-100 hover:bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-800 transition-colors cursor-pointer"
            >
              + Upload New
            </button>
          </div>

          {draftsLoading ? (
            <p className="mt-3 text-xs text-zinc-400">Loading drafts...</p>
          ) : availableDrafts.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">
              No unattached drafts available. Click &ldquo;Upload New&rdquo; to add private photos.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {availableDrafts.map((draft) => (
                <div key={draft.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  <div className="relative aspect-square w-full bg-zinc-100">
                    {draft.thumbnailUrl ? (
                      <Image
                        src={draft.thumbnailUrl}
                        alt={draft.originalFileName}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                        Preview
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] text-zinc-600 truncate">{draft.originalFileName}</p>
                    <button
                      type="button"
                      onClick={() => handleAttach(draft.id)}
                      disabled={isFull || attachingId === draft.id}
                      className="mt-1 w-full rounded-md bg-[#1F1F1F] py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                    >
                      {attachingId === draft.id ? "Attaching..." : isFull ? "Album Full" : "+ Attach"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end pt-3 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// -----------------------------------------------------------------------------
// ADD VISITED DESTINATION MODAL
// -----------------------------------------------------------------------------
function AddDestinationModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationResults, setDestinationResults] = useState<DestinationDto[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<DestinationDto | null>(null);
  const [firstVisitedAt, setFirstVisitedAt] = useState("");
  const [lastVisitedAt, setLastVisitedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!destinationQuery || destinationQuery.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/v1/travel-destinations/search?q=${encodeURIComponent(destinationQuery)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.destinations) setDestinationResults(data.destinations);
        })
        .catch(() => null);
    }, 250);
    return () => clearTimeout(timer);
  }, [destinationQuery]);

  const visibleDestinationResults = destinationQuery.length >= 2 ? destinationResults : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDestination) {
      setError("Please search and select a destination.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/travel-profiles/me/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: selectedDestination.name,
          countryCode: selectedDestination.countryCode,
          countryName: selectedDestination.countryName,
          regionName: selectedDestination.regionName,
          firstVisitedAt: firstVisitedAt || null,
          lastVisitedAt: lastVisitedAt || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || "Could not add destination.");
      }

      toast.success("Visited destination added.");
      onAdded();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to add destination.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <h3 className="text-base font-bold text-zinc-950">Add Visited Destination</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-800">
              Search City / Country <span className="text-rose-600">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                value={
                  selectedDestination
                    ? `${selectedDestination.name}, ${selectedDestination.countryName}`
                    : destinationQuery
                }
                onChange={(e) => {
                  setSelectedDestination(null);
                  setDestinationQuery(e.target.value);
                }}
                placeholder="Type a city name (e.g. Dubai, Tokyo, Paris)..."
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
              {selectedDestination && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDestination(null);
                    setDestinationQuery("");
                  }}
                  className="absolute right-2.5 top-2.5 text-xs text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              )}
            </div>
            {visibleDestinationResults.length > 0 && !selectedDestination && (
              <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
                {visibleDestinationResults.map((dest) => (
                  <li key={dest.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDestination(dest);
                        setDestinationResults([]);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-50 border-b border-zinc-50 flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium text-zinc-900">{dest.name}</span>
                      <span className="text-zinc-500 text-[11px]">{dest.countryName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-800">First Visited</label>
              <input
                type="date"
                value={firstVisitedAt}
                onChange={(e) => setFirstVisitedAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-800">Last Visited</label>
              <input
                type="date"
                value={lastVisitedAt}
                onChange={(e) => setLastVisitedAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedDestination}
              className="rounded-full bg-[#1F1F1F] px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Adding..." : "Add Destination"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

// -----------------------------------------------------------------------------
// DELETE DESTINATION CONFIRMATION MODAL
// -----------------------------------------------------------------------------
function DeleteDestinationModal({
  destination,
  onClose,
  onDeleted,
}: {
  destination: UserDestinationDto;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/travel-profiles/me/destinations/${destination.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || "Could not remove destination.");
      }

      if (data?.preservedVerifiedBooking) {
        toast.info("Self-declared entry removed. Your verified Homyz stay evidence remains verified.");
      } else {
        toast.success("Destination removed from your visited list.");
      }
      onDeleted();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to remove destination.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-zinc-950">Remove Destination?</h3>
        <p className="mt-2 text-xs text-zinc-600">
          Remove <span className="font-semibold text-zinc-900">&ldquo;{destination.name}&rdquo;</span> from your visited destinations?
          {destination.isVerified && (
            <span className="block mt-1 text-[11px] text-emerald-700 font-medium">
              Note: Verified booking evidence will be preserved.
            </span>
          )}
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-full bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

