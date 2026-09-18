"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { MobileDatePicker, initialDatePreferences, type DatePreferences } from "@/components/home/mobile-date-picker";
import { saveLastSearch, saveRecentSearchContext, getRecentSearchContexts, LEGACY_RECENT_KEY } from "@/lib/storage/client-history";

function getRecentSearchTerms(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const contexts = getRecentSearchContexts();
    if (contexts.length > 0) {
      return contexts.map((c) => c.displayName || c.query).filter(Boolean).slice(0, 5);
    }
    return JSON.parse(localStorage.getItem(LEGACY_RECENT_KEY) ?? "[]").slice(0, 5);
  } catch {
    return [];
  }
}

interface SuggestionCityItem {
  id?: string;
  name?: string;
  city: string;
  fullLabel?: string;
  state?: string | null;
  region?: string | null;
  country: string | null;
  locality?: string | null;
  latitude: number;
  longitude: number;
  subtitle?: string;
  badge?: string;
  locationType?: string;
  providerPlaceId?: string;
  type?: string;
}

interface SelectedLocationData {
  name: string;
  fullAddress: string;
  city: string;
  state?: string;
  country: string;
  locality?: string;
  latitude: number;
  longitude: number;
  locationType: string;
  providerPlaceId: string;
}

interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

