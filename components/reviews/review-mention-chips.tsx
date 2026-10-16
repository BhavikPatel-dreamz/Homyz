"use client";

import { useRef, useState, useEffect } from "react";
import type { ReviewMention } from "@/services/review.service";
import { ReviewIcon, getMentionIconName } from "./review-icon";

interface ReviewMentionChipsProps {
  mentions: ReviewMention[];
  selectedMention?: string | null;
  onSelectMention?: (topic: string | null) => void;
  className?: string;
}

export function ReviewMentionChips({
  mentions,
  selectedMention,
  onSelectMention,
  className = "",
}: ReviewMentionChipsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [mentions]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = 240;
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  if (!mentions || mentions.length === 0) return null;

  return (
    <div className={`relative flex items-center ${className}`} aria-label="Guest mentions">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scroll mentions left"
          className="absolute left-0 z-10 flex size-8 -translate-x-2 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-md transition-transform hover:scale-105"
        >
          <ReviewIcon name="chevronLeft" className="size-4 text-zinc-700" />
        </button>
      )}

      <div
        ref={scrollContainerRef}
        className="flex w-full items-center gap-2.5 overflow-x-auto py-1 scrollbar-none"
      >
        {mentions.map((item) => {
          const isSelected = selectedMention?.toLowerCase() === item.topic.toLowerCase();
          const iconName = getMentionIconName(item.topic);

          return (
            <button
              key={item.topic}
              type="button"
              onClick={() => onSelectMention?.(isSelected ? null : item.topic)}
              aria-pressed={isSelected}
              className={`group inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                isSelected
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-[#1f1f1f] hover:border-zinc-900 hover:bg-zinc-50"
              }`}
            >
              <ReviewIcon
                name={iconName}
                className={`size-4 ${
                  isSelected ? "text-white" : "text-zinc-700 group-hover:text-zinc-900"
                }`}
              />
              <span>{item.topic}</span>
              <span
                className={`text-xs ${
                  isSelected ? "text-zinc-300" : "text-zinc-500"
                }`}
              >
                ({item.count})
              </span>
              {isSelected && (
                <ReviewIcon name="close" className="ml-0.5 size-3 text-white" />
              )}
            </button>
          );
        })}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scroll mentions right"
          className="absolute right-0 z-10 flex size-8 translate-x-2 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-md transition-transform hover:scale-105"
        >
          <ReviewIcon name="chevronRight" className="size-4 text-zinc-700" />
        </button>
      )}
    </div>
  );
}

