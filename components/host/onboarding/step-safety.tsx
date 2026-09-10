"use client";

import { Container } from "@/components/ui";
import React from "react";
import { StepProgressFooter } from "./step-progress-footer";

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
    <main className="py-10">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col justify-between animate-in fade-in duration-200">
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
                    className={`w-full border rounded-2xl p-4 sm:p-5 bg-white transition-all shadow-2xs ${answer ? "border-zinc-900 ring-1 ring-zinc-200" : "border-zinc-200"
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
                          className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${answer === choice
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

          <StepProgressFooter
            currentStep={4}
            totalSteps={4}
            onBack={onBack}
            onNext={onNext}
            isLoading={isLoading}
            nextLabel="Save & Continue"
          />
        </div>
      </Container>
    </main>
  );
}
