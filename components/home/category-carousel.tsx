"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PropertyCard, PropertyCardData } from "./property-card";
import { SeeAllCard } from "./see-all-card";
import { useLanguage } from "@/lib/i18n/language-context";

interface HomePropertySectionProps {
  title: string;
  cards: PropertyCardData[];
  seeAllHref?: string;
  previewImages?: string[];
  totalCount?: number;
}

export function getTranslatedSectionTitle(title: string, t: (key: any, params?: any) => string): string {
  if (!title) return title;
  const lower = title.trim().toLowerCase();

  try {
    if (lower === "featured stays") {
      return t("home_section_featured_stays");
    }
    if (lower === "available this weekend") {
      return t("home_section_available_weekend");
    }
    if (lower === "available this month") {
      return t("home_section_available_this_month");
    }
    if (lower.startsWith("available this month in ")) {
      const city = title.trim().substring("available this month in ".length).trim();
      return t("home_section_available_this_month_in", { city });
    }
    if (lower === "available next month") {
      return t("home_section_available_next_month");
    }
    if (lower.startsWith("available next month in ")) {
      const city = title.trim().substring("available next month in ".length).trim();
      return t("home_section_available_next_month_in", { city });
    }
    if (lower.startsWith("explore stays in ")) {
      const city = title.trim().substring("explore stays in ".length).trim();
      return t("home_section_explore_stays_in", { city });
    }
    if (lower === "trending stays") {
      return t("home_section_trending_stays");
    }
    if (lower === "recommended stays") {
      return t("home_section_recommended_stays");
    }
    if (lower === "popular homes") {
      return t("home_section_popular_homes");
    }
    if (lower.startsWith("popular homes in ")) {
      const location = title.trim().substring("popular homes in ".length).trim();
      return t("home_section_popular_homes_in", { location });
    }
    if (lower.startsWith("homes in ")) {
      const location = title.trim().substring("homes in ".length).trim();
      return t("home_section_homes_in", { location });
    }
    if (lower.startsWith("homes near ")) {
      const location = title.trim().substring("homes near ".length).trim();
      return t("home_section_homes_near", { location });
    }
    if (lower.startsWith("stays in ")) {
      const location = title.trim().substring("stays in ".length).trim();
      return t("home_section_stays_in", { location });
    }
    if (lower.startsWith("stays near ")) {
      const location = title.trim().substring("stays near ".length).trim();
      return t("home_section_stays_near", { location });
    }
  } catch {
    return title;
  }

  return title;
}

