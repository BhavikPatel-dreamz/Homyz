"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { TravelStampPickerItemDTO, UserTravelStampDTO } from "@/types/travel";
import {
  addTravelStampSelectionsAction,
  getTravelStampPickerItemsAction,
  removeTravelStampAction,
  reorderTravelStampsAction,
} from "@/actions/travel/travelStampsAndBadges";
import { toast } from "@/components/ui/toast";

interface TravelStampManagerModalProps {
  isOpen: boolean;
  stamps: UserTravelStampDTO[];
  onClose: () => void;
  onStampsChange: (stamps: UserTravelStampDTO[]) => void;
}

export function TravelStampManagerModal({
  isOpen,
  stamps,
  onClose,
  onStampsChange,
}: TravelStampManagerModalProps) {
  const [items, setItems] = useState<TravelStampPickerItemDTO[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedStamps = useMemo(
    () => [...stamps].sort((a, b) => a.displayOrder - b.displayOrder),
    [stamps]
  );

  // Derive unique countries from picker items
  const countries = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.countryName) set.add(item.countryName);
    });
    return Array.from(set).sort();
  }, [items]);

  const loadItems = async (term = "", country = "all") => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTravelStampPickerItemsAction(term, country);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load destination stamps.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setSelectedCountry("all");
    setSelectedIds(new Set());
    setError(null);
    void loadItems("", "all");
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (item: TravelStampPickerItemDTO) => {
    if (item.isAlreadyCollected) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  const handleSaveSelection = async () => {
    if (!selectedIds.size) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await addTravelStampSelectionsAction({
        catalogStampIds: Array.from(selectedIds),
      });
      onStampsChange(updated);
      setSelectedIds(new Set());
      toast.success("Stamps added to your passport!");
      await loadItems(search, selectedCountry);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add destination stamps.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveStamp = async (userStamp: UserTravelStampDTO) => {
    if (!window.confirm(`Remove ${userStamp.stamp.displayName} from your passport stamps?`)) {
      return;
    }
    setIsSaving(true);
    try {
      await removeTravelStampAction(userStamp.id);
      const next = stamps.filter((s) => s.id !== userStamp.id);
      onStampsChange(next);
      toast.success(`Removed ${userStamp.stamp.displayName}.`);
      await loadItems(search, selectedCountry);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove stamp.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveStamp = async (index: number, direction: -1 | 1) => {
    const next = [...sortedStamps];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];

    setIsSaving(true);
    try {
      const updated = await reorderTravelStampsAction(next.map((s) => s.id));
      onStampsChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reorder stamps.");
      onStampsChange(stamps);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Close stamp manager"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stamp-manager-title"
        className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-[780px] sm:rounded-3xl"
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-zinc-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 id="stamp-manager-title" className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
              My Travel Stamps
            </h2>
            <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
              Collect stamps from places you've visited and share your travel story.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-6">
          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
              {error}
            </div>
          )}

          {/* Search & Country Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  void loadItems(e.target.value, selectedCountry);
                }}
                placeholder="Search country or city (e.g. Paris, London, Dubai...)"
                aria-label="Search country or city"
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm outline-none focus:border-amber-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    void loadItems("", selectedCountry);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Clear
                </button>
              )}
            </div>

            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                void loadItems(search, e.target.value);
              }}
              className="rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-700 outline-none focus:border-amber-400"
            >
              <option value="all">All Countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Stamp Catalog Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900">Available Destination Stamps</h3>
              {selectedIds.size > 0 && (
                <span className="text-xs font-semibold text-amber-700">
                  {selectedIds.size} stamp{selectedIds.size === 1 ? "" : "s"} selected
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-8 text-center text-xs text-zinc-500">
                Loading destination stamps...
              </div>
            ) : items.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:gap-3 md:grid-cols-3 sm:overflow-visible">
                {items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={item.isAlreadyCollected || isSaving}
                      onClick={() => toggleSelect(item)}
                      className={`group relative flex w-[48%] shrink-0 items-center gap-2.5 rounded-2xl border p-2.5 text-left transition snap-start sm:w-auto ${
                        item.isAlreadyCollected
                          ? "cursor-not-allowed border-zinc-100 bg-zinc-50/70 opacity-60"
                          : isSelected
                          ? "border-amber-400 bg-amber-50/80 ring-1 ring-amber-300"
                          : "border-zinc-200 bg-white hover:border-amber-300 hover:bg-amber-50/30 cursor-pointer"
                      }`}
                    >
                      {/* Stamp Art Graphic */}
                      <div className="relative size-12 shrink-0 rounded-full border border-dashed border-zinc-300 p-0.5 flex items-center justify-center bg-white shadow-2xs group-hover:border-amber-400 sm:size-14">
                        {item.iconUrl ? (
                          <Image
                            src={item.iconUrl}
                            alt={item.displayName}
                            width={46}
                            height={46}
                            unoptimized={Boolean(item.iconUrl.endsWith(".svg"))}
                            className="object-contain"
                          />
                        ) : (
                          <span className="text-lg sm:text-xl">✈️</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-sm font-bold text-zinc-900">
                            {item.displayName}
                          </p>
                          {isSelected && <span className="text-amber-700 font-bold text-xs">✓</span>}
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {[item.cityName, item.countryName].filter(Boolean).join(", ") || item.category}
                        </p>
                        <div className="mt-1">
                          {item.isAlreadyCollected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8.333 2.5L3.75 7.08333L1.667 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              Added
                            </span>
                          ) : isSelected ? (
                            <span className="text-[10px] font-semibold text-amber-700">Selected</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-zinc-700">+ Add</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center text-xs text-zinc-500">
                No destination stamps found matching your search.
              </div>
            )}

            {/* Add Selected Button */}
            {selectedIds.size > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 sm:px-4">
                <p className="text-sm font-semibold text-zinc-900">{selectedIds.size} stamp{selectedIds.size === 1 ? "" : "s"} selected</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    disabled={isSaving}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedIds.size || isSaving}
                    onClick={handleSaveSelection}
                    className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSaving ? "Adding..." : `Add ${selectedIds.size} Stamp${selectedIds.size === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Currently Collected Stamps in Passport */}
          {sortedStamps.length > 0 && (
            <div className="border-t border-zinc-100 pt-5">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-zinc-900">Your Collected Stamps ({sortedStamps.length})</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Use the arrows to reorder stamps or remove stamps from your passport.
                </p>
              </div>

              <div className="space-y-2">
                {sortedStamps.map((userStamp, index) => (
                  <div
                    key={userStamp.id}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xs"
                  >
                    <div className="relative size-12 shrink-0 rounded-full border border-dashed border-zinc-300 p-1 flex items-center justify-center bg-zinc-50">
                      {userStamp.stamp.iconUrl ? (
                        <Image
                          src={userStamp.stamp.iconUrl}
                          alt={userStamp.stamp.displayName}
                          width={38}
                          height={38}
                          unoptimized={Boolean(userStamp.stamp.iconUrl.endsWith(".svg"))}
                          className="object-contain"
                        />
                      ) : (
                        <span className="text-base">✈️</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-zinc-900">
                        {userStamp.stamp.title || userStamp.stamp.displayName}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {[userStamp.stamp.city, userStamp.stamp.country].filter(Boolean).join(", ") || userStamp.stamp.category}
                      </p>
                    </div>

                    {/* Order Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveStamp(index, -1)}
                        disabled={index === 0 || isSaving}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
                        title="Move left"
                        aria-label="Move stamp left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStamp(index, 1)}
                        disabled={index === sortedStamps.length - 1 || isSaving}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
                        title="Move right"
                        aria-label="Move stamp right"
                      >
                        →
                      </button>
                    </div>

                    {/* Note: Admin manages catalog; guests do not Add personal stamp or Save changes to stamp designs */}
                    <button
                      type="button"
                      onClick={() => handleRemoveStamp(userStamp)}
                      disabled={isSaving}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 z-10 flex justify-end border-t border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
