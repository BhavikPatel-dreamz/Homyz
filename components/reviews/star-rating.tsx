"use client";

import { useState, type KeyboardEvent } from "react";

export const DEFAULT_RATING_LABELS = [
  "",
  "Needs improvement",
  "Not great",
  "Good",
  "Great stay",
  "Excellent",
];

const STAR_SVG_PATH =
  "M14.2671 1.52064C14.9257 -0.506139 17.793 -0.506142 18.4517 1.52064L20.8052 8.76303C21.0997 9.66941 21.9444 10.2831 22.8974 10.2831L30.5126 10.2834C32.6437 10.2835 33.5298 13.0105 31.8057 14.2632L25.645 18.7395C24.874 19.2997 24.5514 20.2927 24.8459 21.1991L27.1988 28.4416C27.8573 30.4685 25.5376 32.1539 23.8134 30.9013L17.6524 26.4254C16.8814 25.8653 15.8374 25.8653 15.0663 26.4254L8.90532 30.9013C7.18117 32.1539 4.86144 30.4685 5.51991 28.4416L7.87286 21.1991C8.16733 20.2927 7.84471 19.2997 7.07371 18.7395L0.913054 14.2632C-0.811 13.0105 0.0750575 10.2835 2.20616 10.2834L9.82136 10.2831C10.7744 10.2831 11.619 9.66941 11.9136 8.76303L14.2671 1.52064Z";

export function StarRating({
  value,
  onChange,
  label,
  ratingLabels = DEFAULT_RATING_LABELS,
}: {
  value: number;
  onChange: (rating: number) => void;
  label: string;
  ratingLabels?: readonly string[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const activeRating = hovered ?? value;
  const description = activeRating >= 1 && activeRating <= 5 ? ratingLabels[activeRating] : null;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, star: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(5, (value || star) + 1);
      onChange(next);
      const nextBtn = event.currentTarget.parentElement?.children[next - 1] as HTMLElement | undefined;
      nextBtn?.focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      const prev = Math.max(1, (value || star) - 1);
      onChange(prev);
      const prevBtn = event.currentTarget.parentElement?.children[prev - 1] as HTMLElement | undefined;
      prevBtn?.focus();
    } else if (["1", "2", "3", "4", "5"].includes(event.key)) {
      event.preventDefault();
      const num = Number(event.key);
      onChange(num);
      const targetBtn = event.currentTarget.parentElement?.children[num - 1] as HTMLElement | undefined;
      targetBtn?.focus();
    }
  };

  return (
    <div className="md:mt-12 mt-8 flex flex-col items-start sm:items-center" role="radiogroup" aria-label={label}>
      <div className="flex flex-col items-start">
        <div
          className="flex items-center gap-4 sm:gap-5"
          onMouseLeave={() => setHovered(null)}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const isSelected = value === star;
            const isFilled = star <= activeRating;
            const starLabel = ratingLabels[star];
            return (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${star} out of 5 stars${starLabel ? `: ${starLabel}` : ""}`}
                tabIndex={isSelected || (value === 0 && star === 1) ? 0 : -1}
                onClick={() => onChange(star)}
                onMouseEnter={() => setHovered(star)}
                onKeyDown={(e) => handleKeyDown(e, star)}
                className="transition-transform duration-150 hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              >
                <svg
                  className="size-8 sm:size-[33px]"
                  viewBox="0 0 33 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d={STAR_SVG_PATH}
                    fill={isFilled ? "#4A6FFF" : "#DDDDDE"}
                  />
                </svg>
              </button>
            );
          })}
        </div>
        <p className="mt-3.5 min-h-5 text-left text-sm font-normal text-[#1F1F1F]" aria-live="polite">
          {description || "\u00A0"}
        </p>
      </div>
    </div>
  );
}
