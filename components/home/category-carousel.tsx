"use client";

import React, { useState, useRef } from "react";
import { PropertyCard, PropertyCardData } from "./property-card";

interface CategoryCarouselProps {
  title: string;
  cards: PropertyCardData[];
}

export function CategoryCarousel({ title, cards }: CategoryCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCount = 4; // 4 dots as per HTML spec

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : pageCount - 1));
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < pageCount - 1 ? prev + 1 : 0));
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  return (
    <section data-purpose="category-carousel">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900 tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous items"
            onClick={handlePrev}
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-black transition text-xs cursor-pointer"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <button
            type="button"
            aria-label="Next items"
            onClick={handleNext}
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-black transition text-xs cursor-pointer"
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* 6 Cards Grid */}
      <div
        ref={containerRef}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 no-scrollbar scroll-smooth"
      >
        {cards.map((card) => (
          <PropertyCard key={card.id} {...card} />
        ))}
      </div>

      {/* Carousel Pagination Indicator */}
      <div className="flex items-center justify-center gap-1.5 mt-6">
        {Array.from({ length: pageCount }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Go to page ${idx + 1}`}
            onClick={() => setActiveIndex(idx)}
            className={`transition-all duration-300 cursor-pointer ${
              idx === activeIndex
                ? "w-2.5 h-1.5 rounded-full bg-[#EAB308]"
                : "w-1.5 h-1.5 rounded-full bg-gray-300 hover:bg-gray-400"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
