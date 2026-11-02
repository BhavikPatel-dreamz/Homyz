"use client";

import React, { useRef, useEffect } from "react";
import { useHeaderSearch, formatShortDate } from "./header-search-context";
import { useLanguage } from "@/lib/i18n/language-context";
import { DestinationPopover } from "./popovers/destination-popover";
import { DatePopover } from "./popovers/date-popover";
import { GuestPopover } from "./popovers/guest-popover";

export function ExpandedSearchBar() {
  const {
    destination,
    setDestination,
    clearDestination,
    checkIn,
    checkOut,
    datePreferences,
    totalGuests,
    guests,
    activeField,
    setActiveField,
    executeSearch,
  } = useHeaderSearch();
  const { t } = useLanguage();

  const containerRef = useRef<HTMLDivElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when Where is selected
  useEffect(() => {
    if (activeField === "where") {
      setTimeout(() => destinationInputRef.current?.focus(), 80);
    }
  }, [activeField]);

  // Formatted display values
  const formattedDates = React.useMemo(() => {
    if (datePreferences.mode === "flexible") {
      return datePreferences.stay;
    }
    if (checkIn && checkOut) {
      return `${formatShortDate(checkIn)} – ${formatShortDate(checkOut)}`;
    }
    if (checkIn) {
      return `From ${formatShortDate(checkIn)}`;
    }
    return t("header_search_add_dates", "Add dates");
  }, [checkIn, checkOut, datePreferences, t]);

  const formattedGuests = React.useMemo(() => {
    if (totalGuests > 0) {
      const parts: string[] = [
        `${totalGuests} ${totalGuests === 1 ? t("header_search_who_single", "guest") : t("header_search_who_plural", "guests")}`,
      ];
      if (guests.infants > 0) parts.push(`${guests.infants} inf`);
      if (guests.pets > 0) parts.push(`${guests.pets} pet`);
      return parts.join(", ");
    }
    return t("header_search_add_guests", "Add guests");
  }, [totalGuests, guests, t]);

  return (
    <div ref={containerRef} className="relative w-full max-w-[850px] mx-auto">
      {/* ── Pill Track ── */}
      <div
        className={`relative flex items-center h-16 w-full rounded-full border border-zinc-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 ${
          activeField ? "bg-[#EBEBEB]" : "bg-white hover:shadow-[0_6px_24px_rgba(0,0,0,0.12)]"
        }`}
      >
        {/* 1. WHERE Field */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveField("where")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveField("where");
            }
          }}
          className={`relative z-10 flex h-full flex-[1.4] flex-col justify-center rounded-full px-7 text-left transition-all duration-200 cursor-pointer ${
            activeField === "where"
              ? "bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-black/5"
              : "hover:bg-zinc-200/60"
          }`}
        >
          <span className="block text-xs font-medium text-[#1F1F1F]">
            {t("home_search_where", "Where")}
          </span>
          <div className="flex items-center gap-1.5 w-full">
            <input
              ref={destinationInputRef}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={t("home_search_where_placeholder", "Search destinations")}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onFocus={() => setActiveField("where")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  executeSearch();
                }
              }}
              className="w-full truncate bg-transparent text-sm font-normal text-[#1F1F1F] placeholder:text-zinc-500 outline-none"
            />
            {destination && (
              <button
                type="button"
                aria-label="Clear destination"
                onClick={(e) => {
                  e.stopPropagation();
                  clearDestination();
                  destinationInputRef.current?.focus();
                }}
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-600 hover:text-[#1F1F1F] text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Separator 1 */}
        <div
          className={`h-7 w-px bg-zinc-300/80 shrink-0 transition-opacity duration-200 ${
            activeField === "where" || activeField === "when" ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        />

        {/* 2. WHEN Field */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveField("when")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveField("when");
            }
          }}
          className={`relative z-10 flex h-full flex-1 flex-col justify-center rounded-full px-6 text-left transition-all duration-200 cursor-pointer ${
            activeField === "when"
              ? "bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-black/5"
              : "hover:bg-zinc-200/60"
          }`}
        >
          <span className="block text-xs font-medium text-[#1F1F1F]">
            {t("home_search_when", "When")}
          </span>
          <span
            className={`block truncate text-sm ${
              checkIn || datePreferences.mode === "flexible"
                ? "font-medium text-[#1F1F1F]"
                : "font-normal text-zinc-500"
            }`}
          >
            {formattedDates}
          </span>
        </div>

        {/* Separator 2 */}
        <div
          className={`h-7 w-px bg-zinc-300/80 shrink-0 transition-opacity duration-200 ${
            activeField === "when" || activeField === "who" ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden="true"
        />

        {/* 3. WHO Field & Search Button */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveField("who")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveField("who");
            }
          }}
          className={`relative z-10 flex h-full flex-[1.4] items-center justify-between rounded-full pl-6 pr-2.5 text-left transition-all duration-200 cursor-pointer ${
            activeField === "who"
              ? "bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-black/5"
              : "hover:bg-zinc-200/60"
          }`}
        >
          <div className="min-w-0 flex-1 pr-2">
            <span className="block text-xs font-medium text-[#1F1F1F]">
              {t("home_search_who", "Who")}
            </span>
            <span
              className={`block truncate text-sm ${
                totalGuests > 0 ? "font-medium text-[#1F1F1F]" : "font-normal text-zinc-500"
              }`}
            >
              {formattedGuests}
            </span>
          </div>

          {/* Prominent Action Button */}
          <button
            type="button"
            aria-label="Search"
            onClick={(e) => {
              e.stopPropagation();
              executeSearch();
            }}
            className={`flex items-center gap-2 rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] hover:text-white text-[#1F1F1F] font-medium transition-all duration-200 cursor-pointer shadow-xs shrink-0 ${
              activeField
                ? "h-12 px-5 text-sm"
                : "size-12 justify-center"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-4 shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            {activeField && <span>{t("home_search_btn", "Search")}</span>}
          </button>
        </div>
      </div>

      {/* ── Anchored Popovers ── */}
      {activeField === "where" && (
        <div className="absolute left-0 top-full mt-3 z-50">
          <DestinationPopover />
        </div>
      )}

      {activeField === "when" && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 z-50">
          <DatePopover />
        </div>
      )}

      {activeField === "who" && (
        <div className="absolute right-0 top-full mt-3 z-50">
          <GuestPopover />
        </div>
      )}
    </div>
  );
}

