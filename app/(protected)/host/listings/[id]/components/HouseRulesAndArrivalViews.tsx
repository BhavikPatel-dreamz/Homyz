"use client";

import React from "react";

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
  quietHours: boolean | null;
  setQuietHours: (val: any) => void;
  eventsAllowed: boolean | null;
  setEventsAllowed: (val: any) => void;
  smokingAllowed: boolean | null;
  setSmokingAllowed: (val: any) => void;

  // Modals trigger
  setIsEditingAdditionalRulesModalOpen: (open: boolean) => void;

  // Arrival Guide
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
}

export function HouseRulesAndArrivalViews({
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
  quietHours,
  setQuietHours,
  eventsAllowed,
  setEventsAllowed,
  smokingAllowed,
  setSmokingAllowed,
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
}: HouseRulesAndArrivalViewsProps) {
  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* VIEW 8: HOUSE RULES */}
      {/* --------------------------------------------------------- */}
      {/* --------------------------------------------------------- */}
      {/* VIEW: HOUSE RULES (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      {activeSection === "house-rules" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Header & Subtitle */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("description")}
                className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
              >
                ‹
              </button>
              <h1>House rules</h1>
            </div>
            <p className="text-xs text-zinc-500 font-normal pl-11">
              Lorem ipsum parturient lacus faucibus morbi porta ultrices senectus augue.
            </p>
          </div>

          {/* List of Rules Rows */}
          <div className="divide-y divide-zinc-200/80 pt-2">
            {/* Row 1: Pets allowed */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="font-bold text-xs text-zinc-900">Pets allowed</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPetsAllowed(false)}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
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
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    petsAllowed === true
                      ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                      : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Row 2: Maximum number of pets allowed */}
            <div className="py-3.5 flex items-start justify-between gap-4">
              <div className="space-y-1 max-w-sm">
                <h4 className="font-bold text-xs text-zinc-900">Maximum number of pets allowed</h4>
                <p className="text-[11px] text-zinc-400 font-normal leading-relaxed">
                  Lorem ipsum mauris id ut at ac tristique est semper pharetra gravida egestas elementum turpis amet eget eu tincidunt{" "}
                  <a href="#" onClick={(e) => e.preventDefault()} className="underline font-semibold text-zinc-900">
                    learn more
                  </a>
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setPetsAllowed(false)}
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => setPetsAllowed(true)}
                  className="w-7 h-7 rounded-full border border-amber-300 bg-[#FEE08B] flex items-center justify-center text-xs font-bold text-zinc-950 cursor-pointer shadow-2xs"
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Row 3: Maximum number of pets */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="font-bold text-xs text-zinc-900">Maximum number of pets</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {}}
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  -
                </button>
                <span className="text-xs font-bold text-zinc-900 min-w-[12px] text-center">1</span>
                <button
                  type="button"
                  onClick={() => {}}
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Row 4: Events allowed */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="font-bold text-xs text-zinc-900">Events allowed</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEventsAllowed(false)}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
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
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    eventsAllowed !== false
                      ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                      : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Row 5: Smoking, vaping, e-cigarettes allowed */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="font-bold text-xs text-zinc-900">Smoking, vaping, e-cigarettes allowed</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSmokingAllowed(false)}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
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
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    smokingAllowed !== false
                      ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                      : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Row 6: Quiet hours */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="font-bold text-xs text-zinc-900">Quiet hours</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuietHours(true)}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    quietHours !== false
                      ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                      : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => setQuietHours(false)}
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    quietHours === false
                      ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                      : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Row 7: Commercial photography and filming allowed */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="font-bold text-xs text-zinc-900">Commercial photography and filming allowed</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="w-7 h-7 rounded-full border border-amber-300 bg-[#FEE08B] flex items-center justify-center text-xs font-bold text-zinc-950 cursor-pointer shadow-2xs"
                >
                  ✕
                </button>
                <button
                  type="button"
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Row 8: Number of quest */}
            <div className="py-3.5 flex items-center justify-between">
              <span className="font-bold text-xs text-zinc-900">Number of quest</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMaxGuestsCount(Math.max(1, (maxGuestsCount || 1) - 1))}
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  -
                </button>
                <span className="text-xs font-bold text-zinc-900 min-w-[12px] text-center">{maxGuestsCount || 1}</span>
                <button
                  type="button"
                  onClick={() => setMaxGuestsCount((maxGuestsCount || 1) + 1)}
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Row 9: Check-in and check-out times */}
            <div className="py-3.5 flex items-start justify-between gap-4">
              <div className="space-y-1 max-w-sm">
                <h4 className="font-bold text-xs text-zinc-900">Check-in and check-out times</h4>
                <p className="text-[11px] text-zinc-400 font-normal leading-relaxed">
                  Lorem ipsum mauris id ut at ac tristique est semper pharetra gravida egestas elementum turpis amet eget eu tincidunt{" "}
                  <a href="#" onClick={(e) => e.preventDefault()} className="underline font-semibold text-zinc-900">
                    learn more
                  </a>
                </p>
              </div>
              <button
                type="button"
                className="w-6 h-6 rounded-full hover:bg-zinc-200/80 flex items-center justify-center text-zinc-700 text-sm font-bold transition-all cursor-pointer shrink-0 pt-0.5"
              >
                ›
              </button>
            </div>

            {/* Row 10: Additional rules */}
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs text-zinc-900">Additional rules</h4>
                <p className="text-[11px] text-zinc-400 font-normal">Share anything else you expect from guests.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingAdditionalRulesModalOpen(true)}
                className="w-6 h-6 rounded-full hover:bg-zinc-200/80 flex items-center justify-center text-zinc-700 text-sm font-bold transition-all cursor-pointer shrink-0"
              >
                ›
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("house-rules")}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-extrabold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
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
            <button
              type="button"
              onClick={() => setActiveSection("check-in-out")}
              className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
            >
              ‹
            </button>
            <h1>Wifi details</h1>
          </div>

          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-900">Wifi network name</label>
              <input
                type="text"
                value={wifiNetwork}
                onChange={(e) => setWifiNetwork(e.target.value)}
                placeholder="wifi network name"
                className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-900">Wifi password</label>
              <input
                type="text"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="wifi password"
                className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("arrival-guide")}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
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
            <button
              type="button"
              onClick={() => setActiveSection("check-in-out")}
              className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
            >
              ‹
            </button>
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
              className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("arrival-guide")}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
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
  isSaving,
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
        <button
          type="button"
          onClick={() => setActiveSection("check-in-out")}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
        >
          ‹
        </button>
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
              <span className="text-sm font-bold text-zinc-900 block">{checkInStart || "3:00 PM"}</span>
            </div>
            <span className="text-zinc-600 text-base font-bold">›</span>
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
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-bold text-zinc-900 bg-white outline-none cursor-pointer"
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
              <span className="text-sm font-bold text-zinc-900 block">{checkInEnd || "Flexible"}</span>
            </div>
            <span className="text-zinc-600 text-base font-bold">›</span>
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
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-bold text-zinc-900 bg-white outline-none cursor-pointer"
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
              <span className="text-sm font-bold text-zinc-900 block">{checkOutTime || "12:00 PM"}</span>
            </div>
            <span className="text-zinc-600 text-base font-bold">›</span>
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
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-bold text-zinc-900 bg-white outline-none cursor-pointer"
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
        <button
          type="button"
          onClick={() => setActiveSection("check-in-out")}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
        >
          ‹
        </button>
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
          className="w-full rounded-2xl border border-zinc-200/90 bg-white p-4 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
        />
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => handleSaveSection("directions")}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
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
  setActiveSection,
  isSaving,
  handleSaveSection,
}: {
  checkInMethod: string;
  setCheckInMethod: (val: string) => void;
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [isEditingMethod, setIsEditingMethod] = React.useState(false);
  const [isAddingInstructions, setIsAddingInstructions] = React.useState(false);
  const [instructionsText, setInstructionsText] = React.useState(
    "Lorem ipsum sed elit euismod pretium pellentesque in eget velit nunc vitae quisque semper accumsan suspendisse."
  );

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveSection("check-in-out")}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
        >
          ‹
        </button>
        <h1>Check-in method</h1>
      </div>

      {/* Card 1: Selected Method Card (Matches Figma Screenshot 100%) */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-900">
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
                  handleSaveSection("arrival-guide");
                  setIsEditingMethod(false);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs font-bold ${
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

        <div className="border-t border-zinc-150/80 my-2" />

        <div className="flex items-center justify-between cursor-pointer pt-1">
          <span className="text-xs text-zinc-500 font-medium">Will be send it before the check-in</span>
          <span className="text-zinc-600 text-base font-bold">›</span>
        </div>
      </div>

      {/* Section 2: Check-in instructions (Matches Figma Screenshot 100%) */}
      <div className="pt-4 space-y-2">
        <h2 className="text-sm font-bold text-zinc-900">Check-in instructions</h2>
        <p className="text-xs text-zinc-500 font-normal leading-relaxed max-w-lg">
          {instructionsText}
        </p>

        {isAddingInstructions && (
          <div className="pt-2 space-y-3 animate-in fade-in">
            <textarea
              rows={4}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
            />
          </div>
        )}

        <div className="pt-3">
          <button
            type="button"
            onClick={() => {
              if (isAddingInstructions) {
                handleSaveSection("arrival-guide");
                setIsAddingInstructions(false);
              } else {
                setIsAddingInstructions(true);
              }
            }}
            className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-extrabold text-xs px-5 py-2.5 shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="text-sm font-bold">+</span>
            {isAddingInstructions ? "Save instructions" : "Add instructions"}
          </button>
        </div>
      </div>
    </div>
  );
}
