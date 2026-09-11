"use client";

import type { PlaceTypeOption } from "./types";

interface OnboardingPlaceTypeOptionProps {
  option: PlaceTypeOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/** A selectable place-access row used by the place type onboarding step. */
export function OnboardingPlaceTypeOption({
  option,
  isSelected,
  onSelect,
}: OnboardingPlaceTypeOptionProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      className={`flex items-start justify-between px-5 py-4 rounded-lg border transition-all text-left cursor-pointer group ${isSelected
        ? "border-[#1F1F1F] bg-[#E9EBFF] ring-1 ring-[#1F1F1F] shadow-sm"
        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60"
        }`}
    >
      <div className="flex items-start gap-4 pr-4">
        <div
          className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected
            ? "border-[#1F1F1F] text-[#1F1F1F]"
            : "border-[#1F1F1F] text-[#1F1F1F] group-hover:border-[#1F1F1F]"
            }`}
        >
          {option.icon}
        </div>

        <div>
          <h3 className="sm:text-lg text-sm sm:font-semibold font-normal text-[#1F1F1F] tracking-tight">
            {option.title}
          </h3>
          <p className="mt-1.5 sm:text-sm text-xs font-normal text-[#727272] leading-relaxed max-w-lg">
            {option.description}
          </p>
        </div>
      </div>

      <svg
        className={`w-5 h-5 shrink-0 mt-2 transition-colors ${isSelected ? "text-[#1F1F1F]" : "text-[#1D1D1D] group-hover:text-zinc-700"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