export function HomePropertySection({
  title,
  cards,
  seeAllHref,
  previewImages,
  totalCount,
}: HomePropertySectionProps) {
  const { t } = useLanguage();
  const displayTitle = getTranslatedSectionTitle(title, t);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageCount, setPageCount] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);

  // Each listing is shown once. Repeating cards makes a short discovery
  // section look like it contains duplicate properties.
  const displayCards = cards;

  const getSlideStep = useCallback(() => {
    const track = containerRef.current;
    const firstCard = track?.firstElementChild as HTMLElement | null;

    if (!track || !firstCard) return 260;

    const styles = window.getComputedStyle(track);
    return firstCard.offsetWidth + Number.parseFloat(styles.columnGap || "16");
  }, []);

  const updateCarouselState = useCallback(() => {
    const track = containerRef.current;
    const slideStep = getSlideStep();

    if (!track || !slideStep) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const count = Math.max(1, Math.round(maxScroll / slideStep) + 1);
    const nextIndex = Math.min(
      count - 1,
      Math.max(0, Math.round(track.scrollLeft / slideStep)),
    );

    const visibleDots = Math.min(count, 6);
    setPageCount(visibleDots);
    setActiveIndex(Math.min(nextIndex, visibleDots - 1));
  }, [getSlideStep]);

  useEffect(() => {
    const track = containerRef.current;
    if (!track) return;

    updateCarouselState();
    const resizeObserver = new ResizeObserver(updateCarouselState);
    resizeObserver.observe(track);

    return () => resizeObserver.disconnect();
  }, [displayCards.length, Boolean(seeAllHref), updateCarouselState]);

  const goToPage = (index: number) => {
    const track = containerRef.current;
    const slideStep = getSlideStep();
    if (!track || !slideStep) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    track.scrollTo({
      left: Math.min(index * slideStep, maxScroll),
      behavior: "smooth",
    });
    setActiveIndex(index);
  };

  const handlePrev = () => {
    const track = containerRef.current;
    const slideStep = getSlideStep();
    if (!track || !slideStep) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    if (maxScroll <= 0) return;

    if (track.scrollLeft <= 15) {
      track.scrollTo({ left: maxScroll, behavior: "smooth" });
    } else {
      track.scrollBy({ left: -slideStep, behavior: "smooth" });
    }
  };

  const handleNext = () => {
    const track = containerRef.current;
    const slideStep = getSlideStep();
    if (!track || !slideStep) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    if (maxScroll <= 0) return;

    if (track.scrollLeft >= maxScroll - 15) {
      track.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      track.scrollBy({ left: slideStep, behavior: "smooth" });
    }
  };

  return (
    <section data-purpose="category-carousel">
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] sm:text-[22px] font-medium leading-7 sm:leading-8 tracking-[-.35px] text-[#1f1f1f]">
            {displayTitle}
          </h2>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="hidden sm:inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#0052cc] hover:text-[#003b95] hover:underline transition-colors ml-1"
            >
              <span>{t("home_see_all")}</span>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </div>
        <div className="hidden sm:flex w-[112px] shrink-0 items-center justify-end gap-3">
          <button
            type="button"
            aria-label="Previous items"
            onClick={handlePrev}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#727272] bg-white text-[#1f1f1f] transition-[width,background-color] duration-200 hover:w-[60px] hover:bg-[#f3f4f5] focus-visible:w-[60px] focus-visible:bg-[#f3f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1f] focus-visible:ring-offset-2 active:w-[60px]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
            >
              <path
                d="m15 18-6-6 6-6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next items"
            onClick={handleNext}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#727272] bg-white text-[#1f1f1f] transition-[width,background-color] duration-200 hover:w-[60px] hover:bg-[#f3f4f5] focus-visible:w-[60px] focus-visible:bg-[#f3f4f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1f] focus-visible:ring-offset-2 active:w-[60px]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
            >
              <path
                d="m9 18 6-6-6-6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Horizontally scrollable, snap-aligned card track */}
      <div
        ref={containerRef}
        onScroll={updateCarouselState}
        className="no-scrollbar grid snap-x snap-mandatory grid-flow-col gap-3 overflow-x-auto overscroll-x-contain auto-cols-[calc((100%-0.75rem)/2.16)] sm:gap-4 sm:auto-cols-[calc((100%-2rem)/3)] md:gap-4 md:auto-cols-[calc((100%-2rem)/3)] lg:gap-4 lg:auto-cols-[calc((100%-3rem)/4)] xl:gap-5 xl:auto-cols-[calc((100%-5rem)/5)] 2xl:gap-6 2xl:auto-cols-[calc((100%-7.5rem)/6)]"
      >
        {displayCards.map((card) => (
          <div key={card.id} className="min-w-0 snap-start">
            <PropertyCard {...card} />
          </div>
        ))}
        {seeAllHref && (
          <div className="min-w-0 snap-start">
            <SeeAllCard
              href={seeAllHref}
              previewImages={previewImages}
              title={title}
              totalCount={totalCount}
            />
          </div>
        )}
      </div>

      {/* Carousel Pagination Indicator */}
      {pageCount > 1 && (
        <div className="mt-7 flex items-center justify-center gap-2">
          {Array.from({ length: pageCount }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to page ${idx + 1}`}
              aria-current={idx === activeIndex ? "true" : undefined}
              onClick={() => goToPage(idx)}
              className={`cursor-pointer transition-all duration-300 ${
                idx === activeIndex
                  ? "h-7 w-2 rounded-full bg-[#eba900]"
                  : "h-5 w-2 rounded-full bg-[#ddddde] hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// Kept as an alias for existing imports while homepage sections use the
// domain-oriented name above.
export const CategoryCarousel = HomePropertySection;
