"use client";

import { Container } from "@/components/ui";
import Image from "next/image";
import React, { useState } from "react";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";
import { StepProgressFooter } from "./step-progress-footer";

interface StepPriceProps {
  price: number;
  onChangePrice: (price: number) => void;
  currencySymbol?: string;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepPrice({
  price,
  onChangePrice,
  currencySymbol = "SR",
  onBack,
  onNext,
  isLoading = false,
}: StepPriceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showMobileBreakdown, setShowMobileBreakdown] = useState(true);

  const guestServiceFee = Math.round(price * 0.2);
  const guestPriceBeforeTaxes = price + guestServiceFee;
  const hostEarnings = Math.round(price * 0.97);

  // Direct manual numeric input handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      onChangePrice(val);
    } else {
      onChangePrice(0);
    }
  };

  return (
    <main className="step-price min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="w-full max-w-[620px] flex flex-col items-start mx-auto sm:my-auto text-center">

            <div className="max-w-[530px] mx-auto">
              {/* Main Title & Tip Subtitle */}
              <h1 data-aos="fade-up" className="sm:mb-5 mb-3">
                Now, set a weekday base price
              </h1>
              <p data-aos="fade-up" data-aos-delay="100" className="sm:mb-10 mb-6">
                TIP: Places like yours in your area typically range from 150 {currencySymbol} to 450 {currencySymbol} per night. You can change this anytime.
              </p>
            </div>

            {/* Pricing Card Box Container */}
            <div data-aos="fade-up" data-aos-delay="200" className="w-full max-w-[356px] mx-auto rounded-[20px] border border-[#727272] bg-[#F3F4F5] p-5 sm:p-8">
              {/* Editable Base Price Display */}
              <div className="mb-6 flex w-full items-center justify-center gap-4">
                {isEditing ? (
                  <div className="flex items-center justify-center gap-1 border-b-2 border-zinc-900 pb-1">
                    <span className="text-3xl font-medium text-[#1F1F1F]">{currencySymbol}</span>
                    <input
                      type="number"
                      min={10}
                      max={500000}
                      value={price || ""}
                      onChange={handleInputChange}
                      onBlur={() => setIsEditing(false)}
                      autoFocus
                      className="w-32 bg-transparent text-center text-3xl font-medium text-[#1F1F1F] outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="group flex items-center justify-center gap-4 text-3xl font-medium tracking-tight text-[#1F1F1F] transition-opacity hover:opacity-80 cursor-pointer sm:text-4xl"
                  >
                    <span>{currencySymbol}{price.toLocaleString()}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1F1F1F] bg-white text-zinc-700 transition-colors group-hover:bg-zinc-100">
                      <Image src="/images/icons/edit-pen.svg" alt="" aria-hidden="true" width={24} height={24} className="h-4 w-4 object-contain" unoptimized />
                    </div>
                  </button>
                )}
              </div>

              {/* Compact desktop fee summary */}
              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="hidden w-full items-center justify-center gap-4 text-base font-normal text-[#1F1F1F] transition-colors hover:text-zinc-800 cursor-pointer select-none sm:flex"
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

              {!showMobileBreakdown && (
                <button
                  type="button"
                  onClick={() => setShowMobileBreakdown(true)}
                  className="flex w-full items-center justify-center gap-4 sm:text-base text-sm font-normal text-[#1F1F1F] sm:hidden"
                >
                  <span>
                    Guest price before taxes <span className="font-medium">{currencySymbol}{guestPriceBeforeTaxes.toLocaleString()}</span>
                  </span>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              )}

              {/* Full mobile fee breakdown; desktop expands it on demand. */}
              <div className={`${showBreakdown ? "sm:block" : "sm:hidden"} ${showMobileBreakdown ? "block" : "hidden"} rounded-xl border border-[#727272] bg-white px-6 py-4 text-sm text-[#1F1F1F]`}>
                <div className="flex items-center justify-between">
                  <span>Base price</span>
                  <span>{currencySymbol}{price.toLocaleString()}</span>
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
                <button
                  type="button"
                  onClick={() => setShowMobileBreakdown(false)}
                  className="mt-4 flex w-full items-center justify-between border-t border-[#727272]/60 pt-3 text-left text-xs text-[#727272] sm:hidden"
                >
                  <span>Show less</span>
                  <svg className="h-4 w-4 text-[#1F1F1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <StepProgressFooter
            currentStep={1}
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
