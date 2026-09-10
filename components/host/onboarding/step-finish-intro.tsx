"use client";

import React from "react";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";

interface StepFinishIntroProps {
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepFinishIntro({ onBack, onNext, isLoading = false }: StepFinishIntroProps) {
  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-12 my-auto animate-in fade-in duration-200">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center my-auto">
        {/* Left Column: Text & Step Badge */}
        <div className="flex flex-col items-start justify-center">
          <div className="border border-zinc-300 rounded-full px-4 py-1 text-xs font-semibold text-zinc-700 inline-block mb-4">
            Step 3
          </div>
          <h1 className="mb-5">
            Finish up and publish
          </h1>
          <p className="text-sm text-zinc-500 max-w-md font-medium leading-relaxed mb-8">
            Finally, you&apos;ll choose your weekday base price, weekend pricing, early bird or length-of-stay discounts, and review important safety details.
          </p>
        </div>

        {/* Right Column: Decorative Illustration Card */}
        <div className="relative flex justify-center items-center">
          {/* Abstract Yellow Decorative Dots */}
          <div className="absolute -top-6 left-12 w-6 h-10 bg-[#FCDF9C] rounded-full rotate-45 opacity-80" />
          <div className="absolute -top-2 left-24 w-4 h-4 bg-[#FCDF9C] rounded-full opacity-80" />
          <div className="absolute -bottom-6 right-12 w-8 h-12 bg-[#FCDF9C] rounded-full -rotate-12 opacity-80" />
          <div className="absolute -bottom-2 right-28 w-5 h-5 bg-[#FCDF9C] rounded-full opacity-80" />

          {/* Living Room Artwork Frame */}
          <div className="w-full max-w-md aspect-square bg-[#709CAB] rounded-3xl overflow-hidden shadow-lg border border-zinc-200 relative flex items-end justify-center">
            {/* Soft Sun Ray overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20 pointer-events-none" />

            {/* Armchair & Interior Vector Art */}
            <div className="relative w-full h-full p-6 flex flex-col justify-between">
              {/* Plant on side table */}
              <div className="absolute bottom-12 left-8 flex flex-col items-center">
                <div className="w-12 h-20 bg-[#2D5E4E] rounded-t-full relative flex items-center justify-center">
                  <div className="w-3 h-14 bg-[#1E4337] rounded-full transform -rotate-12" />
                  <div className="w-3 h-14 bg-[#3E7A67] rounded-full transform rotate-12" />
                </div>
                <div className="w-10 h-10 bg-white rounded-md shadow-xs border border-zinc-200" />
                <div className="w-12 h-14 bg-[#D9A371] rounded-b-md" />
              </div>

              {/* Modern Armchair with Yellow Pillow */}
              <div className="absolute bottom-8 right-8 w-48 h-48 bg-[#F4F4F5] rounded-2xl shadow-md p-4 flex flex-col justify-end border border-zinc-200">
                <div className="w-12 h-12 bg-[#FCDF9C] rounded-xl self-end mb-2 shadow-xs transform rotate-6" />
                <div className="w-full h-16 bg-[#E4E4E7] rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer Bar */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3 pt-8 border-t border-zinc-100 mt-12">
        <OnboardingBackButton
          onClick={onBack}
          disabled={isLoading}
        />
        <OnboardingPrimaryButton
          onClick={onNext}
          isLoading={isLoading}
          label="Next"
        />
      </div>
    </main>
  );
}
