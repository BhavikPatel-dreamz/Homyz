"use client";

import React, { useState } from "react";

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
  const discounts: DiscountOption[] = [
    {
      id: "new_listing",
      title: "New listing promotion",
      description: "Lorem ipsum ut integer porta euismod ipsum diam urna turpis.",
      percentage: 20,
    },
    {
      id: "last_minute",
      title: "Last-minute discount",
      description: "Lorem ipsum ut integer porta euismod ipsum diam urna turpis.",
      percentage: 15,
    },
    {
      id: "weekly",
      title: "Weekly discount",
      description: "Lorem ipsum ut integer porta euismod ipsum diam urna turpis.",
      percentage: 10,
    },
    {
      id: "monthly",
      title: "Monthly discount",
      description: "Lorem ipsum ut integer porta euismod ipsum diam urna turpis.",
      percentage: 25,
    },
  ];

  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-xl mx-auto w-full flex flex-col items-start my-auto">
        {/* Heading & Subtitle */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-2">
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
                className={`w-full border rounded-2xl p-5 sm:p-6 bg-white transition-all flex items-center justify-between shadow-2xs cursor-pointer select-none ${
                  isEnabled ? "border-zinc-300 ring-1 ring-zinc-200" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                {/* Left Side Info */}
                <div className="flex flex-col items-start pr-4">
                  <span className="text-sm font-semibold text-zinc-800 mb-1">
                    {discount.title}
                  </span>
                  <span className="text-xs text-zinc-400 mb-2 leading-relaxed">
                    {discount.description}
                  </span>
                  <span className="text-xl font-extrabold text-zinc-900">
                    {discount.percentage}%
                  </span>
                </div>

                {/* Right Side Toggle Switch */}
                <div
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                    isEnabled ? "bg-[#FF5A5F]" : "bg-zinc-200"
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

        {/* Footnote Notice */}
        <p className="text-xs text-zinc-400 font-medium mt-4">
          Only one discount will be applied per stay.{" "}
          <button type="button" className="underline hover:text-zinc-600 cursor-pointer">
            Read more
          </button>
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
