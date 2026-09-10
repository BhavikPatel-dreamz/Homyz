"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy editor props */

import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/ui/back-button";
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
}

const SHORT_TERM_OPTIONS = [
  {
    id: "FLEXIBLE",
    title: "Flexible",
    bullets: [
      "Full refund at least 1 day before check-in",
      "Partial refund within 1 day of check-in",
    ],
    info: "Guests can cancel up to 24 hours before check-in for a full refund. If they cancel after that, you'll be paid for each night they stay, plus 1 additional night.",
  },
  {
    id: "MODERATE",
    title: "Moderate",
    bullets: [
      "Full refund at least 5 days before check-in",
      "Partial refund within 5 days of check-in",
    ],
    info: "Guests can cancel up to 5 days before check-in for a full refund. If they cancel after that, you'll be paid for all nights spent plus 50% for unspent nights.",
  },
  {
    id: "LIMITED",
    title: "Limited",
    bullets: [
      "Full refund at least 14 days before check-in",
      "Partial refund 7–14 days before check-in",
    ],
    info: "Guests can cancel at least 14 days before check-in for a full refund. Between 7 and 14 days before check-in, guests receive a 50% refund for unspent nights.",
  },
  {
    id: "FIRM",
    title: "Firm",
    bullets: [
      "Full refund at least 30 days before check-in",
      "Partial refund 7–30 days before check-in",
    ],
    info: "Guests can cancel up to 30 days before check-in for a full refund. Between 7 and 30 days before check-in, guests receive a 50% refund for unspent nights.",
  },
];

