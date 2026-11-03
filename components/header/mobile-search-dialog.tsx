"use client";

import React, { useState, useEffect, useRef } from "react";
import { useHeaderSearch, formatShortDate } from "./header-search-context";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SuggestionLocationItem, RecentSearchItem } from "./header-types";
import { ModalOverlay } from "@/components/ui/modal-overlay";

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const DEFAULT_POPULAR_DESTINATIONS: SuggestionLocationItem[] = [
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
  {
    name: "Dubai, United Arab Emirates",
    city: "Dubai",
    fullLabel: "Dubai, United Arab Emirates",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.2048,
    longitude: 55.2708,
    subtitle: "Beach & shopping destination",
    locationType: "city",
    providerPlaceId: "place:dubai",
  },
  {
    name: "Mumbai, India",
    city: "Mumbai",
    fullLabel: "Mumbai, Maharashtra, India",
    country: "India",
    countryCode: "IN",
    latitude: 19.076,
    longitude: 72.8777,
    subtitle: "Coastal city & entertainment hub",
    locationType: "city",
    providerPlaceId: "place:mumbai",
  },
  {
    name: "London, United Kingdom",
    city: "London",
    fullLabel: "London, United Kingdom",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.5074,
    longitude: -0.1278,
    subtitle: "Historic capital & iconic landmarks",
    locationType: "city",
    providerPlaceId: "place:london",
  },
];

