"use client";

import { useState } from "react";
import Link from "next/link";
import { HostSubNav } from "./host-sub-nav";
import { updateListingAction } from "@/actions/host/listings";
import type { ListingDTO } from "@/services/mappers";
import {
  PropertyPhoto,
  WorkspaceDialog,
  ReservationDetails,
  MoneyDialog,
  dateKey,
  money,
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
        className={`mb-3 grid grid-cols-7 text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wider ${
          compact ? "max-sm:hidden text-[9px]" : ""
        }`}
      >
        {weekdays.map((d) => (
          <span key={d}>
            <span className={compact ? "hidden" : "hidden xl:inline"}>{d}</span>
            <span className={compact ? "" : "xl:hidden"}>{d[0]}</span>
          </span>
        ))}
      </div>
      <div className={`grid grid-cols-7 ${compact ? "gap-1" : "gap-1.5 sm:gap-2"}`}>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} className="min-h-12" />
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
          const isWeekend = date.getDay() === 5 || date.getDay() === 6;
          const rate =
            isWeekend && listing.weekendPrice != null
              ? listing.weekendPrice
              : listing.price;
          const isToday = key === today;

          return (
            <button
              key={key}
              onClick={() => onDay(key, reservation)}
              aria-label={`${key}, ${reservation ? `reserved by ${reservation.guestName}` : blocked ? "blocked" : "available"}, ${money(rate)}`}
              className={`group relative flex min-w-0 flex-col items-center justify-between rounded-xl border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                compact
                  ? "min-h-3 rounded-full bg-transparent p-0 sm:min-h-12 sm:rounded-lg sm:bg-zinc-50 sm:py-1"
                  : "min-h-20 p-2 sm:min-h-24 lg:min-h-28"
              } ${
                reservation
                  ? "border-zinc-900 bg-zinc-900 text-white shadow-xs"
                  : blocked
                    ? "border-zinc-200 bg-zinc-100/60 opacity-60"
                    : "border-zinc-200/80 bg-[#FAFAFA] hover:border-zinc-400 hover:bg-white text-zinc-900 shadow-2xs"
              }`}
            >
              {/* Day Number */}
              <span
                className={`flex items-center justify-center rounded-full font-semibold transition-transform ${
                  compact
                    ? "size-1 max-sm:bg-zinc-500 text-[0px] sm:size-6 sm:text-[10px]"
                    : "size-6 text-xs sm:size-7 sm:text-xs"
                } ${
                  isToday
                    ? "bg-[#FDE29B] text-zinc-900 shadow-xs"
                    : reservation
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-800 group-hover:bg-zinc-200"
                } ${blocked ? "line-through text-zinc-400" : ""}`}
              >
                {i + 1}
              </span>

              {/* Price / Status */}
              <span
                className={`${compact ? "hidden sm:block" : ""} mt-1 text-[9px] sm:text-[11px] font-medium tracking-tight ${
                  reservation
                    ? "text-zinc-300"
                    : blocked
                      ? "text-zinc-400 line-through"
                      : "text-zinc-700"
                }`}
              >
                {blocked ? "Blocked" : money(rate)}
              </span>

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
  price: 42100, // SR 421
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
  const listings = initialListings.length > 0 ? initialListings : [DEFAULT_DEMO_LISTING];
  const bookings = initialBookings.length > 0 ? initialBookings : SAMPLE_CALENDAR_BOOKINGS;

  const [selectedId, setSelectedId] = useState(listings[0]?.id || DEFAULT_DEMO_LISTING.id);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [view, setView] = useState<"month" | "year">("month");
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [priceSettingsOpen, setPriceSettingsOpen] = useState(true);
  const [availSettingsOpen, setAvailSettingsOpen] = useState(true);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<HostReservation | null>(null);
  const [showMoney, setShowMoney] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [tips, setTips] = useState(false);

  // Editable price form state
  const listing = listings.find((l) => l.id === selectedId) || listings[0];
  const [basePriceInput, setBasePriceInput] = useState<number>(listing ? listing.price / 100 : 421);
  const [isSmartPricing, setIsSmartPricing] = useState<boolean>(true);

  async function save(values: Record<string, unknown>) {
    if (!listing || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const result = await updateListingAction(listing.id, values);
      if (result.ok) {
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

  function changeMonth(amount: number) {
    setMonth(
      new Date(
        month.getFullYear(),
        month.getMonth() + (view === "year" ? amount * 12 : amount),
        1,
      ),
    );
  }

  return (
    <>
      <HostSubNav activeTab="calendar" />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 pb-24 pt-8 sm:px-8 sm:pt-10">
        {/* Mobile Title */}
        <h1 className="mb-6 text-2xl font-bold text-zinc-900 sm:hidden">Calendars</h1>

        {/* Top Control Bar: Month Selector, Price Tips, View Toggle */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-5">
          {/* Left: Month Dropdown + Prev/Next Buttons */}
          <div className="relative flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                className="flex items-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 hover:text-zinc-600 transition-colors"
              >
                <span>
                  {view === "year" ? month.getFullYear() : `${monthName(month)}`}
                </span>
                <span className="text-base text-zinc-400">⌄</span>
              </button>

              {/* Month Picker Dropdown */}
              {showMonthDropdown && (
                <div className="absolute left-0 top-full z-50 mt-2 grid w-64 grid-cols-3 gap-1 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl">
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
                          ? "bg-[#FDE29B] text-zinc-900"
                          : "hover:bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Steppers */}
            <div className="flex items-center gap-1 text-zinc-500">
              <button
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
                className="flex size-8 items-center justify-center rounded-full hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              >
                ‹
              </button>
              <button
                aria-label="Next month"
                onClick={() => changeMonth(1)}
                className="flex size-8 items-center justify-center rounded-full hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              >
                ›
              </button>
            </div>
          </div>

          {/* Right: Price tips, Month/Year switcher, Settings (mobile) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setTips(true)}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 transition-colors shadow-2xs"
            >
              <span className="text-amber-500">✨</span>
              <span>Price tips</span>
            </button>

            {/* View Switcher: Month / Year */}
            <div className="flex items-center rounded-full border border-zinc-200 bg-zinc-100/80 p-0.5">
              <button
                type="button"
                onClick={() => setView("month")}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  view === "month"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setView("year")}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  view === "year"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Year
              </button>
            </div>

            {/* Mobile Settings Toggle */}
            <button
              type="button"
              onClick={() => setMobileSettingsOpen(true)}
              className="rounded-full bg-[#1F1F1F] px-4 py-2 text-xs font-semibold text-white sm:hidden"
            >
              Settings
            </button>
          </div>
        </div>

        {/* Main 3-Column Layout: Left Rail | Center Matrix | Right Sidebar */}
        <div className="flex items-start gap-6 lg:gap-8">
          {/* 1. Left Rail: Property Switcher Thumbnails */}
          <aside
            aria-label="Property selection"
            className="hidden sm:flex flex-col items-center gap-3 w-16 shrink-0"
          >
            {listings.map((l) => {
              const isSelected = l.id === selectedId;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  title={l.title}
                  className={`group relative size-14 rounded-2xl overflow-hidden transition-all ${
                    isSelected
                      ? "ring-3 ring-zinc-900 shadow-md scale-105"
                      : "opacity-75 hover:opacity-100 hover:scale-102 border border-zinc-200"
                  }`}
                >
                  <PropertyPhoto listing={l} className="size-full object-cover" />
                </button>
              );
            })}

            {/* Placeholder slots matching Figma design */}
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`placeholder-${idx}`}
                className="size-14 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 flex items-center justify-center text-zinc-300"
              />
            ))}
          </aside>

          {/* 2. Center Calendar Matrix */}
          <div className="min-w-0 flex-1">
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
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(month.getFullYear(), i, 1);
                  return (
                    <section key={i} className="rounded-2xl border border-zinc-100 p-4 bg-zinc-50/40">
                      <button
                        type="button"
                        onClick={() => {
                          setMonth(d);
                          setView("month");
                        }}
                        className="mb-4 text-sm font-bold text-zinc-900 hover:text-amber-700 flex items-center justify-between w-full"
                      >
                        <span>{monthName(d)}</span>
                        <span className="text-xs text-zinc-400 font-normal">Open ›</span>
                      </button>
                      <MonthGrid
                        month={d}
                        listing={listing}
                        bookings={bookings}
                        compact
                        onDay={openDay}
                      />
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Right Sidebar: Pricing & Availability Panels (Desktop) */}
          <aside className="hidden lg:flex w-80 xl:w-96 shrink-0 flex-col gap-5 border-l border-zinc-100 pl-6 xl:pl-8">
            {/* Card 1: Price settings */}
            <div className="rounded-2xl border border-zinc-200 p-5 bg-white shadow-xs">
              <button
                type="button"
                onClick={() => setPriceSettingsOpen(!priceSettingsOpen)}
                className="flex w-full items-center justify-between text-left font-bold text-base text-zinc-900"
              >
                <span>Price settings</span>
                <span className="text-sm text-zinc-400">{priceSettingsOpen ? "⌄" : "›"}</span>
              </button>

              {priceSettingsOpen && (
                <div className="mt-4 space-y-4 text-xs">
                  <p className="text-zinc-500 leading-relaxed">
                    These apply to all nights, unless you customize them by date.
                  </p>

                  {/* Base Price Input */}
                  <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                    <label className="block text-zinc-500 font-medium mb-1">Base price</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900">SR</span>
                      <input
                        type="number"
                        min="0"
                        value={basePriceInput}
                        onChange={(e) => setBasePriceInput(Number(e.target.value))}
                        className="w-full bg-transparent text-lg font-bold text-zinc-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => save({ price: Math.round(basePriceInput * 100) })}
                        disabled={saving}
                        className="rounded-full bg-[#1F1F1F] text-white px-3 py-1 font-medium hover:bg-black text-[11px] disabled:opacity-50 shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Custom Weekend Price */}
                  <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                    <div>
                      <span className="font-semibold text-zinc-800">Custom weekend price</span>
                      <span className="block text-zinc-500">
                        {listing.weekendPrice ? money(listing.weekendPrice) : "Not set"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        save({
                          weekendPrice: listing.weekendPrice ? null : Math.round(listing.price * 1.25),
                        })
                      }
                      className="size-7 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:bg-zinc-100"
                    >
                      +
                    </button>
                  </div>

                  {/* Smart Pricing Toggle */}
                  <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                    <div>
                      <span className="font-semibold text-zinc-800">Smart pricing</span>
                      <span className="block text-zinc-500">Automatically adjust rates</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSmartPricing}
                      onClick={() => {
                        const next = !isSmartPricing;
                        setIsSmartPricing(next);
                        save({ smartPricing: next });
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        isSmartPricing ? "bg-[#1F1F1F]" : "bg-zinc-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isSmartPricing ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Discounts */}
                  <div className="py-2 border-b border-zinc-100 space-y-2">
                    <span className="font-semibold text-zinc-800">Discounts</span>
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>Weekly (7 nights +)</span>
                      <span className="font-semibold text-zinc-900">5%</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>Monthly (28 nights +)</span>
                      <span className="font-semibold text-zinc-900">10%</span>
                    </div>
                    <button type="button" className="text-zinc-500 hover:text-zinc-900 font-medium">
                      + More discounts: Early birds / Last minute
                    </button>
                  </div>

                  {/* Promotions & Additional Charges */}
                  <div className="py-1 space-y-2">
                    <button type="button" className="flex items-center justify-between w-full text-zinc-700 hover:text-zinc-900 font-medium">
                      <span>+ Custom promotion</span>
                      <span>›</span>
                    </button>
                    <button type="button" className="flex items-center justify-between w-full text-zinc-700 hover:text-zinc-900 font-medium">
                      <span>+ Fees (Cleaning, pets, guests)</span>
                      <span>›</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Available settings */}
            <div className="rounded-2xl border border-zinc-200 p-5 bg-white shadow-xs">
              <button
                type="button"
                onClick={() => setAvailSettingsOpen(!availSettingsOpen)}
                className="flex w-full items-center justify-between text-left font-bold text-base text-zinc-900"
              >
                <span>Available settings</span>
                <span className="text-sm text-zinc-400">{availSettingsOpen ? "⌄" : "›"}</span>
              </button>

              {availSettingsOpen && (
                <div className="mt-4 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <span className="text-zinc-600">Trip length</span>
                    <span className="font-semibold text-zinc-900">
                      {listing.minNights}–{listing.maxNights} nights
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <span className="text-zinc-600">Advance notice</span>
                    <span className="font-semibold text-zinc-900">Same day notice</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <span className="text-zinc-600">Preparation time</span>
                    <span className="font-semibold text-zinc-900">None</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <span className="text-zinc-600">Availability window</span>
                    <span className="font-semibold text-zinc-900">6 months in advance</span>
                  </div>

                  <div className="pt-1">
                    <Link
                      href={`/host/listings/${listing.id}/availability`}
                      className="text-xs font-semibold text-zinc-900 underline hover:text-amber-800"
                    >
                      Connect calendars (iCal sync)
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {notice && (
              <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
                {notice}
              </p>
            )}
          </aside>
        </div>

        {/* Mobile Settings Dialog */}
        {mobileSettingsOpen && (
          <WorkspaceDialog
            title="Settings"
            onClose={() => setMobileSettingsOpen(false)}
            maxWidth="max-w-md"
          >
            <div className="space-y-6">
              <div className="rounded-xl bg-zinc-50 p-4">
                <label className="block text-xs text-zinc-500 font-medium mb-1">Base nightly price</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">SR</span>
                  <input
                    type="number"
                    value={basePriceInput}
                    onChange={(e) => setBasePriceInput(Number(e.target.value))}
                    className="w-full bg-transparent text-lg font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => save({ price: Math.round(basePriceInput * 100) })}
                    className="rounded-full bg-[#1F1F1F] text-white px-4 py-1 text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 text-sm">
                <span>Smart pricing</span>
                <button
                  type="button"
                  onClick={() => setIsSmartPricing(!isSmartPricing)}
                  className={`size-6 rounded-full ${isSmartPricing ? "bg-emerald-500" : "bg-zinc-300"}`}
                />
              </div>

              <div className="text-xs text-zinc-500">
                Trip length: {listing.minNights}–{listing.maxNights} nights • Same day advance notice
              </div>
            </div>
          </WorkspaceDialog>
        )}

        {/* Date-Level Quick Edit Drawer / Popover (Frame 02:44) */}
        {selectedDay && listing && (
          <WorkspaceDialog
            dark
            title={new Date(`${selectedDay}T12:00:00`).toLocaleDateString("en", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            onClose={() => setSelectedDay(null)}
            maxWidth="max-w-sm"
          >
            <div className="space-y-5">
              {/* Availability Status & Toggle */}
              <div className="flex items-center justify-between rounded-xl bg-white/10 p-4">
                <span className="text-sm font-medium flex items-center gap-2">
                  <span
                    className={`size-2.5 rounded-full ${
                      listing.blockedDates.includes(selectedDay) ? "bg-zinc-400" : "bg-emerald-400"
                    }`}
                  />
                  {listing.blockedDates.includes(selectedDay) ? "Blocked" : "Available"}
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
                  className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50"
                >
                  {saving
                    ? "Saving…"
                    : listing.blockedDates.includes(selectedDay)
                      ? "Make available"
                      : "Block date"}
                </button>
              </div>

              {/* Price Row matching Frame 02:44 */}
              <div className="rounded-xl bg-white/10 p-4 space-y-1">
                <span className="text-xs text-zinc-300">Last minute price</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    {money(Math.round(listing.price * 0.7))}
                  </span>
                  <span className="text-sm text-zinc-400 line-through">
                    {money(listing.price)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedDay(null);
                  setTips(true);
                }}
                className="flex w-full items-center justify-between rounded-xl bg-white/10 p-4 text-xs font-medium text-white hover:bg-white/15 transition-colors"
              >
                <span>Custom setting</span>
                <span className="text-lg">+</span>
              </button>
            </div>
          </WorkspaceDialog>
        )}

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
          <WorkspaceDialog title="Price tips" onClose={() => setTips(false)} maxWidth="max-w-md">
            <div className="space-y-4 text-sm text-zinc-700 leading-relaxed">
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-200/60">
                <h4 className="font-bold text-zinc-900 text-sm mb-1">Local demand is rising</h4>
                <p className="text-xs text-amber-900">
                  Properties in your area typically command 15% higher nightly rates on weekends and during seasonal holidays.
                </p>
              </div>
              <ul className="space-y-2 text-xs text-zinc-600 list-disc list-inside">
                <li>Turn on Smart Pricing to automatically optimize rates based on real-time search trends.</li>
                <li>Add a 5% weekly discount to attract guests looking for medium-length stays.</li>
                <li>Use custom date pricing for upcoming events in the city.</li>
              </ul>
              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setTips(false)}
                  className="rounded-full bg-[#1F1F1F] px-6 py-2 text-xs font-semibold text-white hover:bg-black"
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
