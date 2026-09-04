"use client";

import React from "react";
import { PropertyCategory } from "./types";
import { StepProgressFooter } from "./step-progress-footer";

interface StepCategoryProps {
  categories: PropertyCategory[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepCategory({
  categories,
  selectedCategory,
  onSelectCategory,
  onBack,
  onNext,
}: StepCategoryProps) {
  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-5xl mx-auto w-full flex flex-col items-center text-center my-auto">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-4 max-w-2xl">
          Which of these best describes your place
        </h1>
        <p className="text-sm sm:text-base font-medium text-zinc-500 max-w-xl leading-relaxed mb-10">
          Lorem ipsum non diam posuere malesuada nisl urna pharetra feugiat nisi a amet at pretium nam ac magna fermentum in.
        </p>

        <div className="flex flex-wrap justify-center gap-3.5 max-w-4xl">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-semibold transition-all cursor-pointer select-none ${
                  isSelected
                    ? "border-indigo-400 bg-[#EEF2FF] text-zinc-900 ring-1 ring-indigo-400 shadow-xs"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "border-indigo-500 bg-white text-indigo-600"
                      : "border-zinc-200 bg-white text-zinc-600"
                  }`}
                >
                  {cat.icon}
                </div>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <StepProgressFooter currentStep={1} onBack={onBack} onNext={onNext} />
    </main>
  );
}
