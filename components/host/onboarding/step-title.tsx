"use client";

import { Container } from "@/components/ui";
import React from "react";
import { StepProgressFooter } from "./step-progress-footer";

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
    <main className="py-10">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          <div className="max-w-4xl mx-auto w-full flex flex-col items-start my-auto">
            {/* Main Title & Subtitle */}
            <h1 className="mb-2">
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

          <StepProgressFooter
            currentStep={4}
            totalSteps={6}
            onBack={onBack}
            onNext={onNext}
            isLoading={isLoading}
          />
        </div>
      </Container>
    </main>
  );
}
