"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities, react-hooks/set-state-in-effect -- legacy editor integration surface; narrowed incrementally outside E4. */

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateListingAction, deleteListingAction, publishListingAction, unpublishListingAction } from "@/actions/host/listings";
import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Footer } from "@/components/dashboard/footer";
import { RealMap } from "@/components/ui/real-map";
import { Container } from "@/components/ui/container";
import { toast } from "@/components/ui/toast";
import { EditorSidebar } from "./components/EditorSidebar";
import { GuestsSafetyView } from "./components/GuestsSafetyView";
import { PropertyDetailsViews } from "./components/PropertyDetailsViews";
import { PricingAndBookingViews } from "./components/PricingAndBookingViews";
import { HostAndLocationViews } from "./components/HostAndLocationViews";
import { HouseRulesAndArrivalViews } from "./components/HouseRulesAndArrivalViews";
import { PhotoTourManager } from "./components/PhotoTourManager";
import { RemoveListingModal } from "./components/RemoveListingModal";
import { ListingStatusView, computeMissingRequirements, getListingDisplayState } from "./components/ListingStatusView";
import { isSaudiArabia } from "@/lib/location/address-countries";
import type { OrgStaysConfig } from "./components/AirbnbOrgStaysView";
import { SectionKey, sectionToSlug, slugToSection } from "./section-helpers";
import {
  type GuestSafetyState,
  parseSafetyData,
  serializeSafetyData,
} from "./components/guest-safety-helpers";
import { normalizeAmenities, normalizeAmenityId } from "@/lib/constants/amenities";
import {
  canonicalCancellationPolicy,
  canonicalListingType,
  canonicalPropertyType,
  normalizeAccessibilityFeatureDetails,
  normalizeAccessibilityFeatureIds,
  normalizeMostLikeSelection,
  type AccessibilityFeatureDetail,
} from "@/lib/constants/listing-enums";
import { normalizeSlug } from "@/lib/utils/slug";
import { clampWeekendPremium, computeWeekendPrice, deriveWeekendPremium } from "@/lib/utils/listing-pricing";
import { getCurrencyForCountry } from "@/lib/currency";
import {
  normalizePhotoRoomAssignments,
  type PhotoRoomAssignment,
} from "@/lib/listing/photo-room-assignments";

type ConfigurableDiscount = "weekly" | "monthly" | "last_minute";

const DEFAULT_DISCOUNT_PERCENTAGES: Record<ConfigurableDiscount, number> = {
  weekly: 10,
  monthly: 25,
  last_minute: 15,
};

function discountPercentage(discounts: Record<string, unknown> | null | undefined, period: ConfigurableDiscount) {
  const entry = discounts?.[period];
  if (entry === true) return DEFAULT_DISCOUNT_PERCENTAGES[period];
  if (!entry || typeof entry !== "object" || (entry as Record<string, unknown>).enabled === false) return 0;
  const value = (entry as Record<string, unknown>).percentage;
  return typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_DISCOUNT_PERCENTAGES[period];
}

function isDiscountEnabled(discounts: Record<string, unknown> | null | undefined, period: ConfigurableDiscount) {
  const entry = discounts?.[period];
  return entry === true || (
    typeof entry === "object" &&
    entry !== null &&
    !Array.isArray(entry) &&
    (entry as Record<string, unknown>).enabled !== false
  );
}

export interface HostListingData {
  id: string;
  title: string;
  description: string;
  price: number; // in cents
  weekdayBasePrice?: number | null;
  smartPricing?: boolean;
  smartPricingMinPrice?: number | null;
  smartPricingMaxPrice?: number | null;
  published: boolean;
  status: string;
  hostingType: string;
  placeCategory?: string | null;
  propertyType: string;
  listingType: string;
  latitude?: number | null;
  longitude?: number | null;
  showExactLocation?: boolean;
  locationSearch?: string | null;
  shortAddress?: string | null;
  apartment?: string | null;
  highlights?: string[];
  discounts?: Record<string, unknown> | null;
  safetyDisclosures?: string[];
  address: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  // Professional Property Details
  propertySize?: number | null;
  propertySizeUnit?: string | null;
  listingFloor?: number | null;
  totalFloors?: number | null;
  yearBuilt?: number | null;
  yearRenovated?: number | null;
  privateEntrance?: boolean | null;
  elevatorAvailable?: boolean | null;
  stairsRequired?: boolean | null;
  rooms?: Array<{
    id: string;
    name: string;
    type: "BEDROOM" | "LIVING_ROOM" | "OTHER";
    beds: Array<{ type: string; count: number }>;
  }> | null;
  fullBathrooms?: number | null;
  halfBathrooms?: number | null;
  privateBathrooms?: number | null;
  sharedBathrooms?: number | null;
  parkingAvailable?: boolean | null;
  parkingType?: string | null;
  parkingSpaces?: number | null;
  parkingReservation?: boolean | null;
  guestAccess?: string[];
  languages?: string[];
  safetyEquipment?: string[];
  safetyHazards?: string[];
  accessibilityFeatures?: string[];
  accessibilityDetails?: AccessibilityFeatureDetail[];
  views?: string[];
  locationFeatures?: string[];
  petsAllowed?: boolean | null;
  maxPets?: number | null;
  petFee?: number | null;
  petRestrictions?: string | null;
  dogsAllowed?: boolean | null;
  catsAllowed?: boolean | null;
  smokingAllowed?: boolean | null;
  smokingLocation?: string | null;
  eventsAllowed?: boolean | null;
  childrenAllowed?: boolean | null;
  infantsAllowed?: boolean | null;
  photographyAllowed?: boolean | null;
  quietHours?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  additionalRules?: string | null;
  directions?: string | null;
  parkingInstructions?: string | null;
  checkInInstructions?: string | null;
  checkOutInstructions?: string | null;
  houseManual?: string | null;
  wifiNetwork?: string | null;
  wifiPassword?: string | null;
  doorCode?: string | null;
  lockboxCode?: string | null;
  photos: string[];
  photoRoomAssignments?: PhotoRoomAssignment[];
  amenities: string[];
  houseRules: string[];
  checkInMethod: string;
  checkInStart: string;
  checkInEnd: string;
  checkOutTime: string;
  cancellationPolicy: string;
  longTermCancellationPolicy?: string | null;
  nonRefundableDiscountPercentage?: number | null;
  bookingMessage?: string | null;
  requireProfilePhoto?: boolean;
  requireGoodTrackRecord?: boolean;
  bookingApprovalMode?: "FIRST_THREE" | "INSTANT" | "MANUAL";
  approvedBookingCount?: number;
  instantBook: boolean;
  minNights: number;
  maxNights: number;
  advanceNotice?: string | null;
  sameDayCutoff?: string | null;
  allowSameDayRequests?: boolean | null;
  blockedDates: string[];
  cleaningFee: number;
  securityDeposit: number;
  weekendPrice: number | null;
  weekendPremium?: number | null;
  isPaused: boolean;
  isFeatured: boolean;
  customSlug?: string | null;
  requestedChanges: any;
  rejectionReason: string | null;
  submittedAt?: Date | string | null;
  resubmittedAt?: Date | string | null;
  approvedAt?: Date | string | null;
  reapprovalRequired?: boolean;
  reapprovalReason?: string | null;
  host: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    createdAt: Date | string;
    publicProfile: Record<string, unknown> | null;
  };
  coHosts?: Array<{
    id: string; email: string | null; phone: string | null; status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
    invitedAt: Date | string; expiresAt: Date | string | null; acceptedAt: Date | string | null;
    user: { id: string; name: string | null; image: string | null } | null;
  }>;
}


interface AccessibilityFeature {
  id: string;
  name: string;
  icon: string;
  description?: string;
  hasFeature: boolean;
}

const ARRIVAL_SECTIONS: SectionKey[] = [
  "arrival-guide",
  "check-in-out",
  "parking",
  "directions",
  "check-in-method",
  "wifi-details",
  "house-manual",
  "checkout-instructions",
  "check-out-instructions",
  "checkout",
  "check-out",
  "checkout-page",
  "check-out-page",
  "checkoutpage",
  "guidebooks",
  "guidebook",
  "interaction-preferences",
  "interactionpreferences",
];

const PREFERENCE_SECTIONS: SectionKey[] = [
  "listing-status",
  "listingstatus",
  "language",
  "languages",
  "guest-requirements",
  "guestrequirements",
  "local-laws",
  "locallaws",
  "regulations",
  "taxes",
  "homyz-stays",
  "homyzstays",
  "homyz-org-stays",
  "airbnb-org-stays",
  "airbnb-stays",
  "remove-listing",
  "removelisting",
];

type PreferenceDraft = {
  languageIds: string[];
  requireProfilePhoto: boolean;
  listingStatus: "listed" | "unlisted";
};

function preferenceDraftMatches(left: PreferenceDraft, right: PreferenceDraft) {
  return (
    left.requireProfilePhoto === right.requireProfilePhoto &&
    left.listingStatus === right.listingStatus &&
    left.languageIds.length === right.languageIds.length &&
    left.languageIds.every((languageId, index) => languageId === right.languageIds[index])
  );
}

