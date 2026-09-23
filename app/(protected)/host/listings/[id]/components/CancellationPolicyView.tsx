"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy editor props */

import React, { useState, useEffect, useMemo } from "react";
import { BackButton } from "@/components/ui/back-button";
import { useLanguage } from "@/lib/i18n/language-context";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { cancellationPolicyLabel } from "@/lib/constants/listing-enums";
import { CancellationPolicySkeleton } from "./YourSpaceSkeletons";

interface CancellationPolicyViewProps {
  cancellationPolicy: string;
  setCancellationPolicy: (val: string) => void;
  longTermCancellationPolicy: "FIRM" | "STRICT";
  setLongTermCancellationPolicy: (val: "FIRM" | "STRICT") => void;
  setActiveSection: (s: any) => void;
  setEditorTab?: (tab: "space" | "arrival" | "preferences") => void;
  isSaving: boolean;
  isLoading?: boolean;
  handleSaveSection?: (key: any) => void;
  onSaveCancellationPolicy?: (data: {
    cancellationPolicy: string;
    longTermCancellationPolicy: "FIRM" | "STRICT";
    nonRefundable?: boolean;
  }) => Promise<boolean | void>;
  discounts?: Record<string, unknown> | null;
  nonRefundableDiscountPercentage?: number | null;
}

