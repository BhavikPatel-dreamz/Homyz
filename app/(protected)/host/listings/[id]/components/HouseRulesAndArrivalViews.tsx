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
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">House rules</h1>
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
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Wifi details</h1>
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
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">House manual</h1>
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
        <GuidebooksView
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
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
    </>
  );
}

/* ================================================================= */
/* CHECK-OUT INSTRUCTIONS INNER COMPONENT (Matches Figma 100%)       */
/* ================================================================= */
function CheckOutInstructionsView({
  setActiveSection,
  isSaving,
  handleSaveSection,
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [text, setText] = React.useState(
    "Lorem ipsum sit lorem proin pulvinar vel vitae proin maecenas adipiscing pretium in orci et aenean dignissim quis nibh mi."
  );

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
        >
          ‹
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Check-out instructions</h1>
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
            className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs leading-relaxed"
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
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-extrabold text-xs px-5 py-2.5 shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
        >
          <span className="text-sm font-bold">+</span>
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
  isSaving,
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
          <button
            type="button"
            onClick={() => setActiveSection("arrival-guide")}
            className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
          >
            ‹
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Create a guidebooks</h1>
        </div>

        {/* Plus (+) Button on the right of header */}
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 text-sm font-bold transition-all cursor-pointer shadow-2xs"
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
          className="text-xs font-bold text-zinc-900 underline hover:text-zinc-700 block"
        >
          Read our content policy
        </a>
      </div>

      {isAdding && (
        <div className="p-4 rounded-2xl border border-zinc-200 bg-white space-y-3 shadow-2xs animate-in fade-in">
          <h3 className="text-xs font-bold text-zinc-900">Add New Guidebook</h3>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Favorite Neighborhood Restaurants"
            className="w-full rounded-xl border border-zinc-200 p-3 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
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
              className="px-4 py-1.5 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-xs font-bold text-zinc-950 shadow-2xs"
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
              <h4 className="text-xs font-bold text-zinc-900 line-clamp-2">{gb.title}</h4>
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
        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
        >
          ‹
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Interaction with guests</h1>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-1">
        Lorem ipsum tincidunt ultricies pellentesque amet sapien pharetra ultricies ipsum sed imperdiet volutpat est vel eget luctus imperdiet mauris amet.
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
                  ? "bg-white border-zinc-300 shadow-2xs"
                  : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-600"
              }`}
            >
              <span className={`leading-snug pr-4 ${isActive ? "text-zinc-900 font-bold" : "text-zinc-600"}`}>
                {option}
              </span>

              {/* Toggle Switch Component */}
              <div
                className={`w-10 h-5 rounded-full shrink-0 p-0.5 transition-colors duration-200 ${
                  isActive ? "bg-zinc-800" : "bg-zinc-200"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                    isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
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
            handleSaveSection("arrival-guide");
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
          }}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-extrabold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-extrabold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
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
}: {
  setActiveSection: (s: any) => void;
  isSaving: boolean;
  handleSaveSection: (key: any) => void;
}) {
  const [status, setStatus] = React.useState<"listed" | "unlisted">("listed");
  const [isSaved, setIsSaved] = React.useState(false);

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
        >
          ‹
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Listing status</h1>
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
          <h3 className="font-bold text-xs text-zinc-900">Listed</h3>
          <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
            Lorem ipsum feugiat donec porta aliquam sed blandit consectetur mauris eget augue.
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
          <h3 className="font-bold text-xs text-zinc-900">Unlisted</h3>
          <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
            Lorem ipsum feugiat donec porta aliquam sed blandit consectetur mauris eget augue.
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
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-extrabold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-extrabold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
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
        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
        >
          ‹
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Languages</h1>
      </div>

      {/* Description Text matching Figma 100% */}
      <p className="text-xs text-zinc-500 font-normal leading-relaxed pt-1">
        Lorem ipsum faucibus euismod est id diam pellentesque mus quis elementum tellus amet laoreet interdum pretium purus tempor etiam a.
      </p>

      {/* List of currently selected languages */}
      <div className="flex flex-wrap gap-2 pt-2">
        {selectedLanguages.map((lang) => (
          <div
            key={lang}
            className="inline-flex items-center gap-2 bg-zinc-100 border border-zinc-250 text-zinc-900 text-xs font-bold px-4 py-2 rounded-full shadow-2xs"
          >
            <span>{lang}</span>
            {selectedLanguages.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSelectedLanguages(selectedLanguages.filter((l) => l !== lang))
                }
                className="text-zinc-400 hover:text-zinc-700 font-bold"
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
            <h3 className="text-xs font-bold text-zinc-900">Select a language</h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-zinc-400 hover:text-zinc-600 font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <input
            type="text"
            value={searchLang}
            onChange={(e) => setSearchLang(e.target.value)}
            placeholder="Search language..."
            className="w-full rounded-xl border border-zinc-200 p-3 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
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
                  className={`p-3 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${
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
              className="px-5 py-2 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-xs font-bold text-zinc-950 shadow-2xs cursor-pointer"
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
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-extrabold text-xs px-5 py-2.5 shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
        >
          <span className="text-sm font-bold">+</span>
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
        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
        >
          ‹
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Guest requirements</h1>
      </div>

      {/* Toggle Row: Require a profile photo */}
      <div className="flex items-start justify-between gap-6 pt-1">
        <div className="space-y-1 max-w-md">
          <h3 className="text-xs font-bold text-zinc-900">Require a profile photo</h3>
          <p className="text-xs text-zinc-500 font-normal leading-relaxed">
            Lorem ipsum mauris id ut at ac tristique est semper pharetra gravida egestas elementum turpis amet eget eu tincidunt{" "}
            <a href="#" className="underline font-medium text-zinc-700 hover:text-zinc-950">
              learn more
            </a>
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
        <h3 className="text-xs font-bold text-zinc-900">
          All Homyz guests are requires to:
        </h3>
        <ul className="space-y-2 text-xs text-zinc-500 font-normal">
          <li className="flex items-start gap-2">
            <span className="text-zinc-400 font-bold">•</span>
            <span>Provide a confirmed email address and phone number</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-zinc-400 font-bold">•</span>
            <span>Provide payment information</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-zinc-400 font-bold">•</span>
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
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-extrabold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-extrabold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Check-in and check-out times</h1>
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Directions</h1>
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Check-in method</h1>
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
