"use client";

import { Container } from "@/components/ui";
import Image from "next/image";
import React, { useState } from "react";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";
import { StepProgressFooter } from "./step-progress-footer";

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
  currencySymbol = "SR",
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
  const currentPercentage = Math.max(0, Math.round(((activeWeekendPrice - baseWeekday) / baseWeekday) * 100));
  const guestServiceFee = Math.round(activeWeekendPrice * 0.2);
  const guestPriceBeforeTaxes = activeWeekendPrice + guestServiceFee;
  const hostEarnings = Math.round(activeWeekendPrice * 0.97);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseInt(e.target.value, 10);
    onChangeWeekendPrice(Math.round(baseWeekday * (1 + pct / 100)));
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
    <main className="min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="mx-auto my-auto flex w-full max-w-[620px] flex-col items-start text-center">
            {/* Main Title & Subtitle */}
            <div className="mx-auto max-w-[530px]">
              <h1 data-aos="fade-up" className="sm:mb-5 mb-3">Set a weekend price</h1>
              <p data-aos="fade-up" data-aos-delay="100" className="sm:mb-10 mb-6">
                TIP: Weekend rates typically reflect increased leisure demand for Friday and Saturday nights.
              </p>
            </div>

            {/* Pricing Card Box */}
            <div data-aos="fade-up" data-aos-delay="200" className="mx-auto flex w-full max-w-sm flex-col items-center justify-center rounded-3xl border border-zinc-200/90 bg-[#f7f7f8] p-8 shadow-2xs transition-all sm:p-10">
              {/* Big Weekend Price Display */}
              <div className="mb-5 flex w-full items-center justify-center gap-4">
                {isEditing ? (
                  <div className="flex items-center justify-center gap-1 border-b-2 border-zinc-900 pb-1">
                    <span className="text-2xl font-semibold text-[#1F1F1F] sm:text-3xl">{currencySymbol}</span>
                    <input
                      type="number"
                      min={10}
                      max={500000}
                      value={activeWeekendPrice || ""}
                      onChange={handleInputChange}
                      onBlur={() => setIsEditing(false)}
                      autoFocus
                      className="w-32 bg-transparent text-center text-3xl font-semibold text-[#1F1F1F] outline-none sm:text-4xl"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="group flex items-center justify-center gap-4 text-3xl font-medium tracking-tight text-[#1F1F1F] transition-opacity hover:opacity-80 cursor-pointer sm:text-4xl"
                  >
                    <span>{currencySymbol}{activeWeekendPrice.toLocaleString()}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1F1F1F] bg-white text-zinc-700 transition-colors group-hover:bg-zinc-100">
                      <Image src="/images/icons/edit-pen.svg" alt="" aria-hidden="true" width={24} height={24} className="h-4 w-4 object-contain" unoptimized />
                    </div>
                  </button>
                )}
              </div>

              {/* Guest price summary */}
              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="mb-5 flex w-full items-center justify-center gap-4 text-base font-normal text-[#1F1F1F] transition-colors hover:text-zinc-800 cursor-pointer select-none"
              >
                <span>
                  Guest price before taxes <span className="font-medium">{currencySymbol}{guestPriceBeforeTaxes.toLocaleString()}</span>
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

              {showBreakdown && (
                <div className="mb-1 w-full rounded-xl border border-[#727272] bg-white px-6 py-4 text-left text-sm text-[#1F1F1F] animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span>Base price</span>
                    <span>{currencySymbol}{activeWeekendPrice.toLocaleString()}</span>
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <span>Guest service fee</span>
                    <span>{currencySymbol}{guestServiceFee.toLocaleString()}</span>
                  </div>
                  <div className="my-5 border-t border-[#727272]/60" />
                  <div className="flex items-center justify-between">
                    <span>Guest price before taxes</span>
                    <span>{currencySymbol}{guestPriceBeforeTaxes.toLocaleString()}</span>
                  </div>
                  <div className="my-5 border-t border-[#727272]/60" />
                  <div className="flex items-center justify-between">
                    <span>You earn</span>
                    <span className="font-medium">{currencySymbol}{hostEarnings.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {!showBreakdown && (
                <div className="flex w-full flex-col items-start border-t border-zinc-200/80 pt-4">
                  <label className="mb-3 text-xs font-normal text-[#1F1F1F]">Weekend premium</label>
                  <div className="relative flex w-full items-center">
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={1}
                      value={currentPercentage}
                      onChange={handleSliderChange}
                      style={{ background: `linear-gradient(to right, #18181b 0%, #18181b ${(currentPercentage / 50) * 100}%, #e4e4e7 ${(currentPercentage / 50) * 100}%, #e4e4e7 100%)` }}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg outline-none transition-all [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-900 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-zinc-900 [&::-moz-range-thumb]:shadow-md"
                    />
                  </div>
                  <span className="mt-2.5 text-xs font-normal text-[#1F1F1F]">Try 5%</span>
                </div>
              )}
            </div>
          </div>

          <StepProgressFooter
            currentStep={2}
            totalSteps={4}
            onBack={onBack}
            onNext={onNext}
            isLoading={isLoading}
          />
        </div>
      </Container>
    </main>
  );
}
