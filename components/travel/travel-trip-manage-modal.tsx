"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import type { TravelTripDTO, TravelPhotoDTO } from "@/types/travel";
import { ADDRESS_COUNTRIES } from "@/lib/location/address-countries";

interface TravelTripManageModalProps {
  trip?: TravelTripDTO | null; // null if creating a new trip
  onClose: () => void;
  onTripCreated?: (newTrip: TravelTripDTO) => void;
  onTripUpdated?: (updatedTrip: TravelTripDTO) => void;
  onTripDeleted?: (deletedTripId: string) => void;
  onAddPhotosClick?: (tripId: string) => void;
  startWithDeleteConfirmation?: boolean;
}

export function TravelTripManageModal({
  trip,
  onClose,
  onTripCreated,
  onTripUpdated,
  onTripDeleted,
  onAddPhotosClick,
  startWithDeleteConfirmation = false,
}: TravelTripManageModalProps) {
  const isEditing = Boolean(trip);
  const [title, setTitle] = useState(trip?.title || "");
  const [countryCode, setCountryCode] = useState(trip?.destination?.countryCode || "");
  const [startDate, setStartDate] = useState(
    trip?.startDate ? new Date(trip.startDate).toISOString().split("T")[0] : ""
  );
  const [endDate, setEndDate] = useState(
    trip?.endDate ? new Date(trip.endDate).toISOString().split("T")[0] : ""
  );
  const [photos, setPhotos] = useState<TravelPhotoDTO[]>(trip?.photos || []);
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(trip?.coverPhotoId || null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePolicy, setDeletePolicy] = useState<"UNLINK_PHOTOS" | "DELETE_PHOTOS">("UNLINK_PHOTOS");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(startWithDeleteConfirmation);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Trip title is required");
      return;
    }
    if (!countryCode) {
      toast.error("Choose a destination country");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      toast.error("End date cannot be before start date");
      return;
    }

    setSaving(true);
    try {
      if (isEditing && trip) {
        const res = await fetch(`/api/v1/travel-media/trips/${trip.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            country: countryCode,
            startDate: startDate || null,
            endDate: endDate || null,
            coverPhotoId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update trip");

        toast.success("Trip album updated!");
        onTripUpdated?.(data.trip);
        onClose();
      } else {
        const res = await fetch("/api/v1/travel-media/trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            country: countryCode,
            startDate: startDate || null,
            endDate: endDate || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create trip");

        toast.success("Trip album created!");
        onTripCreated?.(data.trip);
        onClose();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error saving trip");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhotoFromTrip = async (photoId: string) => {
    try {
      const res = await fetch(`/api/v1/travel-media/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unlink photo");

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (coverPhotoId === photoId) setCoverPhotoId(null);
      toast.success("Photo removed from album.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error unlinking photo");
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/travel-media/trips/${trip.id}?policy=${deletePolicy}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete trip");

      toast.success("Trip deleted successfully.");
      onTripDeleted?.(trip.id);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error deleting trip");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-200 text-zinc-900 relative my-auto max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
        >
          ✕
        </button>

        <h3 className="text-xl font-medium text-zinc-900 tracking-tight mb-1">
          {isEditing ? "Manage Trip Album" : "Create New Trip Album"}
        </h3>
        <p className="text-xs text-zinc-500 mb-6">
          Each trip holds up to 5 photos with dates, destination, and cover image.
        </p>

        {showDeleteConfirm ? (
          <div className="space-y-4 py-4 animate-in fade-in">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
              <h4 className="text-sm font-medium mb-1">Delete &quot;{trip?.title}&quot;?</h4>
              <p className="text-xs text-rose-700 leading-relaxed mb-3">
                Choose how you want to handle the photos currently inside this trip:
              </p>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="deletePolicy"
                    checked={deletePolicy === "UNLINK_PHOTOS"}
                    onChange={() => setDeletePolicy("UNLINK_PHOTOS")}
                    className="accent-rose-600"
                  />
                  <span>Keep photos in my travel diary (unlink from trip)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-rose-800">
                  <input
                    type="radio"
                    name="deletePolicy"
                    checked={deletePolicy === "DELETE_PHOTOS"}
                    onChange={() => setDeletePolicy("DELETE_PHOTOS")}
                    className="accent-rose-600"
                  />
                  <span>Delete photos permanently</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2 rounded-full border border-zinc-300 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTrip}
                disabled={deleting}
                className="px-6 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Trip Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Summer in Santorini"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                required
                className="w-full text-xs sm:text-sm rounded-xl border border-zinc-300 px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Destination country *
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
                className="w-full text-xs sm:text-sm rounded-xl border border-zinc-300 px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Choose a country</option>
                {ADDRESS_COUNTRIES.map((country) => (
                  <option key={country.iso2} value={country.iso2}>{country.name}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-400">Trips use a country-level destination; no city is required.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-zinc-300 px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-zinc-300 px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Photos inside this trip */}
            {isEditing && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-700">
                    Photos in this trip ({photos.length}/5)
                  </span>
                  {photos.length < 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onAddPhotosClick?.(trip!.id);
                      }}
                      className="text-xs font-medium text-amber-700 hover:text-amber-800 cursor-pointer"
                    >
                      + Add photos ({5 - photos.length} left)
                    </button>
                  )}
                </div>

                {photos.length > 0 ? (
                  <div className="grid grid-cols-5 gap-2">
                    {photos.map((p) => {
                      const isCover = coverPhotoId === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 group cursor-pointer transition ${
                            isCover ? "border-amber-500 ring-2 ring-amber-300" : "border-zinc-200"
                          }`}
                          onClick={() => setCoverPhotoId(p.id)}
                          title="Click to set as cover photo"
                        >
                          <Image src={p.mediumUrl || p.url} alt="Trip photo" fill className="object-cover" />
                          {isCover && (
                            <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-white text-[9px] font-medium text-center py-0.5">
                              Cover
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhotoFromTrip(p.id);
                            }}
                            title="Remove from trip"
                            className="absolute top-1 right-1 size-4 rounded-full bg-black/60 hover:bg-black/90 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No photos added to this trip yet.</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                >
                  Delete Trip
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-full border border-zinc-300 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-full bg-zinc-900 hover:bg-black text-white text-xs font-medium transition cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Trip"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </ModalOverlay>
  );
}
