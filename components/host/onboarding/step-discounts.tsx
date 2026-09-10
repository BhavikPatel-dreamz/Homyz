"use client";

import { Container } from "@/components/ui";
import React, { useState } from "react";
import { StepProgressFooter } from "./step-progress-footer";

export interface DiscountOption {
  id: string;
  title: string;
  description: string;
  percentage: number;
}

interface StepDiscountsProps {
  selectedDiscounts: string[];
  onToggleDiscount: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepDiscounts({
  selectedDiscounts,
  onToggleDiscount,
  onBack,
  onNext,
  isLoading = false,
}: StepDiscountsProps) {
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const discounts: DiscountOption[] = [
    {
      id: "new_listing",
      title: "New listing promotion",
      description: "Offer 20% off your first 3 bookings to get reservations faster and build initial reviews.",
      percentage: 20,
    },
    {
      id: "last_minute",
      title: "Last-minute discount",
      description: "Offer 15% off for stays booked within 2 days of arrival to fill unbooked calendar days.",
      percentage: 15,
    },
    {
      id: "weekly",
      title: "Weekly discount",
      description: "Offer 10% off for stays of 7 nights or longer to attract extended guests.",
      percentage: 10,
    },
    {
      id: "monthly",
      title: "Monthly discount",
      description: "Offer 25% off for stays of 28 nights or longer for stable, long-term occupancy.",
      percentage: 25,
    },
  ];

  return (
    <main className="py-10">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col justify-between animate-in fade-in duration-200">
          <div className="max-w-xl mx-auto w-full flex flex-col items-start my-auto">
            {/* Heading & Subtitle */}
            <h1 className="text-3xl sm:text-4xl font-semibold text-[#1F1F1F] tracking-tight leading-tight mb-2">
              Add discounts
            </h1>
            <p className="text-xs text-zinc-500 font-medium mb-8 max-w-md">
              Help your place stand out to get booked faster and earn your first reviews.
            </p>

            {/* Discounts List */}
            <div className="w-full space-y-4">
              {discounts.map((discount) => {
                const isEnabled = selectedDiscounts.includes(discount.id);
                return (
                  <div
                    key={discount.id}
                    onClick={() => onToggleDiscount(discount.id)}
                    className={`w-full border rounded-2xl p-5 sm:p-6 bg-white transition-all flex items-center justify-between shadow-2xs cursor-pointer select-none ${isEnabled ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200 hover:border-zinc-300"
                      }`}
                  >
                    {/* Left Side Info */}
                    <div className="flex flex-col items-start pr-4">
                      <span className="text-sm font-semibold text-zinc-800 mb-1">
                        {discount.title}
                      </span>
                      <span className="text-xs text-zinc-500 mb-2 leading-relaxed">
                        {discount.description}
                      </span>
                      <span className="text-xl font-semibold text-[#1F1F1F]">
                        {discount.percentage}%
                      </span>
                    </div>

                    {/* Right Side Toggle Switch */}
                    <div
                      className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${isEnabled ? "bg-zinc-900" : "bg-zinc-200"
                        }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${isEnabled ? "translate-x-6" : "translate-x-0"
                          }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footnote Notice & Read more Toggle */}
            <div className="mt-4 w-full">
              <p className="text-xs text-zinc-500 font-medium">
                Only one promotional or length-of-stay discount applies per booking.{" "}
                <button
                  type="button"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="underline hover:text-zinc-800 cursor-pointer font-semibold"
                >
                  {showExplanation ? "Hide details" : "Read more"}
                </button>
              </p>

              {showExplanation && (
                <div className="mt-3 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-600 leading-relaxed animate-in fade-in duration-150">
                  <p className="font-semibold text-zinc-800 mb-1">How discounts work on Homyz:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>If multiple discounts apply to the same dates, the highest qualifying single discount will be granted to the guest.</li>
                    <li>Length-of-stay discounts (weekly or monthly) take priority over the new listing promotion once your first 3 bookings are completed.</li>
                    <li>You can adjust or turn off any discount at any time from your host listing editor.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <StepProgressFooter
            currentStep={3}
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
