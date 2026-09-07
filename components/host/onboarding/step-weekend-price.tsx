"use client";

import React, { useState } from "react";

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

  // Calculate percentage premium relative to base weekday price
  const baseWeekday = weekdayPrice > 0 ? weekdayPrice : 241;
  const currentPercentage = Math.max(0, Math.round(((weekendPrice - baseWeekday) / baseWeekday) * 100));

  // Update calculated weekend price when dragging slider
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseInt(e.target.value, 10);
    const newWeekendPrice = Math.round(baseWeekday * (1 + pct / 100));
    onChangeWeekendPrice(newWeekendPrice);
  };

  // Direct manual input for weekend price
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(val)) {
      onChangeWeekendPrice(val);
    } else {
      onChangeWeekendPrice(baseWeekday);
    }
  };

  // Guest price before taxes (~11.34% guest fee offset SR291 -> SR324)
  const guestPrice = Math.round(weekendPrice * 1.1134);

  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-center my-auto text-center">
        {/* Main Title & Subtitle */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1F1F1F] tracking-tight leading-tight mb-2">
          Set a weekend price
        </h1>
        <p className="text-xs font-semibold text-zinc-400 mb-10 max-w-md uppercase tracking-wider">
          TIP: Lorem ipsum magna turpis mattis diam euismod non pulvinar laoreet.
        </p>

        {/* Pricing Card Box (Matches First Image Design) */}
        <div className="w-full max-w-sm bg-[#f7f7f8] border border-zinc-200/90 rounded-3xl p-8 sm:p-10 flex flex-col items-center justify-center shadow-2xs transition-all">
          {/* Big Weekend Price Display */}
          <div className="flex items-center justify-center gap-2 mb-2 w-full">
            {isEditing ? (
              <div className="flex items-center justify-center gap-1 border-b-2 border-zinc-900 pb-1">
                <span className="text-3xl sm:text-4xl font-semibold text-[#1F1F1F]">{currencySymbol}</span>
                <input
                  type="number"
                  min={10}
                  max={500000}
                  value={weekendPrice || ""}
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
                  {currencySymbol}
                  {weekendPrice.toLocaleString()}
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
              Guest price before taxes {currencySymbol}
              {guestPrice.toLocaleString()}
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
                <span>Weekend base price</span>
                <span>
                  {currencySymbol}
                  {weekendPrice.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Guest service fee</span>
                <span>
                  {currencySymbol}
                  {(guestPrice - weekendPrice).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-[#1F1F1F] pt-1 border-t border-zinc-200">
                <span>Guest price</span>
                <span>
                  {currencySymbol}
                  {guestPrice.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Weekend Premium Drag Slider Section */}
          <div className="w-full flex flex-col items-start pt-3 border-t border-zinc-200/80">
            <label className="text-xs font-semibold text-zinc-500 mb-3">
              Weekend premium
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
              Try {currentPercentage}%
            </span>
          </div>
        </div>
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
