"use client";

import React from "react";
import Link from "next/link";
import type { SearchContext } from "@/lib/location/search-context";
import type { PersistedSearchContext } from "@/lib/storage/client-history";

export interface ContinueSearchingBarProps {
  context: SearchContext | PersistedSearchContext;
  thumbnailUrl?: string | null;
  className?: string;
}

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

export function formatSearchDateRange(
  checkIn?: string | null,
  checkOut?: string | null,
): string | null {
  if (!checkIn) return null;

  const dIn = new Date(checkIn);
  if (isNaN(dIn.getTime())) return null;

  if (!checkOut) {
    return `from ${dIn.getDate()} ${MONTH_NAMES_SHORT[dIn.getMonth()]}`;
  }

  const dOut = new Date(checkOut);
  if (isNaN(dOut.getTime()) || dOut <= dIn) {
    return `from ${dIn.getDate()} ${MONTH_NAMES_SHORT[dIn.getMonth()]}`;
  }

  const inMonth = MONTH_NAMES_SHORT[dIn.getMonth()];
  const outMonth = MONTH_NAMES_SHORT[dOut.getMonth()];
  const inYear = dIn.getFullYear();
  const outYear = dOut.getFullYear();

  if (inYear === outYear) {
    if (inMonth === outMonth) {
      // e.g. "17–30 Sept"
      return `${dIn.getDate()}–${dOut.getDate()} ${inMonth}`;
    }
    // e.g. "28 Sept – 5 Oct"
    return `${dIn.getDate()} ${inMonth} – ${dOut.getDate()} ${outMonth}`;
  }

  // Cross year
  return `${dIn.getDate()} ${inMonth} ${inYear} – ${dOut.getDate()} ${outMonth} ${outYear}`;
}

export function getContinueSearchLocationPhrase(context: {
  placeType?: string | null;
  displayName?: string | null;
  city?: string | null;
  query?: string | null;
}): { preposition: string; locationName: string } {
  const name = (context.displayName || context.city || context.query || "").trim();
  if (!name || name === "Stays" || name === "All") {
    return { preposition: "", locationName: "" };
  }

  const landmarkKeywords = [
    "burj",
    "khalifa",
    "tower",
    "eiffel",
    "colosseum",
    "museum",
    "park",
    "beach",
    "mall",
    "airport",
    "station",
    "palace",
    "temple",
    "pyramid",
    "center",
    "centre",
    "square",
    "bridge",
    "statue",
    "monument",
    "lake",
    "fountain",
    "marina",
    "waterfront",
    "harbor",
    "harbour",
    "resort",
    "opera",
  ];

  const lowerName = name.toLowerCase();
  const isLandmark =
    context.placeType === "landmark" ||
    context.placeType === "point_of_interest" ||
    context.placeType === "attraction" ||
    context.placeType === "neighborhood" ||
    landmarkKeywords.some((kw) => lowerName.includes(kw));

  const preposition = isLandmark ? "near" : "in";
  return { preposition, locationName: name };
}

export function buildContinueSearchHref(context: SearchContext | PersistedSearchContext): string {
  const sp = new URLSearchParams();

  const destination = context.displayName || context.query;
  if (destination && destination !== "Stays" && destination !== "All") {
    sp.set("destination", destination);
  }
  if (context.city && context.city !== "Stays") {
    sp.set("city", context.city);
  }
  if (context.placeId) sp.set("placeId", context.placeId);
  if (context.placeType && context.placeType !== "general") {
    sp.set("locationType", context.placeType);
  }
  if (typeof context.latitude === "number" && !isNaN(context.latitude)) {
    sp.set("lat", String(context.latitude));
  }
  if (typeof context.longitude === "number" && !isNaN(context.longitude)) {
    sp.set("lng", String(context.longitude));
  }
  if (typeof context.radiusKm === "number" && !isNaN(context.radiusKm)) {
    sp.set("radius", String(context.radiusKm));
  }

  if (context.checkIn) sp.set("checkIn", context.checkIn);
  if (context.checkOut) sp.set("checkOut", context.checkOut);

  const guests = context.guests ?? 1;
  if (guests > 1) sp.set("guests", String(guests));
  if (context.adults && context.adults > 0) sp.set("adults", String(context.adults));
  if (context.children && context.children > 0) sp.set("children", String(context.children));
  if (context.infants && context.infants > 0) sp.set("infants", String(context.infants));
  if (context.pets && context.pets > 0) sp.set("pets", String(context.pets));

  const qs = sp.toString();
  return qs ? `/listings?${qs}` : "/listings";
}

// Modern cozy interior fallback photo matching Airbnb style
const DEFAULT_THUMBNAIL =
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=200&auto=format&fit=crop&q=80";

export function ContinueSearchingBar({
  context,
  thumbnailUrl,
  className = "",
}: ContinueSearchingBarProps) {
  const { preposition, locationName } = getContinueSearchLocationPhrase(context);
  const dateRange = formatSearchDateRange(context.checkIn, context.checkOut);
  const href = buildContinueSearchHref(context);
  const imageSrc = thumbnailUrl || DEFAULT_THUMBNAIL;

  // Don't render if there is no location AND no dates
  if (!locationName && !dateRange) {
    return null;
  }

  return (
    <div className={`continue-searching-wrapper flex items-center justify-center w-full ${className}`}>
      <Link
        href={href}
        className="group inline-flex items-center justify-center gap-3 sm:gap-3.5 py-1.5 px-3 rounded-2xl hover:bg-zinc-50 transition-all duration-200 cursor-pointer"
        aria-label={`Continue searching for homes ${preposition ? `${preposition} ` : ""}${locationName}${dateRange ? ` ${dateRange}` : ""}`}
      >
        {/* Layered / Stacked Thumbnail */}
        <div className="relative flex-shrink-0 w-12 h-12 sm:w-[50px] sm:h-[50px]">
          {/* Back card 2 (tilted right) */}
          <div
            className="absolute inset-0 rounded-[14px] sm:rounded-2xl bg-zinc-300/80 transform rotate-6 scale-90 border border-black/5 shadow-xs transition-transform duration-200 group-hover:rotate-8"
            aria-hidden="true"
          />
          {/* Back card 1 (tilted left) */}
          <div
            className="absolute inset-0 rounded-[14px] sm:rounded-2xl bg-zinc-200/90 transform -rotate-3 scale-95 border border-black/5 shadow-xs transition-transform duration-200 group-hover:-rotate-5"
            aria-hidden="true"
          />
          {/* Front card with photo */}
          <div className="relative w-full h-full rounded-[14px] sm:rounded-2xl overflow-hidden border border-black/10 shadow-sm bg-zinc-100">
            <img
              src={imageSrc}
              alt={locationName || "Homes"}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        </div>

        {/* Text and Arrow */}
        <div className="flex items-center flex-wrap gap-x-1.5 text-[14px] sm:text-[15px] leading-tight text-[#1f1f1f]">
          <span className="font-semibold text-zinc-900 group-hover:text-black">
            Continue searching for homes
            {locationName ? ` ${preposition} ${locationName}` : ""}
          </span>
          {dateRange && (
            <span className="font-normal text-zinc-500 whitespace-nowrap">
              {dateRange}
            </span>
          )}
          <span
            className="inline-block text-zinc-400 group-hover:text-zinc-900 transition-transform duration-200 group-hover:translate-x-1 ml-0.5 font-medium"
            aria-hidden="true"
          >
            →
          </span>
        </div>
      </Link>
    </div>
  );
}

