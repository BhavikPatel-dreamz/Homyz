"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface HorizontalTabSliderProps {
  children: React.ReactNode;
  className?: string;
}

export function HorizontalTabSlider({ children, className = "" }: HorizontalTabSliderProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    checkScroll();

    const resizeObserver = new ResizeObserver(() => checkScroll());
    resizeObserver.observe(el);

    el.addEventListener("scroll", checkScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = direction === "left" ? -280 : 280;
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  return (
    <div className={`relative flex items-center w-full group ${className}`}>
      {/* Left Slider Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll("left")}
          className="absolute left-0 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-muted-foreground shadow-md hover:bg-[var(--surface-secondary)] hover:scale-110 active:scale-95 transition-all -translate-x-1 sm:-translate-x-2 cursor-pointer shrink-0"
          aria-label="Scroll options left"
          title="Scroll left"
        >
          <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Scrollable Content Container */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth w-full py-0.5"
      >
        {children}
      </div>

      {/* Right Slider Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScroll("right")}
          className="absolute right-0 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-muted-foreground shadow-md hover:bg-[var(--surface-secondary)] hover:scale-110 active:scale-95 transition-all translate-x-1 sm:translate-x-2 cursor-pointer shrink-0"
          aria-label="Scroll options right"
          title="Scroll right"
        >
          <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
