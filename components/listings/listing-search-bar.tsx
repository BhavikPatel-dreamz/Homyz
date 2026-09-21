"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { MobileDatePicker, initialDatePreferences, type DatePreferences } from "@/components/home/mobile-date-picker";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  saveRecentSearchContext,
  saveLastSearch,
  type PersistedSearchContext,
} from "@/lib/storage/client-history";

const RECENT_KEY = "homyz_recent_searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  if (!term.trim()) return;
  try {
    const prev = getRecentSearches().filter((s) => s !== term);
    localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...prev].slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable
  }
}

export interface SuggestionCityItem {
  id?: string;
  name?: string;
  city: string;
  fullLabel?: string;
  state?: string | null;
  region?: string | null;
  country: string | null;
  countryCode?: string | null;
  locality?: string | null;
  latitude: number;
  longitude: number;
  subtitle?: string;
  badge?: string;
  locationType?: string;
  providerPlaceId?: string;
  type?: string;
  distanceKm?: number;
}

export interface SelectedLocationData {
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

interface SuggestResult {
  primaryCity?: SuggestionCityItem | null;
  places: SuggestionCityItem[];
  districts: SuggestionCityItem[];
  cities: SuggestionCityItem[];
  properties: Array<{ id: string; title: string; city?: string }>;
}

const emptyMobileGuests = { adults: 0, children: 0, infants: 0, pets: 0 };
const mobileGuestRows = [
  { key: "adults", labelKey: "home_adults", descKey: "home_adults_desc", defaultLabel: "Adults", defaultDesc: "Ages 13 or above" },
  { key: "children", labelKey: "home_children", descKey: "home_children_desc", defaultLabel: "Children", defaultDesc: "Ages 2–12" },
  { key: "infants", labelKey: "home_infants", descKey: "home_infants_desc", defaultLabel: "Infants", defaultDesc: "Under 2" },
  { key: "pets", labelKey: "home_pets", descKey: "home_pets_desc", defaultLabel: "Pets", defaultDesc: "Bringing a service animal?" },
] as const;

function LocationIcon({ type }: { type?: string }) {
  switch (type) {
    case "beach":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            <path d="M12 9v12" />
          </svg>
        </div>
      );
    case "station":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <rect x="4" y="3" width="16" height="16" rx="2" />
            <path d="M4 11h16" />
            <path d="M12 3v8" />
            <path d="m8 19-2 3" />
            <path d="m16 19 2 3" />
            <circle cx="8" cy="15" r="1" />
            <circle cx="16" cy="15" r="1" />
          </svg>
        </div>
      );
    case "airport":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
          </svg>
        </div>
      );
    case "mall":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-700 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
      );
    case "university":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-700 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </div>
      );
    case "hospital":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M12 6v12M6 12h12" />
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </div>
      );
    case "street":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M4 19L8 5h8l4 14" />
            <line x1="12" y1="8" x2="12" y2="10" />
            <line x1="12" y1="14" x2="12" y2="16" />
          </svg>
        </div>
      );
    case "landmark":
    case "poi":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
      );
    case "neighborhood":
    case "area":
    case "district":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M12 2a6 6 0 0 0-6 6c0 4.5 6 11 6 11s6-6.5 6-11a6 6 0 0 0-6-6z" />
            <circle cx="12" cy="8" r="2" />
          </svg>
        </div>
      );
  }
}

function highlightMatch(text: string, query: string) {
  if (!query || !query.trim()) return text;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-bold text-zinc-950 underline decoration-zinc-400 underline-offset-2">
        {text.slice(idx, idx + q.length)}
      </strong>
      {text.slice(idx + q.length)}
    </>
  );
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

