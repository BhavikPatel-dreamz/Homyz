"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarSettingsPanel } from "./calendar-settings-panel";
import { HostSubNav } from "./host-sub-nav";
import { updateListingAction, bulkUpdateAvailabilityAction } from "@/actions/host/listings";
import type { ListingDTO } from "@/services/mappers";
import { resolvePropertyCurrency } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { MoneyInput } from "@/components/ui/money-input";
import {
  WorkspaceDialog,
  ReservationDetails,
  MoneyDialog,
  PropertyPhoto,
  dateKey,
  shortDate,
  type HostWorkspaceProps,
  type HostReservation,
} from "./host-workspace-shared";
import {
  bookingDateKey,
  formatBookingDate,
  formatBookingDateRange,
  compareBookingDates,
  differenceInBookingNights,
} from "@/lib/booking/booking-date";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { CloseButton } from "@/components/ui/close-button";
import { calculatePriceTips } from "@/lib/pricing/price-tips";
import {
  resolveCalendarMonthPricing,
  analyzeSelectionPromotion,
  type SelectionPromotionStats,
} from "@/lib/pricing/calendar-pricing";

export interface HostCalendarWorkspaceProps extends HostWorkspaceProps {
  initialListingId?: string;
  initialMonth?: string; // YYYY-MM
  initialView?: string; // "month" | "year"
}

export interface CalendarSelection {
  start: string | null; // YYYY-MM-DD
  end: string | null; // YYYY-MM-DD
  isDragging?: boolean;
}

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const monthsList = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const monthName = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long" });

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function parseMonthKey(key?: string | null): Date | null {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return null;
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }
  return new Date(year, month - 1, 1);
}

function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function getNormalizedRange(selection: CalendarSelection): {
  start: string;
  end: string;
} | null {
  if (!selection.start) return null;
  const end = selection.end || selection.start;
  return selection.start <= end
    ? { start: selection.start, end }
    : { start: end, end: selection.start };
}

