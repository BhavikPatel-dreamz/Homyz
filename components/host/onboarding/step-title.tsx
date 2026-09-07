"use client";

import React from "react";

interface StepTitleProps {
  title: string;
  onChangeTitle: (title: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepTitle({
  title,
  onChangeTitle,
  onBack,
  onNext,
  isLoading = false,
}: StepTitleProps) {
  const maxChars = 50;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= maxChars) {
      onChangeTitle(val);
    }
  };

  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-start my-auto">
        {/* Main Title & Subtitle */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1F1F1F] tracking-tight leading-tight mb-2">
          Now, it’s time to give your house a title
        </h1>
        <p className="text-sm font-medium text-zinc-500 mb-10">
          Short title work best. Have fun with it - you can always change it later
        </p>

        {/* Title Input Card Container */}
        <div className="w-full max-w-2xl bg-zinc-50/80 border border-zinc-200/90 rounded-3xl p-6 sm:p-8 flex flex-col shadow-2xs">
          <label htmlFor="property-title" className="text-sm font-semibold text-[#1F1F1F] mb-1">
            Your title
          </label>
          <span className="text-xs font-semibold text-zinc-400 mb-3">
            {title.length}/{maxChars}
          </span>

          <textarea
            id="property-title"
            rows={4}
            maxLength={maxChars}
            value={title}
            onChange={handleChange}
            placeholder="e.g. Cozy Beachside Villa with Private Pool"
            className="w-full bg-white border border-zinc-200 rounded-2xl p-4 text-base font-medium text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-zinc-900/80 resize-none shadow-2xs transition-shadow"
          />
        </div>
      </div>

      {/* Bottom Action Footer Bar */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3 pt-8 border-t border-zinc-100 mt-12">
        <button
          type="button"
          onClick={onBack}
          className="px-7 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-semibold text-zinc-800 transition-colors cursor-pointer"
        >
          Exit
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading || !title.trim()}
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
