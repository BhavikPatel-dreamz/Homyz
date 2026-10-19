"use client";

import React, { useState, useEffect } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import type { DestinationDto, TravelProfileDto } from "@/lib/validation/travel-trip";

export function TravelProfileEditModal({
  profile,
  onClose,
  onUpdated,
}: {
  profile: TravelProfileDto;
  onClose: () => void;
  onUpdated: (updated: TravelProfileDto) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.user?.name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [handle, setHandle] = useState(profile.handle || "");
  const [visibility, setVisibility] = useState<"PRIVATE" | "CONNECTIONS" | "PUBLIC">(
    profile.visibility || "PRIVATE",
  );
  const [locationQuery, setLocationQuery] = useState(profile.homeDestination?.name || "");
  const [locationResults, setLocationResults] = useState<DestinationDto[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<DestinationDto | null>(
    profile.homeDestination,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete location search
  useEffect(() => {
    if (!locationQuery || locationQuery.length < 2) return;
    const timer = setTimeout(() => {
      fetch(`/api/v1/travel-destinations/search?q=${encodeURIComponent(locationQuery)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.destinations) setLocationResults(data.destinations);
        })
        .catch(() => null);
    }, 250);
    return () => clearTimeout(timer);
  }, [locationQuery]);

  const visibleLocationResults = locationQuery.length >= 2 ? locationResults : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate handle format if provided
    if (handle.trim() && !/^[a-zA-Z0-9_]{3,30}$/.test(handle.trim())) {
      setError("Handle must be 3-30 alphanumeric characters or underscores.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/travel-profiles/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || null,
          handle: handle.trim() || null,
          visibility,
          homeDestinationId: selectedDestination?.id || null,
          location: selectedDestination
            ? `${selectedDestination.name}, ${selectedDestination.countryName}`
            : locationQuery.trim() || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to update profile.");
      }

      toast.success("Travel profile updated.");
      onUpdated(data.profile);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-950">Edit Travel Profile</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Manage your traveler identity and privacy settings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800">
              Display Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Jane Doe"
              required
              maxLength={100}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          {/* Travel Handle */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800">
              Travel Handle (Username)
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3.5 top-2 text-xs text-zinc-400">@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="traveler_jane"
                maxLength={30}
                className="w-full rounded-xl border border-zinc-200 pl-8 pr-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">
              3-30 letters, numbers, and underscores. Used for your profile URL.
            </p>
          </div>

          {/* Home / Current Location */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800">Home Location</label>
            <div className="relative mt-1">
              <input
                type="text"
                value={
                  selectedDestination
                    ? `${selectedDestination.name}, ${selectedDestination.countryName}`
                    : locationQuery
                }
                onChange={(e) => {
                  setSelectedDestination(null);
                  const val = e.target.value;
                  setLocationQuery(val);
                  if (!val || val.length < 2) setLocationResults([]);
                }}
                placeholder="Search city (e.g. Dubai, Paris, Tokyo)..."
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
              {selectedDestination && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDestination(null);
                    setLocationQuery("");
                    setLocationResults([]);
                  }}
                  className="absolute right-2.5 top-2.5 text-xs text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              )}
            </div>
            {visibleLocationResults.length > 0 && !selectedDestination && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
                {visibleLocationResults.map((dest) => (
                  <li key={dest.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDestination(dest);
                        setLocationResults([]);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-50 border-b border-zinc-50 flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium text-zinc-900">{dest.name}</span>
                      <span className="text-[11px] text-zinc-500">{dest.countryName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-800">Bio</label>
              <span className="text-[11px] text-zinc-400">{bio.length}/500</span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other travelers about your favorite destinations, travel style, and interests..."
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
              Profile Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex cursor-pointer flex-col rounded-2xl border p-3.5 transition ${
                  visibility === "PUBLIC"
                    ? "border-amber-500 bg-amber-50/50 ring-1 ring-amber-500"
                    : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-950">🌍 Public</span>
                  <input
                    type="radio"
                    name="visibility"
                    value="PUBLIC"
                    checked={visibility === "PUBLIC"}
                    onChange={() => setVisibility("PUBLIC")}
                    className="accent-amber-600"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
                  Visible to other travelers and hosts on Homyz.
                </p>
              </label>

              <label
                className={`flex cursor-pointer flex-col rounded-2xl border p-3.5 transition ${
                  visibility === "PRIVATE"
                    ? "border-amber-500 bg-amber-50/50 ring-1 ring-amber-500"
                    : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-950">🔒 Private</span>
                  <input
                    type="radio"
                    name="visibility"
                    value="PRIVATE"
                    checked={visibility === "PRIVATE"}
                    onChange={() => setVisibility("PRIVATE")}
                    className="accent-amber-600"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
                  Only visible to you when logged in.
                </p>
              </label>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#FCDF9C] px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#F7D37D] disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

