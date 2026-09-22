"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage, type TranslationKey } from "@/lib/i18n/language-context";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import {
  LISTING_REMOVAL_SURVEY,
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
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Accordion open state: single-open accordion (first open by default)
  const [expandedCategory, setExpandedCategory] = useState<string | null>("no_longer_able");

  // Hosts can provide every reason that applies to their decision.
  const [selectedReasonIds, setSelectedReasonIds] = useState<string[]>([]);
  const [selectedReasonLabels, setSelectedReasonLabels] = useState<string[]>([]);

  // Optional custom feedback for "Another reason"
  const [customFeedback, setCustomFeedback] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const toggleCategoryAccordion = (categoryId: string) => {
    setExpandedCategory((prev) => (prev === categoryId ? null : categoryId));
  };

  const toggleOption = (optionId: string, optionLabel: string) => {
    setSelectedReasonIds((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
    setSelectedReasonLabels((current) =>
      current.includes(optionLabel)
        ? current.filter((label) => label !== optionLabel)
        : [...current, optionLabel],
    );
  };

  const totalSelectedCount = selectedReasonIds.length;
  const hasAnotherReason = selectedReasonLabels.includes("Another reason");

  const handleConfirmRemoval = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        // Collect category title for the selected reason and reason label
        const categoryTitles: string[] = [];
        for (const cat of LISTING_REMOVAL_SURVEY) {
          if (cat.options.some((option) => selectedReasonIds.includes(option.id))) {
            categoryTitles.push(cat.title);
          }
        }

        const reasonLabels = selectedReasonLabels;

        const res = await deleteListingAction(listingId, {
          categories: categoryTitles,
          reasons: reasonLabels,
          customFeedback: customFeedback.trim() || undefined,
        });

        if ((res as Record<string, unknown>)?.error) {
          throw new Error(String((res as Record<string, unknown>).error));
        }

        // Successfully removed! Redirect to host listings dashboard
        onClose();
        router.push("/host/listings");
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : (t("host_remove_error") || "Failed to remove listing. Please try again.")
        );
      }
    });
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={step === 1 ? "remove-listing-survey-title" : "remove-listing-confirm-title"}
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[#1f1f1f] transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
          aria-label={t("host_close") || "Close"}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        {/* STEP 1: Survey Accordions (Matches Airbnb Screenshot 100%) */}
        {step === 1 && (
          <>
            {/* Modal Heading */}
            <div className="border-b border-zinc-100 px-6 pb-5 pt-7 pr-16 dark:border-zinc-800 sm:px-8 sm:pr-16">
              <h2 id="remove-listing-survey-title" className="text-xl font-semibold tracking-tight text-[#1F1F1F] dark:text-zinc-100 sm:text-2xl">
                {t("host_remove_survey_heading") || "Let us know why you've changed your mind about hosting"}
              </h2>
              <p className="mt-2 text-base leading-6 text-[#727272] dark:text-zinc-400">
                {t("host_remove_survey_subtext") || "Choose all that apply."}
              </p>
            </div>

            {/* Scrollable Accordion List */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 divide-y divide-zinc-100 dark:divide-zinc-800">
              {LISTING_REMOVAL_SURVEY.map((category) => {
                const isExpanded = expandedCategory === category.id;
                const categoryTitleKey = `host_remove_survey_cat_${category.id}` as TranslationKey;
                const translatedCategoryTitle = t(categoryTitleKey) || category.title;

                return (
                  <div key={category.id} className="py-1">
                    {/* Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategoryAccordion(category.id)}
                      className="group flex w-full items-center justify-between rounded-xl px-1 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15 dark:hover:bg-zinc-800/60 dark:focus-visible:ring-zinc-100/20"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-white">
                          {translatedCategoryTitle}
                        </span>
                        {/* show badge if any selected and category is collapsed */}
                        {selectedReasonIds.length > 0 && !isExpanded && category.options.some((option) => selectedReasonIds.includes(option.id)) && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-950">
                            {category.options.filter((option) => selectedReasonIds.includes(option.id)).length}
                          </span>
                        )}
                      </div>

                      <svg
                        className={`w-4 h-4 text-zinc-500 dark:text-zinc-400 transition-transform duration-200 shrink-0 ${
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
                      <div className="mt-1 space-y-1.5 px-1 pb-3 animate-in fade-in duration-150">
                        {category.options.map((option) => {
                          const isSelected = selectedReasonIds.includes(option.id);
                          const optionLabelKey = `host_remove_survey_opt_${option.id}` as TranslationKey;
                          const translatedOptionLabel = t(optionLabelKey) || option.label;

                          return (
                            <div key={option.id} className="space-y-2">
                              <label className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleOption(option.id, option.label)}
                                  className="peer sr-only"
                                />
                                <div
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                                    isSelected
                                      ? "border-zinc-950 dark:border-zinc-100 bg-zinc-950 dark:bg-zinc-100"
                                      : "border-zinc-300 dark:border-zinc-700 group-hover:border-zinc-400 dark:group-hover:border-zinc-500 bg-white dark:bg-zinc-800"
                                  }`}
                                >
                                  {isSelected && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-950" />
                                  )}
                                </div>

                                <span className="text-sm leading-5 text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                                  {translatedOptionLabel}
                                </span>
                              </label>

                              {/* Expandable "Another reason" details text input; required when selected */}
                              {isSelected && option.label === "Another reason" && (
                                <div className="animate-in fade-in pb-1 pl-9 pr-1 pt-1 duration-150">
                                  <textarea
                                    rows={2}
                                    placeholder={t("host_remove_survey_tell_us_more") || "Please tell us more"}
                                    value={customFeedback}
                                    onChange={(e) => setCustomFeedback(e.target.value)}
                                    className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 shadow-2xs outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:bg-zinc-800 dark:focus:ring-zinc-100/10"
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
            <div className="flex shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-full border border-[#1f1f1f] bg-white px-7 py-2.5 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:border-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
              >
                {t("host_cancel") || "Cancel"}
              </button>

              <button
                type="button"
                disabled={
                  selectedReasonIds.length === 0 || (hasAnotherReason && customFeedback.trim().length === 0)
                }
                onClick={() => setStep(2)}
                className={`min-h-11 rounded-full bg-[#FEE08B]  px-8 py-2.5 text-sm font-medium text-[#1f1f1f] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FEE08B] focus-visible:ring-offset-2 dark:bg-[#FEE08B] dark:text-[#1f1f1f] dark:focus-visible:ring-offset-zinc-900 ${
                  selectedReasonIds.length > 0 && !(hasAnotherReason && customFeedback.trim().length === 0)
                  ? "cursor-pointer hover:bg-[#1f1f1f]"
                    : "cursor-not-allowed text-[#1f1f1f]/45"
                }`}
              >
                {t("host_next") || "Next"}
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Final Confirmation & Database Submission */}
        {step === 2 && (
          <>
            <div className="border-b border-zinc-100 px-6 pb-5 pt-7 pr-16 dark:border-zinc-800 sm:px-8 sm:pr-16">
              <h2 id="remove-listing-confirm-title" className="text-xl font-semibold tracking-tight text-[#1F1F1F] dark:text-zinc-100 sm:text-2xl">
                {t("host_remove_confirm_heading") || "Permanently remove this listing?"}
              </h2>
              <p className="mt-2 max-w-[491px] text-sm leading-6 text-[#727272] dark:text-zinc-400">
                {t("host_remove_confirm_subtext_prefix") || "You are removing "}
                <strong className="text-[#1f1f1f] dark:text-zinc-100">{listingTitle}</strong>
                {t("host_remove_confirm_subtext_suffix") || " from Homyz."}
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm leading-6 sm:px-8">
              {errorMessage && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {errorMessage}
                </div>
              )}

              {/* Warning Box */}
              <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/30 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-rose-800 dark:text-rose-300">
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {t("host_remove_warning_title") || "This action is permanent"}
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {t("host_remove_warning_body") || "Your listing will be immediately removed from public search. Your photos, descriptions, and settings will no longer be available."}
                </p>
              </div>

              {/* Selected Feedback Summary */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t("host_remove_summary_title", { count: String(totalSelectedCount) }) || `Your Feedback Summary (${totalSelectedCount} reasons)`}
                </div>
                <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
                  {selectedReasonLabels.map((label) => <li key={label}>{label}</li>)}
                </ul>
                {customFeedback && (
                  <div className="border-t border-zinc-200 pt-2 text-sm italic text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                    &ldquo;{customFeedback}&rdquo;
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setStep(1)}
                className="self-start px-2 py-2 text-sm font-semibold text-zinc-700 underline underline-offset-4 transition-colors hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:text-zinc-300 dark:hover:text-white dark:focus-visible:ring-zinc-100"
              >
                {t("host_back") || "Back"}
              </button>

              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={onClose}
                  className="min-h-11 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
                >
                  {t("host_remove_keep_listing") || "Keep listing"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleConfirmRemoval}
                  className="min-h-11 rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-700 dark:hover:bg-rose-600 dark:focus-visible:ring-rose-400 dark:focus-visible:ring-offset-zinc-900"
                >
                  {isPending
                    ? (t("host_remove_confirm_removing") || "Removing...")
                    : (t("host_remove_confirm_btn") || "Permanently remove listing")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </ModalOverlay>
  );
}
