"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy editor props */

import React from "react";
import { RealMap } from "@/components/ui/real-map";
import { getAmenityMeta } from "@/lib/constants/amenities";
import { formatTimeDisplay } from "../section-helpers";
import {
  normalizeAccessibilityFeatureDetails,
  normalizeAccessibilityFeatureIds,
  type AccessibilityFeatureDetail,
} from "@/lib/constants/listing-enums";

const ACCESSIBILITY_FEATURE_LABELS: Record<string, string> = {
  accessible_parking: "Accessible parking spot",
  lit_path: "Lit path to entrance",
  step_free_access: "Step-free access",
  wide_entrance: "Guest entrance wider than 32 in",
  pool_hoist: "Pool or hot tub hoist",
  ceiling_hoist: "Ceiling or mobile hoist",
};

interface EditorSidebarProps {
  editorTab: "space" | "arrival" | "preferences";
  setEditorTab: (tab: "space" | "arrival" | "preferences") => void;
  activeSection: string;
  setActiveSection: (section: any) => void;
  editTitle: string;
  editListingType: string;
  editPropertyType: string;
  editPrice: number;
  smartPricing?: boolean;
  smartPricingMinPrice?: number;
  smartPricingMaxPrice?: number;
  weeklyDiscount: number;
  monthlyDiscount: number;
  minNights: number;
  maxNights: number;
  advanceNotice?: string;
  sameDayCutoff?: string;
  allowSameDayRequests?: boolean;
  accessibilityFeatures?: string[];
  accessibilityDetails?: AccessibilityFeatureDetail[];
  editGuests: number;
  editDescription: string;
  editAmenities: string[];
  editPhotos: string[];
  editAddress: string;
  editCity: string;
  editCountry: string;
  showExactLocation: boolean;
  listing: any;
  coHosts: Array<{ id: string; email: string | null; status: string; user: { name: string | null; image: string | null } | null }>;
  bookingMethod: "first-three" | "instant" | "approve";
  requireGoodTrackRecord?: boolean;
  checkInStart: string;
  checkOutTime: string;
  maxGuestsCount: number;
  petsAllowed?: boolean | null;
  maxPetsCount?: number;
  eventsAllowed?: boolean | null;
  smokingAllowed?: boolean | null;
  quietHours?: boolean | null;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  commercialFilmingAllowed?: boolean | null;
  additionalHouseRules?: string;
  carbonMonoxideAlarm: boolean;
  smokeAlarm: boolean;
  cancellationPolicy: string;
  customSlug?: string;
  checkInMethod: string;
  checkInEnd: string;
  wifiNetwork: string;
  houseManual: string;
  directions?: string;
  editBedrooms?: number;
  editBeds?: number;
  parkingAvailable?: boolean;
  parkingType?: string;
  setIsRemoveListingModalOpen?: (open: boolean) => void;
}

