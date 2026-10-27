"use client";

import React, { useRef } from "react";
import Image from "next/image";
import type { CountryHighlightDTO } from "@/types/travel";

interface TravelCountryCarouselProps {
  highlights: CountryHighlightDTO[];
  onSelectCountry?: (country: string) => void;
}

export function TravelCountryCarousel({
  highlights,
  onSelectCountry,
}: TravelCountryCarouselProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Highlights are derived only from saved memories and verified stays. Do not
  // show sample countries: they make an empty profile look like it has travel data.
  const displayItems = highlights;

  if (displayItems.length === 0) {
    return (
      <section className="my-8 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-6 text-center">
        <p className="text-sm font-semibold text-zinc-800">
          Your destinations will appear here
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Add a location to a travel memory or complete a Homyz stay to build
          your travel map.
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
      {displayItems.length > 1 && (
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 size-7 sm:size-8 rounded-full bg-white/90 hover:bg-white text-zinc-700 shadow-md border border-zinc-200 flex items-center justify-center transition cursor-pointer"
        >
          ‹
        </button>
      )}

      {/* Horizontal List */}
      <div
        ref={scrollRef}
        className="flex items-center justify-start sm:justify-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar scroll-smooth py-2 px-6"
      >
        {displayItems.map((item) => {
          return (
            <button
              key={item.country}
              type="button"
              onClick={() => onSelectCountry?.(item.country)}
              aria-label={`Open ${item.country} travel story`}
              className="flex flex-col items-center shrink-0 group cursor-pointer focus:outline-none transition transform hover:scale-105"
            >
              {/* Circular Highlight with Gradient Ring Border (Screenshot 1) */}
              <div className="relative rounded-full bg-gradient-to-tr from-yellow-400 via-rose-500 to-red-500 p-0.5 shadow-2xs opacity-90 transition group-hover:opacity-100 sm:p-1">
                <div className="relative size-16 sm:size-20 md:size-24 rounded-full overflow-hidden bg-zinc-200 border-2 border-white">
                  {item.coverUrl ? (
                    <Image
                      src={item.coverUrl}
                      alt={item.country}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 64px, 96px"
                    />
                  ) : (
                    <span
                      className="flex size-full items-center justify-center bg-zinc-100 text-2xl"
                      aria-hidden="true"
                    >
                      ✈️
                    </span>
                  )}
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
                title={item.country}
                className="mt-2 max-w-[90px] truncate text-center text-xs font-medium text-zinc-800 transition sm:text-sm"
              >
                {item.country}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      {displayItems.length > 1 && (
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 size-7 sm:size-8 rounded-full bg-white/90 hover:bg-white text-zinc-700 shadow-md border border-zinc-200 flex items-center justify-center transition cursor-pointer"
        >
          ›
        </button>
      )}
    </div>
  );
}
