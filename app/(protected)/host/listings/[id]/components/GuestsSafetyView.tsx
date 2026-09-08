"use client";

import { BackButton } from "@/components/ui/back-button";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React from "react";

interface GuestsSafetyViewProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  setEditorTab?: (tab: "space" | "arrival") => void;
  isSaving?: boolean;
  handleSaveSection?: (sectionKey: any) => void;
  safetyConsiderations: string[];
  setSafetyConsiderations: (items: string[]) => void;
  smokeAlarm: boolean;
  setSmokeAlarm: (val: boolean) => void;
  carbonMonoxideAlarm: boolean;
  setCarbonMonoxideAlarm: (val: boolean) => void;
  firstAidKit?: boolean;
  setFirstAidKit?: (val: boolean) => void;
  fireExtinguisher?: boolean;
  setFireExtinguisher?: (val: boolean) => void;
  propertyInfoDetails: string[];
  setPropertyInfoDetails: (items: string[]) => void;
  isSafetyConsiderationsModalOpen?: boolean;
  setIsSafetyConsiderationsModalOpen?: (open: boolean) => void;
  isSafetyDevicesModalOpen?: boolean;
  setIsSafetyDevicesModalOpen?: (open: boolean) => void;
  isPropertyInfoModalOpen?: boolean;
  setIsPropertyInfoModalOpen?: (open: boolean) => void;
}