export function EditorSidebar({
  editorTab,
  setEditorTab,
  activeSection,
  setActiveSection,
  editTitle,
  editListingType,
  editPropertyType,
  editPrice,
  smartPricing = false,
  smartPricingMinPrice = 0,
  smartPricingMaxPrice = 0,
  weeklyDiscount,
  monthlyDiscount,
  minNights,
  maxNights,
  advanceNotice = "Same day",
  sameDayCutoff = "12:00 AM",
  allowSameDayRequests = true,
  accessibilityFeatures = [],
  accessibilityDetails = [],
  editGuests,
  editDescription,
  editAmenities,
  editPhotos,
  editAddress,
  editCity,
  editCountry,
  showExactLocation,
  listing,
  coHosts,
  bookingMethod,
  requireGoodTrackRecord = false,
  checkInStart,
  checkOutTime,
  maxGuestsCount,
  petsAllowed = null,
  maxPetsCount = 1,
  eventsAllowed = null,
  smokingAllowed = null,
  quietHours = null,
  quietHoursStart = "22:00",
  quietHoursEnd = "08:00",
  commercialFilmingAllowed = null,
  additionalHouseRules = "",
  carbonMonoxideAlarm,
  smokeAlarm,
  cancellationPolicy,
  customSlug = "",
  checkInMethod,
  checkInEnd,
  wifiNetwork,
  houseManual,
  directions = "",
  editBedrooms = 1,
  editBeds = 1,
  parkingAvailable = false,
  parkingType = "Free",
  setIsRemoveListingModalOpen,
}: EditorSidebarProps) {
  const selectedAccessibilityFeatures = normalizeAccessibilityFeatureIds(accessibilityFeatures);
  const accessibilityDetailsByFeature = new Map(
    normalizeAccessibilityFeatureDetails(accessibilityDetails).map((detail) => [detail.featureId, detail]),
  );
  const confirmedAccessibilityFeatures = selectedAccessibilityFeatures.filter(
    (featureId) => (accessibilityDetailsByFeature.get(featureId)?.photos.length ?? 0) > 0,
  );
  const acceptedCoHostCount = coHosts.filter((item) => item.status === "ACCEPTED").length;
  const pendingCoHostCount = coHosts.filter((item) => item.status === "PENDING").length;
  const coHostSummary = acceptedCoHostCount > 0
    ? `${acceptedCoHostCount} co-host${acceptedCoHostCount === 1 ? "" : "s"}${pendingCoHostCount ? ` · ${pendingCoHostCount} pending` : ""}`
    : pendingCoHostCount > 0
      ? `${pendingCoHostCount} pending invitation${pendingCoHostCount === 1 ? "" : "s"}`
      : "";
  const extraHouseRules = [
    petsAllowed !== null && petsAllowed !== undefined ? (petsAllowed ? `Pets allowed (up to ${maxPetsCount || 1})` : "No pets") : null,
    eventsAllowed !== null && eventsAllowed !== undefined ? (eventsAllowed ? "Events allowed" : "No events or parties") : null,
    smokingAllowed !== null && smokingAllowed !== undefined ? (smokingAllowed ? "Smoking allowed" : "No smoking") : null,
    quietHours === true ? `Quiet hours ${formatTimeDisplay(quietHoursStart, "11:00 pm")}–${formatTimeDisplay(quietHoursEnd, "7:00 am")}` : (quietHours === false ? "No quiet hours" : null),
    commercialFilmingAllowed !== null && commercialFilmingAllowed !== undefined ? (commercialFilmingAllowed ? "Commercial filming allowed" : "No commercial filming") : null,
    additionalHouseRules?.trim() ? "Additional house rules" : null,
  ].filter(Boolean);
  return (
    <aside className="lg:col-span-4 xl:col-span-4 flex min-w-0 flex-col lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)]">
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-6 flex flex-col shadow-xs overflow-hidden max-h-[calc(100vh-6rem)]">
        {/* Header Title (Matches Figma: "Edit preferences" when gear active, else "Listing editor") */}
        <div className="flex items-center justify-between pb-3 shrink-0">
          <h2 className="text-xl font-semibold tracking-tight text-[#1F1F1F]">
            {editorTab === "preferences" ? "Edit preferences" : "Listing editor"}
          </h2>
        </div>

        {/* Sub-Pills: [Your space] [Arrival guide] ⚙️ (Fixed) */}
        <div className="flex items-center gap-2 pb-4 shrink-0 border-b border-zinc-200/60 mb-3">
          <button
            type="button"
            onClick={() => {
              setEditorTab("space");
              setActiveSection("description");
            }}
            className={`rounded-full font-semibold text-xs px-4 py-1.5 transition-all cursor-pointer ${
              editorTab === "space"
                ? "bg-[#FEE08B] text-zinc-950 shadow-2xs border border-amber-300"
                : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            Your space
          </button>

          <button
            type="button"
            onClick={() => {
              setEditorTab("arrival");
              setActiveSection("check-in-out");
            }}
            className={`rounded-full font-semibold text-xs px-4 py-1.5 transition-all cursor-pointer ${
              editorTab === "arrival"
                ? "bg-[#FEE08B] text-zinc-950 shadow-2xs border border-amber-300"
                : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            Arrival guide
          </button>

          <button
            type="button"
            onClick={() => {
              setEditorTab("preferences");
              setActiveSection("listing-status");
            }}
            className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs transition-all cursor-pointer ${
              editorTab === "preferences"
                ? "bg-[#FEE08B] border-amber-300 shadow-2xs text-zinc-950"
                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            ⚙️
          </button>
        </div>

        {/* Scrollable Sidebar Content Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 custom-scrollbar">
          {/* Preferences Cards Stack */}
          {editorTab === "preferences" ? (
            <div className="space-y-3">
              {/* Card 1: Listing status */}
              <div
                onClick={() => setActiveSection("listing-status")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "listing-status" || activeSection === "listingstatus"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-1">
                  Listing status
                </span>
                {(() => {
                  const isListed = Boolean(listing?.published && listing?.status === "ACTIVE" && !listing?.isPaused);
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        isListed
                          ? "text-emerald-700 bg-emerald-100/70"
                          : "text-amber-700 bg-amber-100/70"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isListed ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {isListed ? "listed" : "unlisted"}
                    </span>
                  );
                })()}
              </div>

              {/* Card 2: Languages */}
              <div
                onClick={() => setActiveSection("language")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
                  activeSection === "language" || activeSection === "languages"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                    Languages
                  </span>
                  <p className="text-[11px] text-zinc-500 font-normal">
                    English
                  </p>
                </div>
                <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
              </div>

              {/* Card 3: Guest requirements */}
              <div
                onClick={() => setActiveSection("guest-requirements")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
                  activeSection === "guest-requirements" || activeSection === "guestrequirements"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                    Guest requirements
                  </span>
                  <p className="text-[11px] text-zinc-500 font-normal">
                    Profile photo not required
                  </p>
                </div>
                <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
              </div>

              {/* Card 4: Local laws */}
              <div
                onClick={() => setActiveSection("local-laws")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
                  activeSection === "local-laws" || activeSection === "locallaws"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                    Local laws
                  </span>
                  <p className="text-[11px] text-zinc-500 font-normal">
                    Review your local laws
                  </p>
                </div>
                <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
              </div>

              {/* Card 5: Regulations */}
              <div
                onClick={() => setActiveSection("regulations")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
                  activeSection === "regulations"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                    Regulations
                  </span>
                </div>
                <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
              </div>

              {/* Card 6: Taxes */}
              <div
                onClick={() => setActiveSection("taxes")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
                  activeSection === "taxes"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                    Taxes
                  </span>
                  <p className="text-[11px] text-zinc-500 font-normal">
                    Learn how taxes work for Hosts
                  </p>
                </div>
                <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
              </div>

              {/* Card 7: homyz.org stays */}
              <div
                onClick={() => setActiveSection("homyz-org-stays")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
                  activeSection === "airbnb-org-stays" ||
                  activeSection === "homyz-stays" ||
                  activeSection === "homyzstays"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                    homyz.org stays
                  </span>
                  <p className="text-[11px] text-zinc-500 font-normal">
                    Learn how you can help
                  </p>
                </div>
                <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
              </div>

              {/* Card 8: Remove listing */}
              <div
                onClick={() => {
                  setActiveSection("remove-listing");
                  setIsRemoveListingModalOpen?.(true);
                }}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
                  activeSection === "remove-listing" || activeSection === "removelisting"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                    Remove listing
                  </span>
                  <p className="text-[11px] text-zinc-500 font-normal">
                    Permanently remove your listing
                  </p>
                </div>
                <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
              </div>
            </div>
          ) : editorTab === "space" ? (
            <div className="space-y-3">
              {/* Photo Card Stack Preview (Only shown under "Your space") */}
              {activeSection !== "about-host" && (
              <div
                onClick={() => setActiveSection("photos")}
                className="relative cursor-pointer group my-2 p-3"
              >
                <div className="absolute inset-0 translate-x-1.25 -translate-y-0.5 rounded-2xl border border-zinc-200 bg-white shadow-2xs" />

                <div className="relative aspect-[16/7] rounded-2xl overflow-hidden border border-zinc-300 bg-zinc-100 shadow-xs flex items-center justify-center">
                  {editPhotos.length > 0 ? (
                    <img
                      src={editPhotos[0]}
                      alt="Property cover"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                      <span className="text-2xl mb-1">🏡</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/15 flex items-center justify-center">
                    <span className="bg-white/95 backdrop-blur-md text-[#1F1F1F] text-[11px] font-semibold px-3.5 py-1.5 rounded-xl shadow-xs border border-white/60">
              {editPhotos.length} photos
                    </span>
                  </div>
                </div>
              </div>
              )}
              {/* 1. Title */}
              <div
                onClick={() => setActiveSection("title")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "title"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Title
                </span>
                <span className="text-xs font-semibold text-[#1F1F1F] block truncate">
                  {editTitle || "Property Name"}
                </span>
              </div>

              {/* 2. Property type */}
              <div
                onClick={() => setActiveSection("propertyType")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "propertyType"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Property type
                </span>
                <span className="text-xs font-semibold text-[#1F1F1F] block">
                  {editListingType} · {editPropertyType}
                </span>
              </div>

              {/* 3. Pricing */}
              <div
                onClick={() => setActiveSection("pricing")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "pricing"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Pricing
                </span>
                <div className="text-xs text-zinc-800 space-y-0.5">
                  {smartPricing ? (
                    <>
                      <p className="font-semibold text-[#1F1F1F]">Smart pricing</p>
                      <p className="text-[11px] text-zinc-500">
                        SR{smartPricingMinPrice} – SR{smartPricingMaxPrice}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-[#1F1F1F]">SR{editPrice}</p>
                      <p className="text-[11px] text-zinc-500">{weeklyDiscount}% weekly discount</p>
                      <p className="text-[11px] text-zinc-500">{monthlyDiscount}% monthly discount</p>
                    </>
                  )}
                </div>
              </div>

              {/* 4. Availability */}
              <div
                onClick={() => setActiveSection("availability")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "availability"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Availability
                </span>
                <div className="text-xs text-zinc-800 space-y-0.5">
                  <p className="font-semibold text-[#1F1F1F]">
                    {minNights}-{maxNights} night stays
                  </p>
                  <p className="text-[11px] text-zinc-500">{advanceNotice} notice</p>
                  <p className="text-[11px] text-zinc-500">
                    {allowSameDayRequests ? `Same-day requests until ${sameDayCutoff}` : "Same-day requests unavailable"}
                  </p>
                </div>
              </div>

              {/* 5. Number of guests */}
              <div
                onClick={() => setActiveSection("guests")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "guests"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Number of guests
                </span>
                <span className="text-xs font-semibold text-[#1F1F1F] block">
                  {editGuests} guests
                </span>
              </div>

              {/* 5b. Sleeping arrangements */}
              <div
                onClick={() => setActiveSection("sleeping-arrangements")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "sleeping-arrangements"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Sleeping arrangements
                </span>
                <span className="text-xs font-semibold text-[#1F1F1F] block">
                  {editBedrooms || 1} {editBedrooms === 1 ? "bedroom" : "bedrooms"} · {editBeds || 1} {editBeds === 1 ? "bed" : "beds"}
                </span>
              </div>

              {/* 6. Description */}
              <div
                onClick={() => setActiveSection("description")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "description"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Description
                </span>
                <p className="text-xs text-zinc-600 line-clamp-3 leading-relaxed">
                  {editDescription || "No description provided yet."}
                </p>
              </div>

              {/* 7. Amenities */}
              <div
                onClick={() => setActiveSection("amenities")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "amenities" || activeSection === "add-amenities"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                  Amenities
                </span>
                <div className="space-y-1.5 text-xs text-zinc-800">
                  {editAmenities.length === 0 ? (
                    <span className="text-xs text-zinc-400 font-medium">Add amenities</span>
                  ) : (
                    <>
                      {editAmenities.slice(0, 3).map((am, i) => {
                        const meta = getAmenityMeta(am);
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs">{meta.icon || "✨"}</span>
                            <span className="font-semibold text-zinc-800">{meta.label}</span>
                          </div>
                        );
                      })}
                      {editAmenities.length > 3 && (
                        <span className="text-[10px] font-semibold text-zinc-400 block pt-0.5">
                          +{editAmenities.length - 3} more
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 8. Accessibility features */}
              <div
                onClick={() => setActiveSection("accessibility")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "accessibility"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Accessibility features
                </span>
                {confirmedAccessibilityFeatures.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {confirmedAccessibilityFeatures.map((featureId) => {
                      const detail = accessibilityDetailsByFeature.get(featureId);
                      const photo = detail?.photos[0];
                      return (
                        <div key={featureId} className="flex items-center gap-2 text-[11px] text-zinc-700">
                          {photo ? (
                            <img src={photo} alt="" className="h-7 w-7 rounded-md border border-zinc-200 object-cover" />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-[10px] text-amber-700">!</span>
                          )}
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {ACCESSIBILITY_FEATURE_LABELS[featureId] ?? featureId.replace(/_/g, " ")}
                          </span>
                          <span className="shrink-0 text-[10px] text-zinc-400">{detail?.photos.length ?? 0} photo{detail?.photos.length === 1 ? "" : "s"}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-400 font-medium">Add details</span>
                )}
              </div>

              {/* 9. Location */}
              <div
                onClick={() => setActiveSection("location")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "location"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-2">Location</span>
                <RealMap
                  address={editAddress}
                  city={editCity}
                  country={editCountry}
                  showExactLocation={showExactLocation}
                  className="rounded-xl overflow-hidden border border-zinc-200/80 relative h-24 mb-2.5 pointer-events-none"
                />
                <span className="text-[11px] font-medium text-zinc-500 block truncate">
                  {editAddress
                    ? `${editAddress}, ${editCity}, ${editCountry}`
                    : "Location name, Postal Code, Country"}
                </span>
              </div>

              {/* 10. About the host (Exact Figma Split Layout) */}
              <div
                onClick={() => setActiveSection("about-host")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "about-host"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-3">About the host</span>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center text-center space-y-1 pr-2">
                    {listing.host?.image ? <img src={listing.host.image} alt="Host profile" className="w-14 h-14 rounded-full object-cover border border-zinc-200 shadow-2xs" /> : <div className="w-14 h-14 rounded-full border border-amber-200 bg-amber-100 text-amber-900 flex items-center justify-center font-semibold">{(listing.host?.name || "Host").split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase()}</div>}
                    <h4 className="text-xs font-semibold text-[#1F1F1F] leading-tight">{listing.host?.name || "Host"}</h4>
                  </div>
                  <div className="flex-1 pl-4 text-center">
                    <span className="text-xs font-semibold text-[#1F1F1F] block leading-tight">{listing.host?.createdAt ? Math.max(0, new Date().getFullYear() - new Date(listing.host.createdAt).getFullYear()) : 0}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">years hosting</span>
                  </div>
                </div>
              </div>

              {/* 11. Co-host */}
              <div
                onClick={() => {
                  setActiveSection("co-host");
                }}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "co-host"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#1F1F1F] block">Co-host</span>
                  {coHostSummary && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                      {coHostSummary}
                    </span>
                  )}
                </div>
                {coHosts.filter((item) => item.status === "PENDING" || item.status === "ACCEPTED").length > 0 ? (
                  <div className="text-[11px] text-zinc-700 font-medium space-y-0.5 pt-0.5">
                    {coHosts.filter((item) => item.status === "PENDING" || item.status === "ACCEPTED").map((ch) => (
                      <p key={ch.id} className="truncate">
                        • {ch.user?.name || ch.email} ({ch.status.toLowerCase()})
                      </p>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-400 font-medium block">Add details</span>
                )}
              </div>

              {/* 12. Booking settings */}
              <div
                onClick={() => setActiveSection("booking-settings")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "booking-settings"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  Booking settings
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {bookingMethod === "first-three"
                    ? "Approve your first 3 bookings"
                    : bookingMethod === "instant"
                    ? requireGoodTrackRecord ? "Instant Book · track record required" : "Use Instant Book"
                    : "Approve all bookings"}
                </p>
              </div>

              {/* 13. House rules */}
              <div
                onClick={() => setActiveSection("house-rules")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "house-rules"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-sm font-semibold text-[#1F1F1F] block mb-3">House rules</span>
                <div className="space-y-3 text-xs text-zinc-800 font-normal">
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-zinc-800 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Check-in after {formatTimeDisplay(checkInStart, "3:00 pm")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-zinc-800 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Checkout before {formatTimeDisplay(checkOutTime, "6:00 pm")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-zinc-800 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>
                      {maxGuestsCount || editGuests || 1} guest{(maxGuestsCount || editGuests || 1) === 1 ? "" : "s"} maximum
                    </span>
                  </div>
                  {extraHouseRules.length > 0 && (
                    <p className="pt-1.5 text-xs text-zinc-500 font-normal">+{extraHouseRules.length} more</p>
                  )}
                </div>
              </div>

              {/* 14. Guests safety */}
              <div
                onClick={() => setActiveSection("guests-safety")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "guests-safety"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-2.5">Guests safety</span>
                <div className="space-y-2 text-[11px] text-zinc-700 font-medium">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M12 3v1.5M15.75 3v1.5M12 7.5A4.5 4.5 0 007.5 12v3h9v-3A4.5 4.5 0 0012 7.5zM6 19.5h12" />
                      </svg>
                    </div>
                    <span className="text-zinc-700 text-[11px] font-medium leading-tight">
                      {carbonMonoxideAlarm
                        ? "Carbon monoxide alarm reported"
                        : "Carbon monoxide alarm not reported"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364l-2.121 2.121M7.757 16.243l-2.121 2.121m12.728 0l-2.121-2.121M7.757 7.757L5.636 5.636" />
                      </svg>
                    </div>
                    <span className="text-zinc-700 text-[11px] font-medium leading-tight">
                      {smokeAlarm ? "Smoke alarm installed" : "Smoke alarm not reported"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 15. Cancellation policy */}
              <div
                onClick={() => setActiveSection("cancellation-policy")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "cancellation-policy"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  Cancellation policy
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">{cancellationPolicy}</p>
              </div>

              {/* 16. Custom link */}
              <div
                onClick={() => setActiveSection("custom-link")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "custom-link"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  Custom link
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {customSlug ? `homyz/${customSlug}` : "Add details"}
                </p>
              </div>
            </div>
          ) : (
            /* Arrival Guide Mode Sidebar Items (Matches Figma Screenshot 100%) */
            <div className="space-y-3">
              {/* Card 1: Check-in and check-out */}
              <button
                type="button"
                onClick={() => setActiveSection("check-in-out")}
                aria-current={activeSection === "check-in-out" || activeSection === "arrival-guide" ? "page" : undefined}
                className={`w-full rounded-2xl border p-4 text-left shadow-2xs transition-all ${
                  activeSection === "check-in-out" || activeSection === "arrival-guide"
                    ? "border-indigo-200 bg-[#ECE9FE]"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <span className="mb-1 block text-xs font-semibold text-[#1F1F1F]">Check-in</span>
                <span className="block border-b border-zinc-300 pb-2 text-[11px] text-zinc-600">{checkInStart || "3:00 PM"}</span>
                <span className="mt-2 block text-xs font-semibold text-[#1F1F1F]">Check-out</span>
                <span className="block text-[11px] text-zinc-600">{checkOutTime || "12:00 PM"}</span>
              </button>

              {/* Card 2: Check-in method */}
              <div
                onClick={() => setActiveSection("check-in-method")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "check-in-method"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  Check-in method
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {checkInMethod === "SMART_LOCK" || checkInMethod === "Smart lock" ? "Smart lock" : checkInMethod || "Smart lock"}
                </p>
              </div>

              {/* Card 2: Wifi details */}
              <div
                onClick={() => setActiveSection("wifi-details")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "wifi-details"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  Wifi details
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {wifiNetwork ? wifiNetwork : "Add details"}
                </p>
              </div>

              {/* Card 3: House manual */}
              <div
                onClick={() => setActiveSection("house-manual")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "house-manual"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  House manual
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {houseManual ? houseManual.slice(0, 30) + "..." : "Add details"}
                </p>
              </div>

              {/* Card 3b: Parking */}
              <div
                onClick={() => setActiveSection("parking")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "parking"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  Parking
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {parkingAvailable ? `${parkingType || "Free"} parking` : "No parking specified"}
                </p>
              </div>

              {/* Card 5: Check-out instructions */}
              <div
                onClick={() => setActiveSection("checkout-instructions")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "checkout-instructions" ||
                  activeSection === "check-out-instructions" ||
                  activeSection === "checkout" ||
                  activeSection === "check-out"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  Check-out instructions
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  Add details
                </p>
              </div>

              {/* Card 6: Guidebooks */}
              <div
                onClick={() => setActiveSection("guidebooks")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "guidebooks" || activeSection === "guidebook"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  Guidebooks
                </span>
                <p className="text-[11px] text-zinc-500 font-normal line-clamp-2 leading-relaxed">
                  Create a guidebook to share your location tips with guests.
                </p>
              </div>

              {/* Card 7: Interaction preferences (Matches Figma Screenshot 100%) */}
              <div
                onClick={() => setActiveSection("interaction-preferences")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "interaction-preferences" ||
                  activeSection === "interactionpreferences" ||
                  activeSection === "interaction"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-semibold text-[#1F1F1F] block mb-0.5">
                  Interaction preferences
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  Add details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
