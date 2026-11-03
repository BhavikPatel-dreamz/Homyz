"use client";

import React, { useState, useRef, useEffect } from "react";
import { RealMap, LocationDetails } from "@/components/ui/real-map";
import { LocationCoords } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { Container } from "@/components/ui";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";
import { useLanguage } from "@/lib/i18n/language-context";
import { reverseGeocodeLocation, parseNominatimAddress, type StructuredAddress } from "@/lib/location/geocoding";

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
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoSuccess, setGeoSuccess] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef<Map<string, NominatimSuggestion[]>>(new Map());
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { t } = useLanguage();

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const handleInputChange = (val: string) => {
    onSearchInputChange(val);
    setHighlightedIndex(-1);

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
            headers: { "User-Agent": "HomyzApp/1.0", "Accept-Language": "en" },
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
          setHighlightedIndex(-1);
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
    setHighlightedIndex(-1);
  };

  // Keyboard navigation for autocomplete suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSuggestionClick(suggestions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSuggestions([]);
      setHighlightedIndex(-1);
    }
  };

  // Geolocation detection handler
  const handleUseCurrentLocation = () => {
    if (isLocating || isLoading) return;

    if (typeof window === "undefined" || !navigator || !("geolocation" in navigator)) {
      setGeoError(
        t("host_geo_unsupported", "Geolocation is not supported by your browser.")
      );
      return;
    }

    setIsLocating(true);
    setGeoError(null);
    setGeoSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          // 1. Attempt reverse geocoding via centralized provider
          let structured: StructuredAddress | null = null;
          try {
            structured = await reverseGeocodeLocation(lat, lng);
          } catch {
            // Handled below via fallback
          }

          // 2. Direct fallback to OpenStreetMap Nominatim reverse API if needed
          if (!structured) {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                { headers: { "User-Agent": "HomyzApp/1.0", "Accept-Language": "en" } }
              );
              if (res.ok) {
                const data = await res.json();
                structured = parseNominatimAddress(data);
              }
            } catch {
              // Graceful degradation to coordinates below
            }
          }

          if (structured) {
            const details: LocationDetails = {
              address: structured.streetAddress,
              district: structured.district,
              city: structured.city,
              state: structured.state,
              postalCode: structured.postalCode,
              country: structured.country,
              countryCode: structured.countryCode,
              formattedAddress: structured.formattedAddress,
            };

            const displayLabel = structured.formattedAddress || structured.streetAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            onSearchInputChange(displayLabel);
            onLocationChange(lat, lng, details);

            onSelectSuggestion({
              display_name: displayLabel,
              lat: String(lat),
              lon: String(lng),
              address: {
                road: structured.streetAddress,
                neighbourhood: structured.district,
                city: structured.city,
                state: structured.state,
                postcode: structured.postalCode,
                country: structured.country,
                country_code: structured.countryCode?.toLowerCase() || "",
              },
            });
          } else {
            // Coordinate fallback ensures map still centers and pin updates
            const coordsText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            onSearchInputChange(coordsText);
            onLocationChange(lat, lng, { formattedAddress: coordsText });
          }

          setGeoSuccess(true);
          if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = setTimeout(() => {
            setGeoSuccess(false);
          }, 3500);
        } catch {
          setGeoError(
            t("host_geo_failed", "Unable to detect your address. Please enter it manually.")
          );
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError(
              t(
                "host_geo_permission_denied",
                "Location access was denied. Please search for your address manually or enable location permissions."
              )
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError(
              t(
                "host_geo_unavailable",
                "Unable to determine your current location. Please enter your address manually."
              )
            );
            break;
          case error.TIMEOUT:
            setGeoError(
              t(
                "host_geo_timeout",
                "Location request timed out. Please try again or search manually."
              )
            );
            break;
          default:
            setGeoError(
              t(
                "host_geo_unavailable",
                "Unable to determine your current location. Please enter your address manually."
              )
            );
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  return (
    <main className="pb-8 sm:pt-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          <OnboardingMobileCloseButton disabled={isLoading} />
          <div className="mx-auto flex w-full max-w-[760px] flex-col items-start text-left my-auto">
            <h1 data-aos="fade-up" className="mb-4">
              {t("host_location_title")}
            </h1>
            <p data-aos="fade-up" data-aos-delay="100" className="mb-8">
              {t("host_pin_confirm_desc")}
            </p>

            <div data-aos="fade-up" data-aos-delay="200" className="relative w-full">
              {/* Autocomplete Search Input Field & Location Action Bar */}
              <div className="relative z-30 flex min-h-12 sm:h-18 w-full items-center justify-between border border-[#1F1F1F] bg-white/95 px-3 sm:px-5 shadow-lg backdrop-blur-md sm:absolute sm:left-1/2 sm:top-5 sm:w-[calc(100%-3rem)] sm:-translate-x-1/2 sm:rounded-[20px] rounded-[12px] py-1.5 sm:py-3 gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full sm:border border-[#1F1F1F] shrink-0 flex justify-center items-center">
                    <svg className="w-4 h-4 sm:w-4 sm:h-5 text-[#727272]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="location-search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={t("host_search_location_placeholder")}
                    value={searchQuery}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-controls="location-suggestions"
                    aria-expanded={suggestions.length > 0}
                    aria-activedescendant={
                      highlightedIndex >= 0 ? `suggestion-option-${highlightedIndex}` : undefined
                    }
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="min-w-0 flex-1 text-sm sm:text-base font-normal text-[#1F1F1F] bg-transparent outline-none placeholder:text-[#1F1F1F] placeholder:opacity-50"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => handleInputChange("")}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200/80 hover:bg-zinc-300 text-zinc-600 hover:text-[#1F1F1F] text-xs transition-colors cursor-pointer"
                      aria-label={t("home_clear_search", "Clear search")}
                    >
                      ✕
                    </button>
                  )}
                  {isSearching && (
                    <span className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0" />
                  )}
                </div>

                {/* Divider between input & location button */}
                <div className="hidden xs:block h-6 sm:h-8 w-[1px] bg-zinc-200 shrink-0" />

                {/* Use my current location Button */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating || isLoading}
                  aria-label={t("host_use_current_location", "Use my current location")}
                  aria-busy={isLocating}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-zinc-200 bg-[#F9F9FB] hover:bg-zinc-100 active:scale-95 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium text-[#1F1F1F] shadow-2xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1F1F1F]"
                >
                  {isLocating ? (
                    <>
                      <span className="size-3.5 sm:size-4 rounded-full border-2 border-[#1F1F1F] border-t-transparent animate-spin shrink-0" />
                      <span className="hidden sm:inline whitespace-nowrap">{t("host_detecting_location", "Detecting your location...")}</span>
                      <span className="sm:hidden whitespace-nowrap">{t("host_detecting_short", "Locating...")}</span>
                    </>
                  ) : geoSuccess ? (
                    <>
                      <svg className="size-3.5 sm:size-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-emerald-700 font-medium whitespace-nowrap">{t("host_location_detected", "Location detected")}</span>
                    </>
                  ) : (
                    <>
                      <svg className="size-3.5 sm:size-4 text-[#1F1F1F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="7" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                      </svg>
                      <span className="hidden xs:inline whitespace-nowrap">{t("host_use_current_location", "Use my current location")}</span>
                    </>
                  )}
                </button>

                {/* Suggestions Dropdown */}
                {suggestions.length > 0 && (
                  <div
                    id="location-suggestions"
                    role="listbox"
                    className="absolute top-full left-0 right-0 z-40 mt-2 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 text-left shadow-xl"
                  >
                    {suggestions.map((item, idx) => {
                      const isHighlighted = highlightedIndex === idx;
                      return (
                        <button
                          key={idx}
                          id={`suggestion-option-${idx}`}
                          type="button"
                          role="option"
                          aria-selected={isHighlighted}
                          onClick={() => handleSuggestionClick(item)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            isHighlighted ? "bg-zinc-100 text-[#1F1F1F]" : "text-zinc-800 hover:bg-zinc-50"
                          }`}
                        >
                          <span className="text-[#727272] shrink-0">📍</span>
                          <span className="truncate">{item.display_name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Dismissible Geolocation Alert */}
                {geoError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="absolute top-full left-0 right-0 z-50 mt-2 flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/95 backdrop-blur-sm p-3 sm:p-4 text-xs sm:text-sm font-medium text-rose-800 shadow-xl animate-in fade-in slide-in-from-top-1"
                  >
                    <div className="flex items-start gap-2.5">
                      <svg className="size-4 sm:size-5 shrink-0 text-rose-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                      </svg>
                      <span className="leading-snug">{geoError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGeoError(null)}
                      className="shrink-0 text-rose-600 hover:text-rose-800 p-1 rounded-full hover:bg-rose-100 transition-colors cursor-pointer"
                      aria-label={t("common_dismiss", "Dismiss")}
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
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
                zoomControlsPlacement="below-top-overlay"
                className="relative z-0 mt-3 h-[380px] w-full overflow-hidden rounded-3xl border-2 border-[#1F1F1F] bg-white shadow-2xl sm:mt-0 sm:h-[500px] lg:h-[560px]"
              />
            </div>
          </div>

          <StepProgressFooter currentStep={3} onBack={onBack} onNext={onNext} isLoading={isLoading} />
        </div>
      </Container>
    </main>
  );
}
