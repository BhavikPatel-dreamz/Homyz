"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy editor callback surface */

import React, { useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import {
  GuestSafetyState,
  SafetyDeviceState,
  PropertyInfoState,
  SafetyConsiderationsState,
  sanitizeGuestSafetyState,
} from "./guest-safety-helpers";
import { GuestsSafetySkeleton } from "./YourSpaceSkeletons";

interface GuestsSafetyViewProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  setEditorTab?: (tab: "space" | "arrival" | "preferences") => void;
  isSaving?: boolean;
  isLoading?: boolean;
  guestSafetyState: GuestSafetyState;
  setGuestSafetyState: React.Dispatch<React.SetStateAction<GuestSafetyState>>;
  onSaveSafety: (state: GuestSafetyState) => Promise<boolean | void>;
  initialSafetyState?: GuestSafetyState;
  // Legacy props for compatibility:
  handleSaveSection?: (sectionKey: any) => void;
  safetyConsiderations?: string[];
  setSafetyConsiderations?: (items: string[]) => void;
  smokeAlarm?: boolean;
  setSmokeAlarm?: (val: boolean) => void;
  carbonMonoxideAlarm?: boolean;
  setCarbonMonoxideAlarm?: (val: boolean) => void;
  firstAidKit?: boolean;
  setFirstAidKit?: (val: boolean) => void;
  fireExtinguisher?: boolean;
  setFireExtinguisher?: (val: boolean) => void;
  propertyInfoDetails?: string[];
  setPropertyInfoDetails?: (items: string[]) => void;
  isSafetyConsiderationsModalOpen?: boolean;
  setIsSafetyConsiderationsModalOpen?: (open: boolean) => void;
  isSafetyDevicesModalOpen?: boolean;
  setIsSafetyDevicesModalOpen?: (open: boolean) => void;
  isPropertyInfoModalOpen?: boolean;
  setIsPropertyInfoModalOpen?: (open: boolean) => void;
}

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
        aria-label={`No for ${label}`}
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
        aria-label={`Yes for ${label}`}
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