export function CancellationPolicyView({
  cancellationPolicy,
  setCancellationPolicy,
  longTermCancellationPolicy,
  setLongTermCancellationPolicy,
  setActiveSection,
  isSaving,
  handleSaveSection,
  onSaveCancellationPolicy,
  discounts,
  nonRefundableDiscountPercentage,
  isLoading,
}: CancellationPolicyViewProps) {
  const { t } = useLanguage();

  const shortTermOptions = useMemo(
    () => [
      {
        id: "FLEXIBLE",
        title: t("host_cancellation_policy_flexible"),
        bullets: [
          t("host_cancellation_flexible_b1"),
          t("host_cancellation_flexible_b2"),
        ],
        info: t("host_cancellation_flexible_info"),
      },
      {
        id: "MODERATE",
        title: t("host_cancellation_policy_moderate"),
        bullets: [
          t("host_cancellation_moderate_b1"),
          t("host_cancellation_moderate_b2"),
        ],
        info: t("host_cancellation_moderate_info"),
      },
      {
        id: "LIMITED",
        title: t("host_cancellation_policy_limited"),
        bullets: [
          t("host_cancellation_limited_b1"),
          t("host_cancellation_limited_b2"),
        ],
        info: t("host_cancellation_limited_info"),
      },
      {
        id: "FIRM",
        title: t("host_cancellation_policy_firm"),
        bullets: [
          t("host_cancellation_firm_b1"),
          t("host_cancellation_firm_b2"),
        ],
        info: t("host_cancellation_firm_info"),
      },
    ],
    [t]
  );

  const longTermOptions = useMemo(
    () => [
      {
        id: "FIRM" as const,
        title: t("host_firm_long_term"),
        bullets: [
          t("host_cancellation_firm_long_b1"),
          t("host_cancellation_firm_long_b2"),
        ],
        info: t("host_cancellation_firm_long_info"),
      },
      {
        id: "STRICT" as const,
        title: t("host_strict_long_term"),
        bullets: [
          t("host_cancellation_strict_long_b1"),
          t("host_cancellation_strict_long_b2"),
        ],
        info: t("host_cancellation_strict_long_info"),
      },
    ],
    [t]
  );

  // Modal visibility states
  const [isShortTermModalOpen, setIsShortTermModalOpen] = useState(false);
  const [isLongTermModalOpen, setIsLongTermModalOpen] = useState(false);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [isHelpCentreOpen, setIsHelpCentreOpen] = useState(false);
  const [infoModalTopic, setInfoModalTopic] = useState<{ title: string; info: string } | null>(null);

  // Draft policies selected in modals
  const [draftShortPolicy, setDraftShortPolicy] = useState<string>(
    cancellationPolicy || "FLEXIBLE"
  );
  const [draftLongPolicy, setDraftLongPolicy] = useState<"FIRM" | "STRICT">(
    longTermCancellationPolicy || "FIRM"
  );

  // Non-refundable discount toggle
  const initialNonRefundable = Boolean(
    (discounts as any)?.non_refundable === true ||
    (discounts as any)?.non_refundable?.enabled === true ||
    (discounts as any)?.nonRefundable === true
  );
  const [nonRefundable, setNonRefundable] = useState<boolean>(initialNonRefundable);

  // Sync draft state with props when props change externally
  useEffect(() => {
    setDraftShortPolicy(cancellationPolicy || "FLEXIBLE");
  }, [cancellationPolicy]);

  useEffect(() => {
    setDraftLongPolicy(longTermCancellationPolicy || "FIRM");
  }, [longTermCancellationPolicy]);

  useEffect(() => {
    setNonRefundable(initialNonRefundable);
  }, [initialNonRefundable]);

  // Save handler for Short-term modal
  const handleSaveShortTerm = async () => {
    if (onSaveCancellationPolicy) {
      const res = await onSaveCancellationPolicy({
        cancellationPolicy: draftShortPolicy,
        longTermCancellationPolicy,
        nonRefundable,
      });
      if (res !== false) {
        setIsShortTermModalOpen(false);
      }
    } else {
      setCancellationPolicy(draftShortPolicy);
      handleSaveSection?.("cancellation-policy");
      setIsShortTermModalOpen(false);
    }
  };

  // Save handler for Long-term modal
  const handleSaveLongTerm = async () => {
    if (onSaveCancellationPolicy) {
      const res = await onSaveCancellationPolicy({
        cancellationPolicy,
        longTermCancellationPolicy: draftLongPolicy,
        nonRefundable,
      });
      if (res !== false) {
        setIsLongTermModalOpen(false);
      }
    } else {
      setLongTermCancellationPolicy(draftLongPolicy);
      handleSaveSection?.("cancellation-policy");
      setIsLongTermModalOpen(false);
    }
  };

  // Toggle non-refundable option immediately saves
  const handleToggleNonRefundable = async () => {
    const nextVal = !nonRefundable;
    if (onSaveCancellationPolicy) {
      const result = await onSaveCancellationPolicy({
        cancellationPolicy,
        longTermCancellationPolicy,
        nonRefundable: nextVal,
      });
      if (result !== false) setNonRefundable(nextVal);
    } else {
      setNonRefundable(nextVal);
      handleSaveSection?.("cancellation-policy");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-2xl w-full pb-16 font-sans">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-6">
          <BackButton onClick={() => setActiveSection("pricing")} />
          <h1 className="tracking-[-0.02em] text-2xl font-semibold text-[#1F1F1F] dark:text-zinc-100">
            {t("host_cancellation_policy_title")}
          </h1>
        </div>
      </div>

      {/* Policy Cards List */}
      {isLoading ? (
        <CancellationPolicySkeleton />
      ) : (
        <div className="space-y-4 pt-1">
          {/* 1. Short-term stays Card */}
          <div
            onClick={() => {
              setDraftShortPolicy(cancellationPolicy || "FLEXIBLE");
              setIsShortTermModalOpen(true);
            }}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-700 hover:shadow-xs transition-all flex items-center justify-between group shadow-2xs"
          >
            <div className="space-y-1">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 block">{t("host_short_term_stays_title")}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400 font-normal block">{t("host_short_term_stays_desc")}</span>
              <span className="text-base font-semibold text-[#1F1F1F] dark:text-zinc-100 block pt-1">
                {cancellationPolicyLabel(cancellationPolicy, t)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#1f1f1f] dark:text-zinc-500 group-hover:text-[#1f1f1f] dark:group-hover:text-zinc-300 transition-colors">
              <span className="text-base font-medium text-[#1f1f1f] dark:text-zinc-400 underline group-hover:text-[#1f1f1f] dark:group-hover:text-zinc-100">{t("host_edit")}</span>
              <svg className="w-4 h-4" fill="none" stroke="#1f1f1f" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>

          {/* 2. Long-term stays Card */}
          <div
            onClick={() => {
              setDraftLongPolicy(longTermCancellationPolicy || "FIRM");
              setIsLongTermModalOpen(true);
            }}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-700 hover:shadow-xs transition-all flex items-center justify-between group shadow-2xs"
          >
            <div className="space-y-1">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 block">{t("host_long_term_stays_title")}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400 font-normal block">{t("host_long_term_stays_desc")}</span>
              <span className="text-base font-semibold text-[#1F1F1F] dark:text-zinc-100 block pt-1">
                {longTermCancellationPolicy === "STRICT" ? t("host_strict_long_term") : t("host_firm_long_term")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#1f1f1f] dark:text-zinc-500 group-hover:text-[#1f1f1f] dark:group-hover:text-zinc-300 transition-colors">
              <span className="text-base font-medium text-[#1f1f1f] dark:text-zinc-400 underline group-hover:text-[#1f1f1f] dark:group-hover:text-zinc-100">{t("host_edit")}</span>
              <svg className="w-4 h-4" fill="none" stroke="#1f1f1f" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>

          {/* 3. Non-refundable option Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex items-center justify-between gap-4 shadow-2xs">
            <div className="space-y-1 max-w-md">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 block">
                {t("host_non_refundable_option_title")}
              </span>
              <p className="text-sm text-[#727272] dark:text-zinc-400 font-normal leading-relaxed">
                {nonRefundableDiscountPercentage
                  ? t("host_non_refundable_option_desc_pct", { percentage: nonRefundableDiscountPercentage })
                  : t("host_non_refundable_option_desc_no_pct")}{" "}
                <button
                  type="button"
                  onClick={() => setIsLearnMoreOpen(true)}
                  className="text-zinc-900 dark:text-zinc-100 underline font-medium hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
                >
                  {t("host_safety_learn_more")}
                </button>
              </p>
            </div>

            {/* Toggle switch matching other editor toggles */}
            <button
              type="button"
              role="switch"
              aria-label={t("host_toggle_non_refundable_aria")}
              aria-checked={nonRefundable}
              disabled={isSaving}
              onClick={handleToggleNonRefundable}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${nonRefundable ? "bg-[#DF4557] dark:bg-amber-400" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 transition-transform ${nonRefundable ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Footer note with Help Centre link */}
      <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed pt-2">
        {t("host_cancellation_footer_note_prefix")}
        <button
          type="button"
          onClick={() => setIsHelpCentreOpen(true)}
          className="text-zinc-900 dark:text-zinc-100 underline font-medium hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
        >
          {t("host_help_centre")}
        </button>
        .
      </p>

      {/* ============================================================ */}
      {/* MODAL: SHORT-TERM STAYS POLICY SELECTION                    */}
      {/* ============================================================ */}
      {isShortTermModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 border border-zinc-150 dark:border-zinc-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 dark:border-zinc-800 flex items-start justify-between">
              <div className="space-y-0.5">
                <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F] dark:text-zinc-100">
                  {t("host_short_term_stays_title")}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  {t("host_short_term_stays_desc")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraftShortPolicy(cancellationPolicy || "FLEXIBLE");
                  setIsShortTermModalOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Options list */}
            <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
              {shortTermOptions.map((option) => {
                const isSelected = draftShortPolicy === option.id;
                return (
                  <div
                    key={option.id}
                    onClick={() => setDraftShortPolicy(option.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative shadow-2xs ${isSelected
                      ? "border-2 border-zinc-900 dark:border-zinc-100 bg-zinc-50/40 dark:bg-zinc-800/60 shadow-xs"
                      : "border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-bold text-[#1F1F1F] dark:text-zinc-100 block">{option.title}</span>
                      <button
                        type="button"
                        aria-label={t("host_cancellation_info_aria", { title: option.title })}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInfoModalTopic({ title: option.title, info: option.info });
                        }}
                        className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-900 dark:hover:border-zinc-100 flex items-center justify-center text-xs font-serif italic cursor-pointer transition-colors"
                      >
                        i
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {option.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                          <span className="text-zinc-400 dark:text-zinc-500 select-none">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 dark:border-zinc-800 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/60">
              <button
                type="button"
                onClick={() => {
                  setDraftShortPolicy(cancellationPolicy || "FLEXIBLE");
                  setIsShortTermModalOpen(false);
                }}
                className="rounded-full border border-[#1f1f1f] hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] font-medium hover:text-white text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {t("host_house_rules_cancel")}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveShortTerm}
                className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F] hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving && (
                  <svg className="w-3.5 h-3.5 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {isSaving ? t("host_saving") : t("host_save")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL: LONG-TERM STAYS POLICY SELECTION                     */}
      {/* ============================================================ */}
      {isLongTermModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 border border-zinc-150 dark:border-zinc-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 dark:border-zinc-800 flex items-start justify-between">
              <div className="space-y-0.5">
                <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F] dark:text-zinc-100">
                  {t("host_long_term_stays_title")}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  {t("host_long_term_stays_desc")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraftLongPolicy(longTermCancellationPolicy || "FIRM");
                  setIsLongTermModalOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Options list */}
            <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
              {longTermOptions.map((option) => {
                const isSelected = draftLongPolicy === option.id;
                return (
                  <div
                    key={option.id}
                    onClick={() => setDraftLongPolicy(option.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative shadow-2xs ${isSelected
                      ? "border-2 border-zinc-900 dark:border-zinc-100 bg-zinc-50/40 dark:bg-zinc-800/60 shadow-xs"
                      : "border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-bold text-[#1F1F1F] dark:text-zinc-100 block">{option.title}</span>
                      <button
                        type="button"
                        aria-label={t("host_cancellation_info_aria", { title: option.title })}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInfoModalTopic({ title: option.title, info: option.info });
                        }}
                        className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-900 dark:hover:border-zinc-100 flex items-center justify-center text-xs font-serif italic cursor-pointer transition-colors"
                      >
                        i
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {option.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                          <span className="text-zinc-400 dark:text-zinc-500 select-none">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 dark:border-zinc-800 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/60">
              <button
                type="button"
                onClick={() => {
                  setDraftLongPolicy(longTermCancellationPolicy || "FIRM");
                  setIsLongTermModalOpen(false);
                }}
                className="rounded-full border border-[#1f1f1f] hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] font-medium hover:text-white text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {t("host_house_rules_cancel")}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveLongTerm}
                className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F] hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving && (
                  <svg className="w-3.5 h-3.5 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {isSaving ? t("host_saving") : t("host_save")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL: Policy Info Detail Popover (z-[60] on top of modals) */}
      {/* ============================================================ */}
      {infoModalTopic && (
        <ModalOverlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 border border-zinc-150 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-normal text-[#1f1f1f] dark:text-zinc-100">
                {t("host_cancellation_detail_popover_title", { title: infoModalTopic.title })}
              </h3>
              <button
                type="button"
                onClick={() => setInfoModalTopic(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {infoModalTopic.info}
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModalTopic(null)}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs px-6 py-2 transition-all cursor-pointer"
              >
                {t("host_got_it")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL: Non-refundable "Learn more" Modal                     */}
      {/* ============================================================ */}
      {isLearnMoreOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 border border-zinc-150 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-normal text-[#1f1f1f] dark:text-zinc-100">
                {t("host_non_refundable_option_title")}
              </h3>
              <button
                type="button"
                onClick={() => setIsLearnMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p>
                {t("host_non_refundable_learn_p1")}
              </p>
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">{t("host_non_refundable_learn_how")}</span>
                <ul className="space-y-1.5 list-disc list-inside text-zinc-600 dark:text-zinc-300">
                  <li>{t("host_non_refundable_learn_b1")}</li>
                  <li>{t("host_non_refundable_learn_b2")}</li>
                  <li>{t("host_non_refundable_learn_b3")}</li>
                  <li>{t("host_non_refundable_learn_b4")}</li>
                </ul>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLearnMoreOpen(false)}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs px-6 py-2 transition-all cursor-pointer"
              >
                {t("host_done")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL: Help Centre Modal                                    */}
      {/* ============================================================ */}
      {isHelpCentreOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95 border border-zinc-150 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-normal text-[#1f1f1f] dark:text-zinc-100">
                {t("host_help_centre_modal_title")}
              </h3>
              <button
                type="button"
                onClick={() => setIsHelpCentreOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <p>
                {t("host_help_centre_intro")}
              </p>
              <div className="space-y-2.5 pt-1">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">{t("host_cancellation_policy_flexible")}</span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{t("host_help_centre_flexible_desc")}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">{t("host_cancellation_policy_moderate")}</span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{t("host_help_centre_moderate_desc")}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">{t("host_cancellation_policy_limited")}</span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{t("host_help_centre_limited_desc")}</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">{t("host_cancellation_policy_firm")}</span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{t("host_help_centre_firm_desc")}</p>
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHelpCentreOpen(false)}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs px-6 py-2 transition-all cursor-pointer"
              >
                {t("host_safety_close")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
