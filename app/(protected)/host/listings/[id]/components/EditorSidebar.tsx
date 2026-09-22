"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy editor props */

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { RealMap } from "@/components/ui/real-map";
import { AMENITY_ICON_SOURCES, getAmenityMeta, getAmenityTranslationKey } from "@/lib/constants/amenities";
import { formatTimeDisplay } from "../section-helpers";
import {
  cancellationPolicyLabel,
  listingTypeLabel,
  normalizeAccessibilityFeatureDetails,
  normalizeAccessibilityFeatureIds,
  propertyTypeLabel,
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
import { getCheckInMethodLabel } from "./HouseRulesAndArrivalViews";
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

const ACCESSIBILITY_FEATURE_KEYS: Record<string, keyof typeof import("@/messages/en.json")> = {
  accessible_parking: "host_acc_disabled_parking_name",
  disabled_parking: "host_acc_disabled_parking_name",
  lit_path: "host_acc_lit_path_name",
  step_free_access: "host_acc_step_free_name",
  step_free: "host_acc_step_free_name",
  wide_entrance: "host_acc_wide_entrance_name",
  entrance_32: "host_acc_wide_entrance_name",
  pool_hoist: "host_acc_pool_hoist_name",
  ceiling_hoist: "host_acc_ceiling_hoist_name",
};

interface EditorSidebarProps {
  presentation?: "host" | "admin";
  editorTab: "space" | "arrival" | "preferences";
  setEditorTab: (tab: "space" | "arrival" | "preferences") => void;
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
  routeBase?: string;
}

const ADMIN_EDITOR_SECTIONS = [
  { group: "Admin review", items: [["admin-review", "Review & controls"], ["audit-history", "Audit history"]] },
  { group: "Your space", items: [["title", "Listing title"], ["description", "Description"], ["propertyType", "Property type"], ["location", "Location"], ["guests", "Guest capacity"], ["sleeping-arrangements", "Rooms & beds"], ["photos", "Photos & photo tour"], ["amenities", "Amenities"], ["accessibility", "Accessibility"], ["about-host", "About host"], ["pricing", "Pricing"], ["availability", "Availability"], ["house-rules", "House rules"], ["guests-safety", "Guest safety"], ["cancellation-policy", "Cancellation"]] },
  { group: "Arrival guide", items: [["check-in-out", "Check-in & checkout"], ["directions", "Directions"], ["check-in-method", "Check-in method"], ["wifi-details", "Wi-Fi"], ["house-manual", "House manual"], ["parking", "Parking"], ["checkout-instructions", "Checkout instructions"], ["guidebooks", "Guidebooks"], ["interaction-preferences", "Interaction preferences"]] },
  { group: "Preferences", items: [["listing-status", "Listing status"], ["language", "Languages"], ["guest-requirements", "Guest requirements"], ["local-laws", "Local laws"], ["regulations", "Regulations"], ["taxes", "Taxes"], ["homyz-org-stays", "Homyz.org stays"], ["custom-link", "Custom listing link"], ["remove-listing", "Remove listing"]] },
] as const;

function AdminEditorSidebar({
  activeSection,
  setActiveSection,
  listing,
  routeBase = "/admin/listings",
}: Pick<EditorSidebarProps, "activeSection" | "setActiveSection" | "listing" | "routeBase">) {
  const statusLabel = listing.published
    ? "Published"
    : listing.status === "PENDING_APPROVAL"
      ? "Pending Approval"
      : listing.status === "REJECTED"
        ? "Action Needed"
        : "Draft";

  const statusBg = listing.published
    ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
    : listing.status === "PENDING_APPROVAL"
      ? "bg-amber-500/10 text-amber-700 border-amber-200"
      : listing.status === "REJECTED"
        ? "bg-rose-500/10 text-rose-700 border-rose-200"
        : "bg-zinc-500/10 text-zinc-600 border-zinc-200";

  return (
    <aside className="admin-editor-sidebar rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] flex flex-col">
      {/* Header section */}
      <div className="border-b border-[var(--border-subtle)] pb-3 pt-1 px-1 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={routeBase || "/admin/listings"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface)] transition-all cursor-pointer shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <svg className="h-3.5 w-3.5 text-[var(--muted-foreground)] dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </Link>

          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${statusBg}`}>
            {statusLabel}
          </span>
        </div>

        <div className="pt-0.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-md bg-amber-500/15 text-amber-700">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </span>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Listing navigation
            </p>
          </div>
          <p className="truncate text-sm font-bold text-[var(--foreground)]" title={listing.title || "Untitled listing"}>
            {listing.title || "Untitled listing"}
          </p>
        </div>
      </div>

      {/* Navigation list */}
      <nav className="mt-2.5 flex-1 min-h-0 overflow-y-auto px-0.5 pb-2 custom-scrollbar space-y-3.5" aria-label="Admin listing sections">
        {ADMIN_EDITOR_SECTIONS.map((section) => (
          <div key={section.group} className="space-y-0.5">
            <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)] opacity-80">
                {section.group}
              </span>
              <span className="text-[10px] font-medium text-[var(--muted-foreground)] opacity-50">
                {section.items.length}
              </span>
            </div>

            {section.items.map(([id, label]) => {
              const active =
                activeSection === id ||
                (id === "photos" && activeSection === "photo-tour") ||
                (id === "custom-link" && activeSection === "customlink");
              const destructive = id === "remove-listing";

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all duration-150 ${active
                    ? "bg-amber-500 text-zinc-950 font-bold shadow-2xs"
                    : destructive
                      ? "text-rose-600 hover:bg-rose-50/80 hover:text-rose-700"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] hover:translate-x-0.5"
                    }`}
                >
                  <span className="truncate">{label}</span>
                  <svg
                    className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${active ? "opacity-90 text-zinc-950 translate-x-0.5" : "opacity-40 group-hover:opacity-80 group-hover:translate-x-0.5"
                      }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function EditorSidebar({
  presentation = "host",
  routeBase = "/admin/listings",
  editorTab,
  setEditorTab,
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
  const { t } = useLanguage();
  const sidebarScrollRef = React.useRef<HTMLDivElement>(null);
  const sidebarScrollTrackRef = React.useRef<HTMLDivElement>(null);
  const sidebarScrollFrameRef = React.useRef<number | null>(null);
  const [sidebarScrollThumb, setSidebarScrollThumb] = React.useState({ height: 0, top: 0, visible: false });

  const updateSidebarScrollThumb = React.useCallback(() => {
    if (sidebarScrollFrameRef.current !== null) cancelAnimationFrame(sidebarScrollFrameRef.current);

    sidebarScrollFrameRef.current = requestAnimationFrame(() => {
      const element = sidebarScrollRef.current;
      if (!element) return;

      const hasOverflow = element.scrollHeight > element.clientHeight + 1;
      const trackHeight = sidebarScrollTrackRef.current?.clientHeight || element.clientHeight;
      // The reference uses a compact, fixed-size visual thumb instead of the
      // browser's proportional thumb. Its travel still maps 1:1 to scrollTop.
      const height = hasOverflow ? Math.min(60, trackHeight) : 0;
      const maxTop = Math.max(0, trackHeight - height);
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
    if (sidebarScrollTrackRef.current) resizeObserver.observe(sidebarScrollTrackRef.current);
    mutationObserver.observe(element, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (sidebarScrollFrameRef.current !== null) cancelAnimationFrame(sidebarScrollFrameRef.current);
    };
  }, [sidebarScrollThumb.visible, updateSidebarScrollThumb]);

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
    return getActiveSafetyItems(computedSafetyState, t);
  }, [computedSafetyState, t]);
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
    ? `${acceptedCoHostCount} ${acceptedCoHostCount === 1 ? (t("host_cohost_singular") || "co-host") : (t("host_cohost_plural") || "co-hosts")}${pendingCoHostCount ? ` · ${pendingCoHostCount} ${t("host_cohost_pending") || "pending"}` : ""}`
    : pendingCoHostCount > 0
      ? `${pendingCoHostCount} ${pendingCoHostCount === 1 ? (t("host_cohost_pending_invitation_singular") || "pending invitation") : (t("host_cohost_pending_invitation_plural") || "pending invitations")}`
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
  // TEMPORARILY DISABLED: guidebooks are off while the feature is paused.
  const hasGuidebooks = false;
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
    return <AdminEditorSidebar activeSection={activeSection} setActiveSection={setActiveSection} listing={listing} routeBase={routeBase} />;
  }

  const sidebar = (
    <aside
      className={`editor-sidebar ${mobileOpen
        ? "flex h-full w-full overflow-hidden border-0 bg-white px-5 pt-6 sm:px-8 sm:pt-8"
        : "hidden border-r border-transparent [border-image:linear-gradient(270deg,#1F1F1F_0%,rgba(31,31,31,0.2)_100%)_1]"
        } min-w-0 flex-col xl:col-span-1 xl:-mt-[109px] xl:flex xl:h-auto xl:w-auto xl:self-stretch xl:overflow-visible xl:border-r xl:border-transparent xl:[border-image:linear-gradient(270deg,#1F1F1F_0%,rgba(31,31,31,0.2)_100%)_1] xl:bg-[rgba(241,241,241,0.5)] xl:px-0 xl:pl-8 xl:pt-[176px]`}
    >
      <div className={`flex w-full min-w-0 flex-col overflow-hidden ${mobileOpen ? "h-full max-h-none bg-white" : "max-h-[calc(100vh-2rem)] rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-xs"} xl:max-h-none xl:self-start xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none`}>
        {/* Header Title & Status Badge */}
        <div className="flex shrink-0 flex-col pb-5 lg:pb-9">
          <div className="flex items-center justify-between">
            <h2>
              {editorTab === "preferences" ? t("host_edit_preferences") : t("host_listing_editor")}
            </h2>
            {mobileOpen && (
              <button
                type="button"
                aria-label="Return to listing form"
                onClick={onMobileClose}
                className="flex h-10 w-10 items-center justify-center text-[#1F1F1F] dark:text-zinc-100 xl:hidden"
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
                {t("host_status_pending_admin_approval")}
              </span>
            )}
            {displayState === "REJECTED" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {t("host_status_changes_required")}
              </span>
            )}
            {displayState === "PUBLISHED" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {t("host_status_published_live")}
              </span>
            )}
            {displayState === "APPROVED" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {isSaudi ? t("host_status_ready_to_publish") : t("host_status_approved")}
              </span>
            )}

            {displayState === "DRAFT" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-200/80 text-zinc-700">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                {t("host_status_draft_incomplete")}
              </span>
            )}
          </div>
        </div>

        {/* Sub-Pills: [Your space] [Arrival guide] ⚙️ (Fixed) */}
        <div className="mb-6 flex shrink-0 items-center justify-between gap-2 lg:mb-12 lg:max-w-[calc(100%-70px)]">
          <div className="flex w-full max-w-none items-center rounded-full border border-[#1F1F1F] bg-white p-1 lg:max-w-[272px] lg:p-1.5 dark:border-zinc-700 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => {
                setEditorTab("space");
                setActiveSection("description");
              }}
              className={`min-h-11 flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer sm:text-sm lg:min-h-[48px] lg:px-4 duration-300 ${editorTab === "space"
                ? "bg-[#FEE08B] text-[#1F1F1F] shadow-2xs dark:bg-amber-400 dark:text-zinc-950"
                : "text-[#1F1F1F] hover:text-white hover:bg-[#1F1F1F] dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                }`}
            >
              {t("host_your_space")}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditorTab("arrival");
                setActiveSection("check-in-out");
              }}
              className={`min-h-11 flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer sm:text-sm lg:min-h-[48px] lg:px-4 duration-300 ${editorTab === "arrival"
                ? "bg-[#FEE08B] text-[#1F1F1F] shadow-2xs dark:bg-amber-400 dark:text-zinc-950"
                : "text-[#1F1F1F] hover:text-white hover:bg-[#1F1F1F] dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                }`}
            >
              {t("host_arrival_guide")}
            </button>
          </div>

          <button
            type="button"
            aria-label="Listing preferences"
            onClick={() => {
              setEditorTab("preferences");
              setActiveSection("listing-status");
            }}
            className={`group flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xs transition-all  duration-300 cursor-pointer lg:h-12 lg:w-12 ${editorTab === "preferences"
              ? "bg-[#FEE08B] hover:bg-[#1f1f1f] border-transparent text-[#1f1f1f] hover:text-white hover:border-[#1f1f1f]"
              : "bg-white border-[#1F1F1F] text-[#727272] hover:bg-[#1F1F1F] dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
          >
            <Image src="/images/icons/setting-icon.svg" alt="" width={24} height={24} className="h-6 w-6 transition-[filter] group-hover:brightness-0 group-hover:invert dark:invert dark:group-hover:invert-0" />
          </button>
        </div>

        {/* Scrollable Sidebar Content Body */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={sidebarScrollRef}
            onScroll={updateSidebarScrollThumb}
            className={`custom-scrollbar h-full min-w-0 touch-pan-y overflow-x-hidden overflow-y-auto space-y-3 pb-8 pr-1 lg:pb-5 lg:pr-[55px] ${editorTab === "space" ? "lg:h-[1850px]" : "lg:h-auto"}`}
          >
            {/* Preferences Cards Stack */}
            {editorTab === "preferences" ? (
              <div className="min-w-0 space-y-3">
                {/* Card 1: Listing status */}
                <div
                  onClick={() => setActiveSection("listing-status")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer dark:bg-zinc-800/90 dark:border-zinc-700 ${activeSection === "listing-status" || activeSection === "listingstatus"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-700 border-indigo-200 dark:border-zinc-600 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 border-white dark:border-zinc-800"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                      {t("host_sidebar_listing_status")}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${displayState === "PUBLISHED" || displayState === "APPROVED"
                        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 border-emerald-500"
                        : displayState === "PENDING_APPROVAL"
                          ? "text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 border-amber-500"
                          : displayState === "REJECTED"
                            ? "text-rose-800 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/60 border-rose-500"
                            : displayState === "READY_TO_SUBMIT"
                              ? "text-indigo-800 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-950/60 border-indigo-500"
                              : "text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 border-zinc-500"
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
                        ? t("host_status_published_live")
                        : displayState === "PENDING_APPROVAL"
                          ? t("host_status_pending_admin_approval")
                          : displayState === "REJECTED"
                            ? t("host_status_changes_required")
                            : displayState === "APPROVED"
                              ? (isSaudi ? t("host_status_ready_to_publish") : t("host_status_approved"))
                              : displayState === "READY_TO_SUBMIT"
                                ? t("host_status_ready_for_review")
                                : t("host_status_draft_incomplete")}
                    </span>
                  </div>
                </div>

                {/* Card 2: Languages */}
                <div
                  onClick={() => setActiveSection("language")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between dark:bg-zinc-800 dark:border-zinc-700 ${activeSection === "language" || activeSection === "languages"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-700 border-indigo-200 dark:border-zinc-600 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 border-white dark:border-zinc-800 hover:border-white dark:hover:border-zinc-700"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                      {t("host_sidebar_languages")}
                    </span>
                    <p
                      className="max-w-[15rem] truncate text-sm font-normal text-zinc-500 dark:text-zinc-400"
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
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt=""
                    aria-hidden="true"
                    width={14}
                    height={9}
                    className="h-3.5 w-3.5 shrink-0 -rotate-90"
                  />
                </div>

                {/* Card 3: Guest requirements */}
                <div
                  onClick={() => setActiveSection("guest-requirements")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between dark:bg-zinc-800 dark:border-zinc-700 ${activeSection === "guest-requirements" || activeSection === "guestrequirements"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-700 border-indigo-200 dark:border-zinc-600 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 border-white dark:border-zinc-800 hover:border-white dark:hover:border-zinc-700"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                      {t("host_sidebar_guest_requirements")}
                    </span>
                    <p className="text-base text-zinc-500 dark:text-zinc-400 font-normal">
                      {listing?.requireProfilePhoto ? t("host_profile_photo_required") : t("host_profile_photo_not_required")}
                    </p>
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt=""
                    aria-hidden="true"
                    width={14}
                    height={9}
                    className="h-3.5 w-3.5 shrink-0 -rotate-90"
                  />
                </div>

                {/* Card 4: Local laws */}
                <div
                  onClick={() => setActiveSection("local-laws")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between dark:bg-zinc-800 dark:border-zinc-700 ${activeSection === "local-laws" || activeSection === "locallaws"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-700 border-indigo-200 dark:border-zinc-600 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 border-white dark:border-zinc-800 hover:border-white dark:hover:border-zinc-700"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                      {t("host_sidebar_local_laws")}
                    </span>
                    <p className="text-base text-zinc-500 dark:text-zinc-400 font-normal">
                      {t("host_sidebar_local_laws_desc")}
                    </p>
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt=""
                    aria-hidden="true"
                    width={14}
                    height={9}
                    className="h-3.5 w-3.5 shrink-0 -rotate-90"
                  />
                </div>

                {/* Card 5: Regulations */}
                <div
                  onClick={() => setActiveSection("regulations")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between dark:bg-zinc-800 dark:border-zinc-700 ${activeSection === "regulations"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-700 border-indigo-200 dark:border-zinc-600 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 border-white dark:border-zinc-800 hover:border-white dark:hover:border-zinc-700"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                      {t("host_sidebar_regulations")}
                    </span>
                    <p className="text-base text-zinc-500 dark:text-zinc-400 font-normal">
                      {t("host_sidebar_regulations_desc")}
                    </p>
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt=""
                    aria-hidden="true"
                    width={14}
                    height={9}
                    className="h-3.5 w-3.5 shrink-0 -rotate-90"
                  />
                </div>

                {/* Card 6: Taxes */}
                <div
                  onClick={() => setActiveSection("taxes")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between dark:bg-zinc-800 dark:border-zinc-700 ${activeSection === "taxes"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-700 border-indigo-200 dark:border-zinc-600 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 border-white dark:border-zinc-800 hover:border-white dark:hover:border-zinc-700"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                      {t("host_sidebar_taxes")}
                    </span>
                    <p className="text-base text-zinc-500 dark:text-zinc-400 font-normal">
                      {t("host_sidebar_taxes_desc")}
                    </p>
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt=""
                    aria-hidden="true"
                    width={14}
                    height={9}
                    className="h-3.5 w-3.5 shrink-0 -rotate-90"
                  />
                </div>

                {/* Card 7: homyz.org stays */}
                <div
                  onClick={() => setActiveSection("homyz-org-stays")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between dark:bg-zinc-800 dark:border-zinc-700 ${activeSection === "homyz-org-stays" ||
                    activeSection === "airbnb-org-stays" ||
                    activeSection === "homyz-stays" ||
                    activeSection === "homyzstays"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-700 border-indigo-200 dark:border-zinc-600 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 border-white dark:border-zinc-800 hover:border-white dark:hover:border-zinc-700"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                      {t("host_sidebar_homyz_org_stays")}
                    </span>
                    {(() => {
                      const org = listing?.discounts?.orgStays;
                      if (org && typeof org === "object" && org.enabled) {
                        const type = org.discountType || org.type || "FREE";
                        if (type === "DISCOUNT") {
                          const pct = Number(org.discountPercentage) || Number(org.discount) || 0;
                          return (
                            <p className="text-base text-zinc-500 dark:text-zinc-400 font-normal">{pct}% off for homyz.org guests</p>
                          );
                        }
                        return <p className="text-base text-zinc-500 dark:text-zinc-400 font-normal">Available for homyz.org guests</p>;
                      }
                      return <p className="text-base text-zinc-500 dark:text-zinc-400 font-normal">{t("host_sidebar_homyz_org_stays_desc") || "Learn how you can help"}</p>;
                    })()}
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt=""
                    aria-hidden="true"
                    width={14}
                    height={9}
                    className="h-3.5 w-3.5 shrink-0 -rotate-90"
                  />
                </div>

                {/* Card 8: Remove listing */}
                <div
                  onClick={() => {
                    setActiveSection("remove-listing");
                    setIsRemoveListingModalOpen?.(true);
                  }}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer flex items-center justify-between dark:bg-zinc-800 dark:border-zinc-700 ${activeSection === "remove-listing" || activeSection === "removelisting"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-700 border-indigo-200 dark:border-zinc-600 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 border-white dark:border-zinc-800 hover:border-white dark:hover:border-zinc-700"
                    }`}
                >
                  <div>
                    <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                      {t("host_sidebar_remove_listing")}
                    </span>
                    <p className="text-base text-zinc-500 dark:text-zinc-400 font-normal">
                      {t("host_sidebar_remove_listing_desc")}
                    </p>
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt=""
                    aria-hidden="true"
                    width={14}
                    height={9}
                    className="h-3.5 w-3.5 shrink-0 -rotate-90"
                  />
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
                              {t("host_photos_label")}
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
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    {t("host_title_heading")}
                  </span>
                  <span className="sm:text-xl text-lg font-normal text-[#727272] block truncate">
                    {editTitle || t("host_untitled_listing")}
                  </span>
                </div>

                {/* 2. Property type */}
                <div
                  onClick={() => setActiveSection("propertyType")}
                  className={`rounded-xl border shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer px-4 py-3 ${activeSection === "propertyType"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-800 border-indigo-200 dark:border-zinc-600 shadow-2xs"
                    : "bg-white dark:bg-zinc-800 border-white dark:border-zinc-700 hover:border-white dark:hover:border-zinc-600"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                    {t("host_property_type_heading")}
                  </span>
                  <span className="text-base font-normal text-[#727272] dark:text-zinc-400 block">
                    {listingTypeLabel(editListingType, t)} · {propertyTypeLabel(editPropertyType, t)}
                  </span>
                </div>

                {/* 3. Pricing */}
                <div
                  onClick={() => setActiveSection("pricing")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "pricing"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    {t("host_pricing_title")}
                  </span>
                  <div className="text-base text-[#727272] space-y-0.5">
                    {smartPricing ? (
                      <>
                        <p className="text-base font-normal text-[#727272]">{t("host_smart_pricing")}</p>
                        <p className="text-base text-[#727272]">
                          {currency} {smartPricingMinPrice} – {currency} {smartPricingMaxPrice}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-normal text-[#727272]">{currency} {editPrice}</p>
                        <p className="text-base text-[#727272]">{weeklyDiscount}% {t("host_weekly_discount")}</p>
                        <p className="text-base text-[#727272]">{monthlyDiscount}% {t("host_monthly_discount")}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* 4. Availability */}
                <div
                  onClick={() => setActiveSection("availability")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "availability"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    {t("host_availability_title")}
                  </span>
                  <div className="text-base text-[#727272] space-y-0.5">
                    <p className="text-base font-normal text-[#727272]">
                      {minNights}-{maxNights} {t("host_nights")}
                    </p>
                    <p className="text-base text-[#727272] font-normal">{advanceNotice} {t("host_advance_notice")}</p>
                    <p className="text-base text-[#727272] font-normal">
                      {allowSameDayRequests ? t("host_same_day_requests_until", { time: sameDayCutoff }) : t("host_same_day_unavailable")}
                    </p>
                  </div>
                </div>

                {/* 5. Number of guests */}
                <div
                  onClick={() => setActiveSection("guests")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "guests"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    {t("host_number_of_guests")}
                  </span>
                  <span className="text-base font-normal text-[#727272] block">
                    {t("host_max_guests_limit", { count: editGuests })}
                  </span>
                </div>

                {/* 5b. Sleeping arrangements */}
                <div
                  onClick={() => setActiveSection("sleeping-arrangements")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "sleeping-arrangements"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    {t("host_sleeping_arrangements_title")}
                  </span>
                  <span className="text-base font-normal text-[#727272] block">
                    {editBedrooms || 1} {editBedrooms === 1 ? t("host_bedroom_single") : t("host_bedroom_plural")} · {editBeds || 1} {editBeds === 1 ? t("host_bed_single") : t("host_bed_plural")}
                  </span>
                </div>

                {/* 6. Description */}
                <div
                  onClick={() => setActiveSection("description")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "description"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs dark:!bg-indigo-950/60 dark:border-indigo-500"
                    : "bg-white border-white hover:border-white dark:bg-zinc-800/90 dark:border-zinc-700 dark:hover:border-zinc-600"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5 dark:text-zinc-100">
                    {t("host_description_heading")}
                  </span>
                  <p className="text-base font-normal text-[#727272] line-clamp-3 leading-relaxed dark:text-zinc-400">
                    {editDescription || t("host_no_description_yet")}
                  </p>
                </div>

                {/* 7. Amenities */}
                <div
                  onClick={() => setActiveSection("amenities")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer text-base font-medium text-[#727272] ${activeSection === "amenities" || activeSection === "add-amenities"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-3">
                    {t("host_amenities_heading")}
                  </span>
                  <div className="space-y-1.5 text-base font-medium text-[#727272]">
                    {editAmenities.length === 0 ? (
                      <span className="text-base font-medium text-[#727272]">{t("host_add_amenities_heading")}</span>
                    ) : (
                      <>
                        {editAmenities.slice(0, 3).map((am) => {
                          const meta = getAmenityMeta(am);
                          const iconSource = AMENITY_ICON_SOURCES[meta.id];
                          const key = getAmenityTranslationKey(meta.id) as keyof typeof import("@/messages/en.json");
                          const translated = t(key);
                          const localizedLabel = translated && translated !== key ? translated : meta.label;
                          return (
                            <div key={meta.id || am} className="flex items-center gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] bg-white">
                                {iconSource ? (
                                  <Image src={iconSource} alt="" width={20} height={20} className="h-4.75 w-4.75 object-contain" />
                                ) : (
                                  <span className="text-base font-normal text-[#727272]">{meta.icon || "✨"}</span>
                                )}
                              </span>
                              <span className="text-base font-normal text-[#727272]">{localizedLabel}</span>
                            </div>
                          );
                        })}
                        {editAmenities.length > 3 && (
                          <span className="text-base font-semibold text-zinc-400 block pt-0.5">
                            +{editAmenities.length - 3} {t("host_more")}
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
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium tracking-tight text-[#1F1F1F] block mb-0.5">
                    {t("host_accessibility_features_title")}
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
                              {ACCESSIBILITY_FEATURE_KEYS[featureId] ? t(ACCESSIBILITY_FEATURE_KEYS[featureId]) : featureId.replace(/_/g, " ")}
                            </span>
                            <span className="shrink-0 text-[10px] text-zinc-400">{detail?.photos.length ?? 0} {t("host_photos_label")}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-base text-[#727272] font-normal">{t("host_add_details")}</span>
                  )}
                </div>

                {/* 9. Location */}
                <div
                  onClick={() => setActiveSection("location")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "location"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-2">{t("host_location_label")}</span>
                  <RealMap
                    address={editAddress}
                    city={editCity}
                    country={editCountry}
                    lat={latitude ?? undefined}
                    lng={longitude ?? undefined}
                    preferInitialCoordinates={true}
                    showExactLocation={showExactLocation}
                    className="rounded-[10px] overflow-hidden border border-zinc-200/156 relative h-24 mb-2.5 pointer-events-none"
                  />
                  <span className="text-base font-normal text-[#727272] block truncate">
                    {editAddress
                      ? `${editAddress}, ${editCity}, ${editCountry}`
                      : t("host_location_placeholder")}
                  </span>
                </div>

                {/* 10. About the host */}
                <div
                  onClick={() => setActiveSection("about-host")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "about-host"
                    ? "!bg-[#E9EBFF] border-indigo-200"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-4">
                    {t("host_about_the_host")}
                  </span>

                  <div className="grid grid-cols-2 gap-3 items-center">
                    {/* Left Column: Avatar, Name, Superhost badge */}
                    <div className="flex flex-col items-center justify-center text-center">
                      {listing.host?.image ? (
                        <img
                          src={listing.host.image}
                          alt="Host profile"
                          className="w-16 h-16 rounded-full object-cover text-xs bg-[#D9D9D9]"
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
                      <h4 className="text-base font-normal text-[#727272] mt-2 block leading-tight truncate max-w-[120px]">
                        {listing.host?.name || "Host"}
                      </h4>
                      <span className="text-base text-[#727272] font-normal mt-0.5 block leading-tight">
                        {listing.host?.isSuperhost ? t("host_superhost") : (listing.host?.badge || t("host_superhost"))}
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
                          {t("host_review_single")}
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
                          {t("host_rating_label")}
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
                          {t("host_years_hosting")}
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
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-medium text-[#1F1F1F] block">{t("host_cohost_label")}</span>
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
                    <span className="text-base text-[#727272] font-normal block">{t("host_add_details")}</span>
                  )}
                </div>

                {/* 12. Booking settings */}
                <div
                  onClick={() => setActiveSection("booking-settings")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "booking-settings"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1f1f1f] block mb-0.5">
                    {t("host_booking_settings_title")}
                  </span>
                  <p className="text-base text-[#727272] font-normal">
                    {bookingMethod === "first-three"
                      ? t("host_approve_first_3")
                      : bookingMethod === "instant"
                        ? requireGoodTrackRecord ? t("host_instant_track_record") : t("host_use_instant_book")
                        : t("host_approve_all")}
                  </p>
                </div>

                {/* 13. House rules */}
                <div
                  onClick={() => setActiveSection("house-rules")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "house-rules"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-3">{t("host_house_rules")}</span>
                  <div className="space-y-3 text-base text-[#727272] font-normal">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#1F1F1F] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <polyline points="12 6 12 16 14" />
                      </svg>
                      <span>{t("host_checkin_after", { time: formatTimeDisplay(checkInStart, "3:00 pm") })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#1F1F1F] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{t("host_checkout_before", { time: formatTimeDisplay(checkOutTime, "6:00 pm") })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#1F1F1F] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span>
                        {t("host_max_guests_limit", { count: maxGuestsCount || editGuests || 1 })}
                      </span>
                    </div>
                    {extraHouseRules.length > 0 && (
                      <p className="pt-1.5 text-base text-[#727272] font-normal hover:text-[#1F1F1F] transition-all duration-300 hover:underline">+{extraHouseRules.length} {t("host_more")}</p>
                    )}
                  </div>
                </div>

                {/* 14. Guests safety */}
                <div
                  onClick={() => setActiveSection("guests-safety")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "guests-safety"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-2.5">{t("host_guest_safety_title")}</span>
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
                          +{activeSafetyItems.length - 3} {t("host_more")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 text-base text-[#727272] font-normal">
                      <div className="flex items-center gap-2.5">
                        <SafetySidebarIcon type="co" />
                        <span className="text-[#727272] text-base font-medium leading-tight">
                          {t("host_co_alarm_not_reported")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <SafetySidebarIcon type="smoke" />
                        <span className="text-[#727272] text-base font-medium leading-tight">
                          {t("host_smoke_alarm_not_reported")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 15. Cancellation policy */}
                <div
                  onClick={() => setActiveSection("cancellation-policy")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "cancellation-policy"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-normal text-[#1f1f1f] block mb-1">
                    {t("host_cancellation_policy_title")}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-base text-zinc-500 font-normal">
                      {t("host_for_short_term", { policy: cancellationPolicyLabel(cancellationPolicy, t) })}
                    </p>
                    <p className="text-base text-zinc-500 font-normal">
                      {t("host_for_long_term", { policy: longTermCancellationPolicy === "STRICT" ? t("host_strict_long_term") : t("host_firm_long_term") })}
                    </p>
                  </div>
                </div>

                {/* 16. Custom link */}
                <div
                  onClick={() => setActiveSection("custom-link")}
                  className={`rounded-xl border border-white dark:border-zinc-800 bg-white dark:bg-zinc-800/80 px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] dark:shadow-none transition-all cursor-pointer ${activeSection === "custom-link"
                    ? "!bg-[#E9EBFF] dark:!bg-zinc-800 border-indigo-200 dark:border-zinc-700 shadow-2xs"
                    : "bg-white dark:bg-zinc-800/80 border-white dark:border-zinc-800 hover:border-white dark:hover:border-zinc-700"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block mb-0.5">
                    {t("host_custom_link")}
                  </span>
                  <p className="text-base text-zinc-500 dark:text-zinc-400 font-normal truncate" title={customSlug ? `homyz.com/stay/${customSlug}` : undefined}>
                    {customSlug ? `homyz.com/stay/${customSlug}` : t("host_add_details")}
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
                    ? "border-indigo-200 !bg-[#E9EBFF]"
                    : "border-white bg-white hover:border-white"
                    }`}
                >
                  <span className="mb-1 block text-base font-medium text-[#1F1F1F]">{t("host_checkin")}</span>
                  <span className="block border-b border-zinc-300 pb-2 text-base text-[#727272]">{checkInStart === "Flexible" ? (t("host_flexible") || "Flexible") : (checkInStart || "3:00 PM")}</span>
                  <span className="mt-2 block text-base font-medium text-[#1F1F1F]">{t("host_checkout")}</span>
                  <span className="block text-base text-[#727272]">{checkOutTime === "Flexible" ? (t("host_flexible") || "Flexible") : (checkOutTime || "12:00 PM")}</span>
                </button>

                {/* Card 2: Check-in method */}
                <div
                  onClick={() => setActiveSection("check-in-method")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "check-in-method"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    {t("host_checkin_method")}
                  </span>
                  <p className="text-base text-[#1F1F1F] font-normal">
                    {getCheckInMethodLabel(checkInMethod, t)}
                  </p>
                </div>

                {/* Card 2: Wifi details */}
                <div
                  onClick={() => setActiveSection("wifi-details")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "wifi-details"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    {t("host_wifi_details")}
                  </span>
                  <p className="text-base text-zinc-500 font-normal">
                    {wifiNetwork ? wifiNetwork : t("host_add_details")}
                  </p>
                </div>

                <div
                  onClick={() => setActiveSection("directions")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "directions"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-base font-medium text-[#1F1F1F]">
                      {t("host_directions")}
                    </span>

                  </div>
                  <p className="text-base text-zinc-500 font-normal truncate">
                    {directions && directions.trim() ? directions : t("host_add_details")}
                  </p>
                </div>

                {/* Card 3: House manual */}
                <div
                  onClick={() => setActiveSection("house-manual")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "house-manual"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    {t("host_house_manual")}
                  </span>
                  <p className="text-base text-zinc-500 font-normal">
                    {houseManual ? houseManual.slice(0, 30) + "..." : t("host_add_details")}
                  </p>
                </div>

                {/* Card 3b: Parking */}
                <div
                  onClick={() => setActiveSection("parking")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "parking"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    {t("host_parking")}
                  </span>
                  <p className="text-base text-zinc-500 font-normal">
                    {parkingAvailable ? `${parkingType || "Free"} parking` : t("host_no_parking_specified")}
                  </p>
                </div>

                {/* Card 5: Check-out instructions */}
                <div
                  onClick={() => setActiveSection("checkout-instructions")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "checkout-instructions" ||
                    activeSection === "check-out-instructions" ||
                    activeSection === "checkout" ||
                    activeSection === "check-out"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    {t("host_checkout_instructions")}
                  </span>
                  <p className="text-base text-[#1F1F1F] font-normal truncate">
                    {checkOutInstructions ? checkOutInstructions : t("host_add_details")}
                  </p>
                </div>
                {/* Card 6: Guidebooks */}
                <div
                  onClick={() => setActiveSection("guidebooks")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "guidebooks" || activeSection === "guidebook"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    {t("host_guidebooks")}
                  </span>
                  <p className="text-base text-zinc-500 font-normal line-clamp-2 leading-relaxed">
                    {t("host_create_guidebook_desc")}
                  </p>
                </div>

                {/* Card 7: Interaction preferences (Matches Figma Screenshot 100%) */}
                <div
                  onClick={() => setActiveSection("interaction-preferences")}
                  className={`rounded-xl border border-white bg-white px-4 py-3 shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all cursor-pointer ${activeSection === "interaction-preferences" ||
                    activeSection === "interactionpreferences" ||
                    activeSection === "interaction"
                    ? "!bg-[#E9EBFF] border-indigo-200 shadow-2xs"
                    : "bg-white border-white hover:border-white"
                    }`}
                >
                  <span className="text-base font-medium text-[#1F1F1F] block mb-0.5">
                    {t("host_interaction_preferences")}
                  </span>
                  <p className="text-base text-zinc-500 font-normal">
                    {t("host_add_details")}
                  </p>
                </div>
              </div>
            )}
          </div>
          {sidebarScrollThumb.visible && (
            <div ref={sidebarScrollTrackRef} aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[22px] rounded-[30px] bg-[#fff] xl:block">
              <div
                className="absolute left-0 top-0 w-[22px] rounded-[30px] border border-white bg-[#DDDDDE] shadow-[0_2px_4px_rgba(0,0,0,0.25)] will-change-transform"
                style={{ height: `${sidebarScrollThumb.height}px`, transform: `translate3d(0, ${sidebarScrollThumb.top}px, 0)` }}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return mobileOpen ? (
    <ModalOverlay className="fixed inset-0 z-50 bg-white xl:contents">
      {sidebar}
    </ModalOverlay>
  ) : sidebar;
}
