"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities -- legacy editor callback and copy surface; narrowed incrementally outside E4. */

import { BackButton } from "@/components/ui/back-button";

import React, { useState } from "react";
import { isReservedSlug } from "@/lib/utils/slug";
import { CancellationPolicyView } from "./CancellationPolicyView";
import {
  PricingSkeleton,
  AvailabilitySkeleton,
  BookingSettingsSkeleton,
  CancellationPolicySkeleton,
  CustomLinkSkeleton,
} from "./YourSpaceSkeletons";
import Image from "next/image";

interface PricingAndBookingViewsProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  isSaving: boolean;
  isLoading?: boolean;
  handleSaveSection: (sectionKey: any) => void;

  // Pricing & Availability
  currency?: string;
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
  lastMinuteDiscount: number;
  setLastMinuteDiscount: (val: number) => void;
  lastMinuteEnabled: boolean;
  setLastMinuteEnabled: (val: boolean) => void;
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
  saveBookingSettings: (settings: {
    bookingMethod: "first-three" | "instant" | "approve";
    requireGoodTrackRecord: boolean;
    bookingMessage?: string;
  }) => Promise<boolean>;
  requestInstantBookOff: (bookingMethod: "first-three" | "approve") => void;
  openCustomMessage: () => void;

  // Cancellation Policy & Custom Link
  cancellationPolicy: string;
  setCancellationPolicy: (val: string) => void;
  longTermCancellationPolicy: "FIRM" | "STRICT";
  setLongTermCancellationPolicy: (val: "FIRM" | "STRICT") => void;
  customSlug?: string;
  setCustomSlug?: (val: string) => void;
  onSaveCancellationPolicy?: (data: {
    cancellationPolicy: string;
    longTermCancellationPolicy: "FIRM" | "STRICT";
    nonRefundable?: boolean;
  }) => Promise<boolean | void>;
  discounts?: Record<string, unknown> | null;
}

