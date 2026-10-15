"use client";

import type { KeyboardEvent } from "react";

export const DEFAULT_RATING_LABELS = [
  "",
  "Needs improvement",
  "Not great",
  "Good",
  "Great stay",
  "Excellent",
];

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
  const description = value >= 1 && value <= 5 ? ratingLabels[value] : null;

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
    <div className="mt-8" role="radiogroup" aria-label={label}>
      <div className="flex justify-center gap-2 sm:gap-3">
        {[1, 2, 3, 4, 5].map((star) => {
          const isSelected = value === star;
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
              onKeyDown={(e) => handleKeyDown(e, star)}
              className={`text-4xl leading-none transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 sm:text-5xl ${
                star <= value ? "text-[#4D7CFE]" : "text-zinc-200"
              }`}
            >
              ★
            </button>
          );
        })}
      </div>
      <p className="mt-3 min-h-5 text-center text-sm font-medium text-zinc-600" aria-live="polite">
        {description || "Select a rating"}
      </p>
    </div>
  );
}
