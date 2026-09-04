"use client";

import React, { useState } from "react";
import { RealMap } from "@/components/ui/real-map";
import { LocationCoords } from "./types";
import { StepProgressFooter } from "./step-progress-footer";

interface StepLocationSearchProps {
  streetAddress: string;
  city: string;
  country: string;
  coords: LocationCoords;
  searchQuery: string;
  onSearchInputChange: (val: string) => void;
  onSelectSuggestion: (item: any) => void;
  onLocationChange: (lat: number, lng: number, details?: any) => void;
  onBack: () => void;
  onNext: () => void;
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
}: StepLocationSearchProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const handleInputChange = async (val: string) => {
    onSearchInputChange(val);
    if (!val || val.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&addressdetails=1&limit=5`,
        { headers: { "User-Agent": "HomyzApp/1.0" } }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuggestions(data);
      }
    } catch (err) {
      // Ignore search errors
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestionClick = (item: any) => {
    onSelectSuggestion(item);
    setSuggestions([]);
  };

  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-3xl mx-auto w-full flex flex-col items-center text-center my-auto">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-4">
          Where’s your place located?
        </h1>
        <p className="text-sm sm:text-base font-medium text-zinc-500 max-w-xl leading-relaxed mb-8">
          Lorem ipsum non diam posuere malesuada nisl urna pharetra feugiat nisi a amet at pretium nam ac magna fermentum in.
        </p>

        <div className="relative w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-zinc-200/90 bg-white">
          {/* Autocomplete Search Input Field */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 w-[90%] bg-white/95 backdrop-blur-md rounded-2xl border border-zinc-300 shadow-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <input
                type="text"
                placeholder="Add your location"
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full text-sm font-semibold text-zinc-900 bg-transparent outline-none placeholder:text-zinc-400"
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
            className="h-[400px] sm:h-[450px] w-full relative z-0"
          />
        </div>
      </div>

      <StepProgressFooter currentStep={3} onBack={onBack} onNext={onNext} />
    </main>
  );
}
