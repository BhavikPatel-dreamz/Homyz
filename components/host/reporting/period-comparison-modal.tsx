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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 sm:p-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-950">Compare Reporting Periods</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Benchmark your earnings and performance between any two periods
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        {/* Current Period A Banner */}
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Period A (Primary View)</p>
          <p className="mt-1 text-sm font-bold text-zinc-950">{currentPeriodLabel}</p>
        </div>

        {/* Comparison Presets */}
        <div className="mt-6 space-y-4">
          <p className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Choose Period B (Comparison)</p>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setPresetType("prior_period")}
              className={`rounded-2xl border p-3.5 text-left text-xs transition-all ${
                presetType === "prior_period"
                  ? "border-zinc-950 bg-zinc-950 text-white font-semibold shadow-xs"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
              }`}
            >
              <p className="font-bold">Prior Period</p>
              <p className={`mt-0.5 text-[11px] ${presetType === "prior_period" ? "text-zinc-300" : "text-zinc-500"}`}>
                Preceding interval
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPresetType("same_period_last_year")}
              className={`rounded-2xl border p-3.5 text-left text-xs transition-all ${
                presetType === "same_period_last_year"
                  ? "border-zinc-950 bg-zinc-950 text-white font-semibold shadow-xs"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
              }`}
            >
              <p className="font-bold">Prior Year</p>
              <p className={`mt-0.5 text-[11px] ${presetType === "same_period_last_year" ? "text-zinc-300" : "text-zinc-500"}`}>
                Same dates {currentYear - 1}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPresetType("custom")}
              className={`rounded-2xl border p-3.5 text-left text-xs transition-all ${
                presetType === "custom"
                  ? "border-zinc-950 bg-zinc-950 text-white font-semibold shadow-xs"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
              }`}
            >
              <p className="font-bold">Custom</p>
              <p className={`mt-0.5 text-[11px] ${presetType === "custom" ? "text-zinc-300" : "text-zinc-500"}`}>
                Choose dates
              </p>
            </button>
          </div>

          {/* Custom Date Controls */}
          {presetType === "custom" && (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-zinc-700">Select Month & Year</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCompareYear((y) => y - 1)}
                      className="rounded-lg p-1 text-sm font-bold text-zinc-600 hover:bg-zinc-200"
                    >
                      ‹
                    </button>
                    <span className="text-xs font-bold text-zinc-950">{compareYear}</span>
                    <button
                      type="button"
                      onClick={() => setCompareYear((y) => y + 1)}
                      className="rounded-lg p-1 text-sm font-bold text-zinc-600 hover:bg-zinc-200"
                    >
                      ›
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
                      className={`rounded-xl py-1.5 text-xs font-semibold transition-all ${
                        compareMonth === idx + 1 && !customStartDate
                          ? "bg-zinc-950 text-white font-bold"
                          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-3">
                <span className="text-xs font-semibold text-zinc-700">Or specific date range</span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-xl border border-zinc-200 bg-white p-2 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:outline-hidden"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-xl border border-zinc-200 bg-white p-2 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-5">
          {activeComparison?.enabled ? (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800"
            >
              Disable Comparison
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-950"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-full bg-zinc-950 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-zinc-800 transition-colors"
            >
              Apply Comparison
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
