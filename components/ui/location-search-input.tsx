"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import { searchLocations, StructuredLocation, POPULAR_GLOBAL_DESTINATIONS } from "@/lib/location/geocoding";

type LocationSearchInputProps = {
  value: string;
  onChange: (val: string, locationData?: StructuredLocation) => void;
  disabled?: boolean;
};

export function LocationSearchInput({
  value = "",
  onChange,
  disabled = false,
}: LocationSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<StructuredLocation[]>(POPULAR_GLOBAL_DESTINATIONS);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Place Search
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchLocations(value);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [value, isOpen]);

  const handleSelect = (dest: StructuredLocation) => {
    onChange(dest.formattedAddress, dest);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <label htmlFor={inputId} className="block text-xs font-bold text-zinc-900 mb-1.5">
        Location
      </label>

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm pointer-events-none">
          📍
        </span>

        <input
          id={inputId}
          type="text"
          disabled={disabled}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search a place... (e.g. Paris, France)"
          className={`w-full pl-9 pr-9 py-2.5 rounded-2xl border bg-white text-xs text-zinc-900 placeholder-zinc-400 transition-all shadow-2xs ${
            isOpen ? "border-amber-400 ring-2 ring-amber-400/20" : "border-zinc-200 hover:border-zinc-300"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(true);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 text-[11px] flex items-center justify-center transition-colors cursor-pointer"
            title="Clear location"
          >
            ✕
          </button>
        )}
      </div>

      {/* Location Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto rounded-2xl bg-white border border-zinc-200 shadow-xl py-1.5 animate-in fade-in">
          {loading ? (
            <div className="px-4 py-3 text-xs text-zinc-500 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" />
              </svg>
              <span>Searching places...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-zinc-400 italic text-center">
              No places found
            </div>
          ) : (
            suggestions.map((dest, index) => {
              const isActive = index === activeIndex;
              const isSelected = dest.formattedAddress.toLowerCase() === value.toLowerCase();

              return (
                <div
                  key={`${dest.formattedAddress}-${index}`}
                  onClick={() => handleSelect(dest)}
                  className={`px-3.5 py-2 flex items-center gap-2.5 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-amber-100 text-amber-900 font-bold"
                      : isActive
                      ? "bg-amber-50 text-zinc-900 font-medium"
                      : "hover:bg-zinc-50 text-zinc-800"
                  }`}
                >
                  <span className="text-zinc-400 text-xs shrink-0">📍</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-zinc-900 truncate">{dest.locationName}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{dest.formattedAddress}</p>
                  </div>
                  {dest.countryCode && (
                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
                      {dest.countryCode}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
