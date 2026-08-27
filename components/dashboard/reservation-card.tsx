"use client";

import React, { useState } from "react";
import Link from "next/link";

export interface ReservationCardData {
  id: string;
  propertyName?: string | null;
  location?: string | null;
  propertyImage?: string | null;
  startDate: Date | string;
  endDate: Date | string;
  guestName?: string | null;
  guestAvatar?: string | null;
  guestCount?: number;
  status?: string;
  checkInTime?: string;
  checkOutTime?: string;
  actionType?: "check_in" | "check_out" | "reserved";
  isToday?: boolean;
}

function PropertyPlaceholder({ title }: { title?: string | null }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-100/60 to-amber-200/40 dark:from-amber-950/40 dark:to-zinc-900 p-4 text-center">
      <svg className="w-8 h-8 text-amber-700/60 dark:text-amber-400/50 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
      <span className="text-[11px] font-bold text-amber-900/70 dark:text-amber-200/60 truncate max-w-[120px]">
        {title || "Property"}
      </span>
    </div>
  );
}

export function ReservationCard({
  data,
  onSelect,
}: {
  data: ReservationCardData;
  onSelect?: (data: ReservationCardData) => void;
}) {
  const [imgError, setImgError] = useState(false);

  const formatDates = (start: Date | string, end: Date | string) => {
    try {
      const s = typeof start === "string" ? new Date(start) : start;
      const e = typeof end === "string" ? new Date(end) : end;
      const startMonth = s.toLocaleString("default", { month: "short" });
      const startDay = s.getDate();
      const endDay = e.getDate();
      const year = s.getFullYear().toString().slice(-2);
      return `${startDay}-${endDay} ${startMonth}, '${year}`;
    } catch {
      return "Dates TBD";
    }
  };

  const isHighlighted = data.isToday;

  const dateText = formatDates(data.startDate, data.endDate);
  const guestInitial = data.guestName ? data.guestName.charAt(0).toUpperCase() : "G";

  let statusSubtitle = `${data.guestCount || 2} guests`;
  if (data.actionType === "check_out") {
    statusSubtitle = `${data.guestName || "Guest"} checks out`;
  } else if (data.actionType === "check_in") {
    statusSubtitle = `${data.guestName || "Guest"} checks in`;
  }

  const timeHeader = data.checkInTime || data.checkOutTime || "12:00 PM";

  return (
    <div
      onClick={() => onSelect?.(data)}
      className={`group relative flex flex-col items-center justify-between rounded-3xl p-5 text-center transition-all duration-200 cursor-pointer ${
        isHighlighted
          ? "bg-[#FCEECB] border-2 border-[#F7D687] shadow-md dark:bg-[#2c2415] dark:border-[#57441d]"
          : "bg-[var(--card)] border border-[var(--border)] hover:border-[var(--muted-foreground)] hover:shadow-md"
      }`}
    >
      {/* Top Banner Details */}
      <div className="flex flex-col items-center w-full mb-3">
        <span className="text-sm font-bold tracking-tight text-[var(--foreground)]">
          {data.isToday ? timeHeader : dateText}
        </span>
        <span className="text-xs text-[var(--muted-foreground)] mt-0.5 font-medium">
          {statusSubtitle}
        </span>
      </div>

      {/* Property Image & Guest Avatar Overlay */}
      <div className="relative w-full max-w-[170px] aspect-4/3 rounded-2xl overflow-hidden shadow-2xs my-2 border border-black/5 dark:border-white/10 bg-[var(--muted)]">
        {/* Guest Avatar Circle Overlay matching screenshot */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-900 font-extrabold text-[11px] shadow-xs dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
          {data.guestAvatar ? (
            <img src={data.guestAvatar} alt="Guest" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span>{guestInitial}</span>
          )}
        </div>

        {data.propertyImage && !imgError ? (
          <img
            src={data.propertyImage}
            alt={data.propertyName || "Property"}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <PropertyPlaceholder title={data.propertyName} />
        )}
      </div>

      {/* Property Name & Location */}
      <div className="flex flex-col items-center w-full mt-2">
        <h3 className="text-xs font-bold text-[var(--foreground)] truncate max-w-[180px]">
          {data.propertyName || "Property Name"}
        </h3>
        <p className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[180px] mt-0.5">
          {data.location || "Location, City"}
        </p>
      </div>

      {/* Circular Action Arrow Button matching screenshots */}
      <div className="mt-4 flex justify-center">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FBDE9B] text-[#291E05] shadow-2xs transition-transform group-hover:scale-110 dark:bg-[#f59e0b] dark:text-zinc-950">
          <svg className="w-3.5 h-3.5 fill-current stroke-current" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
