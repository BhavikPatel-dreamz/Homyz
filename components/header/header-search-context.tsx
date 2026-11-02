"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Suspense,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type {
  SuggestionLocationItem,
  SelectedLocationData,
  GuestCounts,
  DatePreferences,
  SearchFieldTab,
  RecentSearchItem,
} from "./header-types";
import {
  saveLastSearch,
  saveRecentSearchContext,
  getRecentSearchContexts,
  LEGACY_RECENT_KEY,
} from "@/lib/storage/client-history";
import { useLanguage } from "@/lib/i18n/language-context";

export const initialDatePreferences: DatePreferences = {
  mode: "dates",
  tolerance: 0,
  stay: "Weekend",
  months: [],
};

export function formatShortDate(dateStr?: string | null): string {
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

interface HeaderSearchContextValue {
  // Field values (draft / editing)
  destination: string;
  setDestination: (val: string) => void;
  selectedLocation: SelectedLocationData | null;
  setSelectedLocation: (loc: SelectedLocationData | null) => void;
  checkIn: string;
  setCheckIn: (val: string) => void;
  checkOut: string;
  setCheckOut: (val: string) => void;
  datePreferences: DatePreferences;
  setDatePreferences: React.Dispatch<React.SetStateAction<DatePreferences>>;
  guests: GuestCounts;
  setGuests: React.Dispatch<React.SetStateAction<GuestCounts>>;
  updateGuestCount: (category: keyof GuestCounts, delta: number) => void;

  // Active field and expanded state
  activeField: SearchFieldTab | null;
  setActiveField: (field: SearchFieldTab | null) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  isMobileSearchOpen: boolean;
  setIsMobileSearchOpen: (open: boolean) => void;

  // Autocomplete and Suggestions
  suggestions: {
    primaryCity?: SuggestionLocationItem | null;
    places?: SuggestionLocationItem[];
    districts?: SuggestionLocationItem[];
    cities?: SuggestionLocationItem[];
    properties?: Array<{ id: string; title: string; city?: string }>;
  } | null;
  isLoadingSuggestions: boolean;
  recentSearches: RecentSearchItem[];
  isLocating: boolean;

  // Actions
  handleSelectSuggestion: (item: SuggestionLocationItem | string) => void;
  handleUseCurrentLocation: () => Promise<void>;
  clearDestination: () => void;
  executeSearch: (overrides?: {
    location?: SelectedLocationData | null;
    checkIn?: string;
    checkOut?: string;
    guests?: GuestCounts;
  }) => void;

  // Formatted compact summaries
  compactDestination: string;
  compactDates: string;
  compactGuests: string;
  totalGuests: number;
}

const defaultContextValue: HeaderSearchContextValue = {
  destination: "",
  setDestination: () => {},
  selectedLocation: null,
  setSelectedLocation: () => {},
  checkIn: "",
  setCheckIn: () => {},
  checkOut: "",
  setCheckOut: () => {},
  datePreferences: initialDatePreferences,
  setDatePreferences: () => {},
  guests: { adults: 0, children: 0, infants: 0, pets: 0 },
  setGuests: () => {},
  updateGuestCount: () => {},
  activeField: null,
  setActiveField: () => {},
  isExpanded: false,
  setIsExpanded: () => {},
  isMobileSearchOpen: false,
  setIsMobileSearchOpen: () => {},
  suggestions: null,
  isLoadingSuggestions: false,
  recentSearches: [],
  isLocating: false,
  handleSelectSuggestion: () => {},
  handleUseCurrentLocation: async () => {},
  clearDestination: () => {},
  executeSearch: () => {},
  compactDestination: "Anywhere",
  compactDates: "Any week",
  compactGuests: "Add guests",
  totalGuests: 0,
};

const HeaderSearchContext = createContext<HeaderSearchContextValue>(defaultContextValue);

function HeaderSearchInnerProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  // Extract initial parameters from URL
  const urlDestination =
    searchParams?.get("destination") ||
    searchParams?.get("location") ||
    searchParams?.get("city") ||
    searchParams?.get("placeName") ||
    "";
  const urlCheckIn =
    searchParams?.get("checkIn") ||
    searchParams?.get("checkin") ||
    searchParams?.get("startDate") ||
    "";
  const urlCheckOut =
    searchParams?.get("checkOut") ||
    searchParams?.get("checkout") ||
    searchParams?.get("endDate") ||
    "";
  const urlGuests = parseInt(searchParams?.get("guests") || "0", 10);
  const urlAdults = parseInt(searchParams?.get("adults") || "0", 10);
  const urlChildren = parseInt(searchParams?.get("children") || "0", 10);
  const urlInfants = parseInt(searchParams?.get("infants") || "0", 10);
  const urlPets = parseInt(searchParams?.get("pets") || "0", 10);
  const urlLat = searchParams?.get("lat") ? parseFloat(searchParams?.get("lat")!) : undefined;
  const urlLng = searchParams?.get("lng") ? parseFloat(searchParams?.get("lng")!) : undefined;
  const urlPlaceId = searchParams?.get("placeId") || undefined;
  const urlLocationType = searchParams?.get("locationType") || undefined;

  // Local Draft States
  const [destination, setDestination] = useState<string>(urlDestination);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocationData | null>(
    urlLat && urlLng
      ? {
          name: urlDestination,
          fullAddress: urlDestination,
          city: searchParams?.get("city") || urlDestination,
          country: "",
          latitude: urlLat,
          longitude: urlLng,
          locationType: urlLocationType || "city",
          providerPlaceId: urlPlaceId || "",
        }
      : null
  );
  const [checkIn, setCheckIn] = useState<string>(urlCheckIn);
  const [checkOut, setCheckOut] = useState<string>(urlCheckOut);
  const [datePreferences, setDatePreferences] = useState<DatePreferences>(initialDatePreferences);
  const [guests, setGuests] = useState<GuestCounts>({
    adults: urlAdults > 0 ? urlAdults : urlGuests > 0 ? urlGuests : 0,
    children: urlChildren > 0 ? urlChildren : 0,
    infants: urlInfants > 0 ? urlInfants : 0,
    pets: urlPets > 0 ? urlPets : 0,
  });

  // UI Interactive States
  const [activeField, setActiveField] = useState<SearchFieldTab | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState<boolean>(false);

  // Autocomplete Suggestions & Recent Searches
  const [suggestions, setSuggestions] = useState<{
    primaryCity?: SuggestionLocationItem | null;
    places?: SuggestionLocationItem[];
    districts?: SuggestionLocationItem[];
    cities?: SuggestionLocationItem[];
    properties?: Array<{ id: string; title: string; city?: string }>;
  } | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Sync state when URL search params change (e.g. forward/back navigation)
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
        city: searchParams?.get("city") || urlDestination,
        country: "",
        latitude: urlLat,
        longitude: urlLng,
        locationType: urlLocationType || "city",
        providerPlaceId: urlPlaceId || "",
      });
    } else if (!urlDestination) {
      setSelectedLocation(null);
    }
  }, [
    urlDestination,
    urlCheckIn,
    urlCheckOut,
    urlGuests,
    urlAdults,
    urlChildren,
    urlInfants,
    urlPets,
    urlLat,
    urlLng,
    urlPlaceId,
    urlLocationType,
    searchParams,
  ]);

  // Load recent searches from client storage
  const loadRecentSearches = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const contexts = getRecentSearchContexts();
      if (contexts.length > 0) {
        const mapped: RecentSearchItem[] = contexts.map((c, idx) => ({
          id: c.placeId || `recent-${idx}-${c.query}`,
          displayName: c.displayName || c.city || c.query,
          city: c.city,
          checkIn: c.checkIn,
          checkOut: c.checkOut,
          guests: c.guests,
          latitude: c.latitude,
          longitude: c.longitude,
          placeId: c.placeId,
          locationType: c.placeType,
        }));
        setRecentSearches(mapped.slice(0, 5));
        return;
      }
      const legacyRaw = localStorage.getItem(LEGACY_RECENT_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed)) {
          setRecentSearches(
            parsed.slice(0, 5).map((term, i) => ({
              id: `legacy-${i}-${term}`,
              displayName: term,
            }))
          );
        }
      }
    } catch {
      // storage unavailable
    }
  }, []);

  useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  // Fetch location autocomplete suggestions with debounce
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = destination.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/v1/listings/search-suggest?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const json = await res.json();
          setSuggestions(json.data || null);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch autocomplete suggestions:", err);
        }
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [destination]);

  // Update guest counts with safety constraints
  const updateGuestCount = useCallback((category: keyof GuestCounts, delta: number) => {
    setGuests((prev) => {
      const nextVal = Math.max(0, (prev[category] || 0) + delta);
      // Max constraints
      if (category === "adults" && nextVal > 16) return prev;
      if (category === "children" && nextVal > 15) return prev;
      if (category === "infants" && nextVal > 5) return prev;
      if (category === "pets" && nextVal > 5) return prev;

      const next = { ...prev, [category]: nextVal };
      // If adding child or infant but adults is 0, bump adults to 1
      if ((category === "children" || category === "infants") && delta > 0 && next.adults === 0) {
        next.adults = 1;
      }
      return next;
    });
  }, []);

  // Clear destination field
  const clearDestination = useCallback(() => {
    setDestination("");
    setSelectedLocation(null);
    setSuggestions(null);
  }, []);

  // Select suggestion item
  const handleSelectSuggestion = useCallback(
    (item: SuggestionLocationItem | string) => {
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
      // Seamlessly advance to the date field
      setActiveField("when");
    },
    []
  );

  // Use Current Location
  const handleUseCurrentLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    setIsLocating(true);

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
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
                providerPlaceId: `coords:${latitude.toFixed(4)},${longitude.toFixed(4)}`,
              });
              setSuggestions(null);
              setActiveField("when");
            }
          } catch {
            setDestination("Current Location");
            setActiveField("when");
          } finally {
            setIsLocating(false);
            resolve();
          }
        },
        () => {
          setIsLocating(false);
          resolve();
        },
        { timeout: 8000 }
      );
    });
  }, []);

  // Compute total guests
  const totalGuests = guests.adults + guests.children;

  // Formatted compact summaries
  const compactDestination = useMemo(() => {
    const dest = destination.trim() || urlDestination;
    if (dest) {
      return `Homes in ${dest}`;
    }
    return t("header_search_anywhere") || "Anywhere";
  }, [destination, urlDestination, t]);

  const compactDates = useMemo(() => {
    const inDate = checkIn || urlCheckIn;
    const outDate = checkOut || urlCheckOut;
    if (inDate && outDate) {
      return `${formatShortDate(inDate)} - ${formatShortDate(outDate)}`;
    }
    if (inDate) {
      return `From ${formatShortDate(inDate)}`;
    }
    return t("home_when_anytime", "Anytime");
  }, [checkIn, checkOut, urlCheckIn, urlCheckOut, t]);

  const compactGuests = useMemo(() => {
    const total = (guests.adults || urlAdults || 0) + (guests.children || urlChildren || 0);
    const count = total > 0 ? total : urlGuests > 0 ? urlGuests : 0;
    if (count > 0) {
      const parts: string[] = [
        `${count} ${count === 1 ? t("header_search_who_single", "guest") : t("header_search_who_plural", "guests")}`,
      ];
      if (guests.infants > 0) parts.push(`${guests.infants} inf`);
      if (guests.pets > 0) parts.push(`${guests.pets} pet`);
      return parts.join(", ");
    }
    return t("home_search_add_guests", "Add guests");
  }, [guests, urlAdults, urlChildren, urlGuests, t]);

  // Execute Search Navigation
  const executeSearch = useCallback(
    (overrides?: {
      location?: SelectedLocationData | null;
      checkIn?: string;
      checkOut?: string;
      guests?: GuestCounts;
    }) => {
      const currentParams = new URLSearchParams(searchParams ? searchParams.toString() : "");
      const activeDest = destination.trim();
      const loc = overrides?.location !== undefined ? overrides.location : selectedLocation;
      const finalIn = overrides?.checkIn !== undefined ? overrides.checkIn : checkIn;
      const finalOut = overrides?.checkOut !== undefined ? overrides.checkOut : checkOut;
      const finalGuests = overrides?.guests !== undefined ? overrides.guests : guests;

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
      if (finalIn) {
        currentParams.set("checkIn", finalIn);
        currentParams.delete("checkin");
      } else {
        currentParams.delete("checkin");
        currentParams.delete("checkIn");
      }

      if (finalOut) {
        currentParams.set("checkOut", finalOut);
        currentParams.delete("checkout");
      } else {
        currentParams.delete("checkout");
        currentParams.delete("checkOut");
      }

      // Flexible Dates (if active)
      if (datePreferences.mode === "flexible") {
        currentParams.set("dateMode", "flexible");
        currentParams.set("stay", datePreferences.stay);
        if (datePreferences.tolerance > 0) {
          currentParams.set("dateFlexibility", String(datePreferences.tolerance));
        }
        if (datePreferences.months.length > 0) {
          currentParams.set("months", datePreferences.months.join(","));
        }
      } else {
        currentParams.delete("dateMode");
        currentParams.delete("stay");
        currentParams.delete("dateFlexibility");
        currentParams.delete("months");
      }

      // Guests
      const totalCount = finalGuests.adults + finalGuests.children;
      if (totalCount > 0 || finalGuests.infants > 0 || finalGuests.pets > 0) {
        currentParams.set("guests", String(Math.max(1, totalCount)));
        if (finalGuests.adults > 0) currentParams.set("adults", String(finalGuests.adults));
        else currentParams.delete("adults");
        if (finalGuests.children > 0) currentParams.set("children", String(finalGuests.children));
        else currentParams.delete("children");
        if (finalGuests.infants > 0) currentParams.set("infants", String(finalGuests.infants));
        else currentParams.delete("infants");
        if (finalGuests.pets > 0) currentParams.set("pets", String(finalGuests.pets));
        else currentParams.delete("pets");
      } else {
        currentParams.delete("guests");
        currentParams.delete("adults");
        currentParams.delete("children");
        currentParams.delete("infants");
        currentParams.delete("pets");
      }

      // Reset map bounding box and pagination on new search
      currentParams.delete("neLat");
      currentParams.delete("neLng");
      currentParams.delete("swLat");
      currentParams.delete("swLng");
      currentParams.delete("page");

      // Mark source
      currentParams.set("source", "header-search");

      // Persist search context in history & analytics
      const searchContext = {
        query: activeDest || "Stays",
        displayName: activeDest || "Stays",
        placeId: loc?.providerPlaceId || null,
        placeType: (loc?.locationType as any) || "general",
        latitude: loc?.latitude ?? null,
        longitude: loc?.longitude ?? null,
        city: loc?.city || null,
        checkIn: finalIn || null,
        checkOut: finalOut || null,
        guests: Math.max(1, totalCount),
        adults: finalGuests.adults || Math.max(1, totalCount),
        children: finalGuests.children || 0,
        infants: finalGuests.infants || 0,
        pets: finalGuests.pets || 0,
        radiusKm: 25,
        searchedAt: new Date().toISOString(),
      };
      saveLastSearch(searchContext);
      saveRecentSearchContext(searchContext);
      loadRecentSearches();

      // Track search in background
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
          guestCount: Math.max(1, totalCount),
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});

      // Close overlays
      setIsExpanded(false);
      setActiveField(null);
      setIsMobileSearchOpen(false);

      // Navigate to /listings
      router.push(`/listings?${currentParams.toString()}`);
    },
    [
      destination,
      selectedLocation,
      checkIn,
      checkOut,
      guests,
      datePreferences,
      searchParams,
      router,
      loadRecentSearches,
    ]
  );

  return (
    <HeaderSearchContext.Provider
      value={{
        destination,
        setDestination,
        selectedLocation,
        setSelectedLocation,
        checkIn,
        setCheckIn,
        checkOut,
        setCheckOut,
        datePreferences,
        setDatePreferences,
        guests,
        setGuests,
        updateGuestCount,

        activeField,
        setActiveField,
        isExpanded,
        setIsExpanded,
        isMobileSearchOpen,
        setIsMobileSearchOpen,

        suggestions,
        isLoadingSuggestions,
        recentSearches,
        isLocating,

        handleSelectSuggestion,
        handleUseCurrentLocation,
        clearDestination,
        executeSearch,

        compactDestination,
        compactDates,
        compactGuests,
        totalGuests,
      }}
    >
      {children}
    </HeaderSearchContext.Provider>
  );
}

export function HeaderSearchProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <HeaderSearchInnerProvider>{children}</HeaderSearchInnerProvider>
    </Suspense>
  );
}

export function useHeaderSearch() {
  return useContext(HeaderSearchContext);
}