export function ListingSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language } = useLanguage();

  // URL Query Parameters
  const urlDest = searchParams.get("destination") || searchParams.get("city") || searchParams.get("placeName") || "";
  const urlCheckIn = searchParams.get("checkIn") || searchParams.get("startDate") || "";
  const urlCheckOut = searchParams.get("checkOut") || searchParams.get("endDate") || "";
  const urlAdults = parseInt(searchParams.get("adults") || "0", 10);
  const urlChildren = parseInt(searchParams.get("children") || "0", 10);
  const urlInfants = parseInt(searchParams.get("infants") || "0", 10);
  const urlPets = parseInt(searchParams.get("pets") || "0", 10);
  const urlGuests = parseInt(searchParams.get("guests") || "0", 10);
  const urlLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : undefined;
  const urlLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : undefined;
  const urlRadius = searchParams.get("radius") ? parseFloat(searchParams.get("radius")!) : undefined;
  const urlPlaceId = searchParams.get("placeId") || undefined;
  const urlLocationType = searchParams.get("locationType") || undefined;

  // Search State
  const [destination, setDestination] = useState(urlDest);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocationData | null>(
    urlLat && urlLng
      ? {
          name: urlDest,
          fullAddress: urlDest,
          city: searchParams.get("city") || urlDest,
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
  const [mobileGuests, setMobileGuests] = useState({
    adults: urlAdults > 0 ? urlAdults : urlGuests > 0 ? urlGuests : 0,
    children: urlChildren > 0 ? urlChildren : 0,
    infants: urlInfants > 0 ? urlInfants : 0,
    pets: urlPets > 0 ? urlPets : 0,
  });

  const [desktopPanel, setDesktopPanel] = useState<"where" | "checkIn" | "checkOut" | "who" | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<"where" | "when" | "who">("where");
  const [isSearching, setIsSearching] = useState(false);

  // Suggestions & Geolocation
  const [suggestions, setSuggestions] = useState<SuggestResult>({
    primaryCity: null,
    places: [],
    districts: [],
    cities: [],
    properties: [],
  });
  const [isLocating, setIsLocating] = useState(false);
  const [, setLocationError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestIndex, setSuggestIndex] = useState(-1);

  const desktopSearchRef = useRef<HTMLFormElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state from URL
  useEffect(() => {
    setDestination(urlDest);
    setCheckIn(urlCheckIn);
    setCheckOut(urlCheckOut);
    setMobileGuests({
      adults: urlAdults > 0 ? urlAdults : urlGuests > 0 ? urlGuests : 0,
      children: urlChildren > 0 ? urlChildren : 0,
      infants: urlInfants > 0 ? urlInfants : 0,
      pets: urlPets > 0 ? urlPets : 0,
    });
    if (urlLat && urlLng) {
      setSelectedLocation({
        name: urlDest,
        fullAddress: urlDest,
        city: searchParams.get("city") || urlDest,
        country: "",
        latitude: urlLat,
        longitude: urlLng,
        locationType: urlLocationType || "city",
        providerPlaceId: urlPlaceId || "",
      });
    } else if (!urlDest) {
      setSelectedLocation(null);
    }
  }, [urlDest, urlCheckIn, urlCheckOut, urlAdults, urlChildren, urlInfants, urlPets, urlGuests, urlLat, urlLng, urlRadius, urlPlaceId, urlLocationType, searchParams]);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    fetchSuggestions("");
  }, []);

  // Dismiss desktop panels on click outside or Escape
  useEffect(() => {
    if (!desktopPanel) return;
    const dismiss = (event: PointerEvent) => {
      if (!desktopSearchRef.current?.contains(event.target as Node)) {
        setDesktopPanel(null);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        desktopSearchRef.current?.querySelector<HTMLElement>('[aria-expanded="true"]')?.focus();
        setDesktopPanel(null);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [desktopPanel]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (q: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/v1/listings/search-suggest?q=${encodeURIComponent(q)}`, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (res.ok) {
        const json = await res.json();
        const payload = json.data ?? json;
        setSuggestions({
          primaryCity: payload?.primaryCity ?? null,
          places: Array.isArray(payload?.places) ? payload.places : [],
          districts: Array.isArray(payload?.districts) ? payload.districts : [],
          cities: Array.isArray(payload?.cities) ? payload.cities : [],
          properties: Array.isArray(payload?.properties) ? payload.properties : [],
        });
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setSuggestions({ primaryCity: null, places: [], districts: [], cities: [], properties: [] });
      }
    }
  }, []);

  const handleDestinationChange = useCallback((value: string) => {
    setDestination(value);
    setSelectedLocation(null);
    setSuggestIndex(-1);
    setLocationError(null);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(value), 180);
  }, [fetchSuggestions]);

  const handleClearDestination = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDestination("");
    setSelectedLocation(null);
    setSuggestIndex(-1);
    fetchSuggestions("");
  }, [fetchSuggestions]);

  const handleUseCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let placeName = "Nearby stays";
        let city = "";
        let country = "";

        try {
          const res = await fetch(`/api/v1/listings/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            const payload = data.data || data;
            if (payload?.name || payload?.city) {
              placeName = payload.name || payload.city;
              city = payload.city || "";
              country = payload.country || "";
            }
          }
        } catch {}

        const loc: SelectedLocationData = {
          name: placeName,
          fullAddress: `${placeName}${country ? `, ${country}` : ""}`,
          city: city || placeName,
          country: country,
          latitude,
          longitude,
          locationType: "current_location",
          providerPlaceId: `gps:${latitude.toFixed(4)},${longitude.toFixed(4)}`,
        };

        setSelectedLocation(loc);
        setDestination(placeName);
        setIsLocating(false);
        setActiveStep("when");
        if (!isMobileSearchOpen) setDesktopPanel("checkIn");
      },
      () => {
        setIsLocating(false);
        setLocationError("Unable to retrieve location. Please type your destination.");
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }, [isMobileSearchOpen]);

  // Suggestion flat list
  const primaryCity = suggestions?.primaryCity;
  const places = suggestions?.places ?? [];
  const districts = suggestions?.districts ?? [];
  const cities = suggestions?.cities ?? [];
  const properties = suggestions?.properties ?? [];

  const allSuggestItems = useMemo(() => {
    const list: { label: string; sublabel?: string; raw?: SuggestionCityItem }[] = [];
    if (primaryCity) {
      list.push({ label: primaryCity.name || primaryCity.city, sublabel: primaryCity.fullLabel, raw: primaryCity });
    }
    for (const p of places) {
      list.push({ label: p.name || p.city, sublabel: p.subtitle || p.fullLabel, raw: p });
    }
    for (const d of districts) {
      list.push({ label: d.name || d.city, sublabel: d.subtitle || d.fullLabel, raw: d });
    }
    if (!primaryCity && places.length === 0) {
      for (const c of cities) {
        list.push({ label: c.name || c.city, sublabel: c.fullLabel || c.country || undefined, raw: c });
      }
    }
    for (const prop of properties) {
      list.push({ label: prop.title, sublabel: prop.city ?? undefined });
    }
    return list;
  }, [primaryCity, places, districts, cities, properties]);

  const selectSuggestion = useCallback((item: SuggestionCityItem | string) => {
    if (typeof item === "string") {
      setDestination(item);
      const matched = allSuggestItems.find((s) => s.label.toLowerCase() === item.toLowerCase());
      if (matched && matched.raw) {
        const loc: SelectedLocationData = {
          name: matched.raw.name || matched.raw.city,
          fullAddress: matched.raw.fullLabel || matched.raw.subtitle || matched.raw.city,
          city: matched.raw.city,
          state: matched.raw.state || matched.raw.region || "",
          country: matched.raw.country || "",
          locality: matched.raw.locality || undefined,
          latitude: matched.raw.latitude,
          longitude: matched.raw.longitude,
          locationType: matched.raw.locationType || matched.raw.type || "area",
          providerPlaceId: matched.raw.providerPlaceId || `place:${matched.raw.city}`,
        };
        setSelectedLocation(loc);
      }
    } else {
      const displayLabel = item.name || item.city;
      setDestination(displayLabel);
      const loc: SelectedLocationData = {
        name: item.name || item.city,
        fullAddress: item.fullLabel || item.subtitle || item.city,
        city: item.city,
        state: item.state || item.region || "",
        country: item.country || "",
        locality: item.locality || undefined,
        latitude: item.latitude,
        longitude: item.longitude,
        locationType: item.locationType || item.type || "area",
        providerPlaceId: item.providerPlaceId || `place:${item.city}`,
      };
      setSelectedLocation(loc);
    }
    setSuggestions({ primaryCity: null, places: [], districts: [], cities: [], properties: [] });
    setSuggestIndex(-1);
  }, [allSuggestItems]);

  // Guest calculations
  const mobileGuestCount = mobileGuests.adults + mobileGuests.children;
  const mobileGuestSummary = [
    mobileGuestCount
      ? t(mobileGuestCount === 1 ? "home_guest_one" : "home_guest_many", { count: mobileGuestCount }, `${mobileGuestCount} guest${mobileGuestCount > 1 ? "s" : ""}`)
      : "",
    mobileGuests.infants
      ? t(mobileGuests.infants === 1 ? "home_infant_one" : "home_infant_many", { count: mobileGuests.infants }, `${mobileGuests.infants} infant${mobileGuests.infants > 1 ? "s" : ""}`)
      : "",
    mobileGuests.pets
      ? t(mobileGuests.pets === 1 ? "home_pet_one" : "home_pet_many", { count: mobileGuests.pets }, `${mobileGuests.pets} pet${mobileGuests.pets > 1 ? "s" : ""}`)
      : "",
  ].filter(Boolean).join(", ");

  // Form submission & URL routing
  const executeSearch = () => {
    setIsSearching(true);
    const destinationValue = destination.trim() || selectedLocation?.city || selectedLocation?.name || "";
    if (destinationValue) saveRecentSearch(destinationValue);
    setRecentSearches(getRecentSearches());

    const effectiveLoc = selectedLocation || (
      primaryCity ? {
        name: primaryCity.name || primaryCity.city,
        fullAddress: primaryCity.fullLabel || primaryCity.city,
        city: primaryCity.city,
        state: primaryCity.state || primaryCity.region || "",
        country: primaryCity.country || "",
        locality: primaryCity.locality || undefined,
        latitude: primaryCity.latitude,
        longitude: primaryCity.longitude,
        locationType: primaryCity.locationType || "city",
        providerPlaceId: primaryCity.providerPlaceId || `place:${primaryCity.city}`,
      } : places[0] ? {
        name: places[0].name || places[0].city,
        fullAddress: places[0].fullLabel || places[0].city,
        city: places[0].city,
        state: places[0].state || places[0].region || "",
        country: places[0].country || "",
        locality: places[0].locality || undefined,
        latitude: places[0].latitude,
        longitude: places[0].longitude,
        locationType: places[0].locationType || "area",
        providerPlaceId: places[0].providerPlaceId || `place:${places[0].city}`,
      } : cities[0] ? {
        name: cities[0].name || cities[0].city,
        fullAddress: cities[0].fullLabel || cities[0].city,
        city: cities[0].city,
        state: cities[0].state || cities[0].region || "",
        country: cities[0].country || "",
        locality: cities[0].locality || undefined,
        latitude: cities[0].latitude,
        longitude: cities[0].longitude,
        locationType: cities[0].locationType || "city",
        providerPlaceId: cities[0].providerPlaceId || `place:${cities[0].city}`,
      } : null
    );

    const isLandmarkOrPoi =
      effectiveLoc?.locationType === "landmark" ||
      effectiveLoc?.locationType === "poi" ||
      effectiveLoc?.locationType === "station" ||
      effectiveLoc?.locationType === "airport" ||
      effectiveLoc?.locationType === "beach" ||
      effectiveLoc?.locationType === "mall" ||
      effectiveLoc?.locationType === "university" ||
      effectiveLoc?.locationType === "hospital";
    const initialRadius = isLandmarkOrPoi ? 5 : 25;
    const guestCountForSearch = Math.max(1, mobileGuestCount);

    // Build URL search params preserving existing non-conflicting filters
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("page"); // Reset pagination

    const staticValues = new Set(["Recent searches", "Nearby", "Suggested destinations"]);
    const resolvedDestination = (destinationValue || "").trim();
    if (resolvedDestination && !staticValues.has(resolvedDestination)) {
      sp.set("destination", resolvedDestination);
      sp.set("city", (effectiveLoc?.city || resolvedDestination).trim());
    } else {
      sp.delete("destination");
      sp.delete("city");
    }

    if (effectiveLoc?.name) sp.set("placeName", effectiveLoc.name);
    else sp.delete("placeName");

    if (effectiveLoc?.fullAddress) sp.set("fullAddress", effectiveLoc.fullAddress);
    else sp.delete("fullAddress");

    if (typeof effectiveLoc?.latitude === "number" && !isNaN(effectiveLoc.latitude)) {
      sp.set("lat", String(effectiveLoc.latitude));
    } else {
      sp.delete("lat");
    }

    if (typeof effectiveLoc?.longitude === "number" && !isNaN(effectiveLoc.longitude)) {
      sp.set("lng", String(effectiveLoc.longitude));
    } else {
      sp.delete("lng");
    }

    if (effectiveLoc) {
      sp.set("radius", String(initialRadius));
    } else {
      sp.delete("radius");
    }

    if (effectiveLoc?.providerPlaceId) sp.set("placeId", effectiveLoc.providerPlaceId);
    else sp.delete("placeId");

    if (effectiveLoc?.locationType) sp.set("locationType", effectiveLoc.locationType);
    else sp.delete("locationType");

    // Dates
    const appliedCheckIn = datePreferences.mode === "dates" ? checkIn : "";
    const appliedCheckOut = datePreferences.mode === "dates" ? checkOut : "";
    if (appliedCheckIn) sp.set("checkIn", appliedCheckIn);
    else sp.delete("checkIn");
    if (appliedCheckOut) sp.set("checkOut", appliedCheckOut);
    else sp.delete("checkOut");

    // Guests
    sp.set("guests", String(guestCountForSearch));
    if (mobileGuests.adults > 0) sp.set("adults", String(mobileGuests.adults));
    else sp.delete("adults");
    if (mobileGuests.children > 0) sp.set("children", String(mobileGuests.children));
    else sp.delete("children");
    if (mobileGuests.infants > 0) sp.set("infants", String(mobileGuests.infants));
    else sp.delete("infants");
    if (mobileGuests.pets > 0) sp.set("pets", String(mobileGuests.pets));
    else sp.delete("pets");

    // Persist search context
    const persistedContext: PersistedSearchContext = {
      query: resolvedDestination || "Stays",
      displayName: resolvedDestination || "Stays",
      placeId: effectiveLoc?.providerPlaceId || null,
      placeType: (effectiveLoc?.locationType as any) || "general",
      latitude: effectiveLoc?.latitude ?? null,
      longitude: effectiveLoc?.longitude ?? null,
      city: effectiveLoc?.city || null,
      country: effectiveLoc?.country || null,
      checkIn: appliedCheckIn || null,
      checkOut: appliedCheckOut || null,
      guests: guestCountForSearch,
      adults: mobileGuests.adults || guestCountForSearch,
      children: mobileGuests.children || 0,
      infants: mobileGuests.infants || 0,
      pets: mobileGuests.pets || 0,
      radiusKm: effectiveLoc ? initialRadius : undefined,
      searchedAt: new Date().toISOString(),
    };
    saveLastSearch(persistedContext);
    saveRecentSearchContext(persistedContext);

    void fetch("/api/v1/search/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        destination: resolvedDestination || null,
        destinationType: effectiveLoc?.locationType || null,
        city: effectiveLoc?.city || null,
        country: effectiveLoc?.country || null,
        lat: effectiveLoc?.latitude ?? null,
        lng: effectiveLoc?.longitude ?? null,
        checkIn: appliedCheckIn || null,
        checkOut: appliedCheckOut || null,
        guestCount: guestCountForSearch,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => undefined);

    setDesktopPanel(null);
    setIsMobileSearchOpen(false);
    setIsSearching(false);
    // Preserve source=home-search so the search bar stays visible after re-search
    sp.set("source", "home-search");
    router.push(`/listings?${sp.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch();
  };

  const handleMobileNext = () => {
    if (activeStep === "where") {
      setActiveStep("when");
    } else if (activeStep === "when") {
      setActiveStep("who");
    } else {
      executeSearch();
    }
  };

  // Autocomplete suggestions list JSX
  const destinationSuggestions = (
    <div className="no-scrollbar max-h-[360px] w-full space-y-3 overflow-y-auto pr-1">
      {/* Current Location Action Button */}
      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={isLocating}
        className="flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-all cursor-pointer hover:bg-zinc-100/90 group border border-zinc-100/90 bg-zinc-50/50 mb-2"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-2xs">
            {isLocating ? (
              <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin group-hover:border-white group-hover:border-t-transparent" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <span className="block text-[14px] font-bold text-zinc-900 leading-tight">
              {isLocating ? "Detecting location..." : "Use current location"}
            </span>
            <span className="block text-[11px] text-zinc-500 font-medium">Discover verified stays near you</span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-blue-100/80 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
          GPS
        </span>
      </button>

      {/* Recent Searches */}
      {!destination.trim() && recentSearches.length > 0 && (
        <div className="mb-3">
          <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Recent Searches
          </p>
          <div className="space-y-1">
            {recentSearches.map((term, i) => (
              <button
                key={`recent-${i}`}
                type="button"
                onClick={() => {
                  selectSuggestion(term);
                  setActiveStep("when");
                  if (!isMobileSearchOpen) setDesktopPanel("checkIn");
                }}
                className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-zinc-100/80 transition-colors cursor-pointer"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span className="text-[13px] font-semibold text-zinc-800 truncate">{term}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary City Result */}
      {primaryCity && (
        <div className="mb-2">
          <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            City
          </p>
          <button
            type="button"
            onClick={() => {
              selectSuggestion(primaryCity);
              setActiveStep("when");
              if (!isMobileSearchOpen) setDesktopPanel("checkIn");
            }}
            className="flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-all cursor-pointer hover:bg-amber-50/70 border border-amber-200/60 bg-amber-50/20"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 shadow-2xs">
                🏙️
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-zinc-900 truncate">
                  {highlightMatch(primaryCity.name || primaryCity.city, destination)}
                </div>
                <div className="text-[11px] text-zinc-500 truncate">{primaryCity.fullLabel}</div>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              City
            </span>
          </button>
        </div>
      )}

      {/* Places & Landmarks */}
      {places.length > 0 && (
        <div>
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            {primaryCity?.name ? `Places in ${primaryCity.name}` : "Places & Areas"}
          </p>
          <div className="space-y-1">
            {places.map((p, idx) => (
              <button
                key={`place-${p.id || p.providerPlaceId || idx}`}
                type="button"
                onClick={() => {
                  selectSuggestion(p);
                  setActiveStep("when");
                  if (!isMobileSearchOpen) setDesktopPanel("checkIn");
                }}
                className={`flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-all cursor-pointer ${
                  suggestIndex === idx ? "bg-[#fcdf9c]/40 ring-1 ring-[#fcdf9c]" : "hover:bg-zinc-100/80"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <LocationIcon type={p.locationType || p.type} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-zinc-900 truncate">
                      {highlightMatch(p.name || p.city, destination)}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">{p.subtitle || p.fullLabel}</div>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100/70 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                  {p.badge || (p.locationType ? p.locationType.charAt(0).toUpperCase() + p.locationType.slice(1) : "Place")}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Districts */}
      {districts.length > 0 && (
        <div>
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Districts & Areas
          </p>
          <div className="space-y-1">
            {districts.map((d, idx) => (
              <button
                key={`dist-${d.id || d.providerPlaceId || idx}`}
                type="button"
                onClick={() => {
                  selectSuggestion(d);
                  setActiveStep("when");
                  if (!isMobileSearchOpen) setDesktopPanel("checkIn");
                }}
                className="flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-all cursor-pointer hover:bg-zinc-100/80"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <LocationIcon type="district" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-zinc-900 truncate">
                      {highlightMatch(d.name || d.city, destination)}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">{d.subtitle || d.fullLabel}</div>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-blue-100/70 px-2 py-0.5 text-[10px] font-semibold text-blue-900">
                  {d.badge || "District"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Other Cities */}
      {!primaryCity && places.length === 0 && cities.length > 0 && (
        <div className="space-y-1">
          {cities.map((c, idx) => (
            <button
              key={`city-${c.id || c.providerPlaceId || idx}`}
              type="button"
              onClick={() => {
                selectSuggestion(c);
                setActiveStep("when");
                if (!isMobileSearchOpen) setDesktopPanel("checkIn");
              }}
              className="flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-all cursor-pointer hover:bg-zinc-100/80"
            >
              <div className="flex items-center gap-3 min-w-0">
                <LocationIcon type="city" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-zinc-900 truncate">
                    {highlightMatch(c.name || c.city, destination)}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">{c.fullLabel || c.country || ""}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Guest counters JSX
  const guestOptions = (
    <div className="divide-y divide-zinc-100">
      {mobileGuestRows.map(({ key, labelKey, descKey, defaultLabel, defaultDesc }) => {
        const label = t(labelKey as any, undefined, defaultLabel);
        const description = t(descKey as any, undefined, defaultDesc);
        return (
          <div key={key} className="flex items-center justify-between gap-3 py-4 first:pt-1 last:pb-1">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-zinc-900">{label}</p>
              <p className="text-[12px] text-zinc-500">{description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                aria-label={`Remove ${label.toLowerCase()}`}
                disabled={mobileGuests[key] === 0}
                onClick={() => setMobileGuests((counts) => ({ ...counts, [key]: Math.max(0, counts[key] - 1) }))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <span aria-live="polite" className="min-w-4 text-center text-[15px] font-semibold tabular-nums">
                {mobileGuests[key]}
              </span>
              <button
                type="button"
                aria-label={`Add ${label.toLowerCase()}`}
                onClick={() => setMobileGuests((counts) => ({ ...counts, [key]: counts[key] + 1 }))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5v14" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. MOBILE SEARCH PILL (< md)                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="block md:hidden w-full">
        <button
          type="button"
          disabled={isSearching}
          onClick={() => {
            setActiveStep("where");
            setDesktopPanel(null);
            setIsMobileSearchOpen(true);
          }}
          className="flex h-[56px] w-full items-center justify-between rounded-full bg-[#f3f4f6] pl-6 pr-2 shadow-xs border border-zinc-200/80 transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-90 disabled:cursor-not-allowed"
          aria-label={isSearching ? "Searching..." : "Start your search"}
        >
          <div className="flex flex-col text-left min-w-0 pr-2">
            <span className="truncate text-sm font-semibold text-[#1f1f1f]">
              {destination || t("home_search_where_placeholder", undefined, "Search destinations")}
            </span>
            <span className="truncate text-[11px] text-zinc-500 font-medium">
              {(checkIn && checkOut ? `${formatShortDate(checkIn)} – ${formatShortDate(checkOut)}` : checkIn ? formatShortDate(checkIn) : "Anytime") +
                " · " +
                (mobileGuestSummary || "Add guests")}
            </span>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FCDF9C] text-[#1f1f1f]">
            {isSearching ? (
              <svg className="h-4.5 w-4.5 animate-spin text-zinc-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. DESKTOP FLOATING 4-SEGMENT SEARCH BAR (>= md)              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative hidden md:flex justify-center w-full">
        <form
          ref={desktopSearchRef}
          onSubmit={handleSearchSubmit}
          autoComplete="off"
          className="relative flex h-[66px] w-full max-w-[840px] items-center rounded-full bg-white shadow-[0_4px_24px_rgba(0,0,0,0.09)] border border-zinc-200/90 transition-shadow hover:shadow-[0_6px_30px_rgba(0,0,0,0.13)]"
        >
          {/* Segment 1: Where */}
          <div
            className={`flex h-full min-w-0 flex-[1.3] flex-col justify-center rounded-full px-5 transition-colors cursor-pointer ${
              desktopPanel === "where" ? "bg-[#fcdf9c]" : "hover:bg-zinc-100/70"
            }`}
            onClick={() => setDesktopPanel("where")}
          >
            <label htmlFor="listing-desktop-destination" className="text-[12px] font-bold uppercase tracking-wider text-zinc-800 cursor-pointer">
              {t("home_search_where", undefined, "Where")}
            </label>
            <div className="flex items-center gap-1.5 w-full">
              <input
                id="listing-desktop-destination"
                name="destination"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={desktopPanel === "where"}
                aria-haspopup="listbox"
                aria-controls="listing-search-panel"
                placeholder={t("home_search_where_placeholder", undefined, "Search destinations (e.g. Surat, Mumbai)")}
                value={destination}
                onFocus={() => setDesktopPanel("where")}
                onClick={(e) => {
                  e.stopPropagation();
                  setDesktopPanel("where");
                }}
                onChange={(e) => handleDestinationChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (allSuggestItems.length > 0) {
                      setSuggestIndex((prev) => (prev + 1) % allSuggestItems.length);
                    }
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if (allSuggestItems.length > 0) {
                      setSuggestIndex((prev) => (prev <= 0 ? allSuggestItems.length - 1 : prev - 1));
                    }
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (suggestIndex >= 0 && suggestIndex < allSuggestItems.length) {
                      const itm = allSuggestItems[suggestIndex];
                      if (itm.raw) selectSuggestion(itm.raw);
                      else selectSuggestion(itm.label);
                      setDesktopPanel("checkIn");
                    } else if (cities.length > 0) {
                      selectSuggestion(cities[0]);
                      setDesktopPanel("checkIn");
                    } else {
                      executeSearch();
                    }
                  }
                }}
                className="w-full truncate bg-transparent text-[14px] font-medium text-zinc-900 placeholder:text-zinc-400 outline-none"
              />
              {destination && (
                <button
                  type="button"
                  onClick={handleClearDestination}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200/80 hover:bg-zinc-300 text-zinc-600 hover:text-zinc-900 text-xs transition-colors cursor-pointer"
                  aria-label="Clear destination"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="h-7 w-px bg-zinc-200/90 shrink-0" />

          {/* Segment 2: Check In */}
          <button
            type="button"
            aria-expanded={desktopPanel === "checkIn"}
            aria-controls="listing-search-panel"
            onClick={() => setDesktopPanel(desktopPanel === "checkIn" ? null : "checkIn")}
            className={`flex h-full min-w-0 flex-1 flex-col justify-center rounded-full px-4 text-left transition-colors cursor-pointer ${
              desktopPanel === "checkIn" ? "bg-[#fcdf9c]" : "hover:bg-zinc-100/70"
            }`}
          >
            <span className="block text-[12px] font-bold uppercase tracking-wider text-zinc-800">
              {t("home_search_when", undefined, "Check in")}
            </span>
            <span className="block truncate text-[14px] font-medium text-zinc-600">
              {datePreferences.mode !== "dates" ? "Flexible" : formatShortDate(checkIn) || t("home_search_add_dates", undefined, "Add dates")}
            </span>
          </button>

          <div className="h-7 w-px bg-zinc-200/90 shrink-0" />

          {/* Segment 3: Check Out */}
          <button
            type="button"
            aria-expanded={desktopPanel === "checkOut"}
            aria-controls="listing-search-panel"
            onClick={() => setDesktopPanel(desktopPanel === "checkOut" ? null : "checkOut")}
            className={`flex h-full min-w-0 flex-1 flex-col justify-center rounded-full px-4 text-left transition-colors cursor-pointer ${
              desktopPanel === "checkOut" ? "bg-[#fcdf9c]" : "hover:bg-zinc-100/70"
            }`}
          >
            <span className="block text-[12px] font-bold uppercase tracking-wider text-zinc-800">
              {t("home_search_when", undefined, "Check out")}
            </span>
            <span className="block truncate text-[14px] font-medium text-zinc-600">
              {datePreferences.mode !== "dates" ? "Flexible" : formatShortDate(checkOut) || t("home_search_add_dates", undefined, "Add dates")}
            </span>
          </button>

          <div className="h-7 w-px bg-zinc-200/90 shrink-0" />

          {/* Segment 4: Who & Search Button */}
          <div className="flex h-full min-w-0 flex-[1.3] items-center pr-2">
            <button
              type="button"
              aria-expanded={desktopPanel === "who"}
              aria-controls="listing-search-panel"
              onClick={() => setDesktopPanel(desktopPanel === "who" ? null : "who")}
              className={`flex h-full min-w-0 flex-1 flex-col justify-center rounded-full px-4 text-left transition-colors cursor-pointer ${
                desktopPanel === "who" ? "bg-[#fcdf9c]" : "hover:bg-zinc-100/70"
              }`}
            >
              <span className="block text-[12px] font-bold uppercase tracking-wider text-zinc-800">
                {t("home_search_who", undefined, "Who")}
              </span>
              <span className="block truncate text-[14px] font-medium text-zinc-600">
                {mobileGuestSummary || t("home_search_add_guests", undefined, "Add guests")}
              </span>
            </button>
            <button
              type="submit"
              disabled={isSearching}
              aria-label={isSearching ? "Searching..." : t("home_search_btn", undefined, "Search")}
              className="ml-1 flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[#fcdf9c] text-zinc-900 shadow-sm transition-all hover:bg-[#f3cf77] hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-90 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <svg className="h-5 w-5 animate-spin text-zinc-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px]">
                  <circle cx="10.75" cy="10.75" r="6.75" stroke="currentColor" strokeWidth="2" />
                  <path d="m15.75 15.75 4.25 4.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>

          {/* Anchored Dropdown Panels */}
          {desktopPanel && (
            <div
              id="listing-search-panel"
              role="region"
              aria-label={
                desktopPanel === "where"
                  ? "Suggested destinations"
                  : desktopPanel === "who"
                  ? "Guests"
                  : "Choose dates"
              }
              className={`absolute top-full z-50 mt-3 max-h-[min(600px,75dvh)] max-w-full overflow-y-auto rounded-[28px] border border-zinc-100 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.14)] animate-in fade-in zoom-in-95 duration-150 ${
                desktopPanel === "where"
                  ? "left-0 w-[420px] sm:w-[480px]"
                  : desktopPanel === "who"
                  ? "right-0 w-[380px]"
                  : "left-0 sm:left-auto sm:right-0 lg:left-0 w-full max-w-[620px]"
              }`}
            >
              {desktopPanel === "where" ? (
                <>
                  <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wider text-zinc-500">Destinations</p>
                  {destinationSuggestions}
                </>
              ) : desktopPanel === "who" ? (
                guestOptions
              ) : (
                <MobileDatePicker
                  desktop
                  checkIn={checkIn}
                  checkOut={checkOut}
                  selectionTarget={desktopPanel === "checkOut" ? "checkOut" : "checkIn"}
                  onDatesChange={(start, end) => {
                    setCheckIn(start);
                    setCheckOut(end);
                    if (start && !end) setDesktopPanel("checkOut");
                  }}
                  preferences={datePreferences}
                  onPreferencesChange={setDatePreferences}
                />
              )}
            </div>
          )}
        </form>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MOBILE SEARCH MODAL OVERLAY                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isMobileSearchOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[60px] pb-6 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
          onClick={() => setIsMobileSearchOpen(false)}
        >
          <div
            className="relative w-full max-w-[440px] rounded-[32px] bg-white p-5 pt-4 pb-6 shadow-[0_24px_64px_rgba(0,0,0,0.2)] border border-zinc-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button at top right */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-zinc-900">
                {t("home_find_your_stay", undefined, "Find your stay")}
              </h2>
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Close search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Where Card */}
            {activeStep !== "where" ? (
              <button
                type="button"
                onClick={() => setActiveStep("where")}
                aria-expanded={false}
                className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50 hover:bg-zinc-100/80 px-5 py-3.5 text-left transition-colors cursor-pointer mb-3"
              >
                <span className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wider">
                  {t("home_search_where", undefined, "Where")}
                </span>
                <span className="truncate text-[15px] font-semibold text-zinc-900">
                  {destination || t("home_search_where_placeholder", undefined, "Search destinations")}
                </span>
              </button>
            ) : (
              <div className="rounded-[24px] bg-white border border-zinc-200/90 p-4 shadow-xs mb-3">
                <h3 className="text-[18px] font-bold text-zinc-900 mb-3">
                  {t("home_where_to", undefined, "Where to?")}
                </h3>

                <div className="flex items-center justify-between rounded-full border border-zinc-300 bg-zinc-50/70 focus-within:bg-white focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 pl-4 pr-1.5 py-1.5 shadow-2xs mb-3 transition-all">
                  <input
                    id="mobile-listing-destination"
                    name="destination-mobile"
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={true}
                    aria-haspopup="listbox"
                    placeholder={t("home_search_where_placeholder", undefined, "Search destinations")}
                    value={destination}
                    onChange={(e) => handleDestinationChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (allSuggestItems.length > 0) {
                          const itm = allSuggestItems[0];
                          if (itm.raw) selectSuggestion(itm.raw);
                          else selectSuggestion(itm.label);
                          setActiveStep("when");
                        } else {
                          executeSearch();
                        }
                      }
                    }}
                    className="w-full bg-transparent text-[14px] font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                    autoFocus
                  />
                  {destination && (
                    <button
                      type="button"
                      onClick={handleClearDestination}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-600 hover:text-zinc-900 text-xs mr-1 transition-colors cursor-pointer"
                      aria-label="Clear destination"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isSearching}
                    onClick={executeSearch}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FCDF9C] text-zinc-900 transition-transform active:scale-95 cursor-pointer hover:brightness-95 disabled:opacity-90 disabled:cursor-not-allowed"
                    aria-label={isSearching ? "Searching..." : "Search"}
                  >
                    {isSearching ? (
                      <svg className="h-4 w-4 animate-spin text-zinc-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    )}
                  </button>
                </div>

                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  {t("home_search_where", undefined, "Where")}
                </p>
                {destinationSuggestions}
              </div>
            )}

            {/* When Section */}
            <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-3.5 transition-colors mb-3">
              <button
                type="button"
                aria-expanded={activeStep === "when"}
                className={`flex w-full items-center justify-between gap-2 text-left cursor-pointer ${
                  activeStep === "when" ? "mb-4 px-1 pt-1" : "px-2 py-1"
                }`}
                onClick={() => setActiveStep(activeStep === "when" ? "where" : "when")}
              >
                <span className={activeStep === "when" ? "text-[18px] font-bold text-zinc-900" : "text-[13px] font-semibold text-zinc-500 uppercase tracking-wider"}>
                  {activeStep === "when" ? t("home_when_trip", undefined, "When's your trip?") : t("home_search_when", undefined, "When")}
                </span>
                {activeStep !== "when" && (
                  <span className="text-right text-[15px] font-semibold text-zinc-900">
                    {datePreferences.mode !== "dates"
                      ? "Flexible"
                      : checkIn
                      ? `${formatShortDate(checkIn)}${checkOut ? " – " + formatShortDate(checkOut) : ""}`
                      : t("home_search_add_dates", undefined, "Add dates")}
                  </span>
                )}
              </button>
              {activeStep === "when" && (
                <MobileDatePicker
                  checkIn={checkIn}
                  checkOut={checkOut}
                  onDatesChange={(start, end) => {
                    setCheckIn(start);
                    setCheckOut(end);
                  }}
                  preferences={datePreferences}
                  onPreferencesChange={setDatePreferences}
                />
              )}
            </div>

            {/* Who Section */}
            <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3.5 transition-colors mb-4">
              <button
                type="button"
                aria-expanded={activeStep === "who"}
                aria-controls="mobile-listing-guest-options"
                className="flex w-full items-center justify-between gap-3 text-left cursor-pointer"
                onClick={() => setActiveStep(activeStep === "who" ? "where" : "who")}
              >
                <span className={activeStep === "who" ? "text-[18px] font-bold text-zinc-900" : "text-[13px] font-semibold text-zinc-500 uppercase tracking-wider"}>
                  {activeStep === "who" ? t("home_whos_coming", undefined, "Who's coming?") : t("home_search_who", undefined, "Who")}
                </span>
                {activeStep !== "who" && (
                  <span className="text-right text-[15px] font-semibold text-zinc-900">
                    {mobileGuestSummary || t("home_search_add_guests", undefined, "Add guests")}
                  </span>
                )}
              </button>
              {activeStep === "who" && <div id="mobile-listing-guest-options" className="mt-2">{guestOptions}</div>}
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => {
                  setDestination("");
                  setCheckIn("");
                  setCheckOut("");
                  setMobileGuests(emptyMobileGuests);
                  setDatePreferences(initialDatePreferences);
                  setActiveStep("where");
                }}
                className="text-[14px] font-semibold underline text-zinc-700 cursor-pointer hover:text-zinc-950"
              >
                {t("home_clear_all", undefined, "Clear all")}
              </button>
              <button
                type="button"
                disabled={isSearching}
                onClick={handleMobileNext}
                className="flex items-center justify-center gap-2 rounded-full bg-[#fcdf9c] px-6 py-2.5 text-[14px] font-bold text-zinc-900 shadow-sm transition-all hover:bg-[#f5d580] active:scale-95 cursor-pointer disabled:opacity-90 disabled:cursor-not-allowed"
              >
                {isSearching && activeStep === "who" ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-zinc-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t("home_search_btn", undefined, "Search")}</span>
                  </>
                ) : (
                  activeStep === "who" ? t("home_search_btn", undefined, "Search") : t("home_next", undefined, "Next")
                )}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

