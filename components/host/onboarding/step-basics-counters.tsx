"use client";

import React from "react";
import { StepProgressFooter } from "./step-progress-footer";
import { Container } from "@/components/ui";

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
    <main className="min-h-dvh bg-white py-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          <div className="max-w-[748px] mx-auto w-full flex flex-col items-start my-auto">
            {/* Header & Subtitle */}
            <h1 className="mb-5">
              Share some basics about your place
            </h1>
            <p className="sm:mb-10 mb-8">
              You’ll add more details later, like bed types.
            </p>

            {/* Counters List Stack */}
            <div className="flex flex-col w-full divide-y divide-[#727272] mb-6">
              {/* Guests Row */}
              <div className="flex items-center justify-between sm:py-4.5 py-4">
                <span className="text-lg font-medium text-[#1F1F1F]">Guests</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setGuests(Math.max(1, guests - 1))}
                    disabled={guests <= 1}
                    className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] disabled:opacity-30 disabled:hover:border-zinc-300 transition-colors text-base font-medium cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-lg font-normal text-[#1F1F1F] select-none">
                    {guests}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGuests(guests + 1)}
                    className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] transition-colors text-base font-medium cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Bedrooms Row */}
              <div className="flex items-center justify-between sm:py-4.5 py-4">
                <span className="text-lg font-medium text-[#1F1F1F]">Bedrooms</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setBedrooms(Math.max(0, bedrooms - 1))}
                    disabled={bedrooms <= 0}
                    className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] disabled:opacity-30 disabled:hover:border-zinc-300 transition-colors text-base font-medium cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-lg font-normal text-[#1F1F1F] select-none">
                    {bedrooms}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBedrooms(bedrooms + 1)}
                    className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] transition-colors text-base font-medium cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Beds Row */}
              <div className="flex items-center justify-between sm:py-4.5 py-4">
                <span className="text-lg font-medium text-[#1F1F1F]">Beds</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setBeds(Math.max(1, beds - 1))}
                    disabled={beds <= 1}
                    className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] disabled:opacity-30 disabled:hover:border-zinc-300 transition-colors text-base font-medium cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-lg font-normal text-[#1F1F1F] select-none">
                    {beds}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBeds(beds + 1)}
                    className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] transition-colors text-base font-medium cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Bathrooms Row */}
              <div className="flex items-center justify-between sm:py-4.5 py-4">
                <span className="text-lg font-medium text-[#1F1F1F]">Bathrooms</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setBathrooms(Math.max(1, bathrooms - 1))}
                    disabled={bathrooms <= 1}
                    className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] disabled:opacity-30 disabled:hover:border-zinc-300 transition-colors text-base font-medium cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-lg font-medium text-[#1F1F1F] select-none">
                    {bathrooms}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBathrooms(bathrooms + 1)}
                    className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] transition-colors text-base font-medium cursor-pointer"
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
        </div>
      </Container>
    </main>
  );
}
