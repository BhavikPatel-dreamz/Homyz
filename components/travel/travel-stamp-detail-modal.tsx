"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import type { UserTravelStampDTO } from "@/types/travel";

interface TravelStampDetailModalProps {
  userStamp: UserTravelStampDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onTogglePin?: (userStampId: string) => Promise<void>;
  isPinning?: boolean;
}

export function TravelStampDetailModal({
  userStamp,
  isOpen,
  onClose,
  onTogglePin,
  isPinning = false,
}: TravelStampDetailModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !userStamp) return null;

  const stamp = userStamp.stamp;
  const awardDateStr = new Date(userStamp.awardedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stamp-modal-title"
        className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 size-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          ✕
        </button>

        {/* Circular Stamp Illustration */}
        <div className="relative size-32 sm:size-36 rounded-full border-2 border-dashed border-amber-300 p-2 flex items-center justify-center bg-amber-50/50 my-2 shadow-inner">
          {stamp.iconUrl ? (
            <Image
              src={stamp.iconUrl}
              alt={stamp.displayName}
              width={110}
              height={110}
              unoptimized={Boolean(stamp.iconUrl?.endsWith(".svg"))}
              className="object-contain"
            />
          ) : (
            <span className="text-3xl">✈️</span>
          )}

          {userStamp.isPinned && (
            <span
              title="Pinned Featured Stamp"
              className="absolute -top-1 -right-1 size-7 rounded-full bg-amber-400 text-white flex items-center justify-center shadow text-xs font-medium"
            >
              ★
            </span>
          )}
        </div>

        {/* Category Pill */}
        <span className="mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 uppercase tracking-wider">
          {stamp.category} Stamp
        </span>

        {/* Stamp Title */}
        <h3
          id="stamp-modal-title"
          className="mt-2 text-xl font-medium text-zinc-900 tracking-tight"
        >
          {stamp.title || stamp.displayName}
        </h3>
        {[stamp.city, stamp.country].filter(Boolean).length > 0 && (
          <p className="text-xs text-zinc-500 mt-0.5">
            {[stamp.city, stamp.country].filter(Boolean).join(", ")}
          </p>
        )}

        {/* Description */}
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed px-2">
          {stamp.description || "Awarded for exploring unique destinations with Homyz."}
        </p>

        {/* Verification & Award Metadata */}
        <div className="w-full mt-5 pt-4 border-t border-zinc-100 flex flex-col gap-1.5 text-xs text-zinc-500">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Awarded</span>
            <span className="font-medium text-zinc-700">{awardDateStr}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Stamp Origin</span>
            <span className="font-semibold text-zinc-700 flex items-center gap-1">
              {userStamp.isSystemAwarded ? "Verified completed stay" : userStamp.isManual ? "Personal declaration" : "Traveler selection"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Profile Status</span>
            <span className="font-medium text-zinc-700">
              {userStamp.isPinned ? "Featured on Profile" : "In Passport"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full mt-6 flex flex-col gap-2">
          {onTogglePin && (
            <button
              type="button"
              disabled={isPinning}
              onClick={() => onTogglePin(userStamp.id)}
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium transition cursor-pointer flex items-center justify-center gap-2 ${
                userStamp.isPinned
                  ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              }`}
            >
              {userStamp.isPinned ? "Unpin from Featured" : "★ Pin as Featured Stamp"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
