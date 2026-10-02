"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/language-context";

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
  const { t } = useLanguage();

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

  // Dynamic Headline formatting
  let countLabel = "";
  if (total >= 1000) {
    countLabel = "1,000+";
  } else {
    countLabel = total.toLocaleString();
  }

  const headline = locationContextName
    ? total === 1
      ? t("listings_mapped_single_in", { count: countLabel, location: locationContextName }, `${countLabel} home mapped in ${locationContextName} just for you`)
      : t("listings_mapped_in", { count: countLabel, location: locationContextName }, `${countLabel} homes mapped in ${locationContextName} just for you`)
    : total === 1
      ? t("listings_mapped_single", { count: countLabel }, `${countLabel} home mapped just for you`)
      : t("listings_mapped", { count: countLabel }, `${countLabel} homes mapped just for you`);

  // Subtitle with date range and guest counts
  const subtitleParts: string[] = [];
  if (checkIn && checkOut) {
    subtitleParts.push(t("listings_date_to_date", { checkIn: formatShortDate(checkIn), checkOut: formatShortDate(checkOut) }, `${formatShortDate(checkIn)} to ${formatShortDate(checkOut)}`));
  } else if (checkIn) {
    subtitleParts.push(t("listings_from_date", { date: formatShortDate(checkIn) }, `From ${formatShortDate(checkIn)}`));
  }
  if (guests && guests > 0) {
    subtitleParts.push(guests === 1 ? t("home_guest_one", { count: guests }, "1 guest") : t("home_guest_many", { count: guests }, `${guests} guests`));
  }
  if (pets && pets > 0) {
    subtitleParts.push(pets === 1 ? t("home_pet_one", { count: pets }, "1 pet") : t("home_pet_many", { count: pets }, `${pets} pets`));
  }

  return (
    <div className="pb-4 border-b border-[#1f1f1f] mb-5">
      <h1>
        {headline}
      </h1>
      {subtitleParts.length > 0 && (
        <p className="text-xs sm:text-sm text-[#727272] font-normal mt-1.5 flex items-center gap-1.5 flex-wrap">
          {subtitleParts.join(" · ")}
        </p>
      )}
    </div>
  );
}