export function MobileSearchDialog() {
  const {
    isMobileSearchOpen,
    setIsMobileSearchOpen,
    destination,
    setDestination,
    setSelectedLocation,
    clearDestination,
    checkIn,
    setCheckIn,
    checkOut,
    setCheckOut,
    datePreferences,
    setDatePreferences,
    guests,
    setGuests,
    updateGuestCount,
    suggestions,
    isLoadingSuggestions,
    recentSearches,
    isLocating,
    handleSelectSuggestion,
    handleUseCurrentLocation,
    executeSearch,
    compactDates,
    compactGuests,
  } = useHeaderSearch();
  const { t, language } = useLanguage();

  const [activeStep, setActiveStep] = useState<"where" | "when" | "who">("where");
  const [monthOffset, setMonthOffset] = useState<number>(0);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [showSuggested, setShowSuggested] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset active step when dialog opens
  useEffect(() => {
    if (!isMobileSearchOpen) return;
    const resetTimer = window.setTimeout(() => {
      setActiveStep("where");
      setIsTyping(false);
      setShowSuggested(false);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [isMobileSearchOpen]);

  useEffect(() => {
    if (!isMobileSearchOpen || activeStep !== "where") return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(focusTimer);
  }, [activeStep, isMobileSearchOpen]);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isMobileSearchOpen) {
        setIsMobileSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileSearchOpen, setIsMobileSearchOpen]);

  if (!isMobileSearchOpen) return null;

  const today = new Date();
  const todayKey = dateKey(today);
  const locale = language === "ar" ? "ar-EG" : language === "hi" ? "hi-IN" : "en-US";

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 0, 4 + i).toLocaleDateString(locale, { weekday: "narrow" })
  );

  const displayedMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = displayedMonth.getDay();
  const monthTitle = displayedMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });

  const handleDateClick = (clickedKey: string) => {
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(clickedKey);
      setCheckOut("");
      return;
    }

    if (checkIn && !checkOut) {
      if (clickedKey < checkIn) {
        setCheckIn(clickedKey);
      } else {
        setCheckOut(clickedKey);
      }
    }
  };

  const handleSelectRecentSearch = (item: RecentSearchItem) => {
    setDestination(item.displayName || item.city || "");
    if (item.latitude && item.longitude) {
      setSelectedLocation({
        name: item.displayName || item.city || "",
        fullAddress: item.displayName || item.city || "",
        city: item.city || item.displayName || "",
        country: "",
        latitude: item.latitude,
        longitude: item.longitude,
        locationType: item.locationType || "city",
        providerPlaceId: item.placeId || "",
      });
    }
    if (item.checkIn) setCheckIn(item.checkIn);
    if (item.checkOut) setCheckOut(item.checkOut);
    if (item.guests && item.guests > 0) {
      setGuests((prev) => ({ ...prev, adults: item.guests || 1 }));
    }
    setIsTyping(false);
    setActiveStep("when");
  };

  const handleSelectPopularDest = (item: SuggestionLocationItem) => {
    handleSelectSuggestion(item);
    setIsTyping(false);
    setActiveStep("when");
  };

  const handleCurrentLocationClick = async () => {
    await handleUseCurrentLocation();
    setIsTyping(false);
    setActiveStep("when");
  };

  const handleClearAll = () => {
    clearDestination();
    setCheckIn("");
    setCheckOut("");
    setGuests({ adults: 0, children: 0, infants: 0, pets: 0 });
    setIsTyping(false);
    setActiveStep("where");
  };

  const minAdults = guests.children > 0 || guests.infants > 0 ? 1 : 0;

  const toleranceOptions = [
    { label: "Exact dates", value: 0 },
    { label: "± 1 day", value: 1 },
    { label: "± 2 days", value: 2 },
    { label: "± 3 days", value: 3 },
  ];

  // Dynamic formatted labels from draft state
  const displayedDateSummary = checkIn && checkOut
    ? `${formatShortDate(checkIn)} - ${formatShortDate(checkOut)}`
    : checkIn
    ? `From ${formatShortDate(checkIn)}`
    : compactDates || "Add dates";

  const totalGuests = guests.adults + guests.children;
  const displayedGuestSummary = totalGuests > 0
    ? `${totalGuests} ${totalGuests === 1 ? "guest" : "guests"}${
        guests.infants > 0 ? `, ${guests.infants} inf` : ""
      }${guests.pets > 0 ? `, ${guests.pets} pet` : ""}`
    : compactGuests || "Add guests";

  return (
    <ModalOverlay
      className="fixed inset-0 z-[100] flex flex-col items-center justify-end overflow-hidden bg-black/45 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:justify-center sm:p-4 lg:hidden"
      onClick={() => setIsMobileSearchOpen(false)}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-[#F7F7F7] shadow-2xl animate-in zoom-in-95 duration-200 sm:h-[min(86dvh,720px)] sm:max-w-[700px] sm:rounded-[32px]"
        role="dialog"
        aria-modal="true"
        aria-label="Search places"
      >
        {/* ── Top Bar: Circular Close Button Only (Category tabs removed per user requirement) ── */}
        <div className="flex shrink-0 items-center justify-end px-4 pb-2 pt-[max(0.875rem,env(safe-area-inset-top))] sm:pt-3.5">
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setIsMobileSearchOpen(false)}
            className="size-8.5 rounded-full bg-white border border-zinc-200/90 shadow-2xs flex items-center justify-center text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Accordion Content (Fits on screen without overflowing) ── */}
        <div className="visible-scrollbar flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-2 sm:px-4">
          {/* ───────────────────────────────────────────────────────────── */}
          {/* CARD 1: WHERE? */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeStep !== "where" ? (
            /* Collapsed Card */
            <button
              type="button"
              onClick={() => {
                setActiveStep("where");
                setIsTyping(false);
              }}
              className="w-full bg-white rounded-2xl p-4 shadow-2xs border border-zinc-200/60 flex items-center justify-between text-left cursor-pointer hover:border-zinc-300 transition-all duration-150"
            >
              <span className="text-sm font-medium text-zinc-500">
                {t("home_search_where", "Where")}
              </span>
              <span className="text-sm font-medium text-[#1F1F1F] truncate max-w-[200px]">
                {destination || t("home_search_where_placeholder", "Search destinations")}
              </span>
            </button>
          ) : (
            /* Expanded Card */
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-zinc-200/80 animate-in fade-in duration-200 space-y-3">
              <h3 className="text-xl sm:text-2xl font-medium text-[#1F1F1F]">
                {t("home_search_where", "Where")}?
              </h3>

              {/* Search input with search icon & clear button */}
              <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-300 bg-white px-3.5 py-2.5 shadow-2xs focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 text-zinc-600 shrink-0">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    setIsTyping(true);
                  }}
                  onFocus={() => setIsTyping(true)}
                  placeholder={t("home_search_where_placeholder", "Search destinations")}
                  className="w-full bg-transparent text-sm font-normal text-[#1F1F1F] placeholder:text-zinc-400 outline-none"
                />
                {destination && (
                  <button
                    type="button"
                    onClick={() => {
                      clearDestination();
                      setIsTyping(false);
                      inputRef.current?.focus();
                    }}
                    aria-label="Clear destination"
                    className="size-5 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-medium leading-none">✕</span>
                  </button>
                )}
              </div>

              {/* Autocomplete Suggestions (only when user is actively typing) */}
              {isTyping && destination.trim().length > 0 && isLoadingSuggestions && (
                <div className="flex items-center gap-2 px-2 py-3 text-xs text-zinc-500">
                  <span className="size-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
                  {t("home_searching_destinations", "Searching destinations...")}
                </div>
              )}

              {isTyping && destination.trim().length > 0 && suggestions && (
                <div className="space-y-1 pt-1 max-h-48 overflow-y-auto divide-y divide-zinc-50 border border-zinc-100 rounded-xl p-1 bg-zinc-50/50">
                  {suggestions.primaryCity && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectSuggestion(suggestions.primaryCity!);
                        setIsTyping(false);
                        setActiveStep("when");
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white transition-colors text-left cursor-pointer"
                    >
                      <div className="size-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#1F1F1F] truncate">
                          {suggestions.primaryCity.fullLabel || suggestions.primaryCity.name}
                        </p>
                        <p className="text-[10px] text-zinc-500">City</p>
                      </div>
                    </button>
                  )}

                  {suggestions.places?.slice(0, 4).map((place) => (
                    <button
                      key={place.providerPlaceId || place.name}
                      type="button"
                      onClick={() => {
                        handleSelectSuggestion(place);
                        setIsTyping(false);
                        setActiveStep("when");
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white transition-colors text-left cursor-pointer"
                    >
                      <div className="size-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#1F1F1F] truncate">{place.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{place.fullLabel || place.city}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Recent searches (Clean 2-item list matching 2nd reference image) */}
              {(!isTyping || destination.trim().length === 0) && (
                <div className="pt-0.5">
                  <p className="text-xs font-medium text-zinc-500 mb-2">
                    {t("header_recent_searches", "Recent searches")}
                  </p>

                  {recentSearches.length > 0 ? (
                    <div className="space-y-1">
                      {recentSearches.slice(0, 3).map((recent) => (
                        <button
                          key={recent.id}
                          type="button"
                          onClick={() => handleSelectRecentSearch(recent)}
                          className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-zinc-50"
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#1F1F1F]">{recent.displayName || recent.city}</p>
                            <p className="truncate text-xs text-zinc-500">
                              {recent.checkIn && recent.checkOut
                                ? `${formatShortDate(recent.checkIn)} - ${formatShortDate(recent.checkOut)}${recent.guests ? ` · ${recent.guests} ${recent.guests === 1 ? "guest" : "guests"}` : ""}`
                                : recent.city || ""}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-2 py-1 text-xs text-zinc-500">{t("header_no_recent_searches", "Your recent searches will appear here.")}</p>
                  )}

                  {/* Collapsible Suggested destinations with Chevron (Keeps card compact) */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSuggested((prev) => !prev)}
                      className="w-full flex items-center justify-between text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer py-1"
                    >
                      <span>{t("header_suggested_destinations", "Suggested destinations")}</span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`size-3.5 transition-transform duration-200 ${showSuggested ? "rotate-180" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {showSuggested && (
                      <div className="pt-2 space-y-2 animate-in fade-in duration-150">
                        {/* Current Location Option */}
                        <button
                          type="button"
                          onClick={handleCurrentLocationClick}
                          disabled={isLocating}
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-amber-50/60 hover:bg-amber-50 text-left transition-colors cursor-pointer"
                        >
                          <div className="size-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                              <circle cx="12" cy="12" r="3" />
                              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium text-[#1F1F1F]">
                            {isLocating ? "Detecting location..." : t("header_use_current_location", "Use current location")}
                          </span>
                        </button>

                        <div className="grid grid-cols-2 gap-1.5">
                          {DEFAULT_POPULAR_DESTINATIONS.map((dest) => (
                            <button
                              key={dest.name}
                              type="button"
                              onClick={() => handleSelectPopularDest(dest)}
                              className="p-2 rounded-lg border border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-100 text-left transition-colors cursor-pointer"
                            >
                              <p className="text-xs font-medium text-[#1F1F1F] truncate">{dest.city}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{dest.country}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* CARD 2: WHEN? */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeStep !== "when" ? (
            /* Collapsed Card */
            <button
              type="button"
              onClick={() => {
                setActiveStep("when");
                setIsTyping(false);
              }}
              className="w-full bg-white rounded-2xl p-4 shadow-2xs border border-zinc-200/60 flex items-center justify-between text-left cursor-pointer hover:border-zinc-300 transition-all duration-150"
            >
              <span className="text-sm font-medium text-zinc-500">
                {t("home_search_when", "When")}
              </span>
              <span className="text-sm font-medium text-[#1F1F1F] truncate max-w-[200px]">
                {displayedDateSummary}
              </span>
            </button>
          ) : (
            /* Expanded Card (Calendar & Tolerance Chips) */
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-zinc-200/80 animate-in fade-in duration-200 space-y-3">
              <h3 className="text-xl sm:text-2xl font-medium text-[#1F1F1F]">
                {t("home_search_when", "When")}?
              </h3>

              {/* Segmented Switcher: [Dates] vs [Flexible] */}
              <div className="mx-auto flex w-fit items-center rounded-full bg-zinc-100 p-0.5 mb-2">
                <button
                  type="button"
                  onClick={() => setDatePreferences((prev) => ({ ...prev, mode: "dates" }))}
                  className={`rounded-full px-5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                    datePreferences.mode === "dates"
                      ? "bg-white text-[#1F1F1F] shadow-xs"
                      : "text-zinc-600 hover:text-[#1F1F1F]"
                  }`}
                >
                  {t("home_when_tab_dates", "Dates")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDatePreferences((prev) => ({
                      ...prev,
                      mode: "flexible",
                      months: prev.months.length > 0 ? prev.months : [todayKey.slice(0, 7)],
                    }))
                  }
                  className={`rounded-full px-5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                    datePreferences.mode === "flexible"
                      ? "bg-white text-[#1F1F1F] shadow-xs"
                      : "text-zinc-600 hover:text-[#1F1F1F]"
                  }`}
                >
                  {t("home_when_tab_flexible", "Flexible")}
                </button>
              </div>

              {datePreferences.mode === "dates" ? (
                /* Month Calendar View */
                <div className="space-y-2">
                  {/* Month header & navigation */}
                  <div className="flex items-center justify-between h-8 px-1">
                    <button
                      type="button"
                      aria-label="Previous month"
                      disabled={monthOffset <= 0}
                      onClick={() => setMonthOffset((prev) => Math.max(0, prev - 1))}
                      className="size-7 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>

                    <h4 className="text-xs sm:text-sm font-medium text-[#1F1F1F]">{monthTitle}</h4>

                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={() => setMonthOffset((prev) => prev + 1)}
                      className="size-7 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-700 transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>

                  {/* Weekday Initials Row */}
                  <div className="grid grid-cols-7 text-center text-[11px] font-medium text-zinc-400">
                    {weekdays.map((day, i) => (
                      <span key={`wd-${i}`} className="py-0.5">
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-8 sm:h-9" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNumber = i + 1;
                      const dateObj = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), dayNumber);
                      const key = dateKey(dateObj);
                      const isPast = key < todayKey;
                      const isToday = key === todayKey;
                      const isCheckIn = key === checkIn;
                      const isCheckOut = key === checkOut;

                      const isInRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);
                      const isHoverRange = Boolean(
                        checkIn && !checkOut && hoveredDate && hoveredDate > checkIn && key > checkIn && key <= hoveredDate
                      );

                      return (
                        <div
                          key={key}
                          className={`relative h-8 sm:h-9 flex items-center justify-center ${
                            isInRange || isHoverRange ? "bg-zinc-100" : ""
                          } ${isCheckIn && (checkOut || hoveredDate) ? "rounded-l-full bg-zinc-100" : ""} ${
                            isCheckOut ? "rounded-r-full bg-zinc-100" : ""
                          }`}
                        >
                          <button
                            type="button"
                            disabled={isPast}
                            aria-label={key}
                            onClick={() => handleDateClick(key)}
                            onMouseEnter={() => setHoveredDate(key)}
                            onMouseLeave={() => setHoveredDate(null)}
                            className={`relative size-7.5 sm:size-8 rounded-full flex items-center justify-center text-xs transition-all duration-150 cursor-pointer ${
                              isPast
                                ? "text-zinc-300 cursor-not-allowed"
                                : isCheckIn || isCheckOut
                                ? "bg-[#222222] text-white font-medium shadow-2xs"
                                : isInRange || isHoverRange
                                ? "text-[#1F1F1F] font-medium"
                                : isToday
                                ? "border border-[#1F1F1F] font-medium text-[#1F1F1F]"
                                : "text-[#1F1F1F] hover:bg-zinc-100 font-normal"
                            }`}
                          >
                            {dayNumber}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tolerance / Flexibility quick chips */}
                  <div className="pt-2.5 border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {toleranceOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDatePreferences((prev) => ({ ...prev, tolerance: opt.value }))}
                        className={`rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors duration-150 cursor-pointer shrink-0 ${
                          datePreferences.tolerance === opt.value
                            ? "border border-zinc-900 bg-white text-zinc-900 font-medium"
                            : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 font-normal"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Flexible mode duration */
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-medium text-zinc-500">Stay length</p>
                  <div className="flex items-center gap-2">
                    {(["Weekend", "Week", "Month"] as const).map((stay) => (
                      <button
                        key={stay}
                        type="button"
                        onClick={() => setDatePreferences((prev) => ({ ...prev, stay }))}
                        className={`flex-1 py-2 rounded-xl border text-xs text-center transition-all cursor-pointer ${
                          datePreferences.stay === stay
                            ? "border-zinc-900 bg-zinc-900 text-white font-medium"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-normal"
                        }`}
                      >
                        {stay}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* CARD 3: WHO? */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeStep !== "who" ? (
            /* Collapsed Card */
            <button
              type="button"
              onClick={() => {
                setActiveStep("who");
                setIsTyping(false);
              }}
              className="w-full bg-white rounded-2xl p-4 shadow-2xs border border-zinc-200/60 flex items-center justify-between text-left cursor-pointer hover:border-zinc-300 transition-all duration-150"
            >
              <span className="text-sm font-medium text-zinc-500">
                {t("home_search_who", "Who")}
              </span>
              <span className="text-sm font-medium text-[#1F1F1F] truncate max-w-[200px]">
                {displayedGuestSummary}
              </span>
            </button>
          ) : (
            /* Expanded Card (Guest Steppers) */
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-zinc-200/80 animate-in fade-in duration-200 space-y-2">
              <h3 className="text-xl sm:text-2xl font-medium text-[#1F1F1F] mb-1">
                {t("home_search_who", "Who")}?
              </h3>

              <div className="divide-y divide-zinc-100">
                {/* Adults */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[#1F1F1F]">{t("home_adults", "Adults")}</p>
                    <p className="text-xs text-zinc-500">{t("home_adults_desc", "Ages 13 or above")}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={guests.adults <= minAdults}
                      onClick={() => updateGuestCount("adults", -1)}
                      className="size-7.5 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <span className="w-5 text-center text-sm font-medium text-[#1F1F1F]">
                      {guests.adults}
                    </span>
                    <button
                      type="button"
                      disabled={guests.adults >= 16}
                      onClick={() => updateGuestCount("adults", 1)}
                      className="size-7.5 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Children */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[#1F1F1F]">{t("home_children", "Children")}</p>
                    <p className="text-xs text-zinc-500">{t("home_children_desc", "Ages 2–12")}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={guests.children <= 0}
                      onClick={() => updateGuestCount("children", -1)}
                      className="size-7.5 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <span className="w-5 text-center text-sm font-medium text-[#1F1F1F]">
                      {guests.children}
                    </span>
                    <button
                      type="button"
                      disabled={guests.children >= 15}
                      onClick={() => updateGuestCount("children", 1)}
                      className="size-7.5 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Infants */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[#1F1F1F]">{t("home_infants", "Infants")}</p>
                    <p className="text-xs text-zinc-500">{t("home_infants_desc", "Under 2")}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={guests.infants <= 0}
                      onClick={() => updateGuestCount("infants", -1)}
                      className="size-7.5 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <span className="w-5 text-center text-sm font-medium text-[#1F1F1F]">
                      {guests.infants}
                    </span>
                    <button
                      type="button"
                      disabled={guests.infants >= 5}
                      onClick={() => updateGuestCount("infants", 1)}
                      className="size-7.5 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Pets */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[#1F1F1F]">{t("home_pets", "Pets")}</p>
                    <p className="text-xs text-zinc-500">{t("home_pets_desc", "Bringing a service animal?")}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={guests.pets <= 0}
                      onClick={() => updateGuestCount("pets", -1)}
                      className="size-7.5 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <span className="w-5 text-center text-sm font-medium text-[#1F1F1F]">
                      {guests.pets}
                    </span>
                    <button
                      type="button"
                      disabled={guests.pets >= 5}
                      onClick={() => updateGuestCount("pets", 1)}
                      className="size-7.5 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Persistent Bottom Action Bar (Clear all / Reset + Search / Next) ── */}
        <div className="border-t border-zinc-200/80 bg-white px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          {/* Left Action: Reset or Clear all */}
          {activeStep === "when" && (checkIn || checkOut) ? (
            <button
              type="button"
              onClick={() => {
                setCheckIn("");
                setCheckOut("");
              }}
              className="text-sm font-medium text-[#1F1F1F] underline underline-offset-4 hover:opacity-75 transition-opacity cursor-pointer"
            >
              Reset
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-sm font-medium text-[#1F1F1F] underline underline-offset-4 hover:opacity-75 transition-opacity cursor-pointer"
            >
              {t("home_clear_all", "Clear all")}
            </button>
          )}

          {/* Right Action: Next (in When step) or Search (in Where / Who step) */}
          {activeStep === "when" ? (
            <button
              type="button"
              onClick={() => setActiveStep("who")}
              className="rounded-xl bg-[#222222] hover:bg-black text-white px-8 py-3 text-sm font-medium transition-colors cursor-pointer shadow-2xs"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                executeSearch();
                setIsMobileSearchOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-[#E00B41] hover:bg-[#D70466] text-white px-7 py-3 text-sm font-medium shadow-sm transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-4 text-white">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span>Search</span>
            </button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
