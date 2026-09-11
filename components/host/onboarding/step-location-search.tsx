"use client";

import React, { useState } from "react";
import { RealMap, LocationDetails } from "@/components/ui/real-map";
import { LocationCoords } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { Container } from "@/components/ui";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

interface NominatimSuggestion {
  place_id?: number | string;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

interface StepLocationSearchProps {
  streetAddress: string;
  city: string;
  country: string;
  coords: LocationCoords;
  searchQuery: string;
  onSearchInputChange: (val: string) => void;
  onSelectSuggestion: (item: NominatimSuggestion) => void;
  onLocationChange: (lat: number, lng: number, details?: LocationDetails) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepLocationSearch({
  streetAddress,
  city,
  country,
  coords,
  searchQuery,
  onSearchInputChange,
  onSelectSuggestion,
  onLocationChange,
  onBack,
  onNext,
  isLoading = false,
}: StepLocationSearchProps) {
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const searchCacheRef = React.useRef<Map<string, NominatimSuggestion[]>>(new Map());

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleInputChange = (val: string) => {
    onSearchInputChange(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    // Check in-memory cache first to avoid duplicate network calls
    const cached = searchCacheRef.current.get(trimmed.toLowerCase());
    if (cached) {
      setSuggestions(cached);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&addressdetails=1&limit=5`,
          {
            headers: { "User-Agent": "HomyzApp/1.0" },
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          throw new Error(`Nominatim error ${res.status}`);
        }

        const data = await res.json();
        if (Array.isArray(data)) {
          searchCacheRef.current.set(trimmed.toLowerCase(), data);
          setSuggestions(data);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          // Graceful fallback on rate-limit or network offline: keep user data safe
          setSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleSuggestionClick = (item: NominatimSuggestion) => {
    onSelectSuggestion(item);
    setSuggestions([]);
  };

  return (
    <main className="pb-8 sm:pt-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          <OnboardingMobileCloseButton disabled={isLoading} />
          <div className="max-w-124.25 mx-auto w-full flex flex-col items-start text-left my-auto">
            <h1 className="mb-4">
              Where’s your place located?
            </h1>
            <p className="mb-8">
              Your address is only shared with guests after they have made a confirmed reservation.
            </p>

            <div className="relative w-full max-w-xl">
              {/* Autocomplete Search Input Field */}
              <div className="sm:absolute relative sm:top-5 sm:left-1/2 sm:-translate-x-1/2 z-30 sm:w-[90%] bg-white/95 backdrop-blur-md sm:h-18 h-12 sm:rounded-[20px] rounded-[10px] border border-[#1F1F1F] shadow-lg px-4 sm:py-3 flex items-center">
                <div className="flex items-center gap-3">
                  <span className="sm:w-8 sm:h-8 rounded-full sm:border border-[#1F1F1F] shrink-0 flex justify-center items-center">
                    <svg className="w-4 h-5 text-[#727272]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Add your location"
                    value={searchQuery}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="w-full text-base font-normal text-[#1F1F1F] bg-transparent outline-none placeholder:text-[#1F1F1F] placeholder:opacity-50"
                  />
                  {isSearching && (
                    <span className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0" />
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {suggestions.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-zinc-100 max-h-60 overflow-y-auto text-left flex flex-col divide-y divide-zinc-100">
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(item)}
                        className="py-2.5 px-2 hover:bg-zinc-50 text-xs font-medium text-zinc-800 transition-colors flex items-center gap-2.5 rounded-lg cursor-pointer"
                      >
                        <span className="text-zinc-400">📍</span>
                        <span className="truncate">{item.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <RealMap
                address={streetAddress}
                city={city}
                country={country}
                lat={coords.lat}
                lng={coords.lng}
                showExactLocation={true}
                onLocationChange={onLocationChange}
                className="h-100 sm:h-112.5 w-full relative z-0 rounded-3xl overflow-hidden shadow-2xl border-2 border-[#1F1F1F] bg-white sm:mt-0 mt-3"
              />
            </div>
          </div>

          <StepProgressFooter currentStep={3} onBack={onBack} onNext={onNext} isLoading={isLoading} />
        </div>
      </Container>
    </main>
  );
}
