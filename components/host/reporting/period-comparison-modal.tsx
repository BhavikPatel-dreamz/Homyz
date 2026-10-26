"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { resolveComparisonPeriod, type EarningsComparisonPreset, type TimeframeGranularity } from "@/lib/dashboard/reporting-filter";

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
  return <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="earnings-comparison-title" onClick={(event) => event.stopPropagation()} className="relative mx-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 sm:p-8">
      <div className="flex items-start justify-between border-b border-zinc-100 pb-4"><div><h2 id="earnings-comparison-title" className="text-xl font-bold tracking-tight text-zinc-950">Compare Reporting Periods</h2><p className="mt-1 text-xs text-zinc-500">Compare realised earnings using the same property and currency scope.</p></div><button type="button" aria-label="Close comparison" onClick={onClose} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">✕</button></div>
      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Period A (Primary View)</p><p className="mt-1 text-sm font-bold text-zinc-950">{currentPeriodLabel}</p><p className="mt-1 text-xs text-zinc-500">{currentStartDate} to {currentEndDate}</p></div>
      <div className="mt-6 space-y-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-900">Choose Period B (Comparison)</p><div className="grid gap-2.5 sm:grid-cols-3"><Choice selected={selection === "prior_period"} title="Prior Period" detail="Equivalent preceding days" onClick={() => select("prior_period")} /><Choice selected={selection === "prior_year"} title="Prior Year" detail="Matching calendar dates" onClick={() => select("prior_year")} /><Choice selected={selection === "custom_month" || selection === "custom_range"} title="Custom" detail="Choose a month or dates" onClick={() => select("custom_month")} /></div>
        {(selection === "custom_month" || selection === "custom_range") && <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4"><div className="grid grid-cols-2 rounded-xl bg-zinc-100 p-1 text-xs font-semibold"><button type="button" onClick={() => select("custom_month")} className={`rounded-lg px-3 py-2 ${selection === "custom_month" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600"}`}>Month & year</button><button type="button" onClick={() => select("custom_range")} className={`rounded-lg px-3 py-2 ${selection === "custom_range" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600"}`}>Specific dates</button></div>
          {selection === "custom_month" ? <div><div className="flex items-center justify-between pb-2"><span className="text-xs font-semibold text-zinc-700">Select Month & Year</span><div className="flex items-center gap-2"><button type="button" aria-label="Previous comparison year" onClick={() => setCompareYear((year) => year - 1)} className="rounded-lg p-1 text-sm font-bold text-zinc-600 hover:bg-zinc-200">‹</button><span className="text-xs font-bold text-zinc-950">{compareYear}</span><button type="button" aria-label="Next comparison year" disabled={compareYear >= currentYear} onClick={() => setCompareYear((year) => year + 1)} className="rounded-lg p-1 text-sm font-bold text-zinc-600 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">›</button></div></div><div className="grid grid-cols-4 gap-1.5">{MONTHS_SHORT.map((month, index) => { const monthNumber = index + 1; const unavailable = compareYear > currentYear || (compareYear === currentYear && monthNumber > currentMonth); return <button key={month} type="button" disabled={unavailable} onClick={() => { setCompareMonth(monthNumber); setErrorMessage(null); }} className={`rounded-xl py-1.5 text-xs font-semibold transition-all ${compareMonth === monthNumber ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"} disabled:cursor-not-allowed disabled:opacity-35`}>{month}</button>; })}</div><p className="mt-2 text-[11px] text-zinc-500">{selectedMonthIsFuture ? "Future months cannot be compared." : `Period B: ${labelForRange(monthRange(compareYear, compareMonth).startDate, monthRange(compareYear, compareMonth).endDate)}`}</p></div> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-[11px] font-semibold text-zinc-600">Start date<input type="date" max={todayKey()} value={customStartDate} onChange={(event) => { setCustomStartDate(event.target.value); setErrorMessage(null); }} className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:outline-hidden" /></label><label className="text-[11px] font-semibold text-zinc-600">End date<input type="date" max={todayKey()} value={customEndDate} onChange={(event) => { setCustomEndDate(event.target.value); setErrorMessage(null); }} className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs font-semibold text-zinc-900 focus:border-zinc-950 focus:outline-hidden" /></label></div>}</div>}
        {errorMessage && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">{errorMessage}</p>}
      </div>
      <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-5">{activeComparison?.enabled ? <button type="button" onClick={() => { onApplyComparison(null); onClose(); }} className="text-xs font-semibold text-rose-600 hover:text-rose-800">Disable Comparison</button> : <button type="button" onClick={onClose} className="text-xs font-semibold text-zinc-600 hover:text-zinc-950">Cancel</button>}<button type="button" disabled={applyDisabled} onClick={handleApply} className="rounded-full bg-zinc-950 px-6 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">Apply Comparison</button></div>
    </div>
  </ModalOverlay>;
}

function Choice({ selected, title, detail, onClick }: { selected: boolean; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-3.5 text-left text-xs transition-all ${selected ? "border-zinc-950 bg-zinc-950 text-white font-semibold shadow-xs" : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"}`}><p className="font-bold">{title}</p><p className={`mt-0.5 text-[11px] ${selected ? "text-zinc-300" : "text-zinc-500"}`}>{detail}</p></button>;
}
