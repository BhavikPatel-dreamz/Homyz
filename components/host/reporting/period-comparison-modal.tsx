"use client";

import React, { useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";

export interface ComparisonPeriodConfig {
  enabled: boolean;
  timeframe: TimeframeGranularity;
  startDate?: string;
  endDate?: string;
  month?: number;
  year?: number;
  quarter?: number;
  label?: string;
}

interface PeriodComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPeriodLabel: string;
  currentYear: number;
  currentMonth: number;
  onApplyComparison: (config: ComparisonPeriodConfig | null) => void;
  activeComparison?: ComparisonPeriodConfig | null;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function PeriodComparisonModal({
  isOpen,
  onClose,
  currentPeriodLabel,
  currentYear,
  currentMonth,
  onApplyComparison,
  activeComparison,
}: PeriodComparisonModalProps) {
  const [presetType, setPresetType] = useState<"prior_period" | "same_period_last_year" | "custom">(
    activeComparison?.enabled ? (activeComparison.year === currentYear - 1 ? "same_period_last_year" : "custom") : "prior_period"
  );

  const [compareYear, setCompareYear] = useState<number>(
    activeComparison?.year || currentYear - 1
  );
  const [compareMonth, setCompareMonth] = useState<number>(
    activeComparison?.month || currentMonth
  );
  const compareQuarter = Math.ceil(compareMonth / 3);
  const [customStartDate, setCustomStartDate] = useState<string>(
    activeComparison?.startDate || ""
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    activeComparison?.endDate || ""
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApply = () => {
    setErrorMessage(null);

    if (presetType === "prior_period") {
      // Prior period (e.g. prior month or prior quarter)
      onApplyComparison({
        enabled: true,
        timeframe: "monthly",
        month: currentMonth === 1 ? 12 : currentMonth - 1,
        year: currentMonth === 1 ? currentYear - 1 : currentYear,
        label: `Prior period (${currentMonth === 1 ? "Dec " + (currentYear - 1) : MONTHS_SHORT[currentMonth - 2] + " " + currentYear})`,
      });
      onClose();
    } else if (presetType === "same_period_last_year") {
      onApplyComparison({
        enabled: true,
        timeframe: "monthly",
        month: currentMonth,
        year: currentYear - 1,
        label: `Same month last year (${MONTHS_SHORT[currentMonth - 1]} ${currentYear - 1})`,
      });
      onClose();
    } else {
      // Custom comparison
      if (customStartDate && customEndDate) {
        if (customStartDate > customEndDate) {
          setErrorMessage("Comparison start date must be before end date.");
          return;
        }
        onApplyComparison({
          enabled: true,
          timeframe: "custom",
          startDate: customStartDate,
          endDate: customEndDate,
          label: `${customStartDate} – ${customEndDate}`,
        });
        onClose();
      } else {
        onApplyComparison({
          enabled: true,
          timeframe: "monthly",
          month: compareMonth,
          year: compareYear,
          quarter: compareQuarter,
          label: `${MONTHS_SHORT[compareMonth - 1]} ${compareYear}`,
        });
        onClose();
      }
    }
  };

  const handleReset = () => {
    onApplyComparison(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-5 sm:p-8 max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-8 shadow-2xl animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#EDEDED] pb-4">
          <div>
            <h2 className="text-xl font-medium tracking-tight text-[#1F1F1F]">Compare Reporting Periods</h2>
            <p className="mt-1 text-sm text-[#727272]">
              Benchmark your earnings and performance between any two periods
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#727272] hover:bg-zinc-100 hover:text-[#1F1F1F] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Current Period A Banner */}
        <div className="mt-5 rounded-lg border border-[#EDEDED] bg-[#FAFAFA] p-4">
          <p className="text-xs font-medium text-[#727272]">Period A (Primary View)</p>
          <p className="mt-1 text-sm font-medium text-[#1F1F1F]">{currentPeriodLabel}</p>
        </div>

        {/* Comparison Presets */}
        <div className="mt-6 space-y-4">
          <p className="text-sm font-medium text-[#1F1F1F]">Choose Period B (Comparison)</p>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setPresetType("prior_period")}
              className={`rounded-lg border p-3.5 text-left text-sm transition-all cursor-pointer ${
                presetType === "prior_period"
                  ? "border-[#1F1F1F] bg-[#1F1F1F] text-white font-medium"
                  : "border-[#E5E5E5] bg-white text-[#1F1F1F] hover:border-[#1F1F1F]"
              }`}
            >
              <p className="font-medium">Prior Period</p>
              <p className={`mt-0.5 text-xs ${presetType === "prior_period" ? "text-zinc-300" : "text-[#727272]"}`}>
                Preceding interval
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPresetType("same_period_last_year")}
              className={`rounded-lg border p-3.5 text-left text-sm transition-all cursor-pointer ${
                presetType === "same_period_last_year"
                  ? "border-[#1F1F1F] bg-[#1F1F1F] text-white font-medium"
                  : "border-[#E5E5E5] bg-white text-[#1F1F1F] hover:border-[#1F1F1F]"
              }`}
            >
              <p className="font-medium">Prior Year</p>
              <p className={`mt-0.5 text-xs ${presetType === "same_period_last_year" ? "text-zinc-300" : "text-[#727272]"}`}>
                Same dates {currentYear - 1}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPresetType("custom")}
              className={`rounded-lg border p-3.5 text-left text-sm transition-all cursor-pointer ${
                presetType === "custom"
                  ? "border-[#1F1F1F] bg-[#1F1F1F] text-white font-medium"
                  : "border-[#E5E5E5] bg-white text-[#1F1F1F] hover:border-[#1F1F1F]"
              }`}
            >
              <p className="font-medium">Custom</p>
              <p className={`mt-0.5 text-xs ${presetType === "custom" ? "text-zinc-300" : "text-[#727272]"}`}>
                Choose dates
              </p>
            </button>
          </div>

          {/* Custom Date Controls */}
          {presetType === "custom" && (
            <div className="mt-4 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-medium text-[#1f1f1f]">Select Month & Year</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCompareYear((y) => y - 1)}
                      className="rounded-lg p-1 text-[#727272] hover:bg-zinc-200 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="text-xs font-medium text-[#1F1F1F]">{compareYear}</span>
                    <button
                      type="button"
                      onClick={() => setCompareYear((y) => y + 1)}
                      className="rounded-lg p-1 text-[#727272] hover:bg-zinc-200 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {MONTHS_SHORT.map((m, idx) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setCompareMonth(idx + 1);
                        setCustomStartDate("");
                        setCustomEndDate("");
                      }}
                      className={`rounded-lg py-1.5 text-xs font-medium transition-all cursor-pointer ${
                        compareMonth === idx + 1 && !customStartDate
                          ? "bg-[#1F1F1F] text-white"
                          : "border border-[#D7D7D7] bg-white text-[#3F3F3F] hover:bg-zinc-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#EDEDED] pt-3">
                <span className="text-sm font-medium text-[#1f1f1f]">Or specific date range</span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-lg border border-[#D7D7D7] bg-white p-2 text-xs font-medium text-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-hidden"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-lg border border-[#D7D7D7] bg-white p-2 text-xs font-medium text-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-700">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between border-t border-[#EDEDED] pt-5">
          {activeComparison?.enabled ? (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-medium text-rose-700 hover:text-rose-800 cursor-pointer"
            >
              Disable Comparison
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-[#727272] hover:text-[#1F1F1F] cursor-pointer underline underline-offset-2"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-full bg-[#1F1F1F] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#FCDF9C] hover:text-[#1F1F1F] transition-all cursor-pointer"
            >
              Apply Comparison
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