function formatShortDate(dateStr?: string | null): string {
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

export function ListingHeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL Query parameter values
  const urlDestination = searchParams.get("destination") || searchParams.get("city") || searchParams.get("placeName") || "";
  const urlCheckIn = searchParams.get("checkIn") || searchParams.get("startDate") || "";
  const urlCheckOut = searchParams.get("checkOut") || searchParams.get("endDate") || "";
  const urlGuests = parseInt(searchParams.get("guests") || "0", 10);
  const urlAdults = parseInt(searchParams.get("adults") || "0", 10);
  const urlChildren = parseInt(searchParams.get("children") || "0", 10);
  const urlInfants = parseInt(searchParams.get("infants") || "0", 10);
  const urlPets = parseInt(searchParams.get("pets") || "0", 10);
  const urlLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : undefined;
  const urlLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : undefined;
  const urlRadius = searchParams.get("radius") ? parseFloat(searchParams.get("radius")!) : undefined;
  const urlPlaceId = searchParams.get("placeId") || undefined;
  const urlLocationType = searchParams.get("locationType") || undefined;

  // Local Form State
  const [destination, setDestination] = useState(urlDestination);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocationData | null>(
    urlLat && urlLng
      ? {
          name: urlDestination,
          fullAddress: urlDestination,
          city: searchParams.get("city") || urlDestination,
          country: "",
          latitude: urlLat,
          longitude: urlLng,
          locationType: urlLocationType || "city",
          providerPlaceId: urlPlaceId || "",
        }
      : null
  );
  const [checkIn, setCheckIn] = useState(urlCheckIn);
  const [checkOut, setCheckOut] = useState(urlCheckOut);
  const [datePreferences, setDatePreferences] = useState<DatePreferences>(initialDatePreferences);
  const [guests, setGuests] = useState<GuestCounts>({
    adults: urlAdults > 0 ? urlAdults : urlGuests > 0 ? urlGuests : 0,
    children: urlChildren > 0 ? urlChildren : 0,
    infants: urlInfants > 0 ? urlInfants : 0,
    pets: urlPets > 0 ? urlPets : 0,
  });

  // UI Interactive States
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);
  const [desktopTab, setDesktopTab] = useState<"where" | "checkIn" | "checkOut" | "who">("where");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [mobileStep, setMobileStep] = useState<"where" | "when" | "who">("where");

  // Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState<{
    primaryCity?: SuggestionCityItem | null;
    places?: SuggestionCityItem[];
    districts?: SuggestionCityItem[];
    cities?: SuggestionCityItem[];
    properties?: Array<{ id: string; title: string; city?: string }>;
  } | null>(null);
  const [isLoadingSuggest, setIsLoadingSuggest] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLocating, setIsLocating] = useState(false);

  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever URL searchParams change
  useEffect(() => {
    setDestination(urlDestination);
    setCheckIn(urlCheckIn);
    setCheckOut(urlCheckOut);
    setGuests({
      adults: urlAdults > 0 ? urlAdults : urlGuests > 0 ? urlGuests : 0,
      children: urlChildren > 0 ? urlChildren : 0,
      infants: urlInfants > 0 ? urlInfants : 0,
      pets: urlPets > 0 ? urlPets : 0,
    });
    if (urlLat && urlLng) {
      setSelectedLocation({
        name: urlDestination,
        fullAddress: urlDestination,
        city: searchParams.get("city") || urlDestination,
        country: "",
        latitude: urlLat,
        longitude: urlLng,
        locationType: urlLocationType || "city",
        providerPlaceId: urlPlaceId || "",
      });
    } else if (!urlDestination) {
      setSelectedLocation(null);
    }
  }, [urlDestination, urlCheckIn, urlCheckOut, urlGuests, urlAdults, urlChildren, urlInfants, urlPets, urlLat, urlLng, urlRadius, urlPlaceId, urlLocationType, searchParams]);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearchTerms());
  }, []);

  // Dismiss desktop expanded panel on click outside or Escape
  useEffect(() => {
    if (!isDesktopExpanded) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (desktopContainerRef.current && !desktopContainerRef.current.contains(e.target as Node)) {
        setIsDesktopExpanded(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDesktopExpanded(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDesktopExpanded]);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (!destination.trim() || destination.length < 2) {
      setSuggestions(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingSuggest(true);
      try {
        const res = await fetch(`/api/v1/listings/search-suggest?q=${encodeURIComponent(destination.trim())}`);
        if (res.ok) {
          const json = await res.json();
          setSuggestions(json.data || null);
        }
      } catch (err) {
        console.error("Suggestions error:", err);
      } finally {
        setIsLoadingSuggest(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [destination]);

  // Focus input when "where" tab opened
  useEffect(() => {
    if (isDesktopExpanded && desktopTab === "where") {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isDesktopExpanded, desktopTab]);

  // Compute Total Guests
  const totalGuestCount = guests.adults + guests.children;
  const effectiveGuests = Math.max(0, totalGuestCount);

  // Pill Display Labels
  const pillDestination = urlDestination || "Anywhere";
  const pillDates =
    urlCheckIn && urlCheckOut
      ? `${formatShortDate(urlCheckIn)} – ${formatShortDate(urlCheckOut)}`
      : urlCheckIn
      ? `From ${formatShortDate(urlCheckIn)}`
      : "Any week";
  const pillGuests =
    effectiveGuests > 0
      ? `${effectiveGuests} ${effectiveGuests === 1 ? "guest" : "guests"}${guests.infants ? `, ${guests.infants} inf` : ""}${guests.pets ? `, ${guests.pets} pet` : ""}`
      : "Add guests";

  // Select a suggestion item
  const handleSelectSuggestion = (item: SuggestionCityItem | string) => {
    if (typeof item === "string") {
      setDestination(item);
      setSelectedLocation(null);
    } else {
      const displayLabel = item.name || item.city;
      setDestination(displayLabel);
      setSelectedLocation({
        name: item.name || item.city,
        fullAddress: item.fullLabel || item.subtitle || item.city,
        city: item.city,
        state: item.state || item.region || "",
        country: item.country || "",
        locality: item.locality || undefined,
        latitude: item.latitude,
        longitude: item.longitude,
        locationType: item.locationType || item.type || "city",
        providerPlaceId: item.providerPlaceId || `place:${item.city}`,
      });
    }
    setSuggestions(null);
    setDesktopTab("checkIn");
    if (isMobileDrawerOpen) {
      setMobileStep("when");
    }
  };

  // "Use current location" handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/v1/listings/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            const locName = data.city || data.name || "Current Location";
            setDestination(locName);
            setSelectedLocation({
              name: locName,
              fullAddress: data.fullAddress || locName,
              city: data.city || locName,
              country: data.country || "",
              latitude,
              longitude,
              locationType: "current_location",
              providerPlaceId: `coords:${latitude},${longitude}`,
            });
            setSuggestions(null);
            setDesktopTab("checkIn");
            if (isMobileDrawerOpen) setMobileStep("when");
          }
        } catch {
          setDestination("Current Location");
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  // Execute Search Navigation
  const executeSearch = (overrideLoc?: SelectedLocationData | null, overrideDates?: { checkIn?: string; checkOut?: string }) => {
    const currentParams = new URLSearchParams(searchParams.toString());

    const activeDest = destination.trim();
    const loc = overrideLoc !== undefined ? overrideLoc : selectedLocation;
    const finalIn = overrideDates?.checkIn !== undefined ? overrideDates.checkIn : checkIn;
    const finalOut = overrideDates?.checkOut !== undefined ? overrideDates.checkOut : checkOut;

    // Destination & City
    if (activeDest) {
      currentParams.set("destination", activeDest);
      currentParams.set("city", loc?.city || activeDest);
    } else {
      currentParams.delete("destination");
      currentParams.delete("city");
    }

    // Coordinates & Location metadata
    if (loc?.latitude && loc?.longitude) {
      currentParams.set("lat", String(loc.latitude));
      currentParams.set("lng", String(loc.longitude));
      currentParams.set("placeId", loc.providerPlaceId || "");
      currentParams.set("locationType", loc.locationType || "city");
      currentParams.set("radius", "25");
    } else {
      currentParams.delete("lat");
      currentParams.delete("lng");
      currentParams.delete("placeId");
      currentParams.delete("locationType");
      currentParams.delete("radius");
    }

    // Dates
    if (finalIn) currentParams.set("checkIn", finalIn);
    else currentParams.delete("checkIn");
    if (finalOut) currentParams.set("checkOut", finalOut);
    else currentParams.delete("checkOut");

    // Guests
    const count = guests.adults + guests.children;
    if (count > 0 || guests.infants > 0 || guests.pets > 0) {
      const guestVal = count > 0 ? count : 1;
      currentParams.set("guests", String(guestVal));
      if (guests.adults > 0) currentParams.set("adults", String(guests.adults));
      else currentParams.delete("adults");
      if (guests.children > 0) currentParams.set("children", String(guests.children));
      else currentParams.delete("children");
      if (guests.infants > 0) currentParams.set("infants", String(guests.infants));
      else currentParams.delete("infants");
      if (guests.pets > 0) currentParams.set("pets", String(guests.pets));
      else currentParams.delete("pets");
    } else {
      currentParams.delete("guests");
      currentParams.delete("adults");
      currentParams.delete("children");
      currentParams.delete("infants");
      currentParams.delete("pets");
    }

    // Clear map bounding box and reset pagination
    currentParams.delete("neLat");
    currentParams.delete("neLng");
    currentParams.delete("swLat");
    currentParams.delete("swLng");
    currentParams.delete("page");

    // Persist search context
    const context = {
      query: activeDest || "Stays",
      displayName: activeDest || "Stays",
      placeId: loc?.providerPlaceId || null,
      placeType: (loc?.locationType as any) || "general",
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      city: loc?.city || null,
      checkIn: finalIn || null,
      checkOut: finalOut || null,
      guests: Math.max(1, count),
      adults: guests.adults || Math.max(1, count),
      children: guests.children || 0,
      infants: guests.infants || 0,
      pets: guests.pets || 0,
      radiusKm: 25,
      searchedAt: new Date().toISOString(),
    };
    saveLastSearch(context);
    saveRecentSearchContext(context);

    // Track search
    fetch("/api/v1/search/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: activeDest || null,
        destinationType: loc?.locationType || null,
        city: loc?.city || null,
        lat: loc?.latitude ?? null,
        lng: loc?.longitude ?? null,
        checkIn: finalIn || null,
        checkOut: finalOut || null,
        guestCount: Math.max(1, count),
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});

    // Close overlays & push new URL
    setIsDesktopExpanded(false);
    setIsMobileDrawerOpen(false);
    router.push(`${pathname}?${currentParams.toString()}`);
  };

  // Stepper Component for Guest counts
  const Stepper = ({
    label,
    desc,
    value,
    min = 0,
    max = 16,
    onChange,
  }: {
    label: string;
    desc: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (val: number) => void;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-b-0">
      <div>
        <div className="text-sm font-semibold text-zinc-900">{label}</div>
        <div className="text-xs text-zinc-500">{desc}</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-8 w-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 hover:text-zinc-900 disabled:opacity-30 disabled:hover:border-zinc-300 disabled:hover:text-zinc-600 transition-colors cursor-pointer"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-semibold text-zinc-900">{value}</span>
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="h-8 w-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:border-zinc-800 hover:text-zinc-900 disabled:opacity-30 disabled:hover:border-zinc-300 disabled:hover:text-zinc-600 transition-colors cursor-pointer"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex items-center justify-center">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. DESKTOP COMPACT PILL (Visible when NOT expanded)           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!isDesktopExpanded && (
        <button
          type="button"
          onClick={() => {
            setIsDesktopExpanded(true);
            setDesktopTab("where");
          }}
          className="hidden md:flex items-center h-12 rounded-full border border-zinc-300/80 bg-white py-2 pl-4 pr-2 shadow-xs transition-all hover:shadow-md hover:border-zinc-400 group cursor-pointer"
          aria-label="Search destinations, dates, and guests"
        >
          {/* Destination */}
          <div className="max-w-[150px] lg:max-w-[180px] truncate text-xs lg:text-sm font-semibold text-zinc-900 pr-3 border-r border-zinc-200">
            {pillDestination}
          </div>

          {/* Dates */}
          <div className="whitespace-nowrap px-3 text-xs lg:text-sm font-semibold text-zinc-900 border-r border-zinc-200">
            {pillDates}
          </div>

          {/* Guests */}
          <div className="whitespace-nowrap px-3 text-xs lg:text-sm font-normal text-zinc-600">
            {pillGuests}
          </div>

          {/* Search Icon Button */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1F1F1F] text-white transition-transform group-hover:scale-105 ml-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </button>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. MOBILE COMPACT SEARCH BAR TRIGGER                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setIsMobileDrawerOpen(true);
          setMobileStep("where");
        }}
        className="flex md:hidden items-center gap-2.5 h-10 w-full max-w-[280px] sm:max-w-[320px] rounded-full border border-zinc-300 bg-white px-3 shadow-xs transition-shadow hover:shadow-md text-left cursor-pointer"
        aria-label="Open search"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-zinc-700">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="truncate text-xs font-semibold text-zinc-900 leading-tight">
            {pillDestination}
          </div>
          <div className="truncate text-[10px] text-zinc-500 font-normal leading-tight">
            {pillDates} · {pillGuests}
          </div>
        </div>
      </button>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. DESKTOP EXPANDED POPOVER OVERLAY                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isDesktopExpanded && (
        <>
          {/* Subtle backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] transition-opacity"
            onClick={() => setIsDesktopExpanded(false)}
          />

          {/* Floating Search Popover Container */}
          <div
            ref={desktopContainerRef}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[840px] animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="relative rounded-full border border-zinc-200 bg-white p-1.5 shadow-2xl flex items-center">
              {/* Where Tab */}
              <div
                onClick={() => setDesktopTab("where")}
                className={`relative flex-1 rounded-full px-5 py-2.5 transition-colors cursor-pointer ${
                  desktopTab === "where" ? "bg-amber-100/70 shadow-2xs" : "hover:bg-zinc-100/70"
                }`}
              >
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 cursor-pointer">
                  Where
                </label>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search destinations"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      executeSearch();
                    }
                  }}
                  className="w-full truncate bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none"
                />
              </div>

              <div className="h-8 w-px bg-zinc-200" />

              {/* Check-In Tab */}
              <div
                onClick={() => setDesktopTab("checkIn")}
                className={`flex-1 rounded-full px-5 py-2.5 transition-colors cursor-pointer ${
                  desktopTab === "checkIn" ? "bg-amber-100/70 shadow-2xs" : "hover:bg-zinc-100/70"
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                  Check in
                </div>
                <div className="truncate text-sm font-semibold text-zinc-900">
                  {formatShortDate(checkIn) || "Add dates"}
                </div>
              </div>

              <div className="h-8 w-px bg-zinc-200" />

              {/* Check-Out Tab */}
              <div
                onClick={() => setDesktopTab("checkOut")}
                className={`flex-1 rounded-full px-5 py-2.5 transition-colors cursor-pointer ${
                  desktopTab === "checkOut" ? "bg-amber-100/70 shadow-2xs" : "hover:bg-zinc-100/70"
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                  Check out
                </div>
                <div className="truncate text-sm font-semibold text-zinc-900">
                  {formatShortDate(checkOut) || "Add dates"}
                </div>
              </div>

              <div className="h-8 w-px bg-zinc-200" />

              {/* Who Tab */}
              <div
                onClick={() => setDesktopTab("who")}
                className={`flex-1 rounded-full px-5 py-2.5 transition-colors cursor-pointer ${
                  desktopTab === "who" ? "bg-amber-100/70 shadow-2xs" : "hover:bg-zinc-100/70"
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                  Who
                </div>
                <div className="truncate text-sm font-semibold text-zinc-900">
                  {pillGuests}
                </div>
              </div>

              {/* Search Submit Button */}
              <button
                type="button"
                onClick={() => executeSearch()}
                className="flex items-center gap-2 rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white px-5 py-3 font-semibold text-sm transition-all shadow-sm cursor-pointer ml-1"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Search</span>
              </button>
            </div>

            {/* Dropdown Panels Anchored Below Search Bar */}
            <div className="mt-3">
              {/* WHERE DROPDOWN PANEL */}
              {desktopTab === "where" && (
                <div className="w-[420px] rounded-3xl border border-zinc-200/90 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95">
                  {/* Current Location Button */}
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-zinc-50 cursor-pointer mb-2"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      {isLocating ? (
                        <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                          <circle cx="12" cy="12" r="8" />
                          <line x1="12" y1="2" x2="12" y2="4" />
                          <line x1="12" y1="20" x2="12" y2="22" />
                          <line x1="2" y1="12" x2="4" y2="12" />
                          <line x1="20" y1="12" x2="22" y2="12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">Use current location</div>
                      <div className="text-xs text-zinc-500">Discover verified stays near you</div>
                    </div>
                  </button>

                  {/* Autocomplete Suggestions */}
                  {suggestions && (
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                      {suggestions.primaryCity && (
                        <button
                          type="button"
                          onClick={() => handleSelectSuggestion(suggestions.primaryCity!)}
                          className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-amber-50/70 transition-colors cursor-pointer"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
                            🏙️
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-zinc-900">{suggestions.primaryCity.city}</div>
                            <div className="truncate text-xs text-zinc-500">{suggestions.primaryCity.fullLabel}</div>
                          </div>
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">City</span>
                        </button>
                      )}

                      {suggestions.places?.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(p)}
                          className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-zinc-50 transition-colors cursor-pointer"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                            📍
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-zinc-900">{p.name || p.city}</div>
                            <div className="truncate text-xs text-zinc-500">{p.subtitle || p.fullLabel}</div>
                          </div>
                          {p.badge && (
                            <span className="text-[10px] font-medium bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full">{p.badge}</span>
                          )}
                        </button>
                      ))}

                      {suggestions.cities?.filter((c) => c.city !== suggestions?.primaryCity?.city).map((c, idx) => (
                        <button
                          key={`c-${idx}`}
                          type="button"
                          onClick={() => handleSelectSuggestion(c)}
                          className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-zinc-50 transition-colors cursor-pointer"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                            📍
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-zinc-900">{c.city}</div>
                            <div className="truncate text-xs text-zinc-500">{c.country}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Recent Searches Fallback */}
                  {!suggestions && recentSearches.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-2 py-1.5">
                        Recent Searches
                      </div>
                      <div className="space-y-1">
                        {recentSearches.map((term, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setDestination(term);
                              setSelectedLocation(null);
                              setDesktopTab("checkIn");
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-zinc-50 transition-colors cursor-pointer"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 text-xs">
                              🕒
                            </div>
                            <span className="text-sm font-medium text-zinc-800">{term}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DATES DROPDOWN PANEL */}
              {(desktopTab === "checkIn" || desktopTab === "checkOut") && (
                <div className="w-full max-w-[680px] mx-auto rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95">
                  <MobileDatePicker
                    desktop={true}
                    selectionTarget={desktopTab}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onDatesChange={(inDate, outDate) => {
                      setCheckIn(inDate);
                      setCheckOut(outDate);
                      if (inDate && !outDate) setDesktopTab("checkOut");
                      if (inDate && outDate) setDesktopTab("who");
                    }}
                    preferences={datePreferences}
                    onPreferencesChange={setDatePreferences}
                  />
                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCheckIn("");
                        setCheckOut("");
                      }}
                      className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 underline cursor-pointer"
                    >
                      Reset dates
                    </button>
                    <button
                      type="button"
                      onClick={() => setDesktopTab("who")}
                      className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 cursor-pointer transition-colors"
                    >
                      Next: Who
                    </button>
                  </div>
                </div>
              )}

              {/* WHO DROPDOWN PANEL */}
              {desktopTab === "who" && (
                <div className="w-[380px] ml-auto rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95">
                  <Stepper
                    label="Adults"
                    desc="Ages 13 or above"
                    value={guests.adults}
                    min={0}
                    onChange={(val) => setGuests((prev) => ({ ...prev, adults: val }))}
                  />
                  <Stepper
                    label="Children"
                    desc="Ages 2–12"
                    value={guests.children}
                    min={0}
                    onChange={(val) => setGuests((prev) => ({ ...prev, children: val }))}
                  />
                  <Stepper
                    label="Infants"
                    desc="Under 2"
                    value={guests.infants}
                    min={0}
                    onChange={(val) => setGuests((prev) => ({ ...prev, infants: val }))}
                  />
                  <Stepper
                    label="Pets"
                    desc="Service animal?"
                    value={guests.pets}
                    min={0}
                    onChange={(val) => setGuests((prev) => ({ ...prev, pets: val }))}
                  />

                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setGuests({ adults: 0, children: 0, infants: 0, pets: 0 })}
                      className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 underline cursor-pointer"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => executeSearch()}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white text-xs font-semibold px-5 py-2 cursor-pointer transition-colors"
                    >
                      Search
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. MOBILE INTERACTIVE SEARCH DRAWER / MODAL                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isMobileDrawerOpen && (
        <ModalOverlay className="fixed inset-0 z-[999] flex flex-col justify-end bg-black/60 backdrop-blur-sm sm:justify-center sm:p-4">
          <div className="flex h-[92vh] sm:h-auto sm:max-h-[85vh] w-full flex-col rounded-t-[32px] sm:rounded-[32px] bg-white text-[#1F1F1F] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div className="text-base font-bold text-zinc-900">Find your stay</div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer"
                aria-label="Close search"
              >
                ✕
              </button>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* WHERE SECTION */}
              {mobileStep === "where" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
                  <div className="text-base font-bold text-zinc-900 mb-3">Where to?</div>
                  <div className="flex items-center rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2.5 mb-3 focus-within:border-zinc-900 focus-within:bg-white transition-all">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-zinc-400 mr-2 shrink-0">
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search destinations (e.g. Dubai, London)"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none"
                    />
                    {destination && (
                      <button
                        type="button"
                        onClick={() => {
                          setDestination("");
                          setSelectedLocation(null);
                        }}
                        className="text-xs text-zinc-400 hover:text-zinc-700"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Use current location */}
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-zinc-50 cursor-pointer border border-zinc-100 mb-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      {isLocating ? (
                        <div className="h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                          <circle cx="12" cy="12" r="8" />
                          <line x1="12" y1="2" x2="12" y2="4" />
                          <line x1="12" y1="20" x2="12" y2="22" />
                          <line x1="2" y1="12" x2="4" y2="12" />
                          <line x1="20" y1="12" x2="22" y2="12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">Use current location</div>
                      <div className="text-[10px] text-zinc-500">Stays nearby</div>
                    </div>
                  </button>

                  {/* Suggestions or Recent */}
                  {suggestions ? (
                    <div className="max-h-[220px] overflow-y-auto space-y-1">
                      {suggestions.primaryCity && (
                        <button
                          type="button"
                          onClick={() => handleSelectSuggestion(suggestions.primaryCity!)}
                          className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-amber-50/70"
                        >
                          <span className="text-sm">🏙️</span>
                          <span className="text-xs font-semibold text-zinc-900">{suggestions.primaryCity.city}</span>
                        </button>
                      )}
                      {suggestions.places?.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(p)}
                          className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-zinc-50"
                        >
                          <span className="text-sm">📍</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-zinc-900">{p.name || p.city}</div>
                            <div className="truncate text-[10px] text-zinc-500">{p.subtitle}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : recentSearches.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Recent</div>
                      {recentSearches.map((term, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setDestination(term);
                            setSelectedLocation(null);
                            setMobileStep("when");
                          }}
                          className="flex w-full items-center gap-2 rounded-xl p-2 text-left text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                        >
                          <span>🕒</span>
                          <span>{term}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMobileStep("where")}
                  className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-left cursor-pointer"
                >
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Where</span>
                  <span className="text-xs font-semibold text-zinc-900 truncate max-w-[180px]">{destination || "Anywhere"}</span>
                </button>
              )}

              {/* WHEN SECTION */}
              {mobileStep === "when" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
                  <div className="text-base font-bold text-zinc-900 mb-3">When&apos;s your trip?</div>
                  <MobileDatePicker
                    desktop={false}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onDatesChange={(inDate, outDate) => {
                      setCheckIn(inDate);
                      setCheckOut(outDate);
                    }}
                    preferences={datePreferences}
                    onPreferencesChange={setDatePreferences}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMobileStep("when")}
                  className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-left cursor-pointer"
                >
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">When</span>
                  <span className="text-xs font-semibold text-zinc-900">{pillDates}</span>
                </button>
              )}

              {/* WHO SECTION */}
              {mobileStep === "who" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
                  <div className="text-base font-bold text-zinc-900 mb-3">Who&apos;s coming?</div>
                  <Stepper
                    label="Adults"
                    desc="Ages 13 or above"
                    value={guests.adults}
                    min={0}
                    onChange={(val) => setGuests((prev) => ({ ...prev, adults: val }))}
                  />
                  <Stepper
                    label="Children"
                    desc="Ages 2–12"
                    value={guests.children}
                    min={0}
                    onChange={(val) => setGuests((prev) => ({ ...prev, children: val }))}
                  />
                  <Stepper
                    label="Infants"
                    desc="Under 2"
                    value={guests.infants}
                    min={0}
                    onChange={(val) => setGuests((prev) => ({ ...prev, infants: val }))}
                  />
                  <Stepper
                    label="Pets"
                    desc="Service animal?"
                    value={guests.pets}
                    min={0}
                    onChange={(val) => setGuests((prev) => ({ ...prev, pets: val }))}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMobileStep("who")}
                  className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-left cursor-pointer"
                >
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Who</span>
                  <span className="text-xs font-semibold text-zinc-900">{pillGuests}</span>
                </button>
              )}
            </div>

            {/* Bottom Bar Actions */}
            <div className="flex items-center justify-between border-t border-zinc-100 bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDestination("");
                  setSelectedLocation(null);
                  setCheckIn("");
                  setCheckOut("");
                  setGuests({ adults: 0, children: 0, infants: 0, pets: 0 });
                }}
                className="text-xs font-semibold text-zinc-600 underline hover:text-zinc-900 cursor-pointer"
              >
                Clear all
              </button>

              <button
                type="button"
                onClick={() => executeSearch()}
                className="flex items-center gap-2 rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white px-6 py-3 font-semibold text-sm transition-all shadow-sm cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Search</span>
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

