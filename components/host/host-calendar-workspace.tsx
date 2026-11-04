"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type CSSProperties,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarSettingsPanel, MobileCalendarSettings } from "./calendar-settings-panel";
import { updateListingAction, bulkUpdateAvailabilityAction } from "@/actions/host/listings";
import type { ListingDTO } from "@/services/mappers";
import { resolvePropertyCurrency } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { useLanguage } from "@/lib/i18n/language-context";
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
import { buildHostCalendarReservationSpans } from "@/lib/booking/host-calendar-spans";
import {
  dateScopedCancellationPolicyOptions,
  getCancellationPolicyForCheckIn,
} from "@/lib/booking/date-cancellation-policy";
import { getCalendarWeeks, getWeekBookingSegments } from "@/lib/booking/calendar-week-layout";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { CloseButton } from "@/components/ui/close-button";
import { CloseIcon } from "@/components/ui/close-icon";
import { calculatePriceTips } from "@/lib/pricing/price-tips";
import { cancellationPolicyLabel } from "@/lib/constants/listing-enums";
import {
  resolveCalendarDatePricing,
  resolveCalendarMonthPricing,
  analyzeSelectionPromotion,
  type SelectionPromotionStats,
} from "@/lib/pricing/calendar-pricing";

export interface HostCalendarWorkspaceProps extends HostWorkspaceProps {
  initialListingId?: string;
  initialMonth?: string; // YYYY-MM
  initialView?: string; // "list" | "month" | "year"
}

export interface CalendarSelection {
  start: string | null; // YYYY-MM-DD
  end: string | null; // YYYY-MM-DD
  isDragging?: boolean;
}

type MobileDateSelectionMode = "idle" | "single-date" | "multi-select" | "year-month";
type CalendarView = "list" | "month" | "year";

const monthName = (date: Date, locale = "en") =>
  date.toLocaleDateString(locale, { month: "long" });

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

function bookingBarTone(booking: HostReservation) {
  return booking.status === "PENDING"
    ? "border-[#c2a0ff] bg-[#dfccff] text-[#4b268a]"
    : "border-[#fb9ab4] bg-[#ffd0db] text-[#76142c]";
}

function timelineBookingBarTone(booking: HostReservation) {
  if (booking.status === "PENDING") return "border-[#efc86a] bg-[#ffedc5] text-[#815000]";
  if (booking.status === "COMPLETED") return "border-[#83d9a2] bg-[#c9f2d5] text-[#155c34]";
  return "border-[#fb9ab4] bg-[#ffd6e1] text-[#7b1733]";
}

function guestInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "G";
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

