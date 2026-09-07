"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

export interface DatePreferences {
  mode: "dates" | "months" | "flexible";
  tolerance: number;
  stay: "Weekend" | "Week" | "Month";
  months: string[];
}

export const initialDatePreferences: DatePreferences = {
  mode: "dates", tolerance: 0, stay: "Weekend", months: [],
};

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthLabel = (date: Date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
const pill = "shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors";

export function MobileDatePicker({ checkIn, checkOut, onDatesChange, preferences, onPreferencesChange, desktop = false, selectionTarget }: {
  desktop?: boolean;
  selectionTarget?: "checkIn" | "checkOut";
  checkIn: string;
  checkOut: string;
  onDatesChange: (start: string, end: string) => void;
  preferences: DatePreferences;
  onPreferencesChange: (value: DatePreferences) => void;
}) {
  const pickerId = useId();
  const monthSliderRef = useRef<HTMLDivElement>(null);
  const [sliderEdges, setSliderEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const slider = monthSliderRef.current;
    if (!slider) return;
    const updateEdges = () => setSliderEdges({
      start: slider.scrollLeft <= 1,
      end: slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 1,
    });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(slider);
    slider.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      slider.removeEventListener("scroll", updateEdges);
    };
  }, [preferences.mode]);
  const slideMonths = (direction: number) => {
    const slider = monthSliderRef.current;
    if (!slider) return;
    const card = slider.firstElementChild as HTMLElement | null;
    const distance = card ? card.offsetWidth + 8 : slider.clientWidth;
    slider.scrollBy({ left: direction * distance, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const [today] = useState(() => new Date());
  const [monthOffset, setMonthOffset] = useState(0);
  const update = (patch: Partial<DatePreferences>) => onPreferencesChange({ ...preferences, ...patch });
  const selectDate = (value: string) => {
    if (selectionTarget === "checkIn") {
      onDatesChange(value, checkOut > value ? checkOut : "");
      return;
    }
    if (selectionTarget === "checkOut" && checkIn && value > checkIn) {
      onDatesChange(checkIn, value);
      return;
    }
    if (!checkIn || checkOut || value <= checkIn) onDatesChange(value, "");
    else onDatesChange(checkIn, value);
  };
  const toggleMonth = (key: string) => update({ months: preferences.months.includes(key)
    ? preferences.months.filter((month) => month !== key) : [...preferences.months, key].sort() });

  return (
    <div>
      <div className={`mx-auto mb-5 flex w-full overflow-hidden rounded-full ${desktop ? "max-w-[280px] bg-[#f3f3f3]" : "bg-white"}`} role="tablist" aria-label="Date selection">
        {(["dates", "months", "flexible"] as const).map((mode) => (
          <button key={mode} id={`${pickerId}-tab-${mode}`} type="button" role="tab" aria-selected={preferences.mode === mode}
            aria-controls={`${pickerId}-panel`} onClick={() => update({ mode })}
            className={`flex h-9 min-w-0 flex-1 items-center justify-center rounded-full px-3 text-[14px] font-normal leading-none capitalize text-[#1f1f1f] transition-colors ${preferences.mode === mode ? "bg-[#dedede]" : "hover:bg-black/5"}`}>
            {mode}
          </button>
        ))}
      </div>
      <div id={`${pickerId}-panel`} role="tabpanel" aria-labelledby={`${pickerId}-tab-${preferences.mode}`} className="rounded-[22px] bg-white px-3 py-4">
        {preferences.mode === "dates" ? (
          <>
            <p className="sr-only" aria-live="polite">{!checkIn ? "Choose check-in date" : !checkOut ? "Choose check-out date" : `${checkIn} to ${checkOut}`}</p>
            <div className={desktop ? "grid grid-cols-2 gap-5" : ""}>
            {[0, 1].map((offset) => {
              const month = new Date(today.getFullYear(), today.getMonth() + monthOffset + offset, 1);
              const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
              return (
                <div key={dateKey(month)} className={offset && !desktop ? "mt-6" : ""}>
                  <div className="mb-4 flex items-center justify-between">
                    <button type="button" aria-label="Previous month" disabled={monthOffset === 0} onClick={() => setMonthOffset((n) => n - 1)}
                      className={`h-7 w-7 text-xl disabled:opacity-20 ${offset === 1 ? "invisible" : ""}`}>‹</button>
                    <h4 className="text-[16px] font-semibold">{monthLabel(month)}</h4>
                    <button type="button" aria-label="Next month" onClick={() => setMonthOffset((n) => n + 1)}
                      className={`h-7 w-7 text-xl ${offset === 0 ? "invisible" : ""}`}>›</button>
                  </div>
                  <div className="grid grid-cols-7 text-center text-[12px]">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => <span key={i} className="pb-2 text-[#a09d96]">{day}</span>)}
                    {Array.from({ length: month.getDay() }, (_, i) => <span key={`blank-${i}`} />)}
                    {Array.from({ length: days }, (_, i) => {
                      const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
                      const key = dateKey(date);
                      const selected = key === checkIn || key === checkOut;
                      const inRange = checkIn && checkOut && key > checkIn && key < checkOut;
                      return <button key={key} type="button" disabled={key < dateKey(today)} aria-label={date.toLocaleDateString("en-US", { dateStyle: "full" })}
                        aria-pressed={selected} onClick={() => selectDate(key)}
                        className={`h-9 rounded-full disabled:opacity-25 ${selected ? "bg-[#1f1f1f] text-white" : inRange ? "bg-[#fcdf9c]" : "hover:bg-gray-100"}`}>{i + 1}</button>;
                    })}
                  </div>
                </div>
              );
            })}
            </div>
            <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
              {[0, 1, 2, 3, 7].map((days) => <button type="button" key={days} aria-pressed={preferences.tolerance === days}
                onClick={() => update({ tolerance: days })} className={`${pill} ${preferences.tolerance === days ? "border-[#777] bg-[#f3f4f5]" : "border-[#aaa]"}`}>
                {days === 0 ? "Exact dates" : `± ${days} ${days === 1 ? "day" : "days"}`}
              </button>)}
            </div>
          </>
        ) : (
          <>
            {preferences.mode === "flexible" && <>
              <h4 className="mb-4 mt-1 text-center text-[16px] font-medium">How would you like to stay?</h4>
              <div className="flex justify-center gap-2">
                {(["Weekend", "Week", "Month"] as const).map((stay) => <button key={stay} type="button" aria-pressed={preferences.stay === stay}
                  onClick={() => update({ stay })} className={`${pill} ${preferences.stay === stay ? "border-[#777] bg-[#f3f4f5]" : "border-[#aaa]"}`}>{stay}</button>)}
              </div>
            </>}
              <h4 className="mb-4 mt-7 text-center text-[16px] font-medium">{preferences.mode === "flexible" ? "Go anytime" : "Which months?"}</h4>
            <div className="flex items-center gap-2">
              {desktop && <button type="button" aria-label="Previous months" aria-controls={`${pickerId}-months`} disabled={sliderEdges.start}
                onClick={() => slideMonths(-1)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#aaa] hover:bg-[#f3f4f5] disabled:opacity-30 disabled:cursor-not-allowed">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="h-4 w-4"><path d="m14 5-7 7 7 7" /></svg>
              </button>}
            <div ref={monthSliderRef} id={`${pickerId}-months`} aria-label="Available months"
              className="no-scrollbar flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain py-1">
              {Array.from({ length: 12 }, (_, i) => {
                const month = new Date(today.getFullYear(), i, 1);
                const key = dateKey(month).slice(0, 7);
                return <button key={key} type="button" aria-label={monthLabel(month)} aria-pressed={preferences.months.includes(key)} onClick={() => toggleMonth(key)}
                  className={`flex min-w-0 shrink-0 snap-start flex-col items-center rounded-[22px] border px-0.5 py-4 ${desktop ? "basis-[calc((100%-2rem)/5)] text-[10px] lg:text-xs" : "basis-[calc((100%-1rem)/2.8)] text-xs"} ${preferences.months.includes(key) ? "border-[#1f1f1f] bg-[#fcdf9c]" : "border-[#aaa]"}`}>
                  <Image src="/images/icons/date-picker-icon.svg" alt="" width={28} height={28} className="mb-1 h-7 w-7" />
                  <span className="max-w-full truncate">{month.toLocaleDateString("en-US", { month: desktop ? "long" : "short" })}</span><span>{month.getFullYear()}</span>
                </button>;
              })}
            </div>
              {desktop && <button type="button" aria-label="Next months" aria-controls={`${pickerId}-months`} disabled={sliderEdges.end}
                onClick={() => slideMonths(1)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#aaa] hover:bg-[#f3f4f5] disabled:opacity-30 disabled:cursor-not-allowed">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="h-4 w-4"><path d="m10 5 7 7-7 7" /></svg>
              </button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
