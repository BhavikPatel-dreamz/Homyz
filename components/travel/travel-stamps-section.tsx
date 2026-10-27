"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import type { UserTravelStampDTO } from "@/types/travel";
import { TravelStampDetailModal } from "./travel-stamp-detail-modal";
import { TravelStampManagerModal } from "./travel-stamp-manager-modal";
import {
  toggleStampPinnedAction,
  setStampsSectionVisibilityAction,
} from "@/actions/travel/travelStampsAndBadges";

interface TravelStampsSectionProps {
  stamps: UserTravelStampDTO[];
  showStamps?: boolean;
  isOwner?: boolean;
  onRefresh?: () => void;
}

export function TravelStampsSection({
  stamps,
  showStamps = true,
  isOwner = true,
  onRefresh,
}: TravelStampsSectionProps) {
  const [localStamps, setLocalStamps] = useState<UserTravelStampDTO[]>(stamps);
  const [isVisible, setIsVisible] = useState(showStamps);
  const [selectedStamp, setSelectedStamp] = useState<UserTravelStampDTO | null>(null);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    setLocalStamps(stamps);
  }, [stamps]);

  useEffect(() => {
    setIsVisible(showStamps);
  }, [showStamps]);

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
        prev.map((s) => (s.id === userStampId ? { ...s, isPinned: updated.isPinned } : s))
      );
      if (selectedStamp && selectedStamp.id === userStampId) {
        setSelectedStamp((prev) => (prev ? { ...prev, isPinned: updated.isPinned } : null));
      }
      onRefresh?.();
    } catch (err) {
      console.error("Failed to toggle stamp pin", err);
    } finally {
      setIsPinning(false);
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
          <span>This section is currently hidden from your public travel profile. Only you can see it.</span>
        </div>
      )}

      {/* Stamp Collection Display (Matching Figma Screenshot 1 / Target Image 2) */}
      {localStamps.length > 0 ? (
        <div className="flex flex-wrap items-center gap-8 sm:gap-12 py-3">
          {localStamps.map((userStamp) => {
            const stamp = userStamp.stamp;
            return (
              <button
                key={userStamp.id}
                type="button"
                onClick={() => setSelectedStamp(userStamp)}
                className="group flex flex-col items-center cursor-pointer focus:outline-none transition transform hover:scale-105"
              >
                {/* Circular Stamp Graphic (Passport Hand-drawn Stamp Style) */}
                <div className="relative size-24 sm:size-28 rounded-full border border-dashed border-zinc-300 p-2 flex items-center justify-center bg-zinc-50/80 group-hover:bg-amber-50/50 group-hover:border-amber-400 transition shadow-2xs">
                  {stamp.iconUrl ? (
                    <Image
                      src={stamp.iconUrl}
                      alt={stamp.displayName}
                      width={84}
                      height={84}
                      unoptimized={Boolean(stamp.iconUrl.endsWith(".svg"))}
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-3xl">🏛️</span>
                  )}

                  {/* Pinned star badge */}
                  {userStamp.isPinned && (
                    <span
                      title="Featured Stamp"
                      className="absolute -top-1 -right-1 size-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center shadow"
                    >
                      ★
                    </span>
                  )}
                </div>

                {/* Stamp Caption (e.g. Paris, Coffee) */}
                <span className="text-xs sm:text-sm text-zinc-800 font-medium text-center mt-2 group-hover:text-amber-900 transition">
                  {stamp.displayName}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Empty State (Exact copy specified in requirements) */
        <div className="py-10 px-6 text-center rounded-3xl bg-zinc-50/80 border border-dashed border-zinc-200">
          <div className="size-14 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
            🛂
          </div>
          <h4 className="text-base font-bold text-zinc-900">
            No travel stamps collected yet
          </h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            Explore destinations and add stamps to your travel profile.
          </p>
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsManagerOpen(true)}
              className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-black transition cursor-pointer"
            >
              Explore Travel Stamps
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
          isOpen={isManagerOpen}
          stamps={localStamps}
          onClose={() => setIsManagerOpen(false)}
          onStampsChange={(updated) => {
            setLocalStamps(updated);
            onRefresh?.();
          }}
        />
      )}
    </section>
  );
}