function getAllDatesInRange(start: string, end: string): string[] {
  const min = start <= end ? start : end;
  const max = start <= end ? end : start;
  const list: string[] = [];
  let cur = min;
  while (cur <= max) {
    list.push(cur);
    cur = shiftDateKey(cur, 1);
  }
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────
// MonthGrid: High-performance O(1) cell lookup calendar with continuous booking
// bars, multi-date range selection, and drag support
// ─────────────────────────────────────────────────────────────────────────────

interface MonthGridProps {
  month: Date;
  listing: ListingDTO | null;
  bookingsByDate: Map<string, HostReservation[]>;
  bookingRanges: Array<{
    booking: HostReservation;
    start: string;
    end: string;
  }>;
  blockedDatesSet: Set<string>;
  customPricesMap: Map<string, number>;
  selection: CalendarSelection;
  focusedDateKey: string | null;
  isAllListings: boolean;
  listingsCount: number;
  compact: boolean;
  onDayClick: (
    key: string,
    booking?: HostReservation,
    allBookings?: HostReservation[],
    shiftKey?: boolean,
  ) => void;
  onDayPointerDown?: (key: string, e: ReactPointerEvent) => void;
  onDayPointerEnter?: (key: string) => void;
  onKeyDown?: (key: string, e: KeyboardEvent) => void;
}

/** The calendar index shown before a host opens an individual property's grid. */
function MobileCalendarIndex({
  listings,
  selectedId,
  onSelect,
  onOpenCalendar,
}: {
  listings: ListingDTO[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenCalendar: () => void;
}) {
  return (
    <section className="sm:hidden">
      <h1 className="mb-6">
        Calendars
      </h1>
      <div
        className={`mb-6 divide-y divide-[#dddddd] ${listings.length > 1 ? "border-b border-[#dddddd]" : ""}`}
      >
        {listings.map((listing, index) => {
          const selected = listing.id === selectedId;
          return (
            <button
              key={listing.id}
              type="button"
              onClick={() => {
                onSelect(listing.id);
                onOpenCalendar();
              }}
              aria-pressed={selected}
              className={`flex w-full items-center gap-3 py-3 text-left transition-colors ${selected ? "bg-[#fafafa]" : "bg-white"
                }`}
            >
              <PropertyPhoto
                listing={listing}
                className={`size-[106px] shrink-0 rounded-[10px] object-cover ${selected ? "ring-[2px] ring-[#a5a0ff] ring-offset-1" : "border border-[#727272]"
                  }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-normal text-[#1f1f1f]">
                  {listing.title || "Property name"}
                </p>
                <p className="mt-0.5 truncate font-normal text-xs text-[#727272]">
                  {[listing.district, listing.city].filter(Boolean).join(", ") || listing.country || "Location"}
                </p>
                <p className="mt-4 flex items-center gap-1.5 text-xs text-[#1F1F1F]">
                  <span className="size-2 rounded-full bg-[#37BE01]" />
                  listed
                </p>
              </div>
              <div className="grid w-[106px] shrink-0 grid-cols-7 gap-1 pr-1" aria-hidden="true">
                {Array.from({ length: 35 }, (_, dot) => {
                  const row = Math.floor(dot / 7);
                  const booked = row === (index % 4) && dot % 7 < 5;
                  const active = dot === 27 || dot === 28 || dot === 29;
                  return (
                    <span
                      key={dot}
                      className={`mx-auto size-2 rounded-full ${booked || active ? "bg-[#a5b4fc]" : "bg-[#dedede]"
                        }`}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The mobile year view is deliberately an at-a-glance calendar: dense enough
 * to scan availability, while leaving date editing in the existing month
 * workspace.  It uses the same booking and blocked-date sources as MonthGrid.
 */
function MobileYearCalendar({
  startMonth,
  listing,
  bookingsByDate,
  blockedDatesSet,
  onBack,
  onOpenSettings,
  onOpenMonth,
}: {
  startMonth: Date;
  listing: ListingDTO | null;
  bookingsByDate: Map<string, HostReservation[]>;
  blockedDatesSet: Set<string>;
  onBack: () => void;
  onOpenSettings: () => void;
  onOpenMonth: (month: Date) => void;
}) {
  const months = Array.from(
    { length: 12 },
    (_, index) => new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1),
  );
  const today = dateKey(new Date());
  const propertyLabel = listing?.title || "Property name";
  const location = [listing?.district, listing?.city].filter(Boolean).join(", ") || listing?.country;

  return (
    <section className="sm:hidden">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-[24px] font-medium tracking-0 text-[#1F1F1F] dark:text-zinc-100">
          Calendars
        </h1>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Calendar settings"
          className="flex size-10 items-center justify-center rounded-full bg-[#F3F4F5] text-[#1F1F1F] transition-colors hover:bg-[#ebebeb] dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          <Image
            src="/images/icons/filter-icon.svg"
            alt=""
            width={18}
            height={18}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to calendars"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] text-[#555555] transition-colors bg-[#F3F4F5] hover:bg-[#f7f7f7] dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <p className="truncate text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
          {propertyLabel}{location ? `, ${location}` : ""}
        </p>
      </div>

      <div>
        {months.map((calendarMonth, index) => {
          const beginsYear = index === 0 || calendarMonth.getMonth() === 0;
          const year = calendarMonth.getFullYear();
          const monthIndex = calendarMonth.getMonth();
          const days = new Date(year, monthIndex + 1, 0).getDate();
          const offset = new Date(year, monthIndex, 1).getDay();

          return (
            <Fragment key={formatMonthKey(calendarMonth)}>
              {beginsYear && (
                <h2 className={`text-xl font-medium text-[#1f1f1f] dark:text-zinc-100 ${index === 0 ? "sr-only" : "mt-8 border-t border-[#d5d5d5] pt-8 dark:border-zinc-700"}`}>
                  {year}
                </h2>
              )}
              <button
                type="button"
                onClick={() => onOpenMonth(calendarMonth)}
                aria-label={`Open ${monthName(calendarMonth)} ${year}`}
                className={`group inline-flex w-1/3 flex-col pr-3 text-left align-top ${index > 2 ? "mt-5" : ""} ${index === 2 ? "pr-0" : ""}`}
              >
                <span className="mb-5 text-sm font-normal text-[#1f1f1f] transition-colors group-hover:text-[#8b6400] dark:text-zinc-100 dark:group-hover:text-amber-300">
                  {monthName(calendarMonth).slice(0, 3)}
                </span>
                <span className="grid grid-cols-7 gap-x-1 gap-y-2" aria-hidden="true">
                  {Array.from({ length: 42 }, (_, cell) => {
                    const day = cell - offset + 1;
                    if (day < 1 || day > days) return <span key={cell} className="mx-auto size-1.25" />;
                    const key = dateKey(new Date(year, monthIndex, day));
                    const unavailable = bookingsByDate.has(key) || blockedDatesSet.has(key);
                    const isToday = key === today;
                    return (
                      <span
                        key={cell}
                        className={`mx-auto size-1.5 rounded-full transition-transform group-hover:scale-125 ${unavailable ? "bg-[#1F1F1F] dark:bg-amber-300" : isToday ? "bg-[#8b6400]" : "bg-[#1F1F1F99] dark:bg-[#1F1F1F99]"
                          }`}
                      />
                    );
                  })}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

function MonthGrid({
  month,
  listing,
  bookingsByDate,
  bookingRanges,
  blockedDatesSet,
  customPricesMap,
  selection,
  focusedDateKey,
  isAllListings,
  listingsCount,
  compact,
  onDayClick,
  onDayPointerDown,
  onDayPointerEnter,
  onKeyDown,
}: MonthGridProps) {
  const { formatPrice: formatMoney } = useCurrency();
  const sourceCurrency = resolvePropertyCurrency(listing);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const offset = new Date(year, monthIndex, 1).getDay();
  const today = dateKey(new Date());

  const weekdayBase = listing
    ? ((listing as any).weekdayBasePrice ?? listing.price)
    : 0;

  const normalizedRange = useMemo(
    () => getNormalizedRange(selection),
    [selection],
  );

  const dayPricingMap = useMemo(
    () => resolveCalendarMonthPricing({
      year,
      monthIndex,
      listing: listing as unknown as Parameters<typeof resolveCalendarMonthPricing>[0]["listing"],
    }),
    [year, monthIndex, listing],
  );

  return (
    <div className="min-w-0 select-none">
      {/* Weekday headers */}
      <div
        className={`mb-3 grid grid-cols-7 border-b border-b-[#dddddd] py-3 text-center text-base font-medium text-[#1F1F1F] dark:border-b-zinc-800 dark:text-zinc-300 ${compact ? "max-sm:hidden text-[12px]" : ""
          }`}
      >
        {weekdays.map((d) => (
          <span key={d}>
            <span className={compact ? "hidden" : "hidden xl:inline"}>{d}</span>
            <span className={compact ? "" : "xl:hidden"}>{d[0]}</span>
          </span>
        ))}
      </div>

      {/* Days grid */}
      <div
        className={`grid grid-cols-7 md:gap-1 gap-[2px] ${compact ? "" : "lg:grid-cols-[repeat(7,136px)] lg:justify-center"
          }`}
      >
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}

        {Array.from({ length: count }, (_, i) => {
          const dayNum = i + 1;
          const date = new Date(year, monthIndex, dayNum);
          const key = dateKey(date);
          const isToday = key === today;
          const isPast = key < today;
          const dayBookings = bookingsByDate.get(key) || [];
          const primaryReservation = dayBookings[0];

          // Check if key is part of normalized selected range
          const isSelected =
            !isAllListings &&
            normalizedRange !== null &&
            key >= normalizedRange.start &&
            key <= normalizedRange.end;
          const isRangeStart =
            isSelected && key === normalizedRange?.start;
          const isRangeEnd = isSelected && key === normalizedRange?.end;
          const isSingleSelection =
            isSelected && isRangeStart && isRangeEnd;
          const isRangeMiddle =
            isSelected && !isRangeStart && !isRangeEnd;

          // Continuous reservation bar calculation
          const activeRange = primaryReservation
            ? bookingRanges.find(
              (r) =>
                r.booking.id === primaryReservation.id &&
                r.start <= key &&
                r.end > key,
            )
            : null;

          const isBookingStart =
            activeRange ? key === activeRange.start : false;
          const isBookingEndNight =
            activeRange
              ? key === shiftDateKey(activeRange.end, -1)
              : false;

          // ALL LISTINGS MODE
          if (isAllListings) {
            const bookedCount = dayBookings.length;
            const availableCount = Math.max(0, listingsCount - bookedCount);

            return (
              <button
                key={key}
                type="button"
                tabIndex={focusedDateKey === key ? 0 : -1}
                onClick={(e) => onDayClick(key, undefined, dayBookings, e.shiftKey)}
                onKeyDown={(e) => onKeyDown?.(key, e)}
                aria-label={`${key}, ${bookedCount} reserved of ${listingsCount} listings`}
                className={`group relative flex min-w-0 flex-col items-center justify-between rounded-xl border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${compact
                  ? "min-h-3 rounded-full p-0 sm:min-h-[64px] sm:rounded-[10px] sm:py-1.5"
                  : "min-h-20 p-2 sm:min-h-24 lg:min-h-32"
                  } ${bookedCount > 0
                    ? "border-zinc-800 dark:border-zinc-700 bg-zinc-900 text-white shadow-xs"
                    : isPast
                      ? "border-transparent bg-[#F3F4F5]/40 dark:bg-zinc-800/40 opacity-70 text-[#727272]"
                      : "border-transparent bg-[#F3F4F5] dark:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-600 text-[#1F1F1F] dark:text-zinc-100"
                  }`}
              >
                {/* Day number */}
                <span
                  className={`flex size-8.5 items-center justify-center rounded-full font-normal transition-transform ${compact
                    ? "size-1 shrink-0 max-sm:bg-zinc-500 text-xs sm:size-6 sm:border sm:border-zinc-300 dark:sm:border-zinc-600 sm:bg-white dark:sm:bg-zinc-700 sm:text-[#403C34] dark:sm:text-zinc-200 sm:text-[12px]"
                    : "size-6 text-xs sm:size-7 sm:text-xs"
                    } ${isToday
                      ? "border border-[#EBA900] bg-[#FCDF9C] text-[#403C34] font-semibold shadow-xs sm:!border-[#EBA900] sm:!bg-[#FCDF9C] dark:border-[#EBA900] dark:bg-[#FCDF9C] dark:text-[#403C34]"
                      : bookedCount > 0
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-700"
                    }`}
                >
                  {dayNum}
                </span>

                {/* Status for All Listings */}
                <div className="w-full text-center mt-1">
                  <span
                    className={`${compact ? "hidden text-xs font-normal sm:block" : "text-sm font-medium block"} ${bookedCount > 0
                      ? "text-amber-300"
                      : "text-zinc-600 dark:text-zinc-300"
                      }`}
                  >
                    {bookedCount > 0
                      ? `${bookedCount} booked`
                      : `${availableCount} open`}
                  </span>
                </div>

                {/* Micro indicators in compact view */}
                {bookedCount > 0 && !compact && (
                  <div className="w-full truncate rounded bg-zinc-800/90 px-1 py-0.5 text-[10px] text-zinc-300">
                    {dayBookings.map((b) => b.guestName).join(", ")}
                  </div>
                )}
              </button>
            );
          }

          // SINGLE LISTING MODE
          // Status Precedence: BOOKED > BLOCKED > AVAILABLE
          const blocked = blockedDatesSet.has(key);
          const isWeekend = date.getDay() === 4 || date.getDay() === 5;
          const customPrice = customPricesMap.get(key) ?? null;
          const rate =
            customPrice !== null
              ? customPrice
              : isWeekend &&
                listing?.weekendPrice != null &&
                listing.weekendPrice > 0
                ? listing.weekendPrice
                : weekdayBase;

          // Compute cell visual styles
          let cellBgClass =
            "border-transparent bg-[#F3F4F5] text-[#1F1F1F] hover:bg-[#DDDDDE] dark:bg-zinc-800/80 dark:text-zinc-100 dark:hover:border-zinc-600";
          let cellRoundingClass = compact ? "rounded-[10px]" : "md:rounded-[20px] rounded-[10px]";

          if (primaryReservation) {
            // Keep the reservation treatment inside the tile. The dark stay strip
            // below carries the booking state, while this light surface preserves
            // the scan-friendly month grid used by the host calendar.
            cellBgClass =
              "border border-[#1F1F1F] bg-[#DDDDDE] text-[#1F1F1F] shadow-xs dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100";
            cellRoundingClass = compact ? "rounded-[10px]" : "md:rounded-[20px] rounded-[10px]";
          } else if (blocked) {
            // Blocked state
            cellBgClass =
              "border-[#d7d7d7] dark:border-zinc-800 bg-[#F3F4F5]/80 dark:bg-zinc-900/60 opacity-70 text-[#727272]";
          } else if (isPast) {
            // Past state
            cellBgClass =
              "border-transparent bg-[#F3F4F5] dark:bg-[#F3F4F5] opacity-70 text-[#727272]";
          }

          // Selection highlight override
          if (isSelected) {
            if (isSingleSelection) {
              cellRoundingClass = `${compact ? "rounded-[10px]" : "md:rounded-[20px] rounded-[10px]"}`;
              if (!primaryReservation) {
                cellBgClass =
                  "border-zinc-950 dark:border-amber-400 bg-[#DDDDDE] dark:bg-[#DDDDDE] text-[#1F1F1F] dark:text-zinc-100 shadow-sm";
              }
            } else if (isRangeStart) {
              cellRoundingClass = `${compact ? "rounded-l-[10px]" : "rounded-l-xl"} rounded-r-none border-r-0`;
              if (!primaryReservation) {
                cellBgClass =
                  "border-y-2 border-l-2 border-zinc-950 dark:border-amber-400 bg-amber-100/90 dark:bg-amber-950/70 text-[#1F1F1F] dark:text-zinc-100 shadow-sm";
              }
            } else if (isRangeEnd) {
              cellRoundingClass = `${compact ? "rounded-r-[10px]" : "rounded-r-xl"} rounded-l-none border-l-0`;
              if (!primaryReservation) {
                cellBgClass =
                  "border-y-2 border-r-2 border-zinc-950 dark:border-amber-400 bg-amber-100/90 dark:bg-amber-950/70 text-[#1F1F1F] dark:text-zinc-100 shadow-sm";
              }
            } else if (isRangeMiddle) {
              cellRoundingClass = "rounded-none border-x-0";
              if (!primaryReservation) {
                cellBgClass =
                  "border-y-2 border-zinc-950/40 dark:border-amber-400/50 bg-amber-50/80 dark:bg-amber-950/50 text-[#1F1F1F] dark:text-zinc-100";
              }
            }
          }

          const statusDescription = primaryReservation
            ? `reserved by ${primaryReservation.guestName}`
            : blocked
              ? "blocked"
              : "available";

          const dayPricing = dayPricingMap.get(key);
          const promo = dayPricing?.promotion;

          return (
            <button
              key={key}
              type="button"
              tabIndex={focusedDateKey === key ? 0 : isToday ? 0 : -1}
              onClick={(e) =>
                onDayClick(key, primaryReservation, undefined, e.shiftKey)
              }
              onPointerDown={(e) => onDayPointerDown?.(key, e)}
              onPointerEnter={() => onDayPointerEnter?.(key)}
              onKeyDown={(e) => onKeyDown?.(key, e)}
              aria-label={`${key}, ${statusDescription}, ${promo?.applied ? `${formatMoney(promo.promotionalPrice, sourceCurrency, 2)} (${promo.percentage}% promo, regular ${formatMoney(rate, sourceCurrency, 2)})` : formatMoney(rate, sourceCurrency, 2)}${isSelected ? ", selected" : ""}`}
              aria-pressed={isSelected}
              className={`group relative flex min-w-0 self-stretch flex-col items-center border text-center transition-all duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 ${cellRoundingClass} ${cellBgClass} ${compact
                ? "min-h-[48px] p-1 sm:min-h-[68px] sm:py-1.5"
                : "min-h-[84px] sm:p-2 p-1 sm:min-h-[126px] lg:h-[146px] lg:min-h-[146px]"
                }`}
            >
              <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2">
                {/* Day number */}
                <div className="flex w-full items-center justify-center px-1">
                <span
                  className={`flex items-center justify-center rounded-full font-medium transition-transform ${compact
                    ? "size-5 max-[360px]:text-[9px] text-xs sm:size-6 sm:border sm:border-zinc-300 dark:sm:border-zinc-600 sm:bg-white dark:sm:bg-zinc-700 sm:text-zinc-800 dark:sm:text-zinc-200 sm:text-[12px]"
                    : "size-6 text-xs sm:size-7 sm:text-xs"
                    } ${isSelected
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-medium"
                      : isToday
                        ? "border border-[#EBA900] bg-[#FCDF9C] text-[#1F1F1F] font-bold shadow-xs sm:!border-[#EBA900] sm:!bg-[#FCDF9C] dark:border-[#EBA900] dark:bg-[#FCDF9C] dark:text-[#1F1F1F]"
                        : primaryReservation
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-medium"
                          : "text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-700"
                    } ${blocked ? "line-through text-[#727272]" : ""} ${isSelected || primaryReservation ? "!text-xs" : ""}`}
                >
                  {dayNum}
                </span>

                </div>

                {/* Price / Status */}
                <div className="flex min-h-8 w-full flex-col items-center justify-center px-0.5 text-center">
                {blocked ? (
                  <span className="sm:text-sm text-[10px] leading-tight text-[#727272] line-through font-medium">Blocked</span>
                ) : primaryReservation ? (
                  <span className="font-['Poppins'] text-[10px] leading-normal tracking-normal font-medium text-[#1F1F1F] dark:text-zinc-100 lg:text-[12px]">{formatMoney(rate, sourceCurrency, 2)}</span>
                ) : isPast ? (
                  <span className="sm:text-sm text-[10px] leading-tight text-[#727272] line-through font-medium">{formatMoney(rate, sourceCurrency, 2)}</span>
                ) : promo?.applied ? (
                  compact ? (
                    <>
                      <span className="mt-0.5 block text-[12px] font-medium leading-4 text-[#08785d] dark:text-emerald-400">
                        {formatMoney(promo.promotionalPrice, sourceCurrency, 2)}
                      </span>
                      <span className="mt-0.5 rounded-sm border border-[#a7e9ce] bg-[#d9f7eb] px-0.5 py-[2px] sm:text-[10px] text-[8px] font-medium leading-tight text-[#08785d] dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                        {promo.percentage}% promo
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] sm:text-xs text-[#727272] dark:text-[#727272] line-through leading-none block mb-1">
                        {formatMoney(dayPricing?.originalPrice ?? rate, sourceCurrency, 2)}
                      </span>
                      <span className="text-[10px] sm:text-[14px] font-medium text-emerald-700 dark:text-emerald-400 leading-tight block">
                        {formatMoney(promo.promotionalPrice, sourceCurrency, 2)}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="sm:text-[10px] text-[8px] font-medium capitalize tracking-tight text-[#08785d] border border-[#a7e9ce] dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-1 sm:rounded-md roudned leading-tight">
                          {promo.percentage}% promo
                        </span>
                        {customPrice !== null && (
                          <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1 rounded">
                            custom
                          </span>
                        )}
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <span
                      className={`${compact ? "mt-0.5 block font-normal text-[#1F1F1F] dark:text-zinc-100 text-[12px] leading-normal " : "font-['Poppins'] text-[10px] lg:text-[16px] lg:leading-6 leading-normal tracking-normal font-medium"} ${compact
                        ? ""
                        : customPrice !== null
                          ? "text-amber-600 dark:text-amber-400 font-bold"
                          : isSelected
                            ? "text-zinc-950 dark:text-amber-300 font-medium"
                            : "text-[#1F1F1F] dark:text-zinc-100"
                        }`}
                    >
                      {formatMoney(rate, sourceCurrency, 2)}
                    </span>
                    {customPrice !== null && (
                      <span className="text-[9px] font-semibold text-[#1f1f1f] dark:text-amber-300 bg-[#FCDF9C] dark:bg-amber-950/60 px-1.5 py-1 rounded mt-0.5 border border-[#EBA900] leading-tight capitalize">
                        custom
                      </span>
                    )}
                  </>
                )}
                </div>
              </div>

              {/* Continuous Reservation Bar — hidden in the compact Year view. */}
              {primaryReservation && !compact ? (
                <div className="mt-3 md:flex hidden items-center gap-1 truncate rounded-lg bg-[#1F1F1F] pr-2 pl-0 min-h-8 text-xs font-medium text-white relative w-full">
                  {isBookingStart && (
                    primaryReservation.guestImage ? (
                      // Reservation data already supplies an optional guest image.
                      // Keeping the image inside the existing booking bar makes the
                      // status easier to scan without changing its interaction.
                      // eslint-disable-next-line @next/next/no-img-element
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-amber-300 text-xs font-medium text-[#1F1F1F]">
                        <img
                          src={primaryReservation.guestImage}
                          alt=""
                          className="size-4 shrink-0 rounded-lg border border-white/50 object-cover"
                        />
                      </span>
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-amber-300 text-xs font-medium text-[#1F1F1F]">
                        {primaryReservation.guestName[0]}
                      </span>
                    )
                  )}
                  <span className="truncate pl-2">
                    {isBookingStart
                      ? primaryReservation.guestName
                      : `Stay · ${primaryReservation.guestName}`}
                  </span>
                </div>
              ) : !compact ? (
                <div className="hidden h-8 md:block" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LazyMonthCard: Lazy rendered month for buttery smooth 12+ month Year View
// ─────────────────────────────────────────────────────────────────────────────

function LazyMonthCard({
  month,
  listing,
  bookingsByDate,
  bookingRanges,
  blockedDatesSet,
  customPricesMap,
  selection,
  isAllListings,
  listingsCount,
  onDayClick,
  onSelectMonth,
}: {
  month: Date;
  listing: ListingDTO | null;
  bookingsByDate: Map<string, HostReservation[]>;
  bookingRanges: Array<{
    booking: HostReservation;
    start: string;
    end: string;
  }>;
  blockedDatesSet: Set<string>;
  customPricesMap: Map<string, number>;
  selection: CalendarSelection;
  isAllListings: boolean;
  listingsCount: number;
  onDayClick: (
    key: string,
    booking?: HostReservation,
    allBookings?: HostReservation[],
    shiftKey?: boolean,
  ) => void;
  onSelectMonth: (month: Date) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="min-w-0 border-b border-[#e9e9e9] pb-7 dark:border-zinc-800"
    >
      <button
        type="button"
        onClick={() => onSelectMonth(month)}
        aria-label={`Open ${monthName(month)} ${month.getFullYear()} month view`}
        className="mb-5 flex w-full items-center text-left text-base font-medium text-[#1F1F1F] transition-colors hover:text-amber-400 dark:text-zinc-100 dark:hover:text-amber-400"
      >
        {monthName(month)}
      </button>

      {isVisible ? (
        <MonthGrid
          month={month}
          listing={listing}
          bookingsByDate={bookingsByDate}
          bookingRanges={bookingRanges}
          blockedDatesSet={blockedDatesSet}
          customPricesMap={customPricesMap}
          selection={selection}
          focusedDateKey={null}
          isAllListings={isAllListings}
          listingsCount={listingsCount}
          compact
          onDayClick={onDayClick}
        />
      ) : (
        <div className="h-[200px] w-full rounded-xl bg-zinc-50 dark:bg-zinc-800/40 animate-pulse" />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContextualManagementPanel (Phase 6 & 7): Right-side contextual management
// panel for selected date / date range with Price & Availability modes
// ─────────────────────────────────────────────────────────────────────────────

interface SelectedDatesStats {
  totalNights: number;
  allKeys: string[];
  editableKeys: string[];
  bookedCount: number;
  blockedCount: number;
  availableCount: number;
  pastCount: number;
  allBlocked: boolean;
  allAvailable: boolean;
  isMixedAvailability: boolean;
  commonAvailability: "available" | "blocked" | "booked" | "mixed";
  isMixedPrice: boolean;
  commonPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  isMixedMinStay: boolean;
  commonMinStay: number | null;
  minStayValues: number[];
  promoStats: SelectionPromotionStats;
}

function ContextualManagementPanel({
  listing,
  range,
  stats,
  sourceCurrency,
  saving,
  notice,
  onSave,
  onClear,
  onPreviewPrice,
  onBulkAvailability,
  bookings,
}: {
  listing: ListingDTO;
  range: { start: string; end: string };
  stats: SelectedDatesStats;
  sourceCurrency: string;
  saving: boolean;
  notice: string;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onClear: () => void;
  onPreviewPrice?: (priceInCents: number | null) => void;
  onBulkAvailability?: (
    action: "BLOCK" | "UNBLOCK" | "RESTORE",
    dates: string[],
  ) => Promise<any>;
  bookings?: HostReservation[];
}) {
  const { formatPrice: formatMoney } = useCurrency();
  const [panelMode, setPanelMode] = useState<"price" | "availability">("price");

  const priceTipsResult = useMemo(() => {
    if (!stats.editableKeys.length) return null;
    return calculatePriceTips({
      listing,
      dateKeys: stats.editableKeys,
      bookings: bookings || [],
    });
  }, [listing, stats.editableKeys, bookings]);
  const [lastUndo, setLastUndo] = useState<{
    action: "BLOCK" | "UNBLOCK";
    previousBlockedDates: string[];
    affectedCount: number;
    protectedCount: number;
  } | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState("");
  const [validationError, setValidationError] = useState("");
  const [specialDaysDiscountInput, setSpecialDaysDiscountInput] = useState(() =>
    String(stats.promoStats.percentage || 15),
  );
  const [promoValidationError, setPromoValidationError] = useState("");
  const [customMinStayInput, setCustomMinStayInput] = useState("");
  const [minStayValidationError, setMinStayValidationError] = useState("");
  const isDirty = Boolean(
    customPriceInput ||
    customMinStayInput ||
    specialDaysDiscountInput !== String(stats.promoStats.percentage || 15),
  );

  const handleClearWithConfirm = () => {
    if (isDirty && typeof window !== "undefined") {
      if (!window.confirm("You have unsaved changes in this selection. Discard them?")) {
        return;
      }
    }
    onPreviewPrice?.(null);
    onClear();
  };

  const weekdayBasePrice =
    (listing as any).weekdayBasePrice ?? listing.price;
  const weekendPrice = listing.weekendPrice;

  const rawDiscounts =
    typeof listing.discounts === "object" && listing.discounts !== null
      ? (listing.discounts as Record<string, any>)
      : {};

  const activePromo =
    rawDiscounts.custom_promotion &&
      typeof rawDiscounts.custom_promotion === "object" &&
      rawDiscounts.custom_promotion.enabled
      ? rawDiscounts.custom_promotion
      : null;

  const weeklyPct =
    typeof rawDiscounts.weekly === "object"
      ? rawDiscounts.weekly?.percentage ?? 10
      : Number((listing as any).weeklyDiscount || rawDiscounts.weekly || 10);

  const monthlyPct =
    typeof rawDiscounts.monthly === "object"
      ? rawDiscounts.monthly?.percentage ?? 25
      : Number((listing as any).monthlyDiscount || rawDiscounts.monthly || 25);

  useEffect(() => {
    return () => {
      onPreviewPrice?.(null);
    };
  }, [onPreviewPrice]);

  const handleCustomPriceChange = (valStr: string) => {
    setCustomPriceInput(valStr);
    if (validationError) setValidationError("");
    const num = Number(valStr);
    if (Number.isFinite(num) && num > 0) {
      onPreviewPrice?.(Math.round(num * 100));
    } else {
      onPreviewPrice?.(null);
    }
  };

  const saveSpecialDaysDiscount = async () => {
    const percentage = Number(specialDaysDiscountInput);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      setPromoValidationError("Enter a discount between 1% and 100%.");
      return;
    }

    setPromoValidationError("");
    const currentDiscounts = ((listing as any).discounts || {}) as Record<string, any>;
    const currentPromo = (currentDiscounts.custom_promotion || {}) as Record<string, any>;
    await onSave({
      discounts: {
        ...currentDiscounts,
        custom_promotion: {
          ...currentPromo,
          enabled: true,
          percentage: Math.round(percentage),
          startDate: range.start,
          endDate: range.end,
        },
      },
    });
  };

  const formattedDateRange =
    range.start === range.end
      ? new Date(`${range.start}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      : formatBookingDateRange(range.start, shiftDateKey(range.end, 1));

  return (
    <div className="space-y-5 font-['Poppins'] text-[#1F1F1F] dark:text-zinc-100">
      {/* Header */}
      <div className="rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-4 shadow-[0_2px_4px_rgb(31_31_31_/_0.16)] dark:border-zinc-700/80 dark:bg-zinc-800/70">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-2 block text-[13px] font-normal text-[#727272] dark:text-zinc-400">
              Selected Range
            </p>
            <h2 className="truncate text-[17px] font-medium leading-tight text-[#1F1F1F] dark:text-zinc-100">
              {formattedDateRange}
            </h2>
            <p className="mt-1 truncate text-[12px] text-[#727272] dark:text-zinc-400">
              {stats.totalNights} {stats.totalNights === 1 ? "night" : "nights"} · {listing.title}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearWithConfirm}
            className="cursor-pointer rounded-full bg-white p-1.5 text-[#727272] transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            aria-label="Clear date selection"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Breakdown Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {stats.editableKeys.length} editable
          </span>
          {stats.bookedCount > 0 && (
            <span className="rounded-full bg-zinc-900 dark:bg-zinc-700 px-2.5 py-0.5 font-semibold text-white">
              {stats.bookedCount} reserved (protected)
            </span>
          )}
          {stats.pastCount > 0 && (
            <span className="rounded-full bg-zinc-200 dark:bg-zinc-800 px-2.5 py-0.5 font-medium text-[#727272]">
              {stats.pastCount} past (read-only)
            </span>
          )}
        </div>
      </div>

      {/* Protected Reservations Notice */}
      {stats.bookedCount > 0 && stats.editableKeys.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200/60 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300">
          <p className="font-semibold mb-0.5">Protected Reservations</p>
          <p className="text-xs leading-relaxed">
            {stats.bookedCount} {stats.bookedCount === 1 ? "night has" : "nights have"} confirmed reservations.
            Updates will safely apply only to the {stats.editableKeys.length} editable dates.
          </p>
        </div>
      )}

      {stats.editableKeys.length === 0 && (
        <div className="rounded-xl bg-[#F3F4F5] dark:bg-zinc-800/80 p-3.5 border border-[#d7d7d7] dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Confirmed Reservation
          </p>
          <p className="text-xs leading-relaxed">
            All selected dates are part of an active reservation and cannot be edited.
          </p>
        </div>
      )}

      {/* Mode Switcher Tabs: Price vs Availability */}
      {stats.editableKeys.length > 0 && (
        <div
          role="tablist"
          aria-label="Contextual panel mode"
          className="mx-auto flex w-full overflow-hidden rounded-full border border-white bg-white p-1 gap-1 shadow-[0px_2px_4px_0px_#00000040] dark:border-white/20 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="tab"
            aria-selected={panelMode === "price"}
            onClick={() => {
              setPanelMode("price");
              setValidationError("");
            }}
            className={`flex h-9 min-w-0 flex-1 items-center justify-center rounded-full px-3 text-[14px] font-normal leading-none text-[#1F1F1F] transition-colors duration-300 cursor-pointer dark:text-zinc-100 ${panelMode === "price"
              ? "bg-[#DDDDDE] dark:bg-zinc-700"
              : "hover:bg-[#DDDDDE] dark:hover:bg-zinc-700"
              }`}
          >
            Price
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelMode === "availability"}
            onClick={() => {
              setPanelMode("availability");
              setValidationError("");
              setMinStayValidationError("");
            }}
            className={`flex h-9 min-w-0 flex-1 items-center justify-center rounded-full px-3 text-[14px] font-normal leading-none text-[#1F1F1F] transition-colors duration-300 cursor-pointer dark:text-zinc-100 ${panelMode === "availability"
              ? "bg-[#DDDDDE] dark:bg-zinc-700"
              : "hover:bg-[#DDDDDE] dark:hover:bg-zinc-700"
              }`}
          >
            Availability
          </button>
        </div>
      )}

      {/* Mode 1: Price Editing */}
      {panelMode === "price" && stats.editableKeys.length > 0 && (
        <div className="space-y-4">
          {/* Base Listing Rate Card */}
          <div className="space-y-3">
            <div className="rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70">
              <span className="block text-[13px] font-normal text-[#727272] dark:text-zinc-400">
                Base Nightly Price
              </span>
              <p className="mt-2 text-[17px] font-medium leading-none text-[#1F1F1F] dark:text-zinc-100">
                {formatMoney(weekdayBasePrice, sourceCurrency, 2)} <span className="text-[13px] font-normal text-[#727272] dark:text-zinc-400">/ Night</span>
              </p>
            </div>
            {weekendPrice && weekendPrice > 0 ? (
              <div className="rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70">
                <span className="block text-[13px] font-normal text-[#727272] dark:text-zinc-400">
                  Weekend Rate
                </span>
                <p className="mt-2 text-[17px] font-medium leading-none text-[#1F1F1F] dark:text-zinc-100">
                  {formatMoney(weekendPrice, sourceCurrency, 2)} <span className="text-[13px] font-normal text-[#727272] dark:text-zinc-400">/ Night</span>
                </p>
              </div>
            ) : null}
          </div>

          {/* Current Effective Rate for Selection */}
          <div className="rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70">
            <p className="text-xs font-normal text-[#727272] dark:text-zinc-400 block">
              Effective Selection Rate
            </p>
            {stats.isMixedPrice ? (
              <div className="mt-1">
                <span className="inline-block rounded-md bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                  Mixed Rates
                </span>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {formatMoney(stats.minPrice ?? 0, sourceCurrency, 2)} –{" "}
                  {formatMoney(stats.maxPrice ?? 0, sourceCurrency, 2)}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {formatMoney(stats.commonPrice ?? 0, sourceCurrency, 2)}{" "}
                <span className="text-xs font-medium text-[#727272] dark:text-zinc-400">/ Night</span>
              </p>
            )}
          </div>

          {/* Phase 14 & Phase 20: Advisory Price Tip Recommendation Card */}
          {priceTipsResult && priceTipsResult.applicableCount > 0 && (
            <div className="space-y-3 rounded-[12px] bg-[#FEF3D7] border border-white p-4 shadow-[0_2px_4px_0px_#00000040] dark:border-amber-800 dark:bg-amber-950/40">
              <div className="flex items-start flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-semibold text-[#1F1F1F] dark:text-amber-100 mb-3">
                    Price Tip Recommendation
                  </span>
                </div>
                {priceTipsResult.overallAction === "INCREASE" ? (
                  <span className="rounded-full bg-[#FCDF9C] px-2.5 py-1 text-sm font-medium text-[#1F1F1F] dark:bg-amber-900/80 dark:text-amber-100">
                    Demand Surge
                  </span>
                ) : priceTipsResult.overallAction === "DECREASE" ? (
                  <span className="rounded-full bg-[#E9EBFF] px-2.5 py-1.5 text-xs font-medium text-[#394280] dark:bg-blue-950 dark:text-blue-200">
                    Booking Incentive
                  </span>
                ) : priceTipsResult.overallAction === "NO_CHANGE" ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    Optimal
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    Advisory
                  </span>
                )}
              </div>

              {/* Price comparison */}
              <div className="flex items-baseline justify-between pt-0.5">
                <div>
                  <span className="text-xs font-normal text-[#727272] dark:text-zinc-400 block">
                    Current rate
                  </span>
                  <span className="text-sm font-medium text-[#1F1F1F] dark:text-zinc-200">
                    {formatMoney(priceTipsResult.averageCurrentPrice, sourceCurrency, 2)}
                    <span className="text-xs font-normal text-[#727272] leading-tight"> / Night</span>
                  </span>
                </div>
                {priceTipsResult.overallAction !== "NO_CHANGE" && priceTipsResult.overallAction !== "INSUFFICIENT_DATA" && (
                  <span className="text-sm text-[#727272]">→</span>
                )}
                <div className="text-right">
                  <span className="text-xs font-normal text-[#727272] dark:text-zinc-400 block">
                    {priceTipsResult.overallAction === "NO_CHANGE"
                      ? "Recommended"
                      : priceTipsResult.overallAction === "INSUFFICIENT_DATA"
                        ? "Active rate"
                        : "Suggested"}
                  </span>
                  <span className="text-sm font-semibold text-[#1F1F1F] dark:text-zinc-100">
                    {formatMoney(priceTipsResult.averageSuggestedPrice, sourceCurrency, 2)}
                    <span className="text-xs font-normal text-[#727272] leading-tight"> / Night</span>
                  </span>
                </div>
              </div>

              {/* Multi-date breakdown summary if applicable */}
              {priceTipsResult.applicableCount > 1 && (
                <div className="flex items-center justify-between rounded-xl border border-[#F5D98C]/70 bg-white/70 p-2.5 text-[12px] text-[#5F5F5F] dark:border-amber-900/40 dark:bg-zinc-900/60 dark:text-zinc-300">
                  <span>{priceTipsResult.applicableCount} nights selected</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                    {priceTipsResult.increaseCount > 0 ? `${priceTipsResult.increaseCount} increase ` : ""}
                    {priceTipsResult.decreaseCount > 0 ? `${priceTipsResult.decreaseCount} decrease ` : ""}
                    {priceTipsResult.noChangeCount > 0 ? `${priceTipsResult.noChangeCount} optimal` : ""}
                  </span>
                </div>
              )}

              {/* Reasons list */}
              <div className="space-y-1.5 text-xs leading-normal text-[#5F5F5F] dark:text-zinc-300">
                {priceTipsResult.reasons.map((r, idx) => (
                  <p key={idx} className="flex items-start gap-1.5 leading-5">
                    <span className="text-[#727272] font-bold shrink-0">•</span> <span>{r}</span>
                  </p>
                ))}
              </div>

              {/* Action bar with difference and Apply button */}
              <div className="flex items-center justify-between border-t border-[#d7d7d7] pt-3 dark:border-amber-900/60">
                <span className="text-sm font-semibold text-[#f1f1f1f] dark:text-zinc-400">
                  {priceTipsResult.averageDifference !== 0
                    ? `${priceTipsResult.averageDifference > 0 ? "+" : ""}${formatMoney(priceTipsResult.averageDifference, sourceCurrency, 2)} (${priceTipsResult.averagePercentChange > 0 ? "+" : ""}${priceTipsResult.averagePercentChange}%)`
                    : priceTipsResult.overallAction === "INSUFFICIENT_DATA"
                      ? "No adjustment recommended"
                      : "Matches current rate"}
                </span>

                {priceTipsResult.overallAction === "INCREASE" || priceTipsResult.overallAction === "DECREASE" ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      const nextCustom = {
                        ...(((listing as any).customPrices || {}) as Record<string, number>),
                      };
                      for (const rec of priceTipsResult.recommendations) {
                        if (!rec.isBooked && (rec.action === "INCREASE" || rec.action === "DECREASE")) {
                          nextCustom[rec.dateKey] = rec.suggestedPrice;
                        }
                      }
                      onPreviewPrice?.(null);
                      await onSave({ customPrices: nextCustom });
                    }}
                    className="cursor-pointer rounded-full bg-[#FCDF9C] px-3.5 py-2 text-[12px] font-medium text-[#1F1F1F] hover:text-white transition-colors duration-300 hover:bg-[#1f1f1f] disabled:opacity-70"
                  >
                    {saving
                      ? "Applying…"
                      : priceTipsResult.applicableCount > 1
                        ? `Apply to ${priceTipsResult.increaseCount + priceTipsResult.decreaseCount} dates`
                        : "Apply tip"}
                  </button>
                ) : (
                  <span className="text-[12px] font-medium italic text-[#727272] dark:text-zinc-400">
                    {priceTipsResult.overallAction === "NO_CHANGE" ? "Already optimal" : "Manual rate active"}
                  </span>
                )}
              </div>

              <p className="text-xs leading-normal text-[#727272] dark:text-[#727272]">
                {priceTipsResult.marketDataNote}
              </p>
            </div>
          )}

          {/* Set Custom Price Form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const val = Number(customPriceInput);
              if (!Number.isFinite(val) || val <= 0) {
                setValidationError("Please enter a valid price greater than 0.");
                return;
              }
              setValidationError("");
              const nextCustom = {
                ...(((listing as any).customPrices || {}) as Record<string, number>),
              };
              for (const k of stats.editableKeys) {
                nextCustom[k] = Math.round(val * 100);
              }
              onPreviewPrice?.(null);
              await onSave({ customPrices: nextCustom });
              setCustomPriceInput("");
            }}
            className="space-y-3"
          >
            <div className="rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70">
              <label
                htmlFor="contextualCustomPrice"
                className="block font-medium text-[#1F1F1F] dark:text-zinc-200 text-base mb-3"
              >
                Set custom nightly rate
              </label>
              <div className="flex gap-2">
                <MoneyInput
                  id="contextualCustomPrice"
                  currency={sourceCurrency}
                  value={customPriceInput}
                  onChange={(val) => handleCustomPriceChange(val === "" ? "" : String(val))}
                  placeholder={stats.commonPrice ? String(stats.commonPrice / 100) : "e.g. 350"}
                  min={1}
                  step="0.01"
                  className="flex-1"
                />
                <button
                  type="submit"
                  disabled={saving || !customPriceInput}
                  className="h-[42px] shrink-0 cursor-pointer rounded-full bg-[#FCDF9C] px-5 py-2.5 text-[12px] font-medium text-[#1F1F1F] transition-colors hover:bg-[#1f1f1f] hover:text-white disabled:opacity-70"
                >
                  {saving ? "Saving…" : "Apply"}
                </button>
              </div>
              {validationError && (
                <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {validationError}
                </p>
              )}


              {/* Reset Custom Prices */}
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const nextCustom = {
                    ...(((listing as any).customPrices || {}) as Record<string, number>),
                  };
                  for (const k of stats.editableKeys) {
                    delete nextCustom[k];
                  }
                  onPreviewPrice?.(null);
                  await onSave({ customPrices: nextCustom });
                }}
                className="w-full cursor-pointer rounded-full border border-[#727272] hover:border-[#1f1f1f] bg-white px-3.5 py-2.5 text-sm font-medium text-[#3E3E3E] hover:text-white transition-colors hover:bg-[#1f1f1f] disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700 mt-4"
              >
                Reset to base rates
              </button>
            </div>

          </form>

          {/* Selected-date promotion */}
          <div className="space-y-3 rounded-[12px] border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30 shadow-[0_2px_4px_0px_#00000040]">
            <div className="flex flex-col items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-semibold text-[#1F1F1F] dark:text-emerald-200">
                  Special days discount
                </span>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stats.promoStats.enabled
                ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300"
                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                }`}>
                {stats.promoStats.enabled ? `${stats.promoStats.percentage}% active` : "Disabled"}
              </span>
            </div>

            {stats.promoStats.enabled ? (
              stats.promoStats.isMixed ? (
                /* Mixed promotion eligibility across selected dates */
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400">Promotion eligibility</span>
                    <span className="font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded-full text-[10px]">
                      Promotion: Mixed
                    </span>
                  </div>

                  <div className="rounded-lg bg-white/80 dark:bg-zinc-900/60 p-2.5 space-y-1.5 border border-emerald-100 dark:border-emerald-900/40 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {stats.promoStats.eligibleCount} promotion eligible {stats.promoStats.eligibleCount === 1 ? "date" : "dates"}:
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        −{stats.promoStats.percentage}% discount
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {stats.promoStats.ineligibleCount} regular-price {stats.promoStats.ineligibleCount === 1 ? "date" : "dates"}:
                      </span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        Regular price
                      </span>
                    </div>
                    {stats.promoStats.dateRangeText && (
                      <div className="flex justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-[#727272]">
                        <span>Eligible window:</span>
                        <span>{stats.promoStats.dateRangeText}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span>Average nightly rate</span>
                      <span>{formatMoney(stats.promoStats.avgOriginalPrice, sourceCurrency, 2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100">
                      <span>Guest price after promotion</span>
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {formatMoney(stats.promoStats.avgGuestPrice, sourceCurrency, 2)}{" "}
                        <span className="text-[10px] font-normal text-[#727272]">avg / Night</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : stats.promoStats.allEligible ? (
                /* All selected dates are promotion eligible */
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Nightly rate</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {stats.isMixedPrice
                        ? `${formatMoney(stats.minPrice ?? 0, sourceCurrency, 2)} – ${formatMoney(stats.maxPrice ?? 0, sourceCurrency, 2)}`
                        : formatMoney(stats.commonPrice ?? 0, sourceCurrency, 2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                    <span>Special days discount</span>
                    <span>−{stats.promoStats.percentage}%</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-200/60 dark:border-emerald-900/40 pt-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                    <span>Guest price after promotion</span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {stats.isMixedPrice
                        ? `${formatMoney(stats.promoStats.minGuestPrice ?? 0, sourceCurrency, 2)} – ${formatMoney(stats.promoStats.maxGuestPrice ?? 0, sourceCurrency, 2)}`
                        : formatMoney(stats.promoStats.commonGuestPrice ?? 0, sourceCurrency, 2)}{" "}
                      <span className="text-[10px] font-normal text-[#727272]">/ Night</span>
                    </span>
                  </div>
                </div>
              ) : (
                /* Selected dates are outside promotion window */
                <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Selected {stats.totalNights === 1 ? "date is" : "dates are"} outside active promotion window.
                  </p>
                  {stats.promoStats.dateRangeText && (
                    <p className="text-xs text-[#727272] dark:text-zinc-400">
                      Promotion window: {stats.promoStats.dateRangeText}
                    </p>
                  )}
                  <p className="text-xs text-[#727272]">
                    Guests pay regular rate: {stats.isMixedPrice ? `${formatMoney(stats.minPrice ?? 0, sourceCurrency, 2)} – ${formatMoney(stats.maxPrice ?? 0, sourceCurrency, 2)}` : formatMoney(stats.commonPrice ?? 0, sourceCurrency, 2)} / Night
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs leading-normal text-[#5F5F5F] dark:text-zinc-400">
                  Add a discount only to the selected {stats.totalNights === 1 ? "date" : "dates"}.
                </p>
                <div className="flex flex-col items-start w-full gap-2">
                  <label className="min-w-0 w-full">
                    <span className="mb-1.5 block text-sm font-medium text-[#1f1f1f] dark:text-zinc-300">
                      Discount percentage
                    </span>
                    <span className="flex h-[42px] items-center rounded-lg border border-emerald-300 bg-white px-3 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-emerald-800 dark:bg-zinc-900 dark:focus-within:border-emerald-500">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        inputMode="numeric"
                        value={specialDaysDiscountInput}
                        onChange={(event) => {
                          setSpecialDaysDiscountInput(event.target.value);
                          if (promoValidationError) setPromoValidationError("");
                        }}
                        aria-label="Special days discount percentage"
                        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#1f1f1f] outline-none dark:text-zinc-100"
                      />
                      <span className="text-sm font-semibold text-[#727272]">%</span>
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveSpecialDaysDiscount}
                    className="h-[42px] shrink-0 rounded-full bg-emerald-600 px-4 text-[12px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? "Applying…" : "Apply to dates"}
                  </button>
                </div>
                {promoValidationError ? (
                  <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {promoValidationError}
                  </p>
                ) : null}
              </div>
            )}

            {/* Selected-range source */}
            <div className="flex items-center justify-between border-t border-emerald-200/60 pt-2.5 text-sm dark:border-emerald-900/40">
              <span className="text-[#727272] dark:text-zinc-400 font-normal">
                Applies only to: <strong className="text-[#1f1f1f] font-semibold dark:text-zinc-200">{formattedDateRange}</strong>
              </span>
            </div>

            {/* Window adjustment action buttons */}
            {stats.promoStats.enabled && (
              <div className="flex flex-col gap-1.5 pt-1">
                {stats.promoStats.startDate !== range.start || stats.promoStats.endDate !== range.end ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      await saveSpecialDaysDiscount();
                    }}
                    className="w-full cursor-pointer rounded-full border border-emerald-300 bg-white px-3 py-2 text-[12px] font-medium text-emerald-800 transition-colors hover:bg-emerald-50 disabled:opacity-70 dark:border-emerald-700 dark:bg-zinc-800 dark:text-emerald-300 dark:hover:bg-zinc-700"
                  >
                    Set window to selected dates ({range.start} – {range.end})
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* Phase 9 & 10: Property Stay Discounts & Additional Charges (Collapsible) */}
          <details className="group overflow-hidden rounded-[12px] border border-white bg-[#F3F4F5] shadow-[0_2px_4px_0px_#00000040] transition-colors dark:border-zinc-700/80 dark:bg-zinc-800/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 transition-colors [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-medium text-[#1F1F1F] dark:text-zinc-100">
                Discounts & Additional Charges
              </span>
              <span className="relative size-4 shrink-0" aria-hidden="true">
                <Image
                  src="/images/icons/homyz/stroke/Plus.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 transition-opacity duration-200 group-open:opacity-0"
                />
                <Image
                  src="/images/icons/minus-icon.svg"
                  alt=""
                  width={14}
                  height={1}
                  className="absolute left-1/2 top-1/2 hidden h-px w-3.5 -translate-x-1/2 -translate-y-1/2 group-open:block"
                />
              </span>
            </summary>
            <div className="border-t border-[#d7d7d7]/80 dark:border-zinc-700/80 p-3.5 space-y-2 bg-white/70 dark:bg-zinc-900/40 text-xs text-[#727272] dark:text-zinc-300">
              <div className="flex justify-between items-center">
                <span>Weekly (7+ nights)</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{weeklyPct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Monthly (28+ nights)</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{monthlyPct}%</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[#d7d7d7]/60 dark:border-zinc-700/60">
                <span>Extra guest fee</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {listing.extraGuestFee && listing.extraGuestFee > 0
                    ? `${formatMoney(listing.extraGuestFee, sourceCurrency, 2)} / Guest / Night`
                    : "None"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Cleaning fee</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {listing.cleaningFee && listing.cleaningFee > 0
                    ? formatMoney(listing.cleaningFee, sourceCurrency, 2)
                    : "None"}
                </span>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Mode 2: Availability Editing */}
      {panelMode === "availability" && stats.editableKeys.length > 0 && (
        <div className="space-y-4">
          {/* Current Availability Card */}
          <div className="rounded-xl bg-[#F3F4F5] dark:bg-zinc-800/40 p-3.5 shadow-[0px_2px_4px_0px_#00000040] border border-white">
            <p className="text-xs font-normal text-[#727272] dark:text-zinc-400 block">
              Current Status
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`size-2.5 rounded-full ${stats.commonAvailability === "booked"
                  ? "bg-zinc-900 dark:bg-zinc-500"
                  : stats.commonAvailability === "blocked"
                    ? "bg-zinc-400"
                    : stats.commonAvailability === "available"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  }`}
              />
              <span className="text-sm font-medium capitalize text-[#1f1f1f] dark:text-zinc-100">
                {stats.isMixedAvailability
                  ? `Mixed (${stats.availableCount} available, ${stats.blockedCount} blocked${stats.bookedCount > 0 ? `, ${stats.bookedCount} reserved` : ""
                  })`
                  : stats.commonAvailability === "available"
                    ? `Available (${stats.availableCount} open)`
                    : stats.commonAvailability === "blocked"
                      ? `Blocked (${stats.blockedCount} blocked)`
                      : `Reserved (${stats.bookedCount} reserved)`}
              </span>
            </div>
          </div>

          {/* Availability Action Buttons */}
          <div className="space-y-2 rounded-xl bg-[#F3F4F5] dark:bg-zinc-800/40 p-3.5 shadow-[0px_2px_4px_0px_#00000040] border border-white">
            <p className="text-sm text-[#1f1f1f] dark:text-zinc-400">
              Change availability for {stats.editableKeys.length} {stats.editableKeys.length === 1 ? "date" : "dates"}:
              {stats.bookedCount > 0 && (
                <span className="block text-xs text-[#727272] mt-0.5">
                  ({stats.bookedCount} reserved {stats.bookedCount === 1 ? "date is" : "dates are"} protected and will not change)
                </span>
              )}
              {stats.pastCount > 0 && (
                <span className="block text-xs text-zinc-400 mt-0.5">
                  ({stats.pastCount} past {stats.pastCount === 1 ? "date is" : "dates are"} historical)
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving || stats.blockedCount === 0}
                onClick={async () => {
                  if (onBulkAvailability) {
                    const res = await onBulkAvailability("UNBLOCK", stats.editableKeys);
                    if (res) {
                      setLastUndo({
                        action: "UNBLOCK",
                        previousBlockedDates: res.previousBlockedDates,
                        affectedCount: res.affectedCount,
                        protectedCount: res.protectedCount,
                      });
                    }
                  } else {
                    const nextBlocked = listing.blockedDates.filter(
                      (d: string) => !stats.editableKeys.includes(d),
                    );
                    await onSave({ blockedDates: nextBlocked });
                  }
                }}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
              >
                Make available
              </button>

              <button
                type="button"
                disabled={saving || stats.availableCount === 0}
                onClick={async () => {
                  if (onBulkAvailability) {
                    const res = await onBulkAvailability("BLOCK", stats.editableKeys);
                    if (res) {
                      setLastUndo({
                        action: "BLOCK",
                        previousBlockedDates: res.previousBlockedDates,
                        affectedCount: res.affectedCount,
                        protectedCount: res.protectedCount,
                      });
                    }
                  } else {
                    const nextBlocked = Array.from(
                      new Set([...listing.blockedDates, ...stats.editableKeys]),
                    );
                    await onSave({ blockedDates: nextBlocked });
                  }
                }}
                className="rounded-full bg-[#1f1f1f] hover:bg-zinc-700 text-white dark:bg-zinc-700 dark:hover:bg-zinc-600 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
              >
                Block dates
              </button>
            </div>

            {/* Undo Toast / Banner */}
            {lastUndo && (
              <div className="mt-2 flex items-center justify-between rounded-xl bg-zinc-900 text-white dark:bg-[#F3F4F5] dark:text-zinc-900 p-2.5 text-xs font-medium animate-in fade-in duration-200">
                <span className="truncate mr-2">
                  {lastUndo.affectedCount} dates {lastUndo.action === "BLOCK" ? "blocked" : "made available"}
                  {lastUndo.protectedCount > 0 ? ` (${lastUndo.protectedCount} reserved unchanged)` : ""}.
                </span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    if (onBulkAvailability) {
                      await onBulkAvailability("RESTORE", lastUndo.previousBlockedDates);
                      setLastUndo(null);
                    }
                  }}
                  className="rounded-full bg-white/20 dark:bg-zinc-900/10 hover:bg-white/30 px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors shrink-0"
                >
                  Undo
                </button>
              </div>
            )}
          </div>

          {/* Phase 11: Selected-Date Minimum Stay Override */}
          <div className="rounded-xl bg-[#F3F4F5] dark:bg-zinc-800/40 p-3.5 space-y-3 shadow-[0px_2px_4px_0px_#00000040] border border-white">
            <div className="flex flex-col items-start justify-between">
              <span className="text-xs font-normal text-[#727272] dark:text-zinc-400 block">
                Minimum Stay Override
              </span>
              {stats.isMixedMinStay ? (
                <span className="text-base font-medium text-amber-800 dark:text-amber-300 mt-2">
                  Mixed stays
                </span>
              ) : (
                <span className="text-sm font-medium text-[#1f1f1f] dark:text-zinc-200 mt-2">
                  {stats.commonMinStay ?? listing.minNights ?? 1} nights
                </span>
              )}
            </div>

            <p className="text-xs text-[#727272] dark:text-zinc-400">
              Set a required minimum stay for guests booking during these selected dates.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const minStay = Number(customMinStayInput);
                if (!Number.isFinite(minStay) || minStay < 1 || minStay > 365) {
                  setMinStayValidationError("Please enter a valid minimum stay between 1 and 365 nights.");
                  return;
                }
                setMinStayValidationError("");
                const currentDiscounts = ((listing as any).discounts || {}) as Record<string, any>;
                const customMinNights = { ...((currentDiscounts.customMinNights || {}) as Record<string, number>) };
                for (const k of stats.editableKeys) {
                  customMinNights[k] = Math.round(minStay);
                }
                await onSave({
                  discounts: {
                    ...currentDiscounts,
                    customMinNights,
                  },
                });
                setCustomMinStayInput("");
              }}
              className="space-y-2"
            >
              <div className="flex gap-2">
                <div className="relative flex flex-1 items-center rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-2xs transition-all focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10 dark:focus-within:border-amber-400 dark:focus-within:ring-amber-400/20 hover:border-zinc-400 dark:hover:border-zinc-600">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    inputMode="numeric"
                    placeholder={stats.commonMinStay ? String(stats.commonMinStay) : String(listing.minNights ?? 1)}
                    value={customMinStayInput}
                    onChange={(e) => {
                      setCustomMinStayInput(e.target.value);
                      if (minStayValidationError) setMinStayValidationError("");
                    }}
                    className="w-full bg-transparent px-3 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="pr-3 text-xs font-medium text-[#727272] dark:text-zinc-400 select-none shrink-0">
                    Nights
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={saving || !customMinStayInput}
                  className="rounded-full bg-[#1f1f1f] hover:bg-[#727272] text-white dark:bg-[#F3F4F5] dark:hover:bg-white dark:text-zinc-900 px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 shrink-0 shadow-xs"
                >
                  Apply min stay
                </button>
              </div>
              {minStayValidationError && (
                <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {minStayValidationError}
                </p>
              )}
            </form>

            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                const currentDiscounts = ((listing as any).discounts || {}) as Record<string, any>;
                const customMinNights = { ...((currentDiscounts.customMinNights || {}) as Record<string, number>) };
                for (const k of stats.editableKeys) {
                  delete customMinNights[k];
                }
                await onSave({
                  discounts: {
                    ...currentDiscounts,
                    customMinNights,
                  },
                });
              }}
              className="w-full text-left text-xs font-medium text-[#1f1f1f] hover:text-[#727272] underline underline-offset-2 dark:text-zinc-400 hover:underline cursor-pointer disabled:opacity-70"
            >
              Reset to property default ({listing.minNights ?? 1} nights)
            </button>
          </div>

          {/* Phase 11: Property Availability Rules (Collapsible) */}
          <details className="group rounded-xl shadow-[0px_2px_4px_0px_#00000040] border border-white dark:border-zinc-700/80 bg-[#F3F4F5] dark:bg-zinc-800/40 overflow-hidden transition-colors">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5 transition-colors [&::-webkit-details-marker]:hidden shadow-[0px_2px_4px_0px_#00000040] border border-white">
              <span className="text-sm font-medium text-[#1f1f1f] dark:text-zinc-100">
                Property Availability Rules
              </span>
              <span className="relative size-4 shrink-0" aria-hidden="true">
                <Image
                  src="/images/icons/homyz/stroke/Plus.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 transition-opacity duration-200 group-open:opacity-0"
                />
                <Image
                  src="/images/icons/minus-icon.svg"
                  alt=""
                  width={14}
                  height={1}
                  className="absolute left-1/2 top-1/2 hidden h-px w-3.5 -translate-x-1/2 -translate-y-1/2 group-open:block"
                />
              </span>
            </summary>
            <div className="p-3.5 space-y-2 bg-white dark:bg-zinc-900/40 text-xs text-[#727272] dark:text-zinc-300">
              <div className="flex justify-between items-center">
                <span>Default minimum stay</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {listing.minNights ?? 1} {listing.minNights === 1 ? "night" : "nights"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Maximum stay</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {listing.maxNights ? `${listing.maxNights} nights` : "No limit"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Advance notice</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {(listing as any).advanceNotice ?? 0} hours
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Same-day requests</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {(listing as any).allowSameDayRequests
                    ? `Allowed (until ${(listing as any).sameDayCutoff ?? "18:00"})`
                    : "Not allowed"}
                </span>
              </div>
              <div className="pt-3 flex justify-between items-center border-t border-[#d7d7d7] dark:border-zinc-700/60">
                <span>Guest capacity</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {listing.guests} guests max
                </span>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Notice / Feedback */}
      {notice && (
        <div
          role="status"
          className={`rounded-xl p-3 text-xs font-medium leading-relaxed ${notice.includes("Could not") || notice.includes("Failed") || notice.includes("Error")
            ? "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300"
            : notice.includes("Note:") || notice.includes("protected") || notice.includes("reserved")
              ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300"
            }`}
        >
          {notice}
        </div>
      )}

      {/* Footer Clear */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
        <button
          type="button"
          onClick={handleClearWithConfirm}
          className="w-full text-center text-sm font-medium text-[#DF4557] hover:text-[#1F1F1F] dark:hover:text-zinc-200 underline cursor-pointer"
        >
          Cancel & Clear Selection
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AllListingsOverviewPanel: Right panel overview when in All Listings mode
// ─────────────────────────────────────────────────────────────────────────────

function AllListingsOverviewPanel({
  listings,
  bookings,
  onSelectListing,
}: {
  listings: ListingDTO[];
  bookings: HostReservation[];
  onSelectListing: (id: string) => void;
}) {
  const activeBookingsCount = bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "PENDING",
  ).length;

  return (
    <div className="space-y-6 text-[#1F1F1F] dark:text-zinc-100">
      <div>
        <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-zinc-100">
          Portfolio Overview
        </h2>
        <p className="mt-1 text-xs text-[#727272]">
          Manage and monitor all your properties in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#F3F4F5] dark:bg-zinc-800/80 p-3.5 border border-white dark:border-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">
            Listings
          </p>
          <p className="mt-1 text-2xl font-bold">{listings.length}</p>
        </div>
        <div className="rounded-xl bg-[#F3F4F5] dark:bg-zinc-800/80 p-3.5 border border-white dark:border-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">
            Active Stays
          </p>
          <p className="mt-1 text-2xl font-bold">{activeBookingsCount}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">
          Select property to edit rates:
        </p>
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {listings.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onSelectListing(l.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-[#d7d7d7] dark:border-zinc-700 p-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <PropertyPhoto
                listing={l}
                className="size-12 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#1F1F1F] dark:text-zinc-100">
                  {l.title}
                </p>
                <p className="truncate text-xs text-[#727272]">
                  {[l.district, l.city].filter(Boolean).join(", ") || l.country}
                </p>
              </div>
              <span className="text-zinc-400">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main HostCalendarWorkspace Component
// ─────────────────────────────────────────────────────────────────────────────

export function HostCalendarWorkspace({
  listings: initialListings,
  bookings: initialBookings,
  initialListingId,
  initialMonth,
  initialView,
}: HostCalendarWorkspaceProps) {
  const { currency: displayCurrency, formatPrice: formatMoney } = useCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // All listings from props (guaranteed from logged-in host)
  const listings = initialListings;
  const bookings = initialBookings;

  // Initialize selectedId from initialListingId or searchParams or default
  const defaultSelectedId = useMemo(() => {
    if (listings.length === 0) return "";
    const requested = initialListingId || searchParams?.get("listingId");
    if (requested === "all" && listings.length > 1) {
      return "all";
    }
    if (requested && listings.some((l) => l.id === requested)) {
      return requested;
    }
    return listings[0]?.id || "";
  }, [listings, initialListingId, searchParams]);

  const [selectedId, setSelectedId] = useState<string>(defaultSelectedId);

  // Initialize month from initialMonth / searchParams or current date
  const defaultMonth = useMemo(() => {
    const requested = initialMonth || searchParams?.get("month");
    const parsed = parseMonthKey(requested);
    if (parsed) return parsed;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [initialMonth, searchParams]);

  const [month, setMonth] = useState<Date>(defaultMonth);

  // Initialize view from initialView / searchParams or default to "month"
  const defaultView = useMemo<"month" | "year">(() => {
    const requested = initialView || searchParams?.get("view");
    return requested === "year" ? "year" : "month";
  }, [initialView, searchParams]);

  const [view, setView] = useState<"month" | "year">(defaultView);

  // Range & Date Selection state
  const [selection, setSelection] = useState<CalendarSelection>({
    start: null,
    end: null,
    isDragging: false,
  });
  const [focusedDateKey, setFocusedDateKey] = useState<string | null>(null);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);

  // UI state
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [pickerYear, setPickerYear] = useState(month.getFullYear());
  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const [mobilePropertySelectorOpen, setMobilePropertySelectorOpen] =
    useState(false);
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<HostReservation | null>(null);
  const [allListingsDayBookings, setAllListingsDayBookings] = useState<{
    date: string;
    bookings: HostReservation[];
  } | null>(null);
  const [showMoney, setShowMoney] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [tips, setTips] = useState(false);

  // Local optimistic update cache
  const [savedListings, setSavedListings] = useState<
    Record<string, ListingDTO>
  >({});

  // Resolve currently active listing
  const isAllListings = selectedId === "all";
  const selectedListing: ListingDTO | null = useMemo(() => {
    if (isAllListings || listings.length === 0) return null;
    return (
      savedListings[selectedId] ||
      listings.find((l) => l.id === selectedId) ||
      listings[0] ||
      null
    );
  }, [isAllListings, selectedId, savedListings, listings]);

  const sourceCurrency = selectedListing
    ? resolvePropertyCurrency(selectedListing)
    : "SAR";

  // Keep pickerYear in sync when month changes
  useEffect(() => {
    setPickerYear(month.getFullYear());
  }, [month]);

  // Deep-linking URL synchronization (refresh-safe, back/forward-safe)
  const syncUrl = useCallback(
    (newListingId: string, newMonth: Date, newView: "month" | "year") => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams();
      if (newListingId) params.set("listingId", newListingId);
      params.set("month", formatMonthKey(newMonth));
      if (newView !== "month") params.set("view", newView);

      const newUrl = `${pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);
    },
    [pathname],
  );

  // Synchronize on browser Back/Forward navigation
  useEffect(() => {
    function handlePopState() {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const reqListing = params.get("listingId");
      if (
        reqListing &&
        (reqListing === "all" || listings.some((l) => l.id === reqListing))
      ) {
        setSelectedId(reqListing);
      }
      const reqMonth = params.get("month");
      const parsedM = parseMonthKey(reqMonth);
      if (parsedM) setMonth(parsedM);
      const reqView = params.get("view");
      if (reqView === "year" || reqView === "month") setView(reqView);
      setSelection({ start: null, end: null, isDragging: false });
      setPreviewPrice(null);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [listings]);

  // Handle property selection change: resets selection safely
  const handleSelectProperty = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSelection({ start: null, end: null, isDragging: false });
      setPreviewPrice(null);
      setSelectedBooking(null);
      setAllListingsDayBookings(null);
      setMobilePropertySelectorOpen(false);
      syncUrl(id, month, view);
    },
    [month, view, syncUrl],
  );

  // Handle month change: resets selection safely if in single month view
  const handleSelectMonth = useCallback(
    (newMonth: Date) => {
      setMonth(newMonth);
      setSelection({ start: null, end: null, isDragging: false });
      setPreviewPrice(null);
      syncUrl(selectedId, newMonth, view);
    },
    [selectedId, view, syncUrl],
  );

  // Handle view switch
  const handleSelectView = useCallback(
    (newView: "month" | "year") => {
      setView(newView);
      setShowViewDropdown(false);
      syncUrl(selectedId, month, newView);
    },
    [selectedId, month, syncUrl],
  );

  // Keep the compact view menu behaving like a conventional dropdown without
  // changing the calendar's selection, navigation, or URL state.
  useEffect(() => {
    if (!showViewDropdown) return;

    const closeOnOutsideInteraction = (event: PointerEvent) => {
      if (!viewDropdownRef.current?.contains(event.target as Node)) {
        setShowViewDropdown(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setShowViewDropdown(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showViewDropdown]);

  // Month navigation: Prev, Next, Today
  const handlePrev = useCallback(() => {
    setSelection({ start: null, end: null, isDragging: false });
    setPreviewPrice(null);
    if (view === "year") {
      setMonth(
        (prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1),
      );
      syncUrl(
        selectedId,
        new Date(month.getFullYear() - 1, month.getMonth(), 1),
        view,
      );
    } else {
      const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      setMonth(prev);
      syncUrl(selectedId, prev, view);
    }
  }, [view, month, selectedId, syncUrl]);

  const handleNext = useCallback(() => {
    setSelection({ start: null, end: null, isDragging: false });
    setPreviewPrice(null);
    if (view === "year") {
      const next = new Date(month.getFullYear() + 1, month.getMonth(), 1);
      setMonth(next);
      syncUrl(selectedId, next, view);
    } else {
      const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      setMonth(next);
      syncUrl(selectedId, next, view);
    }
  }, [view, month, selectedId, syncUrl]);

  const handleToday = useCallback(() => {
    setSelection({ start: null, end: null, isDragging: false });
    setPreviewPrice(null);
    const now = new Date();
    const todayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    setMonth(todayMonth);
    syncUrl(selectedId, todayMonth, view);
  }, [selectedId, view, syncUrl]);

  // Precompute O(1) lookups for active bookings, blocked dates, custom prices
  const { bookingsByDate, bookingRanges } = useMemo(() => {
    const map = new Map<string, HostReservation[]>();
    const ranges: Array<{
      booking: HostReservation;
      start: string;
      end: string;
    }> = [];

    for (const b of bookings) {
      if (b.status === "CANCELLED") continue;
      if (!isAllListings && b.listingId !== selectedListing?.id) continue;

      const start = b.startDate.slice(0, 10);
      const end = b.endDate.slice(0, 10);
      ranges.push({ booking: b, start, end });

      let cur = start;
      while (cur < end) {
        const list = map.get(cur) || [];
        list.push(b);
        map.set(cur, list);
        cur = shiftDateKey(cur, 1);
      }
    }
    return { bookingsByDate: map, bookingRanges: ranges };
  }, [bookings, isAllListings, selectedListing?.id]);

  const blockedDatesSet = useMemo(() => {
    if (!selectedListing) return new Set<string>();
    return new Set<string>(selectedListing.blockedDates || []);
  }, [selectedListing]);

  const normalizedSelectedRange = useMemo(
    () => getNormalizedRange(selection),
    [selection],
  );

  const persistedCustomPricesMap = useMemo(() => {
    if (!selectedListing) return new Map<string, number>();
    const cp = ((selectedListing as any).customPrices || {}) as Record<
      string,
      number
    >;
    return new Map<string, number>(Object.entries(cp));
  }, [selectedListing]);

  const customPricesMap = useMemo(() => {
    if (!selectedListing) return new Map<string, number>();
    const cp = ((selectedListing as any).customPrices || {}) as Record<
      string,
      number
    >;
    const map = new Map<string, number>(Object.entries(cp));
    if (previewPrice !== null && normalizedSelectedRange) {
      const keys = getAllDatesInRange(
        normalizedSelectedRange.start,
        normalizedSelectedRange.end,
      );
      for (const k of keys) {
        const hasBooking = (bookingsByDate.get(k) || []).length > 0;
        if (!hasBooking) {
          map.set(k, previewPrice);
        }
      }
    }
    return map;
  }, [selectedListing, previewPrice, normalizedSelectedRange, bookingsByDate]);

  // Global PointerUp listener for finishing drag selection safely
  useEffect(() => {
    function onPointerUp() {
      if (selection.isDragging) {
        setSelection((prev) => ({ ...prev, isDragging: false }));
      }
    }
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [selection.isDragging]);

  // Handle Day Interactions (Click, PointerDown, PointerEnter, Keyboard)
  const handleDayClick = useCallback(
    (
      key: string,
      booking?: HostReservation,
      allBookings?: HostReservation[],
      shiftKey = false,
    ) => {
      setNotice("");
      if (isAllListings) {
        setAllListingsDayBookings({
          date: key,
          bookings: allBookings || [],
        });
        return;
      }

      if (booking) {
        // If clicking on an active reservation, open reservation modal
        setSelectedBooking(booking);
        return;
      }

      // Single or Two-click range selection
      setSelection((prev) => {
        if (shiftKey && prev.start) {
          return { start: prev.start, end: key, isDragging: false };
        }
        if (prev.start && !prev.end && prev.start !== key) {
          // Second click completes range
          return { start: prev.start, end: key, isDragging: false };
        }
        // First click or reset
        return { start: key, end: key, isDragging: false };
      });
      setFocusedDateKey(key);
    },
    [isAllListings],
  );

  const handleDayPointerDown = useCallback(
    (key: string, e: ReactPointerEvent) => {
      if (isAllListings || e.button !== 0) return;
      const dayBookings = bookingsByDate.get(key) || [];
      if (dayBookings.length > 0) return; // Reservations don't initiate drag selection

      setNotice("");
      setSelection({
        start: key,
        end: key,
        isDragging: true,
      });
      setFocusedDateKey(key);
    },
    [isAllListings, bookingsByDate],
  );

  const handleDayPointerEnter = useCallback(
    (key: string) => {
      if (!selection.isDragging || !selection.start) return;
      setSelection((prev) => ({
        ...prev,
        end: key,
      }));
    },
    [selection.isDragging, selection.start],
  );

  const handleKeyDown = useCallback(
    (key: string, e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection({ start: null, end: null, isDragging: false });
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleDayClick(key, bookingsByDate.get(key)?.[0], undefined, e.shiftKey);
        return;
      }
      let targetKey: string | null = null;
      if (e.key === "ArrowLeft") targetKey = shiftDateKey(key, -1);
      else if (e.key === "ArrowRight") targetKey = shiftDateKey(key, 1);
      else if (e.key === "ArrowUp") targetKey = shiftDateKey(key, -7);
      else if (e.key === "ArrowDown") targetKey = shiftDateKey(key, 7);

      if (targetKey) {
        e.preventDefault();
        setFocusedDateKey(targetKey);
        if (e.shiftKey && selection.start) {
          setSelection((prev) => ({ ...prev, end: targetKey }));
        }
      }
    },
    [handleDayClick, bookingsByDate, selection.start],
  );

  // Save listing changes with stale-state protection
  async function save(values: Record<string, unknown>) {
    if (!selectedListing || saving) return;
    const targetListingId = selectedListing.id;
    setSaving(true);
    setNotice("");
    try {
      const result = await updateListingAction(targetListingId, values);
      if (result.ok) {
        setSavedListings((current) => ({
          ...current,
          [targetListingId]: result.data,
        }));
        setNotice("Changes saved.");
      } else {
        setNotice(result.error || "Could not save.");
      }
    } catch {
      setNotice("Could not save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Bulk availability update with booking protection & atomic feedback
  async function handleBulkAvailability(
    action: "BLOCK" | "UNBLOCK" | "RESTORE",
    dates: string[],
  ) {
    if (!selectedListing || saving) return null;
    const targetListingId = selectedListing.id;
    setSaving(true);
    setNotice("");
    try {
      const result = await bulkUpdateAvailabilityAction(targetListingId, {
        action,
        dates,
      });
      if (!result.ok) {
        setNotice(result.error || "Could not update availability.");
        return null;
      }
      setSavedListings((current) => ({
        ...current,
        [targetListingId]: result.data.listing,
      }));
      if (action === "RESTORE") {
        setNotice("Restored previous availability.");
      } else {
        const actionWord = action === "BLOCK" ? "blocked" : "made available";
        const protectedPart =
          result.data.protectedCount > 0
            ? ` (${result.data.protectedCount} reserved unchanged)`
            : "";
        const newlyBookedPart =
          result.data.newlyBookedCount > 0
            ? ` Note: ${result.data.newlyBookedCount} newly confirmed reservation was protected.`
            : "";
        setNotice(
          `${result.data.affectedCount} dates ${actionWord}${protectedPart}.${newlyBookedPart}`,
        );
      }
      return result.data;
    } catch {
      setNotice("Could not update availability. Please try again.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  // Selected dates analysis (for contextual action bar and contextual right panel)
  const selectedDatesStats: SelectedDatesStats | null = useMemo(() => {
    if (!normalizedSelectedRange || !selectedListing) return null;
    const allSelectedKeys = getAllDatesInRange(
      normalizedSelectedRange.start,
      normalizedSelectedRange.end,
    );

    const todayKey = new Date().toISOString().slice(0, 10);
    let bookedCount = 0;
    let blockedCount = 0;
    let availableCount = 0;
    let pastCount = 0;
    const editableKeys: string[] = [];
    const prices: number[] = [];

    const isWeekendDay = (k: string) => {
      const d = new Date(k + "T00:00:00Z").getUTCDay();
      return d === 4 || d === 5;
    };
    const weekdayBase =
      (selectedListing as any).weekdayBasePrice ?? selectedListing.price;

    const customMinNightsMap = (
      ((selectedListing as any)?.discounts?.customMinNights || {}) as Record<string, number>
    );
    const defaultMinNights = selectedListing.minNights ?? 1;
    const minStays: number[] = [];

    for (const k of allSelectedKeys) {
      const hasBooking = (bookingsByDate.get(k) || []).length > 0;
      const isPast = k < todayKey;
      if (hasBooking) {
        bookedCount++;
      } else if (isPast) {
        pastCount++;
        if (blockedDatesSet.has(k)) {
          blockedCount++;
        } else {
          availableCount++;
        }
      } else {
        editableKeys.push(k);
        if (blockedDatesSet.has(k)) {
          blockedCount++;
        } else {
          availableCount++;
        }
        const custom = persistedCustomPricesMap.get(k);
        const price =
          custom !== undefined
            ? custom
            : isWeekendDay(k) &&
              selectedListing.weekendPrice &&
              selectedListing.weekendPrice > 0
              ? selectedListing.weekendPrice
              : weekdayBase;
        prices.push(price);

        const minStayForDate = customMinNightsMap[k] ?? defaultMinNights;
        minStays.push(minStayForDate);
      }
    }

    const uniquePrices = new Set(prices);
    const isMixedPrice = uniquePrices.size > 1;
    const commonPrice = uniquePrices.size === 1 ? prices[0] : null;

    const uniqueMinStays = new Set(minStays);
    const isMixedMinStay = uniqueMinStays.size > 1;
    const commonMinStay = uniqueMinStays.size === 1 ? minStays[0] : null;

    const distinctStatuses: ("available" | "blocked" | "booked")[] = [];
    if (availableCount > 0) distinctStatuses.push("available");
    if (blockedCount > 0) distinctStatuses.push("blocked");
    if (bookedCount > 0) distinctStatuses.push("booked");

    const isMixedAvailability = distinctStatuses.length > 1;
    const commonAvailability: "available" | "blocked" | "booked" | "mixed" =
      distinctStatuses.length === 1
        ? distinctStatuses[0]
        : "mixed";

    const promoStats = analyzeSelectionPromotion({
      dateKeys: allSelectedKeys,
      listing: selectedListing as unknown as Parameters<typeof analyzeSelectionPromotion>[0]["listing"],
    });

    return {
      totalNights: allSelectedKeys.length,
      allKeys: allSelectedKeys,
      editableKeys,
      bookedCount,
      blockedCount,
      availableCount,
      pastCount,
      allBlocked:
        editableKeys.length > 0 && blockedCount === editableKeys.length,
      allAvailable:
        editableKeys.length > 0 && availableCount === editableKeys.length,
      isMixedAvailability,
      commonAvailability,
      isMixedPrice,
      commonPrice,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      maxPrice: prices.length > 0 ? Math.max(...prices) : null,
      isMixedMinStay,
      commonMinStay,
      minStayValues: minStays,
      promoStats,
    };
  }, [
    normalizedSelectedRange,
    selectedListing,
    bookingsByDate,
    blockedDatesSet,
    persistedCustomPricesMap,
  ]);

  // Filtered listings for mobile search
  const filteredListings = useMemo(() => {
    if (!propertySearchQuery.trim()) return listings;
    const q = propertySearchQuery.toLowerCase();
    return listings.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.district?.toLowerCase().includes(q),
    );
  }, [listings, propertySearchQuery]);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Empty State when host has no properties
  // ───────────────────────────────────────────────────────────────────────────
  if (listings.length === 0) {
    return (
      <>
        <HostSubNav activeTab="calendar" />
        <main className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#1F1F1F] dark:text-zinc-100 sm:text-3xl">
            You don't have any listings yet
          </h1>
          <p className="mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Once you create and publish your first listing, you can manage
            availability, nightly rates, and guest reservations here.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/become-a-host"
              className="rounded-full bg-[#1F1F1F] dark:bg-[#F3F4F5] px-6 py-3 text-sm font-semibold text-white dark:text-zinc-950 shadow-sm transition-all hover:bg-black dark:hover:bg-white"
            >
              Create a listing
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Main Calendar Workspace
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <>
      <HostSubNav activeTab="calendar" />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-28 pt-6 sm:px-8 sm:pt-8">
        {mobileCalendarOpen && selectedListing ? (
          <section className="sm:hidden">
            <h1 className="mb-7 text-[24px] font-medium text-[#1f1f1f] dark:text-zinc-100">
              Calendars
            </h1>

            <div className="mb-8 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileCalendarOpen(false)}
                aria-label="Back to calendars"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] text-[#555555] transition-colors bg-[#F3F4F5] hover:bg-[#f7f7f7] dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <p className="truncate text-base font-normal text-[#1F1F1F] dark:text-zinc-100">
                {selectedListing.title || "Property name"}{[selectedListing.district, selectedListing.city].filter(Boolean).join(", ") || selectedListing.country ? `, ${[selectedListing.district, selectedListing.city].filter(Boolean).join(", ") || selectedListing.country}` : ""}
              </p>
            </div>

            <div className="mb-5 flex items-center justify-between border-b border-[#d5d5d5] pb-3 dark:border-zinc-700">
              <h2 className="text-base font-medium text-[#272727] dark:text-zinc-100">
                {monthName(month)}
              </h2>
              <div className="flex items-center sm:gap-3 gap-2">
                <button type="button" onClick={handlePrev} aria-label="Previous month" className="flex sm:size-9 size-7 items-center justify-center rounded-full border border-[#bdbdbd] bg-[#F3F4F5] text-[#1f1f1f] transition-colors hover:bg-[#f5f5f5] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button type="button" onClick={handleNext} aria-label="Next month" className="flex sm:size-9 size-7 items-center justify-center rounded-full border border-[#bdbdbd] bg-[#F3F4F5] text-[#1f1f1f] transition-colors hover:bg-[#f5f5f5] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            </div>

            <MonthGrid
              month={month}
              listing={selectedListing}
              bookingsByDate={bookingsByDate}
              bookingRanges={bookingRanges}
              blockedDatesSet={blockedDatesSet}
              customPricesMap={customPricesMap}
              selection={selection}
              focusedDateKey={focusedDateKey}
              isAllListings={false}
              listingsCount={listings.length}
              compact={false}
              onDayClick={handleDayClick}
              onDayPointerDown={handleDayPointerDown}
              onDayPointerEnter={handleDayPointerEnter}
              onKeyDown={handleKeyDown}
            />
          </section>
        ) : view === "year" && selectedListing ? (
          <MobileYearCalendar
            startMonth={month}
            listing={selectedListing}
            bookingsByDate={bookingsByDate}
            blockedDatesSet={blockedDatesSet}
            onBack={() => handleSelectView("month")}
            onOpenSettings={() => setMobileSettingsOpen(true)}
            onOpenMonth={(targetMonth) => {
              handleSelectMonth(targetMonth);
              setMobileCalendarOpen(true);
            }}
          />
        ) : (
          <MobileCalendarIndex
            listings={listings}
            selectedId={selectedId}
            onSelect={handleSelectProperty}
            onOpenCalendar={() => setMobileCalendarOpen(true)}
          />
        )}

        {/* Mobile Title & Responsive Property Selector Trigger */}
        <div className="mb-4 hidden flex-col gap-3 sm:hidden">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-[#1F1F1F] dark:text-zinc-100">
              Calendar
            </h1>
            <button
              type="button"
              onClick={() => setMobileSettingsOpen(true)}
              className="rounded-full bg-[#1F1F1F] dark:bg-[#F3F4F5] px-3.5 py-1.5 text-xs font-semibold text-white dark:text-zinc-950"
            >
              {normalizedSelectedRange ? "Edit selected" : "Settings"}
            </button>
          </div>

          {/* Mobile Property Switcher Pill */}
          <button
            type="button"
            onClick={() => setMobilePropertySelectorOpen(true)}
            aria-label="Change selected property"
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#d7d7d7] dark:border-zinc-700 bg-[#F3F4F5] dark:bg-zinc-800 p-2.5 shadow-2xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isAllListings ? (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white font-bold text-xs">
                  ALL
                </div>
              ) : selectedListing ? (
                <PropertyPhoto
                  listing={selectedListing}
                  className="size-9 shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <div className="text-left min-w-0">
                <p className="truncate text-xs font-semibold text-[#1F1F1F] dark:text-zinc-100">
                  {isAllListings ? "All listings" : selectedListing?.title}
                </p>
                <p className="truncate text-[10px] text-[#727272]">
                  {isAllListings
                    ? `${listings.length} properties total`
                    : [selectedListing?.district, selectedListing?.city]
                      .filter(Boolean)
                      .join(", ") || selectedListing?.country}
                </p>
              </div>
            </div>
            <svg
              className="size-4 shrink-0 text-[#727272]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Top Control Bar: Month Selector, Prev/Next, Today, Price Tips, View Switcher */}
        <div className="relative hidden flex-wrap items-center justify-between gap-4 pb-5 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[#d8d8d8] sm:flex sm:pl-[120px] sm:after:left-[129px] dark:after:bg-zinc-700">
          {/* Left: Month Navigation Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Month/Year Title & Dropdown Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setPickerYear(month.getFullYear());
                  setShowViewDropdown(false);
                  setShowMonthDropdown(!showMonthDropdown);
                }}
                aria-expanded={showMonthDropdown}
                aria-haspopup="dialog"
                aria-label="Select month and year"
                className="flex items-center gap-2 font-medium tracking-tight text-[#1f1f1f] cursor-pointer text-xl lg:text-2xl xl:text-4xl dark:text-zinc-100 dark:hover:bg-zinc-800/60"
              >
                <span>
                  {view === "year"
                    ? `${month.getFullYear()}`
                    : `${monthName(month)} ${month.getFullYear()}`}
                </span>
                <svg
                  className={`size-6.25 text-[#1F1F1F] transition-transform ${showMonthDropdown ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Month/Year Picker Dropdown */}
              {showMonthDropdown && (
                <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[#d7d7d7] dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-2xl">
                  {/* Year Stepper */}
                  <div className="mb-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <button
                      type="button"
                      onClick={() => setPickerYear((y) => y - 1)}
                      aria-label="Previous year in picker"
                      className="rounded-full p-1.5 hover:bg-[#F3F4F5] dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <svg
                        className="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                    <span className="text-base font-semibold text-[#1F1F1F] dark:text-zinc-100">
                      {pickerYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPickerYear((y) => y + 1)}
                      aria-label="Next year in picker"
                      className="rounded-full p-1.5 hover:bg-[#F3F4F5] dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <svg
                        className="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </div>

                  {/* 12-Month Grid */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {monthsList.map((m, idx) => {
                      const isSelected =
                        month.getMonth() === idx &&
                        month.getFullYear() === pickerYear;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            const newDate = new Date(pickerYear, idx, 1);
                            handleSelectMonth(newDate);
                            setShowMonthDropdown(false);
                            if (view === "year") handleSelectView("month");
                          }}
                          className={`rounded-full py-2 text-xs font-medium transition-colors cursor-pointer ${isSelected
                            ? "bg-[#FDE29B] dark:bg-amber-400 text-[#1F1F1F] dark:text-zinc-950 font-bold shadow-xs"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-[#F3F4F5] dark:hover:bg-zinc-800"
                            }`}
                        >
                          {m.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Today Jump Button */}
            <button
              type="button"
              onClick={handleToday}
              aria-label="Jump to current month"
              className="hidden md:flex items-center gap-1.5 rounded-full bg-[#F3F4F5] dark:bg-zinc-800 px-4 py-2 lg:text-base text-sm font-medium text-[#1F1F1F] dark:text-zinc-100 border border-transparent hover:border-[#1F1F1F] dark:hover:border-zinc-600 transition-colors shadow-2xs cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Right: Price tips, calendar view dropdown, mobile settings button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Price tips button */}
            <button
              type="button"
              onClick={() => setTips(true)}
              className="hidden md:flex items-center gap-1.5 rounded-full bg-[#F3F4F5] dark:bg-zinc-800 px-4 py-2 lg:text-base text-sm font-medium text-[#1F1F1F] dark:text-zinc-100 border border-transparent hover:border-[#1F1F1F] dark:hover:border-zinc-600 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="text-amber-500">
                <Image
                  src={"/images/icons/price-tips.svg"}
                  alt={"Price tips"}
                  width={20}
                  height={20}
                  className="dark:invert"
                />
              </span>
              <span>Price tips</span>
            </button>

            {/* Calendar view dropdown — preserves the existing Month/Year behavior. */}
            <div ref={viewDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowMonthDropdown(false);
                  setShowViewDropdown((isOpen) => !isOpen);
                }}
                aria-expanded={showViewDropdown}
                aria-haspopup="menu"
                aria-label="Calendar view"
                className="hidden md:flex items-center gap-1.5 rounded-full bg-[#F3F4F5] dark:bg-zinc-800 px-4 py-2 lg:text-base text-sm font-medium text-[#1F1F1F] dark:text-zinc-100 border border-transparent hover:border-[#1F1F1F] dark:hover:border-zinc-600 transition-colors shadow-2xs cursor-pointer"
              >
                {view === "month" ? "Month" : "Year"}
                <svg
                  className={`size-5 text-[#1F1F1F] transition-transform dark:text-zinc-400 ${showViewDropdown ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {showViewDropdown && (
                <div
                  role="menu"
                  aria-label="Calendar view switcher"
                  className="absolute right-0 top-full z-50 mt-2 w-32 overflow-hidden rounded-xl border border-[#d7d7d7] bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {(["month", "year"] as const).map((option) => {
                    const isSelected = view === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isSelected}
                        onClick={() => handleSelectView(option)}
                        className={`flex w-full items-center justify-between rounded-full px-3 py-2 text-left text-sm font-medium capitalize transition-colors cursor-pointer ${isSelected
                          ? "bg-[#FDE29B] text-[#1F1F1F] dark:bg-amber-400 dark:text-zinc-950"
                          : "text-[#525252] hover:bg-[#F3F4F5] dark:text-zinc-300 dark:hover:bg-zinc-800"
                          }`}
                      >
                        {option}
                        {isSelected && <span aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile Settings Toggle (tablet/mobile) */}
            <button
              type="button"
              onClick={() => setMobileSettingsOpen(true)}
              className="hidden sm:block lg:hidden rounded-full bg-[#1F1F1F] dark:bg-[#F3F4F5] px-4 py-2 text-sm font-medium text-white dark:text-[#1F1F1F] cursor-pointer"
            >
              {normalizedSelectedRange ? "Edit selected" : "Settings"}
            </button>
          </div>
        </div>

        {/* 3-Column Layout: Left Rail | Center Calendar Matrix | Right Settings */}
        <div className="hidden items-start gap-6 sm:flex lg:h-[970px]">
          {/* 1. Left Rail: Property Switcher (Desktop & Tablet) */}
          <aside
            aria-label="Property selection"
            className="hidden w-[105px] shrink-0 flex-col items-center gap-3 sm:flex lg:max-h-full lg:overflow-y-auto [scrollbar-width:none]"
          >
            {/* All Listings Option (when host has 2+ listings) */}
            {listings.length > 1 && (
              <button
                type="button"
                onClick={() => handleSelectProperty("all")}
                title="All listings overview"
                aria-label="All listings"
                aria-pressed={isAllListings}
                className={`group relative flex h-[94px] w-[105px] shrink-0 flex-col items-center justify-center rounded-2xl transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a5a0ff] cursor-pointer ${isAllListings
                  ? "border-[4px] border-[#a5a0ff] bg-zinc-900 text-white shadow-md dark:border-amber-400"
                  : "border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:border-[#8d88ee] text-zinc-700 dark:text-zinc-300"
                  }`}
              >
                <svg
                  className="size-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span className="mt-1 text-xs font-bold">All listings</span>
                <span className="text-[9px] text-[#727272] dark:text-zinc-400">
                  {listings.length} stays
                </span>
              </button>
            )}

            {/* Host Listings */}
            {listings.map((l) => {
              const isSelected = l.id === selectedId;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleSelectProperty(l.id)}
                  title={l.title}
                  aria-label={l.title}
                  aria-pressed={isSelected}
                  className={`group relative h-[94px] w-[94px] xl:w-[105px] shrink-0 overflow-hidden rounded-lg lg:rounded-2xl transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a5a0ff] cursor-pointer ${isSelected
                    ? "border-[4px] border-[#a5a0ff] shadow-md ring-2 ring-[#a5a0ff]/20 dark:border-amber-400"
                    : "border border-zinc-300 dark:border-zinc-700 hover:border-[#8d88ee] dark:hover:border-zinc-500 opacity-80 hover:opacity-100"
                    }`}
                >
                  <PropertyPhoto
                    listing={l}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 text-center">
                    <p className="truncate text-[10px] font-semibold text-white">
                      {l.city || l.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* 2. Center Calendar Matrix */}
          <div className="relative min-w-0 flex-1 border-b border-[#d7d7d7] pb-4 lg:h-full lg:overflow-y-auto lg:pr-4 calendar-panel-scrollbar dark:border-zinc-700">
            {view === "month" ? (
              <MonthGrid
                month={month}
                listing={selectedListing}
                bookingsByDate={bookingsByDate}
                bookingRanges={bookingRanges}
                blockedDatesSet={blockedDatesSet}
                customPricesMap={customPricesMap}
                selection={selection}
                focusedDateKey={focusedDateKey}
                isAllListings={isAllListings}
                listingsCount={listings.length}
                compact={false}
                onDayClick={handleDayClick}
                onDayPointerDown={handleDayPointerDown}
                onDayPointerEnter={handleDayPointerEnter}
                onKeyDown={handleKeyDown}
              />
            ) : (
              /* 12+ Months Year View with Lazy Loading */
              <div className="grid grid-cols-1 min-[1366px]:grid-cols-2 gap-x-8 xl:gap-y-6 gap-y-6 mt-6">
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(
                    month.getFullYear(),
                    month.getMonth() + i,
                    1,
                  );
                  return (
                    <Fragment key={d.toISOString()}>
                      {i > 0 && d.getMonth() === 0 && (
                        <h2 className="col-span-full dark:border-zinc-800 text-xl font-semibold dark:text-zinc-100">
                          {d.getFullYear()}
                        </h2>
                      )}
                      <LazyMonthCard
                        month={d}
                        listing={selectedListing}
                        bookingsByDate={bookingsByDate}
                        bookingRanges={bookingRanges}
                        blockedDatesSet={blockedDatesSet}
                        customPricesMap={customPricesMap}
                        selection={selection}
                        isAllListings={isAllListings}
                        listingsCount={listings.length}
                        onDayClick={handleDayClick}
                        onSelectMonth={(targetMonth) => {
                          handleSelectMonth(targetMonth);
                          handleSelectView("month");
                        }}
                      />
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Right Settings / Contextual Management Panel (Desktop Sidebar) */}
          <aside
            aria-label="Calendar settings"
            className="hidden h-full w-[300px] shrink-0 overflow-y-auto border-l border-l-[#eeeeee] px-5 py-5 font-['Poppins'] lg:block xl:w-[338px] calendar-panel-scrollbar dark:border-zinc-800 dark:border-l-zinc-800"
          >
            {isAllListings ? (
              <AllListingsOverviewPanel
                listings={listings}
                bookings={bookings}
                onSelectListing={handleSelectProperty}
              />
            ) : selectedListing && normalizedSelectedRange && selectedDatesStats ? (
              /* Phase 7 & 8 Contextual Management Panel (When dates are selected) */
              <ContextualManagementPanel
                key={`${selectedListing.id}-${normalizedSelectedRange.start}-${normalizedSelectedRange.end}`}
                listing={selectedListing}
                range={normalizedSelectedRange}
                stats={selectedDatesStats}
                sourceCurrency={sourceCurrency}
                saving={saving}
                notice={notice}
                onSave={save}
                onBulkAvailability={handleBulkAvailability}
                bookings={bookings}
                onClear={() => {
                  setSelection({ start: null, end: null, isDragging: false });
                  setPreviewPrice(null);
                }}
                onPreviewPrice={setPreviewPrice}
              />
            ) : selectedListing ? (
              /* The compact overview opens the unchanged full editors on click. */
              <CalendarSettingsPanel
                key={`${selectedListing.id}-${displayCurrency}`}
                listing={selectedListing}
                saving={saving}
                notice={notice}
                onSave={save}
              />
            ) : null}
          </aside>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* Mobile / Tablet Responsive Settings & Contextual Modal */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {mobileSettingsOpen && (
          <WorkspaceDialog
            title={
              isAllListings
                ? "Portfolio Settings"
                : normalizedSelectedRange
                  ? "Manage Selected Dates"
                  : "Price & Availability"
            }
            onClose={() => setMobileSettingsOpen(false)}
            maxWidth="max-w-md"
          >
            {isAllListings ? (
              <AllListingsOverviewPanel
                listings={listings}
                bookings={bookings}
                onSelectListing={handleSelectProperty}
              />
            ) : selectedListing && normalizedSelectedRange && selectedDatesStats ? (
              <ContextualManagementPanel
                key={`mobile-${selectedListing.id}-${normalizedSelectedRange.start}-${normalizedSelectedRange.end}`}
                listing={selectedListing}
                range={normalizedSelectedRange}
                stats={selectedDatesStats}
                sourceCurrency={sourceCurrency}
                saving={saving}
                notice={notice}
                onSave={save}
                onBulkAvailability={handleBulkAvailability}
                bookings={bookings}
                onClear={() => {
                  setSelection({ start: null, end: null, isDragging: false });
                  setPreviewPrice(null);
                  setMobileSettingsOpen(false);
                }}
                onPreviewPrice={setPreviewPrice}
              />
            ) : selectedListing ? (
              <CalendarSettingsPanel
                key={`${selectedListing.id}-${displayCurrency}`}
                listing={selectedListing}
                saving={saving}
                notice={notice}
                onSave={save}
              />
            ) : null}
          </WorkspaceDialog>
        )}

        {/* Phase 19: Mobile Sticky Selection Floating Bar */}
        {normalizedSelectedRange && selectedDatesStats && !mobileSettingsOpen && (
          <aside
            aria-label="Selection summary bar"
            className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 border-t border-white bg-[#F3F4F5] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0px_-2px_12px_0px_#0000001F] animate-in slide-in-from-bottom duration-200 dark:border-white/20 dark:bg-zinc-900 sm:inset-x-4 sm:bottom-4 sm:rounded-[12px] sm:border sm:p-3 md:flex-row md:items-center md:justify-between lg:hidden"
          >
            <div className="min-w-0 rounded-[12px] border border-white bg-white/70 px-3 py-2.5 dark:border-white/20 dark:bg-zinc-800/70 md:flex-1">
              <p className="truncate text-sm font-medium text-[#1F1F1F] dark:text-zinc-100">
                {selectedDatesStats.totalNights} {selectedDatesStats.totalNights === 1 ? "night selected" : "nights selected"}
              </p>
              <p className="mt-0.5 truncate text-xs text-[#727272] dark:text-zinc-400">
                {selectedDatesStats.editableKeys.length} editable · {selectedDatesStats.bookedCount} reserved
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelection({ start: null, end: null, isDragging: false });
                  setPreviewPrice(null);
                }}
                className="min-h-10 rounded-full border border-white bg-white px-4 py-2 text-sm font-medium text-[#1F1F1F] shadow-[0px_2px_4px_0px_#00000040] transition-colors hover:bg-[#DDDDDE] dark:border-white/20 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setMobileSettingsOpen(true)}
                className="min-h-10 rounded-full border border-transparent bg-[#FCDF9C] px-4 py-2 text-sm font-medium text-[#1F1F1F] shadow-[0px_2px_4px_0px_#00000040] transition-colors hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white cursor-pointer"
              >
                Edit dates
              </button>
            </div>
          </aside>
        )}

        {/* Mobile / Tablet Property Selector Bottom Sheet / Modal */}
        {mobilePropertySelectorOpen && (
          <ModalOverlay
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget)
                setMobilePropertySelectorOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Select property"
              className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 text-[#1F1F1F] dark:text-zinc-100 p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <h2 className="text-lg font-bold">Select property</h2>
                <CloseButton
                  onClick={() => setMobilePropertySelectorOpen(false)}
                />
              </div>

              {/* Search input if host has multiple listings */}
              {listings.length > 4 && (
                <div className="pt-3">
                  <input
                    type="text"
                    placeholder="Search properties..."
                    value={propertySearchQuery}
                    onChange={(e) => setPropertySearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-[#d7d7d7] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-sm text-[#1F1F1F] dark:text-zinc-100 placeholder:text-[#727272] outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}

              {/* Listings Picker list */}
              <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
                {/* All listings option */}
                {listings.length > 1 && !propertySearchQuery && (
                  <button
                    type="button"
                    onClick={() => handleSelectProperty("all")}
                    className={`flex w-full items-center gap-3.5 rounded-2xl p-3 text-left transition-colors cursor-pointer ${isAllListings
                      ? "bg-[#FDE29B] dark:bg-amber-400 text-zinc-950 font-bold"
                      : "hover:bg-[#F3F4F5] dark:hover:bg-zinc-800 border border-[#d7d7d7] dark:border-zinc-700"
                      }`}
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white font-bold text-xs">
                      ALL
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">All listings</p>
                      <p className="text-xs text-[#727272] dark:text-zinc-400">
                        {listings.length} properties portfolio
                      </p>
                    </div>
                    {isAllListings && (
                      <span className="text-zinc-950 font-bold">✓</span>
                    )}
                  </button>
                )}

                {filteredListings.map((l) => {
                  const isSelected = l.id === selectedId;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => handleSelectProperty(l.id)}
                      className={`flex w-full items-center gap-3.5 rounded-2xl p-3 text-left transition-colors cursor-pointer ${isSelected
                        ? "bg-[#FDE29B] dark:bg-amber-400 text-zinc-950 font-semibold"
                        : "hover:bg-[#F3F4F5] dark:hover:bg-zinc-800 border border-[#d7d7d7] dark:border-zinc-700"
                        }`}
                    >
                      <PropertyPhoto
                        listing={l}
                        className="size-12 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {l.title}
                        </p>
                        <p className="truncate text-xs text-[#727272]">
                          {[l.district, l.city].filter(Boolean).join(", ") ||
                            l.country}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="text-zinc-950 font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* All Listings Day Details Dialog */}
        {allListingsDayBookings && (
          <WorkspaceDialog
            title={`Listings on ${new Date(
              `${allListingsDayBookings.date}T12:00:00`,
            ).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}`}
            onClose={() => setAllListingsDayBookings(null)}
            maxWidth="max-w-lg"
          >
            <div className="space-y-5 text-sm">
              {/* Booked Listings on this date */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                  Reserved Properties ({allListingsDayBookings.bookings.length})
                </h3>
                {allListingsDayBookings.bookings.length === 0 ? (
                  <p className="text-xs text-[#727272]">
                    No bookings on this night.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {allListingsDayBookings.bookings.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-xl border border-[#d7d7d7] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-xs text-[#1F1F1F] dark:text-zinc-100">
                            {b.listing?.title || "Property"}
                          </p>
                          <p className="text-xs text-[#727272]">
                            Guest:{" "}
                            <span className="font-medium text-zinc-900 dark:text-zinc-200">
                              {b.guestName}
                            </span>{" "}
                            · {shortDate(b.startDate)}–{shortDate(b.endDate)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAllListingsDayBookings(null);
                            setSelectedBooking(b);
                          }}
                          className="ml-3 shrink-0 rounded-full bg-zinc-900 dark:bg-[#F3F4F5] px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-black dark:hover:bg-white cursor-pointer"
                        >
                          Details
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vacant Listings on this date */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                  Available Properties (
                  {Math.max(
                    0,
                    listings.length - allListingsDayBookings.bookings.length,
                  )}
                  )
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {listings
                    .filter(
                      (l) =>
                        !allListingsDayBookings.bookings.some(
                          (b) => b.listingId === l.id,
                        ),
                    )
                    .map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between rounded-xl border border-[#d7d7d7] dark:border-zinc-700 p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">
                            {l.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAllListingsDayBookings(null);
                            handleSelectProperty(l.id);
                          }}
                          className="ml-3 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          View calendar →
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </WorkspaceDialog>
        )}

        {/* Reservation Details Modal */}
        {selectedBooking && selectedListing && (
          <ReservationDetails
            booking={selectedBooking}
            listing={
              listings.find((l) => l.id === selectedBooking.listingId) ||
              selectedListing
            }
            onClose={() => setSelectedBooking(null)}
            onMoney={() => setShowMoney(true)}
          />
        )}

        {/* Send or Request Money Dialog */}
        {selectedBooking && showMoney && (
          <MoneyDialog
            booking={selectedBooking}
            onClose={() => {
              setShowMoney(false);
              setSelectedBooking(null);
            }}
          />
        )}

        {/* Price Tips Dialog */}
        {tips && (
          <WorkspaceDialog
            title="Price tips"
            onClose={() => setTips(false)}
            maxWidth="max-w-md"
          >
            <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {selectedListing && normalizedSelectedRange && selectedDatesStats && selectedDatesStats.editableKeys.length > 0 ? (
                /* Contextual tips for selected range */
                <div className="space-y-3">
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200/60 dark:border-amber-900/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                        Selected Dates Recommendation
                      </span>
                      <span className="text-xs text-[#727272] font-medium">
                        {selectedDatesStats.totalNights} {selectedDatesStats.totalNights === 1 ? "night" : "nights"}
                      </span>
                    </div>
                    {(() => {
                      const rangeTips = calculatePriceTips({
                        listing: selectedListing,
                        dateKeys: selectedDatesStats.editableKeys,
                        bookings,
                      });
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#727272] font-medium">
                              Recommendation Status
                            </span>
                            {rangeTips.overallAction === "INCREASE" ? (
                              <span className="rounded-md bg-amber-200 dark:bg-amber-900/80 px-2 py-0.5 text-[10px] font-bold text-amber-950 dark:text-amber-200">
                                Demand Surge (+{rangeTips.averagePercentChange}%)
                              </span>
                            ) : rangeTips.overallAction === "DECREASE" ? (
                              <span className="rounded-md bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-blue-900 dark:text-blue-200">
                                Booking Incentive ({rangeTips.averagePercentChange}%)
                              </span>
                            ) : rangeTips.overallAction === "NO_CHANGE" ? (
                              <span className="rounded-md bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:text-emerald-200">
                                Optimal Rate
                              </span>
                            ) : (
                              <span className="rounded-md bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                                Advisory Only
                              </span>
                            )}
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <div>
                              <span className="text-xs text-[#727272] block">Current avg</span>
                              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                {formatMoney(rangeTips.averageCurrentPrice, sourceCurrency, 2)}
                              </span>
                            </div>
                            {rangeTips.overallAction !== "NO_CHANGE" && rangeTips.overallAction !== "INSUFFICIENT_DATA" && (
                              <span className="text-zinc-400">→</span>
                            )}
                            <div className="text-right">
                              <span className="text-xs text-[#727272] block">
                                {rangeTips.overallAction === "NO_CHANGE"
                                  ? "Recommended avg"
                                  : rangeTips.overallAction === "INSUFFICIENT_DATA"
                                    ? "Active avg"
                                    : "Suggested avg"}
                              </span>
                              <span className="text-base font-bold text-amber-700 dark:text-amber-400">
                                {formatMoney(rangeTips.averageSuggestedPrice, sourceCurrency, 2)}
                              </span>
                            </div>
                          </div>

                          {rangeTips.applicableCount > 1 && (
                            <div className="rounded-lg bg-white/60 dark:bg-zinc-900/60 p-2 text-xs text-zinc-600 dark:text-zinc-300 flex items-center justify-between border border-amber-200/50 dark:border-amber-900/40">
                              <span>Breakdown</span>
                              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                                {rangeTips.increaseCount > 0 ? `${rangeTips.increaseCount} increase ` : ""}
                                {rangeTips.decreaseCount > 0 ? `${rangeTips.decreaseCount} decrease ` : ""}
                                {rangeTips.noChangeCount > 0 ? `${rangeTips.noChangeCount} optimal` : ""}
                              </span>
                            </div>
                          )}

                          <div className="border-t border-amber-200/50 dark:border-amber-900/50 pt-2 space-y-1">
                            {rangeTips.reasons.map((r, i) => (
                              <p key={i} className="text-xs text-amber-900/80 dark:text-amber-300/80 flex items-center gap-1.5">
                                <span className="text-amber-500 font-bold">•</span> {r}
                              </p>
                            ))}
                          </div>

                          <div className="pt-2 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setTips(false)}
                              className="rounded-full px-4 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            {rangeTips.overallAction === "INCREASE" || rangeTips.overallAction === "DECREASE" ? (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={async () => {
                                  const nextCustom = {
                                    ...(((selectedListing as any).customPrices || {}) as Record<string, number>),
                                  };
                                  for (const rec of rangeTips.recommendations) {
                                    if (!rec.isBooked && (rec.action === "INCREASE" || rec.action === "DECREASE")) {
                                      nextCustom[rec.dateKey] = rec.suggestedPrice;
                                    }
                                  }
                                  await save({ customPrices: nextCustom });
                                  setTips(false);
                                }}
                                className="rounded-full bg-amber-400 hover:bg-amber-300 px-5 py-2 text-xs font-bold text-zinc-950 transition-colors cursor-pointer disabled:opacity-70"
                              >
                                {saving ? "Applying…" : `Apply to ${rangeTips.increaseCount + rangeTips.decreaseCount} dates`}
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-[#727272] dark:text-zinc-400 italic">
                                {rangeTips.overallAction === "NO_CHANGE" ? "Optimal rate active" : "Manual rate active"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-[#727272] dark:text-zinc-400 leading-normal italic">
                    External market competitor comparison is unavailable. Recommendations are calculated using your property&apos;s base prices, weekend adjustments, booking occupancy signals, and calendar seasonality.
                  </p>
                </div>
              ) : (
                /* Overall listing tips */
                <div className="space-y-5">
                  <div className="rounded-lg border border-[#f1dc94] bg-[#fffaf0] p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#FCDF9C] text-[#6f4c00]">
                        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                          <circle cx="12" cy="12" r="4" />
                        </svg>
                      </span>
                      <div>
                        <h4 className="text-base font-semibold text-[#1F1F1F] dark:text-zinc-100">
                          Property Pricing Insights
                        </h4>
                        <p className="mt-1 text-sm leading-5 text-[#76500b] dark:text-amber-200">
                          Optimize earnings with weekend premiums, Smart Pricing limits, and longer-stay promotions.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#DDDDDE] text-[9px] font-semibold text-[#6f4c00]">1</span>
                      <p className="text-sm leading-6 text-[#595959] dark:text-zinc-300"><strong className="font-semibold text-[#1F1F1F] dark:text-zinc-100">Weekend Pricing</strong><span className="text-[#727272] dark:text-zinc-400"> · Configure weekend rates to capture higher demand on Thursday and Friday nights.</span></p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#DDDDDE] text-[9px] font-semibold text-[#6f4c00]">2</span>
                      <p className="text-sm leading-6 text-[#595959] dark:text-zinc-300"><strong className="font-semibold text-[#1F1F1F] dark:text-zinc-100">Select Dates</strong><span className="text-[#727272] dark:text-zinc-400"> · Click or drag on the calendar to view tailored recommendations for specific dates.</span></p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#DDDDDE] text-[9px] font-semibold text-[#6f4c00]">3</span>
                      <p className="text-sm leading-6 text-[#595959] dark:text-zinc-300"><strong className="font-semibold text-[#1F1F1F] dark:text-zinc-100">Smart Pricing Limits</strong><span className="text-[#727272] dark:text-zinc-400"> · Set minimum and maximum prices to safeguard profitability.</span></p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#DDDDDE] text-[9px] font-semibold text-[#6f4c00]">4</span>
                      <p className="text-sm leading-6 text-[#595959] dark:text-zinc-300"><strong className="font-semibold text-[#1F1F1F] dark:text-zinc-100">Stay Length Discounts</strong><span className="text-[#727272] dark:text-zinc-400"> · Offer discounts to attract longer stays and increase occupancy.</span></p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-[#e7e7e7] bg-[#f7f7f7] p-3 text-sm leading-6 text-[#727272] dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                    <svg className="mt-0.5 size-4 shrink-0 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" strokeLinecap="round" /></svg>
                    <p>External market competitor data is currently unavailable. Suggestions use your property&apos;s rules and calendar lead time.</p>
                  </div>

                  <div className="flex justify-end border-t border-[#e7e7e7] pt-4 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setTips(false)}
                      className="rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#3a3a3a] dark:bg-[#F3F4F5] dark:text-[#1F1F1F] dark:hover:bg-white cursor-pointer"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )}
            </div>
          </WorkspaceDialog>
        )}
      </main>
    </>
  );
}
