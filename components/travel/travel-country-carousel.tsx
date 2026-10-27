"use client";

import React, { useRef } from "react";
import Image from "next/image";
import type { CountryHighlightDTO } from "@/types/travel";

interface TravelCountryCarouselProps {
  highlights: CountryHighlightDTO[];
  selectedCountry?: string | null;
  onSelectCountry?: (country: string | null) => void;
}

export function TravelCountryCarousel({
  highlights,
  selectedCountry,
  onSelectCountry,
}: TravelCountryCarouselProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Highlights are derived only from saved memories and verified stays. Do not
  // show sample countries: they make an empty profile look like it has travel data.
  const displayItems = highlights;

  if (displayItems.length === 0) {
    return (
      <section className="my-8 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-6 text-center">
        <p className="text-sm font-semibold text-zinc-800">Your destinations will appear here</p>
        <p className="mt-1 text-xs text-zinc-500">
          Add a location to a travel memory or complete a Homyz stay to build your travel map.
        </p>
      </section>
    );
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const offset = direction === "left" ? -240 : 240;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="relative my-6 px-4 sm:px-8">
      {/* Scroll Left Button */}
      <button
        type="button"
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 size-7 sm:size-8 rounded-full bg-white/90 hover:bg-white text-zinc-700 shadow-md border border-zinc-200 flex items-center justify-center transition cursor-pointer"
      >
        ‹
      </button>

      {/* Horizontal List */}
      <div
        ref={scrollRef}
        className="flex items-center justify-start sm:justify-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar scroll-smooth py-2 px-6"
      >
        {displayItems.map((item) => {
          const isSelected = selectedCountry === item.country;
          return (
            <button
              key={item.country}
              type="button"
              onClick={() => onSelectCountry?.(isSelected ? null : item.country)}
              className="flex flex-col items-center shrink-0 group cursor-pointer focus:outline-none transition transform hover:scale-105"
            >
              {/* Circular Highlight with Gradient Ring Border (Screenshot 1) */}
              <div
                className={`relative p-0.5 sm:p-1 rounded-full transition shadow-2xs ${
                  isSelected
                    ? "bg-gradient-to-tr from-amber-500 via-rose-600 to-red-600 ring-2 ring-amber-400 scale-105"
                    : "bg-gradient-to-tr from-yellow-400 via-rose-500 to-red-500 opacity-90 group-hover:opacity-100"
                }`}
              >
                <div className="relative size-16 sm:size-20 md:size-24 rounded-full overflow-hidden bg-zinc-200 border-2 border-white">
                  <Image
                    src={item.coverUrl || "/images/auth-traveler-water.jpg"}
                    alt={item.country}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 64px, 96px"
                  />
                </div>

                {/* Verified Destination Badge Indicator */}
                {item.isVerified && (
                  <span
                    title="Verified Destination (Completed Homyz Stay)"
                    className="absolute bottom-0 right-0 z-10 size-5 sm:size-6 rounded-full bg-blue-600 border-2 border-white text-white flex items-center justify-center text-[10px] sm:text-xs font-bold shadow"
                  >
                    ✓
                  </span>
                )}
              </div>
              <span
                className={`text-xs sm:text-sm font-medium mt-2 truncate max-w-[90px] text-center transition ${
                  isSelected ? "text-amber-900 font-bold underline" : "text-zinc-800"
                }`}
              >
                {item.country}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        type="button"
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 size-7 sm:size-8 rounded-full bg-white/90 hover:bg-white text-zinc-700 shadow-md border border-zinc-200 flex items-center justify-center transition cursor-pointer"
      >
        ›
      </button>

      {/* Filter Active Reset Bar */}
      {selectedCountry && (
        <div className="flex items-center justify-center gap-2 mt-3 animate-in fade-in">
          <span className="text-xs text-zinc-600">
            Showing memories in <strong>{selectedCountry}</strong>
          </span>
          <button
            type="button"
            onClick={() => onSelectCountry?.(null)}
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 underline cursor-pointer"
          >
            Show All
          </button>
        </div>
      )}
    </div>
  );
}
