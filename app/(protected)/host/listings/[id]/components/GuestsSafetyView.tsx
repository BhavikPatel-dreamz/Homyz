"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy editor callback surface */

import React, { useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { useLanguage } from "@/lib/i18n/language-context";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import {
  GuestSafetyState,
  SafetyDeviceState,
  PropertyInfoState,
  SafetyConsiderationsState,
  sanitizeGuestSafetyState,
} from "./guest-safety-helpers";
import { GuestsSafetySkeleton } from "./YourSpaceSkeletons";
import { CloseIcon } from "@/components/ui/close-icon";

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
  const { t } = useLanguage();
  return (
    <div className="flex shrink-0 items-center gap-2" aria-label={label}>
      <button
        type="button"
        aria-label={t("host_safety_allow_deny_no").replace("{label}", label)}
        aria-pressed={value === false}
        onClick={() => onChange(false)}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 cursor-pointer ${value === false
            ? "border border-[#727272] bg-zinc-900 hover:bg-[#1f1f1f] !text-white shadow-xs dark:border-zinc-100 dark:bg-zinc-100 dark:!text-zinc-900 hover:!text-white"
          : "border border-[#727272] bg-white hover:bg-[#1f1f1f] !text-zinc-600 hover:!text-white dark:border-zinc-700 dark:bg-zinc-800/80 dark:!text-zinc-300 dark:hover:bg-zinc-700/80"
          }`}
      >
        <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={t("host_safety_allow_deny_yes").replace("{label}", label)}
        aria-pressed={value === true}
        onClick={() => onChange(true)}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 cursor-pointer ${value === true
            ? "border border-[#727272] hover:bg-[#1f1f1f] bg-zinc-900 !text-white shadow-xs dark:border-zinc-100 dark:bg-zinc-100 dark:!text-zinc-900 hover:!text-white"
            : "border border-[#727272] hover:bg-[#1f1f1f] bg-white !text-zinc-600 hover:!text-white dark:border-zinc-700 dark:bg-zinc-800/80 dark:!text-zinc-300 dark:hover:bg-zinc-700/80"
          }`}
      >
        <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
  const { t } = useLanguage();
  const [isConsiderationsOpen, setIsConsiderationsOpen] = useState(false);
  const [isDevicesOpen, setIsDevicesOpen] = useState(false);
  const [isPropertyInfoOpen, setIsPropertyInfoOpen] = useState(false);

  // Local draft state for modals so cancel discards changes
  const [draftState, setDraftState] = useState<GuestSafetyState>(() =>
    sanitizeGuestSafetyState(guestSafetyState)
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [learnMoreTopic, setLearnMoreTopic] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const saving = isSaving || modalSaving;

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
    if (!c) return t("host_safety_add_details");
    let count = 0;
    if (c.unsuitableChildren) count++;
    if (c.unsuitableInfants) count++;
    if (c.poolNoGate) count++;
    if (c.nearbyWater) count++;
    if (c.climbingStructure) count++;
    if (c.heightsNoRails) count++;
    if (c.dangerousAnimals) count++;
    if (c.specialConsiderations) count++;
    return count > 0 ? t("host_safety_reported_count").replace("{count}", String(count)) : t("host_safety_add_details");
  };

  const getDevicesSummary = () => {
    const d = guestSafetyState?.devices;
    if (!d) return t("host_safety_add_details");
    const items: string[] = [];
    if (d.smokeAlarm) items.push(t("host_safety_smoke_alarm_short"));
    if (d.carbonMonoxideAlarm) items.push(t("host_safety_co_alarm_short"));
    if (d.noiseMonitor) items.push(t("host_safety_noise_monitor_short"));
    if (d.securityCamera) items.push(t("host_safety_camera_short"));
    if (items.length === 1 && d.smokeAlarm) return t("host_safety_smoke_alarm_short");
    if (items.length > 0) return items.slice(0, 2).join(", ") + (items.length > 2 ? ` +${items.length - 2}` : "");
    return t("host_safety_add_details");
  };

  const getPropertyInfoSummary = () => {
    const p = guestSafetyState?.propertyInfo;
    if (!p) return t("host_safety_add_details");
    let count = 0;
    if (p.climbStairs) count++;
    if (p.potentialNoise) count++;
    if (p.petsLiveOnProperty) count++;
    if (p.noParking) count++;
    if (p.sharedSpaces) count++;
    if (p.limitedAmenities) count++;
    if (p.weapons) count++;
    return count > 0 ? t("host_safety_items_added_count").replace("{count}", String(count)) : t("host_safety_add_details");
  };

  // Save handler for current modal
  const handleSaveModal = async (category: "considerations" | "devices" | "propertyInfo") => {
    const errors: Record<string, string> = {};

    if (category === "devices") {
      const d = draftState.devices;
      if (d.securityCamera === true && !(d.securityCameraDetails || "").trim()) {
        errors.securityCameraDetails = t("host_safety_security_camera_error");
      }
      if (d.noiseMonitor === true && !(d.noiseMonitorDetails || "").trim()) {
        errors.noiseMonitorDetails = t("host_safety_noise_monitor_error");
      }
    } else if (category === "propertyInfo") {
      const p = draftState.propertyInfo;
      if (p.climbStairs === true && !(p.climbStairsDetails || "").trim()) {
        errors.climbStairsDetails = t("host_safety_climb_stairs_error");
      }
      if (p.potentialNoise === true && !(p.potentialNoiseDetails || "").trim()) {
        errors.potentialNoiseDetails = t("host_safety_potential_noise_error");
      }
      if (p.petsLiveOnProperty === true && !(p.petsLiveOnPropertyDetails || "").trim()) {
        errors.petsLiveOnPropertyDetails = t("host_safety_pets_live_error");
      }
      if (p.noParking === true && !(p.noParkingDetails || "").trim()) {
        errors.noParkingDetails = t("host_safety_no_parking_error");
      }
      if (p.sharedSpaces === true && !(p.sharedSpacesDetails || "").trim()) {
        errors.sharedSpacesDetails = t("host_safety_shared_spaces_error");
      }
      if (p.limitedAmenities === true && !(p.limitedAmenitiesDetails || "").trim()) {
        errors.limitedAmenitiesDetails = t("host_safety_limited_amenities_error");
      }
      if (p.weapons === true && !(p.weaponsDetails || "").trim()) {
        errors.weaponsDetails = t("host_safety_weapons_error");
      }
    } else if (category === "considerations") {
      const c = draftState.considerations;
      if (c.specialConsiderations === true && !(c.specialConsiderationsDetails || "").trim()) {
        errors.specialConsiderationsDetails = t("host_safety_special_considerations_error");
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    const sanitized = sanitizeGuestSafetyState(draftState);
    setGuestSafetyState(sanitized);
    setModalSaving(true);
    try {
      await onSaveSafety(sanitized);
      closeModal();
    } catch (err) {
      console.error("Error saving guest safety section:", err);
    } finally {
      setModalSaving(false);
    }
  };



  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* MAIN VIEW: GUEST SAFETY 3 CATEGORY ROWS */}
      {/* --------------------------------------------------------- */}
      <div className="space-y-6 animate-in fade-in max-w-xl pb-12 font-sans">
        {/* Header with Back Button */}
        <div className="space-y-2 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
          <div className="flex items-start gap-6">
            <BackButton
              onClick={() => {
                setEditorTab?.("space");
                setActiveSection("house-rules");
              }}
              className="mt-2"
            />
            <div>
              <h1 className="mb-2">{t("host_guest_safety_title")}</h1>
              <p className="text-sm leading-5 text-[#727272] dark:text-zinc-400">
                {t("host_guest_safety_desc")}
              </p>
            </div>
          </div>
        </div>

        {/* 3 Clickable Category Rows */}
        {isLoading ? (
          <GuestsSafetySkeleton />
        ) : (
          <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800 pt-1">
            {/* 1. Safety considerations */}
            <div
              onClick={() => openModal("considerations")}
              className="flex items-center justify-between py-5 cursor-pointer group hover:bg-zinc-50/60 dark:hover:bg-zinc-800/50 px-2 rounded-xl transition-colors"
            >
              <div className="space-y-0.5">
                <h4 className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors duration-300">
                  {t("host_safety_considerations")}
                </h4>
                <p className="text-base text-[#727272] dark:text-zinc-400 font-normal">{getConsiderationsSummary()}</p>
              </div>
              <svg className="w-4 h-4 text-[#1f1f1f] group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>

            {/* 2. Safety devices */}
            <div
              onClick={() => openModal("devices")}
              className="flex items-center justify-between py-5 cursor-pointer group hover:bg-zinc-50/60 dark:hover:bg-zinc-800/50 px-2 rounded-xl transition-colors"
            >
              <div className="space-y-0.5">
                <h4 className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors duration-300">
                  {t("host_safety_devices")}
                </h4>
                <p className="text-base text-[#727272] dark:text-zinc-400 font-normal">{getDevicesSummary()}</p>
              </div>
              <svg className="w-4 h-4 text-[#1f1f1f] group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>

            {/* 3. Property info */}
            <div
              onClick={() => openModal("propertyInfo")}
              className="flex items-center justify-between py-5 cursor-pointer group hover:bg-zinc-50/60 dark:hover:bg-zinc-800/50 px-2 rounded-xl transition-colors"
            >
              <div className="space-y-0.5">
                <h4 className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors duration-300">
                  {t("host_property_info")}
                </h4>
                <p className="text-base text-[#727272] dark:text-zinc-400 font-normal">{getPropertyInfoSummary()}</p>
              </div>
              <svg className="w-4 h-4 text-[#1f1f1f] group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 dark:border-zinc-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 dark:border-zinc-800 flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-medium text-xl tracking-tight text-[#1F1F1F] dark:text-zinc-100">{t("host_safety_considerations_modal_title")}</h3>
                <p className="text-sm text-[#727272] dark:text-zinc-400 font-normal">
                  {t("host_safety_considerations_modal_desc")}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-[#1f1f1f] hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-[#727272] font-semibold text-base cursor-pointer p-1"
              >
                <CloseIcon className="size-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="modal-content-scrollbar flex-1 overflow-y-auto p-6 divide-y divide-[#727272] dark:divide-white">
              {/* 1. Children */}
              <div className="pt-2 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_unsuitable_children_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_unsuitable_children_desc")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("children")}
                      className="text-sm font-medium underline text-[#1f1f1f] dark:text-zinc-100 hover:text-[#727272] dark:hover:text-zinc-300 inline-block cursor-pointer pt-0.5"
                    >
                      {t("host_safety_learn_more")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_safety_add_details_label")}</label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.considerations.unsuitableChildrenDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.unsuitableChildrenDetails || ""}
                      onChange={(e) => updateConsideration("unsuitableChildrenDetails", e.target.value)}
                      placeholder={t("host_safety_unsuitable_children_placeholder")}
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 2. Infants */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_unsuitable_infants_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_unsuitable_infants_desc")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("infants")}
                      className="text-sm font-medium underline text-[#1f1f1f] dark:text-zinc-100 hover:text-[#727272] dark:hover:text-zinc-300 inline-block cursor-pointer pt-0.5"
                    >
                      {t("host_safety_learn_more")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_safety_add_details_label")}</label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.considerations.unsuitableInfantsDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.unsuitableInfantsDetails || ""}
                      onChange={(e) => updateConsideration("unsuitableInfantsDetails", e.target.value)}
                      placeholder={t("host_safety_unsuitable_infants_placeholder")}
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 3. Pool */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_pool_no_gate_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_pool_no_gate_desc")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_safety_add_details_label")}</label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.considerations.poolNoGateDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.poolNoGateDetails || ""}
                      onChange={(e) => updateConsideration("poolNoGateDetails", e.target.value)}
                      placeholder={t("host_safety_pool_no_gate_placeholder")}
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 4. Nearby water */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_nearby_water_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_nearby_water_desc")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_safety_add_details_label")}</label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.considerations.nearbyWaterDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.nearbyWaterDetails || ""}
                      onChange={(e) => updateConsideration("nearbyWaterDetails", e.target.value)}
                      placeholder={t("host_safety_nearby_water_placeholder")}
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 5. Climbing structure */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_climbing_structure_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_climbing_structure_desc")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_safety_add_details_label")}</label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.considerations.climbingStructureDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.climbingStructureDetails || ""}
                      onChange={(e) => updateConsideration("climbingStructureDetails", e.target.value)}
                      placeholder={t("host_safety_climbing_structure_placeholder")}
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 6. Heights without rails */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_heights_no_rails_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_heights_no_rails_desc")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_safety_add_details_label")}</label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.considerations.heightsNoRailsDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.heightsNoRailsDetails || ""}
                      onChange={(e) => updateConsideration("heightsNoRailsDetails", e.target.value)}
                      placeholder={t("host_safety_heights_no_rails_placeholder")}
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 7. Dangerous animals */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_dangerous_animals_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_dangerous_animals_desc")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("animals")}
                      className="text-sm font-medium underline text-[#1f1f1f] dark:text-zinc-100 hover:text-[#727272] dark:hover:text-zinc-300 inline-block cursor-pointer pt-0.5"
                    >
                      {t("host_safety_learn_more")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_safety_add_details_label")}</label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.considerations.dangerousAnimalsDetails || "").length}/500</span>
                    </div>
                    <textarea
                      rows={2}
                      value={draftState.considerations.dangerousAnimalsDetails || ""}
                      onChange={(e) => updateConsideration("dangerousAnimalsDetails", e.target.value)}
                      placeholder={t("host_safety_dangerous_animals_placeholder")}
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 8. Other safety or regulatory notes */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_special_considerations_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_special_considerations_desc")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("special")}
                      className="text-sm font-medium underline text-[#1f1f1f] dark:text-zinc-100 hover:text-[#727272] dark:hover:text-zinc-300 inline-block cursor-pointer pt-0.5"
                    >
                      {t("host_safety_learn_more")}
                    </button>
                  </div>
                  <AllowDenyButtons
                    label="other safety or regulatory notes"
                    value={draftState.considerations.specialConsiderations}
                    onChange={(val) =>
                      handleToggleQuestion("considerations", "specialConsiderations", "specialConsiderationsDetails", val)
                    }
                  />
                </div>
                {draftState.considerations.specialConsiderations === true && (
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_special_considerations_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.considerations.specialConsiderationsDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_special_considerations_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.specialConsiderationsDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.specialConsiderationsDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.specialConsiderationsDetails}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 dark:border-zinc-800 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/60">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-[#1f1f1f] hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] font-medium hover:text-white text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {t("host_house_rules_cancel")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveModal("considerations")}
                className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F] hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {saving && (
                  <svg className="w-3.5 h-3.5 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {saving ? t("host_saving") : t("host_save")}
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
          <div className="bg-white dark:bg-zinc-900 rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 border border-zinc-150 dark:border-zinc-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 dark:border-zinc-800 flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-medium text-xl tracking-tight text-[#1F1F1F] dark:text-zinc-100">{t("host_safety_devices_modal_title")}</h3>
                <p className="text-sm text-[#727272] dark:text-zinc-400 font-normal">
                  {t("host_safety_devices_modal_desc")}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100 font-semibold text-base cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="modal-content-scrollbar flex-1 overflow-y-auto p-6 divide-y divide-[#727272] dark:divide-white">
              {/* 1. Exterior Camera */}
              <div className="pt-2 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_security_camera_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_security_camera_desc")}
                    </p>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed italic pt-0.5">
                      {t("host_safety_security_camera_note")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("camera")}
                      className="text-sm font-medium underline text-[#1f1f1f] dark:text-zinc-100 hover:text-[#727272] dark:hover:text-zinc-300 inline-block cursor-pointer pt-0.5"
                    >
                      {t("host_safety_learn_more")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_security_camera_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.devices.securityCameraDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_security_camera_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.securityCameraDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.securityCameraDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.securityCameraDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Noise decibel monitor */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_noise_monitor_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_noise_monitor_desc")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("noise")}
                      className="text-sm font-medium underline text-[#1f1f1f] dark:text-zinc-100 hover:text-[#727272] dark:hover:text-zinc-300 inline-block cursor-pointer pt-0.5"
                    >
                      {t("host_safety_learn_more")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_noise_monitor_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.devices.noiseMonitorDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_noise_monitor_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.noiseMonitorDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.noiseMonitorDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.noiseMonitorDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Carbon monoxide alarm */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_carbon_monoxide_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_carbon_monoxide_desc")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("co")}
                      className="text-sm font-medium underline text-[#1f1f1f] dark:text-zinc-100 hover:text-[#727272] dark:hover:text-zinc-300 inline-block cursor-pointer pt-0.5"
                    >
                      {t("host_safety_learn_more")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_safety_add_details_optional")}</label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.devices.carbonMonoxideAlarmDetails || "").length}/500</span>
                    </div>
                    <input
                      type="text"
                      value={draftState.devices.carbonMonoxideAlarmDetails || ""}
                      onChange={(e) => updateDevice("carbonMonoxideAlarmDetails", e.target.value)}
                      placeholder={t("host_safety_carbon_monoxide_placeholder")}
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>

              {/* 4. Smoke alarm */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_smoke_alarm_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_smoke_alarm_desc")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("smoke")}
                      className="text-sm font-medium underline text-[#1f1f1f] dark:text-zinc-100 hover:text-[#727272] dark:hover:text-zinc-300 inline-block cursor-pointer pt-0.5"
                    >
                      {t("host_safety_learn_more")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_safety_add_details_optional")}</label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.devices.smokeAlarmDetails || "").length}/500</span>
                    </div>
                    <input
                      type="text"
                      value={draftState.devices.smokeAlarmDetails || ""}
                      onChange={(e) => updateDevice("smokeAlarmDetails", e.target.value)}
                      placeholder={t("host_safety_smoke_alarm_placeholder")}
                      className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors"
                      maxLength={500}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 dark:border-zinc-800 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/60">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-[#1f1f1f] hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] font-medium hover:text-white text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {t("host_house_rules_cancel")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveModal("devices")}
                className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F] hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {saving && (
                  <svg className="w-3.5 h-3.5 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {saving ? t("host_saving") : t("host_save")}
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
          <div className="bg-white dark:bg-zinc-900 rounded-[28px] max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in zoom-in-95 border border-zinc-150 dark:border-zinc-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200/80 dark:border-zinc-800 flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-medium text-xl tracking-tight text-[#1F1F1F] dark:text-zinc-100">{t("host_property_info_modal_title")}</h3>
                <p className="text-sm text-[#727272] dark:text-zinc-400 font-normal">
                  {t("host_property_info_modal_desc")}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100 font-semibold text-base cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="modal-content-scrollbar flex-1 overflow-y-auto p-6 divide-y divide-[#727272] dark:divide-white">
              {/* 1. Stairs */}
              <div className="pt-2 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_climb_stairs_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_climb_stairs_desc")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_climb_stairs_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.propertyInfo.climbStairsDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_climb_stairs_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.climbStairsDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.climbStairsDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.climbStairsDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Construction or other potential noise */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_potential_noise_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_potential_noise_desc")}
                    </p>
                  </div>
                  <AllowDenyButtons
                    label="construction or other potential noise"
                    value={draftState.propertyInfo.potentialNoise}
                    onChange={(val) =>
                      handleToggleQuestion("propertyInfo", "potentialNoise", "potentialNoiseDetails", val)
                    }
                  />
                </div>
                {draftState.propertyInfo.potentialNoise === true && (
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_potential_noise_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.propertyInfo.potentialNoiseDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_potential_noise_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.potentialNoiseDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.potentialNoiseDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.potentialNoiseDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Pets live at property */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_pets_live_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_pets_live_desc")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_pets_live_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.propertyInfo.petsLiveOnPropertyDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_pets_live_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.petsLiveOnPropertyDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.petsLiveOnPropertyDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.petsLiveOnPropertyDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 4. No parking */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_no_parking_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_no_parking_desc")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_no_parking_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.propertyInfo.noParkingDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_no_parking_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.noParkingDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.noParkingDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.noParkingDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Shared spaces */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_shared_spaces_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_shared_spaces_desc")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_shared_spaces_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.propertyInfo.sharedSpacesDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_shared_spaces_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.sharedSpacesDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.sharedSpacesDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.sharedSpacesDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 6. Limited amenities */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_limited_amenities_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_limited_amenities_desc")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_limited_amenities_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.propertyInfo.limitedAmenitiesDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_limited_amenities_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.limitedAmenitiesDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.limitedAmenitiesDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.limitedAmenitiesDetails}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 7. Weapons */}
              <div className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">
                      {t("host_safety_weapons_title")}
                    </span>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed">
                      {t("host_safety_weapons_desc")}
                    </p>
                    <p className="text-sm text-[#727272] dark:text-zinc-400 leading-relaxed italic pt-0.5">
                      {t("host_safety_weapons_note")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("weapons")}
                      className="text-sm font-medium underline text-[#1f1f1f] dark:text-zinc-100 hover:text-[#727272] dark:hover:text-zinc-300 inline-block cursor-pointer pt-0.5"
                    >
                      {t("host_safety_learn_more")}
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
                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {t("host_safety_weapons_label")}
                      </label>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{(draftState.propertyInfo.weaponsDetails || "").length}/500</span>
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
                      placeholder={t("host_safety_weapons_placeholder")}
                      className={`w-full text-xs p-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none transition-colors ${validationErrors.weaponsDetails
                          ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-300 dark:border-rose-500"
                          : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100"
                        }`}
                      maxLength={500}
                    />
                    {validationErrors.weaponsDetails && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{validationErrors.weaponsDetails}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-200/80 dark:border-zinc-800 p-4 sm:px-6 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/60">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-[#1f1f1f] hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] font-medium hover:text-white text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {t("host_house_rules_cancel")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveModal("propertyInfo")}
                className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F] hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {saving && (
                  <svg className="w-3.5 h-3.5 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {saving ? t("host_saving") : t("host_save")}
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
          <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setLearnMoreTopic(null)}
              className="absolute top-5 right-5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <h3 className="font-semibold text-lg text-[#1F1F1F] dark:text-zinc-100">
              {learnMoreTopic === "camera" && t("host_safety_learn_camera_title")}
              {learnMoreTopic === "noise" && t("host_safety_learn_noise_title")}
              {learnMoreTopic === "co" && t("host_safety_learn_co_title")}
              {learnMoreTopic === "smoke" && t("host_safety_learn_smoke_title")}
              {learnMoreTopic === "weapons" && t("host_safety_learn_weapons_title")}
              {learnMoreTopic === "children" && t("host_safety_learn_children_title")}
              {learnMoreTopic === "infants" && t("host_safety_learn_infants_title")}
              {learnMoreTopic === "animals" && t("host_safety_learn_animals_title")}
              {learnMoreTopic === "special" && t("host_safety_learn_special_title")}
            </h3>

            <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed space-y-3">
              {learnMoreTopic === "camera" && (
                <>
                  <p>
                    {t("host_safety_learn_camera_p1")}
                  </p>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {t("host_safety_learn_camera_p2")}
                  </p>
                </>
              )}
              {learnMoreTopic === "noise" && (
                <p>
                  {t("host_safety_learn_noise_p")}
                </p>
              )}
              {learnMoreTopic === "co" && (
                <p>
                  {t("host_safety_learn_co_p")}
                </p>
              )}
              {learnMoreTopic === "smoke" && (
                <p>
                  {t("host_safety_learn_smoke_p")}
                </p>
              )}
              {learnMoreTopic === "weapons" && (
                <p>
                  {t("host_safety_learn_weapons_p")}
                </p>
              )}
              {learnMoreTopic === "children" && (
                <p>
                  {t("host_safety_learn_children_p")}
                </p>
              )}
              {learnMoreTopic === "infants" && (
                <p>
                  {t("host_safety_learn_infants_p")}
                </p>
              )}
              {learnMoreTopic === "animals" && (
                <p>
                  {t("host_safety_learn_animals_p")}
                </p>
              )}
              {learnMoreTopic === "special" && (
                <p>
                  {t("host_safety_learn_special_p")}
                </p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setLearnMoreTopic(null)}
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs px-6 py-2 transition-all cursor-pointer"
              >
                {t("host_safety_close")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
