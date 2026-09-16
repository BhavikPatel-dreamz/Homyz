"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy editor props */

import React from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { RealMap } from "@/components/ui/real-map";
import { getAmenityMeta } from "@/lib/constants/amenities";
import { formatTimeDisplay } from "../section-helpers";
import {
  cancellationPolicyLabel,
  normalizeAccessibilityFeatureDetails,
  normalizeAccessibilityFeatureIds,
  type AccessibilityFeatureDetail,
} from "@/lib/constants/listing-enums";
import {
  type SafetyIconType,
  type GuestSafetyState,
  getActiveSafetyItems,
  parseSafetyData,
} from "./guest-safety-helpers";
import { EditorSidebarSkeleton } from "./YourSpaceSkeletons";
import { getLanguageDisplayNames } from "@/lib/utils/language-options";
import { computeMissingRequirements, getListingDisplayState } from "./ListingStatusView";
import { isSaudiArabia } from "@/lib/location/address-countries";

function SafetySidebarIcon({ type }: { type: SafetyIconType }) {
  if (type === "co") {
    return (
      <svg className="w-4 h-4 shrink-0 text-[#1F1F1F] stroke-[1.6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <circle cx="12" cy="12" r="2.5" />
        <path strokeLinecap="round" d="M16 8.5a4.5 4.5 0 0 0-8 0" />
        <path strokeLinecap="round" d="M8 15.5a4.5 4.5 0 0 0 8 0" />
      </svg>
    );
  }
  if (type === "smoke") {
    return (
      <svg className="w-4 h-4 shrink-0 text-[#1F1F1F] stroke-[1.6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    );
  }
  if (type === "noise") {
    return (
      <svg className="w-4 h-4 shrink-0 text-[#1F1F1F] stroke-[1.6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    );
  }
  if (type === "camera") {
    return (
      <svg className="w-4 h-4 shrink-0 text-[#1F1F1F] stroke-[1.6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
      </svg>
    );
  }
  if (type === "stairs") {
    return (
      <svg className="w-4 h-4 shrink-0 text-[#1F1F1F] stroke-[1.6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h4v-4h4v-4h4V7h4" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 shrink-0 text-[#1F1F1F] stroke-[1.6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

const ACCESSIBILITY_FEATURE_LABELS: Record<string, string> = {
  accessible_parking: "Accessible parking spot",
  lit_path: "Lit path to entrance",
  step_free_access: "Step-free access",
  wide_entrance: "Guest entrance wider than 32 in",
  pool_hoist: "Pool or hot tub hoist",
  ceiling_hoist: "Ceiling or mobile hoist",
};

const AMENITY_ICON_SOURCES: Record<string, string> = {
  wifi: "/images/icons/wifi.svg",
  tv: "/images/icons/tv.svg",
  kitchen: "/images/icons/kitchen.svg",
  washer: "/images/icons/washer.svg",
  free_parking: "/images/icons/free-parking.svg",
  paid_parking: "/images/icons/paid-parking.svg",
  air_conditioning: "/images/icons/air-conditioning.svg",
  workspace: "/images/icons/workspace.svg",
  bed_linens: "/images/icons/bed-linens.svg",
  body_soap: "/images/icons/body-soap.svg",
  pool: "/images/icons/pool.svg",
  private_pool: "/images/icons/pool.svg",
  shared_pool: "/images/icons/pool.svg",
  hot_tub: "/images/icons/hot-tub.svg",
  indoor_fireplace: "/images/icons/indoor-fireplace.svg",
  piano: "/images/icons/piano.svg",
  patio: "/images/icons/patio.svg",
  outdoor_dining_area: "/images/icons/outdoor-dining-area.svg",
  bbq_grill: "/images/icons/bbg-grill.svg",
  fire_pit: "/images/icons/fire-pit.svg",
  pool_table: "/images/icons/pool-table.svg",
  smoke_alarm: "/images/icons/smoke-alarm.svg",
  first_aid_kit: "/images/icons/first-aid-kit.svg",
  fire_extinguisher: "/images/icons/fire-extinguisher.svg",
};

interface EditorSidebarProps {
  presentation?: "host" | "admin";
  editorTab: "space" | "arrival" | "preferences";
  activeSection: string;
  setActiveSection: (section: any) => void;
  editTitle: string;
  editListingType: string;
  editPropertyType: string;
  currency?: string;
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
  latitude?: number | null;
  longitude?: number | null;
  showExactLocation: boolean;
  listing: any;
  coHosts: Array<{ id: string; email: string | null; status: string; user: { name: string | null; image: string | null } | null }>;
  bookingMethod: "first-three" | "instant" | "approve";
  requireGoodTrackRecord?: boolean;
  checkInStart: string;
  checkOutTime: string;
  checkOutInstructions?: string | null;
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
  safetyDisclosures?: string[];
  safetyEquipment?: string[];
  safetyHazards?: string[];
  guestSafetyState?: GuestSafetyState;
  cancellationPolicy: string;
  longTermCancellationPolicy?: "FIRM" | "STRICT" | string;
  customSlug?: string;
  checkInMethod: string;
  checkInEnd: string;
  wifiNetwork: string;
  houseManual: string;
  directions?: string;
  guestInteractionPreference?: string | null;
  guidebooksCount?: number;
  editBedrooms?: number;
  editBeds?: number;
  parkingAvailable?: boolean;
  parkingType?: string;
  setIsRemoveListingModalOpen?: (open: boolean) => void;
  isLoading?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const ADMIN_EDITOR_SECTIONS = [
  { group: "Admin review", items: [["admin-review", "Review & controls"], ["audit-history", "Audit history"]] },
  { group: "Your space", items: [["title", "Listing title"], ["description", "Description"], ["propertyType", "Property type"], ["location", "Location"], ["guests", "Guest capacity"], ["sleeping-arrangements", "Rooms & beds"], ["photos", "Photos & photo tour"], ["amenities", "Amenities"], ["accessibility", "Accessibility"], ["about-host", "About host"], ["pricing", "Pricing"], ["availability", "Availability"], ["house-rules", "House rules"], ["guests-safety", "Guest safety"], ["cancellation-policy", "Cancellation"]] },
  { group: "Arrival guide", items: [["check-in-out", "Check-in & checkout"], ["directions", "Directions"], ["check-in-method", "Check-in method"], ["wifi-details", "Wi-Fi"], ["house-manual", "House manual"], ["parking", "Parking"], ["checkout-instructions", "Checkout instructions"], ["guidebooks", "Guidebooks"], ["interaction-preferences", "Interaction preferences"]] },
  { group: "Preferences", items: [["listing-status", "Listing status"], ["language", "Languages"], ["guest-requirements", "Guest requirements"], ["local-laws", "Local laws"], ["regulations", "Regulations"], ["taxes", "Taxes"], ["homyz-org-stays", "Homyz.org stays"], ["custom-link", "Custom listing link"], ["remove-listing", "Remove listing"]] },
] as const;

function AdminEditorSidebar({ activeSection, setActiveSection, listing }: Pick<EditorSidebarProps, "activeSection" | "setActiveSection" | "listing">) {
  return (
    <aside className="admin-editor-sidebar rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xs lg:sticky lg:top-6">
      <div className="border-b border-[var(--border-subtle)] px-3 pb-3 pt-2">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Listing navigation</p>
        <p className="mt-1 truncate text-sm font-bold text-muted-foreground">{listing.title || "Untitled listing"}</p>
      </div>
      <nav className="mt-2 max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto px-1 pb-2" aria-label="Admin listing sections">
        {ADMIN_EDITOR_SECTIONS.map((section) => (
          <div key={section.group}>
            <p className="px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{section.group}</p>
            {section.items.map(([id, label]) => {
              const active = activeSection === id || (id === "photos" && activeSection === "photo-tour") || (id === "custom-link" && activeSection === "customlink");
              const destructive = id === "remove-listing";
              return <button key={id} type="button" onClick={() => setActiveSection(id)} className={`mb-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${active ? "bg-amber-500 text-zinc-950" : destructive ? "text-rose-600 hover:bg-rose-50" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-muted-foreground"}`}><span>{label}</span><span className="text-sm opacity-60">›</span></button>;
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function EditorSidebar({
  presentation = "host",
  editorTab,
  activeSection,
  setActiveSection,
  isLoading = false,
  editTitle,
  editListingType,
  editPropertyType,
  currency = "SAR",
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
  latitude,
  longitude,
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
  safetyDisclosures,
  safetyEquipment,
  safetyHazards,
  guestSafetyState,
  cancellationPolicy,
  longTermCancellationPolicy = "FIRM",
  customSlug = "",
  checkInMethod,
  checkInEnd,
  wifiNetwork,
  houseManual,
  directions = "",
  guestInteractionPreference = "",
  guidebooksCount = 0,
  checkOutInstructions = "",
  editBedrooms = 1,
  editBeds = 1,
  parkingAvailable = false,
  parkingType = "Free",
  setIsRemoveListingModalOpen,
  mobileOpen = false,
  onMobileClose,
}: EditorSidebarProps) {
  const sidebarScrollRef = React.useRef<HTMLDivElement>(null);
  const sidebarScrollFrameRef = React.useRef<number | null>(null);
  const [sidebarScrollThumb, setSidebarScrollThumb] = React.useState({ height: 0, top: 0, visible: false });

  const updateSidebarScrollThumb = React.useCallback(() => {
    if (sidebarScrollFrameRef.current !== null) cancelAnimationFrame(sidebarScrollFrameRef.current);

    sidebarScrollFrameRef.current = requestAnimationFrame(() => {
      const element = sidebarScrollRef.current;
      if (!element) return;

      const hasOverflow = element.scrollHeight > element.clientHeight + 1;
      const height = hasOverflow ? 60 : 0;
      // Keep the thumb and its shadow 10px above the rail's lower edge.
      const maxTop = Math.max(0, element.clientHeight - height - 10);
      const scrollRange = Math.max(1, element.scrollHeight - element.clientHeight);
      const top = hasOverflow ? Math.round((element.scrollTop / scrollRange) * maxTop) : 0;

      setSidebarScrollThumb((current) => (
        current.height === height && current.top === top && current.visible === hasOverflow
          ? current
          : { height, top, visible: hasOverflow }
      ));
      sidebarScrollFrameRef.current = null;
    });
  }, []);

  React.useEffect(() => {
    const element = sidebarScrollRef.current;
    if (!element) return;

    updateSidebarScrollThumb();
    const resizeObserver = new ResizeObserver(updateSidebarScrollThumb);
    const mutationObserver = new MutationObserver(updateSidebarScrollThumb);
    resizeObserver.observe(element);
    mutationObserver.observe(element, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (sidebarScrollFrameRef.current !== null) cancelAnimationFrame(sidebarScrollFrameRef.current);
    };
  }, [updateSidebarScrollThumb]);

  const computedSafetyState = React.useMemo(() => {
    if (guestSafetyState) return guestSafetyState;
    return parseSafetyData({
      ...listing,
      safetyDisclosures: safetyDisclosures ?? listing?.safetyDisclosures,
      safetyEquipment: safetyEquipment ?? listing?.safetyEquipment,
      safetyHazards: safetyHazards ?? listing?.safetyHazards,
      amenities: [
        ...(listing?.amenities ?? []),
        ...(smokeAlarm ? ["smoke_alarm"] : []),
        ...(carbonMonoxideAlarm ? ["carbon_monoxide_alarm"] : []),
      ],
    });
  }, [guestSafetyState, listing, safetyDisclosures, safetyEquipment, safetyHazards, smokeAlarm, carbonMonoxideAlarm]);

  const activeSafetyItems = React.useMemo(() => {
    return getActiveSafetyItems(computedSafetyState);
  }, [computedSafetyState]);
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

  const missingReqs = computeMissingRequirements(listing || {});
  const isSaudi = isSaudiArabia(listing?.country);
  const displayState = getListingDisplayState(
    listing?.status || "DRAFT",
    Boolean(listing?.published),
    missingReqs.length,
    listing?.country
  );

  const hasCheckInCheckOut = Boolean(checkInStart && checkOutTime);
  const hasDirections = Boolean(directions && directions.trim().length > 0);
  const hasCheckInMethod = Boolean(checkInMethod && checkInMethod.trim().length > 0);
  const hasWifi = Boolean(wifiNetwork && wifiNetwork.trim().length > 0);
  const hasHouseManual = Boolean(houseManual && houseManual.trim().length > 0);
  const hasCheckoutInstructions = Boolean(checkOutInstructions && checkOutInstructions.trim().length > 0);
  const hasGuidebooks = Boolean(guidebooksCount && guidebooksCount > 0);
  const hasInteractionPref = Boolean(guestInteractionPreference && guestInteractionPreference.trim().length > 0);

  const arrivalGuideCompletedCount = [
    hasCheckInCheckOut,
    hasDirections,
    hasCheckInMethod,
    hasWifi,
    hasHouseManual,
    hasCheckoutInstructions,
    hasGuidebooks,
    hasInteractionPref,
  ].filter(Boolean).length;

  if (presentation === "admin") {
    return <AdminEditorSidebar activeSection={activeSection} setActiveSection={setActiveSection} listing={listing} />;
  }

  const sidebar = (
    <aside
      className={`editor-sidebar ${mobileOpen
        ? "flex h-full w-full overflow-hidden border-0 bg-white px-5 pt-6 sm:px-8 sm:pt-8"
        : "hidden border-r border-transparent [border-image:linear-gradient(270deg,#1F1F1F_0%,rgba(31,31,31,0.2)_100%)_1]"
        } min-w-0 flex-col lg:col-span-1 lg:-mt-[109px] lg:flex lg:h-auto lg:w-auto lg:overflow-visible lg:border-r lg:border-transparent lg:[border-image:linear-gradient(270deg,#1F1F1F_0%,rgba(31,31,31,0.2)_100%)_1] lg:bg-[rgba(241,241,241,0.5)] lg:px-0 lg:pl-8 lg:pt-[176px]`}
    >
      <div className={`flex w-full min-w-0 flex-col overflow-hidden ${mobileOpen ? "h-full max-h-none bg-white" : "max-h-[calc(100vh-2rem)] rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-xs"} lg:sticky lg:top-25 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}>
        {/* Header Title & Status Badge */}
        <div className="flex shrink-0 flex-col pb-5 lg:pb-9">
          <div className="flex items-center justify-between">
            <h2>
              {editorTab === "preferences" ? "Edit preferences" : "Listing editor"}
            </h2>
            {mobileOpen && (
              <button
                type="button"
                aria-label="Return to listing form"
                onClick={onMobileClose}
                className="flex h-10 w-10 items-center justify-center text-[#1F1F1F] lg:hidden"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
                  <path d="m5 5 14 14M19 5 5 19" />
                </svg>
              </button>
            )}
          </div>
          <div className="mt-1.5 hidden items-center gap-1.5">
            {displayState === "PENDING_APPROVAL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Pending Admin Approval
              </span>
            )}
            {displayState === "REJECTED" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Changes Required
              </span>
            )}
            {displayState === "PUBLISHED" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Published · Live
              </span>
            )}
            {displayState === "APPROVED" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {isSaudi ? "Ready to Publish" : "Approved"}
              </span>
            )}

            {displayState === "DRAFT" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-200/80 text-zinc-700">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                Draft · Incomplete
              </span>
            )}
          </div>
        </div>

        {/* Sub-Pills: [Your space] [Arrival guide] ⚙️ (Fixed) */}
        <div className="mb-6 flex shrink-0 items-center justify-between gap-2 lg:mb-12 lg:max-w-[calc(100%-70px)]">
          <div className="flex w-full max-w-none items-center rounded-full border border-[#1F1F1F] bg-white p-1 lg:max-w-[272px] lg:p-1.5">
            <button
              type="button"
              onClick={() => setActiveSection("description")}
              className={`min-h-11 flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer sm:text-sm lg:min-h-[48px] lg:px-4 ${editorTab === "space"
                ? "bg-[#FEE08B] text-[#1F1F1F] shadow-2xs"
                : "text-[#1F1F1F] hover:text-white hover:bg-[#1F1F1F]"
                }`}
            >
              Your space
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("check-in-out")}
              className={`min-h-11 flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer sm:text-sm lg:min-h-[48px] lg:px-4 ${editorTab === "arrival"
                ? "bg-[#FEE08B] text-[#1F1F1F] shadow-2xs"
                : "text-[#1F1F1F] hover:text-white hover:bg-[#1F1F1F]"
                }`}
            >
              Arrival guide
            </button>
          </div>

          <button
            type="button"
            aria-label="Listing preferences"
            onClick={() => setActiveSection("listing-status")}
            className={`group flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xs transition-all cursor-pointer lg:h-12 lg:w-12 ${editorTab === "preferences"
              ? "bg-[#FEE08B] border-amber-300 shadow-2xs text-zinc-950"
              : "bg-white border-[#1F1F1F] text-[#727272] hover:bg-[#1F1F1F]"
              }`}
          >
            <Image src="/images/icons/setting-icon.svg" alt="" width={24} height={24} className="h-6 w-6 transition-[filter] group-hover:brightness-0 group-hover:invert" />
          </button>
        </div>

        {/* Scrollable Sidebar Content Body */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={sidebarScrollRef}
            onScroll={updateSidebarScrollThumb}
            className="custom-scrollbar h-full min-w-0 touch-pan-y overflow-x-hidden overflow-y-auto space-y-3 pb-8 pr-1 lg:pb-5 lg:pr-[55px]"
          >
            {/* Preferences Cards Stack */}
            {editorTab === "preferences" ? (
              <div className="min-w-0 space-y-3">
                {/* Card 1: Listing status */}
                <div
                  onClick={() => setActiveSection("listing-status")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "listing-status" || activeSection === "listingstatus"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#727272] block mb-1">
                    Listing status
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-0.5 rounded-full ${displayState === "PUBLISHED" || displayState === "APPROVED"
                      ? "text-emerald-700 bg-emerald-100/70"
                      : displayState === "PENDING_APPROVAL"
                        ? "text-amber-800 bg-amber-100/70"
                        : displayState === "REJECTED"
                          ? "text-rose-800 bg-rose-100/70"
                          : displayState === "READY_TO_SUBMIT"
                            ? "text-indigo-800 bg-indigo-100/70"
                            : "text-zinc-700 bg-zinc-100"
                      }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${displayState === "PUBLISHED" || displayState === "APPROVED"
                        ? "bg-emerald-500"
                        : displayState === "PENDING_APPROVAL"
                          ? "bg-amber-500 animate-pulse"
                          : displayState === "REJECTED"
                            ? "bg-rose-500"
                            : displayState === "READY_TO_SUBMIT"
                              ? "bg-indigo-500"
                              : "bg-zinc-400"
                        }`}
                    />
                    {displayState === "PUBLISHED"
                      ? "Published · Live"
                      : displayState === "PENDING_APPROVAL"
                        ? "Pending Admin Approval"
                        : displayState === "REJECTED"
                          ? "Changes Required"
                          : displayState === "APPROVED"
                            ? (isSaudi ? "Ready to Publish" : "Approved")
                            : displayState === "READY_TO_SUBMIT"
                              ? "Ready for review"
                              : "Draft · Incomplete"}
                  </span>
                </div>

                {/* Card 2: Languages */}
                <div
                  onClick={() => setActiveSection("language")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between ${activeSection === "language" || activeSection === "languages"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                      Languages
                    </span>
                    <p
                      className="max-w-[15rem] truncate text-sm font-normal text-zinc-500"
                      title={getLanguageDisplayNames(
                        Array.isArray(listing?.languages) ? listing.languages : [],
                      ).join(", ")}
                    >
                      {(() => {
                        const languages = getLanguageDisplayNames(
                          Array.isArray(listing?.languages) ? listing.languages : [],
                        );
                        return languages.length > 0 ? languages.join(", ") : "No languages selected";
                      })()}
                    </p>
                  </div>
                  <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
                </div>

                {/* Card 3: Guest requirements */}
                <div
                  onClick={() => setActiveSection("guest-requirements")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between ${activeSection === "guest-requirements" || activeSection === "guestrequirements"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                      Guest requirements
                    </span>
                    <p className="text-base text-zinc-500 font-normal">
                      {listing?.requireProfilePhoto ? "Profile photo required" : "Profile photo not required"}
                    </p>
                  </div>
                  <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
                </div>

                {/* Card 4: Local laws */}
                <div
                  onClick={() => setActiveSection("local-laws")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between ${activeSection === "local-laws" || activeSection === "locallaws"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                      Local laws
                    </span>
                    <p className="text-base text-zinc-500 font-normal">
                      Review your local laws
                    </p>
                  </div>
                  <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
                </div>

                {/* Card 5: Regulations */}
                <div
                  onClick={() => setActiveSection("regulations")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between ${activeSection === "regulations"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                      Regulations
                    </span>
                  </div>
                  <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
                </div>

                {/* Card 6: Taxes */}
                <div
                  onClick={() => setActiveSection("taxes")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between ${activeSection === "taxes"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                      Taxes
                    </span>
                    <p className="text-base text-zinc-500 font-normal">
                      Learn how taxes work for Hosts
                    </p>
                  </div>
                  <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
                </div>

                {/* Card 7: homyz.org stays */}
                <div
                  onClick={() => setActiveSection("homyz-org-stays")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between ${activeSection === "homyz-org-stays" ||
                    activeSection === "airbnb-org-stays" ||
                    activeSection === "homyz-stays" ||
                    activeSection === "homyzstays"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                      homyz.org stays
                    </span>
                    {(() => {
                      const org = listing?.discounts?.orgStays;
                      if (org && typeof org === "object" && org.enabled) {
                        const type = org.discountType || org.type || "FREE";
                        if (type === "DISCOUNT") {
                          const pct = Number(org.discountPercentage) || Number(org.discount) || 0;
                          return (
                            <p className="text-base text-zinc-500 font-normal">{pct}% off for homyz.org guests</p>
                          );
                        }
                        return <p className="text-base text-zinc-500 font-normal">Available for homyz.org guests</p>;
                      }
                      return <p className="text-base text-zinc-500 font-normal">Learn how you can help</p>;
                    })()}
                  </div>
                  <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
                </div>

                {/* Card 8: Remove listing */}
                <div
                  onClick={() => {
                    setActiveSection("remove-listing");
                    setIsRemoveListingModalOpen?.(true);
                  }}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between ${activeSection === "remove-listing" || activeSection === "removelisting"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                      Remove listing
                    </span>
                    <p className="text-base text-zinc-500 font-normal">
                      Permanently remove your listing
                    </p>
                  </div>
                  <span className="text-zinc-400 text-xs font-medium select-none ml-2">›</span>
                </div>
              </div>
            ) : editorTab === "space" ? (
              <div className="space-y-3">
                {/* Photo Card Stack Preview (Matches reference image: 4 overlapping cards with hover animation) */}
                {activeSection !== "about-host" && (
                  <div
                    onClick={() => setActiveSection("photos")}
                    className={`relative min-w-0 cursor-pointer group mb-[72px] rounded-3xl transition-all ${activeSection === "photos"
                      ? ""
                      : "hover:bg-zinc-100/50"
                      }`}
                    aria-label="Photo tour preview"
                  >
                    <div className="relative w-full max-w-full h-36 sm:h-45">
                      {/* Card 0 (Leftmost, z-0) */}
                      <div
                        className="absolute top-0 bottom-0 left-0 w-[154px] rounded-xl border-2 border-[#1F1F1F] bg-white shadow-2xs overflow-hidden z-0 transition-all duration-300 ease-out hover:!z-50 hover:shadow-lg"
                      >
                        {editPhotos.length > 3 ? (
                          <img
                            src={editPhotos[3]}
                            alt="Listing photo 4"
                            className="w-full h-full object-cover transition-all duration-300"
                          />
                        ) : editPhotos.length > 0 ? (
                          <img
                            src={editPhotos[editPhotos.length - 1]}
                            alt="Listing photo"
                            className="w-full h-full object-cover opacity-80"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xl">
                            🏡
                          </div>
                        )}
                      </div>

                      {/* Card 1 (z-10) */}
                      <div
                        className="absolute top-0 bottom-0 left-[17%] w-[154px] rounded-xl border-2 border-[#1f1f1f] bg-white shadow-2xs overflow-hidden z-10 transition-all duration-300 ease-out hover:!z-50 hover:shadow-lg"
                      >
                        {editPhotos.length > 2 ? (
                          <img
                            src={editPhotos[2]}
                            alt="Listing photo 3"
                            className="w-full h-full object-cover transition-all duration-300"
                          />
                        ) : editPhotos.length > 0 ? (
                          <img
                            src={editPhotos[0]}
                            alt="Listing photo"
                            className="w-full h-full object-cover opacity-85"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xl">
                            🏡
                          </div>
                        )}
                      </div>

                      {/* Card 2 (z-20) */}
                      <div
                        className="absolute top-0 bottom-0 left-[35%] w-[154px] rounded-xl border-2 border-[#1f1f1f] bg-white shadow-2xs overflow-hidden z-20 transition-all duration-300 ease-out hover:!z-50 hover:shadow-lg"
                      >
                        {editPhotos.length > 1 ? (
                          <img
                            src={editPhotos[1]}
                            alt="Listing photo 2"
                            className="w-full h-full object-cover transition-all duration-300"
                          />
                        ) : editPhotos.length > 0 ? (
                          <img
                            src={editPhotos[0]}
                            alt="Listing photo"
                            className="w-full h-full object-cover "
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#727272] text-xs">
                            🏡
                          </div>
                        )}
                      </div>

                      {/* Card 3 (Rightmost / Front, z-30) */}
                      <div
                        className="absolute top-0 bottom-0 left-[52%] w-[154px] rounded-2xl border-2 border-[#1F1F1F] bg-white shadow-xs overflow-hidden z-30 transition-all duration-300 ease-out hover:!z-50 flex items-center justify-center"
                      >
                        {editPhotos.length > 0 ? (
                          <img
                            src={editPhotos[0]}
                            alt="Property cover"
                            className="w-full h-full object-cover transition-all duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                            <span className="text-2xl mb-1">🏡</span>
                          </div>
                        )}

                        {/* Centered Pill/Card Badge matching reference image */}
                        <div className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none">
                          <div className="bg-[#F3F4F5] backdrop-blur-md text-[#1F1F1F] px-4 py-2.5 rounded-lg shadow-xs border border-white/70 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-normal tracking-tight text-[#1F1F1F] leading-tight">
                              {editPhotos.length}
                            </span>
                            <span className="text-xs font-normal text-[#1F1F1F] leading-tight mt-0.5">
                              photos
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* 1. Title */}
                <div
                  onClick={() => setActiveSection("title")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "title"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    Title
                  </span>
                  <span className="sm:text-xl text-lg font-normal text-[#727272] block truncate">
                    {editTitle || "Property Name"}
                  </span>
                </div>

                {/* 2. Property type */}
                <div
                  onClick={() => setActiveSection("propertyType")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "propertyType"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    Property type
                  </span>
                  <span className="text-base font-normal text-[#727272] block">
                    {editListingType} · {editPropertyType}
                  </span>
                </div>

                {/* 3. Pricing */}
                <div
                  onClick={() => setActiveSection("pricing")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "pricing"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    Pricing
                  </span>
                  <div className="text-base text-[#727272] space-y-0.5">
                    {smartPricing ? (
                      <>
                        <p className="font-semibold text-[#1F1F1F]">Smart pricing</p>
                        <p className="text-[11px] text-zinc-500">
                          {currency} {smartPricingMinPrice} – {currency} {smartPricingMaxPrice}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-[#1F1F1F]">{currency} {editPrice}</p>
                        <p className="text-[11px] text-zinc-500">{weeklyDiscount}% weekly discount</p>
                        <p className="text-[11px] text-zinc-500">{monthlyDiscount}% monthly discount</p>
                      </>
                    )}
                  </div>
                </div>

                {/* 4. Availability */}
                <div
                  onClick={() => setActiveSection("availability")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "availability"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    Availability
                  </span>
                  <div className="text-base text-[#727272] space-y-0.5">
                    <p className="text-base font-medium text-[#727272]">
                      {minNights}-{maxNights} night stays
                    </p>
                    <p className="text-base text-[#727272] font-normal">{advanceNotice} notice</p>
                    <p className="text-base text-[#727272] font-normal">
                      {allowSameDayRequests ? `Same-day requests until ${sameDayCutoff}` : "Same-day requests unavailable"}
                    </p>
                  </div>
                </div>

                {/* 5. Number of guests */}
                <div
                  onClick={() => setActiveSection("guests")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "guests"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    Number of guests
                  </span>
                  <span className="text-base font-medium text-[#727272] block">
                    {editGuests} guests
                  </span>
                </div>

                {/* 5b. Sleeping arrangements */}
                <div
                  onClick={() => setActiveSection("sleeping-arrangements")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "sleeping-arrangements"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    Sleeping arrangements
                  </span>
                  <span className="text-base font-medium text-[#727272] block">
                    {editBedrooms || 1} {editBedrooms === 1 ? "bedroom" : "bedrooms"} · {editBeds || 1} {editBeds === 1 ? "bed" : "beds"}
                  </span>
                </div>

                {/* 6. Description */}
                <div
                  onClick={() => setActiveSection("description")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "description"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    Description
                  </span>
                  <p className="text-base font-medium text-[#727272] line-clamp-3 leading-relaxed">
                    {editDescription || "No description provided yet."}
                  </p>
                </div>

                {/* 7. Amenities */}
                <div
                  onClick={() => setActiveSection("amenities")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer text-base font-medium text-[#727272] ${activeSection === "amenities" || activeSection === "add-amenities"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-3">
                    Amenities
                  </span>
                  <div className="space-y-1.5 text-base font-medium text-[#727272]">
                    {editAmenities.length === 0 ? (
                      <span className="text-base font-medium text-[#727272]">Add amenities</span>
                    ) : (
                      <>
                        {editAmenities.slice(0, 3).map((am) => {
                          const meta = getAmenityMeta(am);
                          const iconSource = AMENITY_ICON_SOURCES[meta.id];
                          return (
                            <div key={meta.id || am} className="flex items-center gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] bg-white">
                                {iconSource ? (
                                  <Image src={iconSource} alt="" width={20} height={20} className="h-4.75 w-4.75 object-contain" />
                                ) : (
                                  <span className="text-base font-normal text-[#727272]">{meta.icon || "✨"}</span>
                                )}
                              </span>
                              <span className="text-base font-normal text-[#727272]">{meta.label}</span>
                            </div>
                          );
                        })}
                        {editAmenities.length > 3 && (
                          <span className="text-base font-semibold text-zinc-400 block pt-0.5">
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
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "accessibility"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
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
                    <span className="text-base text-[#727272] font-normal">Add details</span>
                  )}
                </div>

                {/* 9. Location */}
                <div
                  onClick={() => setActiveSection("location")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "accessibility"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-2">Location</span>
                  <RealMap
                    address={editAddress}
                    city={editCity}
                    country={editCountry}
                    lat={latitude ?? undefined}
                    lng={longitude ?? undefined}
                    preferInitialCoordinates={true}
                    showExactLocation={showExactLocation}
                    className="rounded-xl overflow-hidden border border-zinc-200/80 relative h-24 mb-2.5 pointer-events-none"
                  />
                  <span className="text-base font-medium text-zinc-500 block truncate">
                    {editAddress
                      ? `${editAddress}, ${editCity}, ${editCountry}`
                      : "Location name, Postal Code, Country"}
                  </span>
                </div>

                {/* 10. About the host */}
                <div
                  onClick={() => setActiveSection("about-host")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "about-host"
                    ? "bg-[#ECE9FE] border-indigo-200"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-4">
                    About the host
                  </span>

                  <div className="grid grid-cols-2 gap-3 items-center">
                    {/* Left Column: Avatar, Name, Superhost badge */}
                    <div className="flex flex-col items-center justify-center text-center">
                      {listing.host?.image ? (
                        <img
                          src={listing.host.image}
                          alt="Host profile"
                          className="w-16 h-16 rounded-full object-cover border border-zinc-200 shadow-2xs"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full border border-amber-200 bg-amber-100 text-amber-900 flex items-center justify-center font-semibold text-lg shadow-2xs">
                          {(listing.host?.name || "Host")
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part: string) => part[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                      )}
                      <h4 className="text-base font-semibold text-[#1F1F1F] mt-2 block leading-tight truncate max-w-[120px]">
                        {listing.host?.name || "Name"}
                      </h4>
                      <span className="text-base text-[#727272] font-normal mt-0.5 block leading-tight">
                        {listing.host?.isSuperhost ? "Superhost" : (listing.host?.badge || "Superhost")}
                      </span>
                    </div>

                    {/* Right Column: 3 Stacked Stats with Dividers */}
                    <div className="flex flex-col items-center justify-center text-center">
                      {/* Ratings are system-generated, never host-entered. */}
                      <div className="w-full flex flex-col items-center">
                        <span className="text-base font-medium text-[#1F1F1F] block leading-tight">
                          {listing.host?.reviewsCount ?? listing.host?.reviewCount ?? "XX"}
                        </span>
                        <span className="text-base text-[#727272] font-normal block mt-0.5">
                          review
                        </span>
                      </div>

                      {/* Divider 1 */}
                      <div className="w-full border-t border-zinc-200 my-2" />

                      {/* Avoid a fabricated rating until the review system provides one. */}
                      <div className="w-full flex flex-col items-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-base font-medium text-[#1F1F1F] leading-tight">
                            {listing.host?.rating ? String(listing.host.rating).replace(".", ",") : "4,98"}
                          </span>
                        </div>
                        <span className="text-base text-[#727272] font-normal block mt-0.5">
                          rating
                        </span>
                      </div>

                      {/* Divider 2 */}
                      <div className="w-full border-t border-zinc-200 my-2" />

                      {/* The account creation date is the authoritative tenure source. */}
                      <div className="w-full flex flex-col items-center">
                        <span className="text-base font-medium text-[#1F1F1F] block leading-tight">
                          {listing.host?.createdAt
                            ? Math.max(1, new Date().getFullYear() - new Date(listing.host.createdAt).getFullYear())
                            : 3}
                        </span>
                        <span className="text-base text-[#727272] font-normal block mt-0.5">
                          years hosting
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 11. Co-host */}
                <div
                  onClick={() => {
                    setActiveSection("co-host");
                  }}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "co-host"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-medium text-[#1F1F1F] block">Co-host</span>
                    {coHostSummary && (
                      <span className="text-base bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                        {coHostSummary}
                      </span>
                    )}
                  </div>
                  {coHosts.filter((item) => item.status === "PENDING" || item.status === "ACCEPTED").length > 0 ? (
                    <div className="text-base text-zinc-700 font-medium space-y-0.5 pt-0.5">
                      {coHosts.filter((item) => item.status === "PENDING" || item.status === "ACCEPTED").map((ch) => (
                        <p key={ch.id} className="truncate">
                          • {ch.user?.name || ch.email} ({ch.status.toLowerCase()})
                        </p>
                      ))}
                    </div>
                  ) : (
                    <span className="text-base text-[#727272] font-normal block block">Add details</span>
                  )}
                </div>

                {/* 12. Booking settings */}
                <div
                  onClick={() => setActiveSection("booking-settings")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "booking-settings"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1f1f1f] block mb-0.5">
                    Booking settings
                  </span>
                  <p className="text-base text-[#727272] font-normal">
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
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "house-rules"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-sm font-semibold text-[#1F1F1F] block mb-3">House rules</span>
                  <div className="space-y-3 text-base text-[#727272] font-normal">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#1F1F1F] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Check-in after {formatTimeDisplay(checkInStart, "3:00 pm")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#1F1F1F] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Checkout before {formatTimeDisplay(checkOutTime, "6:00 pm")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#1F1F1F] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
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
                      <p className="pt-1.5 text-base text-[#727272] font-normal hover:text-[#1F1F1F] transition-all duration-300 hover:underline">+{extraHouseRules.length} more</p>
                    )}
                  </div>
                </div>

                {/* 14. Guests safety */}
                <div
                  onClick={() => setActiveSection("guests-safety")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "guests-safety"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-2.5">Guest safety</span>
                  {activeSafetyItems.length > 0 ? (
                    <div className="space-y-2 text-base text-[#1F1F1F] font-normal">
                      {activeSafetyItems.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center gap-2.5">
                          <SafetySidebarIcon type={item.iconType} />
                          <span className="text-[#1F1F1F] text-base font-normal leading-tight">
                            {item.label}
                          </span>
                        </div>
                      ))}
                      {activeSafetyItems.length > 3 && (
                        <p className="pt-1 text-base text-[#1F1F1F] font-normal">
                          +{activeSafetyItems.length - 3} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 text-base text-[#727272] font-normal">
                      <div className="flex items-center gap-2.5">
                        <SafetySidebarIcon type="co" />
                        <span className="text-[#727272] text-base font-medium leading-tight">
                          Carbon monoxide alarm not reported
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <SafetySidebarIcon type="smoke" />
                        <span className="text-[#727272] text-base font-medium leading-tight">
                          Smoke alarm not reported
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 15. Cancellation policy */}
                <div
                  onClick={() => setActiveSection("cancellation-policy")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "cancellation-policy"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-1">
                    Cancellation policy
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-base text-zinc-500 font-normal">
                      {cancellationPolicyLabel(cancellationPolicy)} for short-term stays
                    </p>
                    <p className="text-base text-zinc-500 font-normal">
                      {longTermCancellationPolicy === "STRICT" ? "Strict Long-Term" : "Firm Long-Term"} for long-term stays
                    </p>
                  </div>
                </div>

                {/* 16. Custom link */}
                <div
                  onClick={() => setActiveSection("custom-link")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "custom-link"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    Custom link
                  </span>
                  <p className="text-base text-zinc-500 font-normal truncate" title={customSlug ? `homyz.com/stay/${customSlug}` : undefined}>
                    {customSlug ? `homyz.com/stay/${customSlug}` : "Add details"}
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
                  className={`w-full rounded-xl border border-white bg-white px-4 py-3 text-left shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all ${activeSection === "check-in-out" || activeSection === "arrival-guide"
                    ? "border-indigo-200 bg-[#ECE9FE]"
                    : "border-white bg-white hover:border-white"
                    }`}
                >
                  <span className="mb-1 block text-base font-medium text-[#1F1F1F]">Check-in</span>
                  <span className="block border-b border-zinc-300 pb-2 text-base text-[#727272]">{checkInStart || "3:00 PM"}</span>
                  <span className="mt-2 block text-base font-medium text-[#1F1F1F]">Check-out</span>
                  <span className="block text-base text-[#727272]">{checkOutTime || "12:00 PM"}</span>
                </button>

                {/* Card 2: Check-in method */}
                <div
                  onClick={() => setActiveSection("check-in-method")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "check-in-method"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    Check-in method
                  </span>
                  <p className="text-base text-[#1F1F1F] font-normal">
                    {({ "SMART_LOCK": "Smart lock", "Smart lock": "Smart lock", "KEYPAD": "Keypad", "Keypad": "Keypad", "LOCKBOX": "Lockbox", "Lockbox": "Lockbox", "BUILDING_STAFF": "Building staff", "Building staff": "Building staff", "IN_PERSON_GREETING": "In-person greeting", "In-person greeting": "In-person greeting", "Host greets in person": "In-person greeting", "OTHER": "Other", "Other": "Other" } as Record<string, string>)[checkInMethod] || checkInMethod || "Smart lock"}
                  </p>
                </div>

                {/* Card 2: Wifi details */}
                <div
                  onClick={() => setActiveSection("wifi-details")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "wifi-details"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    Wifi details
                  </span>
                  <p className="text-base text-zinc-500 font-normal">
                    {wifiNetwork ? wifiNetwork : "Add details"}
                  </p>
                </div>

                <div
                  onClick={() => setActiveSection("directions")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "directions"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-base font-medium text-[#1F1F1F]">
                      Directions to property
                    </span>
                    
                  </div>
                  <p className="text-base text-zinc-500 font-normal truncate">
                    {directions && directions.trim() ? directions : "Add details"}
                  </p>
                </div>

                {/* Card 3: House manual */}
                <div
                  onClick={() => setActiveSection("house-manual")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "house-manual"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    House manual
                  </span>
                  <p className="text-base text-zinc-500 font-normal">
                    {houseManual ? houseManual.slice(0, 30) + "..." : "Add details"}
                  </p>
                </div>

                {/* Card 3b: Parking */}
                <div
                  onClick={() => setActiveSection("parking")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "parking"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    Parking
                  </span>
                  <p className="text-base text-zinc-500 font-normal">
                    {parkingAvailable ? `${parkingType || "Free"} parking` : "No parking specified"}
                  </p>
                </div>

                {/* Card 5: Check-out instructions */}
                <div
                  onClick={() => setActiveSection("checkout-instructions")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "checkout-instructions" ||
                    activeSection === "check-out-instructions" ||
                    activeSection === "checkout" ||
                    activeSection === "check-out"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    Check-out instructions
                  </span>
                  <p className="text-base text-[#1F1F1F] font-normal truncate">
                    {checkOutInstructions ? checkOutInstructions : "Add details"}
                  </p>
                </div>
                {/* Card 6: Guidebooks */}
                <div
                  onClick={() => setActiveSection("guidebooks")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "guidebooks" || activeSection === "guidebook"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    Guidebooks
                  </span>
                  <p className="text-base text-zinc-500 font-normal line-clamp-2 leading-relaxed">
                    Create a guidebook to share your location tips with guests.
                  </p>
                </div>

                {/* Card 7: Interaction preferences (Matches Figma Screenshot 100%) */}
                <div
                  onClick={() => setActiveSection("interaction-preferences")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "interaction-preferences" ||
                    activeSection === "interactionpreferences" ||
                    activeSection === "interaction"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    Interaction preferences
                  </span>
                  <p className="text-base text-zinc-500 font-normal">
                    Add details
                  </p>
                </div>
              </div>
            )}
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[22px] rounded-[30px] bg-white lg:block">
            {sidebarScrollThumb.visible && (
              <div
                className="absolute left-0 top-0 w-[22px] rounded-[30px] border border-white bg-[#DDDDDE] shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-transform duration-150 ease-out will-change-transform"
                style={{ height: `${sidebarScrollThumb.height}px`, transform: `translate3d(0, ${sidebarScrollThumb.top}px, 0)` }}
              />
            )}
          </div>
        </div>
      </div>
    </aside>
  );

  return mobileOpen ? (
    <ModalOverlay className="fixed inset-0 z-50 bg-white lg:contents">
      {sidebar}
    </ModalOverlay>
  ) : sidebar;
}
