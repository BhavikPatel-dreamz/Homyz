"use client";
import { Container } from "@/components/ui";
import React from "react";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

interface StepIntroProps {
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepIntro({ onBack, onNext, isLoading = false }: StepIntroProps) {
  return (
    <main className="step-intro min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          
          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="step-intro-panel max-w-219.25 w-full grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center sm:m-auto mx-auto">
            {/* Left Column: Step Badge, Title & Description */}
            <div data-aos="fade-right" data-aos-duration="700" className="order-2 flex max-w-xl flex-col justify-center lg:order-1 lg:col-span-6">
              <div className="mb-5">
                <span className="inline-flex items-center rounded-full border border-[#1F1F1F] px-6 py-2.5 text-base font-medium text-[#1F1F1F] bg-white">
                  Step 1
                </span>
              </div>
              <h1>
                Tell us about <br className="sm:block hidden" />
                your place
              </h1>
              <p className="text-base font-normal text-[#727272] leading-relaxed mt-5">
                In this step, we&apos;ll ask you which type of property you have and if guests will book the entire place or just a room. Then let us know the location and how many guests can stay.
              </p>
            </div>

            {/* Right Column: Room & Armchair Vector Illustration */}
            <div data-aos="fade-left" data-aos-delay="100" data-aos-duration="700" className="order-1 flex w-full justify-center lg:order-2 lg:col-span-6 lg:justify-end">
              <div className="w-full sm:max-w-md rounded-3xl overflow-hidden shadow-2xl border border-zinc-100 bg-[#6A9FB5]">
                <svg width="362" height="362" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
                  <rect width="400" height="400" fill="#6A9FB5" />
                  <path d="M 0 0 L 220 0 L 120 400 L 0 400 Z" fill="white" fillOpacity="0.15" />
                  <path d="M 180 0 L 340 0 L 240 400 L 80 400 Z" fill="white" fillOpacity="0.1" />
                  <rect y="330" width="400" height="70" fill="#4B7B93" />
                  <rect y="325" width="400" height="5" fill="#E2EFF3" fillOpacity="0.4" />

                  <line x1="85" y1="280" x2="65" y2="350" stroke="#8C6345" strokeWidth="6" strokeLinecap="round" />
                  <line x1="125" y1="280" x2="110" y2="350" stroke="#724E33" strokeWidth="5" strokeLinecap="round" />
                  <line x1="165" y1="280" x2="185" y2="350" stroke="#8C6345" strokeWidth="6" strokeLinecap="round" />
                  <ellipse cx="125" cy="275" rx="65" ry="12" fill="#EFE8DD" stroke="#D3C7B5" strokeWidth="2" />

                  <path d="M 105 270 L 110 240 L 140 240 L 145 270 Z" fill="#FFFFFF" stroke="#E0E0E0" strokeWidth="2" />
                  <ellipse cx="125" cy="240" rx="15" ry="4" fill="#5D4037" />
                  <path d="M 125 240 Q 110 200 80 190 Q 75 210 115 235 Z" fill="#388E3C" />
                  <path d="M 125 240 Q 95 180 130 150 Q 145 180 128 235 Z" fill="#2E7D32" />
                  <path d="M 125 240 Q 155 190 185 180 Q 180 215 132 238 Z" fill="#4CAF50" />
                  <path d="M 125 240 Q 120 170 100 140 Q 130 160 126 235 Z" fill="#1B5E20" />

                  <rect x="150" y="260" width="12" height="14" rx="2" fill="#FFFFFF" />
                  <path d="M 162 263 C 166 263 166 271 162 271" stroke="#FFFFFF" strokeWidth="2" fill="none" />

                  <line x1="225" y1="310" x2="210" y2="355" stroke="#8C6345" strokeWidth="7" strokeLinecap="round" />
                  <line x1="335" y1="310" x2="350" y2="355" stroke="#8C6345" strokeWidth="7" strokeLinecap="round" />

                  <path d="M 220 220 C 220 190 340 190 340 220 L 345 300 C 345 315 215 315 215 300 Z" fill="#F5F5F0" />
                  <path d="M 230 200 L 235 300" stroke="#E0E0DB" strokeWidth="2" />
                  <path d="M 330 200 L 325 300" stroke="#E0E0DB" strokeWidth="2" />

                  <rect x="205" y="250" width="30" height="15" rx="7" fill="#E8E8E0" stroke="#D0D0C8" strokeWidth="2" />
                  <rect x="325" y="250" width="30" height="15" rx="7" fill="#E8E8E0" stroke="#D0D0C8" strokeWidth="2" />

                  <rect x="220" y="280" width="120" height="30" rx="10" fill="#FFFFFF" stroke="#E0E0DB" strokeWidth="2" />

                  <path d="M 285 240 C 285 230 325 230 325 240 L 330 285 L 280 285 Z" fill="#FBC02D" />
                  <path d="M 260 250 C 260 240 295 240 295 250 L 300 285 L 255 285 Z" fill="#FFF9C4" opacity="0.9" />
                </svg>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer Bar */}
          <div className="max-w-7xl mx-auto w-full flex items-center justify-end sm:mt-8 sm:pt-0 pt-8 mt-auto">
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
