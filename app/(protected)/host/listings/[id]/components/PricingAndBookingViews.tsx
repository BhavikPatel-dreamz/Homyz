"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities -- legacy editor callback and copy surface; narrowed incrementally outside E4. */

import { BackButton } from "@/components/ui/back-button";

import React from "react";
import { isReservedSlug } from "@/lib/utils/slug";

interface PricingAndBookingViewsProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  isSaving: boolean;
  handleSaveSection: (sectionKey: any) => void;

  // Pricing & Availability
  editPrice: number;
  setEditPrice: (val: number) => void;
  smartPricing?: boolean;
  setSmartPricing?: (val: boolean) => void;
  smartPricingMinPrice?: number;
  setSmartPricingMinPrice?: (val: number) => void;
  smartPricingMaxPrice?: number;
  setSmartPricingMaxPrice?: (val: number) => void;
  weekendPrice?: number;
  weekendPremium?: number;
  setWeekendPremium?: (val: number) => void;
  weeklyDiscount: number;
  setWeeklyDiscount: (val: number) => void;
  monthlyDiscount: number;
  setMonthlyDiscount: (val: number) => void;
  minNights: number;
  setMinNights: (val: number) => void;
  maxNights: number;
  setMaxNights: (val: number) => void;
  advanceNotice?: string;
  setAdvanceNotice?: (val: string) => void;
  sameDayCutoff?: string;
  setSameDayCutoff?: (val: string) => void;
  allowSameDayRequests?: boolean;
  setAllowSameDayRequests?: (val: boolean) => void;

  // Booking Settings
  bookingMethod: "first-three" | "instant" | "approve";
  requireGoodTrackRecord: boolean;
  approvedBookingCount: number;
  hasCustomBookingMessage: boolean;
  saveBookingSettings: (next: {
    bookingMethod: "first-three" | "instant" | "approve";
    requireGoodTrackRecord: boolean;
  }) => Promise<boolean>;
  openCustomMessage: () => void;

  // Cancellation Policy & Custom Link
  cancellationPolicy: string;
  setCancellationPolicy: (val: string) => void;
  longTermCancellationPolicy: "FIRM" | "STRICT";
  setLongTermCancellationPolicy: (val: "FIRM" | "STRICT") => void;
  customSlug?: string;
  setCustomSlug?: (val: string) => void;
}

