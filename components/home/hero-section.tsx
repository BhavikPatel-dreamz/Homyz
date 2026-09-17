"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { MobileDatePicker, initialDatePreferences, type DatePreferences } from "./mobile-date-picker";
import { useLanguage } from "@/lib/i18n/language-context";

const emptyMobileGuests = { adults: 0, children: 0, infants: 0, pets: 0 };
const mobileGuestRows = [
  { key: "adults", labelKey: "home_adults", descKey: "home_adults_desc" },
  { key: "children", labelKey: "home_children", descKey: "home_children_desc" },
  { key: "infants", labelKey: "home_infants", descKey: "home_infants_desc" },
  { key: "pets", labelKey: "home_pets", descKey: "home_pets_desc" },
] as const;

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
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
      );
    case "district":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-800 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" fill="currentColor" fillOpacity="0.1" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        </div>
      );
    case "stay":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
      );
    case "country":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </div>
      );
    case "current_location":
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <circle cx="12" cy="12" r="7" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-2xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M12 2a6 6 0 0 0-6 6c0 4.5 6 11 6 11s6-6.5 6-11a6 6 0 0 0-6-6z" />
            <circle cx="12" cy="8" r="2" />
          </svg>
        </div>
      );
  }
}

function highlightMatch(text: string | null | undefined, query: string): React.ReactNode {
  if (!query || !text) return text ?? "";
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-extrabold text-zinc-950 underline decoration-amber-400 decoration-2 underline-offset-2">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

interface SuggestResult {
  primaryCity?: SuggestionCityItem | null;
  places?: SuggestionCityItem[];
  districts?: SuggestionCityItem[];
  cities: SuggestionCityItem[];
  properties: { id: string; title: string; city: string | null; latitude?: number | null; longitude?: number | null }[];
}

interface HeroSectionProps {
  onSearch?: (searchParams: {
    destination: string;
    checkIn: string;
    checkOut: string;
    guests: string;
    datePreferences?: DatePreferences;
    guestDetails?: typeof emptyMobileGuests;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    placeId?: string;
    locationType?: string;
    placeName?: string;
    fullAddress?: string;
    city?: string;
    country?: string;
  }) => void;
}

export function HeroSection({ onSearch }: HeroSectionProps) {
  const { t, language } = useLanguage();
  const [destination, setDestination] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocationData | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [desktopPanel, setDesktopPanel] = useState<"where" | "checkIn" | "checkOut" | "who" | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<"where" | "when" | "who">("where");
  const desktopSearchRef = useRef<HTMLFormElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<SuggestResult>({
    primaryCity: null,
    places: [],
    districts: [],
    cities: [],
    properties: [],
  });
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestIndex, setSuggestIndex] = useState(-1); // keyboard nav
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const searchParams = useSearchParams();

  // Load recent searches and dynamic suggestions on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    fetchSuggestions("");
    try {
      const stored = localStorage.getItem("homyz_selected_location");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name && typeof parsed?.latitude === "number") {
          setSelectedLocation(parsed);
          setDestination(parsed.name);
        }
      }
    } catch {}
  }, []);

  // Sync state from URL search params to preserve context across back/forward/refresh
  useEffect(() => {
    if (!searchParams) return;
    const urlDest = searchParams.get("destination") || searchParams.get("city") || searchParams.get("placeName");
    if (urlDest && urlDest.trim()) {
      setDestination(urlDest.trim());
    } else if (searchParams.toString() === "") {
      setDestination("");
      setSelectedLocation(null);
    }
    const urlIn = searchParams.get("checkIn");
    if (urlIn) setCheckIn(urlIn);
    const urlOut = searchParams.get("checkOut");
    if (urlOut) setCheckOut(urlOut);
  }, [searchParams]);

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
        try {
          localStorage.setItem("homyz_selected_location", JSON.stringify(loc));
        } catch {}

        setIsLocating(false);
        setActiveStep("when");
        if (!isMobileSearchOpen) setDesktopPanel("checkIn");
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1 /* PERMISSION_DENIED */) {
          setLocationError("Location permission was denied. Please type your destination.");
        } else {
          setLocationError("Unable to retrieve location. Please type your destination.");
        }
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }, [isMobileSearchOpen]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingSuggestions(true);
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
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingSuggestions(false);
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
    try {
      localStorage.removeItem("homyz_selected_location");
    } catch {}
    fetchSuggestions("");
  }, [fetchSuggestions]);

  useEffect(() => {
    if (!desktopPanel) return;
    const dismiss = (event: PointerEvent) => {
      if (!desktopSearchRef.current?.contains(event.target as Node)) setDesktopPanel(null);
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
  const [mobileGuests, setMobileGuests] = useState(emptyMobileGuests);
  const mobileGuestCount = mobileGuests.adults + mobileGuests.children;
  const effectiveGuestCount = Math.max(1, mobileGuestCount);
  const mobileGuestSummary = [
    mobileGuestCount
      ? t(mobileGuestCount === 1 ? "home_guest_one" : "home_guest_many", { count: mobileGuestCount })
      : "",
    mobileGuests.infants
      ? t(mobileGuests.infants === 1 ? "home_infant_one" : "home_infant_many", { count: mobileGuests.infants })
      : "",
    mobileGuests.pets
      ? t(mobileGuests.pets === 1 ? "home_pet_one" : "home_pet_many", { count: mobileGuests.pets })
      : "",
  ].filter(Boolean).join(", ");
  const [datePreferences, setDatePreferences] = useState<DatePreferences>(initialDatePreferences);
  const destinationListRef = useRef<HTMLDivElement>(null);
  const [destinationScroll, setDestinationScroll] = useState(0);

  // Mobile search popup state


  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("searchModal")) {
      setIsMobileSearchOpen(true);
    }
  }, []);

  // Close mobile search with Escape; ModalOverlay owns background scroll locking.
  useEffect(() => {
    if (!isMobileSearchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSearchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (destination.trim()) saveRecentSearch(destination.trim());
    setRecentSearches(getRecentSearches());
    handleMobileSubmit();
    setDesktopPanel(null);
  };

  // Build a flat list of all suggestion items for keyboard nav
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

  // Helper to get index within allSuggestItems
  const getIndexForLabel = (label: string) => {
    return allSuggestItems.findIndex((item) => item.label.toLowerCase() === label.toLowerCase());
  };

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
        try {
          localStorage.setItem("homyz_selected_location", JSON.stringify(loc));
        } catch {}
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
      try {
        localStorage.setItem("homyz_selected_location", JSON.stringify(loc));
      } catch {}
    }
    setSuggestions({ primaryCity: null, places: [], districts: [], cities: [], properties: [] });
    setSuggestIndex(-1);
  }, [allSuggestItems]);

  const handleMobileSubmit = () => {
    const destinationValue = destination.trim() || selectedLocation?.city || selectedLocation?.name || "";
    if (destinationValue) saveRecentSearch(destinationValue);
    // Auto-resolve best location match if user typed destination without clicking suggestion
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
    const guestDetailsForSearch = {
      adults: mobileGuests.adults > 0 ? mobileGuests.adults : guestCountForSearch,
      children: mobileGuests.children,
      infants: mobileGuests.infants,
      pets: mobileGuests.pets,
    };

    if (onSearch) {
      onSearch({
        destination: destinationValue,
        checkIn: datePreferences.mode === "dates" ? checkIn : "",
        checkOut: datePreferences.mode === "dates" ? checkOut : "",
        datePreferences,
        guests: `${guestCountForSearch} guest${guestCountForSearch === 1 ? "" : "s"}`,
        guestDetails: guestDetailsForSearch,
        lat: effectiveLoc?.latitude,
        lng: effectiveLoc?.longitude,
        radiusKm: effectiveLoc ? initialRadius : undefined,
        placeId: effectiveLoc?.providerPlaceId,
        locationType: effectiveLoc?.locationType,
        placeName: effectiveLoc?.name || destinationValue,
        fullAddress: effectiveLoc?.fullAddress,
        city: effectiveLoc?.city || destinationValue,
        country: effectiveLoc?.country,
      });
    }
    setIsMobileSearchOpen(false);
  };

  const handleMobileNext = () => {
    if (activeStep === "where") {
      setActiveStep("when");
    } else if (activeStep === "when") {
      setActiveStep("who");
    } else {
      handleMobileSubmit();
    }
  };

  const destinationSuggestions = (
    <>
      {/* Autocomplete suggestions panel */}
      <div
        ref={destinationListRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          const scrollableHeight = list.scrollHeight - list.clientHeight;
          setDestinationScroll(scrollableHeight > 0 ? (list.scrollTop / scrollableHeight) * 100 : 0);
        }}
        className="no-scrollbar max-h-[360px] w-full space-y-3 overflow-y-auto pr-1"
      >
        {/* Use Current Location Action Button */}
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
              <div className="text-[14px] font-bold text-zinc-900 group-hover:text-blue-700 transition-colors">
                {isLocating ? t("home_detecting_location") : t("home_use_current_location")}
              </div>
              <div className="text-[12px] text-zinc-500 truncate">{t("home_find_stays_near_you")}</div>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-blue-100/70 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-blue-800">
            GPS
          </span>
        </button>
        {locationError && (
          <div className="px-3 py-2 mb-2 text-[12px] text-rose-600 bg-rose-50 rounded-xl border border-rose-100">
            {locationError}
          </div>
        )}
        {/* Live World & DB results */}
        {(primaryCity || places.length > 0 || districts.length > 0 || cities.length > 0 || properties.length > 0) ? (
          <>
            {/* 1. Primary City Match */}
            {primaryCity && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    selectSuggestion(primaryCity);
                    setActiveStep("when");
                    if (!isMobileSearchOpen) setDesktopPanel("checkIn");
                  }}
                  className={`flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-all cursor-pointer ${
                    suggestIndex === getIndexForLabel(primaryCity.name || primaryCity.city)
                      ? "bg-[#fcdf9c]/40 ring-1 ring-[#fcdf9c]"
                      : "hover:bg-zinc-100/90"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <LocationIcon type="city" />
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-zinc-900 truncate">
                        {highlightMatch(primaryCity.fullLabel || primaryCity.name, destination)}
                      </div>
                      <div className="text-[12px] text-zinc-500 truncate">{primaryCity.subtitle || `All stays in ${primaryCity.name}`}</div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-zinc-700">
                    City
                  </span>
                </button>
              </div>
            )}

            {/* 2. Places & Neighborhoods in this city */}
            {places.length > 0 && (
              <div>
                <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {t("home_places_in", { name: primaryCity?.name || t("home_search_where") })}
                </p>
                <div className="space-y-1">
                  {places.map((p) => {
                    const label = p.name || p.city;
                    const idx = getIndexForLabel(label);
                    return (
                      <button
                        key={`place-${p.id || p.providerPlaceId || p.city}`}
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
                          {p.badge || (p.locationType ? p.locationType.charAt(0).toUpperCase() + p.locationType.slice(1) : "Neighborhood")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Nearby Districts & Suburbs */}
            {districts.length > 0 && (
              <div>
                <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {t("home_nearby_areas_districts")}
                </p>
                <div className="space-y-1">
                  {districts.map((d) => {
                    const label = d.name || d.city;
                    const idx = getIndexForLabel(label);
                    return (
                      <button
                        key={`dist-${d.id || d.providerPlaceId || d.city}`}
                        type="button"
                        onClick={() => {
                          selectSuggestion(d);
                          setActiveStep("when");
                          if (!isMobileSearchOpen) setDesktopPanel("checkIn");
                        }}
                        className={`flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-all cursor-pointer ${
                          suggestIndex === idx ? "bg-[#fcdf9c]/40 ring-1 ring-[#fcdf9c]" : "hover:bg-zinc-100/80"
                        }`}
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
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Other Cities (when no primaryCity was set) */}
            {!primaryCity && places.length === 0 && cities.length > 0 && (
              <div className="space-y-1">
                {cities.map((c) => {
                  const label = c.name || c.city;
                  const idx = getIndexForLabel(label);
                  const isStayBadge = c.subtitle === "Stays in Homyz" || c.badge === "Available Stays";
                  return (
                    <button
                      key={`city-${c.id || c.providerPlaceId || c.city}`}
                      type="button"
                      onClick={() => {
                        selectSuggestion(c);
                        setActiveStep("when");
                        if (!isMobileSearchOpen) setDesktopPanel("checkIn");
                      }}
                      className={`flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-all cursor-pointer ${
                        suggestIndex === idx ? "bg-[#fcdf9c]/40 ring-1 ring-[#fcdf9c]" : "hover:bg-zinc-100/80"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <LocationIcon type={c.locationType || c.type || "city"} />
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold text-zinc-900 truncate">
                            {highlightMatch(c.fullLabel || c.name || c.city, destination)}
                          </div>
                          {c.subtitle && <div className="text-[12px] text-zinc-500 truncate">{c.subtitle}</div>}
                        </div>
                      </div>
                      {isStayBadge ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                          Available Stays
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                          {c.badge || (c.locationType ? c.locationType.charAt(0).toUpperCase() + c.locationType.slice(1) : "Destination")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 5. Properties / Stays */}
            {properties.length > 0 && (
              <div>
                <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Available Stays
                </p>
                <div className="space-y-1">
                  {properties.map((p) => {
                    const idx = getIndexForLabel(p.title);
                    return (
                      <button
                        key={`prop-${p.id}`}
                        type="button"
                        onClick={() => {
                          selectSuggestion(p.title);
                          setActiveStep("when");
                          if (!isMobileSearchOpen) setDesktopPanel("checkIn");
                        }}
                        className={`flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-all cursor-pointer ${
                          suggestIndex === idx ? "bg-[#fcdf9c]/40 ring-1 ring-[#fcdf9c]" : "hover:bg-zinc-100/80"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 shadow-2xs">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-zinc-900 truncate">
                              {highlightMatch(p.title, destination)}
                            </div>
                            {p.city && <div className="text-[12px] text-zinc-500 truncate">{p.city}</div>}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                          Stay
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : isLoadingSuggestions ? (
          <div className="py-6 px-2 text-center text-[13px] text-zinc-500 flex items-center justify-center gap-2">
            <div className="h-4 w-4 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin" />
            {t("home_searching_destinations")}
          </div>
        ) : destination.trim().length >= 2 ? (
          <div className="py-8 px-4 text-center">
            <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-zinc-900">{t("home_no_matching_location")}</p>
            <p className="text-[12px] text-zinc-500 mt-1">{t("home_no_matching_location_hint")}</p>
          </div>
        ) : (
          /* Fallback: recent searches & popular destinations */
          <>
            {recentSearches.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1.5 px-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{t("home_recent_searches")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("homyz_recent_searches");
                      setRecentSearches([]);
                    }}
                    className="text-[11px] text-zinc-500 underline hover:text-zinc-900 cursor-pointer"
                  >
                    {t("home_clear")}
                  </button>
                </div>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      selectSuggestion(term);
                      setActiveStep("when");
                      if (!isMobileSearchOpen) setDesktopPanel("checkIn");
                    }}
                    className="flex w-full items-center gap-3 text-left rounded-2xl p-2.5 transition-colors hover:bg-zinc-100/80 cursor-pointer"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5">
                        <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                      </svg>
                    </div>
                    <div className="text-[14px] font-medium text-zinc-900 truncate">{term}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Popular Global Destinations */}
            {cities.length > 0 ? (
              <div>
                <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  {t("home_popular_destinations_worldwide")}
                </p>
                <div className="space-y-1">
                  {cities.map((d) => (
                    <button
                      key={d.id || d.city}
                      type="button"
                      onClick={() => {
                        selectSuggestion(d);
                        setActiveStep("when");
                        if (!isMobileSearchOpen) setDesktopPanel("checkIn");
                      }}
                      className="flex w-full items-center justify-between gap-3 text-left rounded-2xl p-2.5 transition-colors hover:bg-zinc-100/80 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <LocationIcon type={d.locationType || "city"} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-zinc-900 truncate">{d.name || d.city}</div>
                          <div className="text-[11px] text-zinc-500 truncate">{d.subtitle || d.country}</div>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                        {t("home_explore")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 px-4 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path d="M12 2a6 6 0 0 0-6 6c0 4.5 6 11 6 11s6-6.5 6-11a6 6 0 0 0-6-6z" />
                    <circle cx="12" cy="8" r="2" />
                  </svg>
                </div>
                <p className="text-[13px] font-medium text-zinc-800">{t("home_search_any_city_worldwide")}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{t("home_search_city_hint")}</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  const guestOptions = (
    <div className="mt-1 divide-y divide-[#aaa]">
      {mobileGuestRows.map(({ key, labelKey, descKey }) => {
        const label = t(labelKey);
        const description = t(descKey);
        return (
          <div key={key} className="flex items-center justify-between gap-3 py-5 last:pb-0">
            <div className="min-w-0">
              <p className="text-[15px] text-[#1f1f1f]">{label}</p>
              <p
                className={`mt-1 text-[14px] leading-[1.5] text-[#777] ${
                  key === "pets" ? "max-w-[145px] underline underline-offset-4" : ""
                }`}
              >
                {description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={`Remove ${label.toLowerCase()}`}
                disabled={mobileGuests[key] === 0}
                onClick={() => setMobileGuests((counts) => ({ ...counts, [key]: Math.max(0, counts[key] - 1) }))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#444] disabled:border-[#aaa] disabled:text-[#999] hover:bg-white disabled:hover:bg-transparent"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <span aria-live="polite" aria-label={`${label}: ${mobileGuests[key]}`} className="min-w-3 text-center text-[16px] tabular-nums">
                {mobileGuests[key]}
              </span>
              <button
                type="button"
                aria-label={`Add ${label.toLowerCase()}`}
                onClick={() => setMobileGuests((counts) => ({ ...counts, [key]: counts[key] + 1 }))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#444] hover:bg-white"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.2">
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
    <>
      {/* Mobile Hero Section (screens < md) */}
      <div className="block md:hidden w-full">
        {/* Top Image Card */}
        <div className="relative aspect-[358/512] w-full overflow-hidden rounded-[28px] bg-[#e5e5e5] shadow-xs">
          <Image
            src="/images/home/hero.png"
            alt="Traveler with backpack planning journey"
            fill
            priority
            className="object-cover object-[center_12%]"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        </div>

        {/* Heading */}
        <div className="mt-6">
          <h1 className="text-[28px] font-normal leading-[1.18] tracking-[-0.6px] text-[#1f1f1f]">
            {t("home_hero_title")}
          </h1>
        </div>

        {/* Start your search bar */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => {
              setActiveStep("where");
              setDesktopPanel(null);
              setIsMobileSearchOpen(true);
            }}
            className="flex h-[56px] w-full items-center justify-between rounded-full bg-[#f3f4f6] pl-6 pr-2 shadow-xs transition-transform active:scale-[0.99] cursor-pointer"
            aria-label="Start your search"
          >
            <span className="text-base font-medium text-[#1f1f1f]">
              {destination || t("home_search_where_placeholder")}
            </span>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FCDF9C] text-[#1f1f1f]">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4.5 w-4.5"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Desktop / Tablet Hero Section (screens >= md) */}
      <section className="relative z-20 hidden md:flex min-h-[410px] w-full items-center rounded-[32px] bg-[#ddd] sm:min-h-[460px] lg:min-h-[512px] lg:rounded-[60px]">
        {/* Background Travel Imagery */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-[32px] lg:rounded-[60px]">
          <Image
            alt="Traveler with backpack planning journey"
            className="object-cover"
            src="/images/home/hero-banner.png"
            fill
            sizes="(min-width: 1024px) 1520px, 100vw"
            priority
          />
        </div>

        {/* Hero Content & Search Bar */}
        <div className="relative z-10 w-full px-7 sm:px-12 lg:px-8 xl:px-8">
          <h1 className="mb-11 text-[34px] font-normal leading-[1.12] tracking-[-1.4px] text-[#1f1f1f] sm:text-[42px] lg:text-[50px] lg:leading-[1.08] xl:text-[52px]">
            {t("home_hero_title")}
          </h1>

          {/* Floating Search Container */}
          <form
            ref={desktopSearchRef}
            onSubmit={handleSearchSubmit}
            autoComplete="off"
            className="relative flex h-[66px] w-full max-w-[820px] items-center rounded-full bg-white shadow-[0_4px_24px_rgba(0,0,0,0.09)] border border-zinc-200/90 transition-shadow hover:shadow-[0_6px_30px_rgba(0,0,0,0.13)]"
          >
            {/* Where */}
            <div
              className={`flex h-full min-w-0 flex-[1.3] flex-col justify-center rounded-full px-5 transition-colors cursor-pointer ${
                desktopPanel === "where" ? "bg-[#fcdf9c]" : "hover:bg-zinc-100/70"
              }`}
              onClick={() => setDesktopPanel("where")}
            >
              <label htmlFor="desktop-destination" className="text-[12px] font-bold uppercase tracking-wider text-zinc-800 cursor-pointer">
                {t("home_search_where")}
              </label>
              <div className="flex items-center gap-1.5 w-full">
                <input
                  id="desktop-destination"
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
                  aria-controls="desktop-search-panel"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  placeholder="Search destinations (e.g. Surat, Mumbai)"
                  value={destination}
                  onFocus={() => setDesktopPanel("where")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDesktopPanel("where");
                  }}
                  onChange={(event) => handleDestinationChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      if (allSuggestItems.length > 0) {
                        setSuggestIndex((prev) => (prev + 1) % allSuggestItems.length);
                      }
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      if (allSuggestItems.length > 0) {
                        setSuggestIndex((prev) => (prev <= 0 ? allSuggestItems.length - 1 : prev - 1));
                      }
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      if (suggestIndex >= 0 && suggestIndex < allSuggestItems.length) {
                        const itm = allSuggestItems[suggestIndex];
                        if (itm.raw) selectSuggestion(itm.raw);
                        else selectSuggestion(itm.label);
                        setDesktopPanel("checkIn");
                      } else if (cities.length > 0) {
                        selectSuggestion(cities[0]);
                        setDesktopPanel("checkIn");
                      } else {
                        handleSearchSubmit(event);
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

            {/* Check In */}
            <button
              type="button"
              aria-expanded={desktopPanel === "checkIn"}
              aria-controls="desktop-search-panel"
              onClick={() => setDesktopPanel(desktopPanel === "checkIn" ? null : "checkIn")}
              className={`flex h-full min-w-0 flex-1 flex-col justify-center rounded-full px-4 text-left transition-colors cursor-pointer ${
                desktopPanel === "checkIn" ? "bg-[#fcdf9c]" : "hover:bg-zinc-100/70"
              }`}
            >
              <span className="block text-[12px] font-bold uppercase tracking-wider text-zinc-800">{t("home_search_when")}</span>
              <span className="block truncate text-[14px] font-medium text-zinc-600">
                {datePreferences.mode !== "dates" ? t("home_when_tab_flexible") : checkIn || t("home_search_add_dates")}
              </span>
            </button>

            <div className="h-7 w-px bg-zinc-200/90 shrink-0" />

            {/* Check Out */}
            <button
              type="button"
              aria-expanded={desktopPanel === "checkOut"}
              aria-controls="desktop-search-panel"
              onClick={() => setDesktopPanel(desktopPanel === "checkOut" ? null : "checkOut")}
              className={`flex h-full min-w-0 flex-1 flex-col justify-center rounded-full px-4 text-left transition-colors cursor-pointer ${
                desktopPanel === "checkOut" ? "bg-[#fcdf9c]" : "hover:bg-zinc-100/70"
              }`}
            >
              <span className="block text-[12px] font-bold uppercase tracking-wider text-zinc-800">{t("home_search_when")}</span>
              <span className="block truncate text-[14px] font-medium text-zinc-600">
                {datePreferences.mode !== "dates" ? t("home_when_tab_flexible") : checkOut || t("home_search_add_dates")}
              </span>
            </button>

            <div className="h-7 w-px bg-zinc-200/90 shrink-0" />

            {/* Who & Search Button */}
            <div className="flex h-full min-w-0 flex-[1.3] items-center pr-2">
              <button
                type="button"
                aria-expanded={desktopPanel === "who"}
                aria-controls="desktop-search-panel"
                onClick={() => setDesktopPanel(desktopPanel === "who" ? null : "who")}
                className={`flex h-full min-w-0 flex-1 flex-col justify-center rounded-full px-4 text-left transition-colors cursor-pointer ${
                  desktopPanel === "who" ? "bg-[#fcdf9c]" : "hover:bg-zinc-100/70"
                }`}
              >
                <span className="block text-[12px] font-bold uppercase tracking-wider text-zinc-800">{t("home_search_who")}</span>
                <span className="block truncate text-[14px] font-medium text-zinc-600">
                  {mobileGuestSummary || t("home_search_add_guests")}
                </span>
              </button>
              <button
                type="submit"
                aria-label="Search"
                className="ml-1 flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[#fcdf9c] text-zinc-900 shadow-sm transition-all hover:bg-[#f3cf77] hover:scale-105 active:scale-95 cursor-pointer"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px]">
                  <circle cx="10.75" cy="10.75" r="6.75" stroke="currentColor" strokeWidth="2" />
                  <path d="m15.75 15.75 4.25 4.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Desktop Panels */}
            {desktopPanel && (
              <div
                id="desktop-search-panel"
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
                    ? "left-0 w-[400px] sm:w-[480px]"
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
      </section>

      {/* Mobile Search Popup Modal */}
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
              <h2 className="text-base font-bold text-zinc-900">{t("home_find_your_stay")}</h2>
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

            {/* Where? Card */}
            {activeStep !== "where" ? (
              <button
                type="button"
                onClick={() => setActiveStep("where")}
                aria-expanded={false}
                className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50 hover:bg-zinc-100/80 px-5 py-3.5 text-left transition-colors cursor-pointer"
              >
                <span className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wider">{t("home_search_where")}</span>
                <span className="truncate text-[15px] font-semibold text-zinc-900">{destination || t("home_search_where_placeholder")}</span>
              </button>
            ) : (
              <div className="rounded-[24px] bg-white border border-zinc-200/90 p-4 shadow-xs">
                <h3 className="text-[18px] font-bold text-zinc-900 mb-3">{t("home_where_to")}</h3>

                {/* Search input pill */}
                <div className="flex items-center justify-between rounded-full border border-zinc-300 bg-zinc-50/70 focus-within:bg-white focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 pl-4 pr-1.5 py-1.5 shadow-2xs mb-3 transition-all">
                  <input
                    id="mobile-destination"
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
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder={t("home_search_where_placeholder")}
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
                          handleMobileSubmit();
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
                    onClick={handleMobileSubmit}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FCDF9C] text-zinc-900 transition-transform active:scale-95 cursor-pointer hover:brightness-95"
                    aria-label="Search"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  </button>
                </div>

                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{t("home_search_where")}</p>
                {destinationSuggestions}
              </div>
            )}

            {/* When Section */}
            <div className="mt-3 rounded-[22px] border border-zinc-200 bg-zinc-50 p-3.5 transition-colors">
              <button
                type="button"
                aria-expanded={activeStep === "when"}
                className={`flex w-full items-center justify-between gap-2 text-left cursor-pointer ${
                  activeStep === "when" ? "mb-4 px-1 pt-1" : "px-2 py-1"
                }`}
                onClick={() => setActiveStep(activeStep === "when" ? "where" : "when")}
              >
                <span className={activeStep === "when" ? "text-[18px] font-bold text-zinc-900" : "text-[13px] font-semibold text-zinc-500 uppercase tracking-wider"}>
                  {activeStep === "when" ? t("home_when_trip") : t("home_search_when")}
                </span>
                {activeStep !== "when" && (
                  <span className="text-right text-[15px] font-semibold text-zinc-900">
                    {datePreferences.mode !== "dates"
                      ? `${datePreferences.mode === "flexible" ? t(`home_when_stay_${datePreferences.stay.toLowerCase()}` as any) + " · " : ""}${
                          datePreferences.months.length
                            ? datePreferences.months
                                .map((m) =>
                                  new Date(m + "-01T00:00:00").toLocaleDateString(
                                    language === "ar" ? "ar-EG" : language === "hi" ? "hi-IN" : language,
                                    { month: "short" }
                                  )
                                )
                                .join(", ")
                            : t("home_when_anytime")
                        }`
                      : checkIn
                      ? `${new Date(checkIn + "T00:00:00").toLocaleDateString(
                          language === "ar" ? "ar-EG" : language === "hi" ? "hi-IN" : language,
                          { month: "short", day: "numeric" }
                        )}${
                          checkOut
                            ? " – " +
                              new Date(checkOut + "T00:00:00").toLocaleDateString(
                                language === "ar" ? "ar-EG" : language === "hi" ? "hi-IN" : language,
                                { month: "short", day: "numeric" }
                              )
                            : " – " + t("home_when_add_checkout")
                        }`
                      : t("home_search_add_dates")}
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
            <div className="mt-3 rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3.5 transition-colors">
              <button
                type="button"
                aria-expanded={activeStep === "who"}
                aria-controls="mobile-guest-options"
                className="flex w-full items-center justify-between gap-3 text-left cursor-pointer"
                onClick={() => setActiveStep(activeStep === "who" ? "where" : "who")}
              >
                <span className={activeStep === "who" ? "text-[18px] font-bold text-zinc-900" : "text-[13px] font-semibold text-zinc-500 uppercase tracking-wider"}>
                  {activeStep === "who" ? t("home_whos_coming") : t("home_search_who")}
                </span>
                {activeStep !== "who" && (
                  <span className="text-right text-[15px] font-semibold text-zinc-900">
                    {mobileGuestSummary || t("home_search_add_guests")}
                  </span>
                )}
              </button>
              {activeStep === "who" && <div id="mobile-guest-options">{guestOptions}</div>}
            </div>

            {/* Action Buttons Row */}
            <div className="mt-5 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => {
                  setDestination("");
                  setCheckIn("");
                  setCheckOut("");
                  setMobileGuests(emptyMobileGuests);
                  setDatePreferences(initialDatePreferences);
                  setDestinationScroll(0);
                  setActiveStep("where");
                }}
                className="text-[14px] font-semibold underline text-zinc-700 cursor-pointer hover:text-zinc-950"
              >
                {t("home_clear_all")}
              </button>
              <button
                type="button"
                onClick={handleMobileNext}
                className="rounded-full bg-[#fcdf9c] px-6 py-2.5 text-[14px] font-bold text-zinc-900 shadow-sm transition-all hover:bg-[#f5d580] active:scale-95 cursor-pointer"
              >
                {activeStep === "who" ? t("home_search_btn") : t("home_next")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
