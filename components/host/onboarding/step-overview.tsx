"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface StepOverviewProps {
  onGetStarted: () => void;
}

export function StepOverview({ onGetStarted }: StepOverviewProps) {
  const router = useRouter();

  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center my-auto">
        {/* Left Column: Heading */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-zinc-900 tracking-tight leading-[1.15]">
            It’s easy to <br />
            get started <br />
            on <span className="text-[#E6A838]">Homyz</span>
          </h1>
        </div>

        {/* Right Column: 3 Step Cards Stack */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start gap-8 w-full max-w-xl mx-auto lg:mx-0">
          {/* Step 1 Card */}
          <div className="relative w-full rounded-3xl border border-zinc-200/90 bg-white p-7 sm:p-9 shadow-md hover:shadow-lg transition-shadow">
            <div className="w-8 h-8 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-bold text-zinc-800 shadow-2xs absolute -top-4 left-1/2 -translate-x-1/2">
              1
            </div>
            <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
              Tell us about your place
            </h3>
            <p className="mt-2 text-sm font-medium text-zinc-500 leading-relaxed">
              Share some basic info, like where it is and how many guests can stay.
            </p>
          </div>

          {/* Step 2 Card */}
          <div className="relative w-full rounded-3xl border border-zinc-200/90 bg-white p-7 sm:p-9 shadow-md hover:shadow-lg transition-shadow">
            <div className="w-8 h-8 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-bold text-zinc-800 shadow-2xs absolute -top-4 left-1/2 -translate-x-1/2">
              2
            </div>
            <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
              Make it stand out
            </h3>
            <p className="mt-2 text-sm font-medium text-zinc-500 leading-relaxed">
              Add 5 or more photos plus a title and description and we'll help you out.
            </p>
          </div>

          {/* Step 3 Card */}
          <div className="relative w-full rounded-3xl border border-zinc-200/90 bg-white p-7 sm:p-9 shadow-md hover:shadow-lg transition-shadow">
            <div className="w-8 h-8 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-bold text-zinc-800 shadow-2xs absolute -top-4 left-1/2 -translate-x-1/2">
              3
            </div>
            <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
              Finish and publish
            </h3>
            <p className="mt-2 text-sm font-medium text-zinc-500 leading-relaxed">
              Choose a starting price, verify a few details, then publish your listing.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer Bar */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3 pt-8 border-t border-zinc-100 mt-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-7 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-bold text-zinc-800 transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onGetStarted}
          className="px-8 py-2.5 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-extrabold text-zinc-900 shadow-xs transition-colors cursor-pointer"
        >
          Get started
        </button>
      </div>
    </main>
  );
}
