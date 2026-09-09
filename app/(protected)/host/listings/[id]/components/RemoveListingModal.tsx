"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import {
  LISTING_REMOVAL_SURVEY,
  type RemovalCategory,
} from "@/lib/validation/listing-removal";
import { deleteListingAction } from "@/actions/host/listings";

interface RemoveListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
}

export function RemoveListingModal({
  isOpen,
  onClose,
  listingId,
  listingTitle,
}: RemoveListingModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Accordion open states (first accordion open by default, as in Airbnb)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    no_longer_able: true,
  });

  // Selected reasons state: set of option ids
  const [selectedReasons, setSelectedReasons] = useState<Record<string, string>>({});
  // Mapping of categoryId -> Set of selected reason IDs
  const [selectedCategoryMap, setSelectedCategoryMap] = useState<Record<string, string[]>>({});

  // Optional custom feedback for "Another reason"
  const [customFeedback, setCustomFeedback] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const toggleCategoryAccordion = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const toggleOption = (category: RemovalCategory, optionId: string, optionLabel: string) => {
    setSelectedReasons((prev) => {
      const next = { ...prev };
      if (next[optionId]) {
        delete next[optionId];
      } else {
        next[optionId] = optionLabel;
      }
      return next;
    });

    setSelectedCategoryMap((prev) => {
      const currentList = prev[category.id] || [];
      const exists = currentList.includes(optionId);
      const nextList = exists
        ? currentList.filter((id) => id !== optionId)
        : [...currentList, optionId];

      const nextMap = { ...prev };
      if (nextList.length === 0) {
        delete nextMap[category.id];
      } else {
        nextMap[category.id] = nextList;
      }
      return nextMap;
    });
  };

  const totalSelectedCount = Object.keys(selectedReasons).length;

  const handleConfirmRemoval = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        // Collect category titles and reason labels
        const categoryTitles: string[] = [];
        for (const cat of LISTING_REMOVAL_SURVEY) {
          if (selectedCategoryMap[cat.id] && selectedCategoryMap[cat.id].length > 0) {
            categoryTitles.push(cat.title);
          }
        }

        const reasonLabels = Object.values(selectedReasons);

        const res = await deleteListingAction(listingId, {
          categories: categoryTitles,
          reasons: reasonLabels,
          customFeedback: customFeedback.trim() || undefined,
        });

        if ((res as any)?.error) {
          throw new Error((res as any).error);
        }

        // Successfully removed! Redirect to host listings dashboard
        onClose();
        router.push("/host/listings");
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to remove listing. Please try again.");
      }
    });
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-200">
        {/* Top Bar with Close Button */}
        <div className="px-6 pt-5 pb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 text-xs transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* STEP 1: Survey Accordions (Matches Airbnb Screenshot 100%) */}
        {step === 1 && (
          <>
            {/* Modal Heading */}
            <div className="px-6 pb-4">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1F1F1F]">
                Let us know why you&apos;ve changed your mind about hosting
              </h2>
              <p className="text-xs text-zinc-500 font-normal mt-1">Choose all that apply</p>
            </div>

            {/* Scrollable Accordion List */}
            <div className="flex-1 overflow-y-auto px-6 divide-y divide-zinc-100 space-y-1">
              {LISTING_REMOVAL_SURVEY.map((category) => {
                const isExpanded = !!expandedCategories[category.id];
                const selectedInThisCategory = selectedCategoryMap[category.id] || [];

                return (
                  <div key={category.id} className="pt-3 pb-3">
                    {/* Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategoryAccordion(category.id)}
                      className="w-full flex items-center justify-between text-left py-1 group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-zinc-900 group-hover:text-zinc-950">
                          {category.title}
                        </span>
                        {selectedInThisCategory.length > 0 && !isExpanded && (
                          <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-[10px] font-bold flex items-center justify-center">
                            {selectedInThisCategory.length}
                          </span>
                        )}
                      </div>

                      <svg
                        className={`w-4 h-4 text-zinc-500 transition-transform duration-200 shrink-0 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2.5 pl-0.5 animate-in fade-in duration-150">
                        {category.options.map((option) => {
                          const isSelected = !!selectedReasons[option.id];

                          return (
                            <div key={option.id} className="space-y-2">
                              <label
                                onClick={() => toggleOption(category, option.id, option.label)}
                                className="flex items-center gap-3 py-1 cursor-pointer group"
                              >
                                {/* Round Radio / Checkbox matching Airbnb */}
                                <div
                                  className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                    isSelected
                                      ? "border-zinc-950 bg-zinc-950"
                                      : "border-zinc-300 group-hover:border-zinc-400 bg-white"
                                  }`}
                                >
                                  {isSelected && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                </div>

                                <span className="text-xs text-zinc-700 group-hover:text-zinc-900 font-normal leading-tight">
                                  {option.label}
                                </span>
                              </label>

                              {/* Expandable "Another reason" details text input */}
                              {isSelected && option.label === "Another reason" && (
                                <div className="pl-7 pr-1 pt-1 pb-1 animate-in fade-in duration-150">
                                  <textarea
                                    rows={2}
                                    placeholder="Please tell us more (optional)"
                                    value={customFeedback}
                                    onChange={(e) => setCustomFeedback(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:bg-white focus:border-zinc-400 resize-none transition-all shadow-2xs"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-200 px-6 py-4 flex items-center justify-between bg-white shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 underline underline-offset-4 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={totalSelectedCount === 0}
                onClick={() => setStep(2)}
                className={`rounded-full px-6 py-2.5 text-xs font-semibold transition-all shadow-2xs ${
                  totalSelectedCount > 0
                    ? "bg-zinc-950 hover:bg-zinc-800 text-white cursor-pointer"
                    : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                }`}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Final Confirmation & Database Submission */}
        {step === 2 && (
          <>
            <div className="px-6 pb-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1F1F1F]">
                Permanently remove this listing?
              </h2>
              <p className="text-xs text-zinc-500 font-normal mt-1">
                You are removing <strong>{listingTitle}</strong> from Homyz.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4 text-xs font-sans">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Warning Box */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-2">
                <div className="font-semibold text-rose-800 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  This action is permanent
                </div>
                <p className="text-zinc-600 leading-relaxed">
                  Your listing will be immediately removed from public search. Your photos, descriptions, and settings will no longer be available.
                </p>
              </div>

              {/* Selected Feedback Summary */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Your Feedback Summary ({totalSelectedCount} reasons)
                </div>
                <ul className="space-y-1 text-zinc-700 list-disc pl-4 text-[11px]">
                  {Object.values(selectedReasons).map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
                {customFeedback && (
                  <div className="pt-2 border-t border-zinc-200 text-[11px] text-zinc-600 italic">
                    &ldquo;{customFeedback}&rdquo;
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-200 px-6 py-4 flex items-center justify-between bg-white shrink-0">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 underline underline-offset-4 cursor-pointer"
              >
                Back
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={onClose}
                  className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-semibold text-xs px-5 py-2.5 transition-all shadow-2xs cursor-pointer"
                >
                  Keep listing
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleConfirmRemoval}
                  className="rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-6 py-2.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Removing..." : "Permanently remove listing"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}

