"use client";

import React from "react";

export interface SafetyOption {
  id: string;
  label: string;
}

interface StepSafetyProps {
  selectedSafety: string[];
  onToggleSafety: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepSafety({
  selectedSafety,
  onToggleSafety,
  onBack,
  onNext,
  isLoading = false,
}: StepSafetyProps) {
  const safetyItems: SafetyOption[] = [
    {
      id: "security_camera",
      label: "Exterior security camera present",
    },
    {
      id: "noise_monitor",
      label: "Noise decibel monitor present",
    },
    {
      id: "weapons",
      label: "Weapon(s) on the property",
    },
  ];

  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-xl mx-auto w-full flex flex-col items-start my-auto">
        {/* Heading & Subtitle */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-2">
          Share safety details
        </h1>
        <p className="text-xs text-zinc-500 font-medium mb-8 max-w-md">
          Does your place have any of these?
        </p>

        {/* Safety Options List */}
        <div className="w-full space-y-4">
          {safetyItems.map((item) => {
            const isEnabled = selectedSafety.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => onToggleSafety(item.id)}
                className={`w-full border rounded-2xl p-4 sm:p-5 bg-white transition-all flex items-center justify-between shadow-2xs cursor-pointer select-none ${
                  isEnabled ? "border-zinc-300 ring-1 ring-zinc-200" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                {/* Left Side Label */}
                <span className="text-sm font-semibold text-zinc-800 pr-4">
                  {item.label}
                </span>

                {/* Right Side Toggle Switch */}
                <div
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                    isEnabled ? "bg-zinc-900" : "bg-zinc-200"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                      isEnabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Paragraph Notice */}
        <p className="text-xs text-zinc-400 leading-relaxed max-w-lg mt-6">
          Lorem ipsum aliquam pellentesque nibh tempor quam pharetra lobortis vulputate et malesuada nascetur blandit quis mi arcu sed nunc ultrices purus cras mattis vitae nisi adipiscing porta placerat nullam sed.
        </p>
      </div>

      {/* Bottom Action Footer Bar */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3 pt-8 border-t border-zinc-100 mt-12">
        <button
          type="button"
          onClick={onBack}
          className="px-7 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-bold text-zinc-800 transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="px-8 py-2.5 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-extrabold text-zinc-900 shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 min-w-[100px]"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-zinc-900 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
