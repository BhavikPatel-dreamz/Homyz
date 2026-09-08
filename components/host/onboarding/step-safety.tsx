"use client";

import React from "react";

export interface SafetyOption {
  id: string;
  label: string;
}

interface StepSafetyProps {
  selectedSafety: string[];
  onAnswerSafety: (id: string, answer: "YES" | "NO") => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepSafety({
  selectedSafety,
  onAnswerSafety,
  onBack,
  onNext,
  isLoading = false,
}: StepSafetyProps) {
  const safetyItems: SafetyOption[] = [
    {
      id: "SECURITY_CAMERA",
      label: "Exterior security camera present",
    },
    {
      id: "NOISE_MONITOR",
      label: "Noise decibel monitor present",
    },
    {
      id: "WEAPONS",
      label: "Weapon(s) on the property",
    },
  ];

  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-xl mx-auto w-full flex flex-col items-start my-auto">
        {/* Heading & Subtitle */}
        <h1 className="text-3xl sm:text-4xl font-semibold text-[#1F1F1F] tracking-tight leading-tight mb-2">
          Share safety details
        </h1>
        <p className="text-xs text-zinc-500 font-medium mb-8 max-w-md">
          Does your place have any of these?
        </p>

        {/* Safety Options List */}
        <div className="w-full space-y-4">
          {safetyItems.map((item) => {
            const answer = selectedSafety.find((value) => value.startsWith(`${item.id}:`))?.split(":")[1];
            return (
              <fieldset
                key={item.id}
                className={`w-full border rounded-2xl p-4 sm:p-5 bg-white transition-all shadow-2xs ${
                  answer ? "border-zinc-900 ring-1 ring-zinc-200" : "border-zinc-200"
                }`}
              >
                <legend className="text-sm font-semibold text-zinc-800 pr-4">
                  {item.label}
                </legend>
                <p className="mt-1 text-xs text-zinc-500">Please answer yes or no. You can update this later.</p>
                <div className="mt-4 flex gap-2" role="group" aria-label={item.label}>
                  {(["YES", "NO"] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      aria-pressed={answer === choice}
                      onClick={() => onAnswerSafety(item.id, choice)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                        answer === choice
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-900"
                      }`}
                    >
                      {choice === "YES" ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        {/* Paragraph Notice */}
        <p className="text-xs text-zinc-400 leading-relaxed max-w-lg mt-6">
          Safety disclosures help guests make informed booking decisions. Your exact property location remains private until a reservation is confirmed.
        </p>
      </div>

      {/* Bottom Action Footer Bar */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3 pt-8 border-t border-zinc-100 mt-12">
        <button
          type="button"
          onClick={onBack}
          className="px-7 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-semibold text-zinc-800 transition-colors cursor-pointer"
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
