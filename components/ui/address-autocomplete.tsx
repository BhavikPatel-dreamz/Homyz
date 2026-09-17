"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  searchAddressAutocomplete,
  type StructuredAddress,
} from "@/lib/location/geocoding";

export interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: StructuredAddress) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  onClear?: () => void;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search for a street address, landmark, or city...",
  disabled = false,
  className = "",
  inputClassName = "",
  onClear,
}: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<StructuredAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSelectingRef = useRef(false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchAddressAutocomplete(trimmed, 6);
      setSuggestions(results);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!newVal.trim() || newVal.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(newVal);
    }, 350);
  };

  const handleSelect = (item: StructuredAddress) => {
    isSelectingRef.current = true;
    onSelect(item);
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    onChange("");
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    if (onClear) {
      onClear();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center w-full">
        {/* Search Icon */}
        <div className="absolute left-3.5 flex items-center pointer-events-none text-zinc-400">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>

        {/* Text Input */}
        <input
          type="text"
          name="address-search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls="address-autocomplete-listbox"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
          className={`w-full pl-10 pr-16 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 focus:border-zinc-900 dark:focus:border-zinc-500 transition-all ${
            disabled ? "opacity-60 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900" : ""
          } ${inputClassName}`}
        />

        {/* Right side controls (Spinner & Clear button) */}
        <div className="absolute right-3 flex items-center gap-1.5">
          {isLoading && (
            <span
              className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0"
              aria-label="Searching locations..."
            />
          )}

          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="w-5 h-5 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Clear search"
              aria-label="Clear location search"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && (
        <div
          id="address-autocomplete-listbox"
          role="listbox"
          className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {suggestions.length > 0 ? (
            suggestions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const primaryText =
                item.streetAddress ||
                item.city ||
                item.formattedAddress.split(",")[0];
              const secondaryText = item.formattedAddress.includes(",")
                ? item.formattedAddress
                    .substring(item.formattedAddress.indexOf(",") + 1)
                    .trim()
                : [item.district, item.city, item.state, item.country]
                    .filter(Boolean)
                    .join(", ");

              return (
                <button
                  key={`${item.latitude}-${item.longitude}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0 mt-0.5">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {primaryText}
                    </p>
                    {secondaryText && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {secondaryText}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            !isLoading && (
              <div className="px-3 py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                No matching locations found. Try searching by city, district, or
                coordinates.
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

