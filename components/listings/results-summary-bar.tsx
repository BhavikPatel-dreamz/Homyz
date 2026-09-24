"use client";

import React from "react";

export interface ResultsSummaryBarProps {
  total: number;
  locationContextName?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  pets?: number;
  isPending?: boolean;
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }
  return dateStr;
}

export function ResultsSummaryBar({
  total,
  locationContextName,
  checkIn,
  checkOut,
  guests,
  pets,
  isPending = false,
}: ResultsSummaryBarProps) {
  if (isPending) {
    return (
      <div className="pb-4 border-b border-zinc-200/80 mb-5 animate-pulse">
        <div className="h-7 w-64 sm:w-80 bg-zinc-200 rounded-md mb-2" />
        <div className="h-4 w-40 sm:w-56 bg-zinc-200 rounded-md" />
      </div>
    );
  }

  // Zero results handled by dedicated empty state
  if (total <= 0) {
    return null;
  }

  // Dynamic Headline formatting per Phase 2 requirements
  let countLabel = "";
  if (total >= 1000) {
    countLabel = "1,000+";
  } else {
    countLabel = total.toLocaleString();
  }

  const noun = total === 1 ? "home" : "homes";
  const headline = locationContextName
    ? `${countLabel} ${noun} mapped in ${locationContextName} just for you`
    : `${countLabel} ${noun} mapped just for you`;

  // Subtitle with date range and guest counts
  const subtitleParts: string[] = [];
  if (checkIn && checkOut) {
    subtitleParts.push(`${formatShortDate(checkIn)} to ${formatShortDate(checkOut)}`);
  } else if (checkIn) {
    subtitleParts.push(`From ${formatShortDate(checkIn)}`);
  }
  if (guests && guests > 0) {
    subtitleParts.push(`${guests} ${guests === 1 ? "guest" : "guests"}`);
  }
  if (pets && pets > 0) {
    subtitleParts.push(`${pets} ${pets === 1 ? "pet" : "pets"}`);
  }

  return (
    <div className="pb-4 border-b border-[#1f1f1f] mb-5">
      <h1>
        {headline}
      </h1>
      {subtitleParts.length > 0 && (
        <p className="text-xs sm:text-sm text-zinc-500 font-normal mt-1.5 flex items-center gap-1.5 flex-wrap">
          {subtitleParts.join(" · ")}
        </p>
      )}
    </div>
  );
}