function MobileViewSelector({
  view,
  onSelectView,
}: {
  view: CalendarView;
  onSelectView: (view: CalendarView) => void;
}) {
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsViewMenuOpen((isOpen) => !isOpen)}
        aria-expanded={isViewMenuOpen}
        aria-haspopup="menu"
        aria-label="Calendar view"
        className="flex items-center gap-1.5 rounded-full bg-[#F3F4F5] px-3.5 py-2 text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#e9e9e9]"
      >
        {view === "list" ? "List" : view === "month" ? "Month" : "Year"}
        <svg
          className={`size-4 transition-transform ${isViewMenuOpen ? "rotate-180" : ""}`}
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

      {isViewMenuOpen && (
        <div
          role="menu"
          aria-label="Calendar view switcher"
          className="absolute right-0 top-full z-20 mt-2 w-28 overflow-hidden rounded-xl border border-[#d7d7d7] bg-white p-1.5 shadow-xl"
        >
          {(["list", "month", "year"] as const).map((option) => {
            const isSelected = view === option;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  onSelectView(option);
                  setIsViewMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium capitalize ${isSelected
                  ? "bg-[#FDE29B] text-[#1F1F1F]"
                  : "text-[#525252] hover:bg-[#F3F4F5]"
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
  );
}

/** The calendar index shown before a host opens an individual property's grid. */
function MobileCalendarIndex({
  listings,
  selectedId,
  onSelect,
  onOpenCalendar,
  view,
  onSelectView,
}: {
  listings: ListingDTO[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenCalendar: () => void;
  view: CalendarView;
  onSelectView: (view: CalendarView) => void;
}) {
  const { t } = useLanguage();
  return (
    <section className="sm:hidden">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1>   {t("host_calendar_title", "Calendar")}</h1>
        <MobileViewSelector view={view} onSelectView={onSelectView} />
      </div>
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
                  {t("host_badge_listed", "listed")}
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
  onOpenPropertySelector,
  onOpenSettings,
  onOpenMonth,
  view,
  onSelectView,
}: {
  startMonth: Date;
  listing: ListingDTO | null;
  bookingsByDate: Map<string, HostReservation[]>;
  blockedDatesSet: Set<string>;
  onOpenPropertySelector: () => void;
  onOpenSettings: () => void;
  onOpenMonth: (month: Date) => void;
  view: CalendarView;
  onSelectView: (view: CalendarView) => void;
}) {
  const { t, language } = useLanguage();
  const months = Array.from(
    { length: 12 },
    (_, index) => new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1),
  );
  const today = dateKey(new Date());
  const propertyLabel = listing?.title || t("host_calendar_property_name", "Property name");
  const location = [listing?.district, listing?.city].filter(Boolean).join(", ") || listing?.country;
  const monthGroups = months.reduce<Array<{ year: number; months: Date[] }>>(
    (groups, calendarMonth) => {
      const year = calendarMonth.getFullYear();
      const currentGroup = groups[groups.length - 1];

      if (!currentGroup || currentGroup.year !== year) {
        groups.push({ year, months: [calendarMonth] });
      } else {
        currentGroup.months.push(calendarMonth);
      }

      return groups;
    },
    [],
  );

  return (
    <section className="sm:hidden">
      <div className="mb-6 flex min-w-0 items-center gap-2">
        <button type="button" onClick={onOpenPropertySelector} aria-label={t("host_calendar_change_property_aria", "Change selected property")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {listing && <PropertyPhoto listing={listing} className="size-8 shrink-0 rounded-full object-cover" />}
          <span className="min-w-0"><span className="flex items-center gap-1"><span className="truncate text-[15px] font-semibold leading-5 text-[#1F1F1F] dark:text-zinc-100">{propertyLabel}</span><svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span><span className="block truncate text-xs leading-4 text-[#727272] dark:text-zinc-400">{location || t("host_calendar_location", "Location")}</span></span>
        </button>
        <MobileViewSelector view={view} onSelectView={onSelectView} />
        <button type="button" onClick={onOpenSettings} aria-label={t("host_calendar_settings", "Calendar settings")} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f3f3f3] text-[#1F1F1F] transition-colors hover:bg-[#e8e8e8] dark:bg-zinc-800 dark:text-zinc-100">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.28 2.28-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.09h-3.22v-.09A1.7 1.7 0 0 0 10.3 18.8a1.7 1.7 0 0 0-1.88.34l-.06.06-2.28-2.28.06-.06A1.7 1.7 0 0 0 6.48 15a1.7 1.7 0 0 0-1.56-1.03h-.09v-3.22h.09A1.7 1.7 0 0 0 6.48 9.72a1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.36 5.5l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.09h3.22v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.28 2.28-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.09v3.22h-.09A1.7 1.7 0 0 0 19.4 15Z" /></svg>
        </button>
      </div>

      <div>
        {monthGroups.map((group, groupIndex) => (
          <section key={group.year} className={groupIndex > 0 ? "mt-8 border-t border-[#d5d5d5] pt-8 dark:border-zinc-700" : ""}>
            {groupIndex > 0 && (
              <h2 className="mb-5 text-xl font-medium text-[#1f1f1f] dark:text-zinc-100">
                {group.year}
              </h2>
            )}
            <div className="grid grid-cols-3 items-start gap-y-5">
              {group.months.map((calendarMonth, index) => {
                const year = calendarMonth.getFullYear();
                const monthIndex = calendarMonth.getMonth();
                const days = new Date(year, monthIndex + 1, 0).getDate();
                const offset = new Date(year, monthIndex, 1).getDay();

                return (
                  <button
                    key={formatMonthKey(calendarMonth)}
                    type="button"
                    onClick={() => onOpenMonth(calendarMonth)}
                    aria-label={`Open ${monthName(calendarMonth)} ${year}`}
                    className={`group flex w-full self-start flex-col pr-3 text-left ${index % 3 === 2 ? "pr-0" : ""}`}
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
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section >
  );
}

function DesktopYearMonth({
  month,
  listing,
  bookingsByDate,
  blockedDatesSet,
  customPricesMap,
  selection,
  onDayClick,
  onOpenMonth,
}: {
  month: Date;
  listing: ListingDTO | null;
  bookingsByDate: Map<string, HostReservation[]>;
  blockedDatesSet: Set<string>;
  customPricesMap: Map<string, number>;
  selection: CalendarSelection;
  onDayClick: MonthGridProps["onDayClick"];
  onOpenMonth: (month: Date) => void;
}) {
  const { formatPrice } = useCurrency();
  const { t, language } = useLanguage();
  const sourceCurrency = listing ? resolvePropertyCurrency(listing) : "SAR";
  const monthIndex = month.getMonth();
  const year = month.getFullYear();
  const today = dateKey(new Date());
  const selectedRange = getNormalizedRange(selection);
  const pricing = useMemo(() => resolveCalendarMonthPricing({
    year,
    monthIndex,
    listing: listing as Parameters<typeof resolveCalendarMonthPricing>[0]["listing"],
  }), [year, monthIndex, listing]);
  const weeks = useMemo(() => getCalendarWeeks(month), [month]);
  const discounts = useMemo(() => {
    const applied = [...pricing.values()].filter((day) => day.promotion?.applied);
    return new Set(applied.map((day) => `${day.promotion?.key}:${day.promotion?.percentage}`)).size;
  }, [pricing]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => (
    new Date(2026, 0, 4 + index).toLocaleDateString(language || "en", { weekday: "narrow" })
  )), [language]);

  return (
    <article className="min-w-0">
      <div className="mb-2 flex min-h-10 items-start justify-between gap-2">
        <button type="button" onClick={() => onOpenMonth(month)} className="text-left text-[17px] font-medium leading-5 text-[#222222] transition-colors hover:text-[#ff385c] dark:text-zinc-100">
          {monthName(month, language)}
        </button>
        {discounts > 0 && <button type="button" onClick={() => onOpenMonth(month)} className="shrink-0 text-[11px] text-[#717171] underline underline-offset-2 hover:text-[#222222] dark:text-zinc-400">{discounts} {discounts === 1 ? t("host_calendar_discount", "discount") : t("host_calendar_discounts", "discounts")}</button>}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-[#ececec] text-center text-[10px] font-medium text-[#717171] dark:border-zinc-800 dark:text-zinc-400">
        {weekdays.map((weekday, index) => <span key={index} className="py-1.5">{weekday}</span>)}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-[#ececec] dark:border-zinc-800">
        {weeks.flatMap((week) => week.dates).map((date) => {
          const key = dateKey(date);
          const outside = date.getMonth() !== monthIndex;
          if (outside) return <span key={key} className="min-h-12 border-b border-r border-[#ececec] bg-[#fafafa] dark:border-zinc-800 dark:bg-zinc-900/30" />;
          const booking = bookingsByDate.get(key)?.[0];
          const blocked = blockedDatesSet.has(key);
          const past = key < today;
          const selected = Boolean(selectedRange && key >= selectedRange.start && key <= selectedRange.end && !booking);
          const dayPricing = pricing.get(key);
          const price = dayPricing?.promotion?.applied ? dayPricing.promotion.promotionalPrice : dayPricing?.originalPrice ?? customPricesMap.get(key) ?? listing?.price ?? 0;
          const tone = booking ? booking.status === "PENDING" ? "bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-200" : "bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-200"
            : blocked ? "bg-[#f1f1f1] text-[#717171] dark:bg-zinc-900 dark:text-zinc-400"
              : past ? "bg-[#fafafa] text-[#9a9a9a] dark:bg-zinc-900/40 dark:text-zinc-500"
                : "bg-white text-[#222222] hover:bg-[#fafafa] dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900";
          return (
            <button key={key} type="button" onClick={(event) => onDayClick(key, booking, undefined, event.shiftKey)} aria-pressed={selected} aria-label={`${key}: ${booking ? booking.status === "PENDING" ? t("host_calendar_status_pending", "Pending reservation") : t("host_calendar_status_booked", "Booked") : blocked ? t("host_cal_blocked_label", "Blocked") : t("host_calendar_status_available", "Available")}`} className={`relative min-h-12 border-b border-r border-[#ececec] p-1 text-left transition-colors dark:border-zinc-800 ${tone} ${selected ? "z-10 ring-2 ring-inset ring-[#222222] dark:ring-white" : ""}`}>
              <span className="block text-[11px] font-medium leading-4">{date.getDate()}</span>
              {booking ? <span className="mt-0.5 block truncate text-[8px] font-medium">{booking.status === "PENDING" ? t("host_calendar_status_pending", "Pending") : t("host_calendar_status_booked", "Booked")}</span>
                : blocked ? <span className="mt-0.5 block text-[8px] line-through">{t("host_cal_blocked_label", "Blocked")}</span>
                  : <span className={`mt-0.5 block truncate text-[9px] ${dayPricing?.promotion?.applied ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}`}>{formatPrice(price, sourceCurrency, 0)}</span>}
              {dayPricing?.promotion?.applied && <span className="block truncate text-[8px] text-[#8a8a8a] line-through">{formatPrice(dayPricing.originalPrice, sourceCurrency, 0)}</span>}
            </button>
          );
        })}
      </div>
    </article>
  );
}

/**
 * A compact, data-backed calendar for the Year view.  It deliberately uses
 * the same Map/Set indexes and date click handler as Month view, so dots are
 * never a second calendar with a separate availability model.
 */
function YearDotCalendar({
  startMonth,
  listing,
  bookingsByDate,
  blockedDatesSet,
  customPricesMap,
  selection,
  onDayClick,
  onOpenMonth,
  onReferenceMonth,
  onSelectMonthRange,
  mobileHeader,
}: {
  startMonth: Date;
  listing: ListingDTO | null;
  bookingsByDate: Map<string, HostReservation[]>;
  blockedDatesSet: Set<string>;
  customPricesMap: Map<string, number>;
  selection: CalendarSelection;
  onDayClick: MonthGridProps["onDayClick"];
  onOpenMonth: (month: Date) => void;
  onReferenceMonth: (month: Date) => void;
  onSelectMonthRange?: (month: Date) => void;
  mobileHeader?: {
    onOpenPropertySelector: () => void;
    onOpenSettings: () => void;
    view: CalendarView;
    onSelectView: (view: CalendarView) => void;
  };
}) {
  const { t, language } = useLanguage();
  const MAX_YEAR_VIEW_MONTHS = 48;
  const scrollRef = useRef<HTMLDivElement>(null);
  const prependHeightRef = useRef<number | null>(null);
  const trimmedTopHeightRef = useRef(0);
  const yearElementsRef = useRef(new Map<number, HTMLElement>());
  const scrollFrameRef = useRef<number | null>(null);
  const extendingRef = useRef(false);
  const initialMonths = useCallback((anchor: Date) => (
    Array.from({ length: 27 }, (_, index) => new Date(anchor.getFullYear(), anchor.getMonth() - 3 + index, 1))
  ), []);
  const [months, setMonths] = useState<Date[]>(() => initialMonths(startMonth));
  const anchorKey = formatMonthKey(startMonth);
  const previousAnchorKey = useRef(anchorKey);
  const today = dateKey(new Date());
  const selectedRange = getNormalizedRange(selection);
  const isWholeMobileMonthSelected = Boolean(mobileHeader && selectedRange && (() => {
    const start = new Date(`${selectedRange.start}T12:00:00Z`);
    const end = new Date(`${selectedRange.end}T12:00:00Z`);
    return start.getUTCDate() === 1 && end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate() && start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  })());
  const propertyLabel = listing?.title || t("host_calendar_property_name", "Property name");
  const location = [listing?.district, listing?.city].filter(Boolean).join(", ") || listing?.country;

  const groups = useMemo(() => months.reduce<Array<{ year: number; months: Date[] }>>((current, calendarMonth) => {
    const year = calendarMonth.getFullYear();
    const lastGroup = current.at(-1);
    if (lastGroup?.year === year) lastGroup.months.push(calendarMonth);
    else current.push({ year, months: [calendarMonth] });
    return current;
  }, []), [months]);

  // Pricing is one of the most expensive pieces of a mini calendar. Resolve it
  // once for each retained month, then keep selection/settings re-renders to
  // O(1) set lookups for every dot.
  const promotionDateKeys = useMemo(() => {
    const promoted = new Set<string>();
    if (!listing) return promoted;
    for (const calendarMonth of months) {
      const pricing = resolveCalendarMonthPricing({
        year: calendarMonth.getFullYear(),
        monthIndex: calendarMonth.getMonth(),
        listing: listing as Parameters<typeof resolveCalendarMonthPricing>[0]["listing"],
      });
      for (const [key, day] of pricing) {
        if (day.promotion?.applied) promoted.add(key);
      }
    }
    return promoted;
  }, [listing, months]);

  useEffect(() => {
    if (previousAnchorKey.current === anchorKey) return;
    previousAnchorKey.current = anchorKey;
    trimmedTopHeightRef.current = 0;
    setMonths(initialMonths(startMonth));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  }, [anchorKey, initialMonths, startMonth]);

  useLayoutEffect(() => {
    const previousHeight = prependHeightRef.current;
    const element = scrollRef.current;
    if (previousHeight !== null && element) {
      element.scrollTop += element.scrollHeight - previousHeight;
      prependHeightRef.current = null;
    }
    if (trimmedTopHeightRef.current && element) {
      element.scrollTop = Math.max(0, element.scrollTop - trimmedTopHeightRef.current);
      trimmedTopHeightRef.current = 0;
    }
    extendingRef.current = false;
  }, [months]);

  const extend = useCallback((direction: "before" | "after") => {
    const element = scrollRef.current;
    const first = months[0];
    const last = months.at(-1);
    if (!element || !first || !last || extendingRef.current) return;
    const year = direction === "before" ? first.getFullYear() - 1 : last.getFullYear() + 1;
    if (year < 1900 || year > 2100) return;
    extendingRef.current = true;
    const additions = Array.from({ length: 12 }, (_, monthIndex) => new Date(year, monthIndex, 1));
    let nextMonths = direction === "before" ? [...additions, ...months] : [...months, ...additions];
    let removedTopHeight = 0;
    let removedBottomHeight = 0;

    while (nextMonths.length > MAX_YEAR_VIEW_MONTHS) {
      if (direction === "after") {
        const oldestYear = nextMonths[0]?.getFullYear();
        const count = nextMonths.findIndex((candidate) => candidate.getFullYear() !== oldestYear);
        const removeCount = count === -1 ? nextMonths.length : count;
        removedTopHeight += oldestYear === undefined ? 0 : yearElementsRef.current.get(oldestYear)?.offsetHeight || 0;
        nextMonths = nextMonths.slice(removeCount);
      } else {
        const newestYear = nextMonths.at(-1)?.getFullYear();
        const firstIndexOfNewestYear = nextMonths.findIndex((candidate) => candidate.getFullYear() === newestYear);
        removedBottomHeight += newestYear === undefined ? 0 : yearElementsRef.current.get(newestYear)?.offsetHeight || 0;
        nextMonths = nextMonths.slice(0, firstIndexOfNewestYear);
      }
    }

    if (direction === "before") {
      // The tail was removed outside the viewport. Discount it from the old
      // height so the prepend correction preserves the visible month exactly.
      prependHeightRef.current = element.scrollHeight - removedBottomHeight;
    } else if (removedTopHeight) {
      trimmedTopHeightRef.current = removedTopHeight;
    }
    setMonths(nextMonths);
  }, [months]);

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const element = scrollRef.current;
      if (!element || extendingRef.current) return;
      if (element.scrollTop < 180) extend("before");
      else if (element.scrollHeight - element.scrollTop - element.clientHeight < 220) extend("after");
    });
  }, [extend]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const dotState = (key: string, booking?: HostReservation) => {
    const selected = Boolean(!isWholeMobileMonthSelected && selectedRange && key >= selectedRange.start && key <= selectedRange.end);
    const blocked = blockedDatesSet.has(key);
    const isPast = key < today;
    const customPrice = customPricesMap.has(key);
    const promotion = promotionDateKeys.has(key);
    const status = booking
      ? booking.status === "PENDING" ? t("host_calendar_status_pending", "Pending reservation") : t("host_calendar_status_booked", "Booked")
      : blocked ? t("host_cal_blocked_label", "Blocked")
        : isPast ? t("host_calendar_status_past", "Past") : t("host_calendar_status_available", "Available");
    const fill = booking
      ? booking.status === "PENDING" ? "bg-amber-500" : "bg-[#ff385c]"
      : blocked ? "bg-[#717171]"
        : isPast ? "bg-[#c7c7c7] dark:bg-zinc-600" : "bg-[#222222] dark:bg-zinc-100";
    const marker = selected ? "ring-2 ring-[#ff385c] ring-offset-2 dark:ring-offset-zinc-950"
      : customPrice ? "ring-1 ring-[#6876d8] ring-offset-1 dark:ring-offset-zinc-950"
        : promotion ? "ring-1 ring-emerald-500 ring-offset-1 dark:ring-offset-zinc-950" : "";
    return { status, className: `${fill} ${marker}`, customPrice, promotion };
  };

  return (
    <section className={mobileHeader ? "relative sm:hidden" : "relative h-full"}>
      {mobileHeader && (
        <div className="sticky top-0 z-20 mb-3 flex min-w-0 items-center gap-2 bg-white pb-3 pt-1 dark:bg-zinc-950">
          <button type="button" onClick={mobileHeader.onOpenPropertySelector} aria-label={t("host_calendar_change_property_aria", "Change selected property")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            {listing && <PropertyPhoto listing={listing} className="size-8 shrink-0 rounded-full object-cover" />}
            <span className="min-w-0"><span className="flex items-center gap-1"><span className="truncate text-[15px] font-semibold text-[#1F1F1F] dark:text-zinc-100">{propertyLabel}</span><svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span><span className="block truncate text-xs text-[#727272] dark:text-zinc-400">{location || t("host_calendar_location", "Location")}</span></span>
          </button>
          <MobileViewSelector view={mobileHeader.view} onSelectView={mobileHeader.onSelectView} />
          <button type="button" onClick={mobileHeader.onOpenSettings} aria-label={t("host_calendar_settings", "Calendar settings")} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f3f3f3] text-lg dark:bg-zinc-800" aria-hidden="false">⚙</button>
        </div>
      )}
      <div ref={scrollRef} onScroll={handleScroll} className={`relative overflow-y-auto overscroll-contain [scrollbar-width:thin] ${mobileHeader ? `h-[calc(100dvh-158px)] ${isWholeMobileMonthSelected ? "pb-[calc(328px+env(safe-area-inset-bottom))]" : "pb-[calc(108px+env(safe-area-inset-bottom))]"}` : "h-full min-h-[520px] pb-8"}`}>
        {groups.map((group) => (
          <section key={group.year} ref={(element) => {
            if (element) yearElementsRef.current.set(group.year, element);
            else yearElementsRef.current.delete(group.year);
          }} className="pt-1 first:pt-0">
            <h2 className="sticky top-0 z-10 mb-7 bg-white/95 py-2 text-[22px] font-semibold tracking-[-0.03em] text-[#222222] backdrop-blur-sm dark:bg-zinc-950/95 dark:text-zinc-100">{group.year}</h2>
            <div className={mobileHeader ? "grid grid-cols-3 items-start gap-x-1 gap-y-8" : "grid grid-cols-2 items-start gap-x-7 gap-y-10 lg:grid-cols-3 xl:gap-x-9"}>
              {group.months.map((calendarMonth) => {
                const year = calendarMonth.getFullYear();
                const monthIndex = calendarMonth.getMonth();
                const days = new Date(year, monthIndex + 1, 0).getDate();
                const offset = new Date(year, monthIndex, 1).getDay();
                const monthStart = dateKey(new Date(year, monthIndex, 1));
                const monthEnd = dateKey(new Date(year, monthIndex, days));
                const isSelectedMonth = Boolean(mobileHeader && selectedRange?.start === monthStart && selectedRange.end === monthEnd);
                if (!mobileHeader) {
                  return <DesktopYearMonth key={formatMonthKey(calendarMonth)} month={calendarMonth} listing={listing} bookingsByDate={bookingsByDate} blockedDatesSet={blockedDatesSet} customPricesMap={customPricesMap} selection={selection} onDayClick={onDayClick} onOpenMonth={onOpenMonth} />;
                }
                return (
                  <article
                    key={formatMonthKey(calendarMonth)}
                    onClick={() => onSelectMonthRange ? onSelectMonthRange(calendarMonth) : onOpenMonth(calendarMonth)}
                    className={`w-full max-w-[94px] cursor-pointer rounded-[12px] p-1 transition-[border,box-shadow,transform] active:scale-[0.98] ${isSelectedMonth ? "border-2 border-[#222222] shadow-[0_2px_6px_rgba(0,0,0,0.08)] dark:border-white" : "border-2 border-transparent"}`}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (onSelectMonthRange) onSelectMonthRange(calendarMonth);
                        else onOpenMonth(calendarMonth);
                      }}
                      className="mb-4 text-left text-[16px] font-medium leading-5 text-[#222222] transition-colors hover:text-[#ff385c] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff385c] dark:text-zinc-100"
                    >
                      {monthName(calendarMonth, language).slice(0, 3)}
                    </button>
                    <div className="grid grid-cols-7 place-items-center gap-y-[6px]">
                      {Array.from({ length: 42 }, (_, cell) => {
                        const day = cell - offset + 1;
                        if (day < 1 || day > days) return <span key={cell} className="size-[3px]" aria-hidden="true" />;
                        const key = dateKey(new Date(year, monthIndex, day));
                        const booking = bookingsByDate.get(key)?.[0];
                        const dot = dotState(key, booking);
                        const pricingLabel = dot.customPrice ? ` · ${t("host_calendar_custom_price", "Custom price")}` : dot.promotion ? ` · ${t("host_calendar_promo", "Promotion")}` : "";
                        return <button key={cell} type="button" onClick={(event) => {
                          event.stopPropagation();
                          onDayClick(key, booking);
                        }} title={`${key}: ${dot.status}${pricingLabel}`} aria-label={`${key}: ${dot.status}${pricingLabel}`} className={`size-[3px] rounded-full transition-transform hover:scale-[2] focus-visible:scale-[2] focus-visible:outline-none min-[375px]:size-[3.5px] sm:size-1 motion-reduce:transition-none ${dot.className}`} />;
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        <p className="sr-only" aria-live="polite">{t("host_calendar_year_dot_legend", "Dark dots are available; pink dots are booked; amber dots are pending; grey dots are blocked or past.")}</p>
      </div>
      <button type="button" onClick={() => onReferenceMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} aria-label={t("host_calendar_jump_current_month", "Jump to current month")} className={`absolute right-3 z-20 flex size-12 items-center justify-center rounded-full bg-white text-[#222222] shadow-[0_4px_16px_rgba(0,0,0,0.16)] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff385c] dark:bg-zinc-800 dark:text-zinc-100 motion-reduce:transition-none ${mobileHeader ? "bottom-[calc(84px+env(safe-area-inset-bottom))]" : "bottom-4"}`}><svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg></button>
    </section>
  );
}

function MobileListCalendar({
  month,
  listing,
  bookingsByDate,
  blockedDatesSet,
  onDayClick,
}: {
  month: Date;
  listing: ListingDTO;
  bookingsByDate: Map<string, HostReservation[]>;
  blockedDatesSet: Set<string>;
  onDayClick: MonthGridProps["onDayClick"];
}) {
  const { formatPrice } = useCurrency();
  const { t, language } = useLanguage();
  const sourceCurrency = resolvePropertyCurrency(listing);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  return (
    <div className="space-y-2 pb-4" aria-label={t("host_calendar_view_list", "Calendar list") }>
      {Array.from({ length: days }, (_, index) => {
        const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
        const key = dateKey(date);
        const booking = bookingsByDate.get(key)?.[0];
        const blocked = blockedDatesSet.has(key);
        const pricing = resolveCalendarDatePricing({
          dateKey: key,
          listing: listing as Parameters<typeof resolveCalendarDatePricing>[0]["listing"],
        });
        const price = pricing.promotion?.promotionalPrice ?? pricing.originalPrice;
        const status = booking
          ? t("host_calendar_status_reserved", { count: 1 }, "Booked")
          : blocked
            ? t("host_cal_blocked_label", "Blocked")
            : t("host_calendar_status_available", { count: 1 }, "Available");
        return (
          <button
            key={key}
            type="button"
            onClick={() => onDayClick(key, booking)}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-left transition-colors hover:bg-[#fafafa] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[#f5f5f5] text-sm font-semibold dark:bg-zinc-800">
              <span>{date.getDate()}</span>
              <span className="text-[10px] font-normal text-[#727272]">{date.toLocaleDateString(language || "en", { weekday: "short" })}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{status}</span>
              <span className="mt-0.5 block truncate text-xs text-[#727272]">{booking ? booking.guestName : pricing.promotion?.applied ? `${pricing.promotion.percentage}% ${t("host_calendar_promo", "promotion")}` : pricing.rateSource === "WEEKEND" ? t("host_calendar_source_weekend", "Weekend rate") : t("host_calendar_source_base", "Base price")}</span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold">{formatPrice(price, sourceCurrency, 2)}</span>
              {pricing.promotion?.applied && <span className="block text-[11px] text-[#727272] line-through">{formatPrice(pricing.originalPrice, sourceCurrency, 2)}</span>}
            </span>
          </button>
        );
      })}
    </div>
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
  const { formatPrice: formatMoney, convert, displayCurrency } = useCurrency();
  const { t, language } = useLanguage();
  const sourceCurrency = resolvePropertyCurrency(listing);
  const compactPriceFormatter = useMemo(
    () => new Intl.NumberFormat(language || "en", { notation: "compact", maximumFractionDigits: 2 }),
    [language],
  );
  const formatCompactPrice = (amountMinorUnits: number) =>
    compactPriceFormatter.format(convert(amountMinorUnits, sourceCurrency) / 100);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const today = dateKey(new Date());

  const localizedWeekdays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 0, 4 + i);
      return {
        full: d.toLocaleDateString(language || "en", { weekday: "long" }),
        short: d.toLocaleDateString(language || "en", { weekday: "narrow" }),
      };
    });
  }, [language]);

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

  const calendarWeeks = useMemo(() => getCalendarWeeks(month), [month]);
  const bookingSegmentsByWeek = useMemo(
    () => calendarWeeks.map((week) => getWeekBookingSegments(week, bookingRanges)),
    [calendarWeeks, bookingRanges],
  );

  return (
    <div className="min-w-0 select-none">
      {/* Weekday headers */}
      <div
        className={`mb-2 grid grid-cols-7 border-b border-b-[#dddddd] py-2 text-center text-[12px] font-medium text-[#1F1F1F] dark:border-b-zinc-800 dark:text-zinc-300 sm:mb-3 sm:py-3 sm:text-base ${compact ? "max-sm:hidden text-[12px]" : ""
          }`}
      >
        {localizedWeekdays.map((d, i) => (
          <span key={i}>
            <span className={compact ? "hidden" : "hidden xl:inline"}>{d.full}</span>
            <span className={compact ? "" : "xl:hidden"}>{d.short}</span>
          </span>
        ))}
      </div>

      {/* Every week owns the same seven-column coordinate system as its booking bars. */}
      <div className="space-y-1.5 sm:space-y-2">
        {calendarWeeks.map((week, weekIndex) => {
          const weekSegments = bookingSegmentsByWeek[weekIndex];
          const bookingLaneCount = isAllListings
            ? 1
            : Math.max(1, ...weekSegments.map((segment) => segment.lane + 1));
          const rowStyle = {
            "--calendar-booking-lanes": bookingLaneCount,
          } as CSSProperties;

          return (
            <div
              key={week.key}
              className="relative"
              style={rowStyle}
            >
              <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-2">
                {week.dates.map((date) => {
          const dayNum = date.getDate();
          const key = dateKey(date);
          const isOutsideMonth = date.getMonth() !== monthIndex;
          const isToday = key === today;
          const isPast = key < today;
          const dayBookings = bookingsByDate.get(key) || [];
          const primaryReservation = dayBookings[0];

          if (isOutsideMonth) {
            const adjacentRate = weekdayBase;
            return (
              <div
                key={key}
                aria-hidden="true"
                className={`min-w-0 rounded-[14px] border border-[#ececef] bg-[#fafafa] p-2.5 text-left opacity-55 max-sm:p-1 max-sm:text-center dark:border-zinc-800 dark:bg-zinc-900 ${compact ? "min-h-[48px] sm:min-h-[68px]" : "min-h-[76px] sm:min-h-[102px] lg:min-h-[calc(104px+var(--calendar-booking-lanes)*36px)]"}`}
              >
                <span className="block text-xs font-medium text-[#737780]">{dayNum}</span>
                {!compact && <span className="mt-2 hidden text-[10px] font-medium text-[#858991] sm:block sm:text-sm">{formatMoney(adjacentRate, sourceCurrency, 2)}</span>}
              </div>
            );
          }

          // Check if key is part of normalized selected range
          // A reservation is actionable as a reservation, not as an editable
          // date range. Keeping its surface out of the selection treatment
          // prevents the range border from visually overlapping a stay.
          const isSelected =
            !isAllListings &&
            !primaryReservation &&
            ((normalizedRange !== null && key >= normalizedRange.start && key <= normalizedRange.end) ||
              (selection.start === key && selection.end === null));
          const isRangeStart =
            isSelected && key === normalizedRange?.start;
          const isRangeEnd = isSelected && key === normalizedRange?.end;
          const isSingleSelection =
            isSelected && isRangeStart && isRangeEnd;
          const isRangeMiddle =
            isSelected && !isRangeStart && !isRangeEnd;

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
                      ? "border border-[#EBA900] bg-[#FCDF9C] text-[#403C34] font-medium shadow-xs sm:!border-[#EBA900] sm:!bg-[#FCDF9C] dark:border-[#EBA900] dark:bg-[#FCDF9C] dark:text-[#403C34]"
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
            "border-[#ececef] bg-white text-[#1F1F1F] hover:border-[#cfcfd4] hover:bg-[#fcfcfd] dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:hover:border-zinc-600";
          let cellRoundingClass = compact ? "rounded-[10px]" : "rounded-[14px]";

          if (primaryReservation) {
            // The range overlay carries the booking state; the card stays light
            // so prices and guest bars remain independently legible.
            cellBgClass =
              "border-[#e6e6e9] bg-white text-[#1F1F1F] shadow-xs dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100";
            cellRoundingClass = compact ? "rounded-[10px]" : "rounded-[14px]";
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
              cellRoundingClass = `${compact ? "rounded-[10px]" : "rounded-[14px]"}`;
              if (!primaryReservation) {
                cellBgClass =
                  "border-[#198cff] bg-[#f5faff] text-[#1F1F1F] shadow-sm dark:border-sky-400 dark:bg-sky-950/40 dark:text-zinc-100";
              }
            } else if (isRangeStart) {
              cellRoundingClass = `${compact ? "rounded-l-[10px]" : "rounded-l-xl"} rounded-r-none border-r-0`;
              if (!primaryReservation) {
                cellBgClass =
                  "border-y-2 border-l-2 border-[#198cff] bg-[#edf7ff] dark:border-sky-400 dark:bg-sky-950/70 text-[#1F1F1F] dark:text-zinc-100 shadow-sm";
              }
            } else if (isRangeEnd) {
              cellRoundingClass = `${compact ? "rounded-r-[10px]" : "rounded-r-xl"} rounded-l-none border-l-0`;
              if (!primaryReservation) {
                cellBgClass =
                  "border-y-2 border-r-2 border-[#198cff] bg-[#edf7ff] dark:border-sky-400 dark:bg-sky-950/70 text-[#1F1F1F] dark:text-zinc-100 shadow-sm";
              }
            } else if (isRangeMiddle) {
              cellRoundingClass = "rounded-none border-x-0";
              if (!primaryReservation) {
                cellBgClass =
                  "border-y-2 border-[#198cff]/50 dark:border-sky-400/50 bg-[#edf7ff] dark:bg-sky-950/50 text-[#1F1F1F] dark:text-zinc-100";
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
              className={`group relative flex min-w-0 self-stretch flex-col items-start border text-left transition-all duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 max-sm:items-center max-sm:text-center ${cellRoundingClass} ${cellBgClass} ${compact
                ? "min-h-[48px] p-1 sm:min-h-[68px] sm:py-1.5"
                  : "min-h-[76px] p-2 max-sm:min-h-[72px] max-sm:p-1 sm:min-h-[102px] sm:p-2.5 lg:min-h-[calc(104px+var(--calendar-booking-lanes)*36px)] lg:p-3"
                }`}
            >
              <div className="flex min-h-0 w-full flex-1 flex-col items-start max-sm:items-center lg:pb-[calc(var(--calendar-booking-lanes)*36px)]">
                {/* Day number */}
                <div className="flex w-full items-center justify-start px-1 max-sm:justify-center">
                  <span
                    className={`flex items-center justify-center rounded-full font-medium transition-transform ${compact
                      ? "size-5 max-[360px]:text-[9px] text-xs sm:size-6 sm:border sm:border-zinc-300 dark:sm:border-zinc-600 sm:bg-white dark:sm:bg-zinc-700 sm:text-zinc-800 dark:sm:text-zinc-200 sm:text-[12px]"
                      : "size-6 text-xs sm:size-7 sm:text-xs"
                      } ${isToday
                        ? "border border-[#EBA900] bg-[#FCDF9C] text-[#1F1F1F] font-medium shadow-xs sm:!border-[#EBA900] sm:!bg-[#FCDF9C] dark:border-[#EBA900] dark:bg-[#FCDF9C] dark:text-[#1F1F1F]"
                      : "text-zinc-900 dark:text-zinc-200"
                      } ${blocked ? "line-through text-[#727272]" : ""} ${isSelected || primaryReservation ? "!text-xs" : ""}`}
                  >
                    {dayNum}
                  </span>

                </div>

                {/* Price / Status */}
                <div className={`mt-1 flex min-h-8 w-full flex-1 flex-col items-start justify-start px-0.5 text-left max-sm:items-center max-sm:text-center ${!compact && !isAllListings && weekSegments.length > 0 ? "max-lg:pt-[calc(var(--calendar-booking-lanes)*18px)]" : ""}`}>
                  {blocked ? (
                    <>
                      <span className="hidden text-xs font-medium text-[#727272] line-through sm:block">{t("host_cal_blocked_label", "Blocked")}</span>
                      <span className="text-[12px] font-medium leading-none text-[#727272] sm:hidden" aria-hidden="true" title={t("host_cal_blocked_label", "Blocked")}>×</span>
                    </>
                  ) : primaryReservation ? (
                    <span className={`font-['Poppins'] leading-normal tracking-normal text-[#1F1F1F] dark:text-zinc-100 ${compact
                      ? "mt-0.5 block text-[12px] font-medium"
                      : "text-[10px] font-medium lg:text-[16px]"
                      }`}>
                      {!compact && <span className="mr-0.5 text-[8px] font-medium text-rose-700 sm:hidden" aria-hidden="true" title={t("host_calendar_status_booked", "Booked")}>B</span>}
                      {compact ? formatMoney(rate, sourceCurrency, 2) : <><span className="sm:hidden">{formatCompactPrice(rate)}</span><span className="hidden sm:inline">{formatMoney(rate, sourceCurrency, 2)}</span></>}
                    </span>
                  ) : isPast ? (
                    <span className="text-[10px] font-medium leading-tight text-[#727272] line-through sm:text-sm">
                      <span className="sm:hidden">{formatCompactPrice(rate)}</span>
                      <span className="hidden sm:inline">{formatMoney(rate, sourceCurrency, 2)}</span>
                    </span>
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
                        <span className="hidden text-[10px] leading-none text-[#727272] line-through sm:mb-1 sm:block sm:text-xs dark:text-[#727272]">
                          {formatMoney(dayPricing?.originalPrice ?? rate, sourceCurrency, 2)}
                        </span>
                        <span className="block text-[10px] font-medium leading-tight text-emerald-700 dark:text-emerald-400 sm:text-[14px]">
                          <span className="sm:hidden">{formatCompactPrice(promo.promotionalPrice)}</span>
                          <span className="hidden sm:inline">{formatMoney(promo.promotionalPrice, sourceCurrency, 2)}</span>
                        </span>
                        <div className="mt-0.5 flex items-center gap-1 max-sm:justify-center">
                          <span className="hidden rounded-sm border border-[#a7e9ce] bg-emerald-100 px-1.5 py-1 text-[8px] font-medium capitalize leading-tight tracking-tight text-[#08785d] dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 sm:inline sm:rounded-md sm:text-[10px]">
                            {promo.percentage}% promo
                          </span>
                          <span className="rounded-sm border border-[#a7e9ce] bg-[#d9f7eb] px-1 py-0.5 text-[9px] font-medium leading-tight text-[#08785d] sm:hidden">-{promo.percentage}%</span>
                          {customPrice !== null && (
                            <span className="hidden text-[9px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1 rounded sm:inline">
                              custom
                            </span>
                          )}
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <span
                        className={`${compact
                          ? `mt-0.5 block text-[#1F1F1F] dark:text-zinc-100 text-[12px] leading-normal ${isSelected ? "font-medium" : "font-normal"}`
                          : `font-['Poppins'] text-[10px] lg:text-[16px] lg:leading-6 leading-normal tracking-normal ${isSelected ? "font-medium" : "font-normal"}`
                          } ${compact
                            ? ""
                            : isSelected
                              ? customPrice !== null
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-zinc-950 dark:text-amber-300"
                              : customPrice !== null
                                ? "text-amber-600 dark:text-amber-400 font-medium"
                                : "text-[#1F1F1F] dark:text-zinc-100"
                          }`}
                      >
                        {compact
                          ? formatMoney(rate, sourceCurrency, 2)
                          : <><span className="sm:hidden">{formatCompactPrice(rate)}</span><span className="hidden sm:inline">{formatMoney(rate, sourceCurrency, 2)}</span></>}
                      </span>
                      {customPrice !== null && (
                        <span className="mt-0.5 rounded border border-[#EBA900] bg-[#FCDF9C] px-1.5 py-1 text-[9px] font-medium capitalize leading-tight text-[#1f1f1f] dark:bg-amber-950/60 dark:text-amber-300">
                          custom
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

            </button>
          );
        })}
              </div>

              {!compact && !isAllListings && weekSegments.length > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 top-[32px] z-20 grid grid-cols-7 gap-1 sm:gap-2 lg:hidden"
                  style={{ gridTemplateRows: `repeat(${bookingLaneCount}, 18px)` }}
                >
                  {weekSegments.map((segment) => {
                    const startsHere = !segment.continuesBefore;
                    const endsHere = !segment.continuesAfter;
                    const spansMultipleDays = segment.endColumn - segment.startColumn > 1;

                    return (
                      <button
                        key={`mobile:${week.key}:${segment.booking.id}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDayClick(dateKey(week.dates[segment.startColumn - 1]), segment.booking);
                        }}
                        aria-label={`Open reservation for ${segment.booking.guestName}`}
                        style={{
                          gridColumn: `${segment.startColumn} / ${segment.endColumn}`,
                          gridRow: segment.lane + 1,
                        }}
                        className={`pointer-events-auto flex h-[18px] min-w-0 items-center justify-center gap-1 overflow-hidden border px-1 text-center text-[8px] font-medium leading-none focus-visible:outline-2 focus-visible:outline-offset-1 ${bookingBarTone(segment.booking)} ${startsHere ? "rounded-l-full" : "rounded-l-sm border-l-0"} ${endsHere ? "rounded-r-full" : "rounded-r-sm border-r-0"}`}
                      >
                        {startsHere && (
                          <span className="flex size-3 shrink-0 items-center justify-center rounded-full border border-white bg-white/90 text-[6px] font-semibold leading-none">
                            {guestInitials(segment.booking.guestName)}
                          </span>
                        )}
                        {spansMultipleDays && (
                          <span className="min-w-0 truncate">
                            {startsHere ? segment.booking.guestName : t("host_calendar_stay_continues", "Continues")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {!compact && !isAllListings && weekSegments.length > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-3 z-20 hidden grid grid-cols-7 gap-1.5 sm:gap-2 lg:grid"
                  style={{ gridTemplateRows: `repeat(${bookingLaneCount}, 32px)` }}
                >
                  {weekSegments.map((segment) => {
                    const startsHere = !segment.continuesBefore;
                    const endsHere = !segment.continuesAfter;
                    return (
                      <button
                        key={`${week.key}:${segment.booking.id}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDayClick(dateKey(week.dates[segment.startColumn - 1]), segment.booking);
                        }}
                        aria-label={`Open reservation for ${segment.booking.guestName}`}
                        style={{
                          gridColumn: `${segment.startColumn} / ${segment.endColumn}`,
                          gridRow: segment.lane + 1,
                        }}
                        className={`pointer-events-auto flex min-w-0 items-center overflow-hidden border px-2 text-left text-xs font-medium shadow-[0_2px_7px_rgba(0,0,0,0.06)] transition-transform duration-150 hover:-translate-y-px hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 ${bookingBarTone(segment.booking)} ${startsHere ? "rounded-l-full" : "rounded-l-md border-l-0"} ${endsHere ? "rounded-r-full" : "rounded-r-md border-r-0"}`}
                      >
                        {startsHere && (
                          <span className="mr-2 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white/90 text-[9px] font-medium shadow-sm">
                            {guestInitials(segment.booking.guestName)}
                          </span>
                        )}
                        <span className="truncate">{startsHere ? segment.booking.guestName : "Continues"}</span>
                        {segment.continuesAfter && <span className="ml-auto text-base leading-none opacity-60">›</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarStatusLegend() {
  const items = [
    { label: "Available", description: "Can be booked", swatch: "border-[#d8dadd] bg-white" },
    { label: "Booked", description: "Not available", swatch: "border-[#fb9ab4] bg-[#ff9ab5]" },
    { label: "Your selected dates", description: "Ready to edit", swatch: "border-[#63b7ff] bg-[#9dd4ff]" },
    { label: "Unavailable", description: "Blocked by host", swatch: "border-[#d7d9dd] bg-[#e6e8eb]" },
    { label: "Promo price", description: "Special discount", swatch: "border-[#8de6bd] bg-[#d9f7e7]" },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 rounded-[22px] bg-[#f7f7f8] px-5 py-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 items-center gap-3">
          <span className={`size-6 shrink-0 rounded-lg border ${item.swatch}`} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-[#202124]">{item.label}</span>
            <span className="block truncate text-xs text-[#6b7078]">{item.description}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

type ContinuousMonthCalendarProps = Omit<MonthGridProps, "month" | "compact"> & {
  activeMonth: Date;
  navigationKey: number;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  onVisibleMonthChange: (month: Date) => void;
};

/**
 * A deliberately bounded scroll window. The workspace already receives the
 * host's reservation set in one request, so this keeps the DOM stable without
 * inventing a per-month API contract. Explicit navigation recenters the window;
 * regular scrolling only changes the toolbar label.
 */
function ContinuousMonthCalendar({
  activeMonth,
  navigationKey,
  scrollRootRef,
  onVisibleMonthChange,
  ...monthGridProps
}: ContinuousMonthCalendarProps) {
  const monthElements = useRef(new Map<string, HTMLElement>());
  const onVisibleMonthChangeRef = useRef(onVisibleMonthChange);
  const activeMonthRef = useRef(activeMonth);
  const pendingScrollKeyRef = useRef<string | null>(null);
  const pendingScrollDeltaRef = useRef(0);
  const pendingPrependKeyRef = useRef<string | null>(null);
  const rebasingRef = useRef(false);
  const hasInitializedViewportRef = useRef(false);
  const initialWindow = useCallback((center: Date) => (
    Array.from({ length: 5 }, (_, index) =>
      new Date(center.getFullYear(), center.getMonth() + index, 1),
    )
  ), []);
  const [months, setMonths] = useState(() => initialWindow(activeMonth));

  useEffect(() => {
    activeMonthRef.current = activeMonth;
  }, [activeMonth]);

  useEffect(() => {
    // The initial list deliberately starts with the active month. Scrolling it
    // into view here could briefly expose the previous buffered month and let
    // the observer overwrite the selected month, so only recenter after an
    // explicit navigation action.
    if (!hasInitializedViewportRef.current) {
      hasInitializedViewportRef.current = true;
      return;
    }

    const targetMonth = activeMonthRef.current;
    const targetKey = formatMonthKey(targetMonth);
    const target = monthElements.current.get(targetKey);
    const scrollRoot = scrollRootRef.current;
    if (target && scrollRoot) {
      const offset = target.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top;
      scrollRoot.scrollTo({ top: scrollRoot.scrollTop + offset, behavior: "smooth" });
      return;
    }
    pendingScrollKeyRef.current = targetKey;
    setMonths(initialWindow(targetMonth));
  }, [navigationKey, initialWindow, scrollRootRef]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (scrollRoot && pendingScrollDeltaRef.current) {
      scrollRoot.scrollTop += pendingScrollDeltaRef.current;
      pendingScrollDeltaRef.current = 0;
    }
    if (scrollRoot && pendingPrependKeyRef.current) {
      const inserted = monthElements.current.get(pendingPrependKeyRef.current);
      scrollRoot.scrollTop += (inserted?.offsetHeight || 0) + 40;
      pendingPrependKeyRef.current = null;
    }
    rebasingRef.current = false;

    const targetKey = pendingScrollKeyRef.current;
    if (!targetKey) return;
    const target = monthElements.current.get(targetKey);
    if (!target || !scrollRoot) return;
    pendingScrollKeyRef.current = null;
    const offset = target.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top;
    scrollRoot.scrollTo({ top: scrollRoot.scrollTop + offset, behavior: "auto" });
  }, [months, scrollRootRef]);

  useEffect(() => {
    onVisibleMonthChangeRef.current = onVisibleMonthChange;
  }, [onVisibleMonthChange]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = scrollRootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const key = visible?.target.getAttribute("data-calendar-month");
        const next = key ? parseMonthKey(key) : null;
        if (next) onVisibleMonthChangeRef.current(next);

        if (rebasingRef.current) return;
        const firstKey = formatMonthKey(months[0]);
        const lastKey = formatMonthKey(months.at(-1)!);
        const firstEntry = entries.find(
          (entry) => entry.isIntersecting && entry.target.getAttribute("data-calendar-month") === firstKey,
        );
        const lastEntry = entries.find(
          (entry) => entry.isIntersecting && entry.target.getAttribute("data-calendar-month") === lastKey,
        );

        if (lastEntry) {
          const firstElement = monthElements.current.get(firstKey);
          pendingScrollDeltaRef.current = -((firstElement?.offsetHeight || 0) + 40);
          rebasingRef.current = true;
          setMonths((current) => [
            ...current.slice(1),
            new Date(current.at(-1)!.getFullYear(), current.at(-1)!.getMonth() + 1, 1),
          ]);
        } else if (firstEntry) {
          const previous = new Date(months[0].getFullYear(), months[0].getMonth() - 1, 1);
          rebasingRef.current = true;
          pendingPrependKeyRef.current = formatMonthKey(previous);
          setMonths((current) => [previous, ...current.slice(0, -1)]);
        }
      },
      { root, rootMargin: "0px 0px 180px", threshold: [0.45, 0.65] },
    );

    const elements = [...monthElements.current.values()];
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [months, scrollRootRef]);

  return (
    <div className="space-y-10 pb-3">
      {months.map((calendarMonth) => {
        const key = formatMonthKey(calendarMonth);
        return (
          <section
            key={key}
            ref={(element) => {
              if (element) monthElements.current.set(key, element);
              else monthElements.current.delete(key);
            }}
            data-calendar-month={key}
            className="scroll-mt-4"
          >
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-xl font-medium tracking-tight text-[#202124] dark:text-zinc-100">
                {monthName(calendarMonth)} {calendarMonth.getFullYear()}
              </h2>
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#777b83]">Calendar</span>
            </div>
            <MonthGrid {...monthGridProps} month={calendarMonth} compact={false} />
          </section>
        );
      })}
      <CalendarStatusLegend />
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
  const { t, language } = useLanguage();
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
        aria-label={`Open ${monthName(month, language)} ${month.getFullYear()} month view`}
        className="mb-5 flex w-full items-center text-left text-base font-medium text-[#1F1F1F] transition-colors hover:text-amber-400 dark:text-zinc-100 dark:hover:text-amber-400"
      >
        {monthName(month, language)}
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

function MultiPropertyCalendar({
  month,
  listings,
  bookings,
  onSelectReservation,
  onOpenPropertyDate,
}: {
  month: Date;
  listings: ListingDTO[];
  bookings: HostReservation[];
  onSelectReservation: (booking: HostReservation) => void;
  onOpenPropertyDate: (listingId: string, date: string) => void;
}) {
  const { language } = useLanguage();
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const propertyColumnWidth = 212;
  const dateColumnWidth = 56;
  const headerHeight = 62;
  const baseRowHeight = 64;
  const dateKeys = useMemo(
    () => Array.from({ length: dayCount }, (_, index) => dateKey(new Date(year, monthIndex, index + 1))),
    [year, monthIndex, dayCount],
  );
  const visibleStart = dateKeys[0] || "";
  const visibleEnd = shiftDateKey(dateKeys.at(-1) || visibleStart, 1);
  const listingIds = useMemo(() => new Set(listings.map((listing) => listing.id)), [listings]);
  const spans = useMemo(
    () => buildHostCalendarReservationSpans(bookings, visibleStart, visibleEnd, listingIds),
    [bookings, visibleStart, visibleEnd, listingIds],
  );
  const dateIndex = useMemo(() => new Map(dateKeys.map((key, index) => [key, index])), [dateKeys]);
  const gridStyle = useMemo(
    () => ({ gridTemplateColumns: `${propertyColumnWidth}px repeat(${dateKeys.length}, ${dateColumnWidth}px)` }),
    [dateKeys.length],
  );
  const rows = useMemo(() => {
    const spansByListing = new Map<string, typeof spans>();
    for (const span of spans) {
      const current = spansByListing.get(span.booking.listingId) || [];
      current.push(span);
      spansByListing.set(span.booking.listingId, current);
    }

    return listings.reduce<Array<{
      listing: ListingDTO;
      laidOutSpans: Array<(typeof spans)[number] & { lane: number }>;
      laneCount: number;
      height: number;
      offset: number;
    }>>((computedRows, listing) => {
      const laneEnds: string[] = [];
      const laidOutSpans = (spansByListing.get(listing.id) || []).map((span) => {
        const existingLane = laneEnds.findIndex((end) => end <= span.visibleStart);
        const lane = existingLane === -1 ? laneEnds.length : existingLane;
        laneEnds[lane] = span.visibleEnd;
        return { ...span, lane };
      });
      const laneCount = Math.max(1, laneEnds.length);
      const height = Math.max(baseRowHeight, laneCount * 34 + 8);
      const previousRow = computedRows.at(-1);
      const offset = previousRow ? previousRow.offset + previousRow.height : 0;
      const row = { listing, laidOutSpans, laneCount, height, offset };
      return [...computedRows, row];
    }, []);
  }, [listings, spans]);
  const totalRowsHeight = rows.reduce((total, row) => total + row.height, 0);
  const overscan = 240;
  const visibleRows = useMemo(
    () => rows.filter((row) => row.offset + row.height >= scrollTop - overscan && row.offset <= scrollTop + 1200 + overscan),
    [rows, scrollTop],
  );
  const today = dateKey(new Date());

  useEffect(() => {
    timelineViewportRef.current?.scrollTo({ left: 0, top: 0 });
  }, [year, monthIndex]);

  return (
    <div
      ref={timelineViewportRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className="h-full min-h-[340px] overflow-auto rounded-2xl border border-[#e3e4e8] bg-[#f7f8fa] shadow-[0_8px_24px_rgba(31,31,31,0.04)] calendar-panel-scrollbar dark:border-zinc-700 dark:bg-zinc-950"
      aria-label={`${monthName(month, language)} ${year} all listings calendar`}
    >
      <div style={{ minWidth: propertyColumnWidth + dateKeys.length * dateColumnWidth }}>
        <div className="sticky top-0 z-30 grid border-b border-[#e3e4e8] bg-white text-center shadow-[0_2px_8px_rgba(31,31,31,0.04)] dark:border-zinc-700 dark:bg-zinc-900" style={{ ...gridStyle, height: headerHeight }}>
          <div className="sticky left-0 z-40 flex flex-col justify-center border-r border-[#dedfe3] bg-white px-4 text-left dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#777b83]">Properties</span>
            <span className="mt-0.5 text-xs font-medium text-[#25282d] dark:text-zinc-100">{listings.length} selected</span>
          </div>
          {dateKeys.map((key) => {
            const day = new Date(`${key}T12:00:00`);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isToday = key === today;
            return (
              <div key={key} className={`border-r border-[#ececf0] py-2 text-[10px] font-medium ${isWeekend ? "bg-[#fafafc] text-[#6b7078]" : "text-[#5d636d]"} dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300`}>
                <span className="block uppercase tracking-wide">{day.toLocaleDateString(language || "en", { weekday: "short" })}</span>
                <span className={`mx-auto mt-1 flex size-6 items-center justify-center rounded-full text-sm font-medium ${isToday ? "bg-[#2383e2] text-white" : "text-[#1f2329] dark:text-white"}`}>{day.getDate()}</span>
              </div>
            );
          })}
        </div>

        <div className="relative" style={{ height: totalRowsHeight }}>
          {visibleRows.map(({ listing, laidOutSpans, laneCount, height, offset }) => {
            const blockedDates = new Set(listing.blockedDates || []);
            const location = [listing.district, listing.city].filter(Boolean).join(", ") || listing.country;
            return (
            <div
              key={listing.id}
              className="absolute left-0 grid border-b border-[#e9eaed] bg-white dark:border-zinc-800 dark:bg-zinc-900"
              style={{ ...gridStyle, top: offset, height, gridTemplateRows: `repeat(${laneCount}, minmax(30px, 1fr))` }}
            >
              <div
                className="sticky left-0 z-20 row-span-full flex items-center border-r border-[#dedfe3] bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                style={{ gridColumn: 1, gridRow: `1 / span ${laneCount}` }}
              >
                <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  <PropertyPhoto listing={listing} className="size-full object-cover" />
                </div>
                <span className="ml-2 min-w-0">
                  <span className="block truncate text-xs font-medium text-[#282c32] dark:text-zinc-100" title={listing.title || "Property"}>{listing.title || "Property"}</span>
                  {location && <span className="mt-0.5 block truncate text-[10px] text-[#7c818a]" title={location}>{location}</span>}
                </span>
              </div>
              {dateKeys.map((key, index) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`${listing.title || "Property"}, ${key}${blockedDates.has(key) ? ", blocked" : ", available"}`}
                  onClick={() => onOpenPropertyDate(listing.id, key)}
                  className={`row-span-full border-r border-[#f0f0f2] transition-colors hover:bg-[#edf7ff] dark:border-zinc-800 dark:hover:bg-zinc-800 ${blockedDates.has(key) ? "bg-[#eceef1]" : index % 7 === 0 || index % 7 === 6 ? "bg-[#fcfcfd]" : "bg-white dark:bg-zinc-900"}`}
                  style={{ gridColumn: index + 2, gridRow: `1 / span ${laneCount}` }}
                />
              ))}
              {laidOutSpans.map((span) => {
                const startIndex = dateIndex.get(span.visibleStart);
                const endIndex = dateIndex.get(span.visibleEnd);
                if (startIndex === undefined || endIndex === undefined || endIndex <= startIndex) return null;
                return (
                  <button
                    key={`${span.booking.listingId}:${span.booking.id}`}
                    type="button"
                    onClick={() => onSelectReservation(span.booking)}
                    title={`${span.booking.guestName} · ${formatBookingDateRange(span.start, span.end)}`}
                    className={`z-[1] mx-0.5 my-1 flex h-7 min-w-0 self-center items-center overflow-hidden border px-2 text-left text-xs font-medium shadow-sm transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2383e2] ${timelineBookingBarTone(span.booking)} ${span.continuesBefore ? "rounded-l-none border-l-0" : "rounded-l-full"} ${span.continuesAfter ? "rounded-r-none border-r-0" : "rounded-r-full"}`}
                    style={{ gridColumn: `${startIndex + 2} / span ${endIndex - startIndex}`, gridRow: span.lane + 1 }}
                  >
                    {!span.continuesBefore && <span className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/90 text-[8px] font-medium shadow-sm">{guestInitials(span.booking.guestName)}</span>}
                    <span className="truncate">{span.continuesBefore ? "Continues" : span.booking.guestName}</span>
                  </button>
                );
              })}
            </div>
          );
          })}
        </div>
      </div>
    </div>
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

/** The compact bulk editor used only after selecting a whole month in mobile Year view. */
function MobileYearMonthEditor({
  range,
  stats,
  sourceCurrency,
  saving,
  notice,
  onClear,
  onBulkAvailability,
  onOpenEditor,
}: {
  range: { start: string; end: string };
  stats: SelectedDatesStats;
  sourceCurrency: string;
  saving: boolean;
  notice: string;
  onClear: () => void;
  onBulkAvailability: (action: "BLOCK" | "UNBLOCK") => void;
  onOpenEditor: () => void;
}) {
  const { formatPrice } = useCurrency();
  const { t, language } = useLanguage();
  const label = new Date(`${range.start}T12:00:00Z`).toLocaleDateString(language || "en", { month: "long", year: "numeric", timeZone: "UTC" });
  const priceText = stats.minPrice === null
    ? t("host_calendar_no_editable_price", "No editable nights")
    : stats.minPrice === stats.maxPrice
      ? formatPrice(stats.minPrice, sourceCurrency, 0)
      : `${formatPrice(stats.minPrice, sourceCurrency, 0)} – ${formatPrice(stats.maxPrice ?? stats.minPrice, sourceCurrency, 0)}`;
  const status = stats.isMixedAvailability
    ? t("host_calendar_status_mixed", "Mixed availability")
    : stats.allBlocked ? t("host_cal_blocked_label", "Blocked") : t("host_calendar_status_available", "Available");

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(292px+env(safe-area-inset-bottom))] z-[61] flex justify-center px-4 sm:hidden">
        <div className="flex max-w-[270px] items-center gap-3 rounded-2xl bg-[#202020] px-4 py-2.5 text-white shadow-lg">
          <button type="button" onClick={onClear} aria-label={t("host_calendar_clear_selection_aria", "Clear date selection")} className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg transition-colors hover:bg-white/20">×</button>
          <span className="min-w-0"><span className="block truncate text-sm font-medium">{label}</span><span className="block truncate text-xs text-white/70">{t("host_calendar_editable_count", { count: stats.editableKeys.length }, `${stats.editableKeys.length} nights can be edited`)}</span></span>
        </div>
      </div>
      <aside aria-label={t("host_calendar_manage_selected_dates", "Manage selected dates")} className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] grid grid-cols-[1fr_1fr] gap-2 bg-white/95 px-4 pb-3 pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:bg-zinc-950/95 sm:hidden">
        <section className="row-span-2 flex min-h-[174px] flex-col rounded-[22px] bg-[#151515] p-4 text-white">
          <div className="flex items-center justify-between gap-2"><span className="text-sm text-white/70">{status}</span><span className={`size-2 rounded-full ${stats.allBlocked ? "bg-zinc-400" : stats.isMixedAvailability ? "bg-amber-400" : "bg-emerald-400"}`} /></div>
          <p className="mt-2 text-xs text-white/55">{stats.editableKeys.length > 0 ? t("host_calendar_editable_count", { count: stats.editableKeys.length }, `${stats.editableKeys.length} editable`) : t("host_calendar_no_editable_dates", "No editable dates")}</p>
          <div className="mt-auto grid grid-cols-2 gap-2"><button type="button" disabled={saving || stats.editableKeys.length === 0} onClick={() => onBulkAvailability("BLOCK")} className="rounded-full bg-white/10 py-2 text-xs font-medium disabled:opacity-40">{t("host_calendar_block", "Block")}</button><button type="button" disabled={saving || stats.editableKeys.length === 0} onClick={() => onBulkAvailability("UNBLOCK")} className="rounded-full bg-white py-2 text-xs font-medium text-[#151515] disabled:opacity-40">{t("host_calendar_open", "Open")}</button></div>
        </section>
        <button type="button" onClick={onOpenEditor} className="min-h-[112px] rounded-[22px] bg-[#151515] p-4 text-left text-white transition-transform hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff385c]"><span className="block text-sm text-white/65">{t("host_calendar_new_listing_price", "New listing price")}</span><span className="mt-4 block text-[20px] font-semibold leading-6">{priceText}</span>{stats.promoStats.enabled && <span className="mt-2 block text-xs text-white/60 line-through">{formatPrice(stats.promoStats.avgOriginalPrice, sourceCurrency, 0)}</span>}</button>
        <button type="button" onClick={onOpenEditor} className="flex min-h-[54px] items-center justify-between rounded-[18px] bg-[#151515] px-4 text-sm font-medium text-white"><span>{t("host_calendar_custom_settings", "Custom settings")}</span><span className="text-xl">+</span></button>
        {(notice || saving) && <p role={notice ? "status" : undefined} className="col-span-2 truncate text-center text-xs text-[#555555] dark:text-zinc-400">{saving ? t("host_calendar_saving", "Saving…") : notice}</p>}
      </aside>
    </>
  );
}

function getLocalizedReason(reason: string, t: (k: any, ...args: any[]) => string): string {
  if (reason.includes("High calendar compression")) return t("host_calendar_tip_high_occupancy", reason);
  if (reason.includes("Healthy booking pace")) return t("host_calendar_tip_strong_occupancy", reason);
  if (reason.includes("Unbooked date approaching")) return t("host_calendar_tip_last_minute", reason);
  if (reason.includes("Low near-term occupancy")) return t("host_calendar_tip_low_occupancy", reason);
  if (reason.includes("Far advance unbooked date")) return t("host_calendar_tip_early_bird", reason);
  if (reason.includes("Strong advance booking momentum")) return t("host_calendar_tip_strong_advance", reason);
  if (reason.includes("already well-aligned with demand signals")) return t("host_calendar_tip_optimal_rate", reason);
  if (reason.includes("Standard nightly rate")) return t("host_calendar_tip_standard_baseline", reason);
  return reason;
}

type SingleDatePanelView = "details" | "price" | "custom" | "minimumNights" | "cancellationPolicy";

function SingleDateManagementPanel({
  listing,
  dateKey: selectedDateKey,
  stats,
  sourceCurrency,
  saving,
  notice,
  selectedDayBookings = [],
  onSave,
  onClear,
  onContinueSelecting,
  onBulkAvailability,
}: {
  listing: ListingDTO;
  dateKey: string;
  stats: SelectedDatesStats;
  sourceCurrency: string;
  saving: boolean;
  notice: string;
  selectedDayBookings?: HostReservation[];
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
  onClear: () => void;
  onContinueSelecting?: () => void;
  onBulkAvailability?: (
    action: "BLOCK" | "UNBLOCK" | "RESTORE",
    dates: string[],
  ) => Promise<any>;
}) {
  const { formatPrice: formatMoney, displayCurrency } = useCurrency();
  const { t, language } = useLanguage();
  const [view, setView] = useState<SingleDatePanelView>("details");
  const discounts = typeof listing.discounts === "object" && listing.discounts !== null
    ? listing.discounts as Record<string, any>
    : {};
  const customPrices = typeof listing.customPrices === "object" && listing.customPrices !== null
    ? listing.customPrices as Record<string, number>
    : {};
  const customMinNights = discounts.customMinNights && typeof discounts.customMinNights === "object"
    ? discounts.customMinNights as Record<string, number>
    : {};
  const customCancellationPolicies = discounts.customCancellationPolicies && typeof discounts.customCancellationPolicies === "object"
    ? discounts.customCancellationPolicies as Record<string, string>
    : {};
  const customPrice = customPrices[selectedDateKey];
  const minimumNightsDefault = Math.max(1, Math.round(listing.minNights ?? 1));
  const minimumNightsOverride = customMinNights[selectedDateKey];
  const [priceInput, setPriceInput] = useState(
    typeof customPrice === "number" ? String(customPrice / 100) : "",
  );
  const [minimumNightsInput, setMinimumNightsInput] = useState(
    String(minimumNightsOverride ?? minimumNightsDefault),
  );
  const [policyInput, setPolicyInput] = useState(
    getCancellationPolicyForCheckIn(listing, selectedDateKey),
  );
  const [validationError, setValidationError] = useState("");
  const [viewDirection, setViewDirection] = useState<"forward" | "back">("forward");

  const datePricing = useMemo(
    () => resolveCalendarDatePricing({
      dateKey: selectedDateKey,
      listing: listing as unknown as Parameters<typeof resolveCalendarDatePricing>[0]["listing"],
    }),
    [listing, selectedDateKey],
  );
  const blocked = (listing.blockedDates || []).includes(selectedDateKey);
  const dayBookings = selectedDayBookings;
  const isReserved = dayBookings.length > 0;
  const isPast = selectedDateKey < dateKey(new Date());
  const isEditable = !isPast && !isReserved && stats.editableKeys.includes(selectedDateKey);
  const effectivePrice = datePricing.promotion?.promotionalPrice ?? datePricing.originalPrice;
  const selectedPolicy = customCancellationPolicies[selectedDateKey]
    || getCancellationPolicyForCheckIn(listing, selectedDateKey);
  const dateLabel = formatBookingDate(selectedDateKey, { locale: language || "en" });
  const rateSourceLabel = datePricing.rateSource === "CUSTOM"
    ? t("host_calendar_source_custom", "Custom price")
    : datePricing.rateSource === "WEEKEND"
      ? t("host_calendar_source_weekend", "Weekend rate")
      : t("host_calendar_source_base", "Base price");

  const savePrice = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(priceInput);
    const priceInMinorUnits = Math.round(value * 100);
    if (!Number.isFinite(value) || value <= 0 || priceInMinorUnits < 1) {
      setValidationError(t("host_calendar_err_valid_price", "Enter a valid price greater than 0."));
      return;
    }
    setValidationError("");
    const saved = await onSave({ customPrices: { ...customPrices, [selectedDateKey]: priceInMinorUnits } });
    if (saved === true) setViewDirection("back");
    if (saved === true) setView("details");
  };

  const clearPrice = async () => {
    const next = { ...customPrices };
    delete next[selectedDateKey];
    setValidationError("");
    setPriceInput("");
    const saved = await onSave({ customPrices: next });
    if (saved === true) setViewDirection("back");
    if (saved === true) setView("details");
  };

  const saveMinimumNights = async () => {
    const value = Number(minimumNightsInput);
    if (!Number.isInteger(value) || value < 1 || value > 365) {
      setValidationError(t("host_calendar_err_min_stay_range", "Enter a minimum stay between 1 and 365 nights."));
      return;
    }
    setValidationError("");
    const saved = await onSave({
      discounts: {
        ...discounts,
        customMinNights: { ...customMinNights, [selectedDateKey]: value },
      },
    });
    if (saved === true) setViewDirection("back");
    if (saved === true) setView("custom");
  };

  const resetMinimumNights = async () => {
    const next = { ...customMinNights };
    delete next[selectedDateKey];
    setMinimumNightsInput(String(minimumNightsDefault));
    const saved = await onSave({ discounts: { ...discounts, customMinNights: next } });
    if (saved === true) setViewDirection("back");
    if (saved === true) setView("custom");
  };

  const saveCancellationPolicy = async () => {
    if (!dateScopedCancellationPolicyOptions.some((policy) => policy.policyId === policyInput)) {
      setValidationError(t("host_calendar_err_cancellation_policy", "Choose a supported cancellation policy."));
      return;
    }
    setValidationError("");
    const saved = await onSave({
      discounts: {
        ...discounts,
        customCancellationPolicies: { ...customCancellationPolicies, [selectedDateKey]: policyInput },
      },
    });
    if (saved === true) setViewDirection("back");
    if (saved === true) setView("custom");
  };

  const resetCancellationPolicy = async () => {
    const next = { ...customCancellationPolicies };
    delete next[selectedDateKey];
    setPolicyInput(listing.cancellationPolicy || "FLEXIBLE");
    const saved = await onSave({ discounts: { ...discounts, customCancellationPolicies: next } });
    if (saved === true) setViewDirection("back");
    if (saved === true) setView("custom");
  };

  const toggleAvailability = async () => {
    if (!isEditable) return;
    if (onBulkAvailability) {
      await onBulkAvailability(blocked ? "UNBLOCK" : "BLOCK", [selectedDateKey]);
      return;
    }
    const nextBlocked = new Set(listing.blockedDates || []);
    if (blocked) nextBlocked.delete(selectedDateKey);
    else nextBlocked.add(selectedDateKey);
    await onSave({ blockedDates: Array.from(nextBlocked) });
  };

  const openView = (target: SingleDatePanelView) => {
    setValidationError("");
    setViewDirection("forward");
    setView(target);
  };

  const backTo = (target: SingleDatePanelView) => {
    setValidationError("");
    setViewDirection("back");
    setView(target);
  };

  const selectedHeader = (
    <div className="mb-4 hidden items-center justify-between gap-3 lg:flex">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#727272]">{t("host_calendar_selected_date", "Selected date")}</p>
        <h2 className="truncate text-lg font-medium">{dateLabel}</h2>
      </div>
      <button type="button" onClick={onClear} aria-label={t("host_calendar_clear_selection_aria", "Clear date selection")} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
        <CloseIcon className="size-4" />
      </button>
    </div>
  );

  const secondaryHeader = (title: string, parent: "details" | "custom") => (
    <div className="mb-4 flex items-center gap-3">
      <button type="button" onClick={() => backTo(parent)} aria-label={t("host_back", "Back")} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div className="min-w-0">
        <p className="truncate text-xs text-white/60">{dateLabel}</p>
        <h3 className="truncate text-lg font-medium text-white">{title}</h3>
      </div>
    </div>
  );

  const cardClass = "rounded-[22px] border border-white/[0.07] bg-[#111111] p-5 text-white shadow-[0_12px_30px_rgba(0,0,0,0.13)]";
  const actionClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-medium text-white transition-all duration-200 hover:bg-white/15 hover:shadow-[0_4px_12px_rgba(0,0,0,0.16)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none";
  const primaryActionClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-zinc-950 transition-all duration-200 hover:bg-zinc-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.18)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none";

  return (
    <div className="space-y-4 pb-4">
      {selectedHeader}
      <div
        key={view}
        className={`space-y-4 animate-in fade-in duration-200 motion-reduce:animate-none ${viewDirection === "forward" ? "slide-in-from-right-2" : "slide-in-from-left-2"}`}
      >
        {view === "details" ? (
          <>
            <section className={cardClass} aria-label={t("host_calendar_current_status", "Availability")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{isReserved ? t("host_calendar_status_reserved", { count: dayBookings.length }, "Booked") : blocked ? t("host_calendar_status_blocked", { count: 1 }, "Unavailable") : isPast ? t("host_calendar_past_date", "Past date") : t("host_calendar_status_available", { count: 1 }, "Available")}</p>
                <p className="mt-1 text-xs text-white/65">
                  {isReserved
                    ? t("host_calendar_reserved_no_edit", "This date is part of a reservation and cannot be changed.")
                    : blocked
                    ? t("host_calendar_date_blocked_message", "This date is blocked.")
                    : isPast
                      ? t("host_calendar_past_readonly", "Past dates are read-only.")
                      : t("host_calendar_date_available_message", "This date can be booked.")}
                </p>
              </div>
              <span className={`mt-1 size-2.5 shrink-0 rounded-full ${isReserved ? "bg-zinc-400" : blocked ? "bg-rose-500" : "bg-emerald-400"}`} aria-hidden="true" />
            </div>
            {dayBookings.length > 0 ? (
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                {dayBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate">{booking.guestName}</span>
                    <span className="shrink-0 text-white/60">{booking.status}</span>
                  </div>
                ))}
              </div>
            ) : isPast ? (
              <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/60">{t("host_calendar_past_readonly", "Past dates are read-only.")}</p>
            ) : (
              <button type="button" onClick={toggleAvailability} disabled={!isEditable || saving} className={`${actionClass} mt-4 w-full`}>
                {saving
                  ? t("host_calendar_saving", "Saving…")
                  : blocked
                    ? t("host_calendar_open_date", "Open date")
                    : t("host_calendar_block_date", "Block date")}
              </button>
            )}
            </section>

            <button type="button" onClick={() => openView("price")} className={`${cardClass} block w-full text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#171717] hover:shadow-[0_16px_30px_rgba(0,0,0,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 motion-reduce:transform-none motion-reduce:transition-none`}>
            <span className="block text-xs text-white/60">{datePricing.promotion?.name || rateSourceLabel}</span>
            <span className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[25px] font-medium leading-tight">{formatMoney(effectivePrice, sourceCurrency, 2)}</span>
              {datePricing.promotion?.applied && <span className="text-sm text-white/55 line-through">{formatMoney(datePricing.originalPrice, sourceCurrency, 2)}</span>}
            </span>
            <span className="mt-2 flex items-center justify-between gap-2 text-xs text-white/60">
              <span>{rateSourceLabel}</span>
              {datePricing.promotion?.applied && <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-300">-{datePricing.promotion.percentage}%</span>}
            </span>
            </button>

            <button type="button" onClick={() => openView("custom")} className={`${cardClass} flex w-full items-center justify-between gap-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#171717] hover:shadow-[0_16px_30px_rgba(0,0,0,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 motion-reduce:transform-none motion-reduce:transition-none`}>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t("host_calendar_custom_settings", "Custom settings")}</span>
              <span className="mt-1 block truncate text-xs text-white/60">
                {t("host_calendar_nights", { count: minimumNightsOverride ?? minimumNightsDefault }, `${minimumNightsOverride ?? minimumNightsDefault} nights`)} · {cancellationPolicyLabel(selectedPolicy, t)}
              </span>
            </span>
            <span className="text-xl leading-none" aria-hidden="true">+</span>
            </button>
            {onContinueSelecting && (
              <button type="button" onClick={onContinueSelecting} className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 lg:hidden">
                {t("host_calendar_select_more_dates", "Select more dates")}
              </button>
            )}
          </>
        ) : view === "price" ? (
        <section className={cardClass}>
          {secondaryHeader(t("host_calendar_nightly_price", "Nightly price"), "details")}
          <p className="text-sm font-medium">{formatMoney(effectivePrice, sourceCurrency, 2)}</p>
          {datePricing.promotion?.applied && <p className="mt-1 text-xs text-white/60">{datePricing.promotion.percentage}% · {formatMoney(datePricing.originalPrice, sourceCurrency, 2)} {t("host_calendar_original_price", "original")}</p>}
          <form onSubmit={savePrice} className="mt-4 space-y-3">
            <label htmlFor="single-date-custom-price" className="block text-xs text-white/65">{t("host_calendar_set_custom_rate", "Set custom nightly rate")} ({sourceCurrency})</label>
            <input id="single-date-custom-price" type="number" min="0.01" step="0.01" inputMode="decimal" value={priceInput} onChange={(event) => setPriceInput(event.target.value)} placeholder={String(datePricing.originalPrice / 100)} disabled={!isEditable} className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-base text-white placeholder:text-white/35 outline-none focus:border-white/50 disabled:opacity-50" />
            {customPrice !== undefined && <button type="button" onClick={clearPrice} disabled={saving || !isEditable} className={`${actionClass} w-full`}>{t("host_calendar_reset_price", "Use default price")}</button>}
            {validationError && <p role="alert" className="text-sm text-rose-300">{validationError}</p>}
            <button type="submit" disabled={saving || !isEditable || !priceInput} className={`${primaryActionClass} w-full`}>{saving ? t("host_calendar_saving", "Saving…") : t("host_calendar_save", "Save")}</button>
          </form>
        </section>
      ) : view === "custom" ? (
        <section className={cardClass}>
          {secondaryHeader(t("host_calendar_custom_settings", "Custom settings"), "details")}
          <div className="space-y-2">
            <button type="button" onClick={() => { setMinimumNightsInput(String(minimumNightsOverride ?? minimumNightsDefault)); openView("minimumNights"); }} disabled={!isEditable} className={`${actionClass} w-full justify-between`}>
              <span className="min-w-0 flex-1 truncate pr-4 text-left">{t("host_calendar_minimum_nights", "Minimum nights")}</span>
              <span className="ml-auto flex shrink-0 items-center gap-3">
                <span className="text-xs text-white/60 underline underline-offset-2">{t("host_calendar_nights", { count: minimumNightsOverride ?? minimumNightsDefault }, `${minimumNightsOverride ?? minimumNightsDefault} nights`)}</span>
                <span aria-hidden="true">+</span>
              </span>
            </button>
            <button type="button" onClick={() => { setPolicyInput(selectedPolicy); openView("cancellationPolicy"); }} disabled={!isEditable} className={`${actionClass} w-full justify-between`}>
              <span className="min-w-0 flex-1 truncate pr-4 text-left">{t("host_calendar_cancellation_policy", "Cancellation policy")}</span>
              <span className="ml-auto flex shrink-0 items-center gap-3">
                <span className="text-xs text-white/60 underline underline-offset-2">{cancellationPolicyLabel(selectedPolicy, t)}</span>
                <span aria-hidden="true">+</span>
              </span>
            </button>
          </div>
          <button type="button" onClick={() => backTo("details")} className={`${primaryActionClass} mt-4 w-full`}>{t("host_done", "Done")}</button>
          {!isEditable && <p className="mt-3 text-xs text-white/55">{t("host_calendar_past_readonly", "Past and reserved dates are read-only.")}</p>}
        </section>
      ) : view === "minimumNights" ? (
        <section className={cardClass}>
          {secondaryHeader(t("host_calendar_minimum_nights", "Minimum nights"), "custom")}
          <p className="text-sm text-white/70">{t("host_calendar_min_nights_date_scope", "This overrides the listing minimum for reservations checking in on this date.")}</p>
          <div className="mt-5 flex items-center justify-center gap-7">
            <button type="button" onClick={() => setMinimumNightsInput(String(Math.max(1, Number(minimumNightsInput) - 1)))} disabled={Number(minimumNightsInput) <= 1} aria-label={t("host_decrease", "Decrease")} className={actionClass}>−</button>
            <span className="min-w-12 text-center text-4xl font-medium">{minimumNightsInput}</span>
            <button type="button" onClick={() => setMinimumNightsInput(String(Math.min(365, Number(minimumNightsInput) + 1)))} disabled={Number(minimumNightsInput) >= 365} aria-label={t("host_increase", "Increase")} className={actionClass}>+</button>
          </div>
          <p className="mt-3 text-center text-xs text-white/55">{minimumNightsOverride ? t("host_calendar_overrides_default", { value: minimumNightsDefault }, `Overrides default of ${minimumNightsDefault} nights`) : t("host_calendar_default_value", { value: minimumNightsDefault }, `Listing default: ${minimumNightsDefault} nights`)}</p>
          {validationError && <p role="alert" className="mt-3 text-sm text-rose-300">{validationError}</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => backTo("custom")} className={`${actionClass} flex-1`}>{t("host_cancel", "Cancel")}</button>
            {minimumNightsOverride && <button type="button" onClick={resetMinimumNights} disabled={saving} className={actionClass}>{t("host_reset", "Reset")}</button>}
            <button type="button" onClick={() => void saveMinimumNights()} disabled={saving || !isEditable} className={`${primaryActionClass} flex-1`}>{t("host_save", "Save")}</button>
          </div>
        </section>
        ) : (
        <section className={cardClass}>
          {secondaryHeader(t("host_calendar_cancellation_policy", "Cancellation policy"), "custom")}
          <p className="mb-4 text-sm text-white/70">{t("host_calendar_policy_checkin_scope", "Applies to new reservations checking in on this date. Reservations of 28 nights or more use the listing’s long-term policy. Existing bookings keep their saved terms.")}</p>
          <div className="space-y-2">
            {dateScopedCancellationPolicyOptions.map((policy) => (
              <button key={policy.policyId} type="button" role="radio" aria-checked={policyInput === policy.policyId} onClick={() => setPolicyInput(policy.policyId)} className={`w-full rounded-xl border p-3 text-left transition-colors ${policyInput === policy.policyId ? "border-white bg-white/10" : "border-white/10 hover:bg-white/5"}`}>
                <span className="flex items-center justify-between gap-3 text-sm font-medium"><span>{policy.policyName.replace(/ Policy$/, "")}</span>{policyInput === policy.policyId && <span aria-hidden="true">✓</span>}</span>
                <span className="mt-1 block text-xs text-white/60">{policy.description}</span>
              </button>
            ))}
          </div>
          {validationError && <p role="alert" className="mt-3 text-sm text-rose-300">{validationError}</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => backTo("custom")} className={`${actionClass} flex-1`}>{t("host_cancel", "Cancel")}</button>
            {customCancellationPolicies[selectedDateKey] && <button type="button" onClick={resetCancellationPolicy} disabled={saving} className={actionClass}>{t("host_reset", "Reset")}</button>}
            <button type="button" onClick={() => void saveCancellationPolicy()} disabled={saving || !isEditable} className={`${primaryActionClass} flex-1`}>{t("host_save", "Save")}</button>
          </div>
        </section>
        )}
      </div>
      {notice && <p role="status" className="px-1 text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
    </div>
  );
}

function CalendarSelectionManagementPanel({
  onContinueSelecting,
  selectedDayBookings,
  ...props
}: Parameters<typeof ContextualManagementPanel>[0] & {
  onContinueSelecting?: () => void;
  selectedDayBookings?: HostReservation[];
}) {
  if (props.range.start !== props.range.end) {
    return <ContextualManagementPanel {...props} />;
  }

  return (
    <SingleDateManagementPanel
      listing={props.listing}
      dateKey={props.range.start}
      stats={props.stats}
      sourceCurrency={props.sourceCurrency}
      saving={props.saving}
      notice={props.notice}
      selectedDayBookings={selectedDayBookings || []}
      onSave={props.onSave}
      onClear={props.onClear}
      onContinueSelecting={onContinueSelecting}
      onBulkAvailability={props.onBulkAvailability}
    />
  );
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
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
  onClear: () => void;
  onPreviewPrice?: (priceInCents: number | null) => void;
  onBulkAvailability?: (
    action: "BLOCK" | "UNBLOCK" | "RESTORE",
    dates: string[],
  ) => Promise<any>;
  bookings?: HostReservation[];
}) {
  const { formatPrice: formatMoney } = useCurrency();
  const { t, language } = useLanguage();
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
  const [selectedCancellationPolicyInput, setSelectedCancellationPolicyInput] = useState("");
  const [cancellationPolicyValidationError, setCancellationPolicyValidationError] = useState("");
  const isDirty = Boolean(
    customPriceInput ||
    customMinStayInput ||
    selectedCancellationPolicyInput ||
    specialDaysDiscountInput !== String(stats.promoStats.percentage || 15),
  );

  const handleClearWithConfirm = () => {
    if (isDirty && typeof window !== "undefined") {
      if (!window.confirm(t("host_calendar_unsaved_confirm", "You have unsaved changes in this selection. Discard them?"))) {
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
  const currentCancellationOverrides = rawDiscounts.customCancellationPolicies && typeof rawDiscounts.customCancellationPolicies === "object"
    ? rawDiscounts.customCancellationPolicies as Record<string, string>
    : {};
  const defaultCancellationPolicy = listing.cancellationPolicy || "FLEXIBLE";
  const selectedCancellationPolicies = stats.editableKeys.map(
    (key) => currentCancellationOverrides[key] || defaultCancellationPolicy,
  );
  const distinctSelectedCancellationPolicies = Array.from(new Set(selectedCancellationPolicies));
  const isMixedCancellationPolicy = distinctSelectedCancellationPolicies.length > 1;

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
      setPromoValidationError(t("host_calendar_err_promo_range", "Enter a discount between 1% and 100%."));
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
            <p className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {t("host_calendar_selected_range", "Selected Range")}
            </p>
            <h2 className="truncate text-[17px] font-medium leading-tight text-[#1F1F1F] dark:text-zinc-100">
              {formattedDateRange}
            </h2>
            <p className="mt-1 truncate text-[12px] text-[#727272] dark:text-zinc-400">
              {stats.totalNights === 1
                ? t("host_calendar_night_count", { count: 1 })
                : t("host_calendar_nights_count", { count: stats.totalNights })} · {listing.title}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearWithConfirm}
            className="rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 p-1 text-[#727272] hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            aria-label={t("host_calendar_clear_selection_aria", "Clear date selection")}
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
            <span className="rounded-full bg-zinc-900 dark:bg-zinc-700 px-2.5 py-0.5 font-medium text-white">
              {t("host_calendar_reserved_protected", { count: stats.bookedCount })}
            </span>
          )}
          {stats.pastCount > 0 && (
            <span className="rounded-full bg-zinc-200 dark:bg-zinc-800 px-2.5 py-0.5 font-medium text-[#727272]">
              {t("host_calendar_past_readonly", { count: stats.pastCount })}
            </span>
          )}
        </div>
      </div>

      {/* Protected Reservations Notice */}
      {stats.bookedCount > 0 && stats.editableKeys.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200/60 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300">
          <p className="font-medium mb-0.5">{t("host_calendar_protected_reservations_title", "Protected Reservations")}</p>
          <p className="text-xs leading-relaxed">
            {t("host_calendar_protected_reservations_desc", { count: stats.bookedCount, editable: stats.editableKeys.length })}
          </p>
        </div>
      )}

      {stats.editableKeys.length === 0 && (
        <div className="rounded-xl bg-[#F3F4F5] dark:bg-zinc-800/80 p-3.5 border border-[#d7d7d7] dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300">
          <p className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">
            {t("host_calendar_confirmed_reservation_title", "Confirmed Reservation")}
          </p>
          <p className="text-[11px] leading-relaxed">
            {t("host_calendar_confirmed_reservation_desc", "All selected dates are part of an active reservation and cannot be edited.")}
          </p>
        </div>
      )}

      {/* Mode Switcher Tabs: Price vs Availability */}
      {stats.editableKeys.length > 0 && (
        <div
          role="tablist"
          aria-label={t("host_calendar_contextual_panel_mode", "Contextual panel mode")}
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
            {t("host_calendar_tab_price", "Price")}
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
            {t("host_calendar_tab_availability", "Availability")}
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
                {t("host_calendar_base_nightly_price", "Base Nightly Price")}
              </span>
              <p className="mt-2 text-[17px] font-medium leading-none text-[#1F1F1F] dark:text-zinc-100">
                {formatMoney(weekdayBasePrice, sourceCurrency, 2)} <span className="text-[13px] font-normal text-[#727272] dark:text-zinc-400">{t("host_calendar_per_night", "/ night")}</span>
              </p>
            </div>
            {weekendPrice && weekendPrice > 0 ? (
              <div className="rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70">
                <span className="block text-[13px] font-normal text-[#727272] dark:text-zinc-400">
                  {t("host_calendar_weekend_rate", "Weekend Rate")}
                </span>
                <p className="mt-2 text-[17px] font-medium leading-none text-[#1F1F1F] dark:text-zinc-100">
                  {formatMoney(weekendPrice, sourceCurrency, 2)} <span className="text-[13px] font-normal text-[#727272] dark:text-zinc-400">{t("host_calendar_per_night", "/ night")}</span>
                </p>
              </div>
            ) : null}
          </div>

          {/* Current Effective Rate for Selection */}
          <div className="rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70">
            <p className="block text-[13px] font-normal text-[#727272] dark:text-zinc-400">
              {t("host_calendar_effective_rate", "Effective Selection Rate")}
            </p>
            {stats.isMixedPrice ? (
              <div className="mt-1">
                <span className="inline-block rounded-md bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-300">
                  {t("host_calendar_mixed_rates", "Mixed Rates")}
                </span>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {formatMoney(stats.minPrice ?? 0, sourceCurrency, 2)} –{" "}
                  {formatMoney(stats.maxPrice ?? 0, sourceCurrency, 2)}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoney(stats.commonPrice ?? 0, sourceCurrency, 2)}{" "}
                <span className="text-xs font-normal text-[#727272] dark:text-zinc-400">{t("host_calendar_per_night", "/ night")}</span>
              </p>
            )}
          </div>

          {/* Phase 14 & Phase 20: Advisory Price Tip Recommendation Card */}
          {priceTipsResult && priceTipsResult.applicableCount > 0 && (
            <div className="space-y-3 rounded-[12px] bg-[#FEF3D7] border border-white p-4 shadow-[0_2px_4px_0px_#00000040] dark:border-amber-800 dark:bg-amber-950/40">
              <div className="flex items-start flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <svg
                    className="size-4.5 text-amber-900 dark:text-amber-200 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                  <span className="text-sm font-medium text-amber-950 dark:text-amber-200">
                    {t("host_calendar_price_tip_recommendation", "Price Tip Recommendation")}
                  </span>
                </div>
                {priceTipsResult.overallAction === "INCREASE" ? (
                  <span className="rounded-md bg-amber-200 dark:bg-amber-900/80 px-2 py-1 text-xs mt-3 font-medium text-amber-950 dark:text-amber-200">
                    {t("host_calendar_demand_surge", "Demand Surge")}
                  </span>
                ) : priceTipsResult.overallAction === "DECREASE" ? (
                    <span className="rounded-md bg-blue-100 dark:bg-blue-950 px-2 py-1 text-xs font-medium mt-3 text-blue-900 dark:text-blue-200">
                    {t("host_calendar_booking_incentive", "Booking Incentive")}
                  </span>
                ) : priceTipsResult.overallAction === "NO_CHANGE" ? (
                  <span className="rounded-md bg-emerald-100 dark:bg-emerald-950 px-2 py-1 text-xs font-medium text-emerald-900 dark:text-emerald-200 mt-3">
                    {t("host_calendar_optimal", "Optimal")}
                  </span>
                ) : (
                        <span className="rounded-md bg-zinc-200 dark:bg-zinc-800 px-2 py-1 text-xs mt-3 font-medium text-zinc-700 dark:text-zinc-300">
                    {t("host_calendar_advisory", "Advisory")}
                  </span>
                )}
              </div>

              {/* Price comparison */}
              <div className="flex items-baseline justify-between pt-0.5 gap-2">
                <div>
                  <span className="text-xs text-[#727272] dark:text-zinc-400 block font-normal">
                    {t("host_calendar_current_rate", "Current rate")}
                  </span>
                  <span className="text-sm font-medium text-[#1F1F1F] dark:text-zinc-200">
                    {formatMoney(priceTipsResult.averageCurrentPrice, sourceCurrency, 2)}
                    <span className="text-[10px] font-normal text-[#727272]"> {t("host_calendar_per_night", "/ night")}</span>
                  </span>
                </div>
                {priceTipsResult.overallAction !== "NO_CHANGE" && priceTipsResult.overallAction !== "INSUFFICIENT_DATA" && (
                  <span className="text-sm text-[#727272]">→</span>
                )}
                <div className="text-right">
                  <span className="text-xs font-normal text-[#727272] dark:text-zinc-400 block">
                    {priceTipsResult.overallAction === "NO_CHANGE"
                      ? t("host_calendar_recommended", "Recommended")
                      : priceTipsResult.overallAction === "INSUFFICIENT_DATA"
                        ? t("host_calendar_active_rate", "Active rate")
                        : t("host_calendar_suggested", "Suggested")}
                  </span>
                  <span className="text-sm font-medium text-[#1F1F1F] dark:text-zinc-100">
                    {formatMoney(priceTipsResult.averageSuggestedPrice, sourceCurrency, 2)}
                    <span className="text-[10px] font-normal text-[#727272]"> {t("host_calendar_per_night", "/ night")}</span>
                  </span>
                </div>
              </div>

              {/* Multi-date breakdown summary if applicable */}
              {priceTipsResult.applicableCount > 1 && (
                <div className="flex items-center justify-between rounded-xl border border-[#F5D98C]/70 bg-white/70 p-2.5 text-[12px] text-[#5F5F5F] dark:border-amber-900/40 dark:bg-zinc-900/60 dark:text-zinc-300">
                  <span>{t("host_calendar_nights_selected", { count: priceTipsResult.applicableCount })}</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {priceTipsResult.increaseCount > 0 ? `${priceTipsResult.increaseCount} ${t("host_calendar_price_tips_increase", "increase")} ` : ""}
                    {priceTipsResult.decreaseCount > 0 ? `${priceTipsResult.decreaseCount} ${t("host_calendar_price_tips_decrease", "decrease")} ` : ""}
                    {priceTipsResult.noChangeCount > 0 ? `${priceTipsResult.noChangeCount} ${t("host_calendar_price_tips_optimal_count", "optimal")}` : ""}
                  </span>
                </div>
              )}

              {/* Reasons list */}
              <div className="space-y-1.5 text-xs leading-normal text-[#5F5F5F] dark:text-zinc-300">
                {priceTipsResult.reasons.map((r, idx) => (
                  <p key={idx} className="flex items-start gap-1.5 leading-5">
                    <span className="text-[#727272] font-medium shrink-0">•</span> <span>{getLocalizedReason(r, t)}</span>
                  </p>
                ))}
              </div>

              {/* Action bar with difference and Apply button */}
              <div className="flex items-center justify-between border-t border-[#d7d7d7] pt-3 dark:border-amber-900/60">
                <span className="text-sm font-medium text-[#f1f1f1f] dark:text-zinc-400">
                  {priceTipsResult.averageDifference !== 0
                    ? `${priceTipsResult.averageDifference > 0 ? "+" : ""}${formatMoney(priceTipsResult.averageDifference, sourceCurrency, 2)} (${priceTipsResult.averagePercentChange > 0 ? "+" : ""}${priceTipsResult.averagePercentChange}%)`
                    : priceTipsResult.overallAction === "INSUFFICIENT_DATA"
                      ? t("host_calendar_no_adj_rec", "No adjustment recommended")
                      : t("host_calendar_matches_curr_rate", "Matches current rate")}
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
                    className="cursor-pointer rounded-full hover:bg-[#FCDF9C] px-3.5 py-2 text-[12px] font-medium hover:text-[#1F1F1F] text-white transition-colors duration-300 bg-[#1f1f1f] disabled:opacity-70"
                  >
                    {saving
                      ? t("host_calendar_saving", "Applying…")
                      : priceTipsResult.applicableCount > 1
                        ? t("host_calendar_apply_to_dates", { count: priceTipsResult.increaseCount + priceTipsResult.decreaseCount })
                        : t("host_calendar_apply_tip", "Apply tip")}
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-[#727272] dark:text-zinc-400 italic">
                    {priceTipsResult.overallAction === "NO_CHANGE"
                      ? t("host_calendar_already_optimal", "Already optimal")
                      : t("host_calendar_manual_active", "Manual rate active")}
                  </span>
                )}
              </div>

              <p className="text-xs leading-normal text-[#727272] dark:text-[#727272]">
                {t("host_calendar_price_tips_disclaimer", priceTipsResult.marketDataNote)}
              </p>
            </div>
          )}

          {/* Set Custom Price Form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const val = Number(customPriceInput);
              if (!Number.isFinite(val) || val <= 0) {
                setValidationError(t("host_calendar_err_valid_price", "Please enter a valid price greater than 0."));
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
                className="block font-normal text-[#1F1F1F] dark:text-zinc-200 text-base mb-3"
              >
                {t("host_calendar_set_custom_rate", "Set custom nightly rate")}
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
                  {saving ? t("host_calendar_saving", "Saving…") : t("host_calendar_apply", "Apply")}
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
                {t("host_calendar_reset_base_rates", "Reset to base rates")}
              </button>
            </div>

          </form>

          {/* Selected-date promotion */}
          <div className="space-y-3 rounded-[12px] border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30 shadow-[0_2px_4px_0px_#00000040]">
            <div className="flex flex-col items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <svg
                  className="size-5 text-emerald-700 dark:text-emerald-300 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6" />
                  <path d="M9 9h.01" />
                  <path d="M15 15h.01" />
                </svg>
                <span className="font-medium text-base text-emerald-900 dark:text-emerald-200">
                  {t("host_calendar_special_days_discount", "Special days discount")}
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
                    <span className="text-zinc-600 dark:text-zinc-400">{t("host_cal_promo_eligibility", "Promotion eligibility")}</span>
                    <span className="font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded-full text-[10px]">
                      {t("host_calendar_promo_mixed", "Promotion: Mixed")}
                    </span>
                  </div>

                  <div className="rounded-lg bg-white/80 dark:bg-zinc-900/60 p-2.5 space-y-1.5 border border-emerald-100 dark:border-emerald-900/40 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {t("host_calendar_promo_eligible", { count: stats.promoStats.eligibleCount })}
                      </span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        −{stats.promoStats.percentage}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {t("host_calendar_regular_price", { count: stats.promoStats.ineligibleCount })}
                      </span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {t("host_calendar_regular_price", "Regular price")}
                      </span>
                    </div>
                    {stats.promoStats.dateRangeText && (
                      <div className="flex justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-[#727272]">
                        <span>{t("host_calendar_eligible_window", "Eligible window:")}</span>
                        <span>{stats.promoStats.dateRangeText}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span>{t("host_calendar_avg_nightly_rate", "Average nightly rate")}</span>
                      <span>{formatMoney(stats.promoStats.avgOriginalPrice, sourceCurrency, 2)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-zinc-900 dark:text-zinc-100">
                      <span>{t("host_calendar_guest_price_after_promo", "Guest price after promotion")}</span>
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {formatMoney(stats.promoStats.avgGuestPrice, sourceCurrency, 2)}{" "}
                        <span className="text-[10px] font-normal text-[#727272]">avg {t("host_calendar_per_night", "/ night")}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : stats.promoStats.allEligible ? (
                /* All selected dates are promotion eligible */
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>{t("host_calendar_base_nightly_price", "Nightly rate")}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {stats.isMixedPrice
                        ? `${formatMoney(stats.minPrice ?? 0, sourceCurrency, 2)} – ${formatMoney(stats.maxPrice ?? 0, sourceCurrency, 2)}`
                        : formatMoney(stats.commonPrice ?? 0, sourceCurrency, 2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                    <span>{t("host_calendar_special_days_discount", "Special days discount")}</span>
                    <span>−{stats.promoStats.percentage}%</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-200/60 dark:border-emerald-900/40 pt-1.5 font-medium text-zinc-900 dark:text-zinc-100 gap-2">
                    <span>{t("host_calendar_guest_price_after_promo", "Guest price after promotion")}</span>
                      <span className="text-emerald-700 dark:text-emerald-400 text-right">
                      {stats.isMixedPrice
                        ? `${formatMoney(stats.promoStats.minGuestPrice ?? 0, sourceCurrency, 2)} – ${formatMoney(stats.promoStats.maxGuestPrice ?? 0, sourceCurrency, 2)}`
                        : formatMoney(stats.promoStats.commonGuestPrice ?? 0, sourceCurrency, 2)}{" "}
                      <span className="text-[10px] font-normal text-[#727272]">{t("host_calendar_per_night", "/ night")}</span>
                    </span>
                  </div>
                </div>
              ) : (
                /* Selected dates are outside promotion window */
                <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {t("host_calendar_outside_promo_window", "Selected dates are outside active promotion window.")}
                  </p>
                  {stats.promoStats.dateRangeText && (
                    <p className="text-[11px] text-[#727272] dark:text-zinc-400">
                      {t("host_calendar_eligible_window", "Promotion window:")} {stats.promoStats.dateRangeText}
                    </p>
                  )}
                  <p className="text-[11px] text-[#727272]">
                    {t("host_calendar_guests_pay_regular", "Guests pay regular rate:")}{" "}
                    {stats.isMixedPrice
                      ? `${formatMoney(stats.minPrice ?? 0, sourceCurrency, 2)} – ${formatMoney(stats.maxPrice ?? 0, sourceCurrency, 2)}`
                      : formatMoney(stats.commonPrice ?? 0, sourceCurrency, 2)}{" "}
                    {t("host_calendar_per_night", "/ night")}
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-2.5">
                <p className="text-sm leading-normal text-[#727272] dark:text-zinc-400">
                  {stats.totalNights === 1
                    ? t("host_calendar_add_discount_selected_single", "Add a discount only to the selected date.")
                    : t("host_calendar_add_discount_selected_plural", "Add a discount only to the selected dates.")}
                </p>
                <div className="flex items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="block text-sm mb-2 font-normal text-[#1f1f1f] dark:text-zinc-400">
                      {t("host_calendar_discount_pct_label", "Discount percentage")}
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
                        aria-label={t("host_calendar_aria_promo_discount", "Special days discount percentage")}
                        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#1f1f1f] outline-none dark:text-zinc-100"
                      />
                      <span className="text-sm font-medium text-[#727272]">%</span>
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveSpecialDaysDiscount}
                    className="h-[40px] shrink-0 rounded-full bg-emerald-600 px-4 text-[12px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? t("host_calendar_saving", "Applying…") : t("host_calendar_apply", "Apply to dates")}
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
                {t("host_calendar_applies_only_to", "Applies only to:")}{" "}
                <strong className="text-[#1f1f1f] font-medium dark:text-zinc-200">{formattedDateRange}</strong>
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
          <details className="group rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-[#F3F4F5] dark:bg-zinc-800/40 overflow-hidden transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 transition-colors [&::-webkit-details-marker]:hidden">
              <span className="text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
                {t("host_calendar_discounts_additional_charges", "Discounts & Additional Charges")}
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
            <div className="border-t border-[#d7d7d7]/80 dark:border-zinc-700/80 p-3.5 space-y-2 bg-white/70 dark:bg-zinc-900/40 text-sm text-[#727272] dark:text-zinc-300">
              <div className="flex justify-between items-center">
                <span>{t("host_calendar_weekly_discount_label", "Weekly discount (7+ nights)")}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{weeklyPct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t("host_calendar_monthly_discount_label", "Monthly discount (28+ nights)")}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{monthlyPct}%</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                <span>{t("host_calendar_extra_guest_fee_label", "Extra guest fee")}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {listing.extraGuestFee && listing.extraGuestFee > 0
                    ? `${formatMoney(listing.extraGuestFee, sourceCurrency, 2)} ${t("host_calendar_per_guest_per_night", "/ guest / night")}`
                    : t("host_calendar_none", "None")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t("host_calendar_cleaning_fee_label", "Cleaning fee")}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {listing.cleaningFee && listing.cleaningFee > 0
                    ? formatMoney(listing.cleaningFee, sourceCurrency, 2)
                    : t("host_calendar_none", "None")}
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
          <div className="rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70">
            <p className="block text-[13px] font-normal text-[#727272] dark:text-zinc-400">
              {t("host_calendar_current_status", "Current Status")}
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
                  ? t("host_calendar_status_mixed", {
                    available: stats.availableCount,
                    blocked: stats.blockedCount,
                  })
                  : stats.commonAvailability === "available"
                    ? t("host_calendar_status_available", { count: stats.availableCount })
                    : stats.commonAvailability === "blocked"
                      ? t("host_calendar_status_blocked", { count: stats.blockedCount })
                      : t("host_calendar_status_reserved", { count: stats.bookedCount })}
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
                {t("host_calendar_make_available", "Make available")}
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
                {t("host_calendar_block_dates", "Block dates")}
              </button>
            </div>

            {/* Undo Toast / Banner */}
            {lastUndo && (
              <div className="mt-2 flex items-center justify-between rounded-xl bg-zinc-900 text-white dark:bg-[#F3F4F5] dark:text-zinc-900 p-2.5 text-xs font-medium animate-in fade-in duration-200">
                <span className="truncate mr-2">
                  {lastUndo.action === "BLOCK"
                    ? t("host_calendar_undo_blocked", { count: lastUndo.affectedCount }, "{count} dates blocked")
                    : t("host_calendar_undo_available", { count: lastUndo.affectedCount }, "{count} dates made available")}
                  {lastUndo.protectedCount > 0
                    ? ` ${t("host_calendar_reserved_unchanged", { count: lastUndo.protectedCount }, "({count} reserved unchanged)")}`
                    : ""}.
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
                  {t("host_calendar_undo", "Undo")}
                </button>
              </div>
            )}
          </div>

          {/* Phase 11: Selected-Date Minimum Stay Override */}
          <div className="rounded-[12px] border border-white bg-[#F3F4F5] px-4 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70 space-y-3">
            <div className="flex flex-col items-start gap-3">
              <span className="block text-base font-normal text-[#1f1f1f] dark:text-zinc-400">
                {t("host_calendar_min_stay_override", "Minimum Stay Override")}
              </span>
              {stats.isMixedMinStay ? (
                <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {t("host_calendar_mixed_stays", "Mixed stays")}
                </span>
              ) : (
                  <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {t("host_calendar_nights", { count: stats.commonMinStay ?? listing.minNights ?? 1 })}
                </span>
              )}
            </div>

            <p className="text-xs text-[#727272] dark:text-zinc-400">
              {t("host_calendar_min_stay_selected_helper", "Set a required minimum stay for guests booking during these selected dates.")}
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const minStay = Number(customMinStayInput);
                if (!Number.isFinite(minStay) || minStay < 1 || minStay > 365) {
                  setMinStayValidationError(t("host_calendar_err_min_stay_range", "Please enter a valid minimum stay between 1 and 365 nights."));
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
                    {t("host_nights", "Nights")}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={saving || !customMinStayInput}
                  className="rounded-full bg-[#1f1f1f] hover:bg-[#727272] text-white dark:bg-[#F3F4F5] dark:hover:bg-white dark:text-zinc-900 px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 shrink-0 shadow-xs"
                >
                  {t("host_calendar_apply_min_stay", "Apply min stay")}
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
              {t("host_calendar_reset_property_default", { count: listing.minNights ?? 1 })}
            </button>
          </div>

          {stats.editableKeys.length > 0 && (
            <section className="space-y-3 rounded-[12px] border border-white bg-[#F3F4F5] px-4 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70">
              <div>
                <h3 className="text-base font-normal text-[#1f1f1f] dark:text-zinc-100">{t("host_calendar_cancellation_policy_override", "Cancellation policy override")}</h3>
                <p className="mt-1 text-xs text-[#727272] dark:text-zinc-400">
                  {t("host_calendar_policy_checkin_scope", "Applies to new reservations checking in on these dates. Confirmed stays keep their saved terms.")}
                </p>
              </div>
              <p className="text-xs font-medium text-[#1f1f1f] dark:text-zinc-200">
                {isMixedCancellationPolicy
                  ? t("host_calendar_mixed_policies", "Mixed cancellation policies")
                  : t("host_calendar_current_policy", { policy: selectedCancellationPolicies[0] || defaultCancellationPolicy }, `Current: ${selectedCancellationPolicies[0] || defaultCancellationPolicy}`)}
              </p>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <select
                  value={selectedCancellationPolicyInput || (isMixedCancellationPolicy ? "" : (selectedCancellationPolicies[0] === defaultCancellationPolicy ? "__DEFAULT__" : selectedCancellationPolicies[0] || "__DEFAULT__"))}
                  onChange={(event) => {
                    setSelectedCancellationPolicyInput(event.target.value);
                    setCancellationPolicyValidationError("");
                  }}
                  aria-label={t("host_calendar_cancellation_policy", "Cancellation policy")}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#727272] bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {isMixedCancellationPolicy && <option value="">{t("host_calendar_mixed_values", "Mixed values")}</option>}
                  <option value="__DEFAULT__">{t("host_calendar_use_listing_default", "Use listing default")} ({defaultCancellationPolicy})</option>
                  {dateScopedCancellationPolicyOptions.map((policy) => (
                    <option key={policy.policyId} value={policy.policyId}>{policy.policyName.replace(/ Policy$/, "")}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={saving || !selectedCancellationPolicyInput}
                  onClick={async () => {
                    const policy = selectedCancellationPolicyInput;
                    if (policy !== "__DEFAULT__" && !dateScopedCancellationPolicyOptions.some((option) => option.policyId === policy)) {
                      setCancellationPolicyValidationError(t("host_calendar_err_cancellation_policy", "Choose a supported cancellation policy."));
                      return;
                    }
                    if (typeof window !== "undefined" && !window.confirm(t("host_calendar_confirm_policy_bulk", { count: stats.editableKeys.length }, `Apply this policy to ${stats.editableKeys.length} eligible check-in dates?`))) return;
                    const nextOverrides = { ...currentCancellationOverrides };
                    for (const key of stats.editableKeys) {
                      if (policy === "__DEFAULT__") delete nextOverrides[key];
                      else nextOverrides[key] = policy;
                    }
                    setCancellationPolicyValidationError("");
                    await onSave({ discounts: { ...rawDiscounts, customCancellationPolicies: nextOverrides } });
                    setSelectedCancellationPolicyInput("");
                  }}
                  className="min-h-11 rounded-full bg-[#1f1f1f] px-4 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#F3F4F5] dark:text-zinc-900 dark:hover:bg-white"
                >
                  {saving ? t("host_calendar_saving", "Saving…") : t("host_calendar_apply", "Apply")}
                </button>
              </div>
              {cancellationPolicyValidationError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{cancellationPolicyValidationError}</p>}
              <p className="text-[11px] text-[#727272] dark:text-zinc-400">
                {t("host_calendar_policy_dates_skipped", { protected: stats.bookedCount, past: stats.pastCount }, `${stats.bookedCount} reserved and ${stats.pastCount} past dates are excluded.`)}
              </p>
            </section>
          )}

          {/* Phase 11: Property Availability Rules (Collapsible) */}
          <details className="group rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-[#F3F4F5] dark:bg-zinc-800/40 overflow-hidden transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 transition-colors [&::-webkit-details-marker]:hidden">
              <span className="text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
                {t("host_calendar_property_availability_rules", "Property Availability Rules")}
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
                <span>{t("host_calendar_default_min_stay", "Default minimum stay")}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 text-right">
                  {t("host_calendar_nights", { count: listing.minNights ?? 1 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t("host_calendar_max_stay", "Maximum stay")}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 text-right">
                  {listing.maxNights ? t("host_calendar_nights", { count: listing.maxNights }) : t("host_calendar_no_limit", "No limit")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t("host_calendar_advance_notice", "Advance notice")}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 text-right">
                  {t("host_calendar_hours", { count: (listing as any).advanceNotice ?? 0 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t("host_calendar_same_day_requests", "Same-day requests")}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 text-right">
                  {(listing as any).allowSameDayRequests
                    ? t("host_calendar_allowed_until", { time: (listing as any).sameDayCutoff ?? "18:00" })
                    : t("host_calendar_not_allowed", "Not allowed")}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                <span>{t("host_calendar_guest_capacity", "Guest capacity")}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 text-right">
                  {t("host_calendar_guests_max", { count: listing.guests })}
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
          {t("host_calendar_cancel_clear", "Cancel & Clear Selection")}
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
  const { t } = useLanguage();
  const activeBookingsCount = bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "PENDING",
  ).length;

  return (
    <div className="space-y-4 text-[#1F1F1F] dark:text-zinc-100">
      <div>
        <h2 className="text-sm font-medium text-[#1F1F1F] dark:text-zinc-100">
          {t("host_calendar_portfolio_overview", "Portfolio Overview")}
        </h2>
        <p className="mt-0.5 text-[11px] leading-4 text-[#727272]">
          {t("host_calendar_portfolio_desc", "Manage and monitor all your properties in one place.")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#e8e9ec] bg-[#f7f8fa] p-2.5 dark:border-zinc-700 dark:bg-zinc-800/80">
          <p className="text-[9px] font-medium uppercase tracking-wider text-[#727272]">
            {t("host_calendar_listings_stat", "Listings")}
          </p>
          <p className="mt-0.5 text-xl font-medium">{listings.length}</p>
        </div>
        <div className="rounded-xl border border-[#e8e9ec] bg-[#f7f8fa] p-2.5 dark:border-zinc-700 dark:bg-zinc-800/80">
          <p className="text-[9px] font-medium uppercase tracking-wider text-[#727272]">
            {t("host_calendar_active_stays_stat", "Active Stays")}
          </p>
          <p className="mt-0.5 text-xl font-medium">{activeBookingsCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[#555b64]">
          {t("host_calendar_select_property_edit", "Select property to edit rates:")}
        </p>
        <div className="space-y-1.5 max-h-[min(52vh,420px)] overflow-y-auto pr-1 calendar-panel-scrollbar">
          {listings.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onSelectListing(l.id)}
              title={l.title}
              className="flex w-full items-center gap-2 rounded-lg border border-[#e5e6e9] p-2 text-left transition-colors hover:border-[#c9c4ed] hover:bg-[#faf9ff] dark:border-zinc-700 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <PropertyPhoto
                listing={l}
                className="size-9 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-[#1F1F1F] dark:text-zinc-100">
                  {l.title}
                </p>
                <p className="truncate text-[10px] text-[#727272]">
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
  const { t, language } = useLanguage();
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
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(() =>
    initialListings.map((listing) => listing.id),
  );

  // Initialize month from initialMonth / searchParams or current date
  const defaultMonth = useMemo(() => {
    const requested = initialMonth || searchParams?.get("month");
    const parsed = parseMonthKey(requested);
    if (parsed) return parsed;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [initialMonth, searchParams]);

  const [month, setMonth] = useState<Date>(defaultMonth);
  const [calendarNavigationKey, setCalendarNavigationKey] = useState(0);
  const calendarScrollRef = useRef<HTMLDivElement>(null);

  // Initialize view from initialView / searchParams or default to "month"
  const defaultView = useMemo<CalendarView>(() => {
    const requested = initialView || searchParams?.get("view");
    return requested === "year" || requested === "list" ? requested : "month";
  }, [initialView, searchParams]);

  const [view, setView] = useState<CalendarView>(defaultView);

  // Range & Date Selection state
  const [selection, setSelection] = useState<CalendarSelection>({
    start: null,
    end: null,
    isDragging: false,
  });
  const dragSelectionChangedRef = useRef(false);
  const [focusedDateKey, setFocusedDateKey] = useState<string | null>(null);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);

  // UI state
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [pickerYear, setPickerYear] = useState(month.getFullYear());
  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMonthDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        monthDropdownRef.current &&
        !monthDropdownRef.current.contains(e.target as Node)
      ) {
        setShowMonthDropdown(false);
      }
    }
    function handleEscape(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setShowMonthDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMonthDropdown]);
  const [mobilePropertySelectorOpen, setMobilePropertySelectorOpen] =
    useState(false);
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [mobileCalendarSettingsOpen, setMobileCalendarSettingsOpen] = useState(false);
  const [mobileSelectionMode, setMobileSelectionMode] =
    useState<MobileDateSelectionMode>("idle");
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

  const selectedBookingListing = useMemo(
    () => selectedBooking
      ? listings.find((listing) => listing.id === selectedBooking.listingId) || null
      : null,
    [listings, selectedBooking],
  );

  const sourceCurrency = selectedListing
    ? resolvePropertyCurrency(selectedListing)
    : "SAR";

  // Keep pickerYear in sync when month changes
  useEffect(() => {
    setPickerYear(month.getFullYear());
  }, [month]);

  // Deep-linking URL synchronization (refresh-safe, back/forward-safe)
  const syncUrl = useCallback(
    (newListingId: string, newMonth: Date, newView: CalendarView) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams();
      if (newListingId) params.set("listingId", newListingId);
      params.set("month", formatMonthKey(newMonth));
      if (newView !== "month") params.set("view", newView);

      const newUrl = `${pathname}?${params.toString()}`;
      if (`${window.location.pathname}${window.location.search}` === newUrl) return;
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
      if (reqView === "list" || reqView === "year" || reqView === "month") setView(reqView);
      setSelection({ start: null, end: null, isDragging: false });
      setMobileSelectionMode("idle");
      setMobileSettingsOpen(false);
      setMobileCalendarSettingsOpen(false);
      setPreviewPrice(null);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [listings]);

  // Handle property selection change: resets selection safely
  const handleSelectProperty = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (id === "all") setSelectedPropertyIds(listings.map((listing) => listing.id));
      setSelection({ start: null, end: null, isDragging: false });
      setMobileSelectionMode("idle");
      setMobileSettingsOpen(false);
      setMobileCalendarSettingsOpen(false);
      setPreviewPrice(null);
      setSelectedBooking(null);
      setAllListingsDayBookings(null);
      setMobilePropertySelectorOpen(false);
      syncUrl(id, month, view);
    },
    [month, view, syncUrl, listings],
  );

  const toggleAllPropertySelection = useCallback((id: string) => {
    setSelectedPropertyIds((current) => {
      if (current.includes(id)) {
        return current.length > 1 ? current.filter((propertyId) => propertyId !== id) : current;
      }
      return [...current, id];
    });
  }, []);

  const visibleAllListings = useMemo(
    () => listings.filter((listing) => selectedPropertyIds.includes(listing.id)),
    [listings, selectedPropertyIds],
  );

  // Handle month change: resets selection safely if in single month view
  const handleSelectMonth = useCallback(
    (newMonth: Date) => {
      setMonth(newMonth);
      setCalendarNavigationKey((key) => key + 1);
      setSelection({ start: null, end: null, isDragging: false });
      setMobileSelectionMode("idle");
      setMobileSettingsOpen(false);
      setMobileCalendarSettingsOpen(false);
      setPreviewPrice(null);
      syncUrl(selectedId, newMonth, view);
    },
    [selectedId, view, syncUrl],
  );

  // Handle view switch
  const handleSelectView = useCallback(
    (newView: CalendarView) => {
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
    setMobileSelectionMode("idle");
    setMobileSettingsOpen(false);
    setPreviewPrice(null);
    setCalendarNavigationKey((key) => key + 1);
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
    setMobileSelectionMode("idle");
    setMobileSettingsOpen(false);
    setPreviewPrice(null);
    setCalendarNavigationKey((key) => key + 1);
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
    setMobileSelectionMode("idle");
    setMobileSettingsOpen(false);
    setPreviewPrice(null);
    setCalendarNavigationKey((key) => key + 1);
    const now = new Date();
    const todayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    setMonth(todayMonth);
    syncUrl(selectedId, todayMonth, view);
  }, [selectedId, view, syncUrl]);

  // Scrolling changes the toolbar context and URL, but intentionally does not
  // trigger navigation or reset a selected range. This separation prevents the
  // common scroll-to-month feedback loop.
  const handleVisibleMonthChange = useCallback(
    (visibleMonth: Date) => {
      if (formatMonthKey(visibleMonth) === formatMonthKey(month)) return;
      setMonth(visibleMonth);
      syncUrl(selectedId, visibleMonth, view);
    },
    [month, selectedId, syncUrl, view],
  );

  // Precompute O(1) lookups for active bookings, blocked dates, custom prices
  const { bookingsByDate, bookingRanges } = useMemo(() => {
    const map = new Map<string, HostReservation[]>();
    const ranges: Array<{
      booking: HostReservation;
      start: string;
      end: string;
    }> = [];

    const scopedListingIds = isAllListings
      ? new Set(visibleAllListings.map((listing) => listing.id))
      : selectedListing ? new Set([selectedListing.id]) : new Set<string>();

    for (const span of buildHostCalendarReservationSpans(
      bookings,
      "1900-01-01",
      "2200-01-01",
      scopedListingIds,
    )) {
      const { booking: b, start, end } = span;
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
  }, [bookings, isAllListings, selectedListing?.id, visibleAllListings]);

  const blockedDatesSet = useMemo(() => {
    if (!selectedListing) return new Set<string>();
    return new Set<string>(selectedListing.blockedDates || []);
  }, [selectedListing]);

  const normalizedSelectedRange = useMemo(
    () => getNormalizedRange(selection),
    [selection],
  );

  // The compact (<lg) workspace has two deliberate selection experiences:
  // a single-date sheet by default, and an explicit multi-date toolbar.
  const openMobileSettings = () => {
    if (normalizedSelectedRange) {
      setMobileSelectionMode(
        normalizedSelectedRange.start === normalizedSelectedRange.end
          ? "single-date"
          : "multi-select",
      );
      setMobileSettingsOpen(true);
      return;
    }
    setMobileSettingsOpen(true);
  };

  const openMobileCalendarSettings = () => {
    setMobileSettingsOpen(false);
    setMobileCalendarSettingsOpen(true);
  };

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
        // and clear any previous editable-range treatment behind it.
        setSelection({ start: null, end: null, isDragging: false });
        setMobileSelectionMode("idle");
        setMobileSettingsOpen(false);
        setPreviewPrice(null);
        setSelectedBooking(booking);
        return;
      }

      const isCompactCalendar = window.matchMedia("(max-width: 1023px)").matches;

      if (dragSelectionChangedRef.current) {
        dragSelectionChangedRef.current = false;
        setFocusedDateKey(key);
        if (isCompactCalendar) {
          // A drag is an intentional range gesture, so use the bulk toolbar
          // rather than opening the single-date sheet.
          setMobileSelectionMode("multi-select");
          setMobileSettingsOpen(false);
        }
        return;
      }

      if (isCompactCalendar) {
        if (mobileSelectionMode === "multi-select") {
          setSelection((prev) => ({
            start: prev.start || key,
            end: key,
            isDragging: false,
          }));
          setFocusedDateKey(key);
          return;
        }

        // A normal compact-screen tap always opens the date-management sheet.
        // It does not infer bulk-selection mode from a one-day range.
        setSelection({ start: key, end: key, isDragging: false });
        setFocusedDateKey(key);
        setMobileSelectionMode("single-date");
        setMobileSettingsOpen(true);
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
    [isAllListings, mobileSelectionMode, selection.start, selection.end],
  );

  const handleDayPointerDown = useCallback(
    (key: string, e: ReactPointerEvent) => {
      if (isAllListings || e.button !== 0) return;
      const dayBookings = bookingsByDate.get(key) || [];
      if (dayBookings.length > 0) return; // Reservations don't initiate drag selection

      setNotice("");
      const rangeAnchor = selection.start && selection.end === null
        ? selection.start
        : key;
      dragSelectionChangedRef.current = rangeAnchor !== key;
      setSelection({
        start: rangeAnchor,
        end: key,
        isDragging: true,
      });
      setFocusedDateKey(key);
    },
    [isAllListings, bookingsByDate, selection.start, selection.end],
  );

  const handleDayPointerEnter = useCallback(
    (key: string) => {
      if (!selection.isDragging || !selection.start) return;
      if (key !== selection.start) dragSelectionChangedRef.current = true;
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
  async function save(values: Record<string, unknown>): Promise<boolean> {
    if (!selectedListing || saving) return false;
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
        setNotice(t("host_calendar_notice_saved", "Changes saved."));
        return true;
      } else {
        setNotice(result.error || t("host_calendar_notice_could_not_save", "Could not save."));
        return false;
      }
    } catch {
      setNotice(t("host_calendar_notice_save_err", "Could not save your changes. Please try again."));
      return false;
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
        setNotice(result.error || t("host_calendar_notice_avail_err", "Could not update availability."));
        return null;
      }
      setSavedListings((current) => ({
        ...current,
        [targetListingId]: result.data.listing,
      }));
      if (action === "RESTORE") {
        setNotice(t("host_calendar_notice_restored", "Restored previous availability."));
      } else {
        const actionWord =
          action === "BLOCK"
            ? t("host_calendar_undo_blocked", { count: result.data.affectedCount }, "{count} dates blocked")
            : t("host_calendar_undo_available", { count: result.data.affectedCount }, "{count} dates made available");
        const protectedPart =
          result.data.protectedCount > 0
            ? ` ${t("host_calendar_reserved_unchanged", { count: result.data.protectedCount }, "({count} reserved unchanged)")}`
            : "";
        const newlyBookedPart =
          result.data.newlyBookedCount > 0
            ? ` ${t("host_calendar_newly_booked_protected", { count: result.data.newlyBookedCount }, "Note: {count} newly confirmed reservation was protected.")}`
            : "";
        setNotice(
          `${actionWord}${protectedPart}.${newlyBookedPart}`,
        );
      }
      return result.data;
    } catch {
      setNotice(t("host_calendar_notice_avail_try_again", "Could not update availability. Please try again."));
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
          <h1 className="mt-6">
            {t("host_calendar_empty_title", "You don't have any listings yet")}
          </h1>
          <p className="mt-3 max-w-md text-sm text-[#727272]">
            {t("host_calendar_empty_desc", "Once you create and publish your first listing, you can manage availability, nightly rates, and guest reservations here.")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/become-a-host"
              className="rounded-full bg-[#1F1F1F] dark:bg-[#F3F4F5] px-6 py-3 text-sm font-medium text-white dark:text-zinc-950 shadow-sm transition-all hover:bg-black dark:hover:bg-white"
            >
              {t("host_calendar_create_listing", "Create a listing")}
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
      <main className={`mx-auto w-full max-w-[1800px] flex-1 px-3 pt-4 sm:px-8 sm:pt-8 xl:px-10 ${normalizedSelectedRange && selectedDatesStats && !mobileSettingsOpen ? "pb-[calc(120px+env(safe-area-inset-bottom))] md:pb-28" : "pb-0 md:pb-28"}`}>
        {mobileCalendarOpen && selectedListing && view !== "year" ? (
          <section className="sm:hidden">
            <div className="mb-5 flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobilePropertySelectorOpen(true)}
                aria-label={`${t("host_calendar_change_property_aria", "Change selected property")}: ${selectedListing.title || "Property"}`}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center"
              >
                <PropertyPhoto listing={selectedListing} className="size-8 shrink-0 rounded-full object-cover" />
                <span className="min-w-0">
                  <span className="flex items-center justify-center gap-1">
                    <span className="truncate text-[15px] font-semibold leading-5 text-[#1F1F1F] dark:text-zinc-100">{selectedListing.title || "Property name"}</span>
                    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                  </span>
                  <span className="block truncate text-xs leading-4 text-[#727272] dark:text-zinc-400">{[selectedListing.district, selectedListing.city].filter(Boolean).join(", ") || selectedListing.country}</span>
                </span>
              </button>
              <MobileViewSelector view={view} onSelectView={handleSelectView} />
              <button type="button" onClick={openMobileCalendarSettings} aria-label={t("host_calendar_settings", "Calendar settings")} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f3f3f3] text-[#1F1F1F] transition-colors hover:bg-[#e8e8e8] dark:bg-zinc-800 dark:text-zinc-100">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.28 2.28-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.09h-3.22v-.09A1.7 1.7 0 0 0 10.3 18.8a1.7 1.7 0 0 0-1.88.34l-.06.06-2.28-2.28.06-.06A1.7 1.7 0 0 0 6.48 15a1.7 1.7 0 0 0-1.56-1.03h-.09v-3.22h.09A1.7 1.7 0 0 0 6.48 9.72a1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.36 5.5l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.09h3.22v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.28 2.28-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.09v3.22h-.09A1.7 1.7 0 0 0 19.4 15Z" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-[#d5d5d5] pb-3 dark:border-zinc-700">
              <h2 className="col-start-2 whitespace-nowrap text-center text-[18px] font-semibold leading-6 tracking-[-0.02em] text-[#272727] dark:text-zinc-100">
                {`${monthName(month, language)} ${month.getFullYear()}`}
              </h2>
              <div className="col-start-3 flex items-center justify-end gap-1.5">
                <button type="button" onClick={handlePrev} aria-label={t("host_calendar_prev_month", "Previous month")} className="flex size-11 items-center justify-center rounded-full border border-[#bdbdbd] bg-[#F3F4F5] text-[#1f1f1f] transition-colors hover:bg-[#f5f5f5] max-[340px]:size-[38px] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button type="button" onClick={handleNext} aria-label={t("host_calendar_next_month", "Next month")} className="flex size-11 items-center justify-center rounded-full border border-[#bdbdbd] bg-[#F3F4F5] text-[#1f1f1f] transition-colors hover:bg-[#f5f5f5] max-[340px]:size-[38px] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 py-2.5 text-[10px] text-[#727272] dark:text-zinc-400" aria-label="Calendar status key">
              <span><span className="mr-1 font-medium text-rose-700">B</span>Booked</span>
              <span><span className="mr-1 font-medium text-zinc-600">×</span>{t("host_cal_blocked_label", "Blocked")}</span>
            </div>

            {view === "list" ? (
              <MobileListCalendar
                month={month}
                listing={selectedListing}
                bookingsByDate={bookingsByDate}
                blockedDatesSet={blockedDatesSet}
                onDayClick={handleDayClick}
              />
            ) : (
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
            )}
          </section >
        ) : view === "year" && selectedListing ? (
          <YearDotCalendar
            startMonth={month}
            listing={selectedListing}
            bookingsByDate={bookingsByDate}
            blockedDatesSet={blockedDatesSet}
            customPricesMap={customPricesMap}
            selection={selection}
            onDayClick={handleDayClick}
            onOpenMonth={(targetMonth) => {
              handleSelectMonth(targetMonth);
              handleSelectView("month");
              setMobileCalendarOpen(true);
            }}
            onReferenceMonth={handleSelectMonth}
            onSelectMonthRange={(targetMonth) => {
              const start = dateKey(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1));
              const end = dateKey(new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0));
              if (normalizedSelectedRange?.start === start && normalizedSelectedRange.end === end) {
                setSelection({ start: null, end: null, isDragging: false });
                setMobileSelectionMode("idle");
                return;
              }
              setSelection({ start, end, isDragging: false });
              setMobileSelectionMode("year-month");
              setMobileSettingsOpen(false);
              setPreviewPrice(null);
            }}
            mobileHeader={{
              onOpenPropertySelector: () => setMobilePropertySelectorOpen(true),
              onOpenSettings: openMobileCalendarSettings,
              view,
              onSelectView: (nextView) => {
                handleSelectView(nextView);
                if (nextView !== "year") setMobileCalendarOpen(true);
              },
            }}
          />
        ) : (
          <MobileCalendarIndex
            listings={listings}
            selectedId={selectedId}
            onSelect={handleSelectProperty}
            onOpenCalendar={() => setMobileCalendarOpen(true)}
            view={view}
            onSelectView={(nextView) => {
              handleSelectView(nextView);
              if (nextView === "list" && selectedListing) setMobileCalendarOpen(true);
            }}
          />
        )
        }

        {/* Mobile Title & Responsive Property Selector Trigger */}
        <div className="mb-4 hidden flex-col gap-3 sm:hidden">
          <div className="flex items-center justify-between">
            <h1>
              {t("host_calendar_title", "Calendar")}
            </h1>
            <button
              type="button"
              onClick={openMobileSettings}
              className="rounded-full bg-[#1F1F1F] dark:bg-[#F3F4F5] px-3.5 py-1.5 text-xs font-medium text-white dark:text-zinc-950"
            >
              {normalizedSelectedRange
                ? t("host_calendar_edit_selected", "Edit selected")
                : t("host_calendar_settings", "Settings")}
            </button>
          </div>

          {/* Mobile Property Switcher Pill */}
          <button
            type="button"
            onClick={() => setMobilePropertySelectorOpen(true)}
            aria-label={t("host_calendar_change_property_aria", "Change selected property")}
            className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-[#F3F4F5] dark:bg-zinc-800 p-2.5 shadow-2xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isAllListings ? (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white font-medium text-xs">
                  ALL
                </div>
              ) : selectedListing ? (
                <PropertyPhoto
                  listing={selectedListing}
                  className="size-9 shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <div className="text-left min-w-0">
                <p className="truncate text-xs font-medium text-[#1F1F1F] dark:text-zinc-100">
                  {isAllListings ? t("host_calendar_all_listings", "All listings") : selectedListing?.title}
                </p>
                <p className="truncate text-[10px] text-[#727272]">
                  {isAllListings
                    ? t("host_calendar_properties_total", { count: listings.length })
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
        <div className="sticky top-0 z-30 relative hidden flex-wrap items-center justify-between gap-4 bg-white/95 pb-5 pt-2 backdrop-blur after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[#d8d8d8] sm:flex sm:pl-[120px] sm:after:left-[129px] dark:bg-zinc-950/95 dark:after:bg-zinc-700">
          {/* Left: Month Navigation Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Month/Year Title & Dropdown Trigger */}
            <div ref={monthDropdownRef} className="relative">
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
                className="flex items-center gap-2 rounded-xl px-2.5 py-1 text-xl sm:text-2xl font-medium tracking-tight text-[#1F1F1F] dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                <span className="capitalize">
                  {view === "year"
                    ? `${month.getFullYear()}`
                    : `${monthName(month, language)} ${month.getFullYear()}`}
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
                <div className="absolute left-0 rtl:left-auto rtl:right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-2xl">
                  {/* Year Stepper */}
                  <div className="mb-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <button
                      type="button"
                      onClick={() => setPickerYear((y) => y - 1)}
                      aria-label={t("host_calendar_prev_year", "Previous year")}
                      className="rounded-full p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <svg
                        className="size-4 rtl:rotate-180"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100">
                      {pickerYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPickerYear((y) => y + 1)}
                      aria-label={t("host_calendar_next_year", "Next year")}
                      className="rounded-full p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <svg
                        className="size-4 rtl:rotate-180"
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
                  <div className="grid grid-cols-3 gap-1.5" role="grid" aria-label={t("host_calendar_select_month_year", "Select month and year")}>
                    {Array.from({ length: 12 }, (_, idx) => {
                      const dateForMonth = new Date(pickerYear, idx, 1);
                      const monthShort = dateForMonth.toLocaleDateString(language || "en", { month: "short" });
                      const monthLong = dateForMonth.toLocaleDateString(language || "en", { month: "long" });
                      const isSelected =
                        month.getMonth() === idx &&
                        month.getFullYear() === pickerYear;
                      return (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`${monthLong} ${pickerYear}`}
                          aria-pressed={isSelected}
                          title={`${monthLong} ${pickerYear}`}
                          onClick={() => {
                            const newDate = new Date(pickerYear, idx, 1);
                            handleSelectMonth(newDate);
                            setShowMonthDropdown(false);
                            if (view === "year") handleSelectView("month");
                          }}
                          className={`rounded-full py-2 text-xs font-medium transition-colors cursor-pointer ${isSelected
                            ? "bg-[#FDE29B] dark:bg-amber-400 text-[#1F1F1F] dark:text-zinc-950 font-medium shadow-xs"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-[#F3F4F5] dark:hover:bg-zinc-800"
                            }`}
                        >
                          {monthShort}
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
              aria-label={t("host_calendar_jump_current_month", "Jump to current month")}
              className="hidden md:flex items-center gap-1.5 rounded-full bg-[#F3F4F5] dark:bg-zinc-800 px-4 py-2 lg:text-base text-sm font-medium text-[#1F1F1F] dark:text-zinc-100 border border-transparent hover:border-[#1F1F1F] dark:hover:border-zinc-600 transition-colors shadow-2xs cursor-pointer"
            >
              {t("host_calendar_today", "Today")}
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
                  alt={t("host_calendar_price_tips", "Price tips")}
                  width={20}
                  height={20}
                  className="dark:invert"
                />
              </span>
              <span>{t("host_calendar_price_tips", "Price tips")}</span>
            </button>

            {/* Calendar view dropdown — preserves the existing Month/Year behavior. */}
            <div className="hidden overflow-hidden rounded-full bg-[#f2f3f5] p-1 lg:flex">
              {(["month", "year"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelectView(option)}
                  aria-pressed={view === option}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${view === option ? "bg-[#20262d] text-white shadow-sm" : "text-[#4e535b] hover:text-[#202124]"}`}
                >
                  {option === "month" ? t("host_calendar_view_month", "Month") : t("host_calendar_view_year", "Year")}
                </button>
              ))}
            </div>
            <div ref={viewDropdownRef} className="relative lg:hidden">
              <button
                type="button"
                onClick={() => {
                  setShowMonthDropdown(false);
                  setShowViewDropdown((isOpen) => !isOpen);
                }}
                aria-expanded={showViewDropdown}
                aria-haspopup="menu"
                aria-label={t("host_calendar_view_aria", "Calendar view")}
                className="hidden md:flex items-center gap-1.5 rounded-full bg-[#F3F4F5] dark:bg-zinc-800 px-4 py-2 lg:text-base text-sm font-medium text-[#1F1F1F] dark:text-zinc-100 border border-transparent hover:border-[#1F1F1F] dark:hover:border-zinc-600 transition-colors shadow-2xs cursor-pointer"
              >
                {view === "month" ? t("host_calendar_view_month", "Month") : t("host_calendar_view_year", "Year")}
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
                  aria-label={t("host_calendar_view_switcher_aria", "Calendar view switcher")}
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
                        {option === "month"
                          ? t("host_calendar_view_month", "Month")
                          : t("host_calendar_view_year", "Year")}
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
              onClick={openMobileSettings}
              className="hidden sm:block lg:hidden rounded-full bg-[#1F1F1F] dark:bg-[#F3F4F5] px-4 py-2 text-sm font-medium text-white dark:text-[#1F1F1F] cursor-pointer"
            >
              {normalizedSelectedRange
                ? t("host_calendar_edit_selected", "Edit selected")
                : t("host_calendar_settings", "Settings")}
            </button>
          </div>
        </div>

        {/* 3-Column Layout: Left Rail | Center Calendar Matrix | Right Settings */}
        <div className={`mt-4 hidden items-start gap-4 xl:gap-6 sm:flex ${isAllListings ? "lg:h-[calc(100dvh-226px)] lg:min-h-[420px]" : "lg:h-[970px]"}`}>
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
                title={t("host_calendar_all_listings_overview", "All listings overview")}
                aria-label={t("host_calendar_all_listings", "All listings")}
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
                <span className="mt-1 text-[11px] font-medium">{t("host_calendar_all_listings", "All listings")}</span>
                <span className="text-[9px] text-[#727272] dark:text-zinc-400">
                  {t("host_calendar_all_listings_stays", { count: listings.length })}
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
                    <p className="truncate text-[10px] font-medium text-white" title={l.title}>
                      {l.title || l.city || "Property"}
                    </p>
                  </div>
                  {isAllListings && (
                    <span
                      role="checkbox"
                      aria-checked={selectedPropertyIds.includes(l.id)}
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleAllPropertySelection(l.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleAllPropertySelection(l.id);
                        }
                      }}
                      className={`absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full border text-[11px] ${selectedPropertyIds.includes(l.id) ? "border-white bg-zinc-950 text-white" : "border-white/80 bg-black/40 text-transparent"}`}
                      title={selectedPropertyIds.includes(l.id) ? "Hide property" : "Show property"}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* 2. Center Calendar Matrix */}
          <div ref={calendarScrollRef} className={`relative min-w-0 flex-1 border-b border-[#d7d7d7] lg:h-full lg:pr-4 dark:border-zinc-700 ${isAllListings ? "overflow-hidden pb-0" : "overflow-y-auto pb-4 calendar-panel-scrollbar"}`}>
            {isAllListings ? (
              <MultiPropertyCalendar
                month={month}
                listings={visibleAllListings}
                bookings={bookings}
                onSelectReservation={setSelectedBooking}
                onOpenPropertyDate={(listingId, date) => {
                  setSelectedId(listingId);
                  setSelection({ start: date, end: date, isDragging: false });
                  setPreviewPrice(null);
                  syncUrl(listingId, month, view);
                }}
              />
            ) : view !== "year" ? (
              <ContinuousMonthCalendar
                activeMonth={month}
                navigationKey={calendarNavigationKey}
                scrollRootRef={calendarScrollRef}
                onVisibleMonthChange={handleVisibleMonthChange}
                listing={selectedListing}
                bookingsByDate={bookingsByDate}
                bookingRanges={bookingRanges}
                blockedDatesSet={blockedDatesSet}
                customPricesMap={customPricesMap}
                selection={selection}
                focusedDateKey={focusedDateKey}
                isAllListings={isAllListings}
                listingsCount={listings.length}
                onDayClick={handleDayClick}
                onDayPointerDown={handleDayPointerDown}
                onDayPointerEnter={handleDayPointerEnter}
                onKeyDown={handleKeyDown}
              />
            ) : (
              <YearDotCalendar
                startMonth={month}
                listing={selectedListing}
                bookingsByDate={bookingsByDate}
                blockedDatesSet={blockedDatesSet}
                customPricesMap={customPricesMap}
                selection={selection}
                onDayClick={handleDayClick}
                onOpenMonth={(targetMonth) => {
                  handleSelectMonth(targetMonth);
                  handleSelectView("month");
                }}
                onReferenceMonth={handleSelectMonth}
              />
            )}
          </div>

          {/* 3. Right Settings / Contextual Management Panel (Desktop Sidebar) */}
          <aside
            aria-label={t("host_calendar_settings_title", "Calendar Settings")}
            className={`hidden h-full shrink-0 overflow-y-auto border-l border-l-[#eeeeee] bg-[#fcfcfd]/70 font-['Poppins'] calendar-panel-scrollbar dark:border-zinc-800 dark:border-l-zinc-800 dark:bg-zinc-950/40 ${view === "year" && !isAllListings ? "2xl:block" : "lg:block"} ${isAllListings ? "w-[270px] px-5 py-5 xl:w-[300px]" : normalizedSelectedRange ? "w-[380px] px-6 py-6 xl:w-[440px] 2xl:w-[470px]" : "w-[330px] px-6 py-6 xl:w-[370px]"}`}
          >
            {isAllListings ? (
              <AllListingsOverviewPanel
                listings={listings}
                bookings={bookings}
                onSelectListing={handleSelectProperty}
              />
            ) : selectedListing && normalizedSelectedRange && selectedDatesStats ? (
              /* Phase 7 & 8 Contextual Management Panel (When dates are selected) */
              <div className="animate-in fade-in slide-in-from-right-2 duration-200 motion-reduce:animate-none">
                <CalendarSelectionManagementPanel
                  key={`${selectedListing.id}-${normalizedSelectedRange.start}-${normalizedSelectedRange.end}`}
                  selectedDayBookings={bookingsByDate.get(normalizedSelectedRange.start) || []}
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
              </div>
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
        {
          mobileSettingsOpen && (
            <WorkspaceDialog
              title={
                isAllListings
                  ? t("host_calendar_portfolio_settings", "Portfolio Settings")
                  : normalizedSelectedRange
                    ? normalizedSelectedRange.start === normalizedSelectedRange.end
                      ? formatBookingDate(normalizedSelectedRange.start, { locale: language || "en" })
                      : t("host_calendar_manage_selected_dates", "Manage Selected Dates")
                    : t("host_calendar_price_and_availability", "Price & Availability")
              }
              onClose={() => {
                setMobileSettingsOpen(false);
                setMobileSelectionMode("idle");
                setSelection({ start: null, end: null, isDragging: false });
                setPreviewPrice(null);
              }}
              variant={normalizedSelectedRange ? "calendar-management" : "default"}
              dark={Boolean(normalizedSelectedRange)}
              maxWidth="max-w-md"
            >
              {isAllListings ? (
                <AllListingsOverviewPanel
                  listings={listings}
                  bookings={bookings}
                  onSelectListing={handleSelectProperty}
                />
              ) : selectedListing && normalizedSelectedRange && selectedDatesStats ? (
                <CalendarSelectionManagementPanel
                  key={`mobile-${selectedListing.id}-${normalizedSelectedRange.start}-${normalizedSelectedRange.end}`}
                  selectedDayBookings={bookingsByDate.get(normalizedSelectedRange.start) || []}
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
                    setMobileSelectionMode("idle");
                  }}
                  onContinueSelecting={() => {
                    setMobileSettingsOpen(false);
                    setMobileSelectionMode("multi-select");
                    setSelection({ start: normalizedSelectedRange.start, end: null, isDragging: false });
                    setPreviewPrice(null);
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
          )
        }

        {mobileCalendarSettingsOpen && selectedListing && (
          <ModalOverlay
            className="fixed inset-0 z-[110] overflow-hidden bg-white animate-in fade-in duration-200 dark:bg-zinc-950"
            onClick={(event) => {
              if (event.target === event.currentTarget) setMobileCalendarSettingsOpen(false);
            }}
          >
            <MobileCalendarSettings
              key={selectedListing.id}
              listing={selectedListing}
              saving={saving}
              notice={notice}
              onSave={save}
              onClose={() => setMobileCalendarSettingsOpen(false)}
            />
          </ModalOverlay>
        )}

        {view === "year" && mobileSelectionMode === "year-month" && normalizedSelectedRange && selectedDatesStats && selectedListing && !mobileSettingsOpen && (
          <MobileYearMonthEditor
            range={normalizedSelectedRange}
            stats={selectedDatesStats}
            sourceCurrency={sourceCurrency}
            saving={saving}
            notice={notice}
            onClear={() => {
              setSelection({ start: null, end: null, isDragging: false });
              setPreviewPrice(null);
              setMobileSelectionMode("idle");
            }}
            onBulkAvailability={(action) => { void handleBulkAvailability(action, selectedDatesStats.editableKeys); }}
            onOpenEditor={() => setMobileSettingsOpen(true)}
          />
        )}

        {/* Phase 19: Mobile Sticky Selection Floating Bar */}
        {
          normalizedSelectedRange && selectedDatesStats && mobileSelectionMode === "multi-select" && !mobileSettingsOpen && (
            <aside
              aria-label={t("host_calendar_selection_summary_aria", "Selection summary bar")}
                className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 flex flex-col gap-3 border-t border-white bg-[#F3F4F5] p-3 shadow-[0px_-2px_12px_0px_#0000001F] animate-in slide-in-from-bottom duration-200 dark:border-white/20 dark:bg-zinc-900 md:inset-x-4 md:bottom-4 md:rounded-[12px] md:border md:p-3 md:flex-row md:items-center md:justify-between lg:hidden"
            >
              <div className="min-w-0 rounded-[12px] border border-white bg-white/70 px-3 py-2.5 dark:border-white/20 dark:bg-zinc-800/70 md:flex-1">
                <p className="truncate text-sm font-medium text-[#1F1F1F] dark:text-zinc-100">
                  {selectedDatesStats.totalNights === 1
                    ? t("host_calendar_night_selected", { count: 1 })
                    : t("host_calendar_nights_selected", { count: selectedDatesStats.totalNights })}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#727272] dark:text-zinc-400">
                  {t("host_calendar_editable_count", { count: selectedDatesStats.editableKeys.length })} · {t("host_calendar_reserved_count", { count: selectedDatesStats.bookedCount })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelection({ start: null, end: null, isDragging: false });
                    setPreviewPrice(null);
                    setMobileSelectionMode("idle");
                  }}
                  className="min-h-10 rounded-full border border-white bg-white px-4 py-2 text-sm font-medium text-[#1F1F1F] shadow-[0px_2px_4px_0px_#00000040] transition-colors hover:bg-[#DDDDDE] dark:border-white/20 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  {t("host_calendar_clear", "Clear")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Explicit multi-select completion opens the existing bulk
                    // management sheet; a normal single tap never reaches here.
                    setMobileSettingsOpen(true);
                  }}
                  className="min-h-10 rounded-full border border-transparent bg-[#FCDF9C] px-4 py-2 text-sm font-medium text-[#1F1F1F] shadow-[0px_2px_4px_0px_#00000040] transition-colors hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white cursor-pointer"
                >
                  {t("host_calendar_manage_selected_dates", "Manage selection")}
                </button>
              </div>
            </aside >
          )
        }

        {/* Mobile / Tablet Property Selector Bottom Sheet / Modal */}
        {
          mobilePropertySelectorOpen && (
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
                aria-label={t("host_calendar_select_property_modal_title", "Select property")}
                className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 text-[#1F1F1F] dark:text-zinc-100 p-6 shadow-2xl flex flex-col"
              >
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                  <h2 className="text-lg font-medium">{t("host_calendar_select_property_modal_title", "Select property")}</h2>
                  <CloseButton
                    onClick={() => setMobilePropertySelectorOpen(false)}
                  />
                </div>

                {/* Search input if host has multiple listings */}
                {listings.length > 4 && (
                  <div className="pt-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={t("host_calendar_search_properties_placeholder", "Search properties...")}
                        value={propertySearchQuery}
                        onChange={(e) => setPropertySearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-[#d7d7d7] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-3.5 pr-9 py-2 text-sm text-[#1F1F1F] dark:text-zinc-100 placeholder:text-[#727272] outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      {propertySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setPropertySearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer text-xs"
                          aria-label={t("home_clear_search", "Clear search")}
                        >
                          ✕
                        </button>
                      )}
                    </div>
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
                        ? "bg-[#FDE29B] dark:bg-amber-400 text-zinc-950 font-medium"
                        : "hover:bg-[#F3F4F5] dark:hover:bg-zinc-800 border border-[#d7d7d7] dark:border-zinc-700"
                        }`}
                    >
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white font-medium text-xs">
                        ALL
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t("host_calendar_all_listings", "All listings")}</p>
                        <p className="text-xs text-[#727272] dark:text-zinc-400">
                          {t("host_calendar_properties_portfolio", { count: listings.length })}
                        </p>
                      </div>
                      {isAllListings && (
                        <span className="text-zinc-950 font-medium">✓</span>
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
                          ? "bg-[#FDE29B] dark:bg-amber-400 text-zinc-950 font-medium"
                          : "hover:bg-[#F3F4F5] dark:hover:bg-zinc-800 border border-[#d7d7d7] dark:border-zinc-700"
                          }`}
                      >
                        <PropertyPhoto
                          listing={l}
                          className="size-12 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {l.title}
                          </p>
                          <p className="truncate text-xs text-[#727272]">
                            {[l.district, l.city].filter(Boolean).join(", ") ||
                              l.country}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="text-zinc-950 font-medium">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </ModalOverlay>
          )
        }

        {/* All Listings Day Details Dialog */}
        {
          allListingsDayBookings && (
            <WorkspaceDialog
              title={t("host_calendar_listings_on_date", {
                date: new Date(
                  `${allListingsDayBookings.date}T12:00:00`,
                ).toLocaleDateString(language || "en", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }),
              })}
              onClose={() => setAllListingsDayBookings(null)}
              maxWidth="max-w-lg"
            >
              <div className="space-y-5 text-sm">
                {/* Booked Listings on this date */}
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                    {t("host_calendar_reserved_properties", {
                      count: allListingsDayBookings.bookings.length,
                    })}
                  </h3>
                  {allListingsDayBookings.bookings.length === 0 ? (
                    <p className="text-xs text-[#727272]">
                      {t("host_calendar_no_bookings_night", "No bookings on this night.")}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {allListingsDayBookings.bookings.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-xl border border-[#d7d7d7] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-xs text-[#1F1F1F] dark:text-zinc-100">
                              {b.listing?.title || t("host_cal_res_property_label", "Property")}
                            </p>
                            <p className="text-xs text-[#727272]">
                              {t("host_calendar_guest_label", "Guest:")}{" "}
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
                            className="ml-3 shrink-0 rounded-full bg-zinc-900 dark:bg-[#F3F4F5] px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-950 hover:bg-black dark:hover:bg-white cursor-pointer"
                          >
                            {t("host_calendar_details_btn", "Details")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Vacant Listings on this date */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                    {t("host_calendar_available_properties", {
                      count: Math.max(
                        0,
                        listings.length - allListingsDayBookings.bookings.length,
                      ),
                    })}
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
                            className="ml-3 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            {t("host_calendar_view_calendar_btn", "View calendar →")}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </WorkspaceDialog>
          )
        }

        {/* Reservation Details Modal */}
        {
          selectedBooking && selectedBookingListing && (
            <ReservationDetails
              booking={selectedBooking}
              listing={selectedBookingListing}
              onClose={() => setSelectedBooking(null)}
              onMoney={() => setShowMoney(true)}
            />
          )
        }

        {/* Send or Request Money Dialog */}
        {
          selectedBooking && showMoney && (
            <MoneyDialog
              booking={selectedBooking}
              onClose={() => {
                setShowMoney(false);
                setSelectedBooking(null);
              }}
            />
          )
        }

        {/* Price Tips Dialog */}
        {
          tips && (
            <WorkspaceDialog
              title={t("host_calendar_price_tips", "Price tips")}
              onClose={() => setTips(false)}
              maxWidth="max-w-md"
            >
              <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {selectedListing && normalizedSelectedRange && selectedDatesStats && selectedDatesStats.editableKeys.length > 0 ? (
                  /* Contextual tips for selected range */
                  <div className="space-y-3">
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200/60 dark:border-amber-900/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                          {t("host_calendar_price_tips_rec", "Selected Dates Recommendation")}
                        </span>
                        <span className="text-xs text-[#727272] font-medium">
                          {selectedDatesStats.totalNights} {selectedDatesStats.totalNights === 1 ? t("host_calendar_night_count", { count: 1 })
                            : t("host_calendar_nights_count", { count: selectedDatesStats.totalNights })}
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
                              <span className="text-sm text-[#727272] font-normal">
                                {t("host_calendar_price_tips_status", "Recommendation Status")}
                              </span>
                              {rangeTips.overallAction === "INCREASE" ? (
                                <span className="rounded-md bg-amber-200 dark:bg-amber-900/80 px-2 py-1 text-xs font-medium text-amber-950 dark:text-amber-200 mt-3">
                                  {t("host_calendar_price_tips_surge", { pct: rangeTips.averagePercentChange })}
                                </span>
                              ) : rangeTips.overallAction === "DECREASE" ? (
                                  <span className="rounded-md bg-blue-100 dark:bg-blue-950 px-2 py-1 text-xs font-medium text-blue-900 dark:text-blue-200 mt-3">
                                  {t("host_calendar_price_tips_incentive", { pct: rangeTips.averagePercentChange })}
                                </span>
                              ) : rangeTips.overallAction === "NO_CHANGE" ? (
                                    <span className="rounded-md bg-emerald-100 dark:bg-emerald-950 px-2 py-1 text-xs font-medium text-emerald-900 dark:text-emerald-200 mt-3">
                                  {t("host_calendar_price_tips_optimal", "Optimal Rate")}
                                </span>
                              ) : (
                                      <span className="rounded-md bg-zinc-200 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 mt-3">
                                  {t("host_calendar_price_tips_advisory", "Advisory Only")}
                                </span>
                              )}
                            </div>

                            <div className="flex items-baseline justify-between pt-1">
                              <div>
                                <span className="text-xs text-[#727272] block">{t("host_calendar_price_tips_curr_avg", "Current avg")}</span>
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                  {formatMoney(rangeTips.averageCurrentPrice, sourceCurrency, 2)}
                                </span>
                              </div>
                              {rangeTips.overallAction !== "NO_CHANGE" && rangeTips.overallAction !== "INSUFFICIENT_DATA" && (
                                <span className="text-zinc-400">→</span>
                              )}
                              <div className="text-right">
                                <span className="text-xs text-[#727272] block">
                                  {rangeTips.overallAction === "NO_CHANGE"
                                    ? t("host_calendar_price_tips_rec_avg", "Recommended avg")
                                    : rangeTips.overallAction === "INSUFFICIENT_DATA"
                                      ? t("host_calendar_price_tips_active_avg", "Active avg")
                                      : t("host_calendar_price_tips_sugg_avg", "Suggested avg")}
                                </span>
                                <span className="text-base font-medium text-amber-700 dark:text-amber-400">
                                  {formatMoney(rangeTips.averageSuggestedPrice, sourceCurrency, 2)}
                                </span>
                              </div>
                            </div>

                            {rangeTips.applicableCount > 1 && (
                              <div className="rounded-lg bg-white/60 dark:bg-zinc-900/60 p-2 text-[11px] text-zinc-600 dark:text-zinc-300 flex items-center justify-between border border-amber-200/50 dark:border-amber-900/40">
                                <span>{t("host_calendar_price_tips_breakdown", "Breakdown")}</span>
                                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                  {rangeTips.increaseCount > 0 ? `${rangeTips.increaseCount} ${t("host_calendar_price_tips_increase", "increase")} ` : ""}
                                  {rangeTips.decreaseCount > 0 ? `${rangeTips.decreaseCount} ${t("host_calendar_price_tips_decrease", "decrease")} ` : ""}
                                  {rangeTips.noChangeCount > 0 ? `${rangeTips.noChangeCount} ${t("host_calendar_price_tips_optimal_count", "optimal")}` : ""}
                                </span>
                              </div>
                            )}

                            <div className="border-t border-amber-200/50 dark:border-amber-900/50 pt-2 space-y-1">
                              {rangeTips.reasons.map((r, i) => (
                                <p key={i} className="text-xs text-amber-900/80 dark:text-amber-300/80 flex items-center gap-1.5">
                                  <span className="text-amber-700 font-medium">•</span> {getLocalizedReason(r, t)}
                                </p>
                              ))}
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setTips(false)}
                                className="px-6 py-2 rounded-full border border-[#1F1F1F] hover:bg-[#1F1F1F] text-sm font-medium text-[#1F1F1F] hover:text-white  transition-colors delay-300 duration-300 cursor-pointer"
                              >
                                {t("host_calendar_cancel", "Cancel")}
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
                                  className="px-4 py-2 rounded-full text-sm hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white hover:border-[#1F1F1F] bg-[#FCDF9C] font-medium shadow-xs transition-colors delay-300 duration-300 flex items-center justify-center gap-2 min-w-[100px] border border-transparent  cursor-pointer"
                                >
                                  {saving ? t("host_calendar_applying", "Applying…") : t("host_calendar_price_tips_apply_count", { count: rangeTips.increaseCount + rangeTips.decreaseCount })}
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-[#727272] dark:text-zinc-400 italic">
                                  {rangeTips.overallAction === "NO_CHANGE" ? t("host_calendar_price_tips_optimal_active", "Optimal rate active") : t("host_calendar_price_tips_manual_active", "Manual rate active")}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-[#727272] dark:text-zinc-400 leading-normal italic">
                      {t("host_calendar_price_tips_disclaimer", "External market competitor comparison is unavailable. Recommendations are calculated using your property's base prices, weekend adjustments, booking occupancy signals, and calendar seasonality.")}
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
                          <h4 className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100">
                            {t("host_calendar_price_tips_insights_title", "Property Pricing Insights")}
                          </h4>
                          <p className="mt-1 text-sm leading-5 text-[#76500b] dark:text-amber-200">
                            {t("host_calendar_price_tips_insights_desc", "Optimize earnings by setting weekend premiums, configuring Smart Pricing limits, and applying promotional discounts for longer stays.")}
                          </p>
                        </div>
                      </div >
                    </div >

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#DDDDDE] text-[9px] font-medium text-[#6f4c00]">1</span>
                        <p className="text-sm leading-6 text-[#595959] dark:text-zinc-300">
                          <strong className="font-medium text-[#1F1F1F] dark:text-zinc-100">{t("host_calendar_price_tips_weekend_title", "Weekend Pricing:")}</strong>
                          <span className="text-[#727272] dark:text-zinc-400"> {t("host_calendar_price_tips_weekend_desc", "Configure weekend rates to capture higher weekend demand (Thursday & Friday nights).")}</span>
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#DDDDDE] text-[9px] font-medium text-[#6f4c00]">2</span>
                        <p className="text-sm leading-6 text-[#595959] dark:text-zinc-300">
                          <strong className="font-medium text-[#1F1F1F] dark:text-zinc-100">{t("host_calendar_price_tips_select_title", "Select Dates:")}</strong>
                          <span className="text-[#727272] dark:text-zinc-400"> {t("host_calendar_price_tips_select_desc", "Click or drag on the calendar to view tailored price recommendations for specific dates.")}</span>
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#DDDDDE] text-[9px] font-medium text-[#6f4c00]">3</span>
                        <p className="text-sm leading-6 text-[#595959] dark:text-zinc-300">
                          <strong className="font-medium text-[#1F1F1F] dark:text-zinc-100">{t("host_calendar_price_tips_smart_title", "Smart Pricing Limits:")}</strong>
                          <span className="text-[#727272] dark:text-zinc-400"> {t("host_calendar_price_tips_smart_desc", "Set minimum and maximum price boundaries in your listing settings to safeguard profitability.")}</span>
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#DDDDDE] text-[9px] font-medium text-[#6f4c00]">4</span>
                        <p className="text-sm leading-6 text-[#595959] dark:text-zinc-300">
                          <strong className="font-medium text-[#1F1F1F] dark:text-zinc-100">{t("host_calendar_price_tips_discounts_title", "Weekly & Monthly Discounts:")}</strong>
                          <span className="text-[#727272] dark:text-zinc-400"> {t("host_calendar_price_tips_discounts_desc", "Offer discounts to attract longer-stay guests and increase occupancy.")}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-xl border border-[#e7e7e7] bg-[#f7f7f7] p-3 text-sm leading-6 text-[#727272] dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                      <svg className="mt-0.5 size-4 shrink-0 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" strokeLinecap="round" /></svg>
                      <p>{t("host_calendar_price_tips_disclaimer_bottom", "External market competitor data is currently unavailable. Suggestions are generated from your property's rules and calendar lead time.")}</p>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-xl border border-[#e7e7e7] bg-[#f7f7f7] p-3 text-sm leading-6 text-[#727272] dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                      <svg className="mt-0.5 size-4 shrink-0 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" strokeLinecap="round" /></svg>
                      <p>External market competitor data is currently unavailable. Suggestions use your property&apos;s rules and calendar lead time.</p>
                    </div>

                    <div className="flex justify-end border-t border-[#e7e7e7] pt-4 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setTips(false)}
                        className="rounded-full bg-[#1F1F1F] px-6 py-2.5 text-base font-medium text-white hover:text-[#1f1f1f] transition-colors duration-300 hover:bg-[#FCDF9C] dark:bg-[#F3F4F5] dark:text-[#1F1F1F] dark:hover:bg-white cursor-pointer"
                      >
                        {t("host_calendar_got_it", "Got it")}
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
