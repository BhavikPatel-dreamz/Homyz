"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { updateListingAction } from "@/actions/host/listings";
import { HostHeader } from "@/components/host/host-header";
import { RealMap } from "@/components/ui/real-map";
import { EditorSidebar } from "./components/EditorSidebar";
import { GuestsSafetyView } from "./components/GuestsSafetyView";
import { EditorModals } from "./components/EditorModals";
import { PropertyDetailsViews } from "./components/PropertyDetailsViews";
import { PricingAndBookingViews } from "./components/PricingAndBookingViews";
import { HostAndLocationViews } from "./components/HostAndLocationViews";
import { HouseRulesAndArrivalViews } from "./components/HouseRulesAndArrivalViews";
import { SectionKey, sectionToSlug, slugToSection } from "./section-helpers";

export interface HostListingData {
  id: string;
  title: string;
  description: string;
  price: number; // in cents
  published: boolean;
  status: string;
  hostingType: string;
  propertyType: string;
  listingType: string;
  address: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  photos: string[];
  amenities: string[];
  houseRules: string[];
  checkInMethod: string;
  checkInStart: string;
  checkInEnd: string;
  checkOutTime: string;
  cancellationPolicy: string;
  instantBook: boolean;
  minNights: number;
  maxNights: number;
  blockedDates: string[];
  cleaningFee: number;
  securityDeposit: number;
  weekendPrice: number | null;
  isPaused: boolean;
  isFeatured: boolean;
  requestedChanges: any;
  rejectionReason: string | null;
  host: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}


interface AmenityItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  icon: string;
}

const ALL_AMENITIES_CATALOG: AmenityItem[] = [
  { id: "air_conditioning", name: "Air conditioning", category: "Basics", description: "A system that cools and controls the humidity of an indoor space", icon: "💨" },
  { id: "arcade_games", name: "Arcade games", category: "Entertainment", icon: "🕹️" },
  { id: "baby_bath", name: "Baby bath", category: "Family", icon: "🛁" },
  { id: "baby_monitor", name: "Baby monitor", category: "Family", icon: "📻" },
  { id: "baby_safety_gates", name: "Baby safety gates", category: "Family", icon: "🚪" },
  { id: "babysitter_recommendation", name: "Babysitter recommendation", category: "Family", icon: "👶" },
  { id: "backyard", name: "Backyard", category: "Outdoor", icon: "🏡" },
  { id: "backing_sheet", name: "Backing sheet", category: "Bedroom and laundry", icon: "🛏️" },
  { id: "barbecue_utensils", name: "Barbecue utensils", category: "Kitchen and dining", icon: "🍢" },
  { id: "bathtub", name: "Bathtub", category: "Bathroom", icon: "🛁" },
  { id: "bbq_grill", name: "BBQ grill", category: "Outdoor", icon: "🍖" },
  { id: "beach_access", name: "Beach access", category: "Location features", icon: "🏖️" },
  { id: "beach_essentials", name: "Beach essentials", category: "Location features", icon: "🏖️" },
  { id: "bed_linens", name: "Bed linens", category: "Bedroom and laundry", description: "Cotton", icon: "🛌" },
  { id: "bidet", name: "Bidet", category: "Bathroom", icon: "🚽" },
  { id: "bikes", name: "Bikes", category: "Services", icon: "🚲" },
  { id: "blender", name: "Blender", category: "Kitchen and dining", icon: "🥤" },
  { id: "board_games", name: "Board games", category: "Entertainment", icon: "🎲" },
  { id: "boat_slip", name: "Boat slip", category: "Parking and facilities", icon: "🚤" },
  { id: "body_soap", name: "Body soap", category: "Bathroom", icon: "🧼" },
  { id: "fire_extinguisher", name: "Fire extinguisher", category: "Home safety", icon: "🧯" },
  { id: "first_aid_kit", name: "First aid kit", category: "Home safety", icon: "🩹" },
  { id: "free_parking", name: "Free parking on premises", category: "Parking and facilities", description: "Parking garage", icon: "🅿️" },
  { id: "hair_dryer", name: "Hair dryer", category: "Bathroom", icon: "💨" },
  { id: "hangers", name: "Hangers", category: "Bedroom and laundry", icon: "👔" },
  { id: "hot_water", name: "Hot water", category: "Basics", icon: "🚿" },
  { id: "iron", name: "Iron", category: "Bedroom and laundry", icon: "👔" },
  { id: "kitchen", name: "Kitchen", category: "Kitchen and dining", description: "A space for cooking meals that includes at least a refrigerator, oven and stovetop", icon: "🍳" },
  { id: "shampoo", name: "Shampoo", category: "Bathroom", icon: "🧴" },
  { id: "shower_gel", name: "Shower gel", category: "Bathroom", icon: "🧼" },
  { id: "smoke_alarm", name: "Smoke alarm", category: "Home safety", description: "Lorem ipsum vitae nec duis in in uma molestie a.", icon: "🚨" },
  { id: "tv", name: "TV", category: "Entertainment", description: "Lorem ipsum vitae nec duis in in uma molestie a.", icon: "📺" },
  { id: "wifi", name: "Wifi", category: "Internet and office", description: "Lorem ipsum vitae nec duis in in uma molestie a.", icon: "📶" },
];

