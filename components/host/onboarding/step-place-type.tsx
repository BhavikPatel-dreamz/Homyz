"use client";

import React from "react";
import { PlaceTypeOption } from "./types";
import { StepProgressFooter } from "./step-progress-footer";

interface StepPlaceTypeProps {
  placeTypes: PlaceTypeOption[];
  selectedPlaceType: string;
  onSelectPlaceType: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepPlaceType({
  placeTypes,
  selectedPlaceType,
  onSelectPlaceType,
  onBack,
  onNext,
  isLoading = false,
}: StepPlaceTypeProps) {
  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-2xl mx-auto w-full flex flex-col items-center my-auto">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1F1F1F] tracking-tight text-center leading-tight mb-10">
          What type of place will guests have?
        </h1>

        <div className="flex flex-col gap-4 w-full">
          {placeTypes.map((pt) => {
            const isSelected = selectedPlaceType === pt.id;
            return (
              <button
                key={pt.id}
                type="button"
                onClick={() => onSelectPlaceType(pt.id)}
                className={`flex items-start justify-between p-6 sm:p-7 rounded-3xl border transition-all text-left cursor-pointer group ${
                  isSelected
                    ? "border-indigo-400 bg-[#EEF2FF] ring-1 ring-indigo-400 shadow-sm"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60"
                }`}
              >
                <div className="flex items-start gap-4 pr-4">
                  <div
                    className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? "border-indigo-500 bg-white text-indigo-600"
                        : "border-zinc-300 bg-white text-zinc-600 group-hover:border-zinc-400"
                    }`}
                  >
                    {pt.icon}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[#1F1F1F] tracking-tight">
                      {pt.title}
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm font-medium text-zinc-500 leading-relaxed max-w-lg">
                      {pt.description}
                    </p>
                  </div>
                </div>

                <svg
                  className={`w-5 h-5 shrink-0 mt-2 transition-colors ${
                    isSelected ? "text-indigo-600" : "text-zinc-400 group-hover:text-zinc-700"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      <StepProgressFooter currentStep={2} onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </main>
  );
}
