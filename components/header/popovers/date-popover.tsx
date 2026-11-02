"use client";

import React, { useState } from "react";
import { useHeaderSearch } from "../header-search-context";
import { useLanguage } from "@/lib/i18n/language-context";

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function DatePopover() {
  const {
    checkIn,
    setCheckIn,
    checkOut,
    setCheckOut,
    datePreferences,
    setDatePreferences,
    setActiveField,
  } = useHeaderSearch();
  const { t, language } = useLanguage();

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState<number>(0);

  const today = new Date();
  const todayKey = dateKey(today);

  const locale = language === "ar" ? "ar-EG" : language === "hi" ? "hi-IN" : "en-US";
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 0, 4 + i).toLocaleDateString(locale, { weekday: "narrow" })
  );

  const monthLabel = (date: Date) =>
    date.toLocaleDateString(locale, { month: "long", year: "numeric" });

  const handleDateClick = (clickedKey: string) => {
    // If no checkIn selected, or both already selected, start a new selection
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(clickedKey);
      setCheckOut("");
      return;
    }

    // CheckIn is selected, waiting for checkOut
    if (checkIn && !checkOut) {
      if (clickedKey < checkIn) {
        // If clicked earlier than checkIn, make this new checkIn
        setCheckIn(clickedKey);
      } else if (clickedKey === checkIn) {
        // Same day selection (if allowed) or stay as checkIn
        setCheckOut(clickedKey);
        setActiveField("who");
      } else {
        setCheckOut(clickedKey);
        // Advance to Who tab
        setActiveField("who");
      }
    }
  };

  const toleranceOptions = [
    { label: "Exact dates", value: 0 },
    { label: "± 1 day", value: 1 },
    { label: "± 2 days", value: 2 },
    { label: "± 3 days", value: 3 },
    { label: "± 7 days", value: 7 },
  ];

  const stayOptions = [
    { key: "Weekend", label: t("home_when_stay_weekend", "Weekend") },
    { key: "Week", label: t("home_when_stay_week", "Week") },
    { key: "Month", label: t("home_when_stay_month", "Month") },
  ] as const;

  return (
    <div
      role="dialog"
      aria-label="Choose dates"
      className="w-[740px] max-w-[calc(100vw-2rem)] rounded-[32px] bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-zinc-100 animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Mode Switcher Tabs ("Dates" vs "Flexible") */}
      <div className="mx-auto mb-6 flex w-fit items-center rounded-full bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => setDatePreferences((prev) => ({ ...prev, mode: "dates" }))}
          className={`rounded-full px-5 py-2 text-xs font-medium transition-all duration-200 cursor-pointer ${
            datePreferences.mode === "dates"
              ? "bg-white text-[#1F1F1F] shadow-xs"
              : "text-zinc-600 hover:text-[#1F1F1F]"
          }`}
        >
          {t("home_when_tab_dates", "Dates")}
        </button>
        <button
          type="button"
          onClick={() =>
            setDatePreferences((prev) => ({
              ...prev,
              mode: "flexible",
              months: prev.months.length > 0 ? prev.months : [todayKey.slice(0, 7)],
            }))
          }
          className={`rounded-full px-5 py-2 text-xs font-medium transition-all duration-200 cursor-pointer ${
            datePreferences.mode === "flexible"
              ? "bg-white text-[#1F1F1F] shadow-xs"
              : "text-zinc-600 hover:text-[#1F1F1F]"
          }`}
        >
          {t("home_when_tab_flexible", "Flexible")}
        </button>
      </div>

      {datePreferences.mode === "dates" ? (
        /* ── Two-Month Side-by-Side Calendar ── */
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[0, 1].map((offset) => {
              const month = new Date(today.getFullYear(), today.getMonth() + monthOffset + offset, 1);
              const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
              const firstDayOfWeek = month.getDay();

              return (
                <div key={dateKey(month)} className="space-y-4">
                  {/* Month header & navigation */}
                  <div className="flex items-center justify-between h-9">
                    {offset === 0 ? (
                      <button
                        type="button"
                        aria-label="Previous month"
                        disabled={monthOffset <= 0}
                        onClick={() => setMonthOffset((prev) => Math.max(0, prev - 1))}
                        className="size-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                    ) : (
                      <div className="size-8" />
                    )}

                    <h4 className="text-sm font-medium text-[#1F1F1F]">{monthLabel(month)}</h4>

                    {offset === 1 ? (
                      <button
                        type="button"
                        aria-label="Next month"
                        onClick={() => setMonthOffset((prev) => prev + 1)}
                        className="size-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-700 transition-colors cursor-pointer"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    ) : (
                      <div className="size-8" />
                    )}
                  </div>

                  {/* Weekday Names */}
                  <div className="grid grid-cols-7 text-center text-xs font-normal text-zinc-400">
                    {weekdays.map((day, i) => (
                      <span key={`wd-${offset}-${i}`} className="py-1">
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-y-1">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${offset}-${i}`} className="h-10" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNumber = i + 1;
                      const dateObj = new Date(month.getFullYear(), month.getMonth(), dayNumber);
                      const key = dateKey(dateObj);
                      const isPast = key < todayKey;
                      const isToday = key === todayKey;
                      const isCheckIn = key === checkIn;
                      const isCheckOut = key === checkOut;

                      // Range calculation
                      const hasCommittedRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);
                      const hasHoverPreview = Boolean(
                        checkIn &&
                          !checkOut &&
                          hoveredDate &&
                          hoveredDate > checkIn &&
                          key > checkIn &&
                          key <= hoveredDate
                      );
                      const isInRange = hasCommittedRange || hasHoverPreview;

                      return (
                        <div
                          key={key}
                          className={`relative h-10 flex items-center justify-center ${
                            isInRange ? "bg-zinc-100" : ""
                          } ${isCheckIn && (checkOut || (hoveredDate && hoveredDate > checkIn)) ? "rounded-l-full bg-zinc-100" : ""} ${
                            isCheckOut ? "rounded-r-full bg-zinc-100" : ""
                          }`}
                        >
                          <button
                            type="button"
                            disabled={isPast}
                            aria-label={key}
                            onClick={() => handleDateClick(key)}
                            onMouseEnter={() => setHoveredDate(key)}
                            onMouseLeave={() => setHoveredDate(null)}
                            className={`relative size-9 rounded-full flex items-center justify-center text-xs transition-all duration-150 cursor-pointer ${
                              isPast
                                ? "text-zinc-300 cursor-not-allowed"
                                : isCheckIn || isCheckOut
                                ? "bg-[#1F1F1F] text-white font-medium shadow-xs"
                                : isInRange
                                ? "text-[#1F1F1F] font-medium hover:bg-zinc-200"
                                : isToday
                                ? "border border-[#1F1F1F] font-medium text-[#1F1F1F] hover:bg-zinc-100"
                                : "text-[#1F1F1F] hover:bg-zinc-100"
                            }`}
                          >
                            {dayNumber}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tolerance selection chips beneath the calendar */}
          <div className="mt-6 pt-5 border-t border-zinc-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-normal text-zinc-500 mr-2">
              {t("header_flexibility", "Flexibility:")}
            </span>
            {toleranceOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDatePreferences((prev) => ({ ...prev, tolerance: opt.value }))}
                className={`rounded-full px-3.5 py-1.5 text-xs transition-colors duration-150 cursor-pointer ${
                  datePreferences.tolerance === opt.value
                    ? "border border-[#1F1F1F] bg-[#1F1F1F] text-white font-medium"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 font-normal"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Flexible Dates Panel ── */
        <div className="space-y-6 py-2">
          {/* Stay Duration */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              {t("home_when_how_long", "How long would you like to stay?")}
            </p>
            <div className="flex flex-wrap gap-2.5">
              {stayOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDatePreferences((prev) => ({ ...prev, stay: opt.key }))}
                  className={`rounded-full px-5 py-2 text-xs transition-all duration-150 cursor-pointer ${
                    datePreferences.stay === opt.key
                      ? "border border-[#1F1F1F] bg-[#1F1F1F] text-white font-medium"
                      : "border border-zinc-200 bg-white text-[#1F1F1F] hover:border-zinc-400 font-normal"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month Multi-select */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              {t("home_when_which_months", "When would you like to go?")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => {
                const target = new Date(today.getFullYear(), today.getMonth() + i, 1);
                const monthStr = dateKey(target).slice(0, 7); // YYYY-MM
                const isSelected = datePreferences.months.includes(monthStr);

                return (
                  <button
                    key={monthStr}
                    type="button"
                    onClick={() => {
                      setDatePreferences((prev) => ({
                        ...prev,
                        months: isSelected
                          ? prev.months.filter((m) => m !== monthStr)
                          : [...prev.months, monthStr].sort(),
                      }));
                    }}
                    className={`p-4 rounded-2xl border text-center transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "border-[#1F1F1F] bg-zinc-50 ring-1 ring-[#1F1F1F]"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="size-6 mx-auto mb-1.5 text-zinc-600"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <p className="text-xs font-medium text-[#1F1F1F]">{monthLabel(target)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

