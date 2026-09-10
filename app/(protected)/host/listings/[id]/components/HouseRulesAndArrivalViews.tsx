"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy editor callback surface; narrowed incrementally outside E4. */

import { BackButton } from "@/components/ui/back-button";
import {
  DEFAULT_LANGUAGE_IDS,
  getLanguageDisplayNames,
  LANGUAGE_OPTIONS,
  type LanguageOption,
} from "@/lib/utils/language-options";

import React from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { GuidebooksManager } from "./GuidebooksManager";
import { LocalLawsView } from "./LocalLawsView";
import { TaxesManager } from "./TaxesManager";
import { AirbnbOrgStaysView } from "./AirbnbOrgStaysView";
import {
  formatTimeDisplay,
  QUIET_HOURS_START_OPTIONS,
  QUIET_HOURS_END_OPTIONS,
  ALL_HOURS_OPTIONS,
  type SectionKey,
} from "../section-helpers";
import { HouseRulesSkeleton } from "./YourSpaceSkeletons";

function AllowDenyButtons({
  value,
  onChange,
  label,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2" aria-label={label}>
      <button
        type="button"
        aria-label={`Do not allow ${label}`}
        aria-pressed={value === false}
        onClick={() => onChange(false)}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all cursor-pointer ${
          value === false
            ? "border border-zinc-900 bg-zinc-900 text-white shadow-xs"
            : "border border-zinc-200 bg-zinc-100/80 text-zinc-500 hover:bg-zinc-200/80"
        }`}
      >
        <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={`Allow ${label}`}
        aria-pressed={value === true}
        onClick={() => onChange(true)}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all cursor-pointer ${
          value === true
            ? "border border-zinc-900 bg-zinc-900 text-white shadow-xs"
            : "border border-zinc-200 bg-zinc-100/80 text-zinc-500 hover:bg-zinc-200/80"
        }`}
      >
        <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </button>
    </div>
  );
}

interface HouseRulesAndArrivalViewsProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  isSaving: boolean;
  isLoading?: boolean;
  handleSaveSection: (
    sectionKey: SectionKey,
    sectionSubtype?: "property" | "access" | "interaction" | "other",
    overrides?: Record<string, unknown>,
  ) => Promise<void>;

  // House Rules
  checkInStart: string;
  setCheckInStart: (val: string) => void;
  checkInEnd: string;
  setCheckInEnd: (val: string) => void;
  checkOutTime: string;
  setCheckOutTime: (val: string) => void;
  maxGuestsCount: number;
  setMaxGuestsCount: (val: number) => void;
  petsAllowed: boolean | null;
  setPetsAllowed: (val: any) => void;
  maxPetsCount?: number;
  setMaxPetsCount?: (val: number) => void;
  petRestrictions?: string;
  setPetRestrictions?: (val: string) => void;
  dogsAllowed?: boolean;
  setDogsAllowed?: (val: boolean) => void;
  catsAllowed?: boolean;
  setCatsAllowed?: (val: boolean) => void;
  petFee?: number | string;
  setPetFee?: (val: number | string) => void;
  quietHours: boolean | null;
  setQuietHours: (val: any) => void;
  quietHoursStart?: string;
  setQuietHoursStart?: (val: string) => void;
  quietHoursEnd?: string;
  setQuietHoursEnd?: (val: string) => void;
  eventsAllowed: boolean | null;
  setEventsAllowed: (val: any) => void;
  commercialFilmingAllowed: boolean | null;
  setCommercialFilmingAllowed: (val: boolean | null) => void;
  smokingAllowed: boolean | null;
  setSmokingAllowed: (val: any) => void;
  smokingLocation?: string;
  setSmokingLocation?: (val: string) => void;
  additionalHouseRules?: string;
  setAdditionalHouseRules?: (val: string) => void;
  listingStatusSetting?: "listed" | "unlisted";
  setListingStatusSetting?: (val: "listed" | "unlisted") => void;
  selectedLanguageIds?: string[];
  setSelectedLanguageIds?: (val: string[]) => void;
  requireProfilePhoto?: boolean;
  setRequireProfilePhoto?: (val: boolean) => void;
  guestInteractionPreference?: string;
  setGuestInteractionPreference?: (val: string) => void;

  // Modals trigger
  setIsEditingAdditionalRulesModalOpen: (open: boolean) => void;

  // Arrival Guide & Parking
  checkInMethod: string;
  setCheckInMethod: (val: string) => void;
  wifiNetwork: string;
  setWifiNetwork: (val: string) => void;
  wifiPassword: string;
  setWifiPassword: (val: string) => void;
  houseManual: string;
  setHouseManual: (val: string) => void;
  directions?: string;
  setDirections?: (val: string) => void;
  checkInInstructions?: string;
  setCheckInInstructions?: (val: string) => void;
  checkOutInstructions?: string;
  setCheckOutInstructions?: (val: string) => void;
  doorCode?: string;
  setDoorCode?: (val: string) => void;
  lockboxCode?: string;
  setLockboxCode?: (val: string) => void;
  parkingAvailable?: boolean;
  setParkingAvailable?: (val: boolean) => void;
  parkingType?: string;
  setParkingType?: (val: string) => void;
  parkingSpaces?: number;
  setParkingSpaces?: (val: number) => void;
  parkingReservation?: boolean;
  setParkingReservation?: (val: boolean) => void;
  parkingInstructions?: string;
  setParkingInstructions?: (val: string) => void;
  listingId?: string;
  listingCity?: string;
  listingCountry?: string;
  listingLatitude?: number | null;
  listingLongitude?: number | null;
  listingDiscounts?: any;
  onSaveOrgStays?: (cfg: any) => Promise<void>;
}

