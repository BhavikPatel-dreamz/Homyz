"use client";

import React, { useRef, useState, useEffect } from "react";
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
  const [failedCoverCountries, setFailedCoverCountries] = useState<Set<string>>(
    new Set(),
  );
  const [isSliderMade, setIsSliderMade] = useState(false);

  // Highlights are derived only from saved memories and verified stays. Do not
  // show sample countries: they make an empty profile look like it has travel data.
  const displayItems = highlights;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const checkSlider = () => {
      // A slider is made when the content width overflows the container
      setIsSliderMade(el.scrollWidth > el.clientWidth + 4);
    };

    checkSlider();

    const resizeObserver = new ResizeObserver(() => {
      checkSlider();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [displayItems]);

  if (displayItems.length === 0) {
    return (
      <section className="my-8 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-6 text-center">
        <p className="text-sm font-medium text-zinc-800">
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
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    const offset = direction === "left" ? -280 : 280;

    if (direction === "left" && scrollLeft <= 10) {
      el.scrollTo({ left: maxScroll, behavior: "smooth" });
    } else if (direction === "right" && scrollLeft >= maxScroll - 10) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="relative my-4 sm:my-6 px-0 sm:px-10">
      {/* Scroll Left Button - only visible on sm+ when slider is made */}
      {isSliderMade && (
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 size-7 sm:size-8 rounded-full bg-[#FEE9B5] hover:bg-[#FDD888] text-[#1F1F1F] items-center justify-center shadow-xs transition cursor-pointer border border-[#1f1f1f]"
        >
          <svg className="size-3.5 sm:size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Horizontal List */}
      <div
        ref={scrollRef}
        className={`flex items-center gap-4 sm:gap-7 overflow-x-auto no-scrollbar scroll-smooth py-2 pr-10 sm:px-0 ${
          isSliderMade ? "justify-start" : "justify-start sm:justify-center"
        }`}
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
              {/* Circular Highlight with Gradient Ring Border (Figma matching) */}
              <div className="relative rounded-full bg-gradient-to-tr from-yellow-400 via-rose-500 to-red-500 p-[2.5px] sm:p-[4px] shadow-2xs opacity-95 transition group-hover:opacity-100">
                <div className="relative size-23.25 sm:size-22 md:size-40 rounded-full overflow-hidden bg-zinc-100 border-2 sm:border-[5px] border-white">
                  <Image
                    src={
                      !item.coverUrl || failedCoverCountries.has(item.country)
                        ? "/images/auth-traveler-water.jpg"
                        : item.coverUrl
                    }
                    alt={item.country}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 72px, 96px"
                    onError={() => {
                      setFailedCoverCountries((prev) =>
                        new Set(prev).add(item.country),
                      );
                    }}
                  />
                </div>
              </div>
              <span
                title={item.country}
                className="mt-2.5 max-w-[96px] truncate text-center text-base sm:text-xl font-normal sm:font-medium text-[#1F1F1F] transition-all duration-300"
              >
                {item.country}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button - only visible when slider is made */}
      {isSliderMade && (
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 size-7 sm:size-8 rounded-full bg-[#FEE9B5] hover:bg-[#FDD888] text-[#1F1F1F] items-center justify-center shadow-xs transition cursor-pointer border border-[#1f1f1f]"
        >
          <svg className="size-3.5 sm:size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
