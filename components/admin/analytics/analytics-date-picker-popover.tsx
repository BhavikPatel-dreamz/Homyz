"use client";

import React, { useState, useRef, useEffect } from "react";
import { bookingDateKey } from "@/lib/booking/booking-date";
import type { ComparisonMode } from "@/services/admin-analytics/analytics-contracts";

interface DatePickerPopoverProps {
  currentPeriod: string;
  startDate?: string;
  endDate?: string;
  comparisonMode?: ComparisonMode;
  onSelectPeriod: (period: string, customStart?: string, customEnd?: string) => void;
  onSelectComparisonMode?: (mode: ComparisonMode) => void;
  disabled?: boolean;
}

const PRESET_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "90d", label: "Last 90 days" },
  { id: "this_year", label: "This year" },
  { id: "custom", label: "Custom range…" },
];

const COMPARISON_OPTIONS: Array<{ id: ComparisonMode; label: string; desc: string }> = [
  { id: "previous_period", label: "Previous Period", desc: "Equivalent preceding timeframe" },
  { id: "previous_year", label: "Same Period Last Year", desc: "Year-over-Year (YoY) alignment" },
  { id: "none", label: "No Comparison", desc: "Do not compare against historical baseline" },
];

export function AnalyticsDatePickerPopover({
  currentPeriod,
  startDate,
  endDate,
  comparisonMode = "previous_period",
  onSelectPeriod,
  onSelectComparisonMode,
  disabled = false,
}: DatePickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const todayKey = bookingDateKey(new Date());

  // Custom calendar state
  const [selectingStart, setSelectingStart] = useState<string | null>(startDate || null);
  const [selectingEnd, setSelectingEnd] = useState<string | null>(endDate || null);
  const [selectedCompMode, setSelectedCompMode] = useState<ComparisonMode>(comparisonMode);
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  // Keep in sync with incoming props
  useEffect(() => {
    setSelectingStart(startDate || null);
    setSelectingEnd(endDate || null);
    setSelectedCompMode(comparisonMode);
  }, [startDate, endDate, comparisonMode]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        handleCancel();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleCancel();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const currentLabel =
    PRESET_OPTIONS.find((p) => p.id === currentPeriod)?.label ||
    (startDate && endDate ? `${startDate} – ${endDate}` : "Select timeframe");

  const handleCancel = () => {
    setSelectingStart(startDate || null);
    setSelectingEnd(endDate || null);
    setSelectedCompMode(comparisonMode);
    setIsOpen(false);
  };

  const handlePresetClick = (id: string) => {
    if (id !== "custom") {
      onSelectPeriod(id);
      if (onSelectComparisonMode && selectedCompMode !== comparisonMode) {
        onSelectComparisonMode(selectedCompMode);
      }
      setIsOpen(false);
    }
  };

  const handleApplyCustom = () => {
    if (selectingStart && selectingEnd) {
      const s = selectingStart < selectingEnd ? selectingStart : selectingEnd;
      const e = selectingStart < selectingEnd ? selectingEnd : selectingStart;
      onSelectPeriod("custom", s, e);
      if (onSelectComparisonMode) {
        onSelectComparisonMode(selectedCompMode);
      }
      setIsOpen(false);
    }
  };

  const handleCompModeSelect = (mode: ComparisonMode) => {
    setSelectedCompMode(mode);
    if (currentPeriod !== "custom" && onSelectComparisonMode) {
      onSelectComparisonMode(mode);
    }
  };

  // Month navigation
  const prevMonth = () => {
    setViewDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
  };

  const nextMonth = () => {
    const nextD = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, 1));
    const now = new Date();
    // Allow viewing up to current month
    if (nextD <= new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))) {
      setViewDate(nextD);
    }
  };

  // Month rendering generator
  const renderMonthDays = (baseDate: Date) => {
    const y = baseDate.getUTCFullYear();
    const m = baseDate.getUTCMonth();
    const firstDay = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0 is Sun
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

    const days: Array<{ key: string; dayNum: number; isInMonth: boolean; isFuture: boolean }> = [];

    // Blank cells before month start
    for (let i = 0; i < firstDay; i++) {
      days.push({ key: `blank-${i}`, dayNum: 0, isInMonth: false, isFuture: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ key, dayNum: d, isInMonth: true, isFuture: key > todayKey });
    }

    return days;
  };

  const monthYearLabel = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);

  const handleDateClick = (key: string, isFuture: boolean) => {
    if (isFuture) return;

    if (!selectingStart || (selectingStart && selectingEnd)) {
      setSelectingStart(key);
      setSelectingEnd(null);
    } else if (selectingStart && !selectingEnd) {
      if (key < selectingStart) {
        setSelectingEnd(selectingStart);
        setSelectingStart(key);
      } else {
        setSelectingEnd(key);
      }
    }
  };

  const isInRange = (key: string) => {
    if (!selectingStart || !selectingEnd) return false;
    const s = selectingStart < selectingEnd ? selectingStart : selectingEnd;
    const e = selectingStart < selectingEnd ? selectingEnd : selectingStart;
    return key > s && key < e;
  };

  return (
    <div className="relative inline-block font-sans text-xs" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-2 font-medium text-foreground transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
        aria-expanded={isOpen}
      >
        <svg
          className="size-3.5 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span>{currentLabel}</span>
        <svg
          className={`size-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 z-50 mt-2 w-[calc(100vw-32px)] sm:w-[580px] max-w-[620px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xl backdrop-blur-xs">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Left Column: Preset Options & Comparison Mode */}
            <div className="sm:w-44 shrink-0 flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-[var(--border)] pb-4 sm:pb-0 sm:pr-4">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Timeframe
                </p>
                <div className="space-y-0.5">
                  {PRESET_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handlePresetClick(opt.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-xs ${
                        currentPeriod === opt.id
                          ? "bg-[var(--accent)] text-white font-medium"
                          : "text-foreground hover:bg-[var(--surface-secondary)] font-normal"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comparison Mode Selector */}
              <div className="mt-4 pt-3 border-t border-[var(--border)]">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Compare Baseline
                </p>
                <div className="space-y-1">
                  {COMPARISON_OPTIONS.map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => handleCompModeSelect(comp.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-[11px] ${
                        selectedCompMode === comp.id
                          ? "bg-[var(--surface-secondary)] text-foreground font-medium border border-[var(--border)]"
                          : "text-muted-foreground hover:text-foreground font-normal"
                      }`}
                    >
                      <span className="block">{comp.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Calendar for Custom Range */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-medium text-foreground">
                    {monthYearLabel(viewDate)}
                  </h4>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="p-1 rounded-lg hover:bg-[var(--surface-secondary)] text-muted-foreground cursor-pointer"
                      title="Previous month"
                    >
                      <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="p-1 rounded-lg hover:bg-[var(--surface-secondary)] text-muted-foreground cursor-pointer"
                      title="Next month"
                    >
                      <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground font-medium mb-1">
                  <span>Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                </div>

                {/* Day Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {renderMonthDays(viewDate).map((day, idx) => {
                    if (!day.isInMonth) {
                      return <div key={idx} className="h-7 w-7" />;
                    }

                    const isStart = day.key === selectingStart;
                    const isEnd = day.key === selectingEnd;
                    const inRange = isInRange(day.key);

                    return (
                      <button
                        key={day.key}
                        type="button"
                        disabled={day.isFuture}
                        onClick={() => handleDateClick(day.key, day.isFuture)}
                        className={`h-7 w-7 mx-auto flex items-center justify-center rounded-lg text-xs font-normal transition-all cursor-pointer ${
                          day.isFuture
                            ? "text-zinc-300 dark:text-zinc-600 opacity-40 cursor-not-allowed"
                            : isStart || isEnd
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-medium shadow-2xs"
                            : inRange
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                            : "text-foreground hover:bg-[var(--surface-secondary)]"
                        }`}
                      >
                        {day.dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] mt-4 text-xs">
                <span className="text-[11px] font-normal text-muted-foreground truncate">
                  {selectingStart && selectingEnd
                    ? `${selectingStart} to ${selectingEnd}`
                    : selectingStart
                    ? `From ${selectingStart}…`
                    : "Select custom start & end dates"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1 text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectingStart || !selectingEnd}
                    onClick={handleApplyCustom}
                    className="px-3.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 font-medium disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
