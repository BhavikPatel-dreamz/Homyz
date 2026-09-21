"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities -- legacy editor callback and copy surface; narrowed incrementally outside E4. */

import { BackButton } from "@/components/ui/back-button";
import { useLanguage } from "@/lib/i18n/language-context";

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
  nonRefundableDiscountPercentage?: number | null;
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
  nonRefundableDiscountPercentage,
  isLoading,
}: PricingAndBookingViewsProps) {
  const { t } = useLanguage();
  const [localAvailabilityError, setLocalAvailabilityError] = useState<string | null>(null);

  const handleBack = (fallback = "pricing") => {
    setActiveSection(fallback as any);
  };

  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* --------------------------------------------------------- */}
      {/* VIEW: PRICING */}
      {/* --------------------------------------------------------- */}
      {activeSection === "pricing" && (
        <div className="w-full max-w-[491px] space-y-5 animate-in fade-in pb-10 font-sans">
          {/* Header & Back Button */}
          <div className="space-y-1">
            <div className="flex items-start gap-6">
              <BackButton onClick={() => setActiveSection("description")} className="mt-2" />
              <div>
                <h1>{t("host_pricing_title")}</h1>
                <p className="text-sm leading-5 text-[#727272] dark:text-zinc-400">*These settings apply to all nights, unless you customize them by date. <button type="button" className="text-[#1f1f1f] underline hover:opacity-80 dark:text-zinc-100 dark:hover:text-amber-400">Learn more</button></p>
              </div>
            </div>

          </div>

          {isLoading ? (
            <PricingSkeleton />
          ) : (
            <div className="space-y-5 sm:mt-21.25 mt-6">
              {/* 1. Base Price Card */}
              <div className="space-y-3">
                <div className="flex min-[360px]:items-center items-start justify-between min-[360px]:flex-row flex-col min-[360px]:gap-0 gap-3">
                  <span className="text-base font-normal text-[#1F1F1F]">{smartPricing ? t("host_smart_pricing_range") : t("host_base_price")}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-normal text-[#727272]">{t("host_smart_pricing")}</span>
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
                      <label className="mb-1 block text-base font-medium text-[#1F1F1F]">{t("host_min_price")}</label>
                      <div className="flex items-baseline gap-2">
                        <span className="sm:text-[32px] text-[24px] font-medium text-[#1F1F1F]">{currency}</span>
                        <input
                          type="number"
                          min={0}
                          value={smartPricingMinPrice || ""}
                          onChange={(e) => setSmartPricingMinPrice?.(Number(e.target.value || 0))}
                          className="w-full sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] outline-none bg-transparent placeholder:text-[#727272] pl-3"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#727272] bg-white px-4 py-4">
                      <label className="mb-1 block text-base font-medium text-[#1F1F1F]">{t("host_max_price")}</label>
                      <div className="flex items-baseline gap-2">
                        <span className="sm:text-[32px] text-[24px] font-medium text-[#1F1F1F]">{currency}</span>
                        <input
                          type="number"
                          min={0}
                          value={smartPricingMaxPrice || ""}
                          onChange={(e) => setSmartPricingMaxPrice?.(Number(e.target.value || 0))}
                          className="w-full sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] outline-none bg-transparent placeholder:text-[#727272] pl-3"
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
                      className="w-full sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] outline-none bg-transparent placeholder:text-[#727272] pl-3"
                    />
                  </div>
                )}
              </div>

              {!smartPricing && (
                <>
                  {/* 2. Weekend adjustment */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_custom_weekend_price")}</label>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 sm:min-h-[68px] min-h-[58px]">
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center justify-between w-full gap-2 shrink-0">

                          <div className="min-w-0 text-left">
                            <span className="sm:text-[32px] text-[24px] font-medium text-[#1f1f1f] dark:text-zinc-100">{weekendPremium || "XX"}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              aria-label="Decrease weekend premium"
                              onClick={() => setWeekendPremium?.((weekendPremium || 0) - 1)}
                              className="flex size-8 items-center justify-center rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-lg font-normal text-[#1F1F1F] dark:text-zinc-100 hover:text-white hover:bg-[#1F1F1F] dark:hover:bg-zinc-700 dark:hover:border-zinc-600 transition-colors duration-300 cursor-pointer"
                            >
                              <Image src="/images/icons/minus-icon.svg" alt="Decrease weekend premium" width={14} height={14} className="size-3.5 object-contain dark:invert" />
                            </button>
                            <button
                              type="button"
                              aria-label="Increase weekend premium"
                              onClick={() => setWeekendPremium?.((weekendPremium || 0) + 1)}
                              className="ml-auto flex size-8 items-center justify-center rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-lg font-normal text-[#1F1F1F] dark:text-zinc-100 hover:text-white hover:bg-[#1F1F1F] dark:hover:bg-zinc-700 dark:hover:border-zinc-600 transition-colors duration-300 cursor-pointer"
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
                    <label className="block text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_discounts")}</label>

                    {/* Weekly discount card */}
                    <div className="rounded-xl border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-2">
                      <span className="text-sm font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                        {t("host_discount_weekly")} <span className="text-xs font-normal text-[#727272] dark:text-zinc-400">{t("host_discount_for_7_plus_nights")}</span>
                      </span>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1 rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 focus-within:border-[#1F1F1F] dark:focus-within:border-zinc-100 focus-within:ring-1 focus-within:ring-[#1F1F1F] dark:focus-within:ring-zinc-100 transition-all">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={weeklyDiscount || ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                setWeeklyDiscount(0);
                                return;
                              }
                              const num = Number(raw);
                              setWeeklyDiscount(isNaN(num) ? 0 : Math.min(100, Math.max(0, num)));
                            }}
                            placeholder="5"
                            className="w-14 text-center text-xl font-semibold text-[#1F1F1F] dark:text-zinc-100 outline-none bg-transparent placeholder:text-[#727272] dark:placeholder:text-zinc-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-xl font-semibold text-[#1F1F1F] dark:text-zinc-100">%</span>
                        </div>
                        <span className="text-xs text-[#727272] dark:text-zinc-400 font-normal">
                          {t("host_weekly_average_prefix")} {currency} {Math.round((editPrice || 0) * 7 * (1 - (weeklyDiscount || 0) / 100))}
                        </span>
                      </div>
                    </div>

                    {/* Monthly discount card */}
                    <div className="rounded-xl border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-2">
                      <span className="text-sm font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                        {t("host_discount_monthly")} <span className="text-xs font-normal text-[#727272] dark:text-zinc-400">{t("host_discount_for_28_plus_nights")}</span>
                      </span>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1 rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 focus-within:border-[#1F1F1F] dark:focus-within:border-zinc-100 focus-within:ring-1 focus-within:ring-[#1F1F1F] dark:focus-within:ring-zinc-100 transition-all">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={monthlyDiscount || ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                setMonthlyDiscount(0);
                                return;
                              }
                              const num = Number(raw);
                              setMonthlyDiscount(isNaN(num) ? 0 : Math.min(100, Math.max(0, num)));
                            }}
                            placeholder="10"
                            className="w-14 text-center text-xl font-semibold text-[#1F1F1F] dark:text-zinc-100 outline-none bg-transparent placeholder:text-[#727272] dark:placeholder:text-zinc-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-xl font-semibold text-[#1F1F1F] dark:text-zinc-100">%</span>
                        </div>
                        <span className="text-xs text-[#727272] dark:text-zinc-400 font-normal">
                          {t("host_monthly_average_prefix")} {currency} {Math.round((editPrice || 0) * 30 * (1 - (monthlyDiscount || 0) / 100))}
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
                            className="w-12 text-lg font-semibold text-[#1F1F1F] dark:text-zinc-100 outline-none bg-transparent underline underline-offset-4 decoration-zinc-300 placeholder:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                          <span className="text-lg font-semibold text-[#1F1F1F] dark:text-zinc-100">%</span>
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
              <div className="rounded-md bg-[#F3F4F5] dark:bg-zinc-800/90 dark:border dark:border-zinc-700 px-6 py-2 flex items-center gap-4 transition-all cursor-pointer sm:min-h-22">
                <Image src="/images/icons/calendar-date.svg" alt="calendar-date.svg" width={24} height={24} className="dark:invert" />
                <span className="text-base text-[#1f1f1f] dark:text-zinc-100 font-normal">{t("host_calendar_notice")}</span>
              </div>

              {/* Save Button */}
              <div className="mt-12">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveSection("pricing")}
                  className="rounded-full bg-[#FCDF9C] dark:bg-amber-400 hover:bg-[#F3F4F5] dark:hover:bg-amber-300 text-[#1F1F1F] dark:text-zinc-950 font-medium text-base px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                >
                  {isSaving ? t("host_saving") : t("host_save")}
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
              <BackButton onClick={() => handleBack("pricing")} className="mt-2" />
              <div>
                <h1>{t("host_availability_title")}</h1>
                <p className="text-sm leading-5 text-[#727272] dark:text-zinc-400 max-w-[491px]">
                  {t("host_availability_subtitle")} <button type="button" className="text-[#1f1f1f] underline hover:opacity-80 dark:text-zinc-100 dark:hover:text-amber-400">{t("host_learn_more")}</button>
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
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_trip_length")}</h3>
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {minNights}–{maxNights} {t("host_nights_suffix")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Minimum nights box */}
                  <div className="space-y-1">
                    <div className="relative rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 sm:px-4 px-3 sm:py-4 py-3 flex items-center justify-between focus-within:border-[#1F1F1F] dark:focus-within:border-zinc-500 sm:min-h-[68px] min-h-[60px]">
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
                        aria-label={t("host_minimum_nights")}
                        className="w-20 sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] dark:text-zinc-100 outline-none bg-transparent pl-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm text-right text-[#727272] dark:text-zinc-400">
                        <span className="text-center block">{t("host_minimum_nights")}</span></span>
                    </div>
                  </div>

                  {/* Maximum nights box */}
                  <div className="space-y-1">
                    <div className="relative rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 sm:px-4 px-3 sm:py-4 py-3 flex items-center justify-between focus-within:border-[#1F1F1F] dark:focus-within:border-zinc-500 sm:min-h-[68px] min-h-[60px]">
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
                        aria-label={t("host_maximum_nights")}
                        className="w-20 sm:text-[32px] text-[24px] font-medium text-[#1F1F1F] dark:text-zinc-100 outline-none bg-transparent pl-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-sm text-right text-[#727272] dark:text-zinc-400"><span className="text-center block">{t("host_maximum_nights")}</span></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Advance notice */}
              <div className="space-y-2">
                <div>
                  <h3 className="text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_advance_notice")}</h3>
                  <p className="mt-1 text-xs text-[#1F1F1F] dark:text-zinc-400 opacity-50">
                    {t("host_advance_notice_desc")}
                  </p>
                </div>

                <div className="space-y-2">
                  <select value={advanceNotice} onChange={(e) => { setAdvanceNotice?.(e.target.value); setLocalAvailabilityError(null); }} className="w-full appearance-none rounded-lg border border-[#1f1f1f] dark:border-zinc-700 bg-white dark:bg-zinc-800 sm:px-4 px-3 sm:py-4 py-3 text-base font-normal text-[#727272] dark:text-zinc-100 outline-none focus:border-[#1F1F1F] dark:focus:border-zinc-500 mb-0 min-h-[56px]">
                    <option value="Same day">{t("host_notice_same_day")}</option>
                    <option value="At least 1 day">{t("host_notice_at_least_1_day")}</option>
                    <option value="At least 2 days">{t("host_notice_at_least_2_days")}</option>
                    <option value="At least 3 days">{t("host_notice_at_least_3_days")}</option>
                    <option value="At least 7 days">{t("host_notice_at_least_7_days")}</option>
                  </select>
                </div>
              </div>

              {allowSameDayRequests && (
                <div className="space-y-1">
                  <label htmlFor="same-day-cutoff" className="block text-sm font-medium text-[#1F1F1F] dark:text-zinc-100">
                    {t("host_same_day_cutoff")}
                  </label>
                  <p className="mt-1 text-xs text-[#1F1F1F] dark:text-zinc-400 opacity-50">
                    {t("host_same_day_cutoff_desc")}
                  </p>
                  <select
                    id="same-day-cutoff"
                    value={sameDayCutoff}
                    onChange={(e) => {
                      setSameDayCutoff?.(e.target.value);
                      setLocalAvailabilityError(null);
                    }}
                    className="w-full appearance-none rounded-lg border border-[#1f1f1f] dark:border-zinc-700 bg-white dark:bg-zinc-800 sm:px-4 px-3 sm:py-4 py-3 text-base font-normal text-[#727272] dark:text-zinc-100 outline-none focus:border-[#1F1F1F] dark:focus:border-zinc-500 cursor-pointer mb-0 min-h-[56px]"
                  >
                    <option value="12:00 AM">12:00 AM</option>
                    <option value="6:00 AM">6:00 AM</option>
                    <option value="12:00 PM">12:00 PM</option>
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
                    <h3 className="text-base font-normal text-[#1F1F1F] dark:text-zinc-100">
                      {t("host_allow_same_day_requests")}
                    </h3>
                    <p className="mt-1 text-xs text-[#1F1F1F] dark:text-zinc-400 opacity-50">
                      {t("host_allow_same_day_requests_desc")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowSameDayRequests}
                      aria-label={t("host_allow_same_day_requests")}
                      onClick={() => {
                        setAllowSameDayRequests?.(!allowSameDayRequests);
                        setLocalAvailabilityError(null);
                      }}
                      className={`relative inline-flex h-4.75 w-10.75 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${allowSameDayRequests ? "bg-[#DF4557]" : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                    >
                      <span
                        className={`pointer-events-none absolute top-0.25 inline-block size-3.75 transform rounded-full bg-white dark:bg-zinc-950 transition duration-200 ease-in-out ${allowSameDayRequests ? "translate-x-6" : "translate-x-0.5"
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
                      setLocalAvailabilityError(t("host_err_min_nights"));
                      return;
                    }
                    if (!maxNights || maxNights < 1) {
                      setLocalAvailabilityError(t("host_err_max_nights"));
                      return;
                    }
                    if (maxNights < minNights) {
                      setLocalAvailabilityError(
                        `${t("host_maximum_nights")} (${maxNights}) < ${t("host_minimum_nights")} (${minNights}).`
                      );
                      return;
                    }
                    setLocalAvailabilityError(null);
                    handleSaveSection("availability");
                  }}
                  className="rounded-full bg-[#FCDF9C] hover:bg-[#EFCF76] text-[#1F1F1F] font-medium text-sm px-8 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? t("host_saving") : t("host_save")}
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
        <div className="xl:max-w-[608px] md:max-w-[80%] space-y-4 pb-10 font-sans animate-in fade-in">
          <div className="flex items-center gap-6">
            <BackButton onClick={() => handleBack("pricing")} />
            <h1>{t("host_booking_settings_title")}</h1>
          </div>

          {isLoading ? (
            <BookingSettingsSkeleton />
          ) : (
            <div className="flex flex-col gap-3 md:mt-12 mt-6">
              <section className={`rounded-lg border bg-white dark:bg-zinc-800 sm:px-6 px-4 sm:py-5 py-4 shadow-2xs transition-colors ${_bookingMethod === "first-three" ? "border-[#1f1f1f] dark:border-zinc-500" : "border-[#727272] dark:border-zinc-700 hover:border-[#1f1f1f]"}`}>
                <button type="button" disabled={isSaving} onClick={() => {
                  if (_bookingMethod === "first-three") return;
                  if (_bookingMethod === "instant") requestInstantBookOff("first-three");
                  else void saveBookingSettings({ bookingMethod: "first-three", requireGoodTrackRecord });
                }} className="flex w-full items-start justify-between gap-5 text-left disabled:cursor-wait">
                  <div>
                    <h2 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_approve_first_three")}</h2>
                    <p className="mt-0.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">{Math.min(approvedBookingCount, 3)} {t("host_of_three_approved")}</p>
                    <p className="mt-1 text-sm text-[#727272] dark:text-zinc-400">{t("host_first_three_desc")}</p>
                  </div>
                  <svg aria-hidden="true" className="mt-1 size-8 shrink-0 text-zinc-800 dark:text-zinc-200" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" /><path strokeLinecap="round" strokeLinejoin="round" d="m8.5 15 2.2 2.2 4.8-5" /></svg>
                </button>
              </section>

              <section className={`rounded-lg border bg-white dark:bg-zinc-800 sm:px-6 px-4 sm:py-5 py-4 transition-colors ${_bookingMethod === "instant" ? "border-[#1f1f1f] dark:border-zinc-500" : "border-[#727272] dark:border-zinc-700"}`}>
                <button type="button" disabled={isSaving} onClick={() => _bookingMethod !== "instant" && saveBookingSettings({ bookingMethod: "instant", requireGoodTrackRecord })} className="flex w-full items-start justify-between gap-5 text-left disabled:cursor-wait">
                  <div>
                    <h2 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_use_instant_book")}</h2>
                    <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">{t("host_instant_book_desc")}</p>
                  </div>
                  <svg aria-hidden="true" className="mt-0.5 size-8 shrink-0 text-zinc-900 dark:text-zinc-100" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z" /></svg>
                </button>

                <div className="my-5 border-t border-zinc-200 dark:border-zinc-700" />
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_require_good_track_record")}</h3>
                      <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">{t("host_track_record_desc")}</p>
                    </div>
                    <button type="button" role="switch" aria-checked={requireGoodTrackRecord} aria-label={t("host_require_good_track_record")} disabled={isSaving || _bookingMethod !== "instant"} onClick={() => saveBookingSettings({ bookingMethod: "instant", requireGoodTrackRecord: !requireGoodTrackRecord })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${requireGoodTrackRecord && _bookingMethod === "instant" ? "bg-[#DF4557]" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                      <span className={`block h-5 w-5 rounded-full bg-white dark:bg-zinc-950 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 transition-transform ${requireGoodTrackRecord && _bookingMethod === "instant" ? "translate-x-5.5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  <button type="button" disabled={isSaving || _bookingMethod !== "instant"} onClick={openCustomMessage} className="flex w-full items-center justify-between gap-4 text-left disabled:cursor-not-allowed disabled:opacity-55">
                    <div><h3 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_add_custom_message")}</h3><p className="mt-0.5 text-sm leading-5 text-[#727272] dark:text-zinc-400">{hasCustomBookingMessage ? t("host_custom_message_added") : t("host_custom_message_must_read")}</p></div>
                    <Image
                      src="/images/icons/chevron-down-dark.svg"
                      alt=""
                      aria-hidden="true"
                      width={16}
                      height={9}
                      className="h-4 w-4 shrink-0 -rotate-90"
                    />
                  </button>
                </div>
              </section>

              <button type="button" disabled={isSaving} onClick={() => {
                if (_bookingMethod === "approve") return;
                if (_bookingMethod === "instant") requestInstantBookOff("approve");
                else void saveBookingSettings({ bookingMethod: "approve", requireGoodTrackRecord });
              }} className={`flex w-full items-center justify-between gap-5 rounded-lg border bg-white dark:bg-zinc-800 sm:px-6 px-4 sm:py-5 py-4 text-left transition-colors disabled:cursor-wait ${_bookingMethod === "approve" ? "border-zinc-900 dark:border-zinc-100" : "border-[#727272] dark:border-zinc-700 hover:border-zinc-400"}`}>
                <div><h2 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_approve_all_bookings")}</h2><p className="mt-0.5 text-sm leading-5 text-[#727272] dark:text-zinc-400">{t("host_approve_all_desc")}</p></div>
                <svg aria-hidden="true" className="size-8 shrink-0 text-zinc-900 dark:text-zinc-100" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a2 2 0 012 2v10a2 2 0 01-2 2h-5l-4 3v-3H6a2 2 0 01-2-2V6a2 2 0 012-2Z" /><path strokeLinecap="round" d="M8 9h8M8 13h5" /></svg>
              </button>
              {isSaving && (
                <div role="status" className="flex items-center gap-2 px-1 text-sm font-medium text-[#727272] dark:text-zinc-400">
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border border-zinc-300 border-t-zinc-900 dark:border-t-zinc-100" />
                  {t("host_saving")}
                </div>
              )}
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
          isLoading={isLoading}
          handleSaveSection={handleSaveSection}
          onSaveCancellationPolicy={onSaveCancellationPolicy}
          discounts={discounts}
          nonRefundableDiscountPercentage={nonRefundableDiscountPercentage}
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
              <span className="text-base font-medium text-[#727272] dark:text-zinc-300 tracking-tight">
                {Math.max(0, 100 - (customSlug?.length || 0))}/100 {t("host_characters_available")}
              </span>

              {/* homyz/stay/ slug input field */}
              <div className="flex items-center justify-center text-3xl sm:text-4xl font-semibold text-[#1F1F1F] dark:text-zinc-100 tracking-tight">
                <span className="text-zinc-500 dark:text-zinc-400">homyz.com/stay/</span>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) =>
                    setCustomSlug?.(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  placeholder="your-space"
                  className="outline-none bg-transparent border-b-2 border-transparent focus:border-amber-400 text-[#1F1F1F] dark:text-zinc-100 font-semibold min-w-[60px] max-w-[280px] pl-2.5 sm:pl-3 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                  autoFocus
                />
              </div>

              {/* Validation feedback */}
              <div className="text-base text-center min-h-[20px]">
                {tooShort && (
                  <span className="text-red-500 dark:text-red-400 font-medium">{t("host_link_min_3_chars")}</span>
                )}
                {reserved && (
                  <span className="text-red-500 dark:text-red-400 font-medium">{t("host_link_reserved_route")}</span>
                )}
                {invalidChars && !tooShort && (
                  <span className="text-red-500 dark:text-red-400 font-medium">{t("host_link_invalid_chars")}</span>
                )}
                {hasInput && isSlugValid && !tooShort && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t("host_valid_link")}: homyz.com/stay/{trimmedSlug}</span>
                )}
                {!hasInput && (
                  <span className="text-[#727272] dark:text-zinc-500 font-normal">{t("host_custom_link_desc")}</span>
                )}
              </div>

              {/* Save pill button */}
              <button
                type="button"
                disabled={isSaving || (hasInput && !isSlugValid)}
                onClick={() => handleSaveSection("custom-link")}
                className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F]  hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? t("host_saving") : t("host_save")}
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
