"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { resolveComparisonPeriod, type EarningsComparisonPreset, type TimeframeGranularity } from "@/lib/dashboard/reporting-filter";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/host/account-settings/icons";

export type ComparisonSelection = EarningsComparisonPreset | "custom_month" | "custom_range";

export interface ComparisonPeriodConfig {
  enabled: boolean;
  /** Period B is always sent as explicit UTC calendar boundaries. */
  timeframe: TimeframeGranularity;
  startDate: string;
  endDate: string;
  label: string;
  preset: ComparisonSelection;
}

interface PeriodComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPeriodLabel: string;
  currentStartDate: string;
  currentEndDate: string;
  currentTimeframe: TimeframeGranularity;
  onApplyComparison: (config: ComparisonPeriodConfig | null) => void;
  activeComparison?: ComparisonPeriodConfig | null;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const todayKey = () => new Date().toISOString().slice(0, 10);

function parseCalendarDate(value: string) {
  if (!DATE_KEY.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function dateKey(date: Date) { return date.toISOString().slice(0, 10); }

function monthRange(year: number, month: number) {
  return { startDate: dateKey(new Date(Date.UTC(year, month - 1, 1))), endDate: dateKey(new Date(Date.UTC(year, month, 0))) };
}

function labelForRange(startDate: string, endDate: string) {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate);
  if (!start || !end) return `${startDate} – ${endDate}`;
  const formatter = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function PeriodComparisonModal({ isOpen, onClose, currentPeriodLabel, currentStartDate, currentEndDate, currentTimeframe, onApplyComparison, activeComparison }: PeriodComparisonModalProps) {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const initialStart = activeComparison?.startDate ? parseCalendarDate(activeComparison.startDate) : null;
  const [selection, setSelection] = useState<ComparisonSelection>(() => activeComparison?.preset || "prior_period");
  const [compareYear, setCompareYear] = useState(() => initialStart?.getUTCFullYear() || currentYear - 1);
  const [compareMonth, setCompareMonth] = useState(() => initialStart ? initialStart.getUTCMonth() + 1 : currentMonth);
  const [customStartDate, setCustomStartDate] = useState(() => activeComparison?.startDate || "");
  const [customEndDate, setCustomEndDate] = useState(() => activeComparison?.endDate || "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const primaryStart = parseCalendarDate(currentStartDate);
  const primaryEnd = parseCalendarDate(currentEndDate);
  const primaryDuration = primaryStart && primaryEnd ? Math.floor((primaryEnd.getTime() - primaryStart.getTime()) / 86_400_000) + 1 : 0;
  const selectedMonthIsFuture = compareYear > currentYear || (compareYear === currentYear && compareMonth > currentMonth);
  const applyDisabled = !primaryStart || !primaryEnd || primaryDuration < 1 || (selection === "custom_month" && selectedMonthIsFuture) || (selection === "custom_range" && (!customStartDate || !customEndDate));
  const select = (next: ComparisonSelection) => { setSelection(next); setErrorMessage(null); };

  const handleApply = () => {
    setErrorMessage(null);
    if (!primaryStart || !primaryEnd || primaryDuration < 1) {
      setErrorMessage("The current reporting period is invalid. Refresh Earnings and try again.");
      return;
    }
    if (selection === "prior_period" || selection === "prior_year") {
      const range = resolveComparisonPeriod({ timeframe: currentTimeframe, startDate: primaryStart, endDate: primaryEnd, durationDays: primaryDuration }, selection);
      onApplyComparison({ enabled: true, timeframe: "custom", startDate: range.startDateKey, endDate: range.endDateKey, label: range.label, preset: selection });
      onClose();
      return;
    }
    const monthSelection = monthRange(compareYear, compareMonth);
    const startDate = selection === "custom_month" ? monthSelection.startDate : customStartDate;
    const endDate = selection === "custom_month" ? monthSelection.endDate : customEndDate;
    const start = parseCalendarDate(startDate);
    const end = parseCalendarDate(endDate);
    if (!start || !end) {
      setErrorMessage("Enter valid start and end dates.");
      return;
    }
    if (start > end) {
      setErrorMessage("Comparison end date must be on or after the start date.");
      return;
    }
    if (endDate > todayKey()) {
      setErrorMessage("Future comparison periods are unavailable.");
      return;
    }
    onApplyComparison({ enabled: true, timeframe: "custom", startDate, endDate, label: labelForRange(startDate, endDate), preset: selection });
    onClose();
  };

  // The host header uses z-99; this overlay must sit above it so the backdrop
  // blocks every interactive surface while a reporting comparison is open.
  return (
    <ModalOverlay
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="earnings-comparison-title"
        onClick={(event) => event.stopPropagation()}
        className="relative mx-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-5 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2
              id="earnings-comparison-title"
              className="text-xl font-medium tracking-tight text-[#1F1F1F]"
            >
              Compare Reporting Periods
            </h2>
            <p className="mt-1 text-xs text-[#727272]">
              Compare realised earnings using the same property and currency scope.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close comparison"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-[#727272] hover:bg-zinc-100 hover:text-[#1F1F1F] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Period A Card */}
        <div className="mt-5 rounded-2xl border border-white bg-[#F3F4F5] p-4 shadow-[0_2px_4px_0px_#00000040]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded-full border border-zinc-200/80 bg-white px-2.5 py-1.5 text-xs font-medium text-[#727272]">
              Period A · Primary
            </span>
            <span className="text-xs font-medium text-[#727272]">Active Baseline</span>
          </div>
          <p className="mt-2 text-base font-medium text-[#1F1F1F]">
            {currentPeriodLabel}
          </p>
          <p className="mt-0.5 text-xs text-[#727272]">
            {currentStartDate} to {currentEndDate}
          </p>
        </div>

        {/* Period B Options */}
        <div className="mt-6 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#727272]">
            Choose Period B (Comparison)
          </p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Choice
              selected={selection === "prior_period"}
              title="Prior Period"
              detail="Equivalent preceding days"
              onClick={() => select("prior_period")}
            />
            <Choice
              selected={selection === "prior_year"}
              title="Prior Year"
              detail="Matching calendar dates"
              onClick={() => select("prior_year")}
            />
            <Choice
              selected={selection === "custom_month" || selection === "custom_range"}
              title="Custom"
              detail="Choose a month or dates"
              onClick={() => select("custom_month")}
            />
          </div>

          {(selection === "custom_month" || selection === "custom_range") && (
            <div className="space-y-4 rounded-2xl border border-white bg-[#F3F4F5] p-4 shadow-[0_2px_4px_0px_#00000040]">
              <div className="grid grid-cols-2 rounded-xl border border-zinc-200/80 bg-white p-1 text-sm font-medium shadow-2xs">
                <button
                  type="button"
                  onClick={() => select("custom_month")}
                  className={`rounded-lg py-2 transition-all cursor-pointer ${
                    selection === "custom_month"
                      ? "bg-[#1F1F1F] text-white shadow-2xs font-medium"
                      : "text-[#727272] hover:text-[#1F1F1F]"
                  }`}
                >
                  Month & year
                </button>
                <button
                  type="button"
                  onClick={() => select("custom_range")}
                  className={`rounded-lg py-2 transition-all cursor-pointer ${
                    selection === "custom_range"
                      ? "bg-[#1F1F1F] text-white shadow-2xs font-medium"
                      : "text-[#727272] hover:text-[#1F1F1F]"
                  }`}
                >
                  Specific dates
                </button>
              </div>

              {selection === "custom_month" ? (
                <div>
                  <div className="flex items-center justify-between pb-2.5">
                    <span className="text-xs font-medium text-[#1F1F1F]">
                      Select Month & Year
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Previous comparison year"
                        onClick={() => setCompareYear((year) => year - 1)}
                        className="flex size-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-medium text-[#1F1F1F] shadow-2xs transition-colors hover:bg-zinc-100 hover:border-zinc-300 cursor-pointer"
                      >
                        <ChevronLeftIcon size={14} />
                      </button>
                      <span className="min-w-10 text-center text-xs font-medium text-[#1F1F1F]">
                        {compareYear}
                      </span>
                      <button
                        type="button"
                        aria-label="Next comparison year"
                        disabled={compareYear >= currentYear}
                        onClick={() => setCompareYear((year) => year + 1)}
                        className="flex size-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-medium text-[#1F1F1F] shadow-2xs transition-colors hover:bg-zinc-100 hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRightIcon size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {MONTHS_SHORT.map((month, index) => {
                      const monthNumber = index + 1;
                      const unavailable =
                        compareYear > currentYear ||
                        (compareYear === currentYear && monthNumber > currentMonth);
                      const isSelected = compareMonth === monthNumber;
                      return (
                        <button
                          key={month}
                          type="button"
                          disabled={unavailable}
                          onClick={() => {
                            setCompareMonth(monthNumber);
                            setErrorMessage(null);
                          }}
                          className={`rounded-xl py-2 text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#1F1F1F] text-white shadow-xs font-medium"
                              : "border border-zinc-200 bg-white text-[#1F1F1F] hover:border-zinc-300 hover:bg-zinc-50"
                          } disabled:cursor-not-allowed disabled:opacity-35`}
                        >
                          {month}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2.5 text-[11px] text-[#727272]">
                    {selectedMonthIsFuture
                      ? "Future months cannot be compared."
                      : `Period B: ${labelForRange(
                          monthRange(compareYear, compareMonth).startDate,
                          monthRange(compareYear, compareMonth).endDate,
                        )}`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-[11px] font-medium text-[#727272]">
                    Start date
                    <input
                      type="date"
                      max={todayKey()}
                      value={customStartDate}
                      onChange={(event) => {
                        setCustomStartDate(event.target.value);
                        setErrorMessage(null);
                      }}
                      className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs font-medium text-[#1F1F1F] shadow-2xs focus:border-[#1F1F1F] focus:outline-hidden"
                    />
                  </label>
                  <label className="text-[11px] font-medium text-[#727272]">
                    End date
                    <input
                      type="date"
                      max={todayKey()}
                      value={customEndDate}
                      onChange={(event) => {
                        setCustomEndDate(event.target.value);
                        setErrorMessage(null);
                      }}
                      className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs font-medium text-[#1F1F1F] shadow-2xs focus:border-[#1F1F1F] focus:outline-hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"
            >
              {errorMessage}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-zinc-300 pt-5">
          {activeComparison?.enabled ? (
            <button
              type="button"
              onClick={() => {
                onApplyComparison(null);
                onClose();
              }}
              className="text-sm font-medium text-rose-600 hover:text-rose-800 underline underline-offset-4 cursor-pointer text-center sm:text-left py-1"
            >
              Disable Comparison
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-full border border-[#727272] bg-white px-5 py-2.5 text-sm font-medium text-[#1F1F1F] hover:bg-[#1f1f1f] hover:border-[#1f1f1f] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={applyDisabled}
            onClick={handleApply}
            className="w-full sm:w-auto rounded-full hover:bg-[#1F1F1F] bg-[#FCDF9C] text-[#1f1f1f] hover:text-white px-6 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            Apply Comparison
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function Choice({
  selected,
  title,
  detail,
  onClick,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg border p-3.5 text-left text-xs transition-all duration-200 cursor-pointer ${
        selected
          ? "border-[#1F1F1F] bg-[#1F1F1F] text-white shadow-xs"
          : "border-zinc-300 bg-white text-[#1F1F1F] hover:border-zinc-400 hover:bg-zinc-50/70"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        {selected && (
          <span className="size-2 rounded-full bg-[#FCDF9C]" />
        )}
      </div>
      <p
        className={`mt-1 text-xs leading-tight ${
          selected ? "text-zinc-300" : "text-[#727272]"
        }`}
      >
        {detail}
      </p>
    </button>
  );
}
