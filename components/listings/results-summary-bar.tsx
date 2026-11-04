"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatFlexibleStaySummary } from "@/lib/search/flexible-stays";

export interface ResultsSummaryBarProps {
  total: number;
  locationContextName?: string;
  checkIn?: string;
  checkOut?: string;
  dateMode?: string;
  flexibleDuration?: string;
  flexibleMonths?: string[];
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
  dateMode,
  flexibleDuration,
  flexibleMonths = [],
  guests,
  pets,
  isPending = false,
}: ResultsSummaryBarProps) {
  const { t } = useLanguage();

  if (isPending) {
    return (
      <div className="pb-3 sm:pb-3.5 border-b border-zinc-200 mb-3 sm:mb-4 animate-pulse">
        <div className="h-6 w-64 sm:w-80 bg-zinc-200 rounded-md mb-1.5" />
        <div className="h-3.5 w-40 sm:w-56 bg-zinc-200 rounded-md" />
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

  const flexibleSummary = dateMode === "flexible" && flexibleDuration
    ? formatFlexibleStaySummary(flexibleDuration, flexibleMonths)
    : null;
  const headline = flexibleSummary
    ? locationContextName
      ? `${countLabel} ${total === 1 ? "home" : "homes"} available for ${flexibleSummary.toLowerCase()} in ${locationContextName}`
      : `${countLabel} ${total === 1 ? "home" : "homes"} available for ${flexibleSummary.toLowerCase()}`
    : locationContextName
    ? total === 1
      ? t("listings_mapped_single_in", { count: countLabel, location: locationContextName }, `${countLabel} home mapped in ${locationContextName} just for you`)
      : t("listings_mapped_in", { count: countLabel, location: locationContextName }, `${countLabel} homes mapped in ${locationContextName} just for you`)
    : total === 1
      ? t("listings_mapped_single", { count: countLabel }, `${countLabel} home mapped just for you`)
      : t("listings_mapped", { count: countLabel }, `${countLabel} homes mapped just for you`);

  // Subtitle with date range and guest counts
  const subtitleParts: string[] = [];
  if (flexibleSummary) {
    subtitleParts.push(`Flexible dates · ${flexibleSummary}`);
  } else if (checkIn && checkOut) {
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
    <div className="mb-2 pb-1 sm:mb-4 sm:border-b sm:border-zinc-200 sm:pb-3.5">
      <h1 className="text-[16px] font-medium leading-5 tracking-tight text-[#1F1F1F] break-words sm:text-[20px] sm:font-medium sm:leading-tight lg:text-[24px]">
        {headline}
      </h1>
      {subtitleParts.length > 0 && (
        <p className="text-[12px] sm:text-[13px] text-[#727272] font-normal mt-1 flex items-center flex-wrap">
          {subtitleParts.map((part, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <span className="mx-[5px]" aria-hidden="true">
                  ,
                </span>
              )}
              <span>{part}</span>
            </React.Fragment>
          ))}
        </p>
      )}
    </div>
  );
}