const AMENITY_CATEGORIES = [
  "All",
  "Basics",
  "Bathroom",
  "Bedroom and laundry",
  "Entertainment",
  "Family",
  "Heating and cooling",
  "Home safety",
  "Internet and office",
  "Kitchen and dining",
  "Location features",
  "Outdoor",
  "Parking and facilities",
  "Services",
];

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
  "directions",
  "check-in-method",
  "wifi-details",
  "house-manual",
];

export function HostListingEditorClient({
  listing: initialListing,
  initialSection,
}: {
  listing: HostListingData;
  initialSection?: SectionKey;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [listing, setListing] = useState<HostListingData>(initialListing);
  const [activeSection, setActiveSectionState] = useState<SectionKey>(initialSection || "propertyType");
  const [editorTab, setEditorTab] = useState<"space" | "arrival">(
    initialSection && ARRIVAL_SECTIONS.includes(initialSection) ? "arrival" : "space"
  );

  const setActiveSection = useCallback(
    (newSection: SectionKey) => {
      setActiveSectionState(newSection);
      if (ARRIVAL_SECTIONS.includes(newSection)) {
        setEditorTab("arrival");
      } else {
        setEditorTab("space");
      }

      const slug = sectionToSlug(newSection);
      const targetPath = `/host/listings/${listing.id}/${slug}`;
      if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
        router.push(targetPath, { scroll: false });
      }
    },
    [listing.id, router]
  );

  useEffect(() => {
    if (!pathname) return;
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[0] === "host" && parts[1] === "listings") {
      const slug = parts[3];
      const targetSec = slugToSection(slug);
      if (targetSec !== activeSection) {
        setActiveSectionState(targetSec);
        if (ARRIVAL_SECTIONS.includes(targetSec)) {
          setEditorTab("arrival");
        } else {
          setEditorTab("space");
        }
      }
    }
  }, [pathname, activeSection]);

  // Editable Form States
  const [editTitle, setEditTitle] = useState(listing.title);
  const [editDescription, setEditDescription] = useState(listing.description);
  const [editHostingType, setEditHostingType] = useState(listing.hostingType || "HOME");
  const [whichIsMostLike, setWhichIsMostLike] = useState("Apartment");
  const [editPropertyType, setEditPropertyType] = useState(listing.propertyType || "Rental unit*");
  const [editListingType, setEditListingType] = useState(listing.listingType || "Entire place");
  const [buildingFloors, setBuildingFloors] = useState(1);
  const [listingFloor, setListingFloor] = useState(1);
  const [yearBuilt, setYearBuilt] = useState("2002");
  const [propertySize, setPropertySize] = useState("");
  const [propertySizeUnit, setPropertySizeUnit] = useState("XX");

  const [editAddress, setEditAddress] = useState(listing.address || "Error voluptatem id");
  const [editCity, setEditCity] = useState(listing.city || "Fugit exercitatione");
  const [editDistrict, setEditDistrict] = useState(listing.district || "");
  const [editPostalCode, setEditPostalCode] = useState(listing.postalCode || "");
  const [editCountry, setEditCountry] = useState(listing.country || "Saudi Arabia");
  const [showExactLocation, setShowExactLocation] = useState(true);

  const [editGuests, setEditGuests] = useState(listing.guests || 2);
  const [editBedrooms, setEditBedrooms] = useState(listing.bedrooms || 1);
  const [editBeds, setEditBeds] = useState(listing.beds || 1);
  const [editBathrooms, setEditBathrooms] = useState(listing.bathrooms || 1);

  // Arrival guide fields
  const [checkInMethod, setCheckInMethod] = useState(listing.checkInMethod || "SMART_LOCK");
  const [checkInStart, setCheckInStart] = useState(listing.checkInStart || "15:00");
  const [checkInEnd, setCheckInEnd] = useState(listing.checkInEnd || "22:00");
  const [checkOutTime, setCheckOutTime] = useState(listing.checkOutTime || "11:00");
  const [wifiNetwork, setWifiNetwork] = useState("Homyz_Guest_Wifi");
  const [wifiPassword, setWifiPassword] = useState("welcome2homyz");
  const [houseManual, setHouseManual] = useState("Welcome to our property! Please refer to the guide for AC controls, parking spots, and trash disposal.");
  const [directions, setDirections] = useState<string>("");

  // Pricing & Discounts
  const [editPrice, setEditPrice] = useState(listing.price / 100);
  const [smartPricing, setSmartPricing] = useState(false);
  const [weekendPrice, setWeekendPrice] = useState((listing.weekendPrice || 0) / 100);
  const [weeklyDiscount, setWeeklyDiscount] = useState(5);
  const [monthlyDiscount, setMonthlyDiscount] = useState(10);

  // Availability
  const [minNights, setMinNights] = useState(listing.minNights || 1);
  const [maxNights, setMaxNights] = useState(listing.maxNights || 365);
  const [advanceNotice, setAdvanceNotice] = useState("Same day");
  const [sameDayCutoff, setSameDayCutoff] = useState("12:00 AM");
  const [allowSameDay, setAllowSameDay] = useState(true);

  // Photos & Amenities
  const [editPhotos, setEditPhotos] = useState<string[]>(listing.photos || []);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [editAmenities, setEditAmenities] = useState<string[]>(
    listing.amenities?.length ? listing.amenities : ["Air conditioning", "Bed linens", "Body soap", "Kitchen", "Wifi", "TV", "Smoke alarm"]
  );
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Accessibility State (Matches Figma Screenshots #1 & #2)
  const [accessibilityFeatures, setAccessibilityFeatures] = useState<AccessibilityFeature[]>([
    {
      id: "disabled_parking",
      name: "Disabled parking spot",
      icon: "🚗",
      description: "Lorem ipsum blandit nibh tellus at sit in risus viverra tincidunt purus penatibus odio iaculis eget at fringilla neque morbi.",
      hasFeature: false,
    },
    { id: "lit_path", name: "Lit path to the guest entrance", icon: "💡", hasFeature: false },
    { id: "step_free", name: "Step-free access", icon: "🪜", hasFeature: false },
    { id: "entrance_32", name: "Guest entrance wider than 32 inches", icon: "↔️", hasFeature: false },
    { id: "pool_hoist", name: "Swimming pool or hot tub hoist", icon: "🏊", hasFeature: false },
    { id: "ceiling_hoist", name: "Ceiling or mobile hoist", icon: "🏗️", hasFeature: false },
  ]);
  const [expandedAccessibility, setExpandedAccessibility] = useState<string | null>("disabled_parking");

  // Accordion open state for Description view
  const [openDescAccordion, setOpenDescAccordion] = useState<string | null>("description");
  const [editPropertyDetails, setEditPropertyDetails] = useState("");
  const [editGuestAccess, setEditGuestAccess] = useState("");
  const [editGuestInteraction, setEditGuestInteraction] = useState("");
  const [editOtherDetails, setEditOtherDetails] = useState("");
  const [isEditingAmenities, setIsEditingAmenities] = useState(false);

  // Location Accordion & Sub-sections state
  const [openLocationAccordion, setOpenLocationAccordion] = useState<string | null>("address");
  const [addressPrivacyForCancellation, setAddressPrivacyForCancellation] = useState(false);
  const [neighborhoodDescription, setNeighborhoodDescription] = useState("");
  const [gettingAround, setGettingAround] = useState("");
  const [locationFeatures, setLocationFeatures] = useState<Record<string, boolean>>({
    beachAccess: false,
    resortAccess: false,
    lakeAccess: false,
    skiInOut: false,
    laundromatNearby: false,
    waterfront: false,
    privateEntrance: false,
  });
  const [scenicViews, setScenicViews] = useState<Record<string, boolean>>({
    bayView: false,
    marinaView: false,
    beachView: false,
    mountainView: false,
    canalView: false,
    oceanView: false,
    citySkylineView: false,
    parkView: false,
    poolView: false,
    courtyardView: false,
    desertView: false,
    resortView: false,
    gardenView: false,
    riverView: false,
    golfCourseView: false,
    seaView: false,
    harborView: false,
    valleyView: false,
    lakeView: false,
    vineyardView: false,
  });

  // About the Host State (Matches Figma Screenshot)
  const [hostAboutBio, setHostAboutBio] = useState(
    "Hey, I'm host... born & raised in Saudi I have been greeting guests for 5+ years. Host is warm, kind & open to welcoming guests from all around the world."
  );
  const [hostWantedToGo, setHostWantedToGo] = useState("Tokyo, Japan");
  const [hostUselessSkill, setHostUselessSkill] = useState("Juggling three oranges");
  const [hostWork, setHostWork] = useState("Architect");
  const [hostFunFact, setHostFunFact] = useState("I love singing in the shower");
  const [hostFavSong, setHostFavSong] = useState("Summer of '69");
  const [hostObsessed, setHostObsessed] = useState("Cooking");
  const [hostHomeUnique, setHostHomeUnique] = useState("Natural lighting & panoramic city view");
  const [hostLanguageSpeak, setHostLanguageSpeak] = useState("English, Arabic");
  const [hostPets, setHostPets] = useState("Cat");
  const [hostBiographyTitle, setHostBiographyTitle] = useState("Life's a journey");
  const [hostDecadeBorn, setHostDecadeBorn] = useState("1990s");
  const [hostWhereILive, setHostWhereILive] = useState("Riyadh, Saudi Arabia");
  const [hostSchool, setHostSchool] = useState("King Saud University");
  const [hostForGuests, setHostForGuests] = useState("Fresh coffee & local dates");
  const [hostTimeSpent, setHostTimeSpent] = useState("Ocean");
  const [hostWhatsForBreakfast, setHostWhatsForBreakfast] = useState("Shakshuka & Karak Tea");
  const [showWhereIveBeen, setShowWhereIveBeen] = useState(true);
  const [selectedTravelStamp, setSelectedTravelStamp] = useState("Paris");
  const [hostInterests, setHostInterests] = useState([
    "Architecture",
    "Cooking",
    "Food scenes",
    "History",
    "Live sports",
    "Museums",
    "Outdoors",
    "Shopping",
    "Video games",
  ]);

  // Modals state for About the Host
  const [isEditingHostProfile, setIsEditingHostProfile] = useState(false);
  const [isEditingTravelStamp, setIsEditingTravelStamp] = useState(false);
  const [isEditingInterests, setIsEditingInterests] = useState(false);

  // Co-host State & Modal
  const [isAddCoHostModalOpen, setIsAddCoHostModalOpen] = useState(false);
  const [coHostCountryCode, setCoHostCountryCode] = useState("Italy (+39)");
  const [coHostPhone, setCoHostPhone] = useState("");
  const [coHostEmail, setCoHostEmail] = useState("");
  const [coHostsList, setCoHostsList] = useState<
    Array<{ id: string; phone?: string; email?: string; countryCode?: string; status: string; dateAdded: string }>
  >([]);

  // Booking Settings State (Matches Figma Screenshots 1 & 2)
  const [bookingMethod, setBookingMethod] = useState<"instant" | "approve">("instant");
  const [requireTrackRecord, setRequireTrackRecord] = useState(false);
  const [customBookingMessage, setCustomBookingMessage] = useState("");
  const [isTurnOffInstantBookModalOpen, setIsTurnOffInstantBookModalOpen] = useState(false);
  const [isCustomMessageModalOpen, setIsCustomMessageModalOpen] = useState(false);

  // House Rules State (Matches Figma Screenshot 100%)
  const [petsAllowed, setPetsAllowed] = useState<boolean | null>(null);
  const [maxPetsAllowedToggle, setMaxPetsAllowedToggle] = useState<boolean | null>(null);
  const [maxPetsCount, setMaxPetsCount] = useState<number>(1);
  const [eventsAllowed, setEventsAllowed] = useState<boolean | null>(true);
  const [smokingAllowed, setSmokingAllowed] = useState<boolean | null>(true);
  const [quietHoursToggle, setQuietHoursToggle] = useState<boolean | null>(false);
  const [commercialFilmingAllowed, setCommercialFilmingAllowed] = useState<boolean | null>(false);
  const [maxGuestsCount, setMaxGuestsCount] = useState<number>(1);
  const [additionalHouseRules, setAdditionalHouseRules] = useState<string>("");
  const [isEditingAdditionalRulesModalOpen, setIsEditingAdditionalRulesModalOpen] = useState<boolean>(false);

  // Guests Safety & Cancellation Policy State (Matches Figma Screenshot 100%)
  const [carbonMonoxideAlarm, setCarbonMonoxideAlarm] = useState<boolean>(false);
  const [smokeAlarm, setSmokeAlarm] = useState<boolean>(true);
  const [firstAidKit, setFirstAidKit] = useState<boolean>(false);
  const [fireExtinguisher, setFireExtinguisher] = useState<boolean>(false);
  const [cancellationPolicy, setCancellationPolicy] = useState<string>("Flexible");
  const [customSlug, setCustomSlug] = useState<string>("");

  const [isSafetyConsiderationsModalOpen, setIsSafetyConsiderationsModalOpen] = useState(false);
  const [isSafetyDevicesModalOpen, setIsSafetyDevicesModalOpen] = useState(false);
  const [isPropertyInfoModalOpen, setIsPropertyInfoModalOpen] = useState(false);

  const [safetyConsiderations, setSafetyConsiderations] = useState<string[]>([]);
  const [propertyInfoDetails, setPropertyInfoDetails] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Save changes handler
  async function handleSaveSection(sectionToSave: SectionKey) {
    setIsSaving(true);
    setFeedbackMsg(null);

    let payload: Record<string, any> = {};

    if (sectionToSave === "title") {
      payload = { title: editTitle };
    } else if (sectionToSave === "description") {
      payload = { description: editDescription };
    } else if (sectionToSave === "propertyType") {
      payload = {
        hostingType: editHostingType,
        propertyType: editPropertyType,
        listingType: editListingType,
      };
    } else if (sectionToSave === "guests") {
      payload = {
        guests: editGuests,
        bedrooms: editBedrooms,
        beds: editBeds,
        bathrooms: editBathrooms,
      };
    } else if (sectionToSave === "pricing") {
      payload = {
        price: Math.round(editPrice * 100),
        weekendPrice: Math.round(weekendPrice * 100),
      };
    } else if (sectionToSave === "availability") {
      payload = {
        minNights: Number(minNights),
        maxNights: Number(maxNights),
      };
    } else if (sectionToSave === "photos") {
      payload = { photos: editPhotos };
    } else if (sectionToSave === "amenities" || sectionToSave === "add-amenities") {
      payload = { amenities: editAmenities };
    } else if (sectionToSave === "location") {
      payload = {
        address: editAddress,
        city: editCity,
        district: editDistrict,
        postalCode: editPostalCode,
        country: editCountry,
        showExactLocation,
      };
    } else if (sectionToSave === "arrival-guide") {
      payload = {
        checkInMethod,
        checkInStart,
        checkInEnd,
        checkOutTime,
      };
    } else if (sectionToSave === "booking-settings") {
      payload = {
        bookingMethod,
        requireTrackRecord,
        customBookingMessage,
      };
    } else if (sectionToSave === "house-rules") {
      payload = {
        petsAllowed,
        maxPetsAllowedToggle,
        maxPetsCount,
        eventsAllowed,
        smokingAllowed,
        quietHoursToggle,
        commercialFilmingAllowed,
        maxGuestsCount,
        additionalHouseRules,
      };
    } else if (sectionToSave === "guests-safety") {
      payload = {
        carbonMonoxideAlarm,
        smokeAlarm,
      };
    } else if (sectionToSave === "cancellation-policy") {
      payload = {
        cancellationPolicy,
      };
    } else if (sectionToSave === "custom-link") {
      payload = {
        customSlug,
      };
    } else if (sectionToSave === "directions") {
      payload = {
        directions,
      };
    }

    try {
      const res = await updateListingAction(listing.id, payload);
      setIsSaving(false);
      if (res.ok && res.data) {
        setListing((prev) => ({ ...prev, ...payload }));
        setFeedbackMsg({ type: "success", text: "Changes saved successfully!" });
      } else {
        setFeedbackMsg({ type: "error", text: (res as any).error || "Failed to update section." });
      }
    } catch (err: any) {
      setIsSaving(false);
      setFeedbackMsg({ type: "error", text: "Error saving: " + err.message });
    }
  }

  const filteredCatalog = ALL_AMENITIES_CATALOG.filter((item) =>
    selectedCategory === "All" ? true : item.category === selectedCategory
  );

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col selection:bg-[#FEE08B] selection:text-zinc-900"
    >
      {/* 1. TOP HEADER (Matches Figma Header Bar) */}
      <HostHeader user={listing.host} />

      {/* 2. TOP NAV TABS (Matches Figma Tab Row: Today, Calendar, Listing, Messages 100%) */}
      <div className="w-full bg-white border-b border-zinc-150 px-4 sm:px-8 py-3 shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {/* Today Tab */}
          <Link
            href="/host/today"
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-zinc-200/90 bg-white px-5 py-2.5 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50/50 transition-all shadow-2xs min-w-[76px]"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="5" y="4" width="14" height="16" rx="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-[11px] font-medium text-zinc-700">Today</span>
          </Link>

          {/* Calendar Tab */}
          <Link
            href="/host/calendar"
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-zinc-200/90 bg-white px-5 py-2.5 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50/50 transition-all shadow-2xs min-w-[76px]"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="2.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M4 10h16" />
            </svg>
            <span className="text-[11px] font-medium text-zinc-700">Calendar</span>
          </Link>

          {/* Listing Tab (Active) */}
          <Link
            href={`/host/listings/${listing.id}`}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-[#FEE08B] text-zinc-950 font-bold px-5 py-2.5 transition-all shadow-2xs min-w-[76px] border border-amber-300"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0v-4a1 1 0 011-1h2a1 1 0 011 1v4" />
            </svg>
            <span className="text-[11px] font-bold text-zinc-950">Listing</span>
          </Link>

          {/* Messages Tab */}
          <Link
            href="/host/messages"
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-zinc-200/90 bg-white px-5 py-2.5 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50/50 transition-all shadow-2xs min-w-[76px]"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-[11px] font-medium text-zinc-700">Messages</span>
          </Link>
        </div>
      </div>

      {/* 3. MAIN EDITOR CONTENT AREA (2-Column Figma Split Layout) */}
      <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 sm:px-8 py-6">
        
        {/* ============================================================ */}
        {/* LEFT COLUMN: MAIN SECTION EDITOR PANEL (lg:col-span-7 or 8) */}
        {/* ============================================================ */}
        <main className="lg:col-span-7 xl:col-span-7 flex flex-col space-y-6 pb-12">
          {feedbackMsg && (
            <div className={`p-4 rounded-2xl text-xs font-bold border animate-in fade-in ${feedbackMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
              {feedbackMsg.text}
            </div>
          )}

          <PropertyDetailsViews
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            feedbackMsg={feedbackMsg}
            isSaving={isSaving}
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
            editAmenities={editAmenities}
            setEditAmenities={setEditAmenities}
            accessibilityFeatures={accessibilityFeatures}
            setAccessibilityFeatures={setAccessibilityFeatures}
            expandedAccessibility={expandedAccessibility}
            setExpandedAccessibility={setExpandedAccessibility}
          />

          <PricingAndBookingViews
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            isSaving={isSaving}
            handleSaveSection={handleSaveSection}
            editPrice={editPrice}
            setEditPrice={setEditPrice}
            smartPricing={smartPricing}
            setSmartPricing={setSmartPricing}
            weekendPrice={weekendPrice}
            setWeekendPrice={setWeekendPrice}
            weeklyDiscount={weeklyDiscount}
            setWeeklyDiscount={setWeeklyDiscount}
            monthlyDiscount={monthlyDiscount}
            setMonthlyDiscount={setMonthlyDiscount}
            minNights={minNights}
            setMinNights={setMinNights}
            maxNights={maxNights}
            setMaxNights={setMaxNights}
            advanceNotice={advanceNotice}
            setAdvanceNotice={setAdvanceNotice}
            sameDayCutoff={sameDayCutoff}
            setSameDayCutoff={setSameDayCutoff}
            allowSameDayRequests={allowSameDay}
            setAllowSameDayRequests={setAllowSameDay}
            bookingMethod={bookingMethod}
            setBookingMethod={setBookingMethod}
            customBookingMessage={customBookingMessage}
            setIsTurnOffInstantBookModalOpen={setIsTurnOffInstantBookModalOpen}
            setIsCustomMessageModalOpen={setIsCustomMessageModalOpen}
            cancellationPolicy={cancellationPolicy}
            setCancellationPolicy={setCancellationPolicy}
            customSlug={customSlug}
            setCustomSlug={setCustomSlug}
          />

          <HostAndLocationViews
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            isSaving={isSaving}
            handleSaveSection={handleSaveSection}
            editAddress={editAddress}
            setEditAddress={setEditAddress}
            editCity={editCity}
            setEditCity={setEditCity}
            editCountry={editCountry}
            setEditCountry={setEditCountry}
            showExactLocation={showExactLocation}
            setShowExactLocation={setShowExactLocation}
            coHostsList={coHostsList}
            setIsAddCoHostModalOpen={setIsAddCoHostModalOpen}
            editPhotos={editPhotos}
            setEditPhotos={setEditPhotos}
            listing={listing}
            hostInterests={hostInterests}
            setHostInterests={setHostInterests}
            isEditingInterests={isEditingInterests}
            setIsEditingInterests={setIsEditingInterests}
          />

          <HouseRulesAndArrivalViews
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            isSaving={isSaving}
            handleSaveSection={handleSaveSection}
            checkInStart={checkInStart}
            setCheckInStart={setCheckInStart}
            checkInEnd={checkInEnd}
            setCheckInEnd={setCheckInEnd}
            checkOutTime={checkOutTime}
            setCheckOutTime={setCheckOutTime}
            maxGuestsCount={maxGuestsCount}
            setMaxGuestsCount={setMaxGuestsCount}
            petsAllowed={petsAllowed}
            setPetsAllowed={setPetsAllowed}
            quietHours={quietHoursToggle}
            setQuietHours={setQuietHoursToggle}
            eventsAllowed={eventsAllowed}
            setEventsAllowed={setEventsAllowed}
            smokingAllowed={smokingAllowed}
            setSmokingAllowed={setSmokingAllowed}
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
          />

          <GuestsSafetyView
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            isSaving={isSaving}
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



        </main>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: LISTING EDITOR LIVE PREVIEW SIDEBAR (Figma Panel) */}
        {/* ============================================================ */}
        <EditorSidebar
          editorTab={editorTab}
          setEditorTab={setEditorTab}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          editTitle={editTitle}
          editListingType={editListingType}
          editPropertyType={editPropertyType}
          editPrice={editPrice}
          weeklyDiscount={weeklyDiscount}
          monthlyDiscount={monthlyDiscount}
          minNights={minNights}
          maxNights={maxNights}
          editGuests={editGuests}
          editDescription={editDescription}
          editAmenities={editAmenities}
          editPhotos={editPhotos}
          editAddress={editAddress}
          editCity={editCity}
          editCountry={editCountry}
          showExactLocation={showExactLocation}
          listing={listing}
          coHostsList={coHostsList}
          setIsAddCoHostModalOpen={setIsAddCoHostModalOpen}
          bookingMethod={bookingMethod}
          checkInStart={checkInStart}
          checkOutTime={checkOutTime}
          maxGuestsCount={maxGuestsCount}
          carbonMonoxideAlarm={carbonMonoxideAlarm}
          smokeAlarm={smokeAlarm}
          cancellationPolicy={cancellationPolicy}
          customSlug={customSlug}
          checkInMethod={checkInMethod}
          checkInEnd={checkInEnd}
          wifiNetwork={wifiNetwork}
          houseManual={houseManual}
          directions={directions}
        />
      </div>

      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: ADD YOUR CO-HOST'S INFO */}
      {/* --------------------------------------------------------- */}
      {isAddCoHostModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setIsAddCoHostModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-bold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            {/* Modal Title & Subtitle */}
            <div className="space-y-1">
              <h3 className="font-bold text-xl tracking-tight text-zinc-900">Add your co-host's info</h3>
              <p className="text-xs text-zinc-500 font-normal">
                We will text or email them the invite
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Country Code + Phone Row */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-800">
                    Country code *
                  </label>
                  <div className="relative">
                    <select
                      value={coHostCountryCode}
                      onChange={(e) => setCoHostCountryCode(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-zinc-300/90 bg-white px-3.5 py-3 text-xs text-zinc-600 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                    >
                      <option value="Italy (+39)">Italy (+39)</option>
                      <option value="Saudi Arabia (+966)">Saudi Arabia (+966)</option>
                      <option value="United States (+1)">United States (+1)</option>
                      <option value="United Kingdom (+44)">United Kingdom (+44)</option>
                      <option value="UAE (+971)">UAE (+971)</option>
                      <option value="Germany (+49)">Germany (+49)</option>
                      <option value="France (+33)">France (+33)</option>
                    </select>
                    <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="col-span-3 space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-800">
                    Phone number *
                  </label>
                  <input
                    type="text"
                    value={coHostPhone}
                    onChange={(e) => setCoHostPhone(e.target.value)}
                    placeholder="xxxx-xxx-xx-xxx"
                    className="w-full rounded-2xl border border-zinc-300/90 bg-white px-4 py-3 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs placeholder:text-zinc-300"
                  />
                </div>
              </div>

              {/* Divider with 'or' */}
              <div className="relative flex items-center justify-center my-3">
                <div className="w-full border-t border-zinc-200" />
                <span className="bg-white px-4 text-xs font-medium text-zinc-400 absolute">
                  or
                </span>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-800">
                  Email
                </label>
                <input
                  type="email"
                  value={coHostEmail}
                  onChange={(e) => setCoHostEmail(e.target.value)}
                  placeholder="xxxx-xxx-xx-xxx"
                  className="w-full rounded-2xl border border-zinc-300/90 bg-white px-4 py-3 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs placeholder:text-zinc-300"
                />
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsAddCoHostModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-bold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  const finalPhone = coHostPhone.trim() || "+39 340 123 4567";
                  const finalEmail = coHostEmail.trim() || "cohost@example.com";
                  setCoHostsList([
                    ...coHostsList,
                    {
                      id: Date.now().toString(),
                      phone: finalPhone,
                      email: finalEmail,
                      countryCode: coHostCountryCode,
                      status: "Invite Sent",
                      dateAdded: "Just now",
                    },
                  ]);
                  setCoHostEmail("");
                  setCoHostPhone("");
                  setIsAddCoHostModalOpen(false);
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: TURN OFF INSTANT BOOK (Matches Figma Screenshot 1) */}
      {/* --------------------------------------------------------- */}
      {isTurnOffInstantBookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setIsTurnOffInstantBookModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-bold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            {/* Modal Title & Subtitle */}
            <div className="space-y-1">
              <h3 className="font-bold text-xl tracking-tight text-zinc-900">
                Are you sure you want to turn off Instant book ?
              </h3>
              <p className="text-xs text-zinc-500 font-normal">
                If so, you'll need to keep these things in mind.
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
                  <h4 className="font-bold text-xs text-zinc-900">You may get fewer bookings</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                    Lorem ipsum varius cursus a est ut consequat id elit.
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
                  <h4 className="font-bold text-xs text-zinc-900">You'll need to review every booking request</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                    Lorem ipsum varius cursus a est ut consequat id elit.
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
                  <h4 className="font-bold text-xs text-zinc-900">You'll need to respond to each request in 24 hours</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                    Lorem ipsum varius cursus a est ut consequat id elit.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200" />

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsTurnOffInstantBookModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-bold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  setBookingMethod("approve");
                  setIsTurnOffInstantBookModalOpen(false);
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Turn Instant Book off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: ADD A CUSTOM MESSAGE */}
      {/* --------------------------------------------------------- */}
      {isCustomMessageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsCustomMessageModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-bold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-xl tracking-tight text-zinc-900">Add a custom message</h3>
              <p className="text-xs text-zinc-500 font-normal">
                Send a welcoming message automatically when guests instant book your space.
              </p>
            </div>

            <textarea
              rows={4}
              value={customBookingMessage}
              onChange={(e) => setCustomBookingMessage(e.target.value)}
              placeholder="Write a custom message for your guests..."
              className="w-full rounded-2xl border border-zinc-300 bg-white p-4 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs placeholder:text-zinc-300"
            />

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCustomMessageModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-bold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setIsCustomMessageModalOpen(false)}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Save Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: EDIT ADDITIONAL HOUSE RULES */}
      {/* --------------------------------------------------------- */}
      {isEditingAdditionalRulesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsEditingAdditionalRulesModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-bold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-xl tracking-tight text-zinc-900">Additional house rules</h3>
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
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-bold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setIsEditingAdditionalRulesModalOpen(false)}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Save Rules
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
