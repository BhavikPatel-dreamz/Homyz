"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy editor callback surface; narrowed incrementally outside E4. */

import { BackButton } from "@/components/ui/back-button";

import React from "react";
import { GuidebooksManager } from "./GuidebooksManager";
import { LocalLawsView } from "./LocalLawsView";
import { TaxesManager } from "./TaxesManager";
import { AirbnbOrgStaysView } from "./AirbnbOrgStaysView";

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
    <div className="flex shrink-0 items-center gap-1.5" aria-label={label}>
      <button
        type="button"
        aria-label={`Do not allow ${label}`}
        aria-pressed={value === false}
        onClick={() => onChange(false)}
        className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm transition-colors ${value === false ? "border-amber-300 bg-[#FEE08B] text-zinc-950" : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"}`}
      >
        ✕
      </button>
      <button
        type="button"
        aria-label={`Allow ${label}`}
        aria-pressed={value === true}
        onClick={() => onChange(true)}
        className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm transition-colors ${value === true ? "border-amber-300 bg-[#FEE08B] text-zinc-950" : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"}`}
      >
        ✓
      </button>
    </div>
  );
}

interface HouseRulesAndArrivalViewsProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  isSaving: boolean;
  handleSaveSection: (sectionKey: any) => void;

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
  smokingLocation = "OUTSIDE_ONLY",
  setSmokingLocation,
  additionalHouseRules = "",
  setAdditionalHouseRules,
  setIsEditingAdditionalRulesModalOpen: _setIsEditingAdditionalRulesModalOpen,
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
}: HouseRulesAndArrivalViewsProps) {
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
              <h1>House rules</h1>
            </div>
            <p className="text-xs text-zinc-500 font-normal pl-11">
              Set clear expectations for your guests regarding pets, smoking, events, quiet hours, and property rules.
            </p>
          </div>

          {/* List of Rules Rows */}
          <div className="divide-y divide-zinc-200/80 pt-2">
            {/* Row 1: Pets allowed */}
            <div className="py-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#1F1F1F] block">Pets allowed</span>
                  <span className="text-[11px] text-zinc-400">Do you welcome pets in your space?</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPetsAllowed(false)}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                      petsAllowed === false
                        ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                        : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => setPetsAllowed(true)}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                      petsAllowed === true
                        ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                        : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    ✓
                  </button>
                </div>
              </div>

              {/* Conditional Pet Details */}
              {petsAllowed === true && (
                <div className="rounded-2xl bg-zinc-50/80 border border-zinc-200/80 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-800">Maximum number of pets</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMaxPetsCount?.(Math.max(1, (maxPetsCount || 1) - 1))}
                        className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-semibold text-[#1F1F1F] min-w-[16px] text-center">{maxPetsCount || 1}</span>
                      <button
                        type="button"
                        onClick={() => setMaxPetsCount?.(Math.min(10, (maxPetsCount || 1) + 1))}
                        className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs"
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
                      <span className="text-zinc-700">Dogs allowed</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={catsAllowed ?? true}
                        onChange={(e) => setCatsAllowed?.(e.target.checked)}
                        className="rounded text-amber-500 accent-zinc-900"
                      />
                      <span className="text-zinc-700">Cats allowed</span>
                    </label>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="block text-[11px] font-semibold text-zinc-700">Pet fee per stay (optional, SAR)</label>
                    <input
                      type="number"
                      value=""
                      disabled
                      aria-describedby="pet-fee-unavailable"
                      placeholder="Unavailable"
                      min={0}
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs text-zinc-500 outline-none shadow-2xs cursor-not-allowed"
                    />
                    <p id="pet-fee-unavailable" className="text-[11px] text-zinc-500">Pet fees are unavailable until guests can declare pets during booking.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-zinc-700">Pet restrictions or guidelines</label>
                    <input
                      type="text"
                      value={petRestrictions}
                      onChange={(e) => setPetRestrictions?.(e.target.value)}
                      placeholder="e.g. Under 20kg only, house-trained, please bring own bed"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 outline-none focus:border-zinc-900 shadow-2xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Events allowed */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-[#1F1F1F] block">Events & parties allowed</span>
                <span className="text-[11px] text-zinc-400">Can guests host gatherings or parties?</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEventsAllowed(false)}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                    eventsAllowed === false
                      ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                      : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => setEventsAllowed(true)}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                    eventsAllowed === true
                      ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                      : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Row 3: Smoking, vaping allowed */}
            <div className="py-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#1F1F1F] block">Smoking, vaping, e-cigarettes</span>
                  <span className="text-[11px] text-zinc-400">Is smoking permitted anywhere on premises?</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSmokingAllowed(false)}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                      smokingAllowed === false
                        ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                        : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmokingAllowed(true)}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                      smokingAllowed === true
                        ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                        : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    ✓
                  </button>
                </div>
              </div>

              {/* Conditional Smoking Location */}
              {smokingAllowed === true && (
                <div className="rounded-2xl bg-zinc-50/80 border border-zinc-200/80 p-4 space-y-2 text-xs">
                  <label className="block text-[11px] font-semibold text-zinc-800">Allowed smoking location</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: "OUTSIDE_ONLY", label: "Outside only (balcony / patio)" },
                      { val: "DESIGNATED_AREA", label: "Designated area only" },
                      { val: "INSIDE", label: "Inside permitted" },
                    ].map((loc) => (
                      <button
                        key={loc.val}
                        type="button"
                        onClick={() => setSmokingLocation?.(loc.val)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          smokingLocation === loc.val
                            ? "bg-[#FEE08B] border border-amber-300 text-zinc-950 shadow-2xs"
                            : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Row 4: Quiet hours */}
            <div className="py-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#1F1F1F] block">Quiet hours</span>
                  <span className="text-[11px] text-zinc-400">Enforce quiet hours during night times</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuietHours(false)}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                      quietHours === false
                        ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                        : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuietHours(true)}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                      quietHours === true
                        ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                        : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    ✓
                  </button>
                </div>
              </div>

              {/* Conditional Quiet Hours Schedule */}
              {quietHours === true && (
                <div className="rounded-2xl bg-zinc-50/80 border border-zinc-200/80 p-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-zinc-700">Quiet hours start</label>
                    <select
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart?.(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900 shadow-2xs cursor-pointer"
                    >
                      {["20:00", "21:00", "22:00", "23:00", "00:00"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-zinc-700">Quiet hours end</label>
                    <select
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd?.(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900 shadow-2xs cursor-pointer"
                    >
                      {["06:00", "07:00", "08:00", "09:00", "10:00"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Row 5: Commercial photography and filming */}
            <div className="flex items-center justify-between gap-5 py-3.5">
              <div>
                <span className="block text-xs font-semibold text-[#1F1F1F]">Commercial photography and filming allowed</span>
                <span className="text-[11px] text-zinc-400">Can guests use the space for commercial photo or film shoots?</span>
              </div>
              <AllowDenyButtons
                label="commercial photography and filming"
                value={commercialFilmingAllowed}
                onChange={setCommercialFilmingAllowed}
              />
            </div>

            {/* Row 6: Guest limit */}
            <div className="flex items-center justify-between gap-5 py-3.5">
              <div>
                <span className="block text-xs font-semibold text-[#1F1F1F]">Number of guests</span>
                <span className="text-[11px] text-zinc-400">Maximum guests allowed to stay at your place</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease maximum guests"
                  onClick={() => setMaxGuestsCount(Math.max(1, maxGuestsCount - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  −
                </button>
                <span className="min-w-3 text-center text-xs font-semibold text-[#1F1F1F]">{maxGuestsCount}</span>
                <button
                  type="button"
                  aria-label="Increase maximum guests"
                  onClick={() => setMaxGuestsCount(Math.min(100, maxGuestsCount + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Row 7: Arrival times */}
            <button
              type="button"
              onClick={() => setActiveSection("check-in-out")}
              className="flex w-full items-center justify-between gap-5 py-3.5 text-left transition-colors hover:text-zinc-600"
            >
              <span>
                <span className="block text-xs font-semibold text-[#1F1F1F]">Check-in and check-out times</span>
                <span className="text-[11px] text-zinc-400">Set the arrival window and guest departure time.</span>
              </span>
              <span aria-hidden="true" className="text-xl leading-none text-zinc-700">›</span>
            </button>

            {/* Row 8: Additional rules */}
            <div className="py-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">Additional house rules</h4>
                  <p className="text-[11px] text-zinc-400">Specify any custom rules or property considerations</p>
                </div>
              </div>
              <textarea
                rows={4}
                value={additionalHouseRules}
                onChange={(e) => setAdditionalHouseRules?.(e.target.value)}
                placeholder="e.g. Please remove shoes at the entrance. No outdoor footwear inside. Do not leave food outdoors."
                className="w-full rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs text-zinc-800 outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("house-rules")}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
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
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
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
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
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
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
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

      {(activeSection === "airbnb-org-stays" ||
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
/* CHECK-OUT INSTRUCTIONS INNER COMPONENT (Matches Figma 100%)       */
/* ================================================================= */
function CheckOutInstructionsView({
  setActiveSection,
  isSaving: _isSaving,
  handleSaveSection,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [text, setText] = React.useState(
    "Guests will see these instructions 24 hours before check-out time. Clearly detail garbage disposal, lockup procedures, and key returns."
  );

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <h1 className="tracking-tight text-[#1F1F1F]">Check-out instructions</h1>
      </div>

      {/* Description text matching screenshot 100% */}
      <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-1">
        {text}
      </p>

      {isAdding && (
        <div className="pt-2 space-y-3 animate-in fade-in">
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add specific check-out instructions for your guests..."
            className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
          />
        </div>
      )}

      {/* Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            if (isAdding) {
              handleSaveSection("arrival-guide");
              setIsAdding(false);
            } else {
              setIsAdding(true);
            }
          }}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-5 py-2.5 shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
        >
          <span className="text-sm font-semibold">+</span>
          {isAdding ? "Save instructions" : "Add instructions"}
        </button>
      </div>
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
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [selectedOption, setSelectedOption] = React.useState<number>(0);
  const [isSaved, setIsSaved] = React.useState(false);

  const options = [
    "I won't be available in person, and prefer communicating through the app.",
    "I like to say hello in person, but keep to myself otherwise",
    "I like socializing and spending time with the guests",
    "No preferences",
  ];

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <h1 className="tracking-tight text-[#1F1F1F]">Interaction with guests</h1>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-1">
        Let guests know how much interaction you will have during their stay, from in-person greetings to full self check-in privacy.
      </p>

      {/* Options List with Toggle Switches */}
      <div className="space-y-3 pt-2">
        {options.map((option, index) => {
          const isActive = selectedOption === index;
          return (
            <div
              key={option}
              onClick={() => setSelectedOption(index)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-xs font-semibold shadow-2xs ${
                isActive
                  ? "bg-[#FEF9EC] border-amber-300 text-zinc-950"
                  : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300"
              }`}
            >
              <span>{option}</span>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                  isActive ? "border-amber-400 bg-amber-400 text-white" : "border-zinc-300 bg-white"
                }`}
              >
                {isActive && <span className="text-[10px] leading-none">✓</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons: Save & Cancel */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            handleSaveSection("interaction-preferences");
            setIsSaved(true);
          }}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDD017] text-zinc-950 font-semibold text-xs px-6 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? "Saving..." : isSaved ? "Saved" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("description")}
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
          <h3 className="font-semibold text-xs text-[#1F1F1F]">Listed</h3>
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
          <h3 className="font-semibold text-xs text-[#1F1F1F]">Unlisted</h3>
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
  isSaving: _isSaving,
  handleSaveSection,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [selectedLanguages, setSelectedLanguages] = React.useState<string[]>(["English"]);
  const [isAdding, setIsAdding] = React.useState(false);
  const [searchLang, setSearchLang] = React.useState("");

  const availableLanguages = [
    "Arabic",
    "English",
    "French",
    "German",
    "Spanish",
    "Italian",
    "Chinese",
    "Japanese",
    "Russian",
    "Portuguese",
    "Turkish",
    "Hindi",
  ];

  const filteredLanguages = availableLanguages.filter((l) =>
    l.toLowerCase().includes(searchLang.toLowerCase())
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
        {selectedLanguages.map((lang) => (
          <div
            key={lang}
            className="inline-flex items-center gap-2 bg-zinc-100 border border-zinc-250 text-[#1F1F1F] text-xs font-semibold px-4 py-2 rounded-full shadow-2xs"
          >
            <span>{lang}</span>
            {selectedLanguages.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSelectedLanguages(selectedLanguages.filter((l) => l !== lang))
                }
                className="text-zinc-400 hover:text-zinc-700 font-semibold"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add a language Modal / Expandable selector */}
      {isAdding && (
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white space-y-4 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#1F1F1F]">Select a language</h3>
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

          <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
            {filteredLanguages.map((lang) => {
              const isSelected = selectedLanguages.includes(lang);
              return (
                <div
                  key={lang}
                  onClick={() => {
                    if (isSelected) {
                      if (selectedLanguages.length > 1) {
                        setSelectedLanguages(selectedLanguages.filter((l) => l !== lang));
                      }
                    } else {
                      setSelectedLanguages([...selectedLanguages, lang]);
                    }
                  }}
                  className={`p-3 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${
                    isSelected ? "bg-[#FEF9EC] text-zinc-950 border border-amber-300" : "hover:bg-zinc-50 text-zinc-700"
                  }`}
                >
                  <span>{lang}</span>
                  {isSelected && <span>✓</span>}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => {
                handleSaveSection("language");
                setIsAdding(false);
              }}
              className="px-5 py-2 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-xs font-semibold text-zinc-950 shadow-2xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Button matching Figma 100%: + Add a language */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-5 py-2.5 shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
        >
          <span className="text-sm font-semibold">+</span>
          Add a language
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
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [requireProfilePhoto, setRequireProfilePhoto] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);

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
          onClick={() => setRequireProfilePhoto(!requireProfilePhoto)}
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
          onClick={() => {
            handleSaveSection("guest-requirements");
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

  const timesList = [
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
    "6:00 PM",
    "7:00 PM",
    "8:00 PM",
    "9:00 PM",
    "10:00 PM",
    "11:00 PM",
    "Flexible",
  ];

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("check-in-out")} />
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
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================= */
/* CHECK-IN METHOD INNER COMPONENT (Matches Figma Screenshot 100%)    */
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
  const [isEditingMethod, setIsEditingMethod] = React.useState(false);

  const isCodeBased = ["Smart lock", "Keypad", "SMART_LOCK", "KEYPAD"].includes(checkInMethod);
  const isLockbox = ["Lockbox", "LOCKBOX"].includes(checkInMethod);

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("check-in-out")} />
        <h1>Check-in method</h1>
      </div>

      {/* Card 1: Selected Method Card */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#1F1F1F]">
            {checkInMethod === "SMART_LOCK" || checkInMethod === "Smart lock" ? "Smart lock" : checkInMethod || "Smart lock"}
          </span>
          <button
            type="button"
            onClick={() => setIsEditingMethod((v) => !v)}
            className="rounded-full bg-zinc-100/90 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-1 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        </div>

        {isEditingMethod && (
          <div className="pt-3 border-t border-zinc-100 space-y-2 animate-in fade-in">
            {["Smart lock", "Keypad", "Lockbox", "Building staff", "Host greets in person"].map((method) => (
              <div
                key={method}
                onClick={() => {
                  setCheckInMethod(method);
                  setIsEditingMethod(false);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs font-semibold ${
                  checkInMethod === method
                    ? "bg-[#FEF9EC] border-amber-300 text-zinc-950"
                    : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-700"
                }`}
              >
                <span>{method}</span>
                {checkInMethod === method && <span>✓</span>}
              </div>
            ))}
          </div>
        )}

        {/* Access Code Input */}
        {isCodeBased && (
          <div className="pt-2 border-t border-zinc-100 space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-800">
              Keypad / Door code (Confidential)
            </label>
            <p className="text-[11px] text-zinc-400">This code is only shared with confirmed booked guests.</p>
            <input
              type="text"
              value={doorCode || ""}
              onChange={(e) => setDoorCode?.(e.target.value)}
              placeholder="e.g. 1234#"
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
            />
          </div>
        )}

        {isLockbox && (
          <div className="pt-2 border-t border-zinc-100 space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-800">
              Lockbox combination code (Confidential)
            </label>
            <p className="text-[11px] text-zinc-400">This code is only shared with confirmed booked guests.</p>
            <input
              type="text"
              value={lockboxCode || ""}
              onChange={(e) => setLockboxCode?.(e.target.value)}
              placeholder="e.g. 8842"
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
            />
          </div>
        )}
      </div>

      {/* Section 2: Check-in instructions */}
      <div className="pt-2 space-y-2">
        <h2 className="text-sm font-semibold text-[#1F1F1F]">Check-in instructions for guests</h2>
        <p className="text-xs text-zinc-500 font-normal leading-relaxed max-w-lg">
          Share detailed steps for guests to unlock doors, locate keys, access the building, and check in smoothly.
        </p>

        <div className="pt-1">
          <textarea
            rows={4}
            value={checkInInstructions || ""}
            onChange={(e) => setCheckInInstructions?.(e.target.value)}
            placeholder="e.g. Take the elevator to the 3rd floor. The lockbox is on the door handle. Enter code 8842 and turn the knob clockwise."
            className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-[#1F1F1F] outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
          />
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveSection("check-in-method")}
            className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
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
