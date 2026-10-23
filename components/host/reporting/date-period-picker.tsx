"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";

export interface DatePeriodPickerState {
  timeframe: TimeframeGranularity;
  date?: string;       // YYYY-MM-DD
  weekStart?: string;  // YYYY-MM-DD
  month?: number;      // 1-12
  year?: number;       // e.g. 2026
  quarter?: number;    // 1-4
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
}

interface DatePeriodPickerProps {
  value: DatePeriodPickerState;
  onChange: (next: DatePeriodPickerState) => void;
  displayLabel?: string;
  disabled?: boolean;
  className?: string;
}

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const QUARTERS = [
  { q: 1, label: "Q1", range: "Jan – Mar" },
  { q: 2, label: "Q2", range: "Apr – Jun" },
  { q: 3, label: "Q3", range: "Jul – Sep" },
  { q: 4, label: "Q4", range: "Oct – Dec" },
];

export function DatePeriodPicker({
  value,
  onChange,
  displayLabel,
  disabled = false,
  className = "",
}: DatePeriodPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const now = useMemo(() => new Date(), []);
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth() + 1; // 1-12
  const curDayStr = now.toISOString().split("T")[0];

  // Internal draft state while popover is open
  const [activeTab, setActiveTab] = useState<TimeframeGranularity>(value.timeframe || "monthly");
  const [selectedYear, setSelectedYear] = useState<number>(value.year || curYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(value.month || curMonth);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(value.quarter || Math.ceil(curMonth / 3));
  const [selectedDate, setSelectedDate] = useState<string>(value.date || curDayStr);
  const [customStart, setCustomStart] = useState<string>(value.startDate || "");
  const [customEnd, setCustomEnd] = useState<string>(value.endDate || "");
  const [calendarViewMonth, setCalendarViewMonth] = useState<number>(value.month ? value.month - 1 : now.getUTCMonth());
  const [calendarViewYear, setCalendarViewYear] = useState<number>(value.year || curYear);
  const [customError, setCustomError] = useState<string | null>(null);

  const openPicker = () => {
    setActiveTab(value.timeframe || "monthly");
    setSelectedYear(value.year || curYear);
    setSelectedMonth(value.month || curMonth);
    setSelectedQuarter(value.quarter || Math.ceil(curMonth / 3));
    setSelectedDate(value.date || curDayStr);
    setCustomStart(value.startDate || "");
    setCustomEnd(value.endDate || "");
    setCustomError(null);
    setIsOpen(true);
  };

  // Click outside to close desktop popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Step prev / next from the toolbar arrows directly
  const stepPeriod = (direction: -1 | 1) => {
    if (value.timeframe === "daily") {
      const current = new Date(value.date || curDayStr);
      current.setUTCDate(current.getUTCDate() + direction);
      const nextDate = current.toISOString().split("T")[0];
      onChange({ ...value, date: nextDate });
    } else if (value.timeframe === "weekly") {
      const current = new Date(value.weekStart || value.date || curDayStr);
      current.setUTCDate(current.getUTCDate() + direction * 7);
      const nextDate = current.toISOString().split("T")[0];
      onChange({ ...value, weekStart: nextDate, date: nextDate });
    } else if (value.timeframe === "quarterly") {
      let nextQ = (value.quarter || 1) + direction;
      let nextY = value.year || curYear;
      if (nextQ < 1) {
        nextQ = 4;
        nextY -= 1;
      } else if (nextQ > 4) {
        nextQ = 1;
        nextY += 1;
      }
      onChange({ ...value, quarter: nextQ, year: nextY });
    } else if (value.timeframe === "yearly") {
      const nextY = (value.year || curYear) + direction;
      onChange({ ...value, year: nextY });
    } else {
      // Default monthly
      let nextM = (value.month || curMonth) + direction;
      let nextY = value.year || curYear;
      if (nextM < 1) {
        nextM = 12;
        nextY -= 1;
      } else if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
      onChange({ ...value, timeframe: "monthly", month: nextM, year: nextY });
    }
  };

  // Calendar grid calculations for Daily & Weekly
  const daysInCalendarMonth = useMemo(() => {
    const firstDay = new Date(Date.UTC(calendarViewYear, calendarViewMonth, 1));
    const lastDay = new Date(Date.UTC(calendarViewYear, calendarViewMonth + 1, 0));
    const startDayOfWeek = (firstDay.getUTCDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getUTCDate();

    const cells: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Prior month fill
    const prevMonthLast = new Date(Date.UTC(calendarViewYear, calendarViewMonth, 0)).getUTCDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLast - i;
      const prevDate = new Date(Date.UTC(calendarViewYear, calendarViewMonth - 1, d));
      cells.push({
        dateStr: prevDate.toISOString().split("T")[0],
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const currDate = new Date(Date.UTC(calendarViewYear, calendarViewMonth, d));
      cells.push({
        dateStr: currDate.toISOString().split("T")[0],
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Trailing days to round out grid to 35 or 42
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(Date.UTC(calendarViewYear, calendarViewMonth + 1, d));
      cells.push({
        dateStr: nextDate.toISOString().split("T")[0],
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [calendarViewYear, calendarViewMonth]);

  // Apply selection
  const handleApply = () => {
    if (activeTab === "daily") {
      onChange({ timeframe: "daily", date: selectedDate });
    } else if (activeTab === "weekly") {
      // Find Monday for selectedDate
      const anchor = new Date(selectedDate);
      const dayOfWeek = (anchor.getUTCDay() + 6) % 7;
      anchor.setUTCDate(anchor.getUTCDate() - dayOfWeek);
      const monStr = anchor.toISOString().split("T")[0];
      onChange({ timeframe: "weekly", weekStart: monStr, date: monStr });
    } else if (activeTab === "monthly") {
      onChange({ timeframe: "monthly", month: selectedMonth, year: selectedYear });
    } else if (activeTab === "quarterly") {
      onChange({ timeframe: "quarterly", quarter: selectedQuarter, year: selectedYear });
    } else if (activeTab === "yearly") {
      onChange({ timeframe: "yearly", year: selectedYear });
    } else if (activeTab === "custom") {
      if (!customStart || !customEnd) {
        setCustomError("Please select both start and end dates.");
        return;
      }
      if (customStart > customEnd) {
        setCustomError("Start date cannot be after end date.");
        return;
      }
      onChange({ timeframe: "custom", startDate: customStart, endDate: customEnd });
    }
    setIsOpen(false);
  };

  const labelText = displayLabel || (
    value.timeframe === "daily"
      ? `Daily: ${value.date || curDayStr}`
      : value.timeframe === "weekly"
        ? `Weekly: ${value.weekStart || value.date || "Selected week"}`
        : value.timeframe === "quarterly"
          ? `Q${value.quarter || Math.ceil(curMonth / 3)} ${value.year || curYear}`
          : value.timeframe === "yearly"
            ? `${value.year || curYear}`
            : value.timeframe === "custom" && value.startDate && value.endDate
              ? `${value.startDate} – ${value.endDate}`
              : `${MONTHS_FULL[(value.month || curMonth) - 1]} ${value.year || curYear}`
  );

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex h-11 sm:h-12 w-full sm:w-auto shrink-0 items-center justify-between rounded-full border bg-white shadow-2xs transition-all ${
        isOpen
          ? "border-[#1F1F1F] ring-2 ring-[#1F1F1F]/5"
          : "border-[#D7D7D7] hover:border-[#1F1F1F]"
      } ${className}`}
    >
      {/* Quick Step Left Chevron */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => stepPeriod(-1)}
        title="Previous period"
        className="flex h-full w-9 sm:w-10 shrink-0 items-center justify-center rounded-l-full text-[#727272] transition-colors hover:bg-[#F3F4F5] hover:text-[#1F1F1F] focus:outline-hidden disabled:opacity-50 cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Main Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="flex h-full flex-1 sm:flex-initial min-w-0 items-center justify-center gap-1.5 sm:gap-2 border-x border-[#EDEDED] px-2.5 sm:px-3.5 text-xs sm:text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#F7F7F8] focus:outline-hidden disabled:opacity-50 cursor-pointer"
      >
        <svg className="w-4 h-4 shrink-0 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="truncate max-w-[115px] sm:max-w-[135px] lg:max-w-[200px]">{labelText}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-[#727272] transition-transform duration-200 ${isOpen ? "rotate-180 text-[#1F1F1F]" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Quick Step Right Chevron */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => stepPeriod(1)}
        title="Next period"
        className="flex h-full w-9 sm:w-10 shrink-0 items-center justify-center rounded-r-full text-[#727272] transition-colors hover:bg-[#F3F4F5] hover:text-[#1F1F1F] focus:outline-hidden disabled:opacity-50 cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Desktop Popover / Dialog */}
      {isOpen && (
        <div className="absolute left-0 top-14 z-50 hidden w-[420px] max-w-[calc(100vw-32px)] rounded-3xl border border-[#E5E5E5] bg-white p-5 shadow-2xl shadow-black/10 sm:block animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Timeframe Granularity Tabs */}
          <div className="grid grid-cols-6 gap-1 rounded-full bg-[#F3F4F5] p-1 text-[11px] font-medium text-[#727272]">
            {(["daily", "weekly", "monthly", "quarterly", "yearly", "custom"] as TimeframeGranularity[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setActiveTab(tf)}
                className={`capitalize rounded-full transition-all cursor-pointer ${
                  activeTab === tf
                    ? "bg-[#1F1F1F] font-medium text-white shadow-2xs"
                    : "hover:text-[#1F1F1F]"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-[250px]">
            {/* 1. DAILY / WEEKLY CALENDAR VIEW */}
            {(activeTab === "daily" || activeTab === "weekly") && (
              <div>
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-1 font-medium text-xs text-[#1F1F1F]">
                    <button
                      type="button"
                      onClick={() => {
                        if (calendarViewMonth === 0) {
                          setCalendarViewMonth(11);
                          setCalendarViewYear((y) => y - 1);
                        } else {
                          setCalendarViewMonth((m) => m - 1);
                        }
                      }}
                      className="rounded-lg p-1 text-[#727272] hover:bg-zinc-100 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span>
                      {MONTHS_FULL[calendarViewMonth]} {calendarViewYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (calendarViewMonth === 11) {
                          setCalendarViewMonth(0);
                          setCalendarViewYear((y) => y + 1);
                        } else {
                          setCalendarViewMonth((m) => m + 1);
                        }
                      }}
                      className="rounded-lg p-1 text-[#727272] hover:bg-zinc-100 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(curDayStr);
                      setCalendarViewMonth(now.getUTCMonth());
                      setCalendarViewYear(now.getUTCFullYear());
                    }}
                    className="text-[11px] font-medium text-[#1F1F1F] hover:underline cursor-pointer"
                  >
                    Today
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 text-center text-[10px] font-medium text-[#727272]">
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                  <span>Su</span>
                </div>

                {/* Day cells */}
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {daysInCalendarMonth.map((cell) => {
                    const isSelected = selectedDate === cell.dateStr;
                    const isToday = cell.dateStr === curDayStr;
                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(cell.dateStr)}
                        className={`flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#1F1F1F] text-white shadow-xs"
                            : isToday
                              ? "border border-[#1F1F1F] bg-zinc-50 text-[#1F1F1F]"
                              : cell.isCurrentMonth
                                ? "text-[#1F1F1F] hover:bg-zinc-100"
                                : "text-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        {cell.dayNum}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-[#727272] text-center">
                  {activeTab === "daily"
                    ? `Selected: ${selectedDate}`
                    : `Week containing: ${selectedDate}`}
                </p>
              </div>
            )}

            {/* 2. MONTHLY VIEW */}
            {activeTab === "monthly" && (
              <div>
                <div className="flex items-center justify-between pb-3">
                  <span className="text-sm font-medium text-[#1f1f1f]">Select Month</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedYear((y) => y - 1)}
                      className="rounded-lg p-1 text-[#727272] hover:bg-zinc-100 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="text-xs font-medium text-[#1F1F1F]">{selectedYear}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedYear((y) => y + 1)}
                      className="rounded-lg p-1 text-[#727272] hover:bg-zinc-100 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {MONTHS_SHORT.map((mName, idx) => {
                    const mNum = idx + 1;
                    const isSelected = selectedMonth === mNum;
                    const isCurrent = curMonth === mNum && curYear === selectedYear;
                    return (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => setSelectedMonth(mNum)}
                        className={`rounded-lg py-2 text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#1F1F1F] text-white shadow-xs"
                            : isCurrent
                            ? "border border-[#FCDF9C] bg-[#FCDF9C] text-[#1F1F1F]"
                            : "border border-[#EDEDED] bg-[#F3F4F5] hover:border-[#FCDF9C] text-[#3F3F3F] hover:bg-[#FCDF9C]"
                        }`}
                      >
                        {mName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. QUARTERLY VIEW */}
            {activeTab === "quarterly" && (
              <div>
                <div className="flex items-center justify-between pb-3">
                  <span className="text-xs font-medium text-[#727272] uppercase tracking-wider">Select Quarter</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedYear((y) => y - 1)}
                      className="rounded-lg p-1 text-[#727272] hover:bg-zinc-100 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="text-xs font-medium text-[#1F1F1F]">{selectedYear}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedYear((y) => y + 1)}
                      className="rounded-lg p-1 text-[#727272] hover:bg-zinc-100 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {QUARTERS.map((q) => {
                    const isSelected = selectedQuarter === q.q;
                    return (
                      <button
                        key={q.q}
                        type="button"
                        onClick={() => setSelectedQuarter(q.q)}
                        className={`rounded-2xl p-4 text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#1F1F1F] text-white shadow-xs"
                            : "border border-[#E5E5E5] bg-[#FAFAFA] hover:bg-zinc-100"
                        }`}
                      >
                        <p className={`text-base font-medium ${isSelected ? "text-white" : "text-[#1F1F1F]"}`}>
                          {q.label}
                        </p>
                        <p className={`text-[11px] ${isSelected ? "text-zinc-300" : "text-[#727272]"}`}>
                          {q.range}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. YEARLY VIEW */}
            {activeTab === "yearly" && (
              <div>
                <p className="pb-3 text-xs font-medium text-[#727272] uppercase tracking-wider">Select Year</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {[curYear - 3, curYear - 2, curYear - 1, curYear, curYear + 1, curYear + 2].map((yr) => {
                    const isSelected = selectedYear === yr;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setSelectedYear(yr)}
                        className={`rounded-xl py-2.5 text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#1F1F1F] text-white shadow-xs"
                            : yr === curYear
                              ? "border border-[#1F1F1F] bg-[#FEF9EE] text-[#1F1F1F]"
                              : "border border-[#EDEDED] bg-[#FAFAFA] text-[#3F3F3F] hover:bg-zinc-100"
                        }`}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. CUSTOM RANGE VIEW */}
            {activeTab === "custom" && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-[#727272] uppercase tracking-wider">Custom Date Range</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-[#727272]">Start Date</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => {
                        setCustomStart(e.target.value);
                        setCustomError(null);
                      }}
                      className="mt-1 w-full rounded-xl border border-[#D7D7D7] bg-[#FAFAFA] px-3 py-2 text-xs font-medium text-[#1F1F1F] focus:border-[#1F1F1F] focus:bg-white focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#727272]">End Date</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => {
                        setCustomEnd(e.target.value);
                        setCustomError(null);
                      }}
                      className="mt-1 w-full rounded-xl border border-[#D7D7D7] bg-[#FAFAFA] px-3 py-2 text-xs font-medium text-[#1F1F1F] focus:border-[#1F1F1F] focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>

                {customError && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-[11px] font-medium text-rose-700">
                    {customError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex items-center justify-between border-t border-[#EDEDED] pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-sm font-medium text-[#727272] hover:text-[#1F1F1F] cursor-pointer underline underline-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-full bg-[#FCDF9C] px-5 py-2 text-sm font-medium hover:text-white hover:bg-[#1f1f1f] text-[#1F1F1F] transition-all cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet for Date Picker */}
      {isOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:hidden backdrop-blur-xs"
          onClick={() => setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-[#E5E5E5] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom"
          >
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-base font-medium text-[#1F1F1F]">Reporting period</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#727272] hover:bg-[#F3F4F5] hover:text-[#1F1F1F] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Timeframe Granularity Tabs */}
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#F3F4F5] p-1.5 text-xs font-medium text-[#727272]">
              {(["daily", "weekly", "monthly", "quarterly", "yearly", "custom"] as TimeframeGranularity[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setActiveTab(tf)}
                  className={`capitalize rounded-lg py-2 transition-all cursor-pointer ${
                    activeTab === tf
                      ? "bg-[#1F1F1F] font-medium text-white shadow-2xs"
                      : "hover:text-[#1F1F1F]"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Sub-picker content */}
            <div className="my-4 flex-1 overflow-y-auto overscroll-contain">
              {(activeTab === "daily" || activeTab === "weekly") && (
                <div>
                  <div className="flex items-center justify-between pb-3">
                    <span className="text-sm font-medium text-[#1F1F1F]">
                      {MONTHS_FULL[calendarViewMonth]} {calendarViewYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(curDayStr);
                        setCalendarViewMonth(now.getUTCMonth());
                        setCalendarViewYear(now.getUTCFullYear());
                      }}
                      className="text-xs font-medium text-[#1F1F1F] underline cursor-pointer"
                    >
                      Today
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {daysInCalendarMonth.map((cell) => (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(cell.dateStr)}
                        className={`h-9 w-full rounded-xl text-xs font-medium transition-colors ${
                          selectedDate === cell.dateStr
                            ? "bg-[#1F1F1F] text-white font-medium shadow-xs"
                            : cell.isCurrentMonth
                              ? "text-[#1F1F1F] hover:bg-[#F3F4F5]"
                              : "text-[#C7C7C7]"
                        }`}
                      >
                        {cell.dayNum}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "monthly" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-4 py-2 font-medium text-[#1F1F1F] text-sm">
                    <button
                      type="button"
                      onClick={() => setSelectedYear((y) => y - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F3F4F5] text-[#727272] hover:text-[#1F1F1F] cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium">{selectedYear}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedYear((y) => y + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[#F3F4F5] text-[#727272] hover:text-[#1F1F1F] cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {MONTHS_SHORT.map((mName, idx) => (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => setSelectedMonth(idx + 1)}
                        className={`rounded-lg py-3 text-xs font-medium transition-all cursor-pointer ${
                          selectedMonth === idx + 1
                            ? "bg-[#1F1F1F] text-white shadow-2xs"
                            : "border border-[#EDEDED] bg-white text-[#1F1F1F] hover:border-[#1F1F1F]"
                        }`}
                      >
                        {mName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "quarterly" && (
                <div className="grid grid-cols-2 gap-3">
                  {QUARTERS.map((q) => (
                    <button
                      key={q.q}
                      type="button"
                      onClick={() => setSelectedQuarter(q.q)}
                      className={`rounded-2xl p-4 text-left transition-all cursor-pointer ${
                        selectedQuarter === q.q
                          ? "bg-[#1F1F1F] text-white shadow-xs"
                          : "border border-[#EDEDED] bg-white hover:border-[#1F1F1F]"
                      }`}
                    >
                      <p className="text-base font-medium">{q.label}</p>
                      <p className="text-xs opacity-80">{q.range}</p>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "yearly" && (
                <div className="grid grid-cols-3 gap-2.5">
                  {[curYear - 2, curYear - 1, curYear, curYear + 1].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      className={`rounded-2xl py-3.5 text-xs font-medium transition-all cursor-pointer ${
                        selectedYear === yr
                          ? "bg-[#1F1F1F] text-white shadow-xs"
                          : "border border-[#EDEDED] bg-white text-[#1F1F1F] hover:border-[#1F1F1F]"
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "custom" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[#727272]">Start Date</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#D7D7D7] bg-white p-2.5 text-xs font-medium text-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#727272]">End Date</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#D7D7D7] bg-white p-2.5 text-xs font-medium text-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-hidden"
                    />
                  </div>
                  {customError && (
                    <p className="text-xs font-medium text-rose-600">{customError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#EDEDED] pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium hover:text-[#727272] text-[#1F1F1F] cursor-pointer underline underline-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-full bg-[#1F1F1F] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#FCDF9C] hover:text-[#1F1F1F] transition-all cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
