"use client";

import { Container } from "@/components/ui";
import React from "react";
import { StepProgressFooter } from "./step-progress-footer";

export interface HouseHighlightOption {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface StepHighlightsProps {
  selectedHighlights: string[];
  onToggleHighlight: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepHighlights({
  selectedHighlights,
  onToggleHighlight,
  onBack,
  onNext,
  isLoading = false,
}: StepHighlightsProps) {
  const highlightOptions: HouseHighlightOption[] = [
    {
      id: "Peaceful",
      label: "Peaceful",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0-15a3 3 0 100 6 3 3 0 000-6zm-4.5 9h9" />
        </svg>
      ),
    },
    {
      id: "Unique",
      label: "Unique",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385c.116.488-.42.88-.838.614L12 17.763l-4.72 2.784c-.418.266-.954-.126-.838-.614l1.285-5.385a.563.563 0 00-.182-.557l-4.204-3.602c-.38-.325-.178-.948.32-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
    {
      id: "Family-friendly",
      label: "Family-friendly",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a5.97 5.97 0 00-.942 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      id: "Stylish",
      label: "Stylish",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
    },
    {
      id: "Central",
      label: "Central",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-8.25-8.25v16.5m-3-11.25l6 6m0-6l-6 6" />
        </svg>
      ),
    },
    {
      id: "Spacious",
      label: "Spacious",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
        </svg>
      ),
    },
  ];

  return (
    <main className="py-10">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col justify-between animate-in fade-in duration-200">
          <div className="max-w-4xl mx-auto w-full flex flex-col items-start my-auto">
            {/* Main Title & Subtitle */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1F1F1F] tracking-tight leading-tight mb-2">
              Let’s describe your house
            </h1>
            <p className="text-sm font-medium text-zinc-500 mb-10">
              Choose up to 3 highlights. We’ll use these to help guests understand your place.
            </p>

            {/* Highlights Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 w-full max-w-2xl">
              {highlightOptions.map((item) => {
                const isSelected = selectedHighlights.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleHighlight(item.id)}
                    className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-semibold transition-all cursor-pointer select-none text-left ${isSelected
                        ? "border-zinc-900 bg-[#EEF2FF] text-[#1F1F1F] ring-zinc-900 shadow-2xs"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected
                          ? "border-zinc-900 bg-white text-[#1F1F1F]"
                          : "border-zinc-200 bg-white text-zinc-600"
                        }`}
                    >
                      {item.icon}
                    </div>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <StepProgressFooter
            currentStep={5}
            totalSteps={6}
            onBack={onBack}
            onNext={onNext}
            isLoading={isLoading}
          />
        </div>
      </Container>
    </main>
  );
}
