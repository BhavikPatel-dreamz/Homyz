"use client";

import React from "react";

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
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1F1F1F] tracking-tight leading-tight mb-4">
            Finish up and publish
          </h1>
          <p className="text-sm text-zinc-500 max-w-md font-medium leading-relaxed mb-8">
            Lorem ipsum non diam posuere malesuada nisl urna pharetra feugiat nisi a amet at pretium nam ac magna fermentum in.
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
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="px-7 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-semibold text-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="px-8 py-2.5 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-semibold text-[#1F1F1F] shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 min-w-[100px]"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-[#1F1F1F] shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading...</span>
            </>
          ) : (
            "Next"
          )}
        </button>
      </div>
    </main>
  );
}