export function PricingAndBookingViews({
  activeSection,
  setActiveSection,
  isSaving,
  handleSaveSection,
  currency = "SAR",
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
  lastMinuteDiscount,
  setLastMinuteDiscount,
  lastMinuteEnabled,
  setLastMinuteEnabled,
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
  requestInstantBookOff,
  openCustomMessage,
  cancellationPolicy,
  setCancellationPolicy,
  longTermCancellationPolicy,
  setLongTermCancellationPolicy,
  customSlug = "",
  setCustomSlug,
  onSaveCancellationPolicy,
  discounts,
  isLoading,
}: PricingAndBookingViewsProps) {
  const [localAvailabilityError, setLocalAvailabilityError] = useState<string | null>(null);

  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* VIEW: PRICING & AVAILABILITY */}
      {/* --------------------------------------------------------- */}
      {/* --------------------------------------------------------- */}
      {/* VIEW: PRICING */}
      {/* --------------------------------------------------------- */}
      {activeSection === "pricing" && (
        <div className="w-full max-w-[491px] space-y-5 animate-in fade-in pb-10 font-sans">
          {/* Header & Back Button */}
          <div className="space-y-1">
            <div className="flex items-start gap-6">
              <BackButton onClick={() => setActiveSection("description")} />
              <div>
                <h1>Pricing</h1>
                <p className="text-sm leading-5 text-[#727272]">*These settings apply to all nights, unless you customize them by date. <button type="button" className="text-[#1f1f1f] underline">Learn more</button></p>
              </div>
            </div>

          </div>

          {isLoading ? (
            <PricingSkeleton />
          ) : (
            <div className="space-y-5 sm:mt-21.25 mt-6">
              {/* 1. Nightly Price Card */}
              <div className="space-y-3">
                <div className="flex min-[360px]:items-center items-start justify-between min-[360px]:flex-row flex-col min-[360px]:gap-0 gap-3">
                  <span className="text-base font-normal text-[#1F1F1F]">{smartPricing ? "Smart pricing range" : "Nightly price"}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-normal text-[#727272]">Smart pricing</span>
                    <button
                      type="button"
                      aria-label="Toggle smart pricing"
                      onClick={() => setSmartPricing?.(!smartPricing)}
                      className={`h-[19px] w-[43px] rounded-full transition-colors relative cursor-pointer shrink-0 ${smartPricing ? "bg-[#DF4557]" : "bg-zinc-300"
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 block size-3.75 rounded-full bg-white transition-transform ${smartPricing ? "translate-x-6.5" : "translate-x-0.5"
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {smartPricing ? (
                  <div className="space-y-3 pt-1">
                    <div className="rounded-lg border border-[#727272] bg-white px-4 py-4">
                      <label className="mb-1 block text-base font-medium text-[#1F1F1F]">Minimum price*</label>
                      <div className="flex items-baseline gap-2">
                        <span className="sm:text-[32px] text-[24px] font-medium text-[#1F1F1F]">{currency}</span>
                        <input
                          type="number"
                          min={0}
                          value={smartPricingMinPrice || ""}
                          onChange={(e) => setSmartPricingMinPrice?.(Number(e.target.value || 0))}
                          className="w-full sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] outline-none bg-transparent placeholder:text-[#727272]"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#727272] bg-white px-4 py-4">
                      <label className="mb-1 block text-base font-medium text-[#1F1F1F]">Maximum price</label>
                      <div className="flex items-baseline gap-2">
                        <span className="sm:text-[32px] text-[24px] font-medium text-[#1F1F1F]">{currency}</span>
                        <input
                          type="number"
                          min={0}
                          value={smartPricingMaxPrice || ""}
                          onChange={(e) => setSmartPricingMaxPrice?.(Number(e.target.value || 0))}
                          className="w-full sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] outline-none bg-transparent placeholder:text-[#727272]"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-[#727272] bg-white px-4 py-2 sm:min-h-[68px] min-h-[58px]">
                    <span className="sm:text-[32px] text-[24px] font-medium text-[#1F1F1F]">{currency}</span>
                    <input
                      type="number"
                      value={editPrice || ""}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      placeholder="100"
                      className="w-full sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] outline-none bg-transparent placeholder:text-[#727272]"
                    />
                  </div>
                )}
              </div>

              {!smartPricing && (
                <>
                  {/* 2. Weekend adjustment */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-base font-normal text-[#1F1F1F]">Custom weekend price</label>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-[#727272] bg-white px-4 py-2 sm:min-h-[68px] min-h-[58px]">
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center justify-between w-full gap-2 shrink-0">

                          <div className="min-w-0 text-left">
                            <span className="sm:text-[32px] text-[24px] font-medium text-[#1f1f1f]">{weekendPremium || "XX"}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              aria-label="Decrease weekend premium"
                              onClick={() => setWeekendPremium?.((weekendPremium || 0) - 1)}
                              className="flex size-8 items-center justify-center rounded-full border border-[#1F1F1F] text-lg font-normal text-[#1F1F1F] hover:text-white hover:bg-[#1F1F1F] transition-colors duration-300 cursor-pointer"
                            >
                              <Image src="/images/icons/minus-icon.svg" alt="Decrease weekend premium" width={14} height={14} className="size-3.5 object-contain" />
                            </button>
                            <button
                              type="button"
                              aria-label="Increase weekend premium"
                              onClick={() => setWeekendPremium?.((weekendPremium || 0) + 1)}
                              className="ml-auto flex size-8 items-center justify-center rounded-full border border-[#1F1F1F] text-lg font-normal text-[#1F1F1F] hover:text-white hover:bg-[#1F1F1F] transition-colors duration-300 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* 3. Discounts section */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-base font-normal text-[#1F1F1F]">Discounts</label>

                    {/* Weekly discount card */}
                    <div className="rounded-md border border-[#727272] bg-white px-4 py-4 ">
                      <span className="text-xs text-[#1f1f1f] font-normal block w-full">
                        Weekly <span className="text-xs font-normal text-[#727272]">- For 7+ nights</span>
                      </span>
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-0">
                          <input
                            type="number"
                            value={weeklyDiscount || ""}
                            onChange={(e) => setWeeklyDiscount(Number(e.target.value))}
                            placeholder="5"
                            className="w-[2ch] appearance-none text-[24px] font-medium text-[#1f1f1f] outline-none bg-transparent placeholder:text-[#727272]"
                          />
                          <span className="-ml-px text-[24px] font-medium text-[#1f1f1f]">%</span>
                        </div>
                        <span className="text-xs text-[#1f1f1f] font-normal">
                          weekly average is  {currency} {Math.round((editPrice || 0) * 7 * (1 - (weeklyDiscount || 0) / 100))}
                        </span>
                      </div>

                    </div>

                    {/* Monthly discount card */}
                    <div className="rounded-md border border-[#727272] bg-white px-4 py-4">
                      <span className="text-xs text-[#1f1f1f] font-normal block">
                        Monthly <span className="text-xs font-normal text-[#727272]">- For 28+ nights</span>
                      </span>
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-0">
                          <input
                            type="number"
                            value={monthlyDiscount || ""}
                            onChange={(e) => setMonthlyDiscount(Number(e.target.value))}
                            placeholder="10"
                            className="w-[2ch] appearance-none text-[24px] font-medium text-[#1f1f1f] outline-none bg-transparent placeholder:text-[#727272]"
                          />
                          <span className="-ml-px text-[24px] font-medium text-[#1f1f1f]">%</span>
                        </div>
                        <span className="text-xs text-[#1f1f1f] font-normal">
                          monthly average is {currency} {Math.round((editPrice || 0) * 30 * (1 - (monthlyDiscount || 0) / 100))}
                        </span>
                      </div>

                    </div>

                    {/* Last-minute discount card */}
                    <div className="hidden">
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block">
                          LAST-MINUTE - WITHIN 2 DAYS
                        </span>
                        <div className="flex items-baseline gap-1">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={lastMinuteDiscount || ""}
                            disabled={!lastMinuteEnabled}
                            onChange={(e) => setLastMinuteDiscount(Number(e.target.value))}
                            placeholder="15"
                            className="w-12 text-lg font-semibold text-[#1F1F1F] outline-none bg-transparent underline underline-offset-4 decoration-zinc-300 placeholder:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                          <span className="text-lg font-semibold text-[#1F1F1F]">%</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={lastMinuteEnabled}
                        aria-label="Toggle last-minute discount"
                        onClick={() => {
                          const nextEnabled = !lastMinuteEnabled;
                          setLastMinuteEnabled(nextEnabled);
                          if (nextEnabled && lastMinuteDiscount <= 0) setLastMinuteDiscount(15);
                        }}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${lastMinuteEnabled ? "bg-[#DF4557]" : "bg-[#DDDDDE]"}`}
                      >
                        <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-xs transition-transform ${lastMinuteEnabled ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* 4. Calendar notice card */}
              <div className="rounded-md bg-[#F3F4F5] px-6 py-2 flex items-center gap-4 transition-all cursor-pointer sm:min-h-22">
                <Image src="/images/icons/calendar-date.svg" alt="calendar-date.svg" width={24} height={24} />
                <span className="text-base text-[#1f1f1f] font-normal">Find more discounts and fees in the calendar</span>
              </div>

              {/* Save Button */}
              <div className="mt-12">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveSection("pricing")}
                  className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-[#1F1F1F] font-medium text-base px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: AVAILABILITY */}
      {/* --------------------------------------------------------- */}
      {activeSection === "availability" && (
        <div className="w-full max-w-[491px] space-y-5 animate-in fade-in pb-10 font-sans">
          {/* Header & Back Button */}
          <div className="space-y-1">
            <div className="flex items-start gap-6">
              <BackButton onClick={() => setActiveSection("pricing")} />
              <div>
                <h1>Availability</h1>
                <p className="text-sm leading-5 text-[#727272] font-normal">
                  *These settings apply to all nights, unless you customize them by date. <button type="button" className="underline">Learn more</button>
                </p>
              </div>
            </div>

          </div>

          {isLoading ? (
            <AvailabilitySkeleton />
          ) : (
            <div className="space-y-4 pt-1">
              {/* Inline Validation Error */}
              {localAvailabilityError && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700"
                >
                  {localAvailabilityError}
                </p>
              )}

              {/* 1. Trip length */}
              <div className="space-y-2">
                <div>
                  <div>
                    <h3 className="text-base font-normal text-[#1F1F1F]">Trip length</h3>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Minimum nights box */}
                  <div className="space-y-1">
                    <div className="relative rounded-lg border border-[#727272] bg-white sm:px-4 px-3 sm:py-4 py-3 flex items-center justify-between focus-within:border-[#1F1F1F] sm:min-h-[68px] min-h-[60px]">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={minNights || ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                          setMinNights(isNaN(val) ? 0 : val);
                          setLocalAvailabilityError(null);
                        }}
                        aria-label="Minimum nights"
                        className="w-20 sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] outline-none bg-transparent"
                      />
                      <span className="text-sm text-right text-[#727272]">
                        <span className="text-center block">Minimum<br />nights</span></span>
                    </div>
                  </div>

                  {/* Maximum nights box */}
                  <div className="space-y-1">
                    <div className="relative rounded-lg border border-[#727272] bg-white sm:px-4 px-3 sm:py-4 py-3 flex items-center justify-between focus-within:border-[#1F1F1F] sm:min-h-[68px] min-h-[60px]">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={maxNights || ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                          setMaxNights(isNaN(val) ? 0 : val);
                          setLocalAvailabilityError(null);
                        }}
                        aria-label="Maximum nights"
                        className="w-20 sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] outline-none bg-transparent"
                      />
                      <span className="text-sm text-right text-[#727272]"><span className="text-center block">Maximum<br />nights</span></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Advance notice */}
              <div className="space-y-2">
                <div>
                  <h3 className="text-base font-normal text-[#1F1F1F]">Advance notice</h3>
                  <p className="mt-1 text-xs text-[#1F1F1F] opacity-50">
                    *How much notice do you need between a guest's booking and their arrival?
                  </p>
                </div>

                <div className="space-y-2">
                  <select value={advanceNotice} onChange={(e) => { setAdvanceNotice?.(e.target.value); setLocalAvailabilityError(null); }} className="w-full appearance-none rounded-lg border border-[#1f1f1f] bg-white sm:px-4 px-3 sm:py-4 py-3 text-base font-normal text-[#727272] outline-none focus:border-[#1F1F1F] mb-0 min-h-[56px] min-h-[48px]">
                    <option value="Same day">Same day</option><option value="At least 1 day">At least 1 day</option><option value="At least 2 days">At least 2 days</option><option value="At least 3 days">At least 3 days</option><option value="At least 7 days">At least 7 days</option>
                  </select>
                  {/* Option 1: Same day */}
                  <div
                    onClick={() => {
                      setAdvanceNotice?.("Same day");
                      setLocalAvailabilityError(null);
                    }}
                    className={`hidden ${advanceNotice === "Same day"
                      ? "border-zinc-900 bg-zinc-50/70 ring-1 ring-zinc-900 shadow-2xs"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                  >
                    <input
                      type="radio"
                      name="advanceNoticeOption"
                      checked={advanceNotice === "Same day"}
                      onChange={() => {
                        setAdvanceNotice?.("Same day");
                        setLocalAvailabilityError(null);
                      }}
                      className="mt-0.5 w-4 h-4 text-zinc-900 accent-zinc-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-[#1F1F1F] block">Same day</span>
                      <span className="mt-1 text-xs text-[#1F1F1F] opacity-50">
                        Guests can book for arrival today before your cutoff time.
                      </span>
                    </div>
                  </div>

                  {/* Option 2: 1 day */}
                  <div
                    onClick={() => {
                      setAdvanceNotice?.("At least 1 day");
                      setLocalAvailabilityError(null);
                    }}
                    className={`hidden ${advanceNotice === "At least 1 day"
                      ? "border-zinc-900 bg-zinc-50/70 ring-1 ring-zinc-900 shadow-2xs"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                  >
                    <input
                      type="radio"
                      name="advanceNoticeOption"
                      checked={advanceNotice === "At least 1 day"}
                      onChange={() => {
                        setAdvanceNotice?.("At least 1 day");
                        setLocalAvailabilityError(null);
                      }}
                      className="mt-0.5 w-4 h-4 text-zinc-900 accent-zinc-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-[#1F1F1F] block">1 day</span>
                      <span className="text-[11px] text-zinc-500 block mt-0.5">
                        Guests must book at least 1 day before arrival.
                      </span>
                    </div>
                  </div>

                  {/* Option 3: Custom */}
                  <div
                    onClick={() => {
                      if (advanceNotice === "Same day" || advanceNotice === "At least 1 day") {
                        setAdvanceNotice?.("At least 2 days");
                      }
                      setLocalAvailabilityError(null);
                    }}
                    className={`hidden ${advanceNotice !== "Same day" && advanceNotice !== "At least 1 day"
                      ? "border-zinc-900 bg-zinc-50/70 ring-1 ring-zinc-900 shadow-2xs"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                  >
                    <input
                      type="radio"
                      name="advanceNoticeOption"
                      checked={advanceNotice !== "Same day" && advanceNotice !== "At least 1 day"}
                      onChange={() => {
                        if (advanceNotice === "Same day" || advanceNotice === "At least 1 day") {
                          setAdvanceNotice?.("At least 2 days");
                        }
                        setLocalAvailabilityError(null);
                      }}
                      className="mt-0.5 w-4 h-4 text-zinc-900 accent-zinc-900 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-[#1F1F1F] block">Custom</span>
                      <span className="text-[11px] text-zinc-500 block mt-0.5">
                        Choose a custom notice period (2 to 7 days).
                      </span>
                      {advanceNotice !== "Same day" && advanceNotice !== "At least 1 day" && (
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                          <label className="text-[11px] font-medium text-zinc-600 block mb-1">
                            Notice required before arrival
                          </label>
                          <select
                            value={advanceNotice}
                            onChange={(e) => {
                              setAdvanceNotice?.(e.target.value);
                              setLocalAvailabilityError(null);
                            }}
                            className="w-full appearance-none rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 pr-8 text-xs text-zinc-900 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs cursor-pointer"
                          >
                            <option value="At least 2 days">At least 2 days</option>
                            <option value="At least 3 days">At least 3 days</option>
                            <option value="At least 7 days">At least 7 days</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {allowSameDayRequests && (
                <div className="space-y-1">
                  <p className="mt-1 text-xs text-[#1F1F1F] opacity-50">
                    Guests can book on the same day as check-in until this time.
                  </p>
                  <select
                    value={sameDayCutoff}
                    onChange={(e) => {
                      setSameDayCutoff?.(e.target.value);
                      setLocalAvailabilityError(null);
                    }}
                    className="w-full appearance-none rounded-lg border border-[#1f1f1f] bg-white sm:px-4 px-3 sm:py-4 py-3 text-base font-normal text-[#727272] outline-none focus:border-[#1F1F1F] cursor-pointer mb-0 min-h-[56px] min-h-[48px]"
                  >
                    <option value="12:00 AM">12:00 AM (Midnight)</option>
                    <option value="6:00 AM">6:00 AM</option>
                    <option value="12:00 PM">12:00 PM (Noon)</option>
                    <option value="3:00 PM">3:00 PM</option>
                    <option value="6:00 PM">6:00 PM</option>
                    <option value="9:00 PM">9:00 PM</option>
                  </select>
                </div>
              )}

              {/* 3. Same-day booking requests */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-normal text-[#1F1F1F]">
                      Allow requests for the same day
                    </h3>
                    <p className="mt-1 text-xs text-[#1F1F1F] opacity-50">
                      You&apos;ll review and approve each reservation request.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowSameDayRequests}
                      aria-label="Toggle same-day requests"
                      onClick={() => {
                        setAllowSameDayRequests?.(!allowSameDayRequests);
                        setLocalAvailabilityError(null);
                      }}
                      className={`relative inline-flex h-4.75 w-10.75 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${allowSameDayRequests ? "bg-[#DF4557]" : "bg-zinc-300"
                        }`}
                    >
                      <span
                        className={`pointer-events-none absolute top-0.25 inline-block size-3.75 transform rounded-full bg-white transition duration-200 ease-in-out ${allowSameDayRequests ? "translate-x-6" : "translate-x-0.5"
                          }`}
                      />
                    </button>
                  </div>
                </div>


              </div>

              {/* Save Button */}
              <div className="mt-12">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    if (!minNights || minNights < 1) {
                      setLocalAvailabilityError("Minimum stay must be at least 1 night.");
                      return;
                    }
                    if (!maxNights || maxNights < 1) {
                      setLocalAvailabilityError("Maximum stay must be at least 1 night.");
                      return;
                    }
                    if (maxNights < minNights) {
                      setLocalAvailabilityError(
                        `Maximum stay (${maxNights} nights) cannot be less than minimum stay (${minNights} nights).`
                      );
                      return;
                    }
                    setLocalAvailabilityError(null);
                    handleSaveSection("availability");
                  }}
                  className="rounded-full bg-[#FCDF9C] hover:bg-[#EFCF76] text-[#1F1F1F] font-medium text-sm px-8 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
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

          {isLoading ? (
            <BookingSettingsSkeleton />
          ) : (
            <>
              <section className={`rounded-2xl border-2 bg-white px-6 py-5 shadow-2xs transition-colors ${_bookingMethod === "first-three" ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400"}`}>
                <button type="button" disabled={isSaving} onClick={() => {
                  if (_bookingMethod === "first-three") return;
                  if (_bookingMethod === "instant") requestInstantBookOff("first-three");
                  else void saveBookingSettings({ bookingMethod: "first-three", requireGoodTrackRecord });
                }} className="flex w-full items-start justify-between gap-5 text-left disabled:cursor-wait">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">Approve your first 3 bookings</h2>
                    <p className="mt-0.5 text-sm font-medium text-emerald-600">{Math.min(approvedBookingCount, 3)} of 3 approved</p>
                    <p className="mt-1 text-sm leading-5 text-zinc-600">Review your first three requests. After three confirmed bookings, new guests can book automatically.</p>
                  </div>
                  <svg aria-hidden="true" className="mt-1 size-8 shrink-0 text-zinc-800" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" /><path strokeLinecap="round" strokeLinejoin="round" d="m8.5 15 2.2 2.2 4.8-5" /></svg>
                </button>
              </section>

              <section className={`rounded-2xl border-2 bg-white px-6 py-5 transition-colors ${_bookingMethod === "instant" ? "border-zinc-900" : "border-zinc-200"}`}>
                <button type="button" disabled={isSaving} onClick={() => _bookingMethod !== "instant" && saveBookingSettings({ bookingMethod: "instant", requireGoodTrackRecord })} className="flex w-full items-start justify-between gap-5 text-left disabled:cursor-wait">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">Use Instant Book</h2>
                    <p className="mt-0.5 text-sm leading-5 text-zinc-600">Let guests book automatically, which can help you get more bookings.</p>
                  </div>
                  <svg aria-hidden="true" className="mt-0.5 size-8 shrink-0 text-zinc-900" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z" /></svg>
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

              <button type="button" disabled={isSaving} onClick={() => {
                if (_bookingMethod === "approve") return;
                if (_bookingMethod === "instant") requestInstantBookOff("approve");
                else void saveBookingSettings({ bookingMethod: "approve", requireGoodTrackRecord });
              }} className={`flex w-full items-center justify-between gap-5 rounded-2xl border-2 bg-white px-6 py-5 text-left transition-colors disabled:cursor-wait ${_bookingMethod === "approve" ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400"}`}>
                <div><h2 className="text-base font-semibold text-zinc-900">Approve all bookings</h2><p className="mt-0.5 text-sm leading-5 text-zinc-600">Always review reservation requests.</p></div>
                <svg aria-hidden="true" className="size-8 shrink-0 text-zinc-900" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a2 2 0 012 2v10a2 2 0 01-2 2h-5l-4 3v-3H6a2 2 0 01-2-2V6a2 2 0 012-2Z" /><path strokeLinecap="round" d="M8 9h8M8 13h5" /></svg>
              </button>
              {isSaving && (
                <div role="status" className="flex items-center gap-2 px-1 text-sm font-medium text-zinc-600">
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                  Saving booking preference…
                </div>
              )}
            </>
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
          isLoading={isLoading}
          handleSaveSection={handleSaveSection}
          onSaveCancellationPolicy={onSaveCancellationPolicy}
          discounts={discounts}
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

        return isLoading ? (
          <CustomLinkSkeleton />
        ) : (
          <div className="animate-in fade-in max-w-xl min-h-[420px] flex flex-col items-center justify-center font-sans">
            <div className="flex flex-col items-center justify-center space-y-6 w-full py-12">
              {/* Counter text */}
              <span className="text-xs font-semibold text-zinc-700 tracking-tight">
                {Math.max(0, 100 - (customSlug?.length || 0))}/100 characters available
              </span>

              {/* homyz/stay/ slug input field */}
              <div className="flex items-center justify-center text-3xl sm:text-4xl font-semibold text-[#1F1F1F] tracking-tight">
                <span className="text-zinc-500">homyz.com/stay/</span>
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