export function GuestsSafetyView({
  activeSection,
  setActiveSection,
  setEditorTab,
  isSaving = false,
  isLoading = false,
  guestSafetyState,
  setGuestSafetyState,
  onSaveSafety,
}: GuestsSafetyViewProps) {
  const [isConsiderationsOpen, setIsConsiderationsOpen] = useState(false);
  const [isDevicesOpen, setIsDevicesOpen] = useState(false);
  const [isPropertyInfoOpen, setIsPropertyInfoOpen] = useState(false);

  // Local draft state for modals so cancel discards changes
  const [draftState, setDraftState] = useState<GuestSafetyState>(() =>
    sanitizeGuestSafetyState(guestSafetyState)
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [learnMoreTopic, setLearnMoreTopic] = useState<string | null>(null);

  // Keep draft state in sync when modals are closed
  React.useEffect(() => {
    if (!isConsiderationsOpen && !isDevicesOpen && !isPropertyInfoOpen) {
      setDraftState(sanitizeGuestSafetyState(guestSafetyState));
    }
  }, [guestSafetyState, isConsiderationsOpen, isDevicesOpen, isPropertyInfoOpen]);

  if (activeSection !== "guests-safety") return null;

  // Open modal handlers
  const openModal = (category: "considerations" | "devices" | "propertyInfo") => {
    setDraftState(sanitizeGuestSafetyState(guestSafetyState));
    setValidationErrors({});
    if (category === "considerations") setIsConsiderationsOpen(true);
    if (category === "devices") setIsDevicesOpen(true);
    if (category === "propertyInfo") setIsPropertyInfoOpen(true);
  };

  const closeModal = () => {
    setIsConsiderationsOpen(false);
    setIsDevicesOpen(false);
    setIsPropertyInfoOpen(false);
    setValidationErrors({});
  };

  // Draft update helpers
  const updateDevice = <K extends keyof SafetyDeviceState>(key: K, val: SafetyDeviceState[K]) => {
    setDraftState((prev) => ({
      ...prev,
      devices: { ...prev.devices, [key]: val },
    }));
  };

  const updatePropertyInfo = <K extends keyof PropertyInfoState>(key: K, val: PropertyInfoState[K]) => {
    setDraftState((prev) => ({
      ...prev,
      propertyInfo: { ...prev.propertyInfo, [key]: val },
    }));
  };

  const updateConsideration = <K extends keyof SafetyConsiderationsState>(
    key: K,
    val: SafetyConsiderationsState[K]
  ) => {
    setDraftState((prev) => ({
      ...prev,
      considerations: { ...prev.considerations, [key]: val },
    }));
  };

  // Toggle question: selecting YES enables detail, selecting NO clears detail
  const handleToggleQuestion = (
    category: "devices" | "propertyInfo" | "considerations",
    valKey: string,
    detailKey: string | null,
    nextVal: boolean
  ) => {
    if (detailKey && validationErrors[detailKey]) {
      setValidationErrors((prev) => {
        const copy = { ...prev };
        delete copy[detailKey];
        return copy;
      });
    }

    if (category === "devices") {
      updateDevice(valKey as keyof SafetyDeviceState, nextVal as any);
      if (!nextVal && detailKey) {
        updateDevice(detailKey as keyof SafetyDeviceState, "" as any);
      }
    } else if (category === "propertyInfo") {
      updatePropertyInfo(valKey as keyof PropertyInfoState, nextVal as any);
      if (!nextVal && detailKey) {
        updatePropertyInfo(detailKey as keyof PropertyInfoState, "" as any);
      }
    } else if (category === "considerations") {
      updateConsideration(valKey as keyof SafetyConsiderationsState, nextVal as any);
      if (!nextVal && detailKey) {
        updateConsideration(detailKey as keyof SafetyConsiderationsState, "" as any);
      }
    }
  };

  // Summary subtitles on main page
  const getConsiderationsSummary = () => {
    const c = guestSafetyState?.considerations;
    if (!c) return "Add details";
    let count = 0;
    if (c.unsuitableChildren) count++;
    if (c.unsuitableInfants) count++;
    if (c.poolNoGate) count++;
    if (c.nearbyWater) count++;
    if (c.climbingStructure) count++;
    if (c.heightsNoRails) count++;
    if (c.dangerousAnimals) count++;
    if (c.specialConsiderations) count++;
    return count > 0 ? `${count} reported` : "Add details";
  };

  const getDevicesSummary = () => {
    const d = guestSafetyState?.devices;
    if (!d) return "Add details";
    const items: string[] = [];
    if (d.smokeAlarm) items.push("Smoke alarm");
    if (d.carbonMonoxideAlarm) items.push("CO alarm");
    if (d.noiseMonitor) items.push("Noise monitor");
    if (d.securityCamera) items.push("Camera");
    if (items.length === 1 && d.smokeAlarm) return "Smoke alarm";
    if (items.length > 0) return items.slice(0, 2).join(", ") + (items.length > 2 ? ` +${items.length - 2}` : "");
    return "Add details";
  };

  const getPropertyInfoSummary = () => {
    const p = guestSafetyState?.propertyInfo;
    if (!p) return "Add details";
    let count = 0;
    if (p.climbStairs) count++;
    if (p.potentialNoise) count++;
    if (p.petsLiveOnProperty) count++;
    if (p.noParking) count++;
    if (p.sharedSpaces) count++;
    if (p.limitedAmenities) count++;
    if (p.weapons) count++;
    return count > 0 ? `${count} items added` : "Add details";
  };

  // Save handler for current modal
  const handleSaveModal = async (category: "considerations" | "devices" | "propertyInfo") => {
    const errors: Record<string, string> = {};

    if (category === "devices") {
      const d = draftState.devices;
      if (d.securityCamera === true && !(d.securityCameraDetails || "").trim()) {
        errors.securityCameraDetails = "Please describe exterior camera locations and whether they are active during stays.";
      }
      if (d.noiseMonitor === true && !(d.noiseMonitorDetails || "").trim()) {
        errors.noiseMonitorDetails = "Please describe where noise decibel monitors are located.";
      }
    } else if (category === "propertyInfo") {
      const p = draftState.propertyInfo;
      if (p.climbStairs === true && !(p.climbStairsDetails || "").trim()) {
        errors.climbStairsDetails = "Please describe the stairs (e.g. flights, handrails, or elevator access).";
      }
      if (p.potentialNoise === true && !(p.potentialNoiseDetails || "").trim()) {
        errors.potentialNoiseDetails = "Please describe potential noise and when it occurs.";
      }
      if (p.petsLiveOnProperty === true && !(p.petsLiveOnPropertyDetails || "").trim()) {
        errors.petsLiveOnPropertyDetails = "Please describe which pets live at the property.";
      }
      if (p.noParking === true && !(p.noParkingDetails || "").trim()) {
        errors.noParkingDetails = "Please describe nearby parking options for guests.";
      }
      if (p.sharedSpaces === true && !(p.sharedSpacesDetails || "").trim()) {
        errors.sharedSpacesDetails = "Please describe which spaces are shared and with whom.";
      }
      if (p.limitedAmenities === true && !(p.limitedAmenitiesDetails || "").trim()) {
        errors.limitedAmenitiesDetails = "Please describe which essential amenities are not provided.";
      }
      if (p.weapons === true && !(p.weaponsDetails || "").trim()) {
        errors.weaponsDetails = "Please describe how weapons are stored and secured.";
      }
    } else if (category === "considerations") {
      const c = draftState.considerations;
      if (c.specialConsiderations === true && !(c.specialConsiderationsDetails || "").trim()) {
        errors.specialConsiderationsDetails = "Please describe the special safety considerations.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    const sanitized = sanitizeGuestSafetyState(draftState);
    setGuestSafetyState(sanitized);
    await onSaveSafety(sanitized);
    closeModal();
  };



  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* MAIN VIEW: GUEST SAFETY 3 CATEGORY ROWS */}
      {/* --------------------------------------------------------- */}
      <div className="space-y-6 animate-in fade-in max-w-xl pb-12 font-sans">
        {/* Header with Back Button */}
        <div className="space-y-2 border-b border-zinc-200/80 pb-5">
          <div className="flex items-center gap-3">
            <BackButton
              onClick={() => {
                setEditorTab?.("space");
                setActiveSection("description");
              }}
            />
            <h1 className="text-2xl font-bold tracking-tight text-[#1F1F1F]">Guest safety</h1>
          </div>
          <p className="text-xs text-zinc-500 font-normal pl-11 leading-relaxed">
            The safety details you share will appear on your listing, along with information like your House Rules.
          </p>
        </div>

        {/* 3 Clickable Category Rows */}
        {isLoading ? (
          <GuestsSafetySkeleton />
        ) : (
          <div className="divide-y divide-zinc-200/80 pt-1">
          {/* 1. Safety considerations */}
          <div
            onClick={() => openModal("considerations")}
            className="flex items-center justify-between py-5 cursor-pointer group hover:bg-zinc-50/60 px-2 rounded-xl transition-colors"
          >
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-[#1F1F1F] group-hover:text-zinc-900 transition-colors">
                Safety considerations
              </h4>
              <p className="text-xs text-[#727272] font-normal">{getConsiderationsSummary()}</p>
            </div>
            <svg className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>

          {/* 2. Safety devices */}
          <div
            onClick={() => openModal("devices")}
            className="flex items-center justify-between py-5 cursor-pointer group hover:bg-zinc-50/60 px-2 rounded-xl transition-colors"
          >
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-[#1F1F1F] group-hover:text-zinc-900 transition-colors">
                Safety devices
              </h4>
              <p className="text-xs text-[#727272] font-normal">{getDevicesSummary()}</p>
            </div>
            <svg className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>

          {/* 3. Property info */}
          <div
            onClick={() => openModal("propertyInfo")}
            className="flex items-center justify-between py-5 cursor-pointer group hover:bg-zinc-50/60 px-2 rounded-xl transition-colors"
          >
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-[#1F1F1F] group-hover:text-zinc-900 transition-colors">
                Property info
              </h4>
              <p className="text-xs text-[#727272] font-normal">{getPropertyInfoSummary()}</p>
            </div>
            <svg className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: SAFETY CONSIDERATIONS */}
      {/* ========================================================= */}
      {isConsiderationsOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 border border-zinc-150 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Safety considerations</h3>
                <p className="text-xs text-zinc-500 font-normal">
                  Select any specific considerations guests should know about.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-zinc-900 font-semibold text-base cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 divide-y divide-zinc-200/80">
              {/* 1. Children */}
              <div className="pt-2 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Not a good fit for children 2–12
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      This property has features that may not be safe for kids.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("children")}
                      className="text-xs font-semibold underline text-zinc-900 hover:text-zinc-700 inline-block cursor-pointer pt-0.5"
                    >
                      Learn more
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="not suitable for children"
                    value={draftState.considerations.unsuitableChildren}
                    onChange={(val) =>
                      handleToggleQuestion("considerations", "unsuitableChildren", "unsuitableChildrenDetails", val)
                    }
                  />
                </div>
                {draftState.considerations.unsuitableChildren === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">Add details</label>
                      <span className="text-[11px] text-zinc-400">{(draftState.considerations.unsuitableChildrenDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.unsuitableChildrenDetails || ""}
                      onChange={(e) => updateConsideration("unsuitableChildrenDetails", e.target.value)}
                      placeholder="Describe any child safety considerations or hazards..."
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 2. Infants */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Not a good fit for infants under 2
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      This property has features that may not be safe for babies or toddlers this age.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("infants")}
                      className="text-xs font-semibold underline text-zinc-900 hover:text-zinc-700 inline-block cursor-pointer pt-0.5"
                    >
                      Learn more
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="not suitable for infants"
                    value={draftState.considerations.unsuitableInfants}
                    onChange={(val) =>
                      handleToggleQuestion("considerations", "unsuitableInfants", "unsuitableInfantsDetails", val)
                    }
                  />
                </div>
                {draftState.considerations.unsuitableInfants === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">Add details</label>
                      <span className="text-[11px] text-zinc-400">{(draftState.considerations.unsuitableInfantsDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.unsuitableInfantsDetails || ""}
                      onChange={(e) => updateConsideration("unsuitableInfantsDetails", e.target.value)}
                      placeholder="Describe any infant safety considerations or hazards..."
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 3. Pool */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Pool or hot tub doesn&apos;t have a gate or lock
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests have access to an unsecured swimming pool or hot tub. Check your local laws for specific requirements.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="pool without gate"
                    value={draftState.considerations.poolNoGate}
                    onChange={(val) =>
                      handleToggleQuestion("considerations", "poolNoGate", "poolNoGateDetails", val)
                    }
                  />
                </div>
                {draftState.considerations.poolNoGate === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">Add details</label>
                      <span className="text-[11px] text-zinc-400">{(draftState.considerations.poolNoGateDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.poolNoGateDetails || ""}
                      onChange={(e) => updateConsideration("poolNoGateDetails", e.target.value)}
                      placeholder="Describe pool or hot tub access and safety features..."
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 4. Nearby water */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Nearby water, like a lake or river
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests have unrestricted access to a body of water, like an ocean, pond, creek or wetlands, directly on or next to the property.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="nearby water"
                    value={draftState.considerations.nearbyWater}
                    onChange={(val) =>
                      handleToggleQuestion("considerations", "nearbyWater", "nearbyWaterDetails", val)
                    }
                  />
                </div>
                {draftState.considerations.nearbyWater === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">Add details</label>
                      <span className="text-[11px] text-zinc-400">{(draftState.considerations.nearbyWaterDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.nearbyWaterDetails || ""}
                      onChange={(e) => updateConsideration("nearbyWaterDetails", e.target.value)}
                      placeholder="Describe proximity to water and any barriers or safety guidance..."
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 5. Climbing structure */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Climbing or play structure(s) on the property
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests will have access to structures like a playset, slide, swings or climbing ropes.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="climbing play structure"
                    value={draftState.considerations.climbingStructure}
                    onChange={(val) =>
                      handleToggleQuestion("considerations", "climbingStructure", "climbingStructureDetails", val)
                    }
                  />
                </div>
                {draftState.considerations.climbingStructure === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">Add details</label>
                      <span className="text-[11px] text-zinc-400">{(draftState.considerations.climbingStructureDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.climbingStructureDetails || ""}
                      onChange={(e) => updateConsideration("climbingStructureDetails", e.target.value)}
                      placeholder="Describe the play or climbing structures on the property..."
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 6. Heights without rails */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      There are heights without rails or protection
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests have access to an area higher than 30 inches (76 centimetres), such as a balcony, roof, terrace or cliff, that doesn&apos;t have a rail or other protection.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="heights without rails"
                    value={draftState.considerations.heightsNoRails}
                    onChange={(val) =>
                      handleToggleQuestion("considerations", "heightsNoRails", "heightsNoRailsDetails", val)
                    }
                  />
                </div>
                {draftState.considerations.heightsNoRails === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">Add details</label>
                      <span className="text-[11px] text-zinc-400">{(draftState.considerations.heightsNoRailsDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.heightsNoRailsDetails || ""}
                      onChange={(e) => updateConsideration("heightsNoRailsDetails", e.target.value)}
                      placeholder="Describe the elevated areas without rails..."
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 7. Dangerous animals */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Potentially dangerous animal(s) on the property
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests and their pets will be around animals, like a horse, puma or farm animal, that could cause harm.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("animals")}
                      className="text-xs font-semibold underline text-zinc-900 hover:text-zinc-700 inline-block cursor-pointer pt-0.5"
                    >
                      Learn more
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="dangerous animals"
                    value={draftState.considerations.dangerousAnimals}
                    onChange={(val) =>
                      handleToggleQuestion("considerations", "dangerousAnimals", "dangerousAnimalsDetails", val)
                    }
                  />
                </div>
                {draftState.considerations.dangerousAnimals === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">Add details</label>
                      <span className="text-[11px] text-zinc-400">{(draftState.considerations.dangerousAnimalsDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.dangerousAnimalsDetails || ""}
                      onChange={(e) => updateConsideration("dangerousAnimalsDetails", e.target.value)}
                      placeholder="Describe any animals that guests may encounter..."
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 8. Special considerations */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Special considerations
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Let guests know if any property features could be unsafe and explain why.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("special")}
                      className="text-xs font-semibold underline text-zinc-900 hover:text-zinc-700 inline-block cursor-pointer pt-0.5"
                    >
                      Learn more
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="special considerations"
                    value={draftState.considerations.specialConsiderations}
                    onChange={(val) =>
                      handleToggleQuestion("considerations", "specialConsiderations", "specialConsiderationsDetails", val)
                    }
                  />
                </div>
                {draftState.considerations.specialConsiderations === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        Explain why any property features could be unsafe *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.considerations.specialConsiderationsDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.specialConsiderationsDetails || ""}
                      onChange={(e) => {
                        updateConsideration("specialConsiderationsDetails", e.target.value);
                        if (validationErrors.specialConsiderationsDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.specialConsiderationsDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., Unpaved gravel slope leading to entrance; may be slippery when wet."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.specialConsiderationsDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.specialConsiderationsDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.specialConsiderationsDetails}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60">
              <button
                type="button"
                onClick={closeModal}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveModal("considerations")}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: SAFETY DEVICES */}
      {/* ========================================================= */}
      {isDevicesOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 border border-zinc-150 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Safety devices</h3>
                <p className="text-xs text-zinc-500 font-normal">
                  Disclose safety devices and alarms installed at your space.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-zinc-900 font-semibold text-base cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 divide-y divide-zinc-200/80">
              {/* 1. Exterior Camera */}
              <div className="pt-2 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Exterior security camera present
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      This property has one or more exterior cameras that record or transmit video, images or audio. You must disclose them if they&apos;re turned off.
                    </p>
                    <p className="text-xs text-zinc-500 leading-relaxed italic pt-0.5">
                      Note: Security cameras that monitor indoor spaces or outdoor areas where greater privacy is expected, such as a shower, are not allowed.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("camera")}
                      className="text-xs font-semibold underline text-zinc-900 hover:text-zinc-700 inline-block cursor-pointer pt-0.5"
                    >
                      Learn more
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="exterior security camera"
                    value={draftState.devices.securityCamera}
                    onChange={(val) =>
                      handleToggleQuestion("devices", "securityCamera", "securityCameraDetails", val)
                    }
                  />
                </div>
                {draftState.devices.securityCamera === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        Where are the exterior cameras located and will they be on or off during stays? *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.devices.securityCameraDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.devices.securityCameraDetails || ""}
                      onChange={(e) => {
                        updateDevice("securityCameraDetails", e.target.value);
                        if (validationErrors.securityCameraDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.securityCameraDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., Ring doorbell camera on front entrance and floodlight camera over driveway, active 24/7."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.securityCameraDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.securityCameraDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.securityCameraDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Noise decibel monitor */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Noise decibel monitor present
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      This property has one or more devices that can assess sound level but don&apos;t record audio.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("noise")}
                      className="text-xs font-semibold underline text-zinc-900 hover:text-zinc-700 inline-block cursor-pointer pt-0.5"
                    >
                      Learn more
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="noise decibel monitor"
                    value={draftState.devices.noiseMonitor}
                    onChange={(val) =>
                      handleToggleQuestion("devices", "noiseMonitor", "noiseMonitorDetails", val)
                    }
                  />
                </div>
                {draftState.devices.noiseMonitor === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        Where are the noise decibel monitors located? *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.devices.noiseMonitorDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.devices.noiseMonitorDetails || ""}
                      onChange={(e) => {
                        updateDevice("noiseMonitorDetails", e.target.value);
                        if (validationErrors.noiseMonitorDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.noiseMonitorDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., Minut sensor in the living room."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.noiseMonitorDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.noiseMonitorDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.noiseMonitorDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Carbon monoxide alarm */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Carbon monoxide alarm
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      A device that alerts if it detects unsafe levels of carbon monoxide (Check your local laws, which may require a working carbon monoxide detector in your listing).
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("co")}
                      className="text-xs font-semibold underline text-zinc-900 hover:text-zinc-700 inline-block cursor-pointer pt-0.5"
                    >
                      Learn more
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="carbon monoxide alarm"
                    value={draftState.devices.carbonMonoxideAlarm}
                    onChange={(val) =>
                      handleToggleQuestion("devices", "carbonMonoxideAlarm", "carbonMonoxideAlarmDetails", val)
                    }
                  />
                </div>
                {draftState.devices.carbonMonoxideAlarm === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">Add details (optional)</label>
                      <span className="text-[11px] text-zinc-400">{(draftState.devices.carbonMonoxideAlarmDetails || "").length}/500</span>
                    </div>
                    <input
                      type="text"
                      value={draftState.devices.carbonMonoxideAlarmDetails || ""}
                      onChange={(e) => updateDevice("carbonMonoxideAlarmDetails", e.target.value)}
                      placeholder="Add details about carbon monoxide alarm location (optional)"
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 4. Smoke alarm */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Smoke alarm
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      A device that alerts when it detects smoke (Check your local laws, which may require a working smoke detector in your listing).
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("smoke")}
                      className="text-xs font-semibold underline text-zinc-900 hover:text-zinc-700 inline-block cursor-pointer pt-0.5"
                    >
                      Learn more
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="smoke alarm"
                    value={draftState.devices.smokeAlarm}
                    onChange={(val) =>
                      handleToggleQuestion("devices", "smokeAlarm", "smokeAlarmDetails", val)
                    }
                  />
                </div>
                {draftState.devices.smokeAlarm === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">Add details (optional)</label>
                      <span className="text-[11px] text-zinc-400">{(draftState.devices.smokeAlarmDetails || "").length}/500</span>
                    </div>
                    <input
                      type="text"
                      value={draftState.devices.smokeAlarmDetails || ""}
                      onChange={(e) => updateDevice("smokeAlarmDetails", e.target.value)}
                      placeholder="Add details about smoke alarm location (optional)"
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60">
              <button
                type="button"
                onClick={closeModal}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveModal("devices")}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PROPERTY INFO */}
      {/* ========================================================= */}
      {isPropertyInfoOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 border border-zinc-150 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Property info</h3>
                <p className="text-xs text-zinc-500 font-normal">
                  Select any specific characteristics about your space.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-zinc-900 font-semibold text-base cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 divide-y divide-zinc-200/80">
              {/* 1. Stairs */}
              <div className="pt-2 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Guests must climb stairs
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests can expect to walk up and down stairs during their stay.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="climb stairs"
                    value={draftState.propertyInfo.climbStairs}
                    onChange={(val) =>
                      handleToggleQuestion("propertyInfo", "climbStairs", "climbStairsDetails", val)
                    }
                  />
                </div>
                {draftState.propertyInfo.climbStairs === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        Describe the stairs (e.g. number of flights, handrails, or elevator access) *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.propertyInfo.climbStairsDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.propertyInfo.climbStairsDetails || ""}
                      onChange={(e) => {
                        updatePropertyInfo("climbStairsDetails", e.target.value);
                        if (validationErrors.climbStairsDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.climbStairsDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., 2 flights of outdoor steps to front door, handrail provided on right."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.climbStairsDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.climbStairsDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.climbStairsDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Potential noise */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Potential noise during stays
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests should expect to hear some noise during their stay. For example, traffic, construction or nearby businesses.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="potential noise"
                    value={draftState.propertyInfo.potentialNoise}
                    onChange={(val) =>
                      handleToggleQuestion("propertyInfo", "potentialNoise", "potentialNoiseDetails", val)
                    }
                  />
                </div>
                {draftState.propertyInfo.potentialNoise === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        Describe the noise and when guests might hear it *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.propertyInfo.potentialNoiseDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.propertyInfo.potentialNoiseDetails || ""}
                      onChange={(e) => {
                        updatePropertyInfo("potentialNoiseDetails", e.target.value);
                        if (validationErrors.potentialNoiseDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.potentialNoiseDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., Light street traffic during morning commute hours."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.potentialNoiseDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.potentialNoiseDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.potentialNoiseDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Pets live at property */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Pet(s) live at the property
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests may meet or interact with pets during their stay.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="pets live at property"
                    value={draftState.propertyInfo.petsLiveOnProperty}
                    onChange={(val) =>
                      handleToggleQuestion("propertyInfo", "petsLiveOnProperty", "petsLiveOnPropertyDetails", val)
                    }
                  />
                </div>
                {draftState.propertyInfo.petsLiveOnProperty === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        Describe what pets live on the property and where they stay *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.propertyInfo.petsLiveOnPropertyDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.propertyInfo.petsLiveOnPropertyDetails || ""}
                      onChange={(e) => {
                        updatePropertyInfo("petsLiveOnPropertyDetails", e.target.value);
                        if (validationErrors.petsLiveOnPropertyDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.petsLiveOnPropertyDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., Friendly golden retriever stays in the fenced backyard area."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.petsLiveOnPropertyDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.petsLiveOnPropertyDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.petsLiveOnPropertyDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 4. No parking */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      No parking on the property
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      This property doesn&apos;t have dedicated parking spots for guests.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="no parking"
                    value={draftState.propertyInfo.noParking}
                    onChange={(val) =>
                      handleToggleQuestion("propertyInfo", "noParking", "noParkingDetails", val)
                    }
                  />
                </div>
                {draftState.propertyInfo.noParking === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        Describe nearby parking options *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.propertyInfo.noParkingDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.propertyInfo.noParkingDetails || ""}
                      onChange={(e) => {
                        updatePropertyInfo("noParkingDetails", e.target.value);
                        if (validationErrors.noParkingDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.noParkingDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., Free street parking available on 4th Ave, paid garage 2 blocks away."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.noParkingDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.noParkingDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.noParkingDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Shared spaces */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Property has shared spaces
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests should expect to share spaces, such as a kitchen, bathroom or patio, with other people during their stay.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="shared spaces"
                    value={draftState.propertyInfo.sharedSpaces}
                    onChange={(val) =>
                      handleToggleQuestion("propertyInfo", "sharedSpaces", "sharedSpacesDetails", val)
                    }
                  />
                </div>
                {draftState.propertyInfo.sharedSpaces === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        Describe which spaces are shared and with whom *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.propertyInfo.sharedSpacesDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.propertyInfo.sharedSpacesDetails || ""}
                      onChange={(e) => {
                        updatePropertyInfo("sharedSpacesDetails", e.target.value);
                        if (validationErrors.sharedSpacesDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.sharedSpacesDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., Shared kitchen and patio with other guests."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.sharedSpacesDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.sharedSpacesDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.sharedSpacesDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 6. Limited amenities */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Limited essential amenities
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Some common essentials are not included on this property. For example, wifi, running water, indoor shower.
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="limited essential amenities"
                    value={draftState.propertyInfo.limitedAmenities}
                    onChange={(val) =>
                      handleToggleQuestion("propertyInfo", "limitedAmenities", "limitedAmenitiesDetails", val)
                    }
                  />
                </div>
                {draftState.propertyInfo.limitedAmenities === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        List the essential amenities that are not included *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.propertyInfo.limitedAmenitiesDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.propertyInfo.limitedAmenitiesDetails || ""}
                      onChange={(e) => {
                        updatePropertyInfo("limitedAmenitiesDetails", e.target.value);
                        if (validationErrors.limitedAmenitiesDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.limitedAmenitiesDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., Off-grid cabin: no wifi, rainwater shower only."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.limitedAmenitiesDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.limitedAmenitiesDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.limitedAmenitiesDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 7. Weapons */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-[#1F1F1F] block">
                      Weapon(s) on the property
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      There&apos;s at least one weapon stored on this property. Check your local laws for specific requirements.
                    </p>
                    <p className="text-xs text-zinc-500 leading-relaxed italic pt-0.5">
                      Reminder: Airbnb requires all weapons to be properly stored and secured.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("weapons")}
                      className="text-xs font-semibold underline text-zinc-900 hover:text-zinc-700 inline-block cursor-pointer pt-0.5"
                    >
                      Learn more
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="weapons on property"
                    value={draftState.propertyInfo.weapons}
                    onChange={(val) =>
                      handleToggleQuestion("propertyInfo", "weapons", "weaponsDetails", val)
                    }
                  />
                </div>
                {draftState.propertyInfo.weapons === true && (
                  <div className="rounded-2xl bg-zinc-50/90 border border-zinc-200/80 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800">
                        Describe how weapons are stored and secured *
                      </label>
                      <span className="text-[11px] text-zinc-400">{(draftState.propertyInfo.weaponsDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.propertyInfo.weaponsDetails || ""}
                      onChange={(e) => {
                        updatePropertyInfo("weaponsDetails", e.target.value);
                        if (validationErrors.weaponsDetails) {
                          setValidationErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.weaponsDetails;
                            return copy;
                          });
                        }
                      }}
                      placeholder="e.g., Hunting rifle kept unloaded inside locked biometric safe."
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-colors ${
                        validationErrors.weaponsDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300"
                          : "border-zinc-300 focus:border-zinc-900"
                      }`}
                      maxLength={500}
                    />
                    {validationErrors.weaponsDetails && (
                      <p className="text-[11px] text-rose-600 font-medium">{validationErrors.weaponsDetails}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60">
              <button
                type="button"
                onClick={closeModal}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 underline cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveModal("propertyInfo")}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================= */}
      {/* LEARN MORE INFO MODAL */}
      {/* ========================================================= */}
      {learnMoreTopic && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setLearnMoreTopic(null)}
              className="absolute top-5 right-5 text-zinc-500 hover:text-zinc-900 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <h3 className="font-semibold text-lg text-[#1F1F1F]">
              {learnMoreTopic === "camera" && "Security cameras and recording devices"}
              {learnMoreTopic === "noise" && "Noise decibel monitors"}
              {learnMoreTopic === "co" && "Carbon monoxide alarms"}
              {learnMoreTopic === "smoke" && "Smoke alarms"}
              {learnMoreTopic === "weapons" && "Weapons on property policy"}
              {learnMoreTopic === "children" && "Children safety policy"}
              {learnMoreTopic === "infants" && "Infant suitability policy"}
              {learnMoreTopic === "animals" && "Dangerous animals guidance"}
              {learnMoreTopic === "special" && "Special considerations"}
            </h3>

            <div className="text-xs text-zinc-600 leading-relaxed space-y-3">
              {learnMoreTopic === "camera" && (
                <>
                  <p>
                    Hosts are required to disclose any exterior security cameras, doorbell cameras, or recording devices. You must describe their location and whether they are powered on during stays.
                  </p>
                  <p className="font-medium text-zinc-900">
                    Cameras in private spaces (such as bedrooms, bathrooms, or indoor areas) are strictly prohibited.
                  </p>
                </>
              )}
              {learnMoreTopic === "noise" && (
                <p>
                  Noise decibel monitors allow hosts to measure sound levels without recording or transmitting audio conversations. Hosts must disclose all devices to guests before booking.
                </p>
              )}
              {learnMoreTopic === "co" && (
                <p>
                  Carbon monoxide detectors protect guests against odorless, toxic gases. Many jurisdictions require working carbon monoxide detectors in rental homes with fuel-burning appliances or attached garages.
                </p>
              )}
              {learnMoreTopic === "smoke" && (
                <p>
                  Working smoke detectors are a crucial safety feature. Check local regulations for requirements on smoke alarm placement and battery testing.
                </p>
              )}
              {learnMoreTopic === "weapons" && (
                <p>
                  All weapons, firearms, and ammunition must be securely locked in a safe or secured cabinet that guests cannot access without host authorization.
                </p>
              )}
              {learnMoreTopic === "children" && (
                <p>
                  If your space has steep drops, unprotected stairs, fragile heirlooms, or open balconies, indicate that it may not be suitable for young children.
                </p>
              )}
              {learnMoreTopic === "infants" && (
                <p>
                  Indicate if your listing lacks infant-proofing, child gates, or has hazardous hazards that pose risks for babies under 2 years old.
                </p>
              )}
              {learnMoreTopic === "animals" && (
                <p>
                  Disclose if farm animals, aggressive watchdogs, horses, or wildlife that could potentially injure guests or their pets are present on the grounds.
                </p>
              )}
              {learnMoreTopic === "special" && (
                <p>
                  Share any unique property conditions that guests need to be aware of to ensure a safe and comfortable stay.
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setLearnMoreTopic(null)}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-6 py-2 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
