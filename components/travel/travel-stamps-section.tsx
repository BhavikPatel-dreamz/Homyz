"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import type { UserTravelStampDTO } from "@/types/travel";
import { TravelStampDetailModal } from "./travel-stamp-detail-modal";
import { TravelStampManagerModal } from "./travel-stamp-manager-modal";
import {
  removeTravelStampAction,
  toggleStampPinnedAction,
  setStampsSectionVisibilityAction,
} from "@/actions/travel/travelStampsAndBadges";
import { toast } from "@/components/ui/toast";

interface TravelStampsSectionProps {
  stamps: UserTravelStampDTO[];
  initialNextCursor?: string | null;
  totalCount?: number;
  showStamps?: boolean;
  isOwner?: boolean;
  onRefresh?: () => void;
}

export function TravelStampsSection({
  stamps,
  initialNextCursor = null,
  totalCount = stamps.length,
  showStamps = true,
  isOwner = true,
  onRefresh,
}: TravelStampsSectionProps) {
  const [localStamps, setLocalStamps] = useState<UserTravelStampDTO[]>(stamps);
  const [isVisible, setIsVisible] = useState(showStamps);
  const [selectedStamp, setSelectedStamp] = useState<UserTravelStampDTO | null>(
    null,
  );
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [customStampToEdit, setCustomStampToEdit] =
    useState<UserTravelStampDTO | null>(null);
  const [stampPendingRemoval, setStampPendingRemoval] =
    useState<UserTravelStampDTO | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [collectionCount, setCollectionCount] = useState(totalCount);

  // Completion awards are committed by the background worker. A router refresh
  // must update the existing profile section rather than leaving its local
  // collection state stale until the user reloads the page.
  useEffect(() => {
    setLocalStamps(stamps);
    setNextCursor(initialNextCursor);
    setCollectionCount(totalCount);
  }, [stamps, initialNextCursor, totalCount]);

  const handleToggleVisibility = async () => {
    if (!isOwner || isTogglingVisibility) return;
    const nextVal = !isVisible;
    setIsVisible(nextVal);
    setIsTogglingVisibility(true);
    try {
      await setStampsSectionVisibilityAction(nextVal);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to toggle stamps section visibility", err);
      setIsVisible(!nextVal); // rollback
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleTogglePin = async (userStampId: string) => {
    setIsPinning(true);
    try {
      const updated = await toggleStampPinnedAction(userStampId);
      setLocalStamps((prev) =>
        prev.map((s) =>
          s.id === userStampId ? { ...s, isPinned: updated.isPinned } : s,
        ),
      );
      if (selectedStamp && selectedStamp.id === userStampId) {
        setSelectedStamp((prev) =>
          prev ? { ...prev, isPinned: updated.isPinned } : null,
        );
      }
      onRefresh?.();
    } catch (err) {
      console.error("Failed to toggle stamp pin", err);
    } finally {
      setIsPinning(false);
    }
  };

  const handleRemoveStamp = async () => {
    if (!stampPendingRemoval || isRemoving) return;
    setIsRemoving(true);
    try {
      await removeTravelStampAction(stampPendingRemoval.id);
      setLocalStamps((current) =>
        current.filter((stamp) => stamp.id !== stampPendingRemoval.id),
      );
      setCollectionCount((count) => Math.max(0, count - 1));
      setSelectedStamp((current) =>
        current?.id === stampPendingRemoval.id ? null : current,
      );
      toast.success(
        `${stampPendingRemoval.stamp.displayName} removed from your travel profile.`,
      );
      setStampPendingRemoval(null);
      onRefresh?.();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Unable to remove this travel stamp.",
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/v1/travel-media/stamps?${new URLSearchParams({ limit: "12", cursor: nextCursor })}`,
      );
      const data = (await response.json()) as {
        data?: UserTravelStampDTO[];
        nextCursor?: string | null;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Unable to load more travel stamps.");
      setLocalStamps((current) => {
        const ids = new Set(current.map((stamp) => stamp.id));
        return [
          ...current,
          ...(data.data || []).filter((stamp) => !ids.has(stamp.id)),
        ];
      });
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Unable to load more travel stamps.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  // If section hidden by owner and viewer is not owner, render nothing
  if (!isVisible && !isOwner) {
    return null;
  }

  return (
    <section className="pt-8 sm:pt-10 my-8">
      {/* Header & Visibility Switch (Matching Figma Screenshot 1 & Image 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 max-w-[748px]">
        <div>
          <h2 className="text-lg font-medium text-[#1F1F1F] tracking-tight">
            Where I&apos;ve been
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Pick the stamps you want other people to see on your profile.
          </p>
          {/* Mobile toggle switch & add stamp button */}
          {isOwner && (
            <div className="flex sm:hidden items-center gap-3 mt-3">
              <button
                type="button"
                role="switch"
                aria-checked={isVisible}
                disabled={isTogglingVisibility}
                onClick={handleToggleVisibility}
                className={`relative inline-flex h-4.75 w-10.75 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isVisible ? "bg-[#DF4557]" : "bg-[#DDDDDE]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block size-3.75 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isVisible ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => setIsManagerOpen(true)}
                className="rounded-full border hover:border-zinc-300 border-[#1f1f1f] hover:bg-[#FCDF9C] bg-[#1f1f1f] hover:text-[#1F1F1F] text-white px-3 py-1 text-xs font-medium transition duration-300 cursor-pointer"
              >
                Add travel stamp
              </button>
            </div>
          )}
        </div>

        {/* Action button & Visibility Toggle Switch (Desktop) */}
        {isOwner && (
          <div className="hidden sm:flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsManagerOpen(true)}
              className="rounded-full border hover:border-zinc-300 border-[#1f1f1f] hover:bg-[#FCDF9C] bg-[#1f1f1f] hover:text-[#1F1F1F] text-white px-4 py-1.5 text-sm font-medium transition duration-300 cursor-pointer"
            >
              Add travel stamp
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={isVisible}
              disabled={isTogglingVisibility}
              onClick={handleToggleVisibility}
              className={`relative inline-flex h-4.75 w-10.75 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isVisible ? "bg-[#DF4557]" : "bg-[#DDDDDE]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block size-3.75 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isVisible ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* When Owner toggled visibility off, show subtle notice */}
      {!isVisible && isOwner && (
        <div className="mb-6 p-3 rounded-lg bg-amber-400/20 border border-amber-400 text-xs text-[#1f1f1f] flex items-center gap-2">
          <span className="size-2 rounded-full bg-amber-500 shrink-0" />
          <span>
            This section is currently hidden from your public travel profile.
            Only you can see it.
          </span>
        </div>
      )}

      {/* Stamp Collection Display (Matching Figma Screenshot 1 / Target Image 2) */}
      {localStamps.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-start sm:gap-12 justify-items-center py-3">
            {(isExpanded ? localStamps : localStamps.slice(0, 12)).map(
              (userStamp) => {
                const stamp = userStamp.stamp;
                const hasEmbeddedText = Boolean(
                  stamp.iconUrl?.includes("/images/travel/stamps/"),
                );
                return (
                  <div
                    key={userStamp.id}
                    className="group relative flex w-full max-w-[160px] sm:w-44 flex-col items-center"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedStamp(userStamp)}
                      className="flex flex-col items-center focus:outline-none transition-transform hover:scale-105 focus-visible:scale-105"
                    >
                      <div className="relative h-40 w-32 sm:h-52 sm:w-44 transition flex items-center justify-center">
                        {stamp.iconUrl ? (
                          <Image
                            src={stamp.iconUrl}
                            alt={stamp.displayName}
                            width={160}
                            height={192}
                            loading="lazy"
                            unoptimized={Boolean(
                              stamp.iconUrl.endsWith(".svg"),
                            )}
                            className="size-full object-contain drop-shadow-2xs"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-4xl">
                            🏛️
                          </span>
                        )}

                        {userStamp.isPinned && (
                          <span
                            title="Featured Stamp"
                            className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-medium text-white shadow"
                          >
                            ★
                          </span>
                        )}
                      </div>

                      {!hasEmbeddedText && (
                        <span className="mt-2 line-clamp-2 text-center text-xs sm:text-sm font-medium text-[#1F1F1F] transition">
                          {stamp.displayName}
                        </span>
                      )}
                    </button>
                    {isOwner && !userStamp.isSystemAwarded && (
                      <div className="absolute right-0 top-0 flex gap-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        {stamp.isCustom && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomStampToEdit(userStamp);
                              setIsManagerOpen(true);
                            }}
                            aria-label={`Edit ${stamp.displayName}`}
                            title={`Edit ${stamp.displayName}`}
                            className="flex size-8 items-center justify-center rounded-full border border-white bg-white text-xs text-zinc-800 shadow-sm transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 cursor-pointer"
                          >
                            ✎
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setStampPendingRemoval(userStamp)}
                          aria-label={`Remove ${stamp.displayName} from your travel profile`}
                          title={`Remove ${stamp.displayName}`}
                          className="flex size-8 items-center justify-center rounded-full border border-white bg-zinc-900 text-base leading-none text-white shadow-sm transition hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {stamp.isCustom && (
                      <span className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-800">
                        Personal
                      </span>
                    )}
                    {userStamp.isSystemAwarded && (
                      <span className="mt-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                        Verified stay
                      </span>
                    )}
                    {!userStamp.isSystemAwarded && !stamp.isCustom && (
                      <span className="mt-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-600">
                        Selected
                      </span>
                    )}
                  </div>
                );
              },
            )}
          </div>
          {(nextCursor || localStamps.length > 12) && (
            <div className="mt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsExpanded((value) => !value)}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                {isExpanded
                  ? "Show less"
                  : `View all ${collectionCount} stamps`}
              </button>
              {isExpanded && nextCursor && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  {isLoadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        /* Empty State (Exact copy specified in requirements) */
        <div className="py-10 px-6 text-center rounded-3xl bg-zinc-50/80 border border-dashed border-zinc-200">
          <div className="size-14 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
            🛂
          </div>
          <h4 className="text-base font-medium text-zinc-900">
            Choose or Add Travel Stamps
          </h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            Collect travel stamps to showcase your journeys.
          </p>
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsManagerOpen(true)}
                className="mt-4 rounded-full bg-[#FCDF9C] px-5 py-2.5 text-base font-normal text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white transition duration-300 cursor-pointer"
            >
              Add Travel Stamps
            </button>
          )}
        </div>
      )}

      {/* Stamp Detail Modal */}
      <TravelStampDetailModal
        userStamp={selectedStamp}
        isOpen={Boolean(selectedStamp)}
        onClose={() => setSelectedStamp(null)}
        onTogglePin={isOwner && !selectedStamp?.isSystemAwarded ? handleTogglePin : undefined}
        isPinning={isPinning}
      />

      {/* Stamp Selection / Manager Modal */}
      {isOwner && (
        <TravelStampManagerModal
          key={customStampToEdit?.id || "catalog-picker"}
          isOpen={isManagerOpen}
          stamps={localStamps}
          initialCustomStamp={customStampToEdit}
          onClose={() => {
            setIsManagerOpen(false);
            setCustomStampToEdit(null);
          }}
          onStampsChange={(updated) => {
            setLocalStamps(updated);
            setCollectionCount(updated.length);
            setNextCursor(null);
            onRefresh?.();
          }}
        />
      )}

      {stampPendingRemoval && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-stamp-title"
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3
              id="remove-stamp-title"
              className="text-lg font-medium text-zinc-900"
            >
              Remove Travel Stamp?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Remove {stampPendingRemoval.stamp.displayName} from your travel
              profile? You can add it again later.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStampPendingRemoval(null)}
                disabled={isRemoving}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveStamp}
                disabled={isRemoving}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
