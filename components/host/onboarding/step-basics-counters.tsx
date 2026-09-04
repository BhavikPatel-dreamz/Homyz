"use client";

import React from "react";
import { StepProgressFooter } from "./step-progress-footer";

interface StepBasicsCountersProps {
  guests: number;
  setGuests: (val: number) => void;
  bedrooms: number;
  setBedrooms: (val: number) => void;
  beds: number;
  setBeds: (val: number) => void;
  bathrooms: number;
  setBathrooms: (val: number) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepBasicsCounters({
  guests,
  setGuests,
  bedrooms,
  setBedrooms,
  beds,
  setBeds,
  bathrooms,
  setBathrooms,
  onBack,
  onNext,
  isLoading = false,
}: StepBasicsCountersProps) {
  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-xl mx-auto w-full flex flex-col items-start my-auto">
        {/* Header & Subtitle */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-3">
          Share some basics about your place
        </h1>
        <p className="text-sm font-medium text-zinc-500 mb-10">
          You’ll add more details later, like bed types.
        </p>

        {/* Counters List Stack */}
        <div className="flex flex-col w-full divide-y divide-zinc-200/80 border-t border-b border-zinc-200/80 mb-6">
          {/* Guests Row */}
          <div className="flex items-center justify-between py-6">
            <span className="text-base font-bold text-zinc-900">Guests</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setGuests(Math.max(1, guests - 1))}
                disabled={guests <= 1}
                className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-30 disabled:hover:border-zinc-300 transition-colors text-base font-medium cursor-pointer"
              >
                -
              </button>
              <span className="w-5 text-center text-base font-bold text-zinc-900 select-none">
                {guests}
              </span>
              <button
                type="button"
                onClick={() => setGuests(guests + 1)}
                className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 transition-colors text-base font-medium cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Bedrooms Row */}
          <div className="flex items-center justify-between py-6">
            <span className="text-base font-bold text-zinc-900">Bedrooms</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setBedrooms(Math.max(1, bedrooms - 1))}
                disabled={bedrooms <= 1}
                className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-30 disabled:hover:border-zinc-300 transition-colors text-base font-medium cursor-pointer"
              >
                -
              </button>
              <span className="w-5 text-center text-base font-bold text-zinc-900 select-none">
                {bedrooms}
              </span>
              <button
                type="button"
                onClick={() => setBedrooms(bedrooms + 1)}
                className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 transition-colors text-base font-medium cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Beds Row */}
          <div className="flex items-center justify-between py-6">
            <span className="text-base font-bold text-zinc-900">Beds</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setBeds(Math.max(1, beds - 1))}
                disabled={beds <= 1}
                className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-30 disabled:hover:border-zinc-300 transition-colors text-base font-medium cursor-pointer"
              >
                -
              </button>
              <span className="w-5 text-center text-base font-bold text-zinc-900 select-none">
                {beds}
              </span>
              <button
                type="button"
                onClick={() => setBeds(beds + 1)}
                className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 transition-colors text-base font-medium cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Bathrooms Row */}
          <div className="flex items-center justify-between py-6">
            <span className="text-base font-bold text-zinc-900">Bathrooms</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setBathrooms(Math.max(1, bathrooms - 1))}
                disabled={bathrooms <= 1}
                className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-30 disabled:hover:border-zinc-300 transition-colors text-base font-medium cursor-pointer"
              >
                -
              </button>
              <span className="w-5 text-center text-base font-bold text-zinc-900 select-none">
                {bathrooms}
              </span>
              <button
                type="button"
                onClick={() => setBathrooms(bathrooms + 1)}
                className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 transition-colors text-base font-medium cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <StepProgressFooter
        currentStep={5}
        onBack={onBack}
        onNext={onNext}
        isLoading={isLoading}
      />
    </main>
  );
}
