"use client";

import React, { useState, useEffect } from "react";
import { useHeaderSearch } from "../header-search-context";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SuggestionLocationItem } from "../header-types";

// Highlight matched substring
function highlightMatch(text: string, query: string) {
  if (!query || !text) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  return (
    <>
      {before}
      <span className="font-medium text-[#1F1F1F] underline decoration-zinc-400 underline-offset-2">{match}</span>
      {after}
    </>
  );
}

const DEFAULT_POPULAR_DESTINATIONS: SuggestionLocationItem[] = [
  {
    name: "Dubai, United Arab Emirates",
    city: "Dubai",
    fullLabel: "Dubai, United Arab Emirates",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.2048,
    longitude: 55.2708,
    subtitle: "Popular beach destination",
    locationType: "city",
    providerPlaceId: "place:dubai",
  },
  {
    name: "Palm Jumeirah, United Arab Emirates",
    city: "Dubai",
    fullLabel: "Palm Jumeirah, Dubai, United Arab Emirates",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.1124,
    longitude: 55.139,
    subtitle: "For a trip abroad",
    locationType: "neighborhood",
    providerPlaceId: "place:palm_jumeirah",
  },
  {
    name: "Abu Dhabi, United Arab Emirates",
    city: "Abu Dhabi",
    fullLabel: "Abu Dhabi, United Arab Emirates",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 24.4539,
    longitude: 54.3773,
    subtitle: "For sights like Sheikh Zayed Grand Mosque",
    locationType: "city",
    providerPlaceId: "place:abu_dhabi",
  },
  {
    name: "Riyadh, Saudi Arabia",
    city: "Riyadh",
    fullLabel: "Riyadh, Saudi Arabia",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 24.7136,
    longitude: 46.6753,
    subtitle: "Modern city life & business",
    locationType: "city",
    providerPlaceId: "place:riyadh",
  },
];