export function HostListingEditorClient({
  listing: initialListing,
  initialSection,
  isLoading = false,
  initialGuidebooks,
}: {
  listing: HostListingData;
  initialSection?: SectionKey;
  isLoading?: boolean;
  initialGuidebooks?: any[];
}) {
  const router = useRouter();
  const [listing, setListing] = useState<HostListingData>(initialListing);
  const [activeSection, setActiveSectionState] = useState<SectionKey>(initialSection || "propertyType");
  const [editorTab, setEditorTab] = useState<"space" | "arrival" | "preferences">(
    initialSection && PREFERENCE_SECTIONS.includes(initialSection)
      ? "preferences"
      : initialSection && ARRIVAL_SECTIONS.includes(initialSection)
        ? "arrival"
        : "space"
  );
  // Start with the mobile navigation surface so a listing never flashes its
  // form before the host chooses a section from the Editor Sidebar.
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);
  const activeSectionRef = useRef(activeSection);
  const requestSectionNavigationRef = useRef<(section: SectionKey, fromHistory?: boolean) => void>(() => {});
  const requestBrowserLeaveRef = useRef<(destination: string) => void>(() => {});

  const applySectionNavigation = useCallback(
    (newSection: SectionKey, updateHistory = true) => {
      setActiveSectionState(newSection);
      if (PREFERENCE_SECTIONS.includes(newSection)) {
        setEditorTab("preferences");
      } else if (ARRIVAL_SECTIONS.includes(newSection)) {
        setEditorTab("arrival");
      } else {
        setEditorTab("space");
      }

      const slug = sectionToSlug(newSection);
      const targetPath = `/host/listings/${listing.id}/${slug}`;
      if (updateHistory && typeof window !== "undefined" && window.location.pathname !== targetPath) {
        window.history.pushState(null, "", targetPath);
      }
    },
    [listing.id]
  );

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 1023px)");
    if (!mobileQuery.matches) setIsMobileSidebarOpen(false);

    const closeOnDesktop = () => {
      if (!mobileQuery.matches) setIsMobileSidebarOpen(false);
    };
    mobileQuery.addEventListener("change", closeOnDesktop);
    return () => mobileQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts.length >= 3 && parts[0] === "host" && parts[1] === "listings" && parts[2] === listing.id) {
        const slug = parts[3];
        const targetSec = slugToSection(slug);
        requestSectionNavigationRef.current(targetSec, true);
      } else {
        requestBrowserLeaveRef.current(window.location.href);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [listing.id]);

  // Editable Form States
  const [editTitle, setEditTitle] = useState(listing.title);
  const [editDescription, setEditDescription] = useState(listing.description);
  const [structuredDescription, setStructuredDescription] = useState<Record<string, string>>(() => {
    const value = (listing as any).descriptionSections ?? {};
    return {
      property: typeof value.property === "string" ? value.property : "",
      guestAccess: typeof value.guestAccess === "string" ? value.guestAccess : "",
      guestInteraction: typeof value.guestInteraction === "string" ? value.guestInteraction : "",
      otherDetails: typeof value.otherDetails === "string" ? value.otherDetails : "",
    };
  });
  const [editHostingType, setEditHostingType] = useState(listing.hostingType || "HOME");
  const [whichIsMostLike, setWhichIsMostLike] = useState(() => normalizeMostLikeSelection(listing.placeCategory || listing.propertyType || "APARTMENT"));
  const [editPropertyType, setEditPropertyType] = useState(() => canonicalPropertyType(listing.propertyType));
  const [editListingType, setEditListingType] = useState(() => canonicalListingType(listing.listingType));
  const [buildingFloors, setBuildingFloors] = useState(listing.totalFloors ?? 1);
  const [listingFloor, setListingFloor] = useState(listing.listingFloor ?? 1);
  const [yearBuilt, setYearBuilt] = useState(listing.yearBuilt ? String(listing.yearBuilt) : "");
  const [propertySize, setPropertySize] = useState(listing.propertySize ? String(listing.propertySize) : "");
  const [propertySizeUnit, setPropertySizeUnit] = useState(listing.propertySizeUnit || "SQM");
  const [privateEntrance, setPrivateEntrance] = useState(listing.privateEntrance ?? false);
  const [elevatorAvailable, setElevatorAvailable] = useState(listing.elevatorAvailable ?? false);

  const [editAddress, setEditAddress] = useState(listing.address || "");
  const [editApartment, setEditApartment] = useState(listing.apartment || "");
  const [neighborhoodDescription, setNeighborhoodDescription] = useState<string>(() => {
    const value = (listing as any).neighborhoodDescription;
    return typeof value === "string" ? value : "";
  });
  const [gettingAround, setGettingAround] = useState<string>(() => {
    const value = (listing as any).gettingAround;
    return typeof value === "string" ? value : "";
  });
  const [scenicViews, setScenicViews] = useState<Record<string, boolean>>(() => {
    const viewSet = new Set((Array.isArray((listing as any).views) ? (listing as any).views : []) as string[]);
    const map: Record<string, boolean> = {};
    [
      "bay_view",
      "marina_view",
      "beach_view",
      "mountain_view",
      "canal_view",
      "ocean_view",
      "city_skyline_view",
      "park_view",
      "courtyard_view",
      "pool_view",
      "desert_view",
      "resort_view",
      "garden_view",
      "river_view",
      "golf_course_view",
      "sea_view",
      "harbor_view",
      "valley_view",
      "lake_view",
      "vineyard_view",
    ].forEach((key) => {
      map[key] = viewSet.has(key);
    });
    return map;
  });
  const [editCity, setEditCity] = useState(listing.city || "");
  const [editDistrict, setEditDistrict] = useState(listing.district || "");
  const [editPostalCode, setEditPostalCode] = useState(listing.postalCode || "");
  const [editCountry, setEditCountry] = useState(listing.country || "Saudi Arabia");
  const [showExactLocation, setShowExactLocation] = useState(Boolean(listing.showExactLocation ?? true));
  const [latitude, setLatitude] = useState<number | null>(listing.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(listing.longitude ?? null);
  const [locationResolutionError, setLocationResolutionError] = useState<string | null>(null);
  const [locationIsResolving, setLocationIsResolving] = useState(false);

  const [editGuests, setEditGuests] = useState(listing.guests || 2);
  const [editBedrooms, setEditBedrooms] = useState(listing.bedrooms || 1);
  const [editBeds, setEditBeds] = useState(listing.beds || 1);
  const [editBathrooms, setEditBathrooms] = useState(listing.bathrooms || 1);
  const [fullBathrooms, setFullBathrooms] = useState(listing.fullBathrooms ?? listing.bathrooms ?? 1);
  const [halfBathrooms, setHalfBathrooms] = useState(listing.halfBathrooms ?? 0);
  const [privateBathrooms, setPrivateBathrooms] = useState(listing.privateBathrooms ?? listing.bathrooms ?? 1);
  const [sharedBathrooms, setSharedBathrooms] = useState(listing.sharedBathrooms ?? 0);
  const [rooms, setRooms] = useState<any[]>(
    Array.isArray(listing.rooms) && listing.rooms.length > 0
      ? (listing.rooms as any[])
      : [{ id: "room_1", name: "Bedroom 1", type: "BEDROOM", beds: [{ type: "QUEEN", count: 1 }] }]
  );

  // Arrival guide & parking fields
  const [checkInMethod, setCheckInMethod] = useState(listing.checkInMethod || "SMART_LOCK");
  const [checkInStart, setCheckInStart] = useState(listing.checkInStart || "15:00");
  const [checkInEnd, setCheckInEnd] = useState(listing.checkInEnd || "22:00");
  const [checkOutTime, setCheckOutTime] = useState(listing.checkOutTime || "11:00");
  const [wifiNetwork, setWifiNetwork] = useState(listing.wifiNetwork || "");
  const [wifiPassword, setWifiPassword] = useState(listing.wifiPassword || "");
  const [houseManual, setHouseManual] = useState(listing.houseManual || "");
  const [directions, setDirections] = useState<string>(listing.directions || "");
  const [checkInInstructions, setCheckInInstructions] = useState<string>(listing.checkInInstructions || "");
  const [checkOutInstructions, setCheckOutInstructions] = useState<string>(listing.checkOutInstructions || "");
  const [doorCode, setDoorCode] = useState<string>(listing.doorCode || "");
  const [lockboxCode, setLockboxCode] = useState<string>(listing.lockboxCode || "");

  // Parking State
  const [parkingAvailable, setParkingAvailable] = useState<boolean>(listing.parkingAvailable ?? false);
  const [parkingType, setParkingType] = useState<string>(listing.parkingType || "FREE");
  const [parkingSpaces, setParkingSpaces] = useState<number>(listing.parkingSpaces ?? 1);
  const [parkingReservation, setParkingReservation] = useState<boolean>(listing.parkingReservation ?? false);
  const [parkingInstructions, setParkingInstructions] = useState<string>(listing.parkingInstructions || "");

  // Pricing & Discounts
  const listingCurrency = getCurrencyForCountry(editCountry || listing.country);
  const [editPrice, setEditPrice] = useState(((listing.weekdayBasePrice ?? listing.price) || 0) / 100);
  const [smartPricing, setSmartPricing] = useState(Boolean(listing.smartPricing ?? false));
  const [smartPricingMinPrice, setSmartPricingMinPrice] = useState(() => {
    const value = listing.smartPricingMinPrice ?? Math.max(0, Math.round((listing.price || 0) * 0.9));
    return value / 100;
  });
  const [smartPricingMaxPrice, setSmartPricingMaxPrice] = useState(() => {
    const value = listing.smartPricingMaxPrice ?? Math.max(0, Math.round((listing.price || 0) * 1.1));
    return value / 100;
  });
  const [weekendPremium, setWeekendPremium] = useState(() => {
    const premiumFromListing = listing.weekendPremium ?? deriveWeekendPremium(listing.price, listing.weekendPrice ?? null);
    return clampWeekendPremium(premiumFromListing);
  });
  const [weekendPrice, setWeekendPrice] = useState(() => {
    const baseCents = Math.round((listing.price || 0) * 100);
    const derived = computeWeekendPrice(baseCents, weekendPremium);
    return (listing.weekendPrice ?? derived) / 100;
  });
  useEffect(() => {
    const nextWeekendPrice = computeWeekendPrice(Math.round(editPrice * 100), weekendPremium) / 100;
    setWeekendPrice(nextWeekendPrice);
  }, [editPrice, weekendPremium]);
  const [weeklyDiscount, setWeeklyDiscount] = useState(() => discountPercentage(listing.discounts, "weekly"));
  const [monthlyDiscount, setMonthlyDiscount] = useState(() => discountPercentage(listing.discounts, "monthly"));
  const [lastMinuteDiscount, setLastMinuteDiscount] = useState(() => discountPercentage(listing.discounts, "last_minute"));
  const [lastMinuteEnabled, setLastMinuteEnabled] = useState(() => isDiscountEnabled(listing.discounts, "last_minute"));

  // Availability
  const [minNights, setMinNights] = useState(listing.minNights || 1);
  const [maxNights, setMaxNights] = useState(listing.maxNights || 365);
  const [advanceNotice, setAdvanceNotice] = useState(listing.advanceNotice || "Same day");
  const [sameDayCutoff, setSameDayCutoff] = useState(listing.sameDayCutoff || "12:00 AM");
  const [allowSameDayRequests, setAllowSameDayRequests] = useState(listing.allowSameDayRequests ?? true);

  // Photos & Amenities
  const [editPhotos, setEditPhotos] = useState<string[]>(listing.photos || []);
  const [editPhotoRoomAssignments, setEditPhotoRoomAssignments] = useState<PhotoRoomAssignment[]>(() =>
    normalizePhotoRoomAssignments(listing.photoRoomAssignments, listing.photos || []),
  );
  const handlePhotoTourChange = useCallback((nextPhotos: string[]) => {
    setEditPhotos(nextPhotos);
    setEditPhotoRoomAssignments((current) => normalizePhotoRoomAssignments(current, nextPhotos));
  }, []);
  const [editAmenities, setEditAmenities] = useState<string[]>(() => normalizeAmenities(listing.amenities || []));
  const [selectedLanguageIds, setSelectedLanguageIds] = useState<string[]>(() =>
    Array.isArray(listing.languages)
      ? listing.languages.filter((language) => typeof language === "string" && language.trim().length > 0)
      : []
  );

  // Accessibility State (Matches Figma Screenshots #1 & #2)
  const [accessibilityFeatures, setAccessibilityFeatures] = useState<string[]>(() =>
    normalizeAccessibilityFeatureIds(listing.accessibilityFeatures || [])
  );
  const [accessibilityDetails, setAccessibilityDetails] = useState<AccessibilityFeatureDetail[]>(() =>
    normalizeAccessibilityFeatureDetails(listing.accessibilityDetails || [])
  );
  const [expandedAccessibility, setExpandedAccessibility] = useState<string | null>("disabled_parking");

  // Accordion open state for Description view
  const [openDescAccordion, setOpenDescAccordion] = useState<string | null>("description");
  const [editPropertyDetails, setEditPropertyDetails] = useState(structuredDescription.property);
  const [editGuestAccess, setEditGuestAccess] = useState(structuredDescription.guestAccess);
  const [editGuestInteraction, setEditGuestInteraction] = useState(structuredDescription.guestInteraction);
  const [editOtherDetails, setEditOtherDetails] = useState(structuredDescription.otherDetails);
  const [isEditingAmenities, setIsEditingAmenities] = useState(false);

  // Location Accordion & Sub-sections state
  const [openLocationAccordion, setOpenLocationAccordion] = useState<string | null>("address");
  const [addressPrivacyForCancellation, setAddressPrivacyForCancellation] = useState(false);
  const [locationFeatures, setLocationFeatures] = useState<string[]>(listing.locationFeatures || []);
  const [coHosts, setCoHosts] = useState<NonNullable<HostListingData["coHosts"]>>(listing.coHosts || []);

  const initialRules = Array.isArray(listing.houseRules) ? listing.houseRules : [];
  const normalizedListingAmenities = (listing.amenities || []).map(normalizeAmenityId);

  // Booking Settings State (Matches Figma Screenshots 1 & 2)
  const [bookingMethod, setBookingMethod] = useState<"first-three" | "instant" | "approve">(
    listing.bookingApprovalMode === "FIRST_THREE" ? "first-three"
      : listing.bookingApprovalMode === "MANUAL" || listing.instantBook === false ? "approve" : "instant"
  );
  const [customBookingMessage, setCustomBookingMessage] = useState(listing.bookingMessage || "");
  const [customBookingMessageDraft, setCustomBookingMessageDraft] = useState(listing.bookingMessage || "");
  const [requireProfilePhoto, setRequireProfilePhoto] = useState(listing.requireProfilePhoto ?? false);
  const [requireGoodTrackRecord, setRequireGoodTrackRecord] = useState(listing.requireGoodTrackRecord ?? false);
  const [isTurnOffInstantBookModalOpen, setIsTurnOffInstantBookModalOpen] = useState(false);
  const [pendingInstantBookMethod, setPendingInstantBookMethod] = useState<"first-three" | "approve">("approve");
  const [isCustomMessageModalOpen, setIsCustomMessageModalOpen] = useState(false);
  const [listingStatusSetting, setListingStatusSetting] = useState<"listed" | "unlisted">(
    listing.published && listing.status === "ACTIVE" && !listing.isPaused ? "listed" : "unlisted"
  );
  const [savedPreferenceDraft, setSavedPreferenceDraft] = useState<PreferenceDraft>(() => ({
    languageIds: [...selectedLanguageIds],
    requireProfilePhoto,
    listingStatus: listingStatusSetting,
  }));
  const [hasExternalPreferenceDraft, setHasExternalPreferenceDraft] = useState(false);

  const currentPreferenceDraft: PreferenceDraft = {
    languageIds: [...selectedLanguageIds],
    requireProfilePhoto,
    listingStatus: listingStatusSetting,
  };
  const hasUnsavedPreferenceChanges =
    !preferenceDraftMatches(currentPreferenceDraft, savedPreferenceDraft) || hasExternalPreferenceDraft;

  const restoreSavedPreferenceDraft = useCallback(() => {
    setSelectedLanguageIds(savedPreferenceDraft.languageIds);
    setRequireProfilePhoto(savedPreferenceDraft.requireProfilePhoto);
    setListingStatusSetting(savedPreferenceDraft.listingStatus);
    setHasExternalPreferenceDraft(false);
  }, [savedPreferenceDraft, setHasExternalPreferenceDraft, setListingStatusSetting, setRequireProfilePhoto, setSelectedLanguageIds]);

  const markPreferenceDraftSaved = useCallback((next?: Partial<PreferenceDraft>) => {
    setSavedPreferenceDraft({
      languageIds: next?.languageIds ?? [...selectedLanguageIds],
      requireProfilePhoto: next?.requireProfilePhoto ?? requireProfilePhoto,
      listingStatus: next?.listingStatus ?? listingStatusSetting,
    });
    setHasExternalPreferenceDraft(false);
  }, [listingStatusSetting, requireProfilePhoto, selectedLanguageIds, setHasExternalPreferenceDraft, setSavedPreferenceDraft]);

  // House Rules State (Structured & Real Database Backed)
  const [petsAllowed, setPetsAllowed] = useState<boolean | null>(() => {
    if (listing.petsAllowed !== null && listing.petsAllowed !== undefined) return listing.petsAllowed;
    if (initialRules.some((r) => /no pets/i.test(r))) return false;
    if (initialRules.some((r) => /pets allowed/i.test(r))) return true;
    return null;
  });
  const [maxPetsAllowedToggle, setMaxPetsAllowedToggle] = useState<boolean | null>(null);
  const [maxPetsCount, setMaxPetsCount] = useState<number>(listing.maxPets ?? 1);
  const [petRestrictions, setPetRestrictions] = useState<string>(listing.petRestrictions || "");
  const [dogsAllowed, setDogsAllowed] = useState<boolean>(listing.dogsAllowed ?? true);
  const [catsAllowed, setCatsAllowed] = useState<boolean>(listing.catsAllowed ?? true);
  const [petFee, setPetFee] = useState<number | string>(() => {
    if (listing.petFee !== null && listing.petFee !== undefined) {
      return listing.petFee / 100;
    }
    return "";
  });

  const [eventsAllowed, setEventsAllowed] = useState<boolean | null>(() => {
    if (listing.eventsAllowed !== null && listing.eventsAllowed !== undefined) return listing.eventsAllowed;
    if (initialRules.some((r) => /no (wild )?parties|no events/i.test(r))) return false;
    if (initialRules.some((r) => /events allowed/i.test(r))) return true;
    return true;
  });
  const [smokingAllowed, setSmokingAllowed] = useState<boolean | null>(() => {
    if (listing.smokingAllowed !== null && listing.smokingAllowed !== undefined) return listing.smokingAllowed;
    if (initialRules.some((r) => /no smoking/i.test(r))) return false;
    if (initialRules.some((r) => /smoking allowed/i.test(r))) return true;
    return false;
  });
  const [smokingLocation, setSmokingLocation] = useState<string>(listing.smokingLocation || "OUTSIDE_ONLY");
  const [quietHoursToggle, setQuietHoursToggle] = useState<boolean | null>(() => {
    if (listing.quietHours !== null && listing.quietHours !== undefined) return listing.quietHours;
    return initialRules.some((r) => /quiet hours/i.test(r));
  });
  const [quietHoursStart, setQuietHoursStart] = useState<string>(listing.quietHoursStart || "11:00 pm");
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>(listing.quietHoursEnd || "7:00 am");
  const [commercialFilmingAllowed, setCommercialFilmingAllowed] = useState<boolean | null>(() => {
    if (listing.photographyAllowed !== null && listing.photographyAllowed !== undefined) return listing.photographyAllowed;
    if (initialRules.some((r) => /no commercial filming/i.test(r))) return false;
    if (initialRules.some((r) => /commercial filming allowed/i.test(r))) return true;
    return false;
  });
  const [maxGuestsCount, setMaxGuestsCount] = useState<number>(listing.guests || 1);
  const [additionalHouseRules, setAdditionalHouseRules] = useState<string>(() => {
    if (listing.additionalRules) return listing.additionalRules;
    const knownPattern = /pets|smoking|parties|events|quiet hours|commercial filming/i;
    const customs = initialRules.filter((r) => !knownPattern.test(r));
    return customs.join("\n");
  });
  const [isEditingAdditionalRulesModalOpen, setIsEditingAdditionalRulesModalOpen] = useState<boolean>(false);

  // Guests Safety & Cancellation Policy State (Matches Figma Screenshot 100%)
  const [carbonMonoxideAlarm, setCarbonMonoxideAlarm] = useState<boolean>(
    normalizedListingAmenities.includes("carbon_monoxide_alarm")
  );
  const [smokeAlarm, setSmokeAlarm] = useState<boolean>(
    normalizedListingAmenities.includes("smoke_alarm")
  );
  const [firstAidKit, setFirstAidKit] = useState<boolean>(
    normalizedListingAmenities.includes("first_aid_kit")
  );
  const [fireExtinguisher, setFireExtinguisher] = useState<boolean>(
    normalizedListingAmenities.includes("fire_extinguisher")
  );
  const [cancellationPolicy, setCancellationPolicy] = useState<string>(() =>
    canonicalCancellationPolicy(listing.cancellationPolicy)
  );
  const [longTermCancellationPolicy, setLongTermCancellationPolicy] = useState<"FIRM" | "STRICT">(
    listing.longTermCancellationPolicy === "STRICT" ? "STRICT" : "FIRM"
  );
  const [customSlug, setCustomSlug] = useState<string>(listing.customSlug || "");

  const [isSafetyConsiderationsModalOpen, setIsSafetyConsiderationsModalOpen] = useState(false);
  const [isSafetyDevicesModalOpen, setIsSafetyDevicesModalOpen] = useState(false);
  const [isPropertyInfoModalOpen, setIsPropertyInfoModalOpen] = useState(false);

  const [safetyConsiderations, setSafetyConsiderations] = useState<string[]>(() =>
    Array.isArray(listing.safetyHazards) ? listing.safetyHazards.filter(Boolean).map(String) : []
  );
  const [propertyInfoDetails, setPropertyInfoDetails] = useState<string[]>([]);
  const [guestSafetyState, setGuestSafetyState] = useState<GuestSafetyState>(() => parseSafetyData(listing));

  const missingRequirements = computeMissingRequirements(listing);
  const isSaudi = isSaudiArabia(listing.country);
  const listingDisplayState = getListingDisplayState(
    listing.status,
    listing.published,
    missingRequirements.length,
    listing.country
  );

  const arrivalGuideCompletedCount = [
    Boolean(checkInStart && checkOutTime),
    Boolean(directions && directions.trim().length > 0),
    Boolean(checkInMethod && checkInMethod.trim().length > 0),
    Boolean(wifiNetwork && wifiNetwork.trim().length > 0),
    Boolean(houseManual && houseManual.trim().length > 0),
    Boolean(checkOutInstructions && checkOutInstructions.trim().length > 0),
    Boolean((initialGuidebooks?.length ?? 0) > 0),
    Boolean(editGuestInteraction && editGuestInteraction.trim().length > 0),
  ].filter(Boolean).length;

  const [isSaving, setIsSaving] = useState(false);
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  const completeSectionNavigation = useCallback((newSection: SectionKey, updateHistory = true) => {
    applySectionNavigation(newSection, updateHistory);
  }, [applySectionNavigation]);

  const requestSectionNavigation = useCallback((newSection: SectionKey, fromHistory = false) => {
    if (newSection === activeSectionRef.current) return;

    const leave = () => {
      restoreSavedPreferenceDraft();
      completeSectionNavigation(newSection, !fromHistory);
    };

    if (!hasUnsavedPreferenceChanges) {
      completeSectionNavigation(newSection, !fromHistory);
      return;
    }

    if (fromHistory && typeof window !== "undefined") {
      const currentPath = `/host/listings/${listing.id}/${sectionToSlug(activeSectionRef.current)}`;
      if (window.location.pathname !== currentPath) window.history.pushState(null, "", currentPath);
    }

    pendingNavigationRef.current = leave;
    setIsUnsavedChangesDialogOpen(true);
  }, [completeSectionNavigation, hasUnsavedPreferenceChanges, listing.id, restoreSavedPreferenceDraft]);

  const requestBrowserLeave = useCallback((destination: string) => {
    if (!hasUnsavedPreferenceChanges || typeof window === "undefined") return;

    const currentPath = `/host/listings/${listing.id}/${sectionToSlug(activeSectionRef.current)}`;
    if (window.location.pathname !== currentPath) window.history.pushState(null, "", currentPath);
    pendingNavigationRef.current = () => {
      restoreSavedPreferenceDraft();
      window.location.assign(destination);
    };
    setIsUnsavedChangesDialogOpen(true);
  }, [hasUnsavedPreferenceChanges, listing.id, restoreSavedPreferenceDraft]);

  useEffect(() => {
    requestSectionNavigationRef.current = requestSectionNavigation;
  }, [requestSectionNavigation]);

  useEffect(() => {
    requestBrowserLeaveRef.current = requestBrowserLeave;
  }, [requestBrowserLeave]);

  const setActiveSection = useCallback((newSection: SectionKey) => {
    requestSectionNavigation(newSection);
  }, [requestSectionNavigation]);

  const setMobileEditorSection = useCallback((newSection: SectionKey) => {
    if (newSection === activeSectionRef.current) {
      setIsMobileSidebarOpen(false);
      return;
    }

    if (hasUnsavedPreferenceChanges) {
      pendingNavigationRef.current = () => {
        restoreSavedPreferenceDraft();
        completeSectionNavigation(newSection);
        setIsMobileSidebarOpen(false);
      };
      setIsUnsavedChangesDialogOpen(true);
      return;
    }

    completeSectionNavigation(newSection);
    setIsMobileSidebarOpen(false);
  }, [completeSectionNavigation, hasUnsavedPreferenceChanges, restoreSavedPreferenceDraft]);

  const cancelPreferenceChanges = useCallback((targetSection: SectionKey) => {
    restoreSavedPreferenceDraft();
    completeSectionNavigation(targetSection);
  }, [completeSectionNavigation, restoreSavedPreferenceDraft]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedPreferenceChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedPreferenceChanges]);

  useEffect(() => {
    const handleDocumentNavigation = (event: MouseEvent) => {
      if (
        !hasUnsavedPreferenceChanges ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;

      event.preventDefault();
      pendingNavigationRef.current = () => {
        restoreSavedPreferenceDraft();
        router.push(`${destination.pathname}${destination.search}${destination.hash}`);
      };
      setIsUnsavedChangesDialogOpen(true);
    };

    document.addEventListener("click", handleDocumentNavigation, true);
    return () => document.removeEventListener("click", handleDocumentNavigation, true);
  }, [hasUnsavedPreferenceChanges, restoreSavedPreferenceDraft, router]);

  const setFeedbackMsg = useCallback((msg: { type: "success" | "error"; text: string } | null) => {
    if (!msg) return;
    if (msg.type === "success") {
      toast.success(msg.text);
    } else {
      toast.error(msg.text);
    }
  }, []);

  async function handleSaveSafetyState(newState: GuestSafetyState) {
    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      const serialized = serializeSafetyData({
        devices: newState.devices,
        propertyInfo: newState.propertyInfo,
        considerations: newState.considerations,
        currentAmenities: editAmenities,
      });
      const payload = {
        safetyDisclosures: serialized.safetyDisclosures,
        safetyEquipment: serialized.safetyEquipment,
        safetyHazards: serialized.safetyHazards,
        amenities: serialized.amenities,
      };
      const res = await updateListingAction(listing.id, payload);
      setIsSaving(false);
      if (res.ok && res.data) {
        setListing((prev) => ({
          ...prev,
          safetyDisclosures: serialized.safetyDisclosures,
          safetyEquipment: serialized.safetyEquipment,
          safetyHazards: serialized.safetyHazards,
          amenities: serialized.amenities,
        }));
        setEditAmenities(serialized.amenities);
        setSmokeAlarm(newState.devices.smokeAlarm === true);
        setCarbonMonoxideAlarm(newState.devices.carbonMonoxideAlarm === true);
        setSafetyConsiderations(serialized.safetyHazards);
        setGuestSafetyState(newState);
        setFeedbackMsg({ type: "success", text: "Guest safety saved successfully!" });
      } else {
        setFeedbackMsg({ type: "error", text: (res as any).error || "Failed to save guest safety." });
      }
    } catch (err: any) {
      setIsSaving(false);
      setFeedbackMsg({ type: "error", text: "Error saving guest safety: " + err.message });
    }
  }

  // Save changes handler
  async function handleSaveSection(
    sectionToSave: SectionKey,
    sectionSubtype?: "property" | "access" | "interaction" | "other",
    overrides?: Record<string, any>
  ) {
    setIsSaving(true);
    setFeedbackMsg(null);

    let payload: Record<string, any> = {};

    if (sectionToSave === "title") {
      payload = { title: editTitle };
    } else if (sectionToSave === "description") {
      if (sectionSubtype === "property") {
        const nextSections = {
          ...(listing as any).descriptionSections ?? {},
          property: editPropertyDetails,
        };
        payload = { descriptionSections: nextSections };
      } else if (sectionSubtype === "access") {
        const nextSections = {
          ...(listing as any).descriptionSections ?? {},
          guestAccess: editGuestAccess,
        };
        payload = { descriptionSections: nextSections };
      } else if (sectionSubtype === "interaction") {
        const nextSections = {
          ...(listing as any).descriptionSections ?? {},
          guestInteraction: editGuestInteraction,
        };
        payload = { descriptionSections: nextSections };
      } else if (sectionSubtype === "other") {
        const nextSections = {
          ...(listing as any).descriptionSections ?? {},
          otherDetails: editOtherDetails,
        };
        payload = { descriptionSections: nextSections };
      } else {
        payload = { description: editDescription };
      }
    } else if (sectionToSave === "propertyType") {
      const propertyTypeValue = canonicalPropertyType(editPropertyType);
      const listingTypeValue = canonicalListingType(editListingType);
      const isApartment = [
        "APARTMENT",
        "CONDO",
        "LOFT",
        "RENTAL_UNIT",
        "SERVICED_APARTMENT",
      ].includes(propertyTypeValue) || [
        "APARTMENT",
        "CONDO",
        "LOFT",
        "RENTAL_UNIT",
        "SERVICED_APARTMENT",
      ].includes(canonicalPropertyType(whichIsMostLike));

      payload = {
        hostingType: editHostingType,
        placeCategory: normalizeMostLikeSelection(whichIsMostLike),
        propertyType: propertyTypeValue,
        listingType: listingTypeValue,
        propertySize: propertySize ? parseInt(propertySize, 10) : null,
        propertySizeUnit,
        listingFloor: isApartment ? Number(listingFloor) : null,
        // Total floors applies to any multi-storey building, including houses and villas.
        totalFloors: Number(buildingFloors) || null,
        yearBuilt: yearBuilt ? parseInt(yearBuilt, 10) : null,
        elevatorAvailable: isApartment ? elevatorAvailable : null,
        privateEntrance: !isApartment ? privateEntrance : null,
      };
    } else if (sectionToSave === "guests" || sectionToSave === "sleeping-arrangements") {
      payload = {
        guests: editGuests,
        bedrooms: editBedrooms,
        beds: editBeds,
        bathrooms: editBathrooms,
        fullBathrooms,
        halfBathrooms,
        privateBathrooms,
        sharedBathrooms,
        rooms,
      };
    } else if (sectionToSave === "pricing") {
      if (!editPrice || editPrice <= 0) {
        setIsSaving(false);
        setFeedbackMsg({ type: "error", text: "Nightly price must be greater than zero." });
        return;
      }
      const manualPricing = !smartPricing;
      const nextDiscounts = {
        ...(typeof listing.discounts === "object" && listing.discounts ? listing.discounts : {}),
        ...(manualPricing ? {
          weekly: {
            enabled: Number(weeklyDiscount) > 0,
            percentage: Math.max(0, Math.min(100, Number(weeklyDiscount) || 0)),
          },
          monthly: {
            enabled: Number(monthlyDiscount) > 0,
            percentage: Math.max(0, Math.min(100, Number(monthlyDiscount) || 0)),
          },
          last_minute: {
            enabled: lastMinuteEnabled,
            percentage: Math.max(1, Math.min(100, Number(lastMinuteDiscount) || 15)),
          },
        } : {}),
      };
      payload = {
        price: Math.round(editPrice * 100),
        weekdayBasePrice: Math.round(editPrice * 100),
        smartPricing,
        smartPricingMinPrice: smartPricing ? Math.round(Number(smartPricingMinPrice || 0) * 100) : listing.smartPricingMinPrice ?? null,
        smartPricingMaxPrice: smartPricing ? Math.round(Number(smartPricingMaxPrice || 0) * 100) : listing.smartPricingMaxPrice ?? null,
        ...(manualPricing ? {
          weekendPrice: computeWeekendPrice(Math.round(editPrice * 100), weekendPremium),
          weekendPremium: clampWeekendPremium(weekendPremium),
          discounts: nextDiscounts,
        } : {}),
      };
    } else if (sectionToSave === "availability") {
      const min = Number(minNights);
      const max = Number(maxNights);
      if (!min || min < 1) {
        setIsSaving(false);
        setFeedbackMsg({ type: "error", text: "Minimum stay must be at least 1 night." });
        return;
      }
      if (!max || max < 1) {
        setIsSaving(false);
        setFeedbackMsg({ type: "error", text: "Maximum stay must be at least 1 night." });
        return;
      }
      if (max < min) {
        setIsSaving(false);
        setFeedbackMsg({
          type: "error",
          text: `Maximum stay (${max} nights) cannot be less than minimum stay (${min} nights).`,
        });
        return;
      }
      payload = {
        minNights: min,
        maxNights: max,
        advanceNotice,
        sameDayCutoff,
        allowSameDayRequests,
      };
    } else if (sectionToSave === "photos") {
      payload = {
        photos: editPhotos,
        photoRoomAssignments: editPhotoRoomAssignments,
      };
    } else if (sectionToSave === "amenities" || sectionToSave === "add-amenities") {
      payload = { amenities: normalizeAmenities(editAmenities) };
    } else if (sectionToSave === "location") {
      if (latitude === null || longitude === null || locationResolutionError || locationIsResolving) {
        setIsSaving(false);
        setFeedbackMsg({ type: "error", text: locationResolutionError || "Choose a precise location on the map before saving." });
        return;
      }
      const selectedViews = Object.entries(scenicViews)
        .filter(([, isEnabled]) => Boolean(isEnabled))
        .map(([key]) => key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
      payload = {
        address: editAddress,
        apartment: editApartment || null,
        shortAddress: [editAddress, editCity].filter(Boolean).join(", ") || null,
        locationSearch: [editAddress, editDistrict, editCity, editCountry].filter(Boolean).join(", ") || null,
        neighborhoodDescription,
        gettingAround,
        city: editCity,
        district: editDistrict,
        postalCode: editPostalCode,
        country: editCountry,
        latitude,
        longitude,
        showExactLocation,
        views: selectedViews,
        locationFeatures,
      };
    } else if (sectionToSave === "language" || sectionToSave === "languages") {
      payload = {
        languages: [...new Set(selectedLanguageIds.map((language) => String(language).trim()).filter(Boolean))].slice(0, 20),
      };
    } else if (sectionToSave === "guest-requirements") {
      payload = { requireProfilePhoto };
    } else if (sectionToSave === "parking") {
      payload = {
        parkingAvailable,
        parkingType: parkingAvailable ? parkingType : null,
        parkingSpaces: parkingAvailable ? Number(parkingSpaces) : null,
        parkingReservation: parkingAvailable ? parkingReservation : null,
        parkingInstructions,
      };
    } else if (sectionToSave === "directions") {
      payload = { directions };
    } else if (sectionToSave === "wifi-details") {
      payload = { wifiNetwork, wifiPassword };
    } else if (sectionToSave === "house-manual") {
      payload = { houseManual };
    } else if (sectionToSave === "check-in-method") {
      payload = {
        checkInMethod,
        checkInInstructions,
        doorCode: doorCode || null,
        lockboxCode: lockboxCode || null,
      };
    } else if (
      sectionToSave === "checkout-instructions" ||
      sectionToSave === "check-out-instructions" ||
      sectionToSave === "checkout" ||
      sectionToSave === "check-out" ||
      sectionToSave === "checkout-page" ||
      sectionToSave === "check-out-page" ||
      sectionToSave === "checkoutpage"
    ) {
      payload = {
        checkOutInstructions,
      };
    } else if (sectionToSave === "arrival-guide" || sectionToSave === "check-in-out") {
      payload = {
        checkInMethod,
        checkInStart,
        checkInEnd,
        checkOutTime,
        directions,
        parkingInstructions,
        checkInInstructions,
        checkOutInstructions,
        houseManual,
        wifiNetwork,
        wifiPassword,
        doorCode: doorCode || null,
        lockboxCode: lockboxCode || null,
      };
    } else if (sectionToSave === "booking-settings") {
      payload = {
        instantBook: bookingMethod === "instant",
        bookingMessage: customBookingMessage.trim() || null,
        requireGoodTrackRecord,
        bookingApprovalMode: bookingMethod === "first-three" ? "FIRST_THREE" : bookingMethod === "instant" ? "INSTANT" : "MANUAL",
      };
    } else if (sectionToSave === "house-rules") {
      const rules: string[] = [];
      if (petsAllowed === true) {
        rules.push(maxPetsCount > 1 ? `Pets allowed (up to ${maxPetsCount})` : "Pets allowed");
      } else if (petsAllowed === false) {
        rules.push("No pets");
      }

      if (eventsAllowed === true) {
        rules.push("Events allowed");
      } else if (eventsAllowed === false) {
        rules.push("No events or parties");
      }

      if (smokingAllowed === true) {
        rules.push(`Smoking allowed (${smokingLocation.toLowerCase().replace(/_/g, " ")})`);
      } else if (smokingAllowed === false) {
        rules.push("No smoking inside property");
      }

      if (quietHoursToggle === true) {
        rules.push(`Quiet hours between ${quietHoursStart} - ${quietHoursEnd}`);
      }

      if (commercialFilmingAllowed === true) {
        rules.push("Commercial filming allowed");
      } else if (commercialFilmingAllowed === false) {
        rules.push("No commercial filming");
      }

      if (additionalHouseRules && additionalHouseRules.trim()) {
        const customLines = additionalHouseRules.split("\n").map((l) => l.trim()).filter(Boolean);
        rules.push(...customLines);
      }

      const parsedPetFee =
        petsAllowed && petFee !== "" && petFee !== null && !isNaN(Number(petFee))
          ? Math.round(Number(petFee) * 100)
          : null;

      payload = {
        houseRules: rules,
        guests: Math.max(1, Number(maxGuestsCount) || 1),
        petsAllowed,
        maxPets: petsAllowed ? Number(maxPetsCount) : null,
        petFee: parsedPetFee,
        petRestrictions: petsAllowed ? petRestrictions : null,
        dogsAllowed: petsAllowed ? dogsAllowed : null,
        catsAllowed: petsAllowed ? catsAllowed : null,
        smokingAllowed,
        smokingLocation: smokingAllowed ? smokingLocation : null,
        eventsAllowed,
        photographyAllowed: commercialFilmingAllowed,
        quietHours: quietHoursToggle,
        quietHoursStart: quietHoursToggle ? quietHoursStart : null,
        quietHoursEnd: quietHoursToggle ? quietHoursEnd : null,
        additionalRules: additionalHouseRules,
        checkInStart,
        checkInEnd,
        checkOutTime,
      };
    } else if (sectionToSave === "guests-safety" || sectionToSave === "safety-equipment") {
      const serialized = serializeSafetyData({
        devices: guestSafetyState.devices,
        propertyInfo: guestSafetyState.propertyInfo,
        considerations: guestSafetyState.considerations,
        currentAmenities: editAmenities,
      });

      payload = {
        safetyDisclosures: serialized.safetyDisclosures,
        safetyEquipment: serialized.safetyEquipment,
        safetyHazards: serialized.safetyHazards,
        amenities: serialized.amenities,
      };
      setEditAmenities(serialized.amenities);
      setSmokeAlarm(guestSafetyState.devices.smokeAlarm === true);
      setCarbonMonoxideAlarm(guestSafetyState.devices.carbonMonoxideAlarm === true);
      setSafetyConsiderations(serialized.safetyHazards);
    } else if (sectionToSave === "accessibility") {
      const selectedFeatures = normalizeAccessibilityFeatureIds(accessibilityFeatures);
      const details = normalizeAccessibilityFeatureDetails(accessibilityDetails)
        .filter((detail) => selectedFeatures.includes(detail.featureId) && detail.photos.length > 0);
      payload = {
        accessibilityFeatures: selectedFeatures,
        accessibilityDetails: details,
      };
    } else if (sectionToSave === "cancellation-policy") {
      payload = {
        cancellationPolicy: canonicalCancellationPolicy(cancellationPolicy),
        longTermCancellationPolicy,
      };
    } else if (sectionToSave === "custom-link") {
      const normalized = normalizeSlug(customSlug);
      payload = {
        customSlug: normalized || null,
      };
    } else if (sectionToSave === "listing-status" || sectionToSave === "listingstatus") {
      try {
        if (listingStatusSetting === "listed") {
          const res = await publishListingAction(listing.id);
          setIsSaving(false);
          if (res.ok && res.data) {
            if (res.data.published || isSaudiArabia(listing.country)) {
              setListing((prev) => ({
                ...prev,
                published: true,
                status: "ACTIVE",
                isPaused: false,
              }));
              setListingStatusSetting("listed");
              markPreferenceDraftSaved({ listingStatus: "listed" });
              setFeedbackMsg({ type: "success", text: "Listing published successfully! Your property is now live." });
            } else {
              setListing((prev) => ({
                ...prev,
                published: false,
                status: "PENDING_REVIEW",
                isPaused: false,
              }));
              setListingStatusSetting("unlisted");
              markPreferenceDraftSaved({ listingStatus: "unlisted" });
              setFeedbackMsg({ type: "success", text: "Listing submitted for Admin approval. It will go live after approval." });
            }
          } else {
            setFeedbackMsg({ type: "error", text: (res as any).error || "Failed to publish listing. Please verify all required listing fields." });
          }
        } else {
          const res = await unpublishListingAction(listing.id);
          setIsSaving(false);
          if (res.ok && res.data) {
            setListing((prev) => ({ ...prev, published: false, status: "DRAFT" }));
            setListingStatusSetting("unlisted");
            markPreferenceDraftSaved({ listingStatus: "unlisted" });
            setFeedbackMsg({ type: "success", text: "Listing unpublished successfully." });
          } else {
            setFeedbackMsg({ type: "error", text: (res as any).error || "Failed to unpublish listing." });
          }
        }
      } catch (err: any) {
        setIsSaving(false);
        setFeedbackMsg({ type: "error", text: "Error saving listing status: " + err.message });
      }
      return;
    } else {
      setIsSaving(false);
      setFeedbackMsg({ type: "error", text: "This setting is not available yet." });
      return;
    }

    // Apply explicit overrides (used by inner components to pass freshly typed values)
    if (overrides && typeof overrides === "object") {
      payload = { ...payload, ...overrides };
    }

    try {
      const res = await updateListingAction(listing.id, payload);
      setIsSaving(false);
      if (res.ok && res.data) {
        setListing((prev) => ({ ...prev, ...payload }));
        if (PREFERENCE_SECTIONS.includes(sectionToSave)) {
          markPreferenceDraftSaved();
        }
        if (payload.guests !== undefined) {
          setEditGuests(payload.guests);
          setMaxGuestsCount(payload.guests);
        }
        if (payload.smartPricing !== undefined) {
          setSmartPricing(Boolean((res.data as any).smartPricing ?? payload.smartPricing));
        }
        if (payload.smartPricingMinPrice !== undefined) {
          setSmartPricingMinPrice((Number((res.data as any).smartPricingMinPrice ?? payload.smartPricingMinPrice ?? 0)) / 100);
        }
        if (payload.smartPricingMaxPrice !== undefined) {
          setSmartPricingMaxPrice((Number((res.data as any).smartPricingMaxPrice ?? payload.smartPricingMaxPrice ?? 0)) / 100);
        }
        if (payload.amenities !== undefined) {
          const freshAmenities = normalizeAmenities((res.data as any).amenities || payload.amenities);
          setEditAmenities(freshAmenities);
        }
        if (payload.descriptionSections) {
          setStructuredDescription({
            property: payload.descriptionSections.property ?? editPropertyDetails,
            guestAccess: payload.descriptionSections.guestAccess ?? editGuestAccess,
            guestInteraction: payload.descriptionSections.guestInteraction ?? editGuestInteraction,
            otherDetails: payload.descriptionSections.otherDetails ?? editOtherDetails,
          });
        }
        if (payload.neighborhoodDescription !== undefined) {
          setNeighborhoodDescription(payload.neighborhoodDescription ?? "");
        }
        if (payload.gettingAround !== undefined) {
          setGettingAround(payload.gettingAround ?? "");
        }
        if (payload.customSlug !== undefined) {
          setCustomSlug(payload.customSlug || "");
        }
        if (payload.apartment !== undefined) {
          setEditApartment(payload.apartment ?? "");
        }
        if (payload.minNights !== undefined) {
          setMinNights(payload.minNights);
        }
        if (payload.maxNights !== undefined) {
          setMaxNights(payload.maxNights);
        }
        if (payload.advanceNotice !== undefined) {
          setAdvanceNotice(payload.advanceNotice);
        }
        if (payload.sameDayCutoff !== undefined) {
          setSameDayCutoff(payload.sameDayCutoff);
        }
        if (payload.allowSameDayRequests !== undefined) {
          setAllowSameDayRequests(payload.allowSameDayRequests);
        }
        if (payload.directions !== undefined) {
          setDirections(payload.directions || "");
        }
        setFeedbackMsg({ type: "success", text: "Changes saved successfully!" });
      } else {
        setFeedbackMsg({ type: "error", text: (res as any).error || "Failed to update section." });
      }
    } catch (err: any) {
      setIsSaving(false);
      setFeedbackMsg({ type: "error", text: "Error saving: " + err.message });
    }
  }

  async function saveBookingSettings(next: {
    bookingMethod: "first-three" | "instant" | "approve";
    requireGoodTrackRecord: boolean;
    bookingMessage?: string;
  }) {
    if (isSaving) return false;

    const nextMessage = next.bookingMessage ?? customBookingMessage;
    const previous = { bookingMethod, requireGoodTrackRecord, bookingMessage: customBookingMessage };
    const bookingApprovalMode: NonNullable<HostListingData["bookingApprovalMode"]> = next.bookingMethod === "first-three"
      ? "FIRST_THREE"
      : next.bookingMethod === "instant" ? "INSTANT" : "MANUAL";
    const payload = {
      instantBook: next.bookingMethod === "instant",
      requireGoodTrackRecord: next.requireGoodTrackRecord,
      bookingApprovalMode,
      bookingMessage: nextMessage.trim() || null,
    };

    setBookingMethod(next.bookingMethod);
    setRequireGoodTrackRecord(next.requireGoodTrackRecord);
    setCustomBookingMessage(nextMessage);
    setIsSaving(true);
    setFeedbackMsg(null);

    try {
      const res = await updateListingAction(listing.id, payload);
      if (res.ok && res.data) {
        setListing((current) => ({ ...current, ...payload }));
        setFeedbackMsg({ type: "success", text: "Booking settings saved." });
        return true;
      } else {
        setBookingMethod(previous.bookingMethod);
        setRequireGoodTrackRecord(previous.requireGoodTrackRecord);
        setCustomBookingMessage(previous.bookingMessage);
        setFeedbackMsg({ type: "error", text: (res as any).error || "Failed to save booking settings." });
        return false;
      }
    } catch (error: any) {
      setBookingMethod(previous.bookingMethod);
      setRequireGoodTrackRecord(previous.requireGoodTrackRecord);
      setCustomBookingMessage(previous.bookingMessage);
      setFeedbackMsg({ type: "error", text: `Error saving booking settings: ${error.message}` });
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function requestInstantBookOff(bookingMethod: "first-three" | "approve") {
    setPendingInstantBookMethod(bookingMethod);
    setIsTurnOffInstantBookModalOpen(true);
  }

  const handleSaveOrgStays = async (orgConfig: OrgStaysConfig) => {
    setIsSaving(true);
    try {
      const nextDiscounts = {
        ...(typeof listing.discounts === "object" && listing.discounts ? listing.discounts : {}),
        orgStays: orgConfig,
      };
      const res = await updateListingAction(listing.id, { discounts: nextDiscounts });
      if (res.ok) {
        setListing((prev) => ({
          ...prev,
          discounts: nextDiscounts,
        }));
        setFeedbackMsg({ type: "success", text: "Homyz.org stays preferences saved successfully!" });
      } else {
        const message = (res as any).error || "Failed to save preferences.";
        setFeedbackMsg({ type: "error", text: message });
        throw new Error(message);
      }
    } catch (err: any) {
      console.error("Failed to save Airbnb.org stays preferences:", err);
      setFeedbackMsg({ type: "error", text: err?.message || "Failed to save preferences." });
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  async function handleSaveCancellationPolicy(data: {
    cancellationPolicy: string;
    longTermCancellationPolicy: "FIRM" | "STRICT";
    nonRefundable?: boolean;
  }) {
    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      const nextDiscounts = {
        ...(typeof listing.discounts === "object" && listing.discounts ? listing.discounts : {}),
        ...(data.nonRefundable !== undefined ? { non_refundable: data.nonRefundable } : {}),
      };
      const payload = {
        cancellationPolicy: canonicalCancellationPolicy(data.cancellationPolicy),
        longTermCancellationPolicy: data.longTermCancellationPolicy,
        discounts: nextDiscounts,
      };
      const res = await updateListingAction(listing.id, payload);
      setIsSaving(false);
      if (res.ok && res.data) {
        setListing((prev) => ({
          ...prev,
          cancellationPolicy: payload.cancellationPolicy,
          longTermCancellationPolicy: payload.longTermCancellationPolicy,
          discounts: nextDiscounts,
        }));
        setCancellationPolicy(payload.cancellationPolicy);
        setLongTermCancellationPolicy(payload.longTermCancellationPolicy);
        setFeedbackMsg({ type: "success", text: "Cancellation policy saved successfully!" });
        return true;
      } else {
        setFeedbackMsg({ type: "error", text: (res as any).error || "Failed to save cancellation policy." });
        return false;
      }
    } catch (err: any) {
      setIsSaving(false);
      setFeedbackMsg({ type: "error", text: "Error saving cancellation policy: " + err.message });
      return false;
    }
  }

  const [isRemoveListingModalOpen, setIsRemoveListingModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteListing() {
    setIsDeleting(true);
    const res = await deleteListingAction(listing.id);
    setIsDeleting(false);
    if (res.ok) {
      router.push("/host/listings");
    } else {
      setFeedbackMsg({ type: "error", text: (res as any).error || "Failed to delete listing." });
      setShowDeleteModal(false);
    }
  }

  return (
    <div
      suppressHydrationWarning
      className="flex min-h-screen flex-col bg-white pb-12 font-sans text-[#1F1F1F] selection:bg-[#FEE08B] selection:text-[#1F1F1F] lg:pb-0"
    >
      {/* 1. TOP HEADER (Matches Figma Header Bar) */}
      <div className="hidden lg:block">
        <HostHeader user={listing.host} />
      </div>

      {/* 2. TOP NAV TABS (Matches Figma Tab Row: Today, Calendar, Listing, Messages 100%) */}
      <div className="hidden lg:block">
        <HostSubNav activeTab="listing" listingId={listing.id} showRightActions={false} />
      </div>

      <div className="flex justify-end px-8 sm:pt-10 pt-5 lg:hidden">
        <button
          type="button"
          aria-label="Open listing editor"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex h-8 w-8 items-center justify-center text-[#1F1F1F]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="sm:h-7 sm:w-7 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
            <path d="m5 5 14 14M19 5 5 19" />
          </svg>
        </button>
      </div>

      {/* 3. MAIN EDITOR CONTENT AREA (2-Column Figma Split Layout) */}
      <Container>
        <div className="flex-1 grid grid-cols-1 gap-8 sm:py-10 py-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-0 lg:py-0">
          {/* ============================================================ */}
          {/* LEFT COLUMN: MAIN SECTION EDITOR PANEL (lg:col-span-7 or 8) */}
          {/* ============================================================ */}
          <main className="flex min-w-0 flex-col space-y-6 pb-12 lg:col-span-1 lg:pb-12 lg:pt-[58px]">
            {/* Mobile/Tablet Arrival Guide Progress Banner */}
            {editorTab === "arrival" && (
              <div className="block lg:hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F1F1F]">Arrival Guide Progress</span>
                  <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 cursor-pointer"
                  >
                    {arrivalGuideCompletedCount} of 8 completed · View all →
                  </button>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${(arrivalGuideCompletedCount / 8) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Persistent Status Indicator Banner across all edit sections */}
            {activeSection !== "listing-status" && activeSection !== "listingstatus" && (
              <div className="hidden space-y-3">
                {listingDisplayState === "PENDING_APPROVAL" && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in">
                    <div className="flex items-start gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse mt-1 shrink-0" />
                      <div>
                        <div className="font-semibold text-amber-950 text-sm flex items-center gap-2">
                          <span>Listing Status: Pending Admin Approval</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 uppercase">Under Review</span>
                        </div>
                        <p className="text-amber-900 mt-1 leading-relaxed">
                          This listing has already been submitted for approval. You can continue reviewing your listing details, but the property will not become publicly available until the admin approves it.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection("listing-status")}
                      className="shrink-0 px-4 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/60 font-semibold text-amber-950 transition-all cursor-pointer text-xs"
                    >
                      View Status →
                    </button>
                  </div>
                )}

                {listingDisplayState === "REJECTED" && (
                  <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in">
                    <div className="flex items-start gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0" />
                      <div>
                        <div className="font-semibold text-rose-950 text-sm flex items-center gap-2">
                          <span>Listing Status: Changes Required</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase">Action Needed</span>
                        </div>
                        <p className="text-rose-900 mt-1 leading-relaxed line-clamp-2">
                          The admin requested updates before this listing can be approved:{" "}
                          <span className="font-medium">{listing.rejectionReason || "Please review feedback and update details."}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection("listing-status")}
                      className="shrink-0 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-all cursor-pointer text-xs"
                    >
                      View Feedback & Resubmit →
                    </button>
                  </div>
                )}

                {listingDisplayState === "PUBLISHED" && (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-700 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium">Listing Status: Published (Live)</span>
                      <span className="text-emerald-700 font-normal hidden sm:inline">— Guests can find and book your property</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection("listing-status")}
                      className="font-semibold text-emerald-800 hover:underline cursor-pointer"
                    >
                      Manage Status →
                    </button>
                  </div>
                )}

     
                {listingDisplayState === "DRAFT" && (
                  <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-700 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-zinc-400" />
                      <span className="font-semibold">Listing Status: Draft (Incomplete)</span>
                      <span className="text-zinc-500 font-normal hidden sm:inline">
                        — {missingRequirements.length} required {missingRequirements.length === 1 ? "section" : "sections"} remaining
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection("listing-status")}
                      className="font-semibold text-zinc-900 hover:underline cursor-pointer"
                    >
                      View Checklist →
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeSection === "photos" && (
              <PhotoTourManager
                photos={editPhotos}
                photoRoomAssignments={editPhotoRoomAssignments}
                onChange={handlePhotoTourChange}
                onChangeRoomAssignments={setEditPhotoRoomAssignments}
                onSave={() => handleSaveSection("photos")}
                isSaving={isSaving}
                isLoading={isLoading}
              />
            )}

            <PropertyDetailsViews
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              feedbackMsg={null}
              isSaving={isSaving}
              isLoading={isLoading}
              handleSaveSection={handleSaveSection}
              editDescription={editDescription}
              setEditDescription={setEditDescription}
              editPropertyDetails={editPropertyDetails}
              setEditPropertyDetails={setEditPropertyDetails}
              editAccessDetails={editGuestAccess}
              setEditAccessDetails={setEditGuestAccess}
              interactionDetails={editGuestInteraction}
              setInteractionDetails={setEditGuestInteraction}
              otherDetails={editOtherDetails}
              setOtherDetails={setEditOtherDetails}
              openDescAccordion={openDescAccordion}
              setOpenDescAccordion={setOpenDescAccordion}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              whichIsMostLike={whichIsMostLike}
              setWhichIsMostLike={setWhichIsMostLike}
              editPropertyType={editPropertyType}
              setEditPropertyType={setEditPropertyType}
              editListingType={editListingType}
              setEditListingType={setEditListingType}
              buildingFloors={buildingFloors}
              setBuildingFloors={setBuildingFloors}
              listingFloor={listingFloor}
              setListingFloor={setListingFloor}
              yearBuilt={yearBuilt}
              setYearBuilt={setYearBuilt}
              propertySize={propertySize}
              setPropertySize={setPropertySize}
              propertySizeUnit={propertySizeUnit}
              setPropertySizeUnit={setPropertySizeUnit}
              editGuests={editGuests}
              setEditGuests={setEditGuests}
              editBedrooms={editBedrooms}
              setEditBedrooms={setEditBedrooms}
              editBeds={editBeds}
              setEditBeds={setEditBeds}
              editBathrooms={editBathrooms}
              setEditBathrooms={setEditBathrooms}
              fullBathrooms={fullBathrooms}
              setFullBathrooms={setFullBathrooms}
              halfBathrooms={halfBathrooms}
              setHalfBathrooms={setHalfBathrooms}
              privateBathrooms={privateBathrooms}
              setPrivateBathrooms={setPrivateBathrooms}
              sharedBathrooms={sharedBathrooms}
              setSharedBathrooms={setSharedBathrooms}
              privateEntrance={privateEntrance}
              setPrivateEntrance={setPrivateEntrance}
              elevatorAvailable={elevatorAvailable}
              setElevatorAvailable={setElevatorAvailable}
              rooms={rooms}
              setRooms={setRooms}
              editAmenities={editAmenities}
              setEditAmenities={setEditAmenities}
              accessibilityFeatures={accessibilityFeatures}
              setAccessibilityFeatures={setAccessibilityFeatures}
              accessibilityDetails={accessibilityDetails}
              setAccessibilityDetails={setAccessibilityDetails}
              expandedAccessibility={expandedAccessibility}
              setExpandedAccessibility={setExpandedAccessibility}
            />

          <PricingAndBookingViews
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            isSaving={isSaving}
            isLoading={isLoading}
            handleSaveSection={handleSaveSection}
            currency={listingCurrency}
            editPrice={editPrice}
            setEditPrice={setEditPrice}
            smartPricing={smartPricing}
            setSmartPricing={setSmartPricing}
            smartPricingMinPrice={smartPricingMinPrice}
            setSmartPricingMinPrice={setSmartPricingMinPrice}
            smartPricingMaxPrice={smartPricingMaxPrice}
            setSmartPricingMaxPrice={setSmartPricingMaxPrice}
            weekendPrice={weekendPrice}
            weekendPremium={weekendPremium}
            setWeekendPremium={(nextValue) => setWeekendPremium(clampWeekendPremium(nextValue))}
            weeklyDiscount={weeklyDiscount}
            setWeeklyDiscount={setWeeklyDiscount}
            monthlyDiscount={monthlyDiscount}
            setMonthlyDiscount={setMonthlyDiscount}
            lastMinuteDiscount={lastMinuteDiscount}
            setLastMinuteDiscount={setLastMinuteDiscount}
            lastMinuteEnabled={lastMinuteEnabled}
            setLastMinuteEnabled={setLastMinuteEnabled}
            minNights={minNights}
            setMinNights={setMinNights}
            maxNights={maxNights}
            setMaxNights={setMaxNights}
            advanceNotice={advanceNotice}
            setAdvanceNotice={setAdvanceNotice}
            sameDayCutoff={sameDayCutoff}
            setSameDayCutoff={setSameDayCutoff}
            allowSameDayRequests={allowSameDayRequests}
            setAllowSameDayRequests={setAllowSameDayRequests}
            bookingMethod={bookingMethod}
            requireGoodTrackRecord={requireGoodTrackRecord}
            approvedBookingCount={listing.approvedBookingCount ?? 0}
            hasCustomBookingMessage={Boolean(customBookingMessage.trim())}
            saveBookingSettings={saveBookingSettings}
            requestInstantBookOff={requestInstantBookOff}
            openCustomMessage={() => {
              setCustomBookingMessageDraft(customBookingMessage);
              setIsCustomMessageModalOpen(true);
            }}
            cancellationPolicy={cancellationPolicy}
            setCancellationPolicy={setCancellationPolicy}
            longTermCancellationPolicy={longTermCancellationPolicy}
            setLongTermCancellationPolicy={setLongTermCancellationPolicy}
            customSlug={customSlug}
            setCustomSlug={setCustomSlug}
            onSaveCancellationPolicy={handleSaveCancellationPolicy}
            discounts={listing.discounts as Record<string, unknown> | null}
            nonRefundableDiscountPercentage={listing.nonRefundableDiscountPercentage}
          />

            <HostAndLocationViews
              activeSection={activeSection}
              isSaving={isSaving}
              isLoading={isLoading}
              handleSaveSection={handleSaveSection}
              editAddress={editAddress}
              setEditAddress={setEditAddress}
              editApartment={editApartment}
              setEditApartment={setEditApartment}
              editCity={editCity}
              setEditCity={setEditCity}
              editDistrict={editDistrict}
              setEditDistrict={setEditDistrict}
              editPostalCode={editPostalCode}
              setEditPostalCode={setEditPostalCode}
              editCountry={editCountry}
              setEditCountry={setEditCountry}
              latitude={latitude}
              longitude={longitude}
              setLatitude={setLatitude}
              setLongitude={setLongitude}
              locationResolutionError={locationResolutionError}
              setLocationResolutionError={setLocationResolutionError}
              locationIsResolving={locationIsResolving}
              setLocationIsResolving={setLocationIsResolving}
              showExactLocation={showExactLocation}
              setShowExactLocation={setShowExactLocation}
              neighborhoodDescription={neighborhoodDescription}
              setNeighborhoodDescription={setNeighborhoodDescription}
              gettingAround={gettingAround}
              setGettingAround={setGettingAround}
              scenicViews={scenicViews}
              setScenicViews={setScenicViews}
              locationFeatures={locationFeatures}
              setLocationFeatures={setLocationFeatures}
              openLocationAccordion={openLocationAccordion}
              setOpenLocationAccordion={setOpenLocationAccordion}
              listingId={listing.id}
              coHosts={coHosts}
              setCoHosts={setCoHosts}
              hostProfile={listing.host}
              onHostProfileSaved={(publicProfile, hostUpdate) => setListing((prev) => ({
                ...prev,
                host: { ...prev.host, publicProfile, ...hostUpdate },
              }))}
            />

          <HouseRulesAndArrivalViews
            listing={listing}
            onUpdateListing={(updated) => setListing((prev) => ({ ...prev, ...updated }))}
            listingId={listing.id}
            listingCity={editCity || listing.city}
            listingCountry={editCountry || listing.country}
            listingLatitude={listing.latitude}
            listingLongitude={listing.longitude}
            listingDiscounts={listing.discounts}
            onSaveOrgStays={handleSaveOrgStays}
            initialGuidebooks={initialGuidebooks}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            isSaving={isSaving}
            isLoading={isLoading}
            handleSaveSection={handleSaveSection}
            checkInStart={checkInStart}
            setCheckInStart={setCheckInStart}
            checkInEnd={checkInEnd}
            setCheckInEnd={setCheckInEnd}
            checkOutTime={checkOutTime}
            setCheckOutTime={setCheckOutTime}
            maxGuestsCount={maxGuestsCount}
            setMaxGuestsCount={(val: number) => {
              setMaxGuestsCount(val);
              setEditGuests(val);
            }}
            petsAllowed={petsAllowed}
            setPetsAllowed={setPetsAllowed}
            maxPetsCount={maxPetsCount}
            setMaxPetsCount={setMaxPetsCount}
            petRestrictions={petRestrictions}
            setPetRestrictions={setPetRestrictions}
            dogsAllowed={dogsAllowed}
            setDogsAllowed={setDogsAllowed}
            catsAllowed={catsAllowed}
            setCatsAllowed={setCatsAllowed}
            petFee={petFee}
            setPetFee={setPetFee}
            quietHours={quietHoursToggle}
            setQuietHours={setQuietHoursToggle}
            quietHoursStart={quietHoursStart}
            setQuietHoursStart={setQuietHoursStart}
            quietHoursEnd={quietHoursEnd}
            setQuietHoursEnd={setQuietHoursEnd}
            eventsAllowed={eventsAllowed}
            setEventsAllowed={setEventsAllowed}
            commercialFilmingAllowed={commercialFilmingAllowed}
            setCommercialFilmingAllowed={setCommercialFilmingAllowed}
            smokingAllowed={smokingAllowed}
            setSmokingAllowed={setSmokingAllowed}
            smokingLocation={smokingLocation}
            setSmokingLocation={setSmokingLocation}
            additionalHouseRules={additionalHouseRules}
            setAdditionalHouseRules={setAdditionalHouseRules}
            setIsEditingAdditionalRulesModalOpen={setIsEditingAdditionalRulesModalOpen}
            checkInMethod={checkInMethod}
            setCheckInMethod={setCheckInMethod}
            wifiNetwork={wifiNetwork}
            setWifiNetwork={setWifiNetwork}
            wifiPassword={wifiPassword}
            setWifiPassword={setWifiPassword}
            houseManual={houseManual}
            setHouseManual={setHouseManual}
            directions={directions}
            setDirections={setDirections}
            checkInInstructions={checkInInstructions}
            setCheckInInstructions={setCheckInInstructions}
            checkOutInstructions={checkOutInstructions}
            setCheckOutInstructions={setCheckOutInstructions}
            doorCode={doorCode}
            setDoorCode={setDoorCode}
            lockboxCode={lockboxCode}
            setLockboxCode={setLockboxCode}
            parkingAvailable={parkingAvailable}
            setParkingAvailable={setParkingAvailable}
            parkingType={parkingType}
            setParkingType={setParkingType}
            parkingSpaces={parkingSpaces}
            setParkingSpaces={setParkingSpaces}
            parkingReservation={parkingReservation}
            setParkingReservation={setParkingReservation}
            parkingInstructions={parkingInstructions}
            setParkingInstructions={setParkingInstructions}
            selectedLanguageIds={selectedLanguageIds}
            setSelectedLanguageIds={setSelectedLanguageIds}
            guestInteractionPreference={editGuestInteraction}
            setGuestInteractionPreference={setEditGuestInteraction}
            requireProfilePhoto={requireProfilePhoto}
            setRequireProfilePhoto={setRequireProfilePhoto}
            onCancelPreferenceChanges={cancelPreferenceChanges}
            onOrgStaysDirtyChange={setHasExternalPreferenceDraft}
            onTaxesDirtyChange={setHasExternalPreferenceDraft}
            onRegulationsDirtyChange={setHasExternalPreferenceDraft}
            listingStatusSetting={listingStatusSetting}
            setListingStatusSetting={setListingStatusSetting}
          />

            <GuestsSafetyView
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              isSaving={isSaving}
              isLoading={isLoading}
              guestSafetyState={guestSafetyState}
              setGuestSafetyState={setGuestSafetyState}
              onSaveSafety={handleSaveSafetyState}
              initialSafetyState={parseSafetyData(listing)}
              handleSaveSection={handleSaveSection}
              safetyConsiderations={safetyConsiderations}
              setSafetyConsiderations={setSafetyConsiderations}
              carbonMonoxideAlarm={carbonMonoxideAlarm}
              setCarbonMonoxideAlarm={setCarbonMonoxideAlarm}
              smokeAlarm={smokeAlarm}
              setSmokeAlarm={setSmokeAlarm}
              firstAidKit={firstAidKit}
              setFirstAidKit={setFirstAidKit}
              fireExtinguisher={fireExtinguisher}
              setFireExtinguisher={setFireExtinguisher}
              propertyInfoDetails={propertyInfoDetails}
              setPropertyInfoDetails={setPropertyInfoDetails}
              isSafetyConsiderationsModalOpen={isSafetyConsiderationsModalOpen}
              setIsSafetyConsiderationsModalOpen={setIsSafetyConsiderationsModalOpen}
              isSafetyDevicesModalOpen={isSafetyDevicesModalOpen}
              setIsSafetyDevicesModalOpen={setIsSafetyDevicesModalOpen}
              isPropertyInfoModalOpen={isPropertyInfoModalOpen}
              setIsPropertyInfoModalOpen={setIsPropertyInfoModalOpen}
            />

            {(activeSection === "listing-status" || activeSection === "listingstatus") && (
              <ListingStatusView
                listing={listing}
                setActiveSection={setActiveSection}
                onUpdateListing={(updated) => setListing((previous) => ({ ...previous, ...updated }))}
                status={listingStatusSetting}
                setStatus={setListingStatusSetting}
                isSaving={isSaving}
                handleSaveSection={handleSaveSection}
              />
            )}

            {(activeSection === "remove-listing" || activeSection === "removelisting") && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 space-y-4 text-xs font-sans animate-in fade-in shadow-2xs">
                <div className="flex items-center gap-3 text-zinc-900">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center font-semibold text-lg text-zinc-600">
                    🏠
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1F1F1F]">Remove listing</h2>
                    <p className="text-xs text-zinc-500">Permanently remove your listing from Homyz.</p>
                  </div>
                </div>
                <p className="text-zinc-600 leading-relaxed">
                  If you no longer wish to host or need to remove <strong>{listing.title}</strong>, please complete our quick removal survey to permanently remove your listing.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsRemoveListingModalOpen(true)}
                    className="rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold px-6 py-2.5 text-xs transition-all shadow-2xs cursor-pointer"
                  >
                    Remove listing
                  </button>
                </div>
              </div>
            )}

          </main>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: LISTING EDITOR LIVE PREVIEW SIDEBAR (Figma Panel) */}
        {/* ============================================================ */}
        <EditorSidebar
          editorTab={editorTab}
          activeSection={activeSection}
          setActiveSection={setMobileEditorSection}
          isLoading={isLoading}
          editTitle={editTitle}
          editListingType={editListingType}
          editPropertyType={editPropertyType}
          currency={listingCurrency}
          editPrice={editPrice}
          smartPricing={smartPricing}
          smartPricingMinPrice={smartPricingMinPrice}
          smartPricingMaxPrice={smartPricingMaxPrice}
          weeklyDiscount={weeklyDiscount}
          monthlyDiscount={monthlyDiscount}
          minNights={minNights}
          maxNights={maxNights}
          advanceNotice={advanceNotice}
          sameDayCutoff={sameDayCutoff}
          allowSameDayRequests={allowSameDayRequests}
          accessibilityFeatures={accessibilityFeatures}
          accessibilityDetails={accessibilityDetails}
          editGuests={editGuests}
          editDescription={editDescription}
          editAmenities={editAmenities}
          editPhotos={editPhotos}
          editAddress={editAddress}
          editCity={editCity}
          editCountry={editCountry}
          latitude={latitude}
          longitude={longitude}
          showExactLocation={showExactLocation}
          listing={listing}
          coHosts={coHosts}
          bookingMethod={bookingMethod}
          requireGoodTrackRecord={requireGoodTrackRecord}
          checkInStart={checkInStart}
          checkOutTime={checkOutTime}
          maxGuestsCount={maxGuestsCount}
          petsAllowed={petsAllowed}
          maxPetsCount={maxPetsCount}
          eventsAllowed={eventsAllowed}
          smokingAllowed={smokingAllowed}
          quietHours={quietHoursToggle}
          quietHoursStart={quietHoursStart}
          quietHoursEnd={quietHoursEnd}
          commercialFilmingAllowed={commercialFilmingAllowed}
          additionalHouseRules={additionalHouseRules}
          carbonMonoxideAlarm={guestSafetyState.devices.carbonMonoxideAlarm === true}
          smokeAlarm={guestSafetyState.devices.smokeAlarm === true}
          guestSafetyState={guestSafetyState}
          safetyDisclosures={listing.safetyDisclosures}
          safetyEquipment={listing.safetyEquipment}
          safetyHazards={listing.safetyHazards}
          cancellationPolicy={cancellationPolicy}
          longTermCancellationPolicy={longTermCancellationPolicy}
          customSlug={customSlug}
          checkInMethod={checkInMethod}
          checkInEnd={checkInEnd}
          wifiNetwork={wifiNetwork}
          houseManual={houseManual}
          checkOutInstructions={checkOutInstructions}
          directions={directions}
          guestInteractionPreference={editGuestInteraction}
          guidebooksCount={initialGuidebooks?.length ?? 0}
          editBedrooms={editBedrooms}
          editBeds={editBeds}
          parkingAvailable={parkingAvailable}
          parkingType={parkingType}
          setIsRemoveListingModalOpen={setIsRemoveListingModalOpen}
          mobileOpen={isMobileSidebarOpen}
          onMobileClose={() => {
            if (hasUnsavedPreferenceChanges) {
              pendingNavigationRef.current = () => {
                restoreSavedPreferenceDraft();
                router.push("/host/listings");
              };
              setIsUnsavedChangesDialogOpen(true);
              return;
            }
            router.push("/host/listings");
          }}
        />
          </div>
      </Container>

      <Footer />

      {isUnsavedChangesDialogOpen && (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-preferences-title"
            className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-7"
          >
            <h2 id="unsaved-preferences-title" className="text-lg font-semibold tracking-tight text-zinc-950">
              You have unsaved changes
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Your changes haven&apos;t been saved. Are you sure you want to leave?
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  pendingNavigationRef.current = null;
                  setIsUnsavedChangesDialogOpen(false);
                }}
                className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
              >
                Stay and continue editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const pendingNavigation = pendingNavigationRef.current;
                  pendingNavigationRef.current = null;
                  setIsUnsavedChangesDialogOpen(false);
                  pendingNavigation?.();
                }}
                className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
              >
                Discard changes and leave
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}

      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: TURN OFF INSTANT BOOK (Matches Figma Screenshot 1) */}
      {/* --------------------------------------------------------- */}
      {isTurnOffInstantBookModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            {/* Top Close Button */}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsTurnOffInstantBookModalOpen(false)}
              className="absolute top-6 right-6 cursor-pointer p-1 text-sm font-semibold text-zinc-600 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-50"
            >
              ✕
            </button>

            {/* Modal Title & Subtitle */}
            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">
                Turn off Instant Book?
              </h3>
              <p className="text-xs text-zinc-500 font-normal">
                Your setting will not change until you confirm.
              </p>
            </div>

            <div className="border-t border-zinc-200" />

            {/* 3 Consideration Items */}
            <div className="space-y-5">
              {/* Item 1 */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs mt-0.5">
                  <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-medium text-base text-[#1F1F1F]">Guests may experience slower confirmation</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                    Guests will wait for your approval instead of receiving an immediate booking confirmation.
                  </p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs mt-0.5">
                  <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-medium text-base text-[#1F1F1F]">Review every booking request</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                    All booking requests will need your review before they are confirmed.
                  </p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs mt-0.5">
                  <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-medium text-base text-[#1F1F1F]">Respond within 24 hours</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                    Unanswered requests expire automatically after 24 hours and affect your host response rate.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200" />

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsTurnOffInstantBookModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (await saveBookingSettings({ bookingMethod: pendingInstantBookMethod, requireGoodTrackRecord })) {
                    setIsTurnOffInstantBookModalOpen(false);
                  }
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                Turn Instant Book off
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: ADD A CUSTOM MESSAGE */}
      {/* --------------------------------------------------------- */}
      {isCustomMessageModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsCustomMessageModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Add a custom message</h3>
              <p className="text-xs text-zinc-500 font-normal">
                This note appears to guests before they reserve. Do not include access codes or other private arrival information.
              </p>
            </div>

            <textarea
              rows={4}
              value={customBookingMessageDraft}
              onChange={(e) => setCustomBookingMessageDraft(e.target.value)}
              disabled={isSaving}
              placeholder="Write a custom message for your guests..."
              maxLength={1000}
              className="w-full rounded-2xl border border-zinc-300 bg-white p-4 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs placeholder:text-zinc-300"
            />

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setIsCustomMessageModalOpen(false);
                }}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  if (await saveBookingSettings({
                    bookingMethod,
                    requireGoodTrackRecord,
                    bookingMessage: customBookingMessageDraft,
                  })) {
                    setIsCustomMessageModalOpen(false);
                  }
                }}
                className="inline-flex min-w-32 items-center justify-center gap-2 rounded-full bg-[#FEE08B] px-8 py-2.5 text-xs font-semibold text-zinc-950 shadow-2xs transition-all hover:bg-[#FDE047] disabled:cursor-wait disabled:opacity-70"
              >
                {isSaving && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-zinc-600/35 border-t-zinc-950" />}
                {isSaving ? "Saving..." : "Save Message"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: EDIT ADDITIONAL HOUSE RULES */}
      {/* --------------------------------------------------------- */}
      {isEditingAdditionalRulesModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsEditingAdditionalRulesModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Additional house rules</h3>
              <p className="text-xs text-zinc-500 font-normal">
                Share any specific requirements or guidelines guests must follow.
              </p>
            </div>

            <textarea
              rows={5}
              value={additionalHouseRules}
              onChange={(e) => setAdditionalHouseRules(e.target.value)}
              placeholder="e.g. Please remove shoes inside, no loud music after 10 PM..."
              className="w-full rounded-2xl border border-zinc-300 bg-white p-4 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs placeholder:text-zinc-300"
            />

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingAdditionalRulesModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  await handleSaveSection("house-rules");
                  setIsEditingAdditionalRulesModalOpen(false);
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Rules"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Remove Listing Survey & Confirmation Modal (Airbnb Pixel Match) */}
      <RemoveListingModal
        isOpen={isRemoveListingModalOpen || activeSection === "remove-listing" || activeSection === "removelisting"}
        onClose={() => {
          setIsRemoveListingModalOpen(false);
          if (activeSection === "remove-listing" || activeSection === "removelisting") {
            setActiveSection("description");
          }
        }}
        listingId={listing.id}
        listingTitle={listing.title}
      />
    </div>
  );
}
