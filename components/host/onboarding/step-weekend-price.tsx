"use client";

import { Container } from "@/components/ui";
import React, { useState } from "react";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";

interface StepWeekendPriceProps {
  weekdayPrice: number;
  weekendPrice: number;
  onChangeWeekendPrice: (price: number) => void;
  currencySymbol?: string;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepWeekendPrice({
  weekdayPrice,
  weekendPrice,
  onChangeWeekendPrice,
  currencySymbol = "SAR",
  onBack,
  onNext,
  isLoading = false,
}: StepWeekendPriceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Derive base reference price from weekday base price
  const baseWeekday = weekdayPrice > 0 ? weekdayPrice : 100;
  // Authoritative weekend price (falls back to baseWeekday if not yet set)
  const activeWeekendPrice = weekendPrice > 0 ? weekendPrice : baseWeekday;
  // Calculate percentage premium relative to base weekday price
  const currentPercentage = Math.max(0, Math.round(((activeWeekendPrice - baseWeekday) / baseWeekday) * 100));

  // Update calculated weekend price when dragging slider (0% to 50% premium)
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseInt(e.target.value, 10);
    const newWeekendPrice = Math.round(baseWeekday * (1 + pct / 100));
    onChangeWeekendPrice(newWeekendPrice);
  };

  // Direct manual input for weekend price
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      onChangeWeekendPrice(val);
    } else {
      onChangeWeekendPrice(baseWeekday);
    }
  };

  return (
    <main className="py-10">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          <div className="max-w-4xl mx-auto w-full flex flex-col items-center my-auto text-center">
            {/* Main Title & Subtitle */}
            <h1 className="mb-2">
              Set a weekend price
            </h1>
            <p className="text-xs font-semibold text-zinc-500 mb-10 max-w-md uppercase tracking-wider">
              TIP: Weekend rates typically reflect increased leisure demand for Friday and Saturday nights.
            </p>

            {/* Pricing Card Box */}
            <div className="w-full max-w-sm bg-[#f7f7f8] border border-zinc-200/90 rounded-3xl p-8 sm:p-10 flex flex-col items-center justify-center shadow-2xs transition-all">
              {/* Big Weekend Price Display */}
              <div className="flex items-center justify-center gap-2 mb-2 w-full">
                {isEditing ? (
                  <div className="flex items-center justify-center gap-1 border-b-2 border-zinc-900 pb-1">
                    <span className="text-2xl sm:text-3xl font-semibold text-[#1F1F1F]">{currencySymbol}</span>
                    <input
                      type="number"
                      min={10}
                      max={500000}
                      value={activeWeekendPrice || ""}
                      onChange={handleInputChange}
                      onBlur={() => setIsEditing(false)}
                      autoFocus
                      className="text-3xl sm:text-4xl font-semibold text-[#1F1F1F] bg-transparent outline-none w-32 text-center"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="group flex items-center justify-center gap-2 text-4xl sm:text-5xl font-semibold text-[#1F1F1F] tracking-tight hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <span>
                      {currencySymbol} {activeWeekendPrice.toLocaleString()}
                    </span>
                    <div className="w-9 h-9 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-700 shadow-2xs group-hover:border-zinc-900 group-hover:bg-zinc-100 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>

              {/* Guest Price Dropdown Toggle */}
              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="text-xs font-semibold text-zinc-500 flex items-center justify-center gap-1.5 hover:text-zinc-800 transition-colors cursor-pointer select-none mb-6"
              >
                <span>
                  Weekend rate {currencySymbol} {activeWeekendPrice.toLocaleString()} ({currentPercentage}% premium)
                </span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${showBreakdown ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {/* Collapsible Fee Breakdown */}
              {showBreakdown && (
                <div className="w-full mb-6 pt-3 border-t border-zinc-200 text-left text-xs space-y-2 animate-in fade-in duration-150">
                  <div className="flex justify-between text-zinc-600">
                    <span>Weekday base price</span>
                    <span>
                      {currencySymbol} {baseWeekday.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Weekend premium</span>
                    <span>
                      +{currentPercentage}% ({currencySymbol} {(activeWeekendPrice - baseWeekday).toLocaleString()})
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-[#1F1F1F] pt-1 border-t border-zinc-200">
                    <span>Total weekend nightly price</span>
                    <span>
                      {currencySymbol} {activeWeekendPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Weekend Premium Drag Slider Section */}
              <div className="w-full flex flex-col items-start pt-3 border-t border-zinc-200/80">
                <label className="text-xs font-semibold text-zinc-500 mb-3">
                  Weekend premium over weekday base
                </label>

                <div className="relative w-full flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={currentPercentage}
                    onChange={handleSliderChange}
                    style={{
                      background: `linear-gradient(to right, #18181b 0%, #18181b ${(currentPercentage / 50) * 100}%, #e4e4e7 ${(currentPercentage / 50) * 100}%, #e4e4e7 100%)`,
                    }}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer outline-none transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-zinc-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-125 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-zinc-900 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-md"
                  />
                </div>

                <span className="text-xs font-medium text-zinc-600 mt-2.5">
                  +{currentPercentage}% premium ({currencySymbol} {activeWeekendPrice.toLocaleString()} / night)
                </span>
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
        </div>
      </Container>
    </main>
  );
}