export function DestinationPopover() {
  const {
    destination,
    suggestions,
    isLoadingSuggestions,
    recentSearches,
    isLocating,
    handleSelectSuggestion,
    handleUseCurrentLocation,
  } = useHeaderSearch();
  const { t } = useLanguage();

  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Flatten suggestions for keyboard navigation
  const allSuggestions = React.useMemo(() => {
    if (!suggestions) return [];
    const list: Array<{ label: string; item: SuggestionLocationItem | string; type: string }> = [];
    if (suggestions.primaryCity) {
      list.push({
        label: suggestions.primaryCity.fullLabel || suggestions.primaryCity.name,
        item: suggestions.primaryCity,
        type: "city",
      });
    }
    if (suggestions.places) {
      suggestions.places.forEach((p) =>
        list.push({ label: p.name || p.city, item: p, type: p.locationType || "neighborhood" })
      );
    }
    if (suggestions.districts) {
      suggestions.districts.forEach((d) =>
        list.push({ label: d.name || d.city, item: d, type: "district" })
      );
    }
    if (suggestions.cities && !suggestions.primaryCity && (!suggestions.places || suggestions.places.length === 0)) {
      suggestions.cities.forEach((c) =>
        list.push({ label: c.fullLabel || c.name || c.city, item: c, type: "city" })
      );
    }
    return list;
  }, [suggestions]);

  // Reset keyboard highlight on search change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [destination]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (allSuggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % allSuggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev <= 0 ? allSuggestions.length - 1 : prev - 1));
      } else if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < allSuggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(allSuggestions[selectedIndex].item);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allSuggestions, selectedIndex, handleSelectSuggestion]);

  const hasQuery = destination.trim().length >= 2;

  return (
    <div
      role="listbox"
      aria-label="Destination suggestions"
      className="w-[420px] max-w-[calc(100vw-2rem)] rounded-[32px] bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-zinc-100 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="max-h-[min(520px,65vh)] overflow-y-auto pr-1 space-y-5 visible-scrollbar">
        {hasQuery ? (
          /* Live Autocomplete Suggestions */
          isLoadingSuggestions ? (
            <div className="py-10 text-center flex flex-col items-center justify-center gap-3 text-zinc-500">
              <div className="size-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
              <span className="text-xs font-normal">{t("header_searching_destinations", "Searching destinations...")}</span>
            </div>
          ) : allSuggestions.length > 0 ? (
            <div className="space-y-1">
              <p className="px-3 text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                {t("header_places_matches", "Destinations")}
              </p>
              {allSuggestions.map((s, idx) => {
                const isItemObj = typeof s.item !== "string";
                const obj = isItemObj ? (s.item as SuggestionLocationItem) : null;
                const isSelected = selectedIndex === idx;

                return (
                  <button
                    key={`suggest-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectSuggestion(s.item)}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left transition-colors duration-150 cursor-pointer ${
                      isSelected ? "bg-zinc-100 ring-1 ring-zinc-300" : "hover:bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="size-10 shrink-0 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700">
                        {s.type === "city" ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                            <rect x="4" y="2" width="16" height="20" rx="2" />
                            <path d="M9 22v-4h6v4" />
                            <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1F1F1F] truncate">
                          {highlightMatch(obj?.name || obj?.city || s.label, destination)}
                        </p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {obj?.subtitle || obj?.fullLabel || obj?.country}
                        </p>
                      </div>
                    </div>
                    {obj?.badge && (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-normal text-zinc-600">
                        {obj.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500">
              <p className="text-sm font-medium text-[#1F1F1F]">{t("header_no_destinations_found", "No destinations found")}</p>
              <p className="text-xs text-zinc-400 mt-1">{t("header_try_searching_city", "Try searching for another city, country, or landmark.")}</p>
            </div>
          )
        ) : (
          /* Default Sections: Recent Searches & Suggested Destinations */
          <>
            {/* Recent Searches Section (Matches Screenshot 3) */}
            {recentSearches.length > 0 && (
              <div>
                <p className="px-3 text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                  {t("header_recent_searches", "Recent searches")}
                </p>
                <div className="space-y-1">
                  {recentSearches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(item.displayName)}
                      className="w-full flex items-center gap-3.5 p-3 rounded-2xl text-left transition-colors duration-150 hover:bg-zinc-50 cursor-pointer group"
                    >
                      <div className="size-10 shrink-0 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-200/80 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1F1F1F] truncate">{item.displayName}</p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {item.checkIn && item.checkOut
                            ? `${item.checkIn} – ${item.checkOut}`
                            : item.checkIn
                            ? `From ${item.checkIn}`
                            : "Anytime"}
                          {item.guests ? ` · ${item.guests} guests` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Destinations (Matches Screenshot 3) */}
            <div>
              <p className="px-3 text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                {t("header_suggested_destinations", "Suggested destinations")}
              </p>
              <div className="space-y-1">
                {/* Nearby / Current Location Button */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left transition-colors duration-150 hover:bg-zinc-50 cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="size-10 shrink-0 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                      {isLocating ? (
                        <div className="size-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                          <polygon points="3 11 22 2 13 21 11 13 3 11" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1F1F1F] truncate">
                        {isLocating ? t("header_locating", "Finding location...") : t("header_nearby", "Nearby")}
                      </p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {t("header_nearby_subtitle", "Find what's around you")}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-medium text-zinc-600 uppercase tracking-wide">
                    GPS
                  </span>
                </button>

                {/* Popular Curated Destinations */}
                {DEFAULT_POPULAR_DESTINATIONS.map((pop) => (
                  <button
                    key={pop.name}
                    type="button"
                    onClick={() => handleSelectSuggestion(pop)}
                    className="w-full flex items-center gap-3.5 p-3 rounded-2xl text-left transition-colors duration-150 hover:bg-zinc-50 cursor-pointer group"
                  >
                    <div className="size-10 shrink-0 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-600 group-hover:bg-zinc-200/80 transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1F1F1F] truncate">{pop.name}</p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{pop.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

