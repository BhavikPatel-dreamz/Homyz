"use client";

import React, { useEffect, useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useLanguage } from "@/lib/i18n/language-context";

export interface OrgStaysConfig {
  enabled: boolean;
  discountType: "FREE" | "DISCOUNT";
  discountPercentage: number;
}

interface AirbnbOrgStaysViewProps {
  listingId: string;
  discounts?: Record<string, unknown> | null;
  setActiveSection: (section: string) => void;
  onSave?: (config: OrgStaysConfig) => Promise<void>;
  isSaving?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function AirbnbOrgStaysView({
  listingId: _listingId,
  discounts,
  setActiveSection: _setActiveSection,
  onSave,
  isSaving = false,
  onDirtyChange,
}: AirbnbOrgStaysViewProps) {
  const { t } = useLanguage();

  // Extract initial values from listing discounts if present
  const initialConfig: OrgStaysConfig = React.useMemo(() => {
    const org = discounts?.orgStays as Record<string, unknown> | undefined;
    if (org && typeof org === "object") {
      return {
        enabled: Boolean(org.enabled),
        // `discountType` is the persisted field. Read the legacy `type`
        // field too, so settings saved by earlier versions still load.
        discountType:
          org.discountType === "DISCOUNT" || org.type === "DISCOUNT"
            ? "DISCOUNT"
            : "FREE",
        discountPercentage:
          Number(org.discountPercentage) ||
          (org.discountType === "DISCOUNT" || org.type === "DISCOUNT" ? 20 : 100),
      };
    }
    return {
      enabled: false,
      discountType: "FREE",
      discountPercentage: 100,
    };
  }, [discounts]);

  const [isEnabled, setIsEnabled] = useState(initialConfig.enabled);
  const [discountType, setDiscountType] = useState<"FREE" | "DISCOUNT">(initialConfig.discountType);
  const [discountPercentage, setDiscountPercentage] = useState(initialConfig.discountPercentage);
  const [prevConfig, setPrevConfig] = useState(initialConfig);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync local state during render when server-confirmed listing data changes
  if (prevConfig !== initialConfig) {
    setPrevConfig(initialConfig);
    setIsEnabled(initialConfig.enabled);
    setDiscountType(initialConfig.discountType);
    setDiscountPercentage(initialConfig.discountPercentage);
  }

  // Track if host has unsaved modifications
  const isDirty =
    isEnabled !== initialConfig.enabled ||
    (isEnabled && discountType !== initialConfig.discountType) ||
    (isEnabled && discountType === "DISCOUNT" && discountPercentage !== initialConfig.discountPercentage);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const handleToggle = () => {
    setIsEnabled((prev) => !prev);
    setIsSavedSuccess(false);
    setSaveError(null);
  };

  const handleCancel = () => {
    setIsEnabled(initialConfig.enabled);
    setDiscountType(initialConfig.discountType);
    setDiscountPercentage(initialConfig.discountPercentage);
    setSaveError(null);
    setIsSavedSuccess(false);
  };

  const handleSave = async () => {
    if (!isDirty && !isSavedSuccess) return;
    try {
      setSaveError(null);
      if (onSave) {
        await onSave({
          enabled: isEnabled,
          discountType,
          discountPercentage: discountType === "FREE" ? 100 : discountPercentage,
        });
      }
      setIsSavedSuccess(true);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to save homyz.org stays preferences:", e);
      setSaveError(e instanceof Error ? e.message : (t("host_org_stays_save_error") || "Unable to save preferences. Please try again."));
    }
  };

  return (
    <div className="max-w-2xl font-sans animate-in fade-in duration-200 pb-10 text-[#222222] dark:text-zinc-100">
      {/* 1. Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-[32px] font-semibold tracking-tight text-[#222222] dark:text-zinc-100 leading-tight">
          {t("host_org_stays_title") || "Homyz.com Stays"}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-normal mt-1">
          {t("host_org_stays_subtitle") || "Homyz.org stays"}
        </p>
      </div>

      {/* 1b. Informational Guidance Notice */}
      <div className="mb-6 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2 text-sm sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
        <p>
          {t("host_org_stays_notice_p1") || "This setting controls your listing's participation in Homyz.com emergency and humanitarian stays. When enabled, verified guests and vetted relief organizations can request temporary housing at your property for free or at a discount."}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("host_org_stays_notice_p2_part1") || "Turning this setting "}
          <strong className="text-zinc-700 dark:text-zinc-200">
            {isEnabled ? (t("host_org_stays_on_upper") || "ON") : (t("host_org_stays_off_upper") || "OFF")}
          </strong>
          {t("host_org_stays_notice_p2_part2") || " pauses your listing's enrollment in the program and may affect the listing's booking flow or available platform services for emergency relief stays. Regular guest bookings remain unaffected."}
        </p>
      </div>

      {/* 2. Main Brand Row & Toggle Switch with [ ON / OFF ] */}
      <div className="pt-2 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-semibold text-[#1F1F1F] dark:text-zinc-100 tracking-tight leading-none">
              {t("host_org_stays_brand_title") || "Homyz.com Stays"}
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold tracking-wide transition-colors ${isEnabled
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700"
                }`}
            >
              [ {isEnabled ? "ON" : "OFF"} ]
            </span>
          </div>
          <p className="text-sm text-[#E01563] dark:text-rose-400 font-semibold tracking-tight pt-0.5">
            {t("host_org_stays_brand_sub") || "Homyz.org"}
          </p>
          <p className="text-sm text-[#717171] dark:text-zinc-400 font-normal leading-normal">
            {t("host_org_stays_brand_desc") || "Available for Homyz.org guests for free or at a discount"}
          </p>
        </div>

        {/* Pill Toggle Switch */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 select-none">
            {isEnabled ? (t("host_org_stays_on_upper") || "ON") : (t("host_org_stays_off_upper") || "OFF")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={t("host_org_stays_switch_aria") || "Homyz.com Stays ON / OFF"}
            onClick={handleToggle}
            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${isEnabled ? "bg-[#222222] dark:bg-amber-400" : "bg-[#B0B0B0] dark:bg-zinc-700"
              }`}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white dark:bg-zinc-950 shadow-md ring-0 transition duration-200 ease-in-out ${isEnabled ? "translate-x-6" : "translate-x-0"
                }`}
            />
          </button>
        </div>
      </div>

      {/* 2b. Expandable Configuration Options (Visible when enabled) */}
      {isEnabled && (
        <div className="my-6 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-wide uppercase">
            {t("host_org_stays_participate_heading") || "How would you like to participate?"}
          </p>

          <div className="space-y-3">
            {/* Option A: Host for free */}
            <label
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${discountType === "FREE"
                  ? "border-zinc-900 dark:border-zinc-100 bg-white dark:bg-zinc-900 shadow-2xs"
                  : "border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
            >
              <input
                type="radio"
                name="discountType"
                checked={discountType === "FREE"}
                onChange={() => setDiscountType("FREE")}
                className="mt-0.5 accent-zinc-900 dark:accent-amber-400"
              />
              <div className="text-sm">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                  {t("host_org_stays_option_free_title") || "Host for free (100% discount)"}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed block mt-0.5">
                  {t("host_org_stays_option_free_desc") || "Offer free emergency stays to people evacuating disasters or refugees. You will receive $0 for the stay."}
                </span>
              </div>
            </label>

            {/* Option B: Host at a discount */}
            <label
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${discountType === "DISCOUNT"
                  ? "border-zinc-900 dark:border-zinc-100 bg-white dark:bg-zinc-900 shadow-2xs"
                  : "border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
            >
              <input
                type="radio"
                name="discountType"
                checked={discountType === "DISCOUNT"}
                onChange={() => setDiscountType("DISCOUNT")}
                className="mt-0.5 accent-zinc-900 dark:accent-amber-400"
              />
              <div className="text-sm flex-1">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                  {t("host_org_stays_option_discount_title") || "Host at a discount"}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed block mt-0.5">
                  {t("host_org_stays_option_discount_desc") || "Offer a discount off your standard nightly rate for verified homyz.org bookings."}
                </span>

                {discountType === "DISCOUNT" && (
                  <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium mr-1">
                      {t("host_org_stays_discount_pct_label") || "Discount percentage:"}
                    </span>
                    {[20, 30, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setDiscountPercentage(pct);
                        }}
                        className={`px-3 py-1 rounded-full text-sm font-semibold transition-all cursor-pointer ${discountPercentage === pct
                            ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          }`}
                      >
                        {t("host_org_stays_pct_off", { pct: String(pct) }) || `${pct}% off`}
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <input
                        type="number"
                        min="5"
                        max="95"
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(Math.max(5, Math.min(95, Number(e.target.value) || 20)))}
                        className="w-14 px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md text-center font-semibold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800"
                      />
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">%</span>
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>
      )}

      {/* 3. "How homyz.org stays work" Section */}
      <div className="mt-10 pt-2 space-y-4">
        <h3 className="text-base sm:text-lg font-semibold text-[#222222] dark:text-zinc-100 tracking-tight">
          {t("host_org_stays_how_it_works_heading") || "How homyz.org stays work"}
        </h3>

        <ul className="space-y-4 text-sm text-[#222222] dark:text-zinc-200 font-normal leading-relaxed list-none pl-0">
          <li className="flex items-start gap-2.5">
            <span className="text-zinc-800 dark:text-zinc-300 text-base leading-none select-none mt-1">•</span>
            <span>
              {t("host_org_stays_bullet1") || "When hosting for free or at a discount, you review each request before accepting, and declining a request won't affect your Superhost status."}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-zinc-800 dark:text-zinc-300 text-base leading-none select-none mt-1">•</span>
            <span>
              {t("host_org_stays_bullet2") || "homyz.org or its partner checks guests' eligibility."}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-zinc-800 dark:text-zinc-300 text-base leading-none select-none mt-1">•</span>
            <span>
              {t("host_org_stays_bullet3") || "homyz.org's partners may send requests on behalf of their clients."}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-zinc-800 dark:text-zinc-300 text-base leading-none select-none mt-1">•</span>
            <span>
              {t("host_org_stays_bullet4") || "Stays can vary in length from a few days to a few weeks."}
            </span>
          </li>
        </ul>

        {/* 4. Documented "Learn More" Actions */}
        <div className="pt-2 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setIsLearnMoreOpen(true)}
            aria-label={t("host_org_stays_learn_more_aria") || "Learn more about homyz.org"}
            className="text-sm sm:text-sm font-normal text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline cursor-pointer inline-flex items-center gap-1"
          >
            <span>{t("host_org_stays_learn_more") || "Learn More"}</span>{/* <span>Learn More</span> */}
            <span className="font-normal">&gt;</span>
          </button>
        </div>
      </div>

      {/* 5. Save & Cancel actions matching standard host editor Preferences pattern */}
      <div className="flex flex-wrap items-center gap-3 pt-8 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={handleSave}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] dark:bg-amber-400 dark:hover:bg-amber-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-semibold text-sm px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? (t("host_saving") || "Saving...") : isSavedSuccess ? (t("host_saved") || "Saved") : (t("host_save") || "Save")}
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleCancel}
          className="rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-sm px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {t("host_cancel") || "Cancel"}
        </button>

        {isSavedSuccess && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t("host_org_stays_saved_success") || "Saved successfully"}
          </span>
        )}
        {saveError && <p role="alert" className="text-sm font-medium text-rose-600 dark:text-rose-400">{saveError}</p>}
      </div>

      {/* 6. Centered Modal Dialog for "Learn more about homyz.org" (AGENTS.md ModalOverlay Compliant) */}
      {isLearnMoreOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        >
          {/* Backdrop Click Dismiss */}
          <div
            className="absolute inset-0"
            onClick={() => setIsLearnMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Centered Modal Container */}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="learn-more-org-title"
            className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm z-20 border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[#E01563] dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                  {t("host_org_stays_resource_centre") || "Resource Centre"}
                </span>
                <span className="text-sm text-zinc-400">·</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                  {t("host_org_stays_read_time") || "3 min read"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLearnMoreOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label={t("host_close") || "Close"}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 text-zinc-800 dark:text-zinc-200 text-sm leading-relaxed">
              <div>
                <h2 id="learn-more-org-title" className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-zinc-100 tracking-tight">
                  {t("host_org_stays_modal_title") || "About homyz.org and emergency stays"}
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1.5">
                  {t("host_org_stays_modal_subtitle") || "How our community opens its doors to people in times of crisis."}
                </p>
              </div>

              {/* Card 1: What is homyz.org */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 dark:text-zinc-100 font-semibold text-sm">
                  <span className="text-[#E01563] dark:text-rose-400 text-base">❤️</span>
                  <h4>{t("host_org_stays_card1_title") || "What is homyz.org?"}</h4>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {t("host_org_stays_card1_desc") || "homyz.org is an independent nonprofit organization that connects people in crisis with temporary emergency housing provided by hosts and funded by donors."}
                </p>
              </div>

              {/* Card 2: Guest Eligibility */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 dark:text-zinc-100 font-semibold text-sm">
                  <span className="text-indigo-600 dark:text-indigo-400 text-base">👥</span>
                  <h4>{t("host_org_stays_card2_title") || "Who stays with homyz.org?"}</h4>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {t("host_org_stays_card2_desc") || "Guests include individuals and families evacuated due to major natural disasters (wildfires, floods, earthquakes) or humanitarian crises (refugees and asylum seekers), as well as relief workers assisting on the ground."}
                </p>
              </div>

              {/* Card 3: Partner Vetting */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 dark:text-zinc-100 font-semibold text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400 text-base">🏛️</span>
                  <h4>{t("host_org_stays_card3_title") || "Vetted humanitarian partners"}</h4>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {t("host_org_stays_card3_desc") || "homyz.org works with established humanitarian organizations such as the International Rescue Committee (IRC), CORE, and GlobalGiving. These organizations assess guest eligibility and frequently manage reservations on behalf of their clients."}
                </p>
              </div>

              {/* Card 4: Host Protection */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 dark:text-zinc-100 font-semibold text-sm">
                  <span className="text-amber-600 dark:text-amber-400 text-base">🛡️</span>
                  <h4>{t("host_org_stays_card4_title") || "Host Protection for emergency stays"}</h4>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {t("host_org_stays_card4_desc") || "Every homyz.org stay includes comprehensive Host damage protection up to $1,000,000 USD and liability insurance, giving you total peace of mind whenever you host."}
                </p>
              </div>

              {/* Card 5: Your Host Control */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 dark:text-zinc-100 font-semibold text-sm">
                  <span className="text-blue-600 dark:text-blue-400 text-base">ℹ️</span>
                  <h4>{t("host_org_stays_card5_title") || "Full control over every request"}</h4>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {t("host_org_stays_card5_desc") || "You are always in control. You review each homyz.org stay request individually before accepting. If you are unable to accommodate a request, declining will never affect your Superhost status or search performance."}
                </p>
              </div>

              {/* Official Link */}
              <div className="pt-2">
                <a
                  href="https://www.homyz.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#E01563] dark:text-rose-400 hover:underline"
                >
                  <span>{t("host_org_stays_visit_website") || "Visit official homyz.org website"}</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsLearnMoreOpen(false)}
                className="px-6 py-2.5 rounded-full bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                {t("header_done") || "Done"}
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}
    </div>
  );
}