export function PricingAndBookingViews({
  activeSection,
  setActiveSection,
  isSaving,
  handleSaveSection,
  editPrice,
  setEditPrice,
  smartPricing = false,
  setSmartPricing,
  smartPricingMinPrice = 0,
  setSmartPricingMinPrice,
  smartPricingMaxPrice = 0,
  setSmartPricingMaxPrice,
  weekendPrice = 0,
  weekendPremium = 0,
  setWeekendPremium,
  weeklyDiscount,
  setWeeklyDiscount,
  monthlyDiscount,
  setMonthlyDiscount,
  minNights,
  setMinNights,
  maxNights,
  setMaxNights,
  advanceNotice = "Same day",
  setAdvanceNotice,
  sameDayCutoff = "12:00 AM",
  setSameDayCutoff,
  allowSameDayRequests = true,
  setAllowSameDayRequests,
  bookingMethod: _bookingMethod,
  requireGoodTrackRecord,
  approvedBookingCount,
  hasCustomBookingMessage,
  saveBookingSettings,
  openCustomMessage,
  cancellationPolicy,
  setCancellationPolicy,
  longTermCancellationPolicy,
  setLongTermCancellationPolicy,
  customSlug = "",
  setCustomSlug,
}: PricingAndBookingViewsProps) {
  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* VIEW: PRICING & AVAILABILITY */}
      {/* --------------------------------------------------------- */}
      {/* --------------------------------------------------------- */}
      {/* VIEW: PRICING */}
      {/* --------------------------------------------------------- */}
      {activeSection === "pricing" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Header & Back Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BackButton onClick={() => setActiveSection("description")} />
              <h1>Pricing</h1>
            </div>

          </div>

          <div className="space-y-5 pt-1">
            {/* 1. Nightly Price Card */}
            <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#1F1F1F]">{smartPricing ? "Smart pricing range" : "Nightly price"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-700">Smart pricing</span>
                  <button
                    type="button"
                    aria-label="Toggle smart pricing"
                    onClick={() => setSmartPricing?.(!smartPricing)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      smartPricing ? "bg-amber-400" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                        smartPricing ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {smartPricing ? (
                <div className="space-y-3 pt-1">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <label className="mb-2 block text-xs font-semibold text-zinc-700">Minimum price*</label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-semibold text-[#1F1F1F] tracking-tight">SR</span>
                      <input
                        type="number"
                        min={0}
                        value={smartPricingMinPrice || ""}
                        onChange={(e) => setSmartPricingMinPrice?.(Number(e.target.value || 0))}
                        className="w-full text-xl font-semibold text-[#1F1F1F] tracking-tight outline-none bg-transparent placeholder:text-zinc-300"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <label className="mb-2 block text-xs font-semibold text-zinc-700">Maximum price</label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-semibold text-[#1F1F1F] tracking-tight">SR</span>
                      <input
                        type="number"
                        min={0}
                        value={smartPricingMaxPrice || ""}
                        onChange={(e) => setSmartPricingMaxPrice?.(Number(e.target.value || 0))}
                        className="w-full text-xl font-semibold text-[#1F1F1F] tracking-tight outline-none bg-transparent placeholder:text-zinc-300"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-semibold text-[#1F1F1F] tracking-tight">SR</span>
                  <input
                    type="number"
                    value={editPrice || ""}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    placeholder="100"
                    className="w-full text-2xl font-semibold text-[#1F1F1F] tracking-tight outline-none bg-transparent placeholder:text-zinc-300"
                  />
                </div>
              )}
            </div>

            {!smartPricing && (
              <>
            {/* 2. Weekend adjustment */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#1F1F1F]">Weekend adjustment</label>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">% premium</span>
              </div>

              <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label="Decrease weekend premium"
                      onClick={() => setWeekendPremium?.((weekendPremium || 0) - 1)}
                      className="w-8 h-8 rounded-full border border-zinc-200 bg-zinc-50 text-lg font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      −
                    </button>
                    <div className="min-w-[72px] text-center">
                      <span className="text-lg font-semibold text-[#1F1F1F]">{weekendPremium || 0}%</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Increase weekend premium"
                      onClick={() => setWeekendPremium?.((weekendPremium || 0) + 1)}
                      className="w-8 h-8 rounded-full border border-zinc-200 bg-zinc-50 text-lg font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Weekend rate</div>
                    <div className="text-sm font-semibold text-[#1F1F1F]">SR {weekendPrice || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Discounts section */}
            <div className="space-y-3 pt-1">
              <label className="block text-xs font-semibold text-[#1F1F1F]">Discounts</label>

              {/* Weekly discount card */}
              <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 flex items-center justify-between shadow-2xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block">
                    WEEKLY - FOR 7+ NIGHTS
                  </span>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      value={weeklyDiscount || ""}
                      onChange={(e) => setWeeklyDiscount(Number(e.target.value))}
                      placeholder="5"
                      className="w-12 text-lg font-semibold text-[#1F1F1F] outline-none bg-transparent underline underline-offset-4 decoration-zinc-300 placeholder:text-zinc-300"
                    />
                    <span className="text-lg font-semibold text-[#1F1F1F]">%</span>
                  </div>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  weekly average is SR{weeklyDiscount ? Math.round((editPrice || 100) * 7 * (1 - weeklyDiscount / 100)) : 665}
                </span>
              </div>

              {/* Monthly discount card */}
              <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 flex items-center justify-between shadow-2xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block">
                    MONTHLY - FOR 28+ NIGHTS
                  </span>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      value={monthlyDiscount || ""}
                      onChange={(e) => setMonthlyDiscount(Number(e.target.value))}
                      placeholder="10"
                      className="w-12 text-lg font-semibold text-[#1F1F1F] outline-none bg-transparent underline underline-offset-4 decoration-zinc-300 placeholder:text-zinc-300"
                    />
                    <span className="text-lg font-semibold text-[#1F1F1F]">%</span>
                  </div>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  monthly average is SR{monthlyDiscount ? Math.round((editPrice || 100) * 30 * (1 - monthlyDiscount / 100)) : 2700}
                </span>
              </div>
            </div>
              </>
            )}

            {/* 4. Calendar notice card */}
            <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 hover:bg-zinc-100/80 p-4 flex items-center gap-3 shadow-2xs transition-all cursor-pointer">
              <span className="text-lg">🏪</span>
              <span className="font-medium text-base text-[#1F1F1F]">Find more discounts and fees in the calendar</span>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveSection("pricing")}
                className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: AVAILABILITY */}
      {/* --------------------------------------------------------- */}
      {activeSection === "availability" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Header & Back Button */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <BackButton onClick={() => setActiveSection("description")} />
              <h1>Availability</h1>
            </div>
            <p className="text-base text-[#727272] font-normal pl-11">
              *These settings apply to all nights, unless you customize them by date.{" "}
              <a href="#" onClick={(e) => e.preventDefault()} className="underline cursor-pointer hover:text-zinc-700">
                Learn more
              </a>
            </p>
          </div>

          <div className="space-y-6 pt-1">
            {/* 1. Trip length */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-zinc-800">Trip length</label>

              {/* Minimum nights box */}
              <div className="relative rounded-2xl border border-zinc-300 bg-white px-4 py-3 shadow-2xs flex items-center justify-between">
                <input
                  type="number"
                  value={minNights}
                  onChange={(e) => setMinNights(Number(e.target.value))}
                  className="w-24 text-base font-semibold text-[#1F1F1F] outline-none bg-transparent"
                />
                <span className="text-xs text-zinc-400 font-normal">Minimum nights</span>
              </div>

              {/* Maximum nights box */}
              <div className="relative rounded-2xl border border-zinc-300 bg-white px-4 py-3 shadow-2xs flex items-center justify-between">
                <input
                  type="number"
                  value={maxNights}
                  onChange={(e) => setMaxNights(Number(e.target.value))}
                  className="w-24 text-base font-semibold text-[#1F1F1F] outline-none bg-transparent"
                />
                <span className="text-xs text-zinc-400 font-normal">Maximum nights</span>
              </div>
            </div>

            {/* 2. Advance notice */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-800">Advance notice</label>
                <p className="text-base text-[#727272] font-normal pt-0.5">
                  *How much notice do you need between a guest's booking and their arrival?
                </p>
              </div>

              {/* Dropdown 1: Same day */}
              <div className="relative">
                <select
                  value={advanceNotice}
                  onChange={(e) => setAdvanceNotice?.(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="Same day">Same day</option>
                  <option value="At least 1 day">At least 1 day</option>
                  <option value="At least 2 days">At least 2 days</option>
                  <option value="At least 3 days">At least 3 days</option>
                  <option value="At least 7 days">At least 7 days</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>

              <p className="text-base text-[#727272] font-normal pt-1">
                Guests can book on the same day as check-in until this time.
              </p>

              {/* Dropdown 2: 12:00 AM */}
              <div className="relative">
                <select
                  value={sameDayCutoff}
                  onChange={(e) => setSameDayCutoff?.(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="12:00 AM">12:00 AM</option>
                  <option value="6:00 AM">6:00 AM</option>
                  <option value="12:00 PM">12:00 PM</option>
                  <option value="3:00 PM">3:00 PM</option>
                  <option value="6:00 PM">6:00 PM</option>
                  <option value="9:00 PM">9:00 PM</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 3. Allow requests for the same day */}
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <h4 className="font-semibold text-xs text-zinc-800">Allow requests for the same day</h4>
                <p className="text-base text-[#727272] font-normal">
                  You'll review and approve each reservation request.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllowSameDayRequests?.(!allowSameDayRequests)}
                className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center shrink-0 cursor-pointer ${
                  allowSameDayRequests ? "bg-[#F43F5E] justify-end" : "bg-zinc-300 justify-start"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
              </button>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveSection("availability")}
                className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 7: BOOKING SETTINGS */}
      {/* --------------------------------------------------------- */}
      {/* --------------------------------------------------------- */}
      {/* VIEW: BOOKING SETTINGS (Matches Figma Screenshots 100%) */}
      {/* --------------------------------------------------------- */}
      {activeSection === "booking-settings" && (
        <div className="max-w-[608px] space-y-4 pb-10 font-sans animate-in fade-in">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => setActiveSection("description")} />
            <h1>Booking settings</h1>
          </div>

          <section className={`rounded-2xl border-2 bg-white px-6 py-5 shadow-2xs transition-colors ${_bookingMethod === "first-three" ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400"}`}>
            <button type="button" disabled={isSaving} onClick={() => _bookingMethod !== "first-three" && saveBookingSettings({ bookingMethod: "first-three", requireGoodTrackRecord })} className="flex w-full items-start justify-between gap-5 text-left disabled:cursor-wait">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Approve your first 3 bookings</h2>
                <p className="mt-0.5 text-sm font-medium text-emerald-600">{Math.min(approvedBookingCount, 3)} of 3 approved</p>
                <p className="mt-1 text-sm leading-5 text-zinc-600">Review your first three requests. After three confirmed bookings, new guests can book automatically.</p>
              </div>
              <svg aria-hidden="true" className="mt-1 size-8 shrink-0 text-zinc-800" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z"/><path strokeLinecap="round" strokeLinejoin="round" d="m8.5 15 2.2 2.2 4.8-5"/></svg>
            </button>
          </section>

          <section className={`rounded-2xl border-2 bg-white px-6 py-5 transition-colors ${_bookingMethod === "instant" ? "border-zinc-900" : "border-zinc-200"}`}>
            <button type="button" disabled={isSaving} onClick={() => _bookingMethod !== "instant" && saveBookingSettings({ bookingMethod: "instant", requireGoodTrackRecord })} className="flex w-full items-start justify-between gap-5 text-left disabled:cursor-wait">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Use Instant Book</h2>
                <p className="mt-0.5 text-sm leading-5 text-zinc-600">Let guests book automatically, which can help you get more bookings.</p>
              </div>
              <svg aria-hidden="true" className="mt-0.5 size-8 shrink-0 text-zinc-900" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z"/></svg>
            </button>

            <div className="my-5 border-t border-zinc-200" />
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Require a good track record</h3>
                  <p className="mt-0.5 text-sm leading-5 text-zinc-600">Only allow guests with a previous completed, confirmed stay on Homyz.</p>
                </div>
                <button type="button" role="switch" aria-checked={requireGoodTrackRecord} aria-label="Require a good track record" disabled={isSaving || _bookingMethod !== "instant"} onClick={() => saveBookingSettings({ bookingMethod: "instant", requireGoodTrackRecord: !requireGoodTrackRecord })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${requireGoodTrackRecord && _bookingMethod === "instant" ? "bg-[#E9C979]" : "bg-zinc-300"}`}>
                  <span className={`block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-zinc-200 transition-transform ${requireGoodTrackRecord && _bookingMethod === "instant" ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <button type="button" disabled={isSaving || _bookingMethod !== "instant"} onClick={openCustomMessage} className="flex w-full items-center justify-between gap-4 text-left disabled:cursor-not-allowed disabled:opacity-55">
                <div><h3 className="text-sm font-semibold text-zinc-900">Add a custom message</h3><p className="mt-0.5 text-sm leading-5 text-zinc-600">{hasCustomBookingMessage ? "Custom message added for guests." : "Guests must read this before booking."}</p></div>
                <span aria-hidden="true" className="text-3xl font-light leading-none text-zinc-800">›</span>
              </button>
            </div>
          </section>

          <button type="button" disabled={isSaving} onClick={() => _bookingMethod !== "approve" && saveBookingSettings({ bookingMethod: "approve", requireGoodTrackRecord })} className={`flex w-full items-center justify-between gap-5 rounded-2xl border-2 bg-white px-6 py-5 text-left transition-colors disabled:cursor-wait ${_bookingMethod === "approve" ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400"}`}>
            <div><h2 className="text-base font-semibold text-zinc-900">Approve all bookings</h2><p className="mt-0.5 text-sm leading-5 text-zinc-600">Always review reservation requests.</p></div>
            <svg aria-hidden="true" className="size-8 shrink-0 text-zinc-900" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a2 2 0 012 2v10a2 2 0 01-2 2h-5l-4 3v-3H6a2 2 0 01-2-2V6a2 2 0 012-2Z"/><path strokeLinecap="round" d="M8 9h8M8 13h5"/></svg>
          </button>
          {isSaving && (
            <div role="status" className="flex items-center gap-2 px-1 text-sm font-medium text-zinc-600">
              <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
              Saving booking preference…
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: CUSTOM LINK (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      {activeSection === "cancellation-policy" && (
        <CancellationPolicyView
          cancellationPolicy={cancellationPolicy}
          setCancellationPolicy={setCancellationPolicy}
          longTermCancellationPolicy={longTermCancellationPolicy}
          setLongTermCancellationPolicy={setLongTermCancellationPolicy}
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
        />
      )}

      {activeSection === "custom-link" && (() => {
        const trimmedSlug = (customSlug || "").trim();
        const hasInput = trimmedSlug.length > 0;
        const tooShort = hasInput && trimmedSlug.length < 3;
        const tooLong = trimmedSlug.length > 100;
        const reserved = hasInput && isReservedSlug(trimmedSlug);
        const invalidChars = hasInput && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug);
        const isSlugValid = !hasInput || (!tooShort && !tooLong && !reserved && !invalidChars);

        return (
          <div className="animate-in fade-in max-w-xl min-h-[420px] flex flex-col items-center justify-center font-sans">
            <div className="flex flex-col items-center justify-center space-y-6 w-full py-12">
              {/* Counter text */}
              <span className="text-xs font-semibold text-zinc-700 tracking-tight">
                {Math.max(0, 100 - (customSlug?.length || 0))}/100 characters available
              </span>

              {/* homyz/stay/ slug input field */}
              <div className="flex items-center justify-center text-3xl sm:text-4xl font-semibold text-[#1F1F1F] tracking-tight">
                <span className="text-zinc-500">homyz/stay/</span>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) =>
                    setCustomSlug?.(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  placeholder="your-space"
                  className="outline-none bg-transparent border-b-2 border-transparent focus:border-amber-400 text-[#1F1F1F] font-semibold min-w-[60px] max-w-[280px]"
                  autoFocus
                />
              </div>

              {/* Validation feedback */}
              <div className="text-xs text-center min-h-[20px]">
                {tooShort && (
                  <span className="text-red-500 font-medium">Link must be at least 3 characters.</span>
                )}
                {reserved && (
                  <span className="text-red-500 font-medium">This link is a reserved system route.</span>
                )}
                {invalidChars && !tooShort && (
                  <span className="text-red-500 font-medium">Use lowercase letters, numbers, and single hyphens.</span>
                )}
                {hasInput && isSlugValid && !tooShort && (
                  <span className="text-emerald-600 font-medium">Valid link: homyz.com/stay/{trimmedSlug}</span>
                )}
                {!hasInput && (
                  <span className="text-zinc-400 font-normal">Create a memorable web address for your listing.</span>
                )}
              </div>

              {/* Save pill button */}
              <button
                type="button"
                disabled={isSaving || (hasInput && !isSlugValid)}
                onClick={() => handleSaveSection("custom-link")}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer mt-2"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );
}

/* ================================================================= */
/* CANCELLATION POLICY INNER COMPONENT (handles local edit state)    */
/* ================================================================= */
function CancellationPolicyView({
  cancellationPolicy,
  setCancellationPolicy,
  setActiveSection,
  isSaving,
  handleSaveSection,
  longTermCancellationPolicy,
  setLongTermCancellationPolicy,
}: {
  cancellationPolicy: string;
  setCancellationPolicy: (val: string) => void;
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
  longTermCancellationPolicy: "FIRM" | "STRICT";
  setLongTermCancellationPolicy: (val: "FIRM" | "STRICT") => void;
}) {
  const [editingShortTerm, setEditingShortTerm] = React.useState(false);
  const [editingLongTerm, setEditingLongTerm] = React.useState(false);
  const [selectedShortPolicy, setSelectedShortPolicy] = React.useState(cancellationPolicy || "FLEXIBLE");
  const [longTermPolicy, setLongTermPolicy] = React.useState<"FIRM" | "STRICT">(longTermCancellationPolicy);

  const shortTermPolicies = [
    {
      id: "FLEXIBLE",
      title: "Flexible",
    },
    {
      id: "MODERATE",
      title: "Moderate",
    },
    {
      id: "LIMITED",
      title: "Limited",
    },
    {
      id: "FIRM",
      title: "Firm",
    },
  ];

  const longTermPolicies = [
    {
      id: "FIRM" as const,
      title: "Firm long term",
    },
    {
      id: "STRICT" as const,
      title: "Strict long term",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Subtitle */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => setActiveSection("description")} />
          <h1>Cancellation policy</h1>
        </div>
        <p className="text-xs text-zinc-500 font-normal pl-11">
          Select the policy label recorded with each booking. Refund eligibility is not calculated in Homyz.
        </p>
      </div>

      <div className="space-y-5 pt-2">
        {/* -------- Card 1: Short-term stays -------- */}
        <div className="rounded-2xl bg-white border border-zinc-200/90 p-6 space-y-4 shadow-2xs">
          <span className="bg-zinc-100 text-zinc-800 text-[11px] font-semibold px-3 py-1 rounded-md inline-block">
            Short-term stays
          </span>

          <p className="text-xs text-zinc-500 font-normal leading-relaxed">
            Applies to stays under 28 nights. Exact refund terms are not represented until product rules are approved.
          </p>

          <div className="border-t border-zinc-200/80 w-full max-w-xs" />

          {/* Policy Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-zinc-400 block">Your policy</span>
              <span className="font-semibold text-sm text-[#1F1F1F] block">{selectedShortPolicy}</span>
            </div>
            <button
              type="button"
              onClick={() => setEditingShortTerm((v) => !v)}
              className={`rounded-full font-semibold text-xs px-5 py-1.5 shadow-2xs transition-all cursor-pointer ${
                editingShortTerm
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950"
              }`}
            >
              Edit
            </button>
          </div>

          {/* Inline Policy Picker (shown when editing) */}
          {editingShortTerm && (
            <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1">
              <div className="grid grid-cols-2 gap-3">
                {shortTermPolicies.map((policy) => (
                  <button
                    key={policy.id}
                    type="button"
                    onClick={() => setSelectedShortPolicy(policy.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      selectedShortPolicy === policy.id
                        ? "bg-[#FEF9EC] border-amber-300 shadow-2xs"
                        : "bg-white border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <h4 className="font-medium text-base text-[#1F1F1F] mb-1.5">{policy.title}</h4>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setCancellationPolicy(selectedShortPolicy);
                    handleSaveSection("cancellation-policy");
                    setEditingShortTerm(false);
                  }}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedShortPolicy(cancellationPolicy || "FLEXIBLE");
                    setEditingShortTerm(false);
                  }}
                  className="rounded-full bg-white border border-zinc-300 text-zinc-800 font-semibold text-xs px-6 py-2.5 hover:bg-zinc-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Non-refundable option */}
          <div className="flex items-start justify-between pt-2 opacity-60">
            <div className="space-y-1 max-w-sm">
              <h4 className="font-medium text-base text-[#1F1F1F]">Non-refundable option</h4>
              <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                Unavailable: non-refundable discount and refund terms are not defined.
              </p>
            </div>
            <button
              type="button"
              disabled
              aria-label="Non-refundable rates are not available"
              className="w-9 h-5 rounded-full bg-zinc-300 p-0.5 flex items-center cursor-not-allowed shrink-0 mt-1"
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
            </button>
          </div>
        </div>

        {/* -------- Card 2: Long-term stays -------- */}
        <div className="rounded-2xl bg-white border border-zinc-200/90 p-6 space-y-4 shadow-2xs">
          <span className="bg-zinc-100 text-zinc-800 text-[11px] font-semibold px-3 py-1 rounded-md inline-block">
            Long-term stays
          </span>

          <p className="text-xs text-zinc-500 font-normal leading-relaxed">
            Applies to stays of 28 nights or more. Exact refund terms are not represented until product rules are approved.
          </p>

          <div className="border-t border-zinc-200/80 w-full max-w-xs" />

          {/* Policy Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-zinc-400 block">Your policy</span>
              <span className="font-semibold text-sm text-[#1F1F1F] block">{longTermPolicy}</span>
            </div>
            <button
              type="button"
              onClick={() => setEditingLongTerm((v) => !v)}
              className={`rounded-full font-semibold text-xs px-5 py-1.5 shadow-2xs transition-all cursor-pointer ${
                editingLongTerm
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950"
              }`}
            >
              Edit
            </button>
          </div>

          {/* Inline Long-term Policy Picker */}
          {editingLongTerm && (
            <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1">
              <div className="flex flex-col gap-3">
                {longTermPolicies.map((policy) => (
                  <button
                    key={policy.id}
                    type="button"
                    onClick={() => setLongTermPolicy(policy.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      longTermPolicy === policy.id
                        ? "bg-[#FEF9EC] border-amber-300 shadow-2xs"
                        : "bg-white border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <h4 className="font-medium text-base text-[#1F1F1F] mb-1.5">{policy.title}</h4>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLongTermCancellationPolicy(longTermPolicy);
                    handleSaveSection("cancellation-policy");
                    setEditingLongTerm(false);
                  }}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLongTermPolicy(longTermCancellationPolicy);
                    setEditingLongTerm(false);
                  }}
                  className="rounded-full bg-white border border-zinc-300 text-zinc-800 font-semibold text-xs px-6 py-2.5 hover:bg-zinc-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
