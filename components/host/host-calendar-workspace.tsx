"use client";

import { Fragment, useState } from "react";
import { CalendarSettingsPanel } from "./calendar-settings-panel";
import { HostSubNav } from "./host-sub-nav";
import { updateListingAction } from "@/actions/host/listings";
import type { ListingDTO } from "@/services/mappers";
import Image from "next/image";
import { useCurrency } from "@/lib/currency-context";
import { getCurrencyForCountry } from "@/lib/currency";
import {
  WorkspaceDialog,
  ReservationDetails,
  MoneyDialog,
  dateKey,
  type HostWorkspaceProps,
  type HostReservation,
} from "./host-workspace-shared";

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
  date.toLocaleDateString("en", { month: "long" });

function MonthGrid({
  month,
  listing,
  bookings,
  compact,
  onDay,
}: {
  month: Date;
  listing: ListingDTO;
  bookings: HostReservation[];
  compact: boolean;
  onDay: (key: string, booking?: HostReservation) => void;
}) {
  const { formatPrice } = useCurrency();
  const sourceCurrency = getCurrencyForCountry(listing.country);
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const today = dateKey(new Date());

  return (
    <div className="min-w-0">
      <div
        className={`mb-4 grid grid-cols-7 text-center text-base font-medium pb-4 border-b border-b-[#DDDDDE] dark:border-b-zinc-800 text-[#1F1F1F] dark:text-zinc-300 ${
          compact ? "max-sm:hidden text-[12px]" : ""
        }`}
      >
        {weekdays.map((d) => (
          <span key={d}>
            <span className={compact ? "hidden" : "hidden xl:inline"}>{d}</span>
            <span className={compact ? "" : "xl:hidden"}>{d[0]}</span>
          </span>
        ))}
      </div>
      <div
        className={`grid grid-cols-7 ${compact ? "gap-1" : "gap-1"}`}
      >
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
          const key = dateKey(date);
          const reservation = bookings.find(
            (b) =>
              b.listingId === listing.id &&
              b.status !== "CANCELLED" &&
              b.startDate.slice(0, 10) <= key &&
              b.endDate.slice(0, 10) > key,
          );
          const blocked = listing.blockedDates.includes(key);
          const isWeekend = date.getDay() === 4 || date.getDay() === 5;
          const customPrices = ((listing as any).customPrices || {}) as Record<string, number>;
          const customPrice = typeof customPrices[key] === "number" ? customPrices[key] : null;
          const weekdayBase = (listing as any).weekdayBasePrice ?? listing.price;
          const rate = customPrice !== null
            ? customPrice
            : (isWeekend && listing.weekendPrice != null && listing.weekendPrice > 0
                ? listing.weekendPrice
                : weekdayBase);
          const isToday = key === today;

          return (
            <button
              key={key}
              onClick={() => onDay(key, reservation)}
              aria-label={`${key}, ${reservation ? `reserved by ${reservation.guestName}` : blocked ? "blocked" : "available"}, ${formatPrice(rate, sourceCurrency, 2)}`}
              className={`group relative flex min-w-0 flex-col items-center justify-center rounded-xl border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                compact
                  ? "min-h-3 rounded-full p-0 sm:min-h-[68px] sm:rounded-[9px] sm:py-1.5"
                  : "min-h-20 p-2 sm:min-h-24 lg:min-h-36.5"
              } ${
                reservation
                  ? "border-zinc-900 dark:border-zinc-700 bg-zinc-900 text-white shadow-xs"
                  : blocked
                    ? "border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 opacity-60"
                    : "border-transparent bg-[#F3F4F5] dark:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {/* Day Number */}
              <span
                className={`flex items-center justify-center rounded-full font-normal transition-transform ${
                  compact
                    ? "size-1 max-sm:bg-zinc-500 text-[0px] sm:size-5 sm:border sm:border-zinc-300 dark:sm:border-zinc-600 sm:bg-white dark:sm:bg-zinc-700 sm:text-zinc-800 dark:sm:text-zinc-200 sm:text-[12px] sm:font-normal"
                    : "size-6 text-xs sm:size-7 sm:text-xs"
                } ${
                  isToday
                    ? "bg-[#FDE29B] dark:bg-amber-400 text-zinc-900 dark:text-zinc-950 font-bold shadow-xs"
                    : reservation
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-700 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-600"
                } ${blocked ? "line-through text-zinc-400" : ""}`}
              >
                {i + 1}
              </span>

              {/* Price / Status */}
              <span
                className={`${compact ? "hidden text-[12px] font-normal sm:block mt-2" : "text-[16px] mt-5.5 "} font-medium ${
                  reservation
                    ? "text-zinc-300"
                    : blocked
                    ? "text-[#1F1F1F] dark:text-zinc-400 line-through"
                    : customPrice !== null
                    ? "text-amber-600 dark:text-amber-400 font-bold"
                    : "text-[#1F1F1F] dark:text-zinc-100"
                }`}
              >
                {blocked ? "Blocked" : formatPrice(rate, sourceCurrency, 2)}
              </span>
              {customPrice !== null && !blocked && !reservation && (
                <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1 rounded">
                  custom
                </span>
              )}

              {/* Reservation Guest Pill Bar */}
              {reservation && (
                <div
                  className={`${compact ? "hidden" : "flex"} w-full items-center gap-1.5 truncate rounded-md bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-medium text-white`}
                >
                  <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-amber-300 text-[8px] font-bold text-zinc-900">
                    {reservation.guestName[0]}
                  </span>
                  <span className="truncate">{reservation.guestName}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DEFAULT_DEMO_LISTING: ListingDTO = {
  id: "demo-listing-1",
  hostId: "demo-host",
  title: "Luxury Urban Loft with Skyline View",
  description: "Modern stay in the city center.",
  hostingType: "HOME",
  propertyType: "Apartment",
  listingType: "Entire place",
  address: "123 King Fahd Rd",
  city: "Riyadh",
  district: "Olaya",
  postalCode: "12211",
  country: "Saudi Arabia",
  latitude: 24.7136,
  longitude: 46.6753,
  guests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  price: 42100, // SAR 421
  currency: "SAR",
  cleaningFee: 24100,
  securityDeposit: 50000,
  weekendPrice: 52000,
  minNights: 1,
  maxNights: 365,
  cancellationPolicy: "FLEXIBLE",
  instantBook: true,
  published: true,
  status: "ACTIVE",
  isPaused: false,
  photos: ["/images/listing/sample-1.jpg"],
  highlights: ["City view", "Fast WiFi"],
  amenities: ["WIFI", "AIR_CONDITIONING"],
  houseRules: ["No smoking"],
  checkInMethod: "SMART_LOCK",
  checkInStart: "15:00",
  checkInEnd: "22:00",
  checkOutTime: "11:00",
  blockedDates: ["2025-10-20", "2025-10-21"],
  discounts: { weekly: 5, monthly: 10 },
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
} as unknown as ListingDTO;

const SAMPLE_CALENDAR_BOOKINGS: HostReservation[] = [
  {
    id: "res-cal-1",
    listingId: "demo-listing-1",
    status: "CONFIRMED",
    startDate: "2025-10-14T15:00:00.000Z",
    endDate: "2025-10-17T11:00:00.000Z",
    createdAt: "2025-09-10T00:00:00.000Z",
    guestName: "Mark",
    guestImage: null,
  },
];

export function HostCalendarWorkspace({
  listings: initialListings,
  bookings: initialBookings,
}: HostWorkspaceProps) {
  const { formatPrice } = useCurrency();
  const listings =
    initialListings.length > 0 ? initialListings : [DEFAULT_DEMO_LISTING];
  const bookings =
    initialBookings.length > 0 ? initialBookings : SAMPLE_CALENDAR_BOOKINGS;

  const [selectedId, setSelectedId] = useState(
    listings[0]?.id || DEFAULT_DEMO_LISTING.id,
  );
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [view, setView] = useState<"month" | "year">("month");
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] =
    useState<HostReservation | null>(null);
  const [showMoney, setShowMoney] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [tips, setTips] = useState(false);

  const [savedListings, setSavedListings] = useState<
    Record<string, ListingDTO>
  >({});
  const listing =
    savedListings[selectedId] ||
    listings.find((l) => l.id === selectedId) ||
    listings[0];
  const sourceCurrency = getCurrencyForCountry(listing?.country);

  async function save(values: Record<string, unknown>) {
    if (!listing || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const result = await updateListingAction(listing.id, values);
      if (result.ok) {
        setSavedListings((current) => ({
          ...current,
          [listing.id]: result.data,
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

  function openDay(key: string, booking?: HostReservation) {
    setNotice("");
    if (booking) setSelectedBooking(booking);
    else setSelectedDay(key);
  }

  return (
    <>
      <HostSubNav activeTab="calendar" />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 pb-24 pt-8 sm:px-8 sm:pt-10">
        {/* Mobile Title */}
        <h1 className="mb-6 text-2xl font-medium text-zinc-900 dark:text-zinc-100 sm:hidden">
          Calendars
        </h1>

        {/* Top Control Bar: Month Selector, Price Tips, View Toggle */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:pl-[125px]">
          {/* Left: Month Dropdown + Prev/Next Buttons */}
          <div className="relative flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                className="flex items-center gap-2 text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100"
              >
                <span>
                  {view === "year"
                    ? month.getFullYear()
                    : `${monthName(month)}`}
                </span>
                {view === "month" && (
                  <Image
                    src={"/images/icons/chevron-down.svg"}
                    alt={"chevron-down.svg"}
                    width={25}
                    height={22}
                    className="ml-3 dark:invert"
                  />
                )}
              </button>

              {/* Month Picker Dropdown */}
              {showMonthDropdown && (
                <div className="absolute left-0 top-full z-50 mt-2 grid w-64 grid-cols-3 gap-1 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 shadow-xl">
                  {monthsList.map((m, idx) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMonth(new Date(month.getFullYear(), idx, 1));
                        setShowMonthDropdown(false);
                        setView("month");
                      }}
                      className={`rounded-xl py-2 text-xs font-semibold transition-colors ${
                        month.getMonth() === idx
                          ? "bg-[#FDE29B] dark:bg-amber-400 text-zinc-900 dark:text-zinc-950 font-bold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Price tips, calendar view dropdown, Settings (mobile) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setTips(true)}
              className="flex items-center gap-1.5 rounded-full bg-[#F3F4F5] dark:bg-zinc-800 px-4 py-2 text-base font-medium text-[#1F1F1F] dark:text-zinc-100 border border-transparent hover:border-[#1F1F1F] dark:hover:border-zinc-600 transition-colors shadow-2xs"
            >
              <span className="text-amber-500">
                <Image
                  src={"/images/icons/price-tips.svg"}
                  alt={"price-tips.svg"}
                  width={25}
                  height={22}
                  className="dark:invert"
                />
              </span>
              <span>Price tips</span>
            </button>

            {/* Calendar view dropdown */}
            <div className="relative">
              <select
                aria-label="Calendar view"
                value={view}
                onChange={(event) =>
                  setView(event.target.value === "year" ? "year" : "month")
                }
                className="cursor-pointer appearance-none rounded-full border border-transparent dark:border-zinc-700 bg-[#F3F4F5] dark:bg-zinc-800 py-2 pl-4 pr-10 text-base font-medium text-[#1F1F1F] dark:text-zinc-100 shadow-2xs cursor-pointer transition-colors hover:border-[#1F1F1F] dark:hover:border-zinc-600 focus-visible:outline-none"
              >
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#1F1F1F] dark:text-zinc-100"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>

            {/* Mobile Settings Toggle */}
            <button
              type="button"
              onClick={() => setMobileSettingsOpen(true)}
              className="rounded-full bg-[#1F1F1F] dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 lg:hidden"
            >
              Settings
            </button>
          </div>
        </div>

        {/* Main 3-Column Layout: Left Rail | Center Matrix | Right Sidebar */}
        <div className="flex items-start gap-6.75 lg:h-[970px]">
          {/* 1. Left Rail: Property Switcher Thumbnails */}
          <aside
            aria-label="Property selection"
            className="hidden w-[105px] shrink-0 flex-col items-center gap-2.5 sm:flex lg:max-h-full lg:overflow-y-auto [scrollbar-width:none]"
          >
            {listings.map((l, index) => {
              const isSelected = l.id === selectedId;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  title={l.title}
                  aria-label={l.title}
                  aria-pressed={isSelected}
                  className={`group relative h-[94px] w-[105px] shrink-0 rounded-[18px] overflow-hidden transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8d88ee] ${
                    isSelected
                      ? "border-[7px] border-[#A5A0FF] dark:border-indigo-500 bg-[#A5A0FF] dark:bg-indigo-500"
                      : "border border-[#aaa] dark:border-zinc-700 hover:border-[#8d88ee] dark:hover:border-indigo-400"
                  }`}
                >
                  <Image
                    src={`/images/listing/listing-img-0${(index % 3) + 1}.png`}
                    alt={l.title}
                    fill
                    sizes="105px"
                    className="rounded-[11px] object-cover"
                  />
                </button>
              );
            })}

            {/* Placeholder slots matching Figma design */}
            {Array.from({ length: Math.max(0, 7 - listings.length) }).map(
              (_, idx) => (
                <div
                  key={`placeholder-${idx}`}
                  className="h-[94px] w-[105px] shrink-0 rounded-[18px] border border-[#aaa] dark:border-zinc-700 bg-[#F3F4F5] dark:bg-zinc-800"
                />
              ),
            )}
          </aside>

          {/* 2. Center Calendar Matrix */}
          <div className="min-w-0 flex-1 border-y border-[#727272] dark:border-zinc-700 py-4 lg:h-full lg:overflow-y-auto lg:pr-5 calendar-panel-scrollbar">
            {view === "month" ? (
              <MonthGrid
                month={month}
                listing={listing}
                bookings={bookings}
                compact={false}
                onDay={openDay}
              />
            ) : (
              /* Year View Matrix (12 months) */
              <div className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(
                    month.getFullYear(),
                    month.getMonth() + i,
                    1,
                  );
                  return (
                    <Fragment key={d.toISOString()}>
                      {i > 0 && d.getMonth() === 0 && (
                        <h2 className="col-span-full border-t border-zinc-100 dark:border-zinc-800 pt-5 text-xl font-medium dark:text-zinc-100">
                          {d.getFullYear()}
                        </h2>
                      )}
                      <section className="min-w-0 border-b border-[#F3F4F5] dark:border-zinc-800 pb-6">
                        <button
                          type="button"
                          onClick={() => {
                            setMonth(d);
                            setView("month");
                          }}
                          className="mb-5 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-amber-700 dark:hover:text-amber-400 flex items-center justify-between w-full"
                        >
                          <span>{monthName(d)}</span>
                        </button>
                        <MonthGrid
                          month={d}
                          listing={listing}
                          bookings={bookings}
                          compact
                          onDay={openDay}
                        />
                      </section>
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shared pricing sidebar for both calendar views. */}
          <aside
            aria-label="Calendar settings"
            className="hidden h-full w-60 shrink-0 overflow-y-auto overscroll-contain border-y border-zinc-200 dark:border-zinc-800 border-l border-l-[#F3F4F5] dark:border-l-zinc-800 px-5 py-5 lg:block xl:w-84.5 calendar-panel-scrollbar"
          >
            <CalendarSettingsPanel
              key={listing.id}
              listing={listing}
              saving={saving}
              notice={notice}
              onSave={save}
            />
          </aside>
        </div>

        {mobileSettingsOpen && (
          <WorkspaceDialog
            title="Settings"
            onClose={() => setMobileSettingsOpen(false)}
            maxWidth="max-w-md"
          >
            <CalendarSettingsPanel
              key={listing.id}
              listing={listing}
              saving={saving}
              notice={notice}
              onSave={save}
            />
          </WorkspaceDialog>
        )}

        {/* Date-Level Quick Edit Drawer / Popover (Frame 02:44) */}
        {selectedDay && listing && (() => {
          const customPrices = ((listing as any).customPrices || {}) as Record<string, number>;
          const hasCustom = typeof customPrices[selectedDay] === "number";
          const selectedDate = new Date(selectedDay + "T00:00:00Z");
          const isWeekendDay = selectedDate.getUTCDay() === 4 || selectedDate.getUTCDay() === 5;
          const weekdayBase = (listing as any).weekdayBasePrice ?? listing.price;
          const currentRate = hasCustom
            ? customPrices[selectedDay]
            : (isWeekendDay && listing.weekendPrice && listing.weekendPrice > 0
                ? listing.weekendPrice
                : weekdayBase);
          return (
            <WorkspaceDialog
              dark
              title={new Date(`${selectedDay}T12:00:00`).toLocaleDateString(
                "en",
                {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                },
              )}
              onClose={() => setSelectedDay(null)}
              maxWidth="max-w-sm"
            >
              <div className="space-y-5">
                {/* Availability Status & Toggle */}
                <div className="flex items-center justify-between rounded-xl bg-white/10 p-4">
                  <span className="text-sm font-medium flex items-center gap-2 text-white">
                    <span
                      className={`size-2.5 rounded-full ${
                        listing.blockedDates.includes(selectedDay)
                          ? "bg-zinc-400"
                          : "bg-emerald-400"
                      }`}
                    />
                    {listing.blockedDates.includes(selectedDay)
                      ? "Blocked"
                      : "Available"}
                  </span>

                  <button
                    disabled={saving}
                    role="switch"
                    aria-checked={!listing.blockedDates.includes(selectedDay)}
                    onClick={() =>
                      save({
                        blockedDates: listing.blockedDates.includes(selectedDay)
                          ? listing.blockedDates.filter((d) => d !== selectedDay)
                          : [...listing.blockedDates, selectedDay],
                      })
                    }
                    className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
                  >
                    {saving
                      ? "Saving…"
                      : listing.blockedDates.includes(selectedDay)
                        ? "Make available"
                        : "Block date"}
                  </button>
                </div>

                {/* Base Price & Custom Override */}
                <div className="rounded-xl bg-white/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-300">
                      {hasCustom
                        ? "Custom Calendar Price"
                        : isWeekendDay && listing.weekendPrice
                        ? "Weekend Rate"
                        : "Weekday Base Rate"}
                    </span>
                    {hasCustom && (
                      <span className="text-[10px] bg-amber-400 text-zinc-900 px-2 py-0.5 rounded-full font-bold">
                        OVERRIDE
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white">
                      {formatPrice(currentRate, sourceCurrency, 2)}
                    </span>
                    {hasCustom && (
                      <span className="text-xs text-zinc-400 line-through">
                        {formatPrice(isWeekendDay && listing.weekendPrice ? listing.weekendPrice : weekdayBase, sourceCurrency, 2)}
                      </span>
                    )}
                  </div>

                  {/* Custom Price Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const customVal = Number(formData.get("customPrice"));
                      const nextCustom = { ...customPrices };
                      if (customVal > 0) {
                        nextCustom[selectedDay] = Math.round(customVal * 100);
                      } else {
                        delete nextCustom[selectedDay];
                      }
                      save({ customPrices: nextCustom });
                    }}
                    className="pt-2 border-t border-white/10 space-y-2"
                  >
                    <label className="block text-[11px] text-zinc-300 font-medium">
                      Set custom price for this night ({sourceCurrency})
                    </label>
                    <div className="flex gap-2">
                      <input
                        name="customPrice"
                        type="number"
                        min="0"
                        step="1"
                        placeholder={String(currentRate / 100)}
                        defaultValue={hasCustom ? currentRate / 100 : ""}
                        className="flex-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs text-white placeholder:text-zinc-400 outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-amber-400 hover:bg-amber-300 px-3 py-1.5 text-xs font-bold text-zinc-950 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {saving ? "..." : "Set"}
                      </button>
                      {hasCustom && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            const nextCustom = { ...customPrices };
                            delete nextCustom[selectedDay];
                            save({ customPrices: nextCustom });
                          }}
                          className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </WorkspaceDialog>
          );
        })()}

        {/* Reservation Details Drawer / Modal */}
        {selectedBooking && (
          <ReservationDetails
            booking={selectedBooking}
            listing={listing}
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
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200/60 dark:border-amber-900/60">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mb-1">
                  Local demand is rising
                </h4>
                <p className="text-xs text-amber-900 dark:text-amber-300">
                  Properties in your area typically command 15% higher nightly
                  rates on weekends and during seasonal holidays.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 list-disc list-inside">
                <li>
                  Turn on Smart Pricing to automatically optimize rates based on
                  real-time search trends.
                </li>
                <li>
                  Add a 5% weekly discount to attract guests looking for
                  medium-length stays.
                </li>
                <li>
                  Use custom date pricing for upcoming events in the city.
                </li>
              </ul>
              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setTips(false)}
                  className="rounded-full bg-[#1F1F1F] dark:bg-zinc-100 px-6 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-black dark:hover:bg-white transition-colors cursor-pointer"
                >
                  Got it
                </button>
              </div>
            </div>
          </WorkspaceDialog>
        )}
      </main>
    </>
  );
}