const LONG_TERM_OPTIONS = [
  {
    id: "FIRM" as const,
    title: "Firm Long-Term",
    bullets: [
      "Full refund up to 30 days before check-in",
      "After that, the first 30 days of the stay are non-refundable",
    ],
    info: "For stays of 28 nights or longer. Full refund if cancelled up to 30 days before check-in. If cancelled less than 30 days before check-in, the host receives 100% for the first 30 days.",
  },
  {
    id: "STRICT" as const,
    title: "Strict Long-Term",
    bullets: [
      "Full refund if cancelled within 48 hours of booking and at least 28 days before check-in",
      "After that, the first 30 days of the stay are non-refundable",
    ],
    info: "For stays of 28 nights or longer. Full refund only if cancelled within 48 hours of booking and at least 28 days before check-in. After that, the first 30 days of the stay are non-refundable.",
  },
];

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
  isLoading,
}: CancellationPolicyViewProps) {
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
    setNonRefundable(nextVal);
    if (onSaveCancellationPolicy) {
      await onSaveCancellationPolicy({
        cancellationPolicy,
        longTermCancellationPolicy,
        nonRefundable: nextVal,
      });
    } else {
      handleSaveSection?.("cancellation-policy");
    }
  };



  return (
    <div className="space-y-6 animate-in fade-in max-w-2xl w-full pb-16 font-sans">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => setActiveSection("description")} />
          <h1 className="text-2xl font-bold tracking-tight text-[#1F1F1F]">
            Cancellation policy
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
          className="rounded-2xl border border-zinc-200 bg-white p-5 cursor-pointer hover:border-zinc-400 hover:shadow-xs transition-all flex items-center justify-between group shadow-2xs"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-zinc-900 block">Short-term stays</span>
            <span className="text-xs text-zinc-500 font-normal block">For less than 28 nights</span>
            <span className="text-base font-bold text-[#1F1F1F] block pt-1">
              {cancellationPolicyLabel(cancellationPolicy)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-700 transition-colors">
            <span className="text-xs font-medium text-zinc-600 underline group-hover:text-zinc-900">Edit</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
          className="rounded-2xl border border-zinc-200 bg-white p-5 cursor-pointer hover:border-zinc-400 hover:shadow-xs transition-all flex items-center justify-between group shadow-2xs"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-zinc-900 block">Long-term stays</span>
            <span className="text-xs text-zinc-500 font-normal block">For 28 nights or more</span>
            <span className="text-base font-bold text-[#1F1F1F] block pt-1">
              {longTermCancellationPolicy === "STRICT" ? "Strict Long-Term" : "Firm Long-Term"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-700 transition-colors">
            <span className="text-xs font-medium text-zinc-600 underline group-hover:text-zinc-900">Edit</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>

        {/* 3. Non-refundable option Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 flex items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1 max-w-md">
            <span className="text-xs font-semibold text-zinc-900 block">
              Non-refundable option
            </span>
            <p className="text-xs text-zinc-500 font-normal leading-relaxed">
              For short-term stays, guests pay 10% less for you to keep your full payout if they cancel.{" "}
              <button
                type="button"
                onClick={() => setIsLearnMoreOpen(true)}
                className="text-zinc-900 underline font-semibold hover:text-zinc-700 cursor-pointer"
              >
                Learn more
              </button>
            </p>
          </div>

          {/* Toggle switch matching other editor toggles */}
          <button
            type="button"
            role="switch"
            aria-label="Toggle non-refundable option"
            aria-checked={nonRefundable}
            disabled={isSaving}
            onClick={handleToggleNonRefundable}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              nonRefundable ? "bg-[#E9C979]" : "bg-zinc-300"
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-zinc-200 transition-transform ${
                nonRefundable ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
      )}

      {/* Footer note with Help Centre link */}
      <p className="text-xs text-zinc-500 leading-relaxed pt-2">
        All standard stay policies include a 24-hour free cancellation period. Review the full policies in the{" "}
        <button
          type="button"
          onClick={() => setIsHelpCentreOpen(true)}
          className="text-zinc-900 underline font-semibold hover:text-zinc-700 cursor-pointer"
        >
          Help Centre
        </button>
        .
      </p>

      {/* ============================================================ */}
      {/* MODAL: SHORT-TERM STAYS POLICY SELECTION                    */}
      {/* ============================================================ */}
      {isShortTermModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 border border-zinc-150 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 flex items-start justify-between">
              <div className="space-y-0.5">
                <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">
                  Short-term stays
                </h3>
                <p className="text-xs text-zinc-500 font-normal">
                  For less than 28 nights
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraftShortPolicy(cancellationPolicy || "FLEXIBLE");
                  setIsShortTermModalOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600 transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Options list */}
            <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
              {SHORT_TERM_OPTIONS.map((option) => {
                const isSelected = draftShortPolicy === option.id;
                return (
                  <div
                    key={option.id}
                    onClick={() => setDraftShortPolicy(option.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative shadow-2xs ${
                      isSelected
                        ? "border-2 border-zinc-900 bg-zinc-50/40 shadow-xs"
                        : "border border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-bold text-[#1F1F1F] block">{option.title}</span>
                      <button
                        type="button"
                        aria-label={`Info for ${option.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInfoModalTopic({ title: option.title, info: option.info });
                        }}
                        className="w-5 h-5 rounded-full border border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:border-zinc-900 flex items-center justify-center text-xs font-serif italic cursor-pointer transition-colors"
                      >
                        i
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                      {option.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                          <span className="text-zinc-400 select-none">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60">
              <button
                type="button"
                onClick={() => {
                  setDraftShortPolicy(cancellationPolicy || "FLEXIBLE");
                  setIsShortTermModalOpen(false);
                }}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveShortTerm}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
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
          <div className="bg-white rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 border border-zinc-150 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 flex items-start justify-between">
              <div className="space-y-0.5">
                <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">
                  Long-term stays
                </h3>
                <p className="text-xs text-zinc-500 font-normal">
                  For 28 nights or more
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraftLongPolicy(longTermCancellationPolicy || "FIRM");
                  setIsLongTermModalOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600 transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Options list */}
            <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
              {LONG_TERM_OPTIONS.map((option) => {
                const isSelected = draftLongPolicy === option.id;
                return (
                  <div
                    key={option.id}
                    onClick={() => setDraftLongPolicy(option.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative shadow-2xs ${
                      isSelected
                        ? "border-2 border-zinc-900 bg-zinc-50/40 shadow-xs"
                        : "border border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-bold text-[#1F1F1F] block">{option.title}</span>
                      <button
                        type="button"
                        aria-label={`Info for ${option.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInfoModalTopic({ title: option.title, info: option.info });
                        }}
                        className="w-5 h-5 rounded-full border border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:border-zinc-900 flex items-center justify-center text-xs font-serif italic cursor-pointer transition-colors"
                      >
                        i
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                      {option.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                          <span className="text-zinc-400 select-none">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60">
              <button
                type="button"
                onClick={() => {
                  setDraftLongPolicy(longTermCancellationPolicy || "FIRM");
                  setIsLongTermModalOpen(false);
                }}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveLongTerm}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
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
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 border border-zinc-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1F1F1F]">
                {infoModalTopic.title} policy details
              </h3>
              <button
                type="button"
                onClick={() => setInfoModalTopic(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {infoModalTopic.info}
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModalTopic(null)}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium px-6 py-2 cursor-pointer transition-colors"
              >
                Got it
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 border border-zinc-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1F1F1F]">
                Non-refundable option
              </h3>
              <button
                type="button"
                onClick={() => setIsLearnMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-600 leading-relaxed">
              <p>
                When you offer a non-refundable rate, guests can choose to pay 10% less at checkout in exchange for giving up their refund if they cancel.
              </p>
              <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 space-y-2">
                <span className="font-semibold text-zinc-900 block">How it works:</span>
                <ul className="space-y-1.5 list-disc list-inside text-zinc-600">
                  <li>You keep your full payout if a guest cancels.</li>
                  <li>Guests receive a 10% discount off the base nightly price.</li>
                  <li>Applies to short-term stays (fewer than 28 nights).</li>
                  <li>Helpful for attracting price-sensitive travelers and locking in bookings.</li>
                </ul>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLearnMoreOpen(false)}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium px-6 py-2 cursor-pointer transition-colors"
              >
                Done
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95 border border-zinc-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1F1F1F]">
                Standard stay cancellation policies
              </h3>
              <button
                type="button"
                onClick={() => setIsHelpCentreOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-600 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <p>
                All standard stay policies include a 24-hour free cancellation grace period after booking, provided the booking is made at least 48 hours before check-in.
              </p>
              <div className="space-y-2.5 pt-1">
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="font-semibold text-zinc-900 block">Flexible</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Full refund up to 24 hours prior to check-in.</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="font-semibold text-zinc-900 block">Moderate</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Full refund up to 5 days prior to check-in.</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="font-semibold text-zinc-900 block">Limited</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Full refund up to 14 days prior; 50% between 7 and 14 days.</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="font-semibold text-zinc-900 block">Firm</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Full refund up to 30 days prior; 50% between 7 and 30 days.</p>
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHelpCentreOpen(false)}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium px-6 py-2 cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
