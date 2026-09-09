"use client";

import React, { useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";

export interface OrgStaysConfig {
  enabled: boolean;
  discountType: "FREE" | "DISCOUNT";
  discountPercentage: number;
}

interface AirbnbOrgStaysViewProps {
  listingId: string;
  discounts?: any;
  setActiveSection: (section: any) => void;
  onSave?: (config: OrgStaysConfig) => Promise<void>;
  isSaving?: boolean;
}

export function AirbnbOrgStaysView({
  listingId: _listingId,
  discounts,
  setActiveSection: _setActiveSection,
  onSave,
  isSaving = false,
}: AirbnbOrgStaysViewProps) {
  // Extract initial values from listing discounts if present
  const initialConfig: OrgStaysConfig = React.useMemo(() => {
    const org = discounts?.orgStays;
    if (org && typeof org === "object") {
      return {
        enabled: Boolean(org.enabled),
        discountType: org.type === "DISCOUNT" ? "DISCOUNT" : "FREE",
        discountPercentage: Number(org.discountPercentage) || (org.type === "DISCOUNT" ? 20 : 100),
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
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  // Track if host has unsaved modifications
  const isDirty =
    isEnabled !== initialConfig.enabled ||
    (isEnabled && discountType !== initialConfig.discountType) ||
    (isEnabled && discountType === "DISCOUNT" && discountPercentage !== initialConfig.discountPercentage);

  const handleToggle = () => {
    setIsEnabled((prev) => !prev);
    setIsSavedSuccess(false);
  };

  const handleSave = async () => {
    if (!isDirty && !isSavedSuccess) return;
    try {
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
    }
  };

  return (
    <div className="max-w-2xl font-sans animate-in fade-in duration-200 pb-28 text-[#222222]">
      {/* 1. Page Title */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-[#222222] leading-tight">
          Homyz.org stays
        </h1>
      </div>

      {/* 2. Main Brand Row & iOS Toggle Switch */}
      <div className="pt-2 pb-6 flex items-start justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-[22px] font-bold text-[#E01563] tracking-tight leading-none">
            Homyz.org
          </h2>
          <p className="text-sm text-[#717171] font-normal leading-normal pt-1">
            Available for Homyz.org guests for free or at a discount
          </p>
        </div>

        {/* Pill Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={handleToggle}
          className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
            isEnabled ? "bg-[#222222]" : "bg-[#B0B0B0]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isEnabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* 2b. Expandable Configuration Options (Visible when enabled) */}
      {isEnabled && (
        <div className="my-6 p-5 rounded-2xl border border-zinc-200 bg-zinc-50/70 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-semibold text-zinc-900 tracking-wide uppercase">
            How would you like to participate?
          </p>

          <div className="space-y-3">
            {/* Option A: Host for free */}
            <label
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                discountType === "FREE"
                  ? "border-zinc-900 bg-white shadow-2xs"
                  : "border-zinc-200 bg-white/60 hover:border-zinc-300"
              }`}
            >
              <input
                type="radio"
                name="discountType"
                checked={discountType === "FREE"}
                onChange={() => setDiscountType("FREE")}
                className="mt-0.5 accent-zinc-900"
              />
              <div className="text-xs">
                <span className="font-semibold text-zinc-900 block">
                  Host for free (100% discount)
                </span>
                <span className="text-zinc-500 font-normal leading-relaxed block mt-0.5">
                  Offer free emergency stays to people evacuating disasters or refugees. You will receive $0 for the stay.
                </span>
              </div>
            </label>

            {/* Option B: Host at a discount */}
            <label
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                discountType === "DISCOUNT"
                  ? "border-zinc-900 bg-white shadow-2xs"
                  : "border-zinc-200 bg-white/60 hover:border-zinc-300"
              }`}
            >
              <input
                type="radio"
                name="discountType"
                checked={discountType === "DISCOUNT"}
                onChange={() => setDiscountType("DISCOUNT")}
                className="mt-0.5 accent-zinc-900"
              />
              <div className="text-xs flex-1">
                <span className="font-semibold text-zinc-900 block">
                  Host at a discount
                </span>
                <span className="text-zinc-500 font-normal leading-relaxed block mt-0.5">
                  Offer a discount off your standard nightly rate for verified homyz.org bookings.
                </span>

                {discountType === "DISCOUNT" && (
                  <div className="mt-3.5 pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-700 font-medium mr-1">
                      Discount percentage:
                    </span>
                    {[20, 30, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setDiscountPercentage(pct);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          discountPercentage === pct
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        {pct}% off
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <input
                        type="number"
                        min="5"
                        max="95"
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(Math.max(5, Math.min(95, Number(e.target.value) || 20)))}
                        className="w-14 px-2 py-1 text-xs border border-zinc-300 rounded-md text-center font-semibold"
                      />
                      <span className="text-xs text-zinc-500">%</span>
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
        <h3 className="text-base sm:text-[18px] font-bold text-[#222222] tracking-tight">
          How homyz.org stays work
        </h3>

        <ul className="space-y-4 text-sm text-[#222222] font-normal leading-relaxed list-none pl-0">
          <li className="flex items-start gap-2.5">
            <span className="text-zinc-800 text-base leading-none select-none mt-1">•</span>
            <span>
              When hosting for free or at a discount, you review each request before accepting, and declining a request won&apos;t affect your Superhost status.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-zinc-800 text-base leading-none select-none mt-1">•</span>
            <span>
              homyz.org or its partner checks guests&apos; eligibility.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-zinc-800 text-base leading-none select-none mt-1">•</span>
            <span>
              homyz.org&apos;s partners may send requests on behalf of their clients.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="text-zinc-800 text-base leading-none select-none mt-1">•</span>
            <span>
              Stays can vary in length from a few days to a few weeks.
            </span>
          </li>
        </ul>

        {/* 4. "Learn more about homyz.org >" Link */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsLearnMoreOpen(true)}
            className="text-sm font-semibold text-[#222222] hover:underline cursor-pointer inline-flex items-center gap-1 group"
          >
            <span>Learn more about homyz.org</span>
            <span className="transition-transform group-hover:translate-x-0.5 select-none font-normal">
              &gt;
            </span>
          </button>
        </div>
      </div>

      {/* 5. Fixed Bottom Right Save Button (Matches homyz UI exactly) */}
      <div className="fixed bottom-0 right-0 left-0 md:left-80 bg-white/95 backdrop-blur-xs border-t border-zinc-200 px-6 sm:px-12 py-4 flex items-center justify-end z-20">
        <div className="flex items-center gap-3">
          {isSavedSuccess && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved successfully
            </span>
          )}
          <button
            type="button"
            disabled={!isDirty || isSaving}
            onClick={handleSave}
            className={`font-semibold text-sm px-6 py-2.5 rounded-lg transition-all duration-150 cursor-pointer ${
              isDirty && !isSaving
                ? "bg-[#222222] hover:bg-black text-white shadow-xs"
                : "bg-[#EBEBEB] text-[#B0B0B0] cursor-not-allowed"
            }`}
          >
            {isSaving ? "Saving..." : isSavedSuccess ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {/* 6. Slide-Over Drawer for "Learn more about homyz.org" (AGENTS.md ModalOverlay Compliant) */}
      {isLearnMoreOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end"
          onClick={() => setIsLearnMoreOpen(false)}
        >
          <div
            className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-[#E01563] border border-rose-200">
                  Resource Centre
                </span>
                <span className="text-xs text-zinc-400">·</span>
                <span className="text-xs text-zinc-500 font-medium">3 min read</span>
              </div>
              <button
                type="button"
                onClick={() => setIsLearnMoreOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 text-zinc-800 text-sm leading-relaxed">
              <div>
                <h2 className="text-2xl font-bold text-zinc-950 tracking-tight">
                  About homyz.org and emergency stays
                </h2>
                <p className="text-zinc-500 text-xs mt-1.5">
                  How our community opens its doors to people in times of crisis.
                </p>
              </div>

              {/* Card 1: What is homyz.org */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 font-semibold">
                  <span className="text-[#E01563] text-base">❤️</span>
                  <h4>What is homyz.org?</h4>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  homyz.org is an independent nonprofit organization that connects people in crisis with temporary emergency housing provided by hosts and funded by donors.
                </p>
              </div>

              {/* Card 2: Guest Eligibility */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 font-semibold">
                  <span className="text-indigo-600 text-base">👥</span>
                  <h4>Who stays with homyz.org?</h4>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Guests include individuals and families evacuated due to major natural disasters (wildfires, floods, earthquakes) or humanitarian crises (refugees and asylum seekers), as well as relief workers assisting on the ground.
                </p>
              </div>

              {/* Card 3: Partner Vetting */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 font-semibold">
                  <span className="text-emerald-600 text-base">🏛️</span>
                  <h4>Vetted humanitarian partners</h4>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  homyz.org works with established humanitarian organizations such as the International Rescue Committee (IRC), CORE, and GlobalGiving. These organizations assess guest eligibility and frequently manage reservations on behalf of their clients.
                </p>
              </div>

              {/* Card 4: Host Protection */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 font-semibold">
                  <span className="text-amber-600 text-base">🛡️</span>
                  <h4>Host Protection for emergency stays</h4>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Every homyz.org stay includes comprehensive Host damage protection up to $1,000,000 USD and liability insurance, giving you total peace of mind whenever you host.
                </p>
              </div>

              {/* Card 5: Your Host Control */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="flex items-center gap-2 text-zinc-950 font-semibold">
                  <span className="text-blue-600 text-base">ℹ️</span>
                  <h4>Full control over every request</h4>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  You are always in control. You review each homyz.org stay request individually before accepting. If you are unable to accommodate a request, declining will never affect your Superhost status or search performance.
                </p>
              </div>

              {/* Official Link */}
              <div className="pt-2">
                <a
                  href="https://www.homyz.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#E01563] hover:underline"
                >
                  <span>Visit official homyz.org website</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsLearnMoreOpen(false)}
                className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