export function HouseRulesAndArrivalViews({
  listingId,
  listingCity,
  listingCountry,
  listingLatitude,
  listingLongitude,
  listingDiscounts,
  onSaveOrgStays,
  activeSection,
  setActiveSection,
  isSaving,
  handleSaveSection,
  checkInStart,
  setCheckInStart,
  checkInEnd,
  setCheckInEnd,
  checkOutTime,
  setCheckOutTime,
  maxGuestsCount,
  setMaxGuestsCount,
  petsAllowed,
  setPetsAllowed,
  maxPetsCount = 1,
  setMaxPetsCount,
  petRestrictions = "",
  setPetRestrictions,
  dogsAllowed = true,
  setDogsAllowed,
  catsAllowed = true,
  setCatsAllowed,
  petFee = "",
  setPetFee,
  quietHours,
  setQuietHours,
  quietHoursStart = "22:00",
  setQuietHoursStart,
  quietHoursEnd = "08:00",
  setQuietHoursEnd,
  eventsAllowed,
  setEventsAllowed,
  commercialFilmingAllowed,
  setCommercialFilmingAllowed,
  smokingAllowed,
  setSmokingAllowed,
  smokingLocation: _smokingLocation = "OUTSIDE_ONLY",
  setSmokingLocation: _setSmokingLocation,
  additionalHouseRules = "",
  setAdditionalHouseRules: _setAdditionalHouseRules,
  setIsEditingAdditionalRulesModalOpen,
  checkInMethod,
  setCheckInMethod,
  wifiNetwork,
  setWifiNetwork,
  wifiPassword,
  setWifiPassword,
  houseManual,
  setHouseManual,
  directions = "",
  setDirections,
  checkInInstructions = "",
  setCheckInInstructions,
  checkOutInstructions = "",
  setCheckOutInstructions,
  doorCode = "",
  setDoorCode,
  lockboxCode = "",
  setLockboxCode,
  parkingAvailable = false,
  setParkingAvailable,
  parkingType = "FREE",
  setParkingType,
  parkingSpaces = 1,
  setParkingSpaces,
  parkingReservation = false,
  setParkingReservation,
  parkingInstructions = "",
  setParkingInstructions,
  listingStatusSetting = "unlisted",
  setListingStatusSetting,
  selectedLanguageIds = DEFAULT_LANGUAGE_IDS,
  setSelectedLanguageIds,
  requireProfilePhoto = false,
  setRequireProfilePhoto,
  guestInteractionPreference = "",
  setGuestInteractionPreference,
  isLoading,
}: HouseRulesAndArrivalViewsProps) {
  const [isCheckInOutModalOpen, setIsCheckInOutModalOpen] = React.useState(false);



  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* VIEW 8: HOUSE RULES */}
      {/* --------------------------------------------------------- */}
      {/* --------------------------------------------------------- */}
      {/* VIEW: HOUSE RULES (Professional Airbnb-Style Structured) */}
      {/* --------------------------------------------------------- */}
      {activeSection === "house-rules" && (
        <div className="max-w-3xl space-y-6 pb-10 font-sans animate-in fade-in">
          {/* Header & Subtitle */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <BackButton onClick={() => setActiveSection("description")} />
              <h1 className="text-2xl font-bold tracking-tight text-[#1F1F1F]">House rules</h1>
            </div>
            <p className="text-xs text-zinc-500 font-normal pl-11 leading-relaxed">
              Guests are expected to follow your rules and may be removed from Airbnb if they don&apos;t.
            </p>
          </div>

          {isLoading ? (
            <HouseRulesSkeleton />
          ) : (
            <>
          {/* List of Rules Rows */}
          <div className="divide-y divide-zinc-200/80 pt-2">
            {/* Row 1: Pets allowed */}
            <div className="py-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-semibold text-sm text-[#1F1F1F] block">Pets allowed</span>
                  <p className="text-xs text-zinc-500 leading-relaxed max-w-md">
                    You can refuse pets, but must reasonably accommodate service animals.{" "}
                    <a
                      href="#service-animals"
                      onClick={(e) => e.preventDefault()}
                      className="underline font-semibold text-zinc-900 hover:text-zinc-700 inline-block"
                    >
                      Learn more
                    </a>
                  </p>
                </div>
                <AllowDenyButtons
                  label="pets"
                  value={petsAllowed}
                  onChange={(val) => setPetsAllowed(val)}
                />
              </div>

              {/* Conditional Pet Details */}
              {petsAllowed === true && (
                <div className="rounded-2xl bg-zinc-50/80 border border-zinc-200/80 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-800">Maximum number of pets allowed</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        aria-label="Decrease maximum pets"
                        disabled={(maxPetsCount || 1) <= 1}
                        onClick={() => setMaxPetsCount?.(Math.max(1, (maxPetsCount || 1) - 1))}
                        className="w-8 h-8 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        −
                      </button>
                      <span className="text-sm font-semibold text-[#1F1F1F] min-w-[20px] text-center">
                        {maxPetsCount || 1}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase maximum pets"
                        disabled={(maxPetsCount || 1) >= 10}
                        onClick={() => setMaxPetsCount?.(Math.min(10, (maxPetsCount || 1) + 1))}
                        className="w-8 h-8 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200/60">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dogsAllowed ?? true}
                        onChange={(e) => setDogsAllowed?.(e.target.checked)}
                        className="rounded text-amber-500 accent-zinc-900"
                      />
                      <span className="text-xs font-medium text-zinc-700">Dogs allowed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={catsAllowed ?? true}
                        onChange={(e) => setCatsAllowed?.(e.target.checked)}
                        className="rounded text-amber-500 accent-zinc-900"
                      />
                      <span className="text-xs font-medium text-zinc-700">Cats allowed</span>
                    </label>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Pet fee per stay (optional, SAR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={petFee ?? ""}
                      onChange={(e) => setPetFee?.(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-900 shadow-2xs placeholder:text-zinc-400 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Pet restrictions or guidelines
                    </label>
                    <input
                      type="text"
                      value={petRestrictions || ""}
                      onChange={(e) => setPetRestrictions?.(e.target.value)}
                      placeholder="e.g. Under 20kg only, house-trained, please bring own bed"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-900 shadow-2xs placeholder:text-zinc-400 font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Events allowed */}
            <div className="py-5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-[#1F1F1F] block">Events allowed</span>
              </div>
              <AllowDenyButtons
                label="events"
                value={eventsAllowed}
                onChange={(val) => setEventsAllowed(val)}
              />
            </div>

            {/* Row 3: Smoking, vaping, e-cigarettes allowed */}
            <div className="py-5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-[#1F1F1F] block">Smoking, vaping, e-cigarettes allowed</span>
              </div>
              <AllowDenyButtons
                label="smoking"
                value={smokingAllowed}
                onChange={(val) => setSmokingAllowed(val)}
              />
            </div>

            {/* Row 4: Quiet hours */}
            <div className="py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-[#1F1F1F] block">Quiet hours</span>
                </div>
                <AllowDenyButtons
                  label="quiet hours"
                  value={quietHours}
                  onChange={(val) => setQuietHours(val)}
                />
              </div>

              {/* Conditional Quiet Hours Schedule: Side-by-side dropdown container */}
              {quietHours === true && (
                <div className="rounded-2xl border border-zinc-400 bg-white grid grid-cols-2 overflow-hidden shadow-2xs">
                  <div className="p-3 relative group hover:bg-zinc-50 transition-colors">
                    <span className="block text-[11px] font-medium text-zinc-500">Start time</span>
                    <div className="flex items-center justify-between mt-0.5 pointer-events-none">
                      <span className="text-sm font-normal text-zinc-900">
                        {formatTimeDisplay(quietHoursStart, "11:00 pm")}
                      </span>
                      <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                    <select
                      aria-label="Quiet hours start time"
                      value={formatTimeDisplay(quietHoursStart, "11:00 pm")}
                      onChange={(e) => setQuietHoursStart?.(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    >
                      {QUIET_HOURS_START_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 border-l border-zinc-400 relative group hover:bg-zinc-50 transition-colors">
                    <span className="block text-[11px] font-medium text-zinc-500">End time</span>
                    <div className="flex items-center justify-between mt-0.5 pointer-events-none">
                      <span className="text-sm font-normal text-zinc-900">
                        {formatTimeDisplay(quietHoursEnd, "7:00 am")}
                      </span>
                      <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                    <select
                      aria-label="Quiet hours end time"
                      value={formatTimeDisplay(quietHoursEnd, "7:00 am")}
                      onChange={(e) => setQuietHoursEnd?.(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    >
                      {QUIET_HOURS_END_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Row 5: Commercial photography and filming allowed */}
            <div className="py-5 flex items-center justify-between gap-5">
              <div>
                <span className="block text-sm font-semibold text-[#1F1F1F]">Commercial photography and filming allowed</span>
              </div>
              <AllowDenyButtons
                label="commercial photography and filming"
                value={commercialFilmingAllowed}
                onChange={setCommercialFilmingAllowed}
              />
            </div>

            {/* Row 6: Number of guests */}
            <div className="py-5 flex items-center justify-between gap-5">
              <div>
                <span className="block text-sm font-semibold text-[#1F1F1F]">Number of guests</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  aria-label="Decrease maximum guests"
                  disabled={maxGuestsCount <= 1}
                  onClick={() => setMaxGuestsCount(Math.max(1, maxGuestsCount - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  −
                </button>
                <span className="min-w-5 text-center text-sm font-semibold text-[#1F1F1F]">{maxGuestsCount}</span>
                <button
                  type="button"
                  aria-label="Increase maximum guests"
                  disabled={maxGuestsCount >= 50}
                  onClick={() => setMaxGuestsCount(Math.min(50, maxGuestsCount + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Row 7: Check-in and checkout times */}
            <button
              type="button"
              onClick={() => setIsCheckInOutModalOpen(true)}
              className="flex w-full items-center justify-between gap-5 py-5 text-left transition-colors hover:text-zinc-600 cursor-pointer group"
            >
              <div className="space-y-0.5">
                <span className="block text-sm font-semibold text-[#1F1F1F]">Check-in and checkout times</span>
                <p className="text-xs text-zinc-500 font-normal">
                  Arrive between {formatTimeDisplay(checkInStart, "3:00 pm")} and {checkInEnd && checkInEnd !== "Flexible" ? formatTimeDisplay(checkInEnd) : "Flexible"}
                </p>
                <p className="text-xs text-zinc-500 font-normal">
                  Leave before {formatTimeDisplay(checkOutTime, "6:00 pm")}
                </p>
              </div>
              <svg className="w-5 h-5 text-zinc-600 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Row 8: Additional rules */}
            <button
              type="button"
              onClick={() => setIsEditingAdditionalRulesModalOpen(true)}
              className="flex w-full items-center justify-between gap-5 py-5 text-left transition-colors hover:text-zinc-600 cursor-pointer group"
            >
              <div className="space-y-0.5 max-w-md">
                <span className="block text-sm font-semibold text-[#1F1F1F]">Additional rules</span>
                <p className="text-xs text-zinc-500 font-normal line-clamp-2">
                  {additionalHouseRules?.trim() || "Add rules"}
                </p>
              </div>
              <svg className="w-5 h-5 text-zinc-600 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-6">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("house-rules")}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("description")}
              className="rounded-full bg-white border border-zinc-300 text-zinc-800 font-semibold text-xs px-7 py-2.5 shadow-2xs hover:bg-zinc-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
          </>
          )}

          {/* Check-in and checkout times Modal */}
          {isCheckInOutModalOpen && (
            <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-[28px] p-8 max-w-lg w-full space-y-6 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsCheckInOutModalOpen(false)}
                  className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1"
                >
                  ✕
                </button>

                <div className="space-y-1">
                  <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">
                    Check-in and checkout times
                  </h3>
                  <p className="text-xs text-zinc-500 font-normal">
                    Set arrival windows and checkout times for your guests.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Check-in window */}
                  <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4 space-y-3">
                    <label className="text-xs font-semibold text-zinc-800 block">Check-in window</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] font-medium text-zinc-500 block mb-1">Start time</span>
                        <select
                          value={formatTimeDisplay(checkInStart, "3:00 pm")}
                          onChange={(e) => setCheckInStart(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs font-semibold text-[#1F1F1F] outline-none cursor-pointer focus:border-zinc-900 shadow-2xs"
                        >
                          {ALL_HOURS_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-zinc-500 block mb-1">End time</span>
                        <select
                          value={checkInEnd && !/flexible/i.test(checkInEnd) ? formatTimeDisplay(checkInEnd) : "Flexible"}
                          onChange={(e) => setCheckInEnd(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs font-semibold text-[#1F1F1F] outline-none cursor-pointer focus:border-zinc-900 shadow-2xs"
                        >
                          <option value="Flexible">Flexible</option>
                          {ALL_HOURS_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Checkout time */}
                  <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4 space-y-2">
                    <label className="text-xs font-semibold text-zinc-800 block">Checkout time</label>
                    <div>
                      <span className="text-[11px] font-medium text-zinc-500 block mb-1">Guests must leave before</span>
                      <select
                        value={formatTimeDisplay(checkOutTime, "11:00 am")}
                        onChange={(e) => setCheckOutTime(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs font-semibold text-[#1F1F1F] outline-none cursor-pointer focus:border-zinc-900 shadow-2xs"
                      >
                        {ALL_HOURS_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsCheckInOutModalOpen(false)}
                    className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      await handleSaveSection("house-rules");
                      setIsCheckInOutModalOpen(false);
                    }}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Times"}
                  </button>
                </div>
              </div>
            </ModalOverlay>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: PARKING INSTRUCTIONS & CONFIGURATION */}
      {/* --------------------------------------------------------- */}
      {activeSection === "parking" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSection("arrival-guide")}
              className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
            >
              ‹
            </button>
            <h1>Parking instructions & details</h1>
          </div>
          <p className="text-xs text-zinc-500 font-normal pl-11">
            Let guests know if parking is available, where to park, and any permit or reservation requirements.
          </p>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
            {/* Parking Available Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900">Parking available on premises</h3>
                <p className="text-[11px] text-zinc-400">Do guests have dedicated or shared parking?</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setParkingAvailable?.(false)}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${
                    parkingAvailable === false
                      ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                      : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => setParkingAvailable?.(true)}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${
                    parkingAvailable === true
                      ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                      : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Conditional Parking Details */}
            {parkingAvailable && (
              <div className="space-y-4 pt-3 border-t border-zinc-100">
                {/* Parking Type: Free vs Paid */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-800">Parking fee type</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setParkingType?.("FREE")}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        parkingType === "FREE"
                          ? "bg-[#FEE08B] border border-amber-300 text-zinc-950 shadow-2xs"
                          : "bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      Free
                    </button>
                    <button
                      type="button"
                      onClick={() => setParkingType?.("PAID")}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        parkingType === "PAID"
                          ? "bg-[#FEE08B] border border-amber-300 text-zinc-950 shadow-2xs"
                          : "bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      Paid
                    </button>
                  </div>
                </div>

                {/* Number of spaces */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-800">Available parking spaces</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setParkingSpaces?.(Math.max(1, (parkingSpaces || 1) - 1))}
                      className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-4 text-center text-xs font-semibold text-zinc-900">{parkingSpaces ?? 1}</span>
                    <button
                      type="button"
                      onClick={() => setParkingSpaces?.((parkingSpaces || 1) + 1)}
                      className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Reservation Required */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-800">Reservation required in advance</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setParkingReservation?.(false)}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${
                        parkingReservation === false
                          ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                          : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      onClick={() => setParkingReservation?.(true)}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${
                        parkingReservation === true
                          ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                          : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      ✓
                    </button>
                  </div>
                </div>

                {/* Parking Instructions */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-800">Parking instructions for guests</label>
                  <textarea
                    rows={4}
                    value={parkingInstructions}
                    onChange={(e) => setParkingInstructions?.(e.target.value)}
                    placeholder="e.g. Park in space #4B in underground garage. Access gate code is 1234."
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs text-zinc-800 outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("parking")}
              className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 9: CHECK-IN AND CHECK-OUT TIMES (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "arrival-guide" || activeSection === "check-in-out") && (
        <CheckInCheckOutView
          checkInStart={checkInStart}
          setCheckInStart={setCheckInStart}
          checkInEnd={checkInEnd}
          setCheckInEnd={setCheckInEnd}
          checkOutTime={checkOutTime}
          setCheckOutTime={setCheckOutTime}
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: DIRECTIONS (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      {activeSection === "directions" && (
        <DirectionsView
          directions={directions}
          setDirections={setDirections}
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: CHECK-IN METHOD (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      {activeSection === "check-in-method" && (
        <CheckInMethodView
          checkInMethod={checkInMethod}
          setCheckInMethod={setCheckInMethod}
          checkInInstructions={checkInInstructions}
          setCheckInInstructions={setCheckInInstructions}
          doorCode={doorCode}
          setDoorCode={setDoorCode}
          lockboxCode={lockboxCode}
          setLockboxCode={setLockboxCode}
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: WIFI DETAILS (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      {activeSection === "wifi-details" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => setActiveSection("check-in-out")} />
            <h1>Wifi details</h1>
          </div>

          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#1F1F1F]">Wifi network name</label>
              <input
                type="text"
                value={wifiNetwork}
                onChange={(e) => setWifiNetwork(e.target.value)}
                placeholder="wifi network name"
                className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-400 shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#1F1F1F]">Wifi password</label>
              <input
                type="text"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="wifi password"
                className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-400 shadow-2xs"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("arrival-guide")}
              className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: HOUSE MANUAL */}
      {/* --------------------------------------------------------- */}
      {activeSection === "house-manual" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => setActiveSection("check-in-out")} />
            <h1>House manual</h1>
          </div>
          <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-2">
            Share details about AC controls, appliances, trash disposal, or parking spots.
          </p>

          <div className="pt-2">
            <textarea
              rows={6}
              value={houseManual}
              onChange={(e) => setHouseManual(e.target.value)}
              placeholder="Enter your house manual instructions..."
              className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("arrival-guide")}
              className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: CHECK-OUT INSTRUCTIONS (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "checkout-instructions" ||
        activeSection === "check-out-instructions" ||
        activeSection === "checkout" ||
        activeSection === "check-out" ||
        activeSection === "checkout-page" ||
        activeSection === "check-out-page") && (
        <CheckOutInstructionsView
          checkOutTime={checkOutTime}
          setCheckOutTime={setCheckOutTime}
          checkOutInstructions={checkOutInstructions}
          setCheckOutInstructions={setCheckOutInstructions}
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: GUIDEBOOKS (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "guidebooks" || activeSection === "guidebook") && (
        <GuidebooksManager
          listingId={listingId || ""}
          listingCity={listingCity}
          listingCountry={listingCountry}
          listingLatitude={listingLatitude}
          listingLongitude={listingLongitude}
          setActiveSection={setActiveSection}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: INTERACTION PREFERENCES (Matches Figma 100%) */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "interaction-preferences" ||
        activeSection === "interactionpreferences" ||
        activeSection === "interaction") && (
        <InteractionPreferencesView
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
          value={guestInteractionPreference}
          onChange={setGuestInteractionPreference}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: LISTING STATUS (Matches Figma 100%) */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "listing-status" ||
        activeSection === "listingstatus") && (
        <ListingStatusView
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
          status={listingStatusSetting || "unlisted"}
          setStatus={setListingStatusSetting}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: LANGUAGES (Matches Figma 100%) */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "language" || activeSection === "languages") && (
        <LanguagesView
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
          selectedLanguageIds={selectedLanguageIds}
          setSelectedLanguageIds={setSelectedLanguageIds}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: GUEST REQUIREMENTS (Matches Figma 100%) */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "guest-requirements" ||
        activeSection === "guestrequirements") && (
        <GuestRequirementsView
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
          requireProfilePhoto={requireProfilePhoto}
          setRequireProfilePhoto={setRequireProfilePhoto}
        />
      )}

      {(activeSection === "local-laws" || activeSection === "locallaws") && (
        <LocalLawsView
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
          listingCity={listingCity}
          listingCountry={listingCountry}
        />
      )}

      {activeSection === "regulations" && (
        <RegulationsView
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
        />
      )}

      {activeSection === "taxes" && (
        <TaxesManager
          listingId={listingId || ""}
          listingCity={listingCity}
          listingCountry={listingCountry}
          setActiveSection={setActiveSection}
        />
      )}

      {(activeSection === "homyz-org-stays" ||
        activeSection === "airbnb-org-stays" ||
        activeSection === "airbnb-stays" ||
        activeSection === "homyz-stays" ||
        activeSection === "homyzstays") && (
        <AirbnbOrgStaysView
          listingId={listingId || ""}
          discounts={listingDiscounts}
          setActiveSection={setActiveSection}
          onSave={onSaveOrgStays}
          isSaving={isSaving}
        />
      )}
    </>
  );
}

/* ================================================================= */
/* CHECK-OUT INSTRUCTIONS INNER COMPONENT (Modern & Accessible)      */
/* ================================================================= */
function CheckOutInstructionsView({
  checkOutTime = "11:00",
  setCheckOutTime: _setCheckOutTime,
  checkOutInstructions = "",
  setCheckOutInstructions,
  setActiveSection,
  isSaving,
  handleSaveSection,
}: {
  checkOutTime?: string;
  setCheckOutTime?: (val: string) => void;
  checkOutInstructions?: string;
  setCheckOutInstructions?: (val: string) => void;
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (
    key: SectionKey,
    sectionSubtype?: "property" | "access" | "interaction" | "other",
    overrides?: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [draftInstructions, setDraftInstructions] = React.useState(checkOutInstructions);

  const suggestionChips = [
    "🗑️ Throw trash away",
    "🔑 Leave keys on counter",
    "🔒 Lock doors & windows",
    "💡 Turn off lights & AC",
    "🧺 Gather used towels in hamper",
    "🍽️ Run dishwasher",
  ];

  const handleAddSuggestion = (suggestion: string) => {
    const cleanText = suggestion.replace(/^[^\s]+\s/, "");
    setDraftInstructions((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `• ${cleanText}`;
      if (trimmed.includes(cleanText)) return prev;
      return `${trimmed}\n• ${cleanText}`;
    });
  };

  const handleSave = async () => {
    const next = draftInstructions.trim();
    setCheckOutInstructions?.(next);
    await handleSaveSection("checkout-instructions", undefined, { checkOutInstructions: next });
    setIsModalOpen(false);
  };

  const handleDelete = async () => {
    const next = "";
    setCheckOutInstructions?.(next);
    setDraftInstructions("");
    await handleSaveSection("checkout-instructions", undefined, { checkOutInstructions: next });
  };

  const formattedCheckOut = formatTimeDisplay(checkOutTime, "11:00 AM");

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <h1 className="tracking-tight text-[#1F1F1F]">Check-out instructions</h1>
      </div>

      {/* Description text */}
      <p className="text-xs text-zinc-500 font-normal leading-relaxed">
        Let guests know what to do before they leave. Guests will see these instructions 24 hours before check-out time.
      </p>

      {/* Card 1: Check-out time info */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
            </div>
            <div>
              <span className="text-[11px] font-medium text-zinc-400 block">Check-out time</span>
              <span className="text-sm font-semibold text-[#1F1F1F] block">{formattedCheckOut}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection("check-in-out")}
            className="text-xs font-semibold text-[#1F1F1F] hover:text-zinc-600 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Change time
          </button>
        </div>
      </div>

      {/* Card 2: Instructions Card or Empty State */}
      {checkOutInstructions ? (
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 space-y-4 shadow-2xs">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <span className="text-xs font-semibold text-zinc-500 block">Instructions for guests</span>
              <p className="text-xs text-zinc-800 font-medium whitespace-pre-line leading-relaxed">
                {checkOutInstructions}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftInstructions(checkOutInstructions);
                setIsModalOpen(true);
              }}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-all cursor-pointer shadow-2xs"
              aria-label="Edit check-out instructions"
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
              Shared 24 hours before check-out
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleDelete}
              className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-6 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 shadow-2xs">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xs font-semibold text-[#1F1F1F]">No check-out instructions yet</h3>
            <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
              Add details about returning keys, taking out trash, or locking doors before leaving.
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setDraftInstructions("");
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-5 py-2.5 shadow-2xs transition-all cursor-pointer"
            >
              <span className="text-sm font-semibold">+</span>
              Add instructions
            </button>
          </div>
        </div>
      )}

      {/* Button to edit or add if instructions already exist */}
      {checkOutInstructions && (
        <div>
          <button
            type="button"
            onClick={() => {
              setDraftInstructions(checkOutInstructions);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 transition-all cursor-pointer"
          >
            <span className="text-sm font-semibold leading-none">✎</span>
            Edit instructions
          </button>
        </div>
      )}

      {/* ===================================== */}
      {/* MODAL: Add / Edit Check-out Instructions */}
      {/* ===================================== */}
      {isModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 relative border border-zinc-150 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-5 space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">
                {checkOutInstructions ? "Edit check-out instructions" : "Add check-out instructions"}
              </h3>
              <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                Guests will see these instructions 24 hours before check-out time.
              </p>
            </div>

            {/* Quick Suggestions */}
            <div className="mb-4 space-y-2">
              <span className="text-[11px] font-semibold text-zinc-500 block">Quick suggestions (click to add)</span>
              <div className="flex flex-wrap gap-1.5">
                {suggestionChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddSuggestion(chip)}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-[11px] font-medium text-zinc-700 px-2.5 py-1 transition-colors cursor-pointer"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4 space-y-2 mb-6">
              <label className="block text-xs font-semibold text-zinc-800">
                Instructions for guests
              </label>
              <textarea
                rows={6}
                value={draftInstructions}
                onChange={(e) => setDraftInstructions(e.target.value)}
                placeholder="e.g. Please take all bagged trash to the outdoor bins, place used towels in the hamper, turn off the AC, and lock the door behind you."
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-900 shadow-2xs placeholder:text-zinc-400 leading-relaxed resize-none"
              />
              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                  </svg>
                  Shared 24 hours before check-out
                </span>
                <span>{draftInstructions.length} characters</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ================================================================= */
/* GUIDEBOOKS INNER COMPONENT (Matches Figma Screenshot 100%)        */
/* ================================================================= */
function GuidebooksView({
  setActiveSection,
  isSaving: _isSaving,
  handleSaveSection,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [guidebooksList, setGuidebooksList] = React.useState([
    { id: "1", title: "Local Dining & Cafes", itemsCount: 4 },
    { id: "2", title: "Sightseeing & Attractions", itemsCount: 6 },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button & Plus Circle Icon (Matches Figma Screenshot 100%) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => setActiveSection("arrival-guide")} />
          <h1 className="tracking-tight text-[#1F1F1F]">Create a guidebooks</h1>
        </div>

        {/* Plus (+) Button on the right of header */}
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 text-sm font-semibold transition-all cursor-pointer shadow-2xs"
        >
          +
        </button>
      </div>

      {/* Subtext & Content Policy Link */}
      <div className="space-y-1">
        <p className="text-xs text-zinc-500 font-normal leading-relaxed">
          Create a guidebook to easily share local tips with guests.
        </p>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="text-xs font-semibold text-[#1F1F1F] underline hover:text-zinc-700 block"
        >
          Read our content policy
        </a>
      </div>

      {isAdding && (
        <div className="p-4 rounded-2xl border border-zinc-200 bg-white space-y-3 shadow-2xs animate-in fade-in">
          <h3 className="text-xs font-semibold text-[#1F1F1F]">Add New Guidebook</h3>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Favorite Neighborhood Restaurants"
            className="w-full rounded-xl border border-zinc-200 p-3 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-400 shadow-2xs"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-1.5 rounded-full border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (newTitle.trim()) {
                  setGuidebooksList([...guidebooksList, { id: Date.now().toString(), title: newTitle, itemsCount: 1 }]);
                  setNewTitle("");
                  setIsAdding(false);
                  handleSaveSection("arrival-guide");
                }
              }}
              className="px-4 py-1.5 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-xs font-semibold text-zinc-950 shadow-2xs"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Guidebook Cards Grid (Matching Figma screenshot 100%) */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        {guidebooksList.map((gb, idx) => (
          <div
            key={gb.id}
            className={`rounded-[22px] border border-zinc-300/80 bg-zinc-200/70 p-5 aspect-[4/3] flex flex-col justify-between transition-all cursor-pointer hover:border-zinc-400 shadow-2xs ${
              idx === 0 ? "border-zinc-400 bg-zinc-200/90" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-white/80 border border-zinc-200 flex items-center justify-center text-xs shadow-2xs">
              📖
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[#1F1F1F] line-clamp-2">{gb.title}</h4>
              <p className="text-[10px] text-zinc-500 font-medium">{gb.itemsCount} recommendations</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================= */
/* INTERACTION PREFERENCES INNER COMPONENT (Matches Figma 100%)      */
/* ================================================================= */
function InteractionPreferencesView({
  setActiveSection,
  isSaving,
  handleSaveSection,
  value,
  onChange,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (
    key: SectionKey,
    sectionSubtype?: "property" | "access" | "interaction" | "other",
    overrides?: Record<string, unknown>,
  ) => Promise<void>;
  value: string;
  onChange?: (value: string) => void;
}) {
  const options = [
    "I won't be available in person, and prefer communicating through the app.",
    "I like to say hello in person, but keep to myself otherwise",
    "I like socializing and spending time with the guests",
    "No preferences",
  ];
  const selectedOption = options.indexOf(value || "No preferences");

  return (
    <div className="max-w-2xl space-y-6 pb-16 font-sans animate-in fade-in">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1F1F1F]">Interaction with guests</h1>
          <p className="mt-0.5 text-xs font-normal text-zinc-500">
            Set expectations before guests arrive.
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="max-w-xl text-xs font-normal leading-relaxed text-zinc-500">
        Let guests know how much interaction you will have during their stay, from in-person greetings to full self check-in privacy.
      </p>

      {/* Options List */}
      <div className="space-y-2" role="radiogroup" aria-label="Guest interaction preference">
        {options.map((option, index) => {
          const isActive = selectedOption === index;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange?.(option)}
              className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left shadow-2xs transition-all cursor-pointer ${
                isActive
                  ? "border-zinc-900 bg-zinc-50 text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
              }`}
              role="radio"
              aria-checked={isActive}
              aria-label={option}
            >
              <span className="flex-1 text-sm font-medium leading-relaxed text-current">
                {option}
              </span>

              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  isActive ? "bg-zinc-900" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                  isActive ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* Action Buttons: Save & Cancel */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSaveSection("description", "interaction")}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDD017] text-zinc-950 font-semibold text-xs px-6 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-6 py-2.5 transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ================================================================= */
/* LISTING STATUS INNER COMPONENT (Matches Figma 100%)               */
/* ================================================================= */
function ListingStatusView({
  setActiveSection,
  isSaving,
  handleSaveSection,
  status: propStatus,
  setStatus: propSetStatus,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
  status?: "listed" | "unlisted";
  setStatus?: (s: "listed" | "unlisted") => void;
}) {
  const [localStatus, setLocalStatus] = React.useState<"listed" | "unlisted">(propStatus || "unlisted");
  const status = propStatus ?? localStatus;
  const setStatus = (val: "listed" | "unlisted") => {
    setLocalStatus(val);
    propSetStatus?.(val);
  };
  const [isSaved, setIsSaved] = React.useState(false);

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <h1 className="tracking-tight text-[#1F1F1F]">Listing status</h1>
      </div>

      {/* Modern House Illustration (Matching Figma Screenshot 100%) */}
      <div className="flex justify-center py-6">
        <svg className="w-56 h-44" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Main House Body */}
          <rect x="60" y="60" width="75" height="75" rx="3" fill="#F8FAFC" stroke="#1E293B" strokeWidth="2.5" />
          {/* Slanted Roof */}
          <polygon points="50,62 97.5,25 145,62" fill="#FDE047" stroke="#1E293B" strokeWidth="2.5" />
          {/* Windows */}
          <rect x="72" y="72" width="18" height="24" rx="2" fill="#93C5FD" stroke="#1E293B" strokeWidth="2" />
          <line x1="81" y1="72" x2="81" y2="96" stroke="#1E293B" strokeWidth="1.5" />
          <line x1="72" y1="84" x2="90" y2="84" stroke="#1E293B" strokeWidth="1.5" />
          {/* Door */}
          <rect x="102" y="95" width="20" height="40" rx="1" fill="#334155" stroke="#1E293B" strokeWidth="2" />
          <circle cx="106" cy="115" r="1.5" fill="#FDE047" />
          {/* Ground Line */}
          <path d="M40 135 H160" stroke="#15803D" strokeWidth="4" strokeLinecap="round" />
          {/* Tree Left */}
          <ellipse cx="46" cy="120" rx="10" ry="16" fill="#22C55E" stroke="#15803D" strokeWidth="2" />
          <line x1="46" y1="128" x2="46" y2="135" stroke="#15803D" strokeWidth="2.5" />
          {/* Tree Right */}
          <ellipse cx="152" cy="116" rx="12" ry="18" fill="#16A34A" stroke="#15803D" strokeWidth="2" />
          <line x1="152" y1="126" x2="152" y2="135" stroke="#15803D" strokeWidth="2.5" />
        </svg>
      </div>

      {/* Selectable Status Cards (Listed vs Unlisted) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Listed Card */}
        <div
          onClick={() => setStatus("listed")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 shadow-2xs ${
            status === "listed"
              ? "bg-[#FEF9EC] border-amber-300 shadow-2xs"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <h3 className="font-medium text-base text-[#1F1F1F]">Listed</h3>
          <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
            Guests can find your listing in search results and book available dates.
          </p>
        </div>

        {/* Unlisted Card */}
        <div
          onClick={() => setStatus("unlisted")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 shadow-2xs ${
            status === "unlisted"
              ? "bg-[#FEF9EC] border-amber-300 shadow-2xs"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <h3 className="font-medium text-base text-[#1F1F1F]">Unlisted</h3>
          <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
            Your listing is hidden from search results and guests cannot book dates.
          </p>
        </div>
      </div>

      {/* Save & Cancel Buttons */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            handleSaveSection("listing-status");
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
          }}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ================================================================= */
/* LANGUAGES INNER COMPONENT (Matches Figma 100%)                    */
/* ================================================================= */
function LanguagesView({
  setActiveSection,
  isSaving,
  handleSaveSection,
  selectedLanguageIds,
  setSelectedLanguageIds,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
  selectedLanguageIds: string[];
  setSelectedLanguageIds?: (value: string[]) => void;
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [searchLang, setSearchLang] = React.useState("");

  const filteredLanguages: LanguageOption[] = React.useMemo(
    () =>
      LANGUAGE_OPTIONS.filter((language) =>
        language.name.toLowerCase().includes(searchLang.toLowerCase()) ||
        (language.nativeName ?? "").toLowerCase().includes(searchLang.toLowerCase())
      ),
    [searchLang]
  );

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <h1 className="tracking-tight text-[#1F1F1F]">Languages</h1>
      </div>

      <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-1">
        Select the languages you and your co-hosts can speak with guests during their stay or via messaging.
      </p>

      {/* List of currently selected languages */}
      <div className="flex flex-wrap gap-2 pt-2">
        {selectedLanguageIds.length === 0 && (
          <p className="text-xs text-zinc-500">No languages selected yet.</p>
        )}
        {selectedLanguageIds.map((languageId) => {
          const languageName = getLanguageDisplayNames([languageId])[0] ?? languageId;
          return (
            <div
              key={languageId}
              className="inline-flex items-center gap-2 bg-zinc-100 border border-zinc-250 text-[#1F1F1F] text-xs font-semibold px-4 py-2 rounded-full shadow-2xs"
            >
              <span>{languageName}</span>
              <button
                type="button"
                aria-label={`Remove ${languageName}`}
                onClick={() => {
                  if (!setSelectedLanguageIds) return;
                  setSelectedLanguageIds(selectedLanguageIds.filter((id) => id !== languageId));
                }}
                className="text-zinc-400 hover:text-zinc-700 font-semibold"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Add a language Modal / Expandable selector */}
      {isAdding && (
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white space-y-4 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1F1F1F]">Select languages</h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">{LANGUAGE_OPTIONS.length} languages available</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-zinc-400 hover:text-zinc-600 font-semibold text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <input
            type="text"
            value={searchLang}
            onChange={(e) => setSearchLang(e.target.value)}
            placeholder="Search language..."
            className="w-full rounded-xl border border-zinc-200 p-3 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-400 shadow-2xs"
          />

          <div className="max-h-80 overflow-y-auto space-y-1 custom-scrollbar pr-1" role="listbox" aria-multiselectable="true">
            {filteredLanguages.map((lang) => {
              const isSelected = selectedLanguageIds.includes(lang.id);
              return (
                <button
                  key={lang.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (!setSelectedLanguageIds) return;
                    if (isSelected) {
                      setSelectedLanguageIds(selectedLanguageIds.filter((id) => id !== lang.id));
                    } else {
                      setSelectedLanguageIds([...selectedLanguageIds, lang.id]);
                    }
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-xs font-semibold transition-colors ${
                    isSelected ? "border-amber-300 bg-[#FEF9EC] text-zinc-950" : "border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <span>
                    <span className="block">{lang.name}</span>
                    {lang.nativeName && lang.nativeName !== lang.name && (
                      <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">{lang.nativeName}</span>
                    )}
                  </span>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${isSelected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-transparent"}`}>
                    ✓
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                void handleSaveSection("language");
                setIsAdding(false);
              }}
              className="px-5 py-2 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-xs font-semibold text-zinc-950 shadow-2xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save languages"}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-5 py-2.5 shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
        >
          <span className="text-sm font-semibold">+</span>
          Add a language
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSaveSection("language")}
          className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-xs font-semibold text-zinc-800 shadow-2xs transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================= */
/* GUEST REQUIREMENTS INNER COMPONENT (Matches Figma 100%)           */
/* ================================================================= */
function GuestRequirementsView({
  setActiveSection,
  isSaving,
  handleSaveSection,
  requireProfilePhoto,
  setRequireProfilePhoto,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
  requireProfilePhoto: boolean;
  setRequireProfilePhoto?: (value: boolean) => void;
}) {
  return (
    <div className="space-y-7 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <h1 className="tracking-tight text-[#1F1F1F]">Guest requirements</h1>
      </div>

      {/* Toggle Row: Require a profile photo */}
      <div className="flex items-start justify-between gap-6 pt-1">
        <div className="space-y-1 max-w-md">
          <h3 className="text-xs font-semibold text-[#1F1F1F]">Require a profile photo</h3>
          <p className="text-xs text-zinc-500 font-normal leading-relaxed">
            Ask guests to upload a confirmed profile photo before booking your place.
          </p>
        </div>

        {/* Toggle Switch matching Figma Screenshot 100% */}
        <button
          type="button"
          onClick={() => setRequireProfilePhoto?.(!requireProfilePhoto)}
          role="switch"
          aria-checked={requireProfilePhoto}
          aria-label="Require a profile photo"
          className={`w-12 h-6.5 rounded-full shrink-0 p-0.5 transition-colors duration-200 cursor-pointer ${
            requireProfilePhoto ? "bg-zinc-900" : "bg-zinc-200"
          }`}
        >
          <div
            className={`w-5.5 h-5.5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
              requireProfilePhoto ? "translate-x-5.5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Bulleted Requirements Section */}
      <div className="space-y-2.5 pt-1">
        <h3 className="text-xs font-semibold text-[#1F1F1F]">
          All Homyz guests are requires to:
        </h3>
        <ul className="space-y-2 text-xs text-zinc-500 font-normal">
          <li className="flex items-start gap-2">
            <span className="text-zinc-400 font-semibold">•</span>
            <span>Provide a confirmed email address and phone number</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-zinc-400 font-semibold">•</span>
            <span>Provide payment information</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-zinc-400 font-semibold">•</span>
            <span>Agree to your house rules</span>
          </li>
        </ul>
      </div>

      {/* Save & Cancel Buttons */}
      <div className="flex items-center gap-3 pt-3">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSaveSection("guest-requirements")}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ================================================================= */
/* CHECK-IN & CHECK-OUT INNER COMPONENT                              */
/* ================================================================= */
function CheckInCheckOutView({
  checkInStart,
  setCheckInStart,
  checkInEnd,
  setCheckInEnd,
  checkOutTime,
  setCheckOutTime,
  setActiveSection,
  isSaving: _isSaving,
  handleSaveSection,
}: {
  checkInStart: string;
  setCheckInStart: (val: string) => void;
  checkInEnd: string;
  setCheckInEnd: (val: string) => void;
  checkOutTime: string;
  setCheckOutTime: (val: string) => void;
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [editingStart, setEditingStart] = React.useState(false);
  const [editingEnd, setEditingEnd] = React.useState(false);
  const [editingCheckOut, setEditingCheckOut] = React.useState(false);

  const timesList = [...ALL_HOURS_OPTIONS, "Flexible"];

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("house-rules")} />
        <h1>Check-in and check-out times</h1>
      </div>

      {/* Group 1: Check-in window and check-out times */}
      <div className="space-y-3 pt-2">
        <span className="text-xs font-semibold text-zinc-600 block">
          Check-in window and check-out times
        </span>

        {/* Row 1: Start time */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 space-y-3 shadow-2xs">
          <div
            onClick={() => setEditingStart((v) => !v)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-zinc-400 block">Start time</span>
              <span className="text-sm font-semibold text-[#1F1F1F] block">{checkInStart || "3:00 PM"}</span>
            </div>
            <span className="text-zinc-600 text-base font-semibold">›</span>
          </div>

          {editingStart && (
            <div className="pt-2 border-t border-zinc-100 animate-in fade-in">
              <select
                value={checkInStart || "3:00 PM"}
                onChange={(e) => {
                  setCheckInStart(e.target.value);
                  handleSaveSection("arrival-guide");
                  setEditingStart(false);
                }}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-semibold text-[#1F1F1F] bg-white outline-none cursor-pointer"
              >
                {timesList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Row 2: End time */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 space-y-3 shadow-2xs">
          <div
            onClick={() => setEditingEnd((v) => !v)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-zinc-400 block">End time</span>
              <span className="text-sm font-semibold text-[#1F1F1F] block">{checkInEnd || "Flexible"}</span>
            </div>
            <span className="text-zinc-600 text-base font-semibold">›</span>
          </div>

          {editingEnd && (
            <div className="pt-2 border-t border-zinc-100 animate-in fade-in">
              <select
                value={checkInEnd || "Flexible"}
                onChange={(e) => {
                  setCheckInEnd(e.target.value);
                  handleSaveSection("arrival-guide");
                  setEditingEnd(false);
                }}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-semibold text-[#1F1F1F] bg-white outline-none cursor-pointer"
              >
                {timesList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Group 2: Check-out time */}
      <div className="space-y-3 pt-4">
        <span className="text-xs font-semibold text-zinc-600 block">
          Check-out time
        </span>

        {/* Row 3: Select time */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 space-y-3 shadow-2xs">
          <div
            onClick={() => setEditingCheckOut((v) => !v)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-zinc-400 block">Select time</span>
              <span className="text-sm font-semibold text-[#1F1F1F] block">{checkOutTime || "12:00 PM"}</span>
            </div>
            <span className="text-zinc-600 text-base font-semibold">›</span>
          </div>

          {editingCheckOut && (
            <div className="pt-2 border-t border-zinc-100 animate-in fade-in">
              <select
                value={checkOutTime || "12:00 PM"}
                onChange={(e) => {
                  setCheckOutTime(e.target.value);
                  handleSaveSection("arrival-guide");
                  setEditingCheckOut(false);
                }}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-semibold text-[#1F1F1F] bg-white outline-none cursor-pointer"
              >
                {timesList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================= */
/* DIRECTIONS INNER COMPONENT (Matches Figma Screenshot 100%)        */
/* ================================================================= */
function DirectionsView({
  directions = "",
  setDirections,
  setActiveSection,
  isSaving,
  handleSaveSection,
}: {
  directions?: string;
  setDirections?: (val: string) => void;
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("check-in-out")} />
        <h1>Directions</h1>
      </div>

      {/* Subtitle description matching screenshot 100% */}
      <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-2">
        Let guests know how to get to your place. Include any tips for parking or public transportation
      </p>

      {/* Textarea field */}
      <div className="pt-2">
        <textarea
          rows={5}
          value={directions}
          onChange={(e) => setDirections?.(e.target.value)}
          placeholder="Add directions, parking instructions, or landmark references..."
          className="w-full rounded-2xl border border-zinc-200/90 bg-white p-4 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
        />
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleSaveSection("directions")}
          className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* CHECK-IN METHOD DATA                                                  */
/* ------------------------------------------------------------------ */
const CHECK_IN_METHODS_DATA = [
  {
    id: "SMART_LOCK",
    label: "Smart lock",
    description: "Guests will use a code or app to open a wifi-connected lock.",
    hasCode: true,
    codeLabel: "Smart lock / door code",
    codePlaceholder: "e.g. 1234# or app access link",
  },
  {
    id: "KEYPAD",
    label: "Keypad",
    description: "Guests will use the code you provide to open an electronic lock.",
    hasCode: true,
    codeLabel: "Keypad / door code",
    codePlaceholder: "e.g. 4567",
  },
  {
    id: "LOCKBOX",
    label: "Lockbox",
    description: "Guests will use a code you provide to open a small safe that has a key inside.",
    hasCode: true,
    codeLabel: "Lockbox combination code",
    codePlaceholder: "e.g. 8842",
  },
  {
    id: "BUILDING_STAFF",
    label: "Building staff",
    description: "Someone will be available 24 hours a day to let guests in.",
    hasCode: false,
    codeLabel: "",
    codePlaceholder: "",
  },
  {
    id: "IN_PERSON_GREETING",
    label: "In-person greeting",
    description: "Guests will meet you or your co-host to pick up keys.",
    hasCode: false,
    codeLabel: "",
    codePlaceholder: "",
  },
  {
    id: "OTHER",
    label: "Other",
    description: "Guests will use a different method not listed here.",
    hasCode: false,
    codeLabel: "",
    codePlaceholder: "",
  },
] as const;

function CheckInMethodIcon({ id }: { id: string }) {
  if (id === "SMART_LOCK") {
    return (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4" />
        <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "KEYPAD") {
    return (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none" />
        <circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
        <rect x="9.5" y="18" width="5" height="1.5" rx="0.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "LOCKBOX") {
    return (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="3" y="6" width="18" height="14" rx="2" />
        <circle cx="12" cy="13" r="3" />
        <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
        <rect x="10.5" y="3" width="3" height="4" rx="0.5" />
      </svg>
    );
  }
  if (id === "BUILDING_STAFF") {
    return (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="10" cy="7" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 21a6 6 0 0112 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 12l2 2 4-4" />
      </svg>
    );
  }
  if (id === "IN_PERSON_GREETING") {
    return (
      <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11.25a3.75 3.75 0 107.5 0 3.75 3.75 0 00-7.5 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9.75V6a3 3 0 00-6 0v3.75" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v4.5M9 19.5h6" />
      </svg>
    );
  }
  return (
    <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function normalizeCheckInMethod(val: string): string {
  const map: Record<string, string> = {
    SMART_LOCK: "SMART_LOCK",
    "Smart lock": "SMART_LOCK",
    KEYPAD: "KEYPAD",
    Keypad: "KEYPAD",
    LOCKBOX: "LOCKBOX",
    Lockbox: "LOCKBOX",
    BUILDING_STAFF: "BUILDING_STAFF",
    "Building staff": "BUILDING_STAFF",
    IN_PERSON_GREETING: "IN_PERSON_GREETING",
    "In-person greeting": "IN_PERSON_GREETING",
    "Host greets in person": "IN_PERSON_GREETING",
    OTHER: "OTHER",
    Other: "OTHER",
  };
  return map[val] || val;
}

function getCheckInMethodLabel(val: string): string {
  const m = CHECK_IN_METHODS_DATA.find((x) => x.id === normalizeCheckInMethod(val));
  return m?.label || val || "Smart lock";
}

/* ================================================================= */
/* CHECK-IN METHOD INNER COMPONENT (Redesigned with Modals)           */
/* ================================================================= */
function CheckInMethodView({
  checkInMethod,
  setCheckInMethod,
  checkInInstructions,
  setCheckInInstructions,
  doorCode,
  setDoorCode,
  lockboxCode,
  setLockboxCode,
  setActiveSection,
  isSaving,
  handleSaveSection,
}: {
  checkInMethod: string;
  setCheckInMethod: (val: string) => void;
  checkInInstructions?: string;
  setCheckInInstructions?: (val: string) => void;
  doorCode?: string;
  setDoorCode?: (val: string) => void;
  lockboxCode?: string;
  setLockboxCode?: (val: string) => void;
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [isSelectModalOpen, setIsSelectModalOpen] = React.useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [isInstructionModalOpen, setIsInstructionModalOpen] = React.useState(false);
  const [selectedMethodId, setSelectedMethodId] = React.useState<string | null>(null);
  const [draftCode, setDraftCode] = React.useState(doorCode || lockboxCode || "");

  const normalizedCurrent = normalizeCheckInMethod(checkInMethod);
  const currentMethodData = CHECK_IN_METHODS_DATA.find((m) => m.id === normalizedCurrent);
  const codeValue = normalizedCurrent === "LOCKBOX" ? lockboxCode : doorCode;

  const handlePickMethod = (methodId: string) => {
    const m = CHECK_IN_METHODS_DATA.find((x) => x.id === methodId);
    setSelectedMethodId(methodId);
    setIsSelectModalOpen(false);
    if (m?.hasCode) {
      const existingCode = methodId === "LOCKBOX" ? (lockboxCode || "") : (doorCode || "");
      setDraftCode(existingCode);
      setIsDetailModalOpen(true);
    } else {
      setCheckInMethod(methodId);
      handleSaveSection("check-in-method");
    }
  };

  const handleSaveDetail = async () => {
    if (selectedMethodId) {
      setCheckInMethod(selectedMethodId);
      if (selectedMethodId === "LOCKBOX") {
        setLockboxCode?.(draftCode);
      } else {
        setDoorCode?.(draftCode);
      }
    }
    await handleSaveSection("check-in-method");
    setIsDetailModalOpen(false);
  };

  const selectedDetailMethod = CHECK_IN_METHODS_DATA.find((m) => m.id === selectedMethodId);

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("check-in-out")} />
        <h1>Check-in method</h1>
      </div>

      {/* Card: Selected Method */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-zinc-600 shrink-0">
              <CheckInMethodIcon id={normalizedCurrent} />
            </div>
            <span className="text-sm font-semibold text-[#1F1F1F]">
              {getCheckInMethodLabel(checkInMethod)}
            </span>
          </div>
          {/* Pencil edit button */}
          <button
            type="button"
            onClick={() => setIsSelectModalOpen(true)}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-all cursor-pointer shadow-2xs"
            aria-label="Change check-in method"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>

        {/* Code row — only for code-based methods */}
        {currentMethodData?.hasCode && (
          <button
            type="button"
            onClick={() => {
              setSelectedMethodId(normalizedCurrent);
              setDraftCode(codeValue || "");
              setIsDetailModalOpen(true);
            }}
            className="mt-4 w-full flex items-center justify-between border-t border-zinc-100 pt-4 group cursor-pointer"
          >
            <span className={`text-xs font-medium truncate max-w-[80%] ${codeValue ? "text-zinc-600" : "text-zinc-400"}`}>
              {codeValue || "Add access code"}
            </span>
            <svg className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* Section: Check-in instructions */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-[#1F1F1F]">Check-in instructions</h2>
        <p className="text-xs text-zinc-500 font-normal leading-relaxed">
          Help guests have a smooth arrival. Share tips for how to get inside – you can also add photos.
        </p>

        {checkInInstructions && (
          <button
            type="button"
            onClick={() => setIsInstructionModalOpen(true)}
            className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left space-y-1.5 shadow-2xs hover:border-zinc-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-zinc-700 truncate">{checkInInstructions}</span>
              <svg className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
              Shared 48 hours before check-in
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsInstructionModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-2xs hover:border-zinc-300 hover:bg-zinc-50 transition-all cursor-pointer"
        >
          <span className="text-base font-medium leading-none">+</span>
          {checkInInstructions ? "Edit instructions" : "Add instructions"}
        </button>
      </div>

      {/* ===================================== */}
      {/* MODAL: Select a check-in method       */}
      {/* ===================================== */}
      {isSelectModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 relative border border-zinc-150 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsSelectModalOpen(false)}
              className="absolute top-6 right-6 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mb-6">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Select a check-in method</h3>
            </div>
            <div className="space-y-3">
              {CHECK_IN_METHODS_DATA.map((method) => {
                const isSelected = normalizedCurrent === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => handlePickMethod(method.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all cursor-pointer shadow-2xs flex items-start gap-4 ${
                      isSelected ? "border-zinc-900 bg-white" : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <div className="text-zinc-600 shrink-0 mt-0.5">
                      <CheckInMethodIcon id={method.id} />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-[#1F1F1F] mb-0.5">{method.label}</span>
                      <p className="text-xs text-zinc-400 leading-relaxed font-normal">{method.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ===================================== */}
      {/* MODAL: Add / Edit code details        */}
      {/* ===================================== */}
      {isDetailModalOpen && selectedDetailMethod && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute top-6 right-6 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mb-6 flex items-center gap-3">
              <div className="text-zinc-600">
                <CheckInMethodIcon id={selectedDetailMethod.id} />
              </div>
              <div>
                <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">{selectedDetailMethod.label}</h3>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">{selectedDetailMethod.description}</p>
              </div>
            </div>
            {selectedDetailMethod.hasCode && (
              <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4 space-y-2 mb-6">
                <label className="block text-xs font-semibold text-zinc-800">
                  {selectedDetailMethod.codeLabel}{" "}
                  <span className="font-normal text-zinc-400">(Confidential)</span>
                </label>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  This code is only shared with confirmed booked guests 48 hours before check-in.
                </p>
                <input
                  type="text"
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value)}
                  placeholder={selectedDetailMethod.codePlaceholder}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#1F1F1F] outline-none focus:border-zinc-900 shadow-2xs placeholder:text-zinc-400"
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsDetailModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveDetail}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ===================================== */}
      {/* MODAL: Add / Edit instructions        */}
      {/* ===================================== */}
      {isInstructionModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsInstructionModalOpen(false)}
              className="absolute top-6 right-6 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mb-6 space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Check-in instructions</h3>
              <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                Help guests have a smooth arrival. Share step-by-step tips to get inside.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4 space-y-2 mb-6">
              <label className="block text-xs font-semibold text-zinc-800">Instructions for guests</label>
              <textarea
                rows={5}
                value={checkInInstructions || ""}
                onChange={(e) => setCheckInInstructions?.(e.target.value)}
                placeholder="e.g. Take the elevator to the 3rd floor. The lockbox is on the door handle. Enter code 8842 and turn the knob clockwise."
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-900 shadow-2xs placeholder:text-zinc-400 leading-relaxed resize-none"
              />
              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                </svg>
                Shared 48 hours before check-in
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsInstructionModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  await handleSaveSection("check-in-method");
                  setIsInstructionModalOpen(false);
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ================================================================= */
/* REGULATIONS INNER COMPONENT (Matches Reference Figma Design 100%) */
/* ================================================================= */
function RegulationsView({
  setActiveSection,
  isSaving: _isSaving,
  handleSaveSection,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [isEditingReg, setIsEditingReg] = React.useState(false);
  const [regNumber, setRegNumber] = React.useState("XXXXXXXX");
  const [regAddress, setRegAddress] = React.useState("Address, Country");

  if (showDetails) {
    return (
      <div className="animate-in fade-in pb-12 font-sans w-full max-w-4xl">
        {/* Top Back Button */}
        <div className="flex items-center justify-between pb-4">
          <BackButton onClick={() => {
              setShowDetails(false);
              setIsEditingReg(false);
            }} />
        </div>

        {/* 2-Column Grid Layout: Left Content + Right Thumbs-Up Illustration */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start pt-2">
          {/* Left Content Column */}
          <div className="md:col-span-7 space-y-6">
            {/* Section 1: You're all set! */}
            <div className="space-y-2">
              <h1 className="tracking-tight text-[#1F1F1F]">
                You&apos;re all set!
              </h1>
              <p className="text-xs text-zinc-500 font-normal leading-relaxed max-w-md">
                Your official municipal hosting permit has been recorded and verified.
              </p>
              <button
                type="button"
                onClick={() => setIsEditingReg(!isEditingReg)}
                className="text-xs font-semibold text-[#1F1F1F] underline underline-offset-4 hover:text-zinc-600 transition-colors pt-1 block cursor-pointer"
              >
                {isEditingReg ? "Done editing" : "Edit registration details"}
              </button>
            </div>

            {/* Section 2: Registration details */}
            <div className="space-y-4 pt-3">
              <h2 className="text-xl font-semibold tracking-tight text-[#1F1F1F]">
                Registration details
              </h2>
              <p className="text-xs text-zinc-500 font-normal leading-relaxed max-w-md">
                Keep your official tourism permit number and registered address up to date.
              </p>

              {/* Editable or Static Registration Fields */}
              {isEditingReg ? (
                <div className="space-y-3 pt-2 max-w-md bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:border-zinc-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                      Address & Country
                    </label>
                    <input
                      type="text"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:border-zinc-500 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveSection("regulations");
                      setIsEditingReg(false);
                    }}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDD017] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
                  >
                    Save Registration
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <p className="text-xs text-zinc-400 font-normal">XXXXXXXX</p>
                    <p className="text-xs font-semibold text-[#1F1F1F]">{regNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 font-normal">Address, Country</p>
                    <p className="text-xs font-semibold text-[#1F1F1F]">{regAddress}</p>
                  </div>
                </div>
              )}

              {/* Bottom Paragraph with Customer Support Link */}
              <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-2 max-w-md">
                If your permit details change or you need assistance with registration, please contact our{" "}
                <a
                  href="#support"
                  onClick={(e) => e.preventDefault()}
                  className="underline text-[#1F1F1F] font-semibold hover:text-zinc-600 transition-colors"
                >
                  customer support team
                </a>
              </p>
            </div>
          </div>

          {/* Right Column: Thumbs Up Sunburst Vector Illustration (Matches Figma 100%) */}
          <div className="md:col-span-5 flex justify-center items-center pt-2 md:pt-0">
            <div className="relative w-72 h-72 flex items-center justify-center">
              {/* Floating Confetti Shapes matching Figma Design */}
              <div className="absolute top-2 left-6 w-9 h-5 rounded-full bg-[#FDBA74] rotate-[-25deg] opacity-90" />
              <div className="absolute top-12 right-8 w-4 h-3 rounded-full bg-[#FDE047] opacity-80" />
              <div className="absolute top-16 right-4 w-3 h-2 rounded-full bg-[#FDBA74] opacity-80" />
              <div className="absolute bottom-8 left-4 w-4 h-4 rounded-full bg-[#FDE047] opacity-90" />
              <div className="absolute bottom-6 left-28 w-12 h-5 rounded-full bg-[#FDBA74] opacity-80" />

              {/* Sunburst Rays + Hand Thumbs Up Vector SVG */}
              <svg className="w-64 h-64" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Sunburst Rays */}
                <g stroke="#3F3F46" strokeWidth="1.2" strokeLinecap="round">
                  <line x1="100" y1="20" x2="100" y2="32" />
                  <line x1="130" y1="26" x2="125" y2="37" />
                  <line x1="155" y1="42" x2="146" y2="51" />
                  <line x1="172" y1="68" x2="160" y2="74" />
                  <line x1="178" y1="98" x2="165" y2="98" />
                  <line x1="172" y1="128" x2="160" y2="122" />
                  <line x1="155" y1="154" x2="146" y2="145" />
                  <line x1="130" y1="170" x2="125" y2="159" />
                  <line x1="100" y1="176" x2="100" y2="164" />
                  <line x1="70" y1="170" x2="75" y2="159" />
                  <line x1="45" y1="154" x2="54" y2="145" />
                  <line x1="28" y1="128" x2="40" y2="122" />
                  <line x1="22" y1="98" x2="35" y2="98" />
                  <line x1="28" y1="68" x2="40" y2="74" />
                  <line x1="45" y1="42" x2="54" y2="51" />
                  <line x1="70" y1="26" x2="75" y2="37" />
                </g>

                {/* Hand Thumbs Up Outer Outline & Fill */}
                <g>
                  {/* Coral/Red Skin Tone Base */}
                  <path
                    d="M60 145 C65 140, 80 135, 95 110 C102 98, 106 80, 102 65 C98 52, 104 45, 110 46 C116 47, 118 58, 114 75 L118 78 C128 72, 138 72, 142 80 C144 84, 142 90, 136 94 C144 94, 148 100, 146 106 C144 112, 138 116, 130 118 C138 120, 142 126, 138 132 C134 138, 124 142, 110 142 C95 142, 85 148, 70 160 Z"
                    fill="#F87171"
                    stroke="#18181B"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />

                  {/* Darker Red Shadow Accent */}
                  <path
                    d="M75 130 C85 125, 105 110, 112 85 C114 78, 116 65, 110 52 C114 55, 116 65, 114 78 C118 74, 126 74, 132 80 C134 84, 132 90, 126 94 C134 94, 138 100, 136 106 C134 112, 128 116, 120 118 C128 120, 132 126, 128 132 C124 138, 114 142, 100 142 Z"
                    fill="#EF4444"
                  />

                  {/* Finger Separation Curves */}
                  <path d="M112 82 C122 82, 134 82, 138 88" stroke="#18181B" strokeWidth="2" strokeLinecap="round" />
                  <path d="M114 98 C124 98, 136 98, 140 102" stroke="#18181B" strokeWidth="2" strokeLinecap="round" />
                  <path d="M110 114 C120 114, 130 114, 134 118" stroke="#18181B" strokeWidth="2" strokeLinecap="round" />
                  <path d="M106 130 C116 130, 124 130, 128 134" stroke="#18181B" strokeWidth="2" strokeLinecap="round" />

                  {/* White Gloss Highlights */}
                  <path d="M104 55 C102 62, 104 72, 108 80" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="120" cy="85" r="2.5" fill="#FFFFFF" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("description")} />
        <h1 className="tracking-tight text-[#1F1F1F]">Regulations</h1>
      </div>

      {/* Top Description Paragraph */}
      <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-1 max-w-lg">
        Local tourism regulations require short-term rental hosts to display a valid municipal permit number.
      </p>

      {/* Registration Status Block */}
      <div className="space-y-1.5 pt-2">
        <h3 className="text-xs font-semibold text-[#1F1F1F]">Your registration is complete</h3>
        <p className="text-xs text-zinc-500 font-normal leading-relaxed max-w-lg">
          You&apos;re all set! Your registration number is xxxxxxxx and is visible to guests on your listing.
        </p>
      </div>

      {/* Action Button: View */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDD017] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
}

/* ================================================================= */
/* TAXES INNER COMPONENT                                             */
/* ================================================================= */
function TaxesView({
  setActiveSection,
  isSaving,
  handleSaveSection,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [isSaved, setIsSaved] = React.useState(false);

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("description")} />
        <h1 className="tracking-tight text-[#1F1F1F]">Taxes</h1>
      </div>

      <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-1">
        Learn how local occupancy taxes and value-added tax (VAT) apply to your host earnings and how Homyz helps collect and remit taxes on eligible bookings.
      </p>

      <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 space-y-3 shadow-2xs">
        <h3 className="text-xs font-semibold text-[#1F1F1F]">Occupancy Tax Collection</h3>
        <p className="text-xs text-zinc-500 font-normal leading-relaxed">
          Depending on your jurisdiction, occupancy tax may automatically be included at checkout for guest reservations.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            handleSaveSection("taxes");
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
          }}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("description")}
          className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ================================================================= */
/* HOMYZ STAYS INNER COMPONENT                                       */
/* ================================================================= */
function HomyzStaysView({
  setActiveSection,
  isSaving,
  handleSaveSection,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [isSaved, setIsSaved] = React.useState(false);

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("description")} />
        <h1 className="tracking-tight text-[#1F1F1F]">Homyz.com stays</h1>
      </div>

      <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-1">
        Learn how host contributions and community hosting initiatives help support local stays, emergency relief housing, and community experiences.
      </p>

      <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 space-y-3 shadow-2xs">
        <h3 className="text-xs font-semibold text-[#1F1F1F]">Community Housing Network</h3>
        <p className="text-xs text-zinc-500 font-normal leading-relaxed">
          Opt in to share emergency housing or offer discounted stays for non-profit and community partners.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            handleSaveSection("homyz-stays");
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
          }}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("description")}
          className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
