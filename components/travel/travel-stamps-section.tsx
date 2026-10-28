"use client";

import React, { useState } from "react";
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
    <section className="border-t border-zinc-200/80 pt-8 sm:pt-10 my-8">
      {/* Header & Visibility Switch (Matching Figma Screenshot 1 & Image 2) */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight">
            Where I&apos;ve been
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Pick the stamps you want other people to see on your profile.
          </p>
        </div>

        {/* Action button & Visibility Toggle Switch */}
        {isOwner && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsManagerOpen(true)}
              className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-black cursor-pointer"
            >
              Add travel stamp
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={isVisible}
              disabled={isTogglingVisibility}
              onClick={handleToggleVisibility}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 ${
                isVisible ? "bg-red-500" : "bg-zinc-200"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isVisible ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* When Owner toggled visibility off, show subtle notice */}
      {!isVisible && isOwner && (
        <div className="mb-6 p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 flex items-center gap-2">
          <span className="size-2 rounded-full bg-amber-400 shrink-0" />
          <span>
            This section is currently hidden from your public travel profile.
            Only you can see it.
          </span>
        </div>
      )}

      {/* Stamp Collection Display (Matching Figma Screenshot 1 / Target Image 2) */}
      {localStamps.length > 0 ? (
        <>
          <div className="flex flex-wrap items-start gap-6 sm:gap-8 py-3">
            {(isExpanded ? localStamps : localStamps.slice(0, 12)).map(
              (userStamp) => {
                const stamp = userStamp.stamp;
                return (
                  <div
                    key={userStamp.id}
                    className="group relative flex w-24 flex-col items-center sm:w-28"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedStamp(userStamp)}
                      className="flex flex-col items-center focus:outline-none transition-transform hover:scale-105 focus-visible:scale-105"
                    >
                      <div className="relative size-24 rounded-full border border-dashed border-zinc-300 bg-zinc-50/80 p-2 shadow-2xs transition group-hover:border-amber-400 group-hover:bg-amber-50/50 sm:size-28">
                        {stamp.iconUrl ? (
                          <Image
                            src={stamp.iconUrl}
                            alt={stamp.displayName}
                            width={84}
                            height={84}
                            loading="lazy"
                            unoptimized={Boolean(
                              stamp.iconUrl.endsWith(".svg"),
                            )}
                            className="size-full object-contain"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-3xl">
                            🏛️
                          </span>
                        )}

                        {userStamp.isPinned && (
                          <span
                            title="Featured Stamp"
                            className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white shadow"
                          >
                            ★
                          </span>
                        )}
                      </div>

                      <span className="mt-2 line-clamp-2 text-center text-xs font-medium text-zinc-800 transition group-hover:text-amber-900 sm:text-sm">
                        {stamp.displayName}
                      </span>
                    </button>
                    {isOwner && (
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
                            className="flex size-8 items-center justify-center rounded-full border border-white bg-white text-xs text-zinc-800 shadow-sm transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                          >
                            ✎
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setStampPendingRemoval(userStamp)}
                          aria-label={`Remove ${stamp.displayName} from your travel profile`}
                          title={`Remove ${stamp.displayName}`}
                          className="flex size-8 items-center justify-center rounded-full border border-white bg-zinc-900 text-base leading-none text-white shadow-sm transition hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {stamp.isCustom && (
                      <span className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                        Personal
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
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
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
                  className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
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
          <h4 className="text-base font-bold text-zinc-900">
            Choose or Add Travel Stamps
          </h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            Collect travel stamps to showcase your journeys.
          </p>
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsManagerOpen(true)}
              className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-black transition cursor-pointer"
            >
              Choose or Add Travel Stamps
            </button>
          )}
        </div>
      )}

      {/* Stamp Detail Modal */}
      <TravelStampDetailModal
        userStamp={selectedStamp}
        isOpen={Boolean(selectedStamp)}
        onClose={() => setSelectedStamp(null)}
        onTogglePin={isOwner ? handleTogglePin : undefined}
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
              className="text-lg font-bold text-zinc-900"
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
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveStamp}
                disabled={isRemoving}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
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