export function GuestsSafetyView({
  activeSection,
  setEditorTab,
  setActiveSection,
  handleSaveSection,
  safetyConsiderations,
  setSafetyConsiderations,
  smokeAlarm,
  setSmokeAlarm,
  carbonMonoxideAlarm,
  setCarbonMonoxideAlarm,
  firstAidKit,
  setFirstAidKit,
  fireExtinguisher,
  setFireExtinguisher,
  propertyInfoDetails,
  setPropertyInfoDetails,
  isSafetyConsiderationsModalOpen,
  setIsSafetyConsiderationsModalOpen,
  isSafetyDevicesModalOpen,
  setIsSafetyDevicesModalOpen,
  isPropertyInfoModalOpen,
  setIsPropertyInfoModalOpen,
}: GuestsSafetyViewProps) {
  if (activeSection !== "guests-safety") return null;

  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* VIEW 14: GUESTS SAFETY (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      <div className="space-y-6 animate-in fade-in max-w-xl pb-10">
        {/* Header with Back Button */}
        <div className="space-y-1 border-b border-zinc-150 pb-4">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => {
                setEditorTab?.("space");
                setActiveSection("description");
              }} />
            <h1>Guests safety</h1>
          </div>
          <p className="text-xs text-zinc-400 font-normal pl-11">
            Lorem ipsum parturient lacus faucibus morbi porta ultrices senectus augue.
          </p>
        </div>

        {/* Guests Safety Options List (Matching Screenshot 100%) */}
        <div className="space-y-5 divide-y divide-zinc-200/70">
          {/* 1. Safety considerations */}
          <div
            onClick={() => setIsSafetyConsiderationsModalOpen?.(true)}
            className="flex items-center justify-between pt-3 cursor-pointer group"
          >
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-[#1F1F1F] group-hover:text-amber-600 transition-colors">
                Safety considerations
              </h4>
              <p className="text-[11px] text-zinc-400 font-normal">
                {safetyConsiderations.length > 0
                  ? `${safetyConsiderations.length} reported`
                  : "Add details"}
              </p>
            </div>
            <span className="text-zinc-400 group-hover:text-zinc-700 text-sm font-semibold">›</span>
          </div>

          {/* 2. Safety devices */}
          <div
            onClick={() => setIsSafetyDevicesModalOpen?.(true)}
            className="flex items-center justify-between pt-5 cursor-pointer group"
          >
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-[#1F1F1F] group-hover:text-amber-600 transition-colors">
                Safety devices
              </h4>
              <p className="text-[11px] text-zinc-400 font-normal">
                {smokeAlarm || carbonMonoxideAlarm
                  ? `${smokeAlarm ? "Smoke alarm" : ""}${
                      smokeAlarm && carbonMonoxideAlarm ? ", " : ""
                    }${carbonMonoxideAlarm ? "CO alarm" : ""}`
                  : "Add details"}
              </p>
            </div>
            <span className="text-zinc-400 group-hover:text-zinc-700 text-sm font-semibold">›</span>
          </div>

          {/* 3. Property info */}
          <div
            onClick={() => setIsPropertyInfoModalOpen?.(true)}
            className="flex items-center justify-between pt-5 cursor-pointer group"
          >
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-[#1F1F1F] group-hover:text-amber-600 transition-colors">
                Property info
              </h4>
              <p className="text-[11px] text-zinc-400 font-normal">
                {propertyInfoDetails.length > 0
                  ? `${propertyInfoDetails.length} items added`
                  : "Add details"}
              </p>
            </div>
            <span className="text-zinc-400 group-hover:text-zinc-700 text-sm font-semibold">›</span>
          </div>
        </div>
      </div>

      {/* MODAL 1: SAFETY CONSIDERATIONS */}
      {isSafetyConsiderationsModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsSafetyConsiderationsModalOpen?.(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Safety considerations</h3>
              <p className="text-xs text-zinc-500 font-normal">
                Select any specific considerations guests should know about.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                "Not suitable for children (2-12 years)",
                "Not suitable for infants (under 2 years)",
                "Nearby lake, river, or body of water",
                "Climbing or play structure on property",
                "Heights without rails or protection",
                "Presence of dangerous animals",
              ].map((item) => (
                <label
                  key={item}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={safetyConsiderations.includes(item)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSafetyConsiderations([...safetyConsiderations, item]);
                      } else {
                        setSafetyConsiderations(
                          safetyConsiderations.filter((i) => i !== item)
                        );
                      }
                    }}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-zinc-900"
                  />
                  <span className="text-xs font-semibold text-zinc-800">{item}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSafetyConsiderationsModalOpen?.(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSafetyConsiderationsModalOpen?.(false);
                  handleSaveSection?.("guests-safety");
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* MODAL 2: SAFETY DEVICES */}
      {isSafetyDevicesModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsSafetyDevicesModalOpen?.(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Safety devices</h3>
              <p className="text-xs text-zinc-500 font-normal">
                Manage installed safety devices at your space.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 bg-white">
                <span className="text-xs font-semibold text-[#1F1F1F]">Smoke alarm installed</span>
                <button
                  type="button"
                  onClick={() => setSmokeAlarm(!smokeAlarm)}
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center shrink-0 cursor-pointer ${
                    smokeAlarm ? "bg-zinc-900 justify-end" : "bg-zinc-300 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 bg-white">
                <span className="text-xs font-semibold text-[#1F1F1F]">Carbon monoxide alarm installed</span>
                <button
                  type="button"
                  onClick={() => setCarbonMonoxideAlarm(!carbonMonoxideAlarm)}
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center shrink-0 cursor-pointer ${
                    carbonMonoxideAlarm ? "bg-zinc-900 justify-end" : "bg-zinc-300 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 bg-white">
                <span className="text-xs font-semibold text-[#1F1F1F]">First aid kit available</span>
                <button
                  type="button"
                  onClick={() => setFirstAidKit?.(!firstAidKit)}
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center shrink-0 cursor-pointer ${
                    firstAidKit ? "bg-[#FEE08B] justify-end" : "bg-zinc-300 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-zinc-900 shadow-2xs" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 bg-white">
                <span className="text-xs font-semibold text-[#1F1F1F]">Fire extinguisher available</span>
                <button
                  type="button"
                  onClick={() => setFireExtinguisher?.(!fireExtinguisher)}
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center shrink-0 cursor-pointer ${
                    fireExtinguisher ? "bg-[#FEE08B] justify-end" : "bg-zinc-300 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-zinc-900 shadow-2xs" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSafetyDevicesModalOpen?.(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSafetyDevicesModalOpen?.(false);
                  handleSaveSection?.("guests-safety");
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* MODAL 3: PROPERTY INFO */}
      {isPropertyInfoModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsPropertyInfoModalOpen?.(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Property info</h3>
              <p className="text-xs text-zinc-500 font-normal">
                Select any specific characteristics about your space.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                "Must climb stairs",
                "Potential for noise",
                "Pets live on property",
                "Shared spaces on property",
                "Parking limitations",
              ].map((item) => (
                <label
                  key={item}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={propertyInfoDetails.includes(item)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPropertyInfoDetails([...propertyInfoDetails, item]);
                      } else {
                        setPropertyInfoDetails(
                          propertyInfoDetails.filter((i) => i !== item)
                        );
                      }
                    }}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 accent-zinc-900"
                  />
                  <span className="text-xs font-semibold text-zinc-800">{item}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPropertyInfoModalOpen?.(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPropertyInfoModalOpen?.(false);
                  handleSaveSection?.("guests-safety");
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
