"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HostHeader } from "./host-header";
import { HostSubNav } from "./host-sub-nav";
import { BecomeHostModal } from "./become-host-modal";
import { Footer } from "@/components/dashboard/footer";
import {
  createListingAction,
  updateListingAction,
  deleteListingAction,
  submitListingForReviewAction,
  resubmitListingForReviewAction,
  duplicateListingAction,
  togglePauseListingAction,
  updateListingAvailabilityAction,
} from "@/actions/host/listings";
import type { ListingDTO } from "@/services/mappers";
import { Container } from "../ui";
import { normalizeAmenities } from "@/lib/constants/amenities";

const AMENITY_OPTIONS = [
  { id: "wifi", label: "High-speed Wi-Fi", icon: "📶" },
  { id: "pool", label: "Swimming Pool", icon: "🏊" },
  { id: "kitchen", label: "Full Kitchen", icon: "🍳" },
  { id: "free_parking", label: "Free Parking", icon: "🚗" },
  { id: "air_conditioning", label: "Air Conditioning", icon: "❄️" },
  { id: "workspace", label: "Dedicated Workspace", icon: "💻" },
  { id: "tv", label: "Smart TV / Netflix", icon: "📺" },
  { id: "washer", label: "Washer & Dryer", icon: "🧺" },
  { id: "gym", label: "Fitness Gym", icon: "🏋️" },
  { id: "bbq_grill", label: "BBQ Grill", icon: "🍖" },
  { id: "patio", label: "Private Patio / Balcony", icon: "🪴" },
  { id: "hot_tub", label: "Hot Tub / Jacuzzi", icon: "♨️" },
  { id: "beach_access", label: "Beachfront Access", icon: "🏖️" },
  { id: "ev_charger", label: "EV Car Charger", icon: "🔌" },
  { id: "pet_friendly", label: "Pet Friendly", icon: "🐾" },
];

const HOUSE_RULE_OPTIONS = [
  "No smoking inside property",
  "No wild parties or large events",
  "Pets allowed with prior approval",
  "Quiet hours between 10:00 PM - 08:00 AM",
  "Suitable for children & infants",
  "Remove shoes inside property",
  "Turn off AC/lights when leaving",
];

const PROPERTY_TYPES = ["Apartment", "House", "Villa", "Cabin", "Cottage", "Studio", "Loft", "Penthouse", "Townhouse"];
const LISTING_TYPES = ["Entire place", "Private room", "Shared room"];
const CHECK_IN_METHODS = [
  { id: "SMART_LOCK", label: "Smart Lock (Keypad code provided)" },
  { id: "KEYPAD", label: "Keypad Entry" },
  { id: "LOCKBOX", label: "Key Lockbox on premises" },
  { id: "HOST_MEET", label: "Host or Staff greets you in person" },
];

const CANCELLATION_POLICIES = [
  { id: "FLEXIBLE", label: "Flexible" },
  { id: "MODERATE", label: "Moderate" },
  { id: "STRICT", label: "Strict" },
  { id: "SUPER_STRICT", label: "Super Strict" },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function HostListingsWorkspace({
  initialListings,
  initialShowSearch = false,
  initialSearchQuery = "",
}: {
  initialListings: ListingDTO[];
  initialShowSearch?: boolean;
  initialSearchQuery?: string;
}) {
  const router = useRouter();
  const [listings, setListings] = useState<ListingDTO[]>(initialListings);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [showSearch, setShowSearch] = useState(initialShowSearch);
  const [compactGrid, setCompactGrid] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [becomeHostModalOpen, setBecomeHostModalOpen] = useState(false);

  // Editor Modal State
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingListing, setEditingListing] = useState<ListingDTO | null>(null);
  const [editorStep, setEditorStep] = useState<number>(1);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Availability Modal State
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [selectedListingForCal, setSelectedListingForCal] = useState<ListingDTO | null>(null);
  const [blockedDateInput, setBlockedDateInput] = useState<string>("");
  const [tempBlockedDates, setTempBlockedDates] = useState<string[]>([]);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<ListingDTO | null>(null);

  const [pending, startTransition] = useTransition();

  // Form states for editor
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: 15000, // $150.00
    hostingType: "HOME",
    propertyType: "Apartment",
    listingType: "Entire place",
    address: "",
    city: "",
    district: "",
    postalCode: "",
    country: "",
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    photos: [] as string[],
    newPhotoUrl: "",
    highlights: [] as string[],
    amenities: [] as string[],
    houseRules: [] as string[],
    checkInMethod: "SMART_LOCK",
    checkInStart: "15:00",
    checkInEnd: "22:00",
    checkOutTime: "11:00",
    cancellationPolicy: "FLEXIBLE",
    minNights: 1,
    maxNights: 365,
    cleaningFee: 5000, // $50.00
    securityDeposit: 0,
    weekendPrice: 0,
    instantBook: true,
    isPaused: false,
  });

  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  }

  // Open the same host onboarding flow used by the header's "Become a host" action.
  function handleOpenCreate() {
    setBecomeHostModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(item: ListingDTO) {
    setEditingListing(item);
    setFormData({
      title: item.title || "",
      description: item.description || "",
      price: item.price || 10000,
      hostingType: item.hostingType || "HOME",
      propertyType: item.propertyType || "Apartment",
      listingType: item.listingType || "Entire place",
      address: item.address || "",
      city: item.city || "",
      district: item.district || "",
      postalCode: item.postalCode || "",
      country: item.country || "",
      guests: item.guests || 1,
      bedrooms: item.bedrooms || 1,
      beds: item.beds || 1,
      bathrooms: item.bathrooms || 1,
      photos: Array.isArray(item.photos) ? [...item.photos] : [],
      newPhotoUrl: "",
      highlights: Array.isArray(item.highlights) ? [...item.highlights] : [],
      amenities: normalizeAmenities(item.amenities),
      houseRules: Array.isArray(item.houseRules) ? [...item.houseRules] : [],
      checkInMethod: item.checkInMethod || "SMART_LOCK",
      checkInStart: item.checkInStart || "15:00",
      checkInEnd: item.checkInEnd || "22:00",
      checkOutTime: item.checkOutTime || "11:00",
      cancellationPolicy: item.cancellationPolicy || "FLEXIBLE",
      minNights: item.minNights ?? 1,
      maxNights: item.maxNights ?? 365,
      cleaningFee: item.cleaningFee ?? 0,
      securityDeposit: item.securityDeposit ?? 0,
      weekendPrice: item.weekendPrice ?? 0,
      instantBook: item.instantBook ?? true,
      isPaused: item.isPaused ?? false,
    });
    setEditorStep(1);
    setShowEditorModal(true);
  }

  // Save Listing (Create or Update)
  async function handleSaveListing(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const payload = {
          title: formData.title || "Untitled Listing",
          description: formData.description,
          price: Number(formData.price),
          hostingType: formData.hostingType,
          propertyType: formData.propertyType,
          listingType: formData.listingType,
          address: formData.address,
          city: formData.city,
          district: formData.district,
          postalCode: formData.postalCode,
          country: formData.country,
          guests: Number(formData.guests),
          bedrooms: Number(formData.bedrooms),
          beds: Number(formData.beds),
          bathrooms: Number(formData.bathrooms),
          photos: formData.photos,
          highlights: formData.highlights,
          amenities: formData.amenities,
          houseRules: formData.houseRules,
          checkInMethod: formData.checkInMethod,
          checkInStart: formData.checkInStart,
          checkInEnd: formData.checkInEnd,
          checkOutTime: formData.checkOutTime,
          cancellationPolicy: formData.cancellationPolicy,
          minNights: Number(formData.minNights),
          maxNights: Number(formData.maxNights),
          instantBook: formData.instantBook,
          isPaused: formData.isPaused,
          cleaningFee: Number(formData.cleaningFee),
          securityDeposit: Number(formData.securityDeposit),
          weekendPrice: formData.weekendPrice ? Number(formData.weekendPrice) : undefined,
        };

        if (editingListing) {
          const res = await updateListingAction(editingListing.id, payload);
          if (!res.ok) {
            showToast(res.error || "Failed to update listing.", "error");
            return;
          }
          showToast("Listing updated successfully!", "success");
        } else {
          const res = await createListingAction(payload);
          if (!res.ok) {
            showToast(res.error || "Failed to create listing.", "error");
            return;
          }
          showToast("Listing created as Draft!", "success");
        }
        setShowEditorModal(false);
        router.refresh();
      } catch (err: unknown) {
        showToast(errorMessage(err, "Failed to save listing."), "error");
      }
    });
  }

  // Submit / Resubmit Listing
  async function handleSubmitListing(item: ListingDTO) {
    startTransition(async () => {
      try {
        const actionFn = item.status === "CHANGES_REQUESTED" ? resubmitListingForReviewAction : submitListingForReviewAction;
        const res = await actionFn(item.id);
        if (!res.ok) {
          showToast(res.error || "Failed to submit listing.", "error");
          return;
        }
        showToast("Listing submitted for Admin Review!", "success");
        router.refresh();
      } catch (err: unknown) {
        showToast(errorMessage(err, "Failed to submit listing."), "error");
      }
    });
  }

  // Toggle Pause (Snooze)
  async function handleTogglePause(item: ListingDTO) {
    startTransition(async () => {
      try {
        const nextState = !item.isPaused;
        const res = await togglePauseListingAction(item.id, nextState);
        if (!res.ok) {
          showToast(res.error || "Failed to toggle pause status.", "error");
          return;
        }
        showToast(nextState ? "Listing paused (unpublished from search)." : "Listing resumed!", "success");
        router.refresh();
      } catch (err: unknown) {
        showToast(errorMessage(err, "Failed to update listing state."), "error");
      }
    });
  }

  // Duplicate Listing
  async function handleDuplicate(item: ListingDTO) {
    startTransition(async () => {
      try {
        const res = await duplicateListingAction(item.id);
        if (!res.ok) {
          showToast(res.error || "Failed to duplicate listing.", "error");
          return;
        }
        showToast("Listing duplicated to new Draft!", "success");
        router.refresh();
      } catch (err: unknown) {
        showToast(errorMessage(err, "Failed to duplicate listing."), "error");
      }
    });
  }

  // Delete Listing
  async function handleDeleteListing() {
    if (!listingToDelete) return;
    startTransition(async () => {
      try {
        const res = await deleteListingAction(listingToDelete.id);
        if (!res.ok) {
          showToast(res.error || "Failed to delete listing.", "error");
          return;
        }
        showToast("Listing deleted successfully.", "success");
        setShowDeleteModal(false);
        setListingToDelete(null);
        router.refresh();
      } catch (err: unknown) {
        showToast(errorMessage(err, "Failed to delete listing."), "error");
      }
    });
  }

  // Manage Calendar / Blocked Dates
  function handleOpenAvailability(item: ListingDTO) {
    setSelectedListingForCal(item);
    setTempBlockedDates(Array.isArray(item.blockedDates) ? [...item.blockedDates] : []);
    setBlockedDateInput("");
    setShowAvailabilityModal(true);
  }

  async function handleSaveAvailability(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedListingForCal) return;
    startTransition(async () => {
      try {
        const res = await updateListingAvailabilityAction(selectedListingForCal.id, tempBlockedDates);
        if (!res.ok) {
          showToast(res.error || "Failed to update availability dates.", "error");
          return;
        }
        showToast("Blocked dates saved!", "success");
        setShowAvailabilityModal(false);
        router.refresh();
      } catch (err: unknown) {
        showToast(errorMessage(err, "Failed to update availability."), "error");
      }
    });
  }

  // Filter listings
  const filteredListings = initialListings.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.city && item.city.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === "ALL") return true;
    if (activeTab === "ACTIVE") return item.status === "ACTIVE" || (item.published && !item.isPaused);
    if (activeTab === "PENDING_REVIEW") return item.status === "PENDING_REVIEW";
    if (activeTab === "CHANGES_REQUESTED") return item.status === "CHANGES_REQUESTED";
    if (activeTab === "DRAFT") return item.status === "DRAFT";
    if (activeTab === "PAUSED") return item.isPaused;
    if (activeTab === "REJECTED") return item.status === "REJECTED";
    return true;
  });

  // KPI Metrics
  const totalCount = initialListings.length;
  const activeCount = initialListings.filter((l) => l.status === "ACTIVE" || (l.published && !l.isPaused)).length;
  const pendingCount = initialListings.filter((l) => l.status === "PENDING_REVIEW").length;
  const pausedCount = initialListings.filter((l) => l.isPaused).length;

  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FEE08B]">
      {/* ── 1. TOP HEADER (Matches Figma Screenshot Header) ── */}
      <HostHeader />
      <HostSubNav activeTab="listing" />

      {/* ── 2. MAIN CONTENT AREA ── */}
      <main className="listing-main min-w-0 flex-1 pt-7.5 pb-[calc(128px+env(safe-area-inset-bottom))] sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-16">
        <Container className="max-sm:px-6">
          {/* Toast Alert */}
          {toastMsg && (
            <div className={`fixed top-5 right-4 left-4 sm:left-auto sm:max-w-md z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold transition-all ${toastMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
              }`}>
              {toastMsg.text}
            </div>
          )}

          {/* Mobile Search Bar Row (When search is active on mobile - matches listing-search-mobile.jpg) */}
          {showSearch ? (
            <div className="mb-8 flex items-center gap-3 sm:hidden">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#1F1F1F"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="10.5" cy="10.5" r="7" />
                    <path d="m16 16 5 5" />
                  </svg>
                </div>
                <input
                  type="search"
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder=""
                  aria-label="Search listings"
                  className="h-11 w-full rounded-full border border-[#727272] bg-[#f3f4f6] pl-11 pr-4 font-['Poppins'] text-base text-[#1F1F1F] outline-none transition-colors focus:border-[#1F1F1F]"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                }}
                className="flex h-11 shrink-0 items-center justify-center rounded-full border border-[#727272] bg-white px-6 font-['Poppins'] text-base font-normal text-[#717171] transition-colors hover:bg-zinc-50 active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Mobile Title & Action Icons (When search is closed on mobile) */
            <div className="listing-title mb-8 flex items-center justify-between gap-3 sm:hidden">
              <h1 className="min-w-0 text-[22px] leading-[1.15] font-medium tracking-[-0.025em]">
                Your listing
              </h1>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label="Search listings"
                  aria-expanded={false}
                  onClick={() => setShowSearch(true)}
                  className="flex size-11 items-center justify-center rounded-full bg-[#f5f5f5]"
                >
                  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <circle cx="10.5" cy="10.5" r="7" />
                    <path d="m16 16 5 5" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Toggle compact listing layout"
                  aria-pressed={compactGrid}
                  onClick={() => setCompactGrid(!compactGrid)}
                  className={`flex size-11 items-center justify-center rounded-full text-[#1F1F1F] transition-colors ${
                    compactGrid ? "bg-zinc-200" : "bg-[#f5f5f5] hover:bg-[#eaeaea]"
                  }`}
                >
                  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} aria-hidden="true">
                    <rect x="4" y="3" width="16" height="4" rx="1" />
                    <rect x="4" y="11" width="6" height="10" rx="1" />
                    <rect x="14" y="11" width="6" height="6" rx="1" />
                  </svg>
                  <span className="sr-only">Toggle compact listing layout</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  disabled={pending}
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#f5f5f5] text-[#1F1F1F] font-normal text-[28px] shadow-xs"
                  title="Create New Listing"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Desktop Title & Action (Always shown on sm: and up) */}
          <div className="listing-title mb-8 hidden items-center justify-between gap-3 sm:mb-9 sm:flex lg:mb-12">
            <h1 className="min-w-0 font-medium tracking-[-0.025em] sm:text-[40px] lg:text-[48px] leading-[1.15]">
              Your listings
            </h1>
            <button
              type="button"
              onClick={handleOpenCreate}
              disabled={pending}
              className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-transparent hover:border-[#1F1F1F] bg-[#FEE08B] hover:bg-[#F3F4F5] text-[#1F1F1F] font-medium text-base px-5 py-2.5 transition-all shadow-2xs active:scale-95"
            >
              + Create New Listing
            </button>
          </div>

          {/* Mobile Search View (100% matches listing-search-mobile.jpg) */}
          {showSearch && (
            <div className="sm:hidden">
              {filteredListings.length === 0 && searchQuery ? (
                <p className="py-10 text-center text-zinc-500">No listings match your search.</p>
              ) : filteredListings.length === 0 ? (
                <div className="flex flex-col space-y-5">
                  {[
                    { photo: "listing-img-01.png", alt: "Bright home office with an orange desk" },
                    { photo: "listing-img-02.png", alt: "Light-filled living room with neutral furnishings" },
                    { photo: "listing-img-03.png", alt: "Green-paneled lounge with a pink sofa" },
                    { photo: null, alt: "Property placeholder" },
                  ].map((item, index) => (
                    <button
                      key={item.photo ?? `search-preview-${index}`}
                      type="button"
                      onClick={handleOpenCreate}
                      disabled={pending}
                      aria-label={`Create a new listing from preview ${index + 1}`}
                      className="group flex w-full items-start gap-4 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    >
                      <div className="relative aspect-[442/394] w-[110px] shrink-0 overflow-hidden rounded-[18px] border border-[#777] bg-[#f1f1f1]">
                        {item.photo ? (
                          <Image
                            src={`/images/listing/${item.photo}`}
                            alt={item.alt}
                            fill
                            sizes="110px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-[#D9D9D9]" />
                        )}
                        <span className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-white shadow-xs">
                          <span className="size-2 shrink-0 rounded-full bg-[#37BE01]" />
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-start pt-1.5">
                        <h3 className="truncate font-['Poppins'] text-[17px] font-semibold leading-tight text-[#1F1F1F]">
                          Property name
                        </h3>
                        <p className="mt-1 truncate font-['Poppins'] text-sm leading-tight text-[#717171]">
                          Address, Country
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col space-y-5">
                  {filteredListings.map((item, index) => {
                    const photos = Array.isArray(item.photos) ? item.photos : [];
                    const fallbackPhoto = `/images/listing/listing-img-0${(index % 3) + 1}.png`;
                    const coverPhoto = photos[0] || fallbackPhoto;
                    const isListed = !item.isPaused && (item.status === "ACTIVE" || item.published);

                    return (
                      <Link
                        key={item.id}
                        href={
                          `/host/listings/${item.id}`
                        }
                        className="group flex w-full items-start gap-4 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      >
                        <div className="relative aspect-[442/394] w-[110px] shrink-0 overflow-hidden rounded-[18px] border border-[#777] bg-[#f1f1f1]">
                          {coverPhoto ? (
                            <img
                              src={coverPhoto}
                              alt={item.title || "Property name"}
                              onError={(event) => {
                                const image = event.currentTarget;
                                if (image.getAttribute("src") !== fallbackPhoto) {
                                  image.src = fallbackPhoto;
                                }
                              }}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-[#D9D9D9]" />
                          )}
                          <span className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-white shadow-xs">
                            <span className={`size-2 shrink-0 rounded-full ${isListed ? "bg-[#37BE01]" : "bg-rose-500"}`} />
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-start pt-1.5">
                          <h3 className="truncate font-['Poppins'] text-[17px] font-semibold leading-tight text-[#1F1F1F]">
                            {item.title || "Property name"}
                          </h3>
                          <p className="mt-1 truncate font-['Poppins'] text-sm leading-tight text-[#717171]">
                            {item.city || item.country
                              ? `${item.city || ""}${item.city && item.country ? ", " : ""}${item.country || ""}`
                              : "Address, Country"}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Property Cards Grid (Shown on desktop, and on mobile only when search is not active) */}
          <div className={showSearch ? "hidden sm:block" : "block"}>
            {filteredListings.length === 0 && searchQuery ? (
              <p className="py-10 text-center text-zinc-500">No listings match your search.</p>
            ) : filteredListings.length === 0 ? (
              <div className={`grid ${compactGrid ? "grid-cols-2" : "grid-cols-1"} gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-6 xl:gap-y-8`}>
                {["listing-img-01.png", "listing-img-02.png", "listing-img-03.png", null].map((photo, index) => (
                  <button
                    key={photo ?? "placeholder"}
                    type="button"
                    onClick={handleOpenCreate}
                    disabled={pending}
                    aria-label={`Create a new listing from preview ${index + 1}`}
                    className="group min-w-0 text-left rounded-[22px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 disabled:cursor-wait"
                  >
                    <div className="relative aspect-[375/352] sm:aspect-[490/514] w-full overflow-hidden rounded-xl sm:rounded-[22px] border border-[#777] bg-[#f1f1f1]">
                      {photo && (
                        <Image
                          src={`/images/listing/${photo}`}
                          alt={["Bright home office with an orange desk", "Light-filled living room with neutral furnishings", "Green-paneled lounge with a pink sofa"][index]}
                          fill
                          sizes="(min-width: 1600px) 375px, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.02]"
                        />
                      )}
                      <span className="capitalize absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-sm leading-5 text-[#252525]">
                        <span className="size-2 shrink-0 rounded-full bg-[#37BE01]" />
                        Listed
                      </span>
                    </div>
                    <div className="px-0 pt-3 sm:px-3 lg:pt-6">
                      <h3 className="text-base font-semibold leading-6 text-[#252525]">Property name</h3>
                      <p className="mt-1 text-sm leading-6 text-[#858585]">Address, Country</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className={`host-listing-workspace grid ${compactGrid ? "grid-cols-2" : "grid-cols-1"} gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-6 xl:gap-y-8`}>
                {filteredListings.map((item, index) => {
                  const photos = Array.isArray(item.photos) ? item.photos : [];
                  const fallbackPhoto = `/images/listing/listing-img-0${(index % 3) + 1}.png`;
                  const coverPhoto = photos[0] || fallbackPhoto;
                  const isListed = !item.isPaused && (item.status === "ACTIVE" || item.published);

                  return (
                    <div
                      key={item.id}
                      className="group relative min-w-0 text-left"
                    >
                      {/* Photo Container */}
                      <div className="relative aspect-[375/352] sm:aspect-[490/514] w-full overflow-hidden rounded-xl sm:rounded-[22px] border border-[#777] bg-[#f1f1f1]">
                        {coverPhoto ? (
                          <img
                            src={coverPhoto}
                            alt={item.title}
                            onError={(event) => {
                              const image = event.currentTarget;
                              if (image.getAttribute("src") !== fallbackPhoto) {
                                image.src = fallbackPhoto;
                              }
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="h-full w-full bg-[#f1f1f1]" />
                        )}

                        {/* White Pill Badge matching screenshot */}
                        <div className="capitalize absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-sm leading-5 text-[#252525]">
                          <span className={`w-2 h-2 rounded-full ${isListed ? "bg-[#37BE01]" : "bg-rose-500"}`}></span>
                          {isListed ? "Listed" : "Action Required"}
                        </div>

                        {/* Delete Action Icon Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setListingToDelete(item);
                            setShowDeleteModal(true);
                          }}
                          title="Delete Property Listing"
                          className="absolute z-20 top-3 right-3 max-sm:hidden bg-white/90 hover:bg-rose-600 hover:text-white backdrop-blur-xs rounded-full text-zinc-700 transition-all shadow-2xs text-xs flex items-center justify-center w-11 h-11 font-semibold"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* Below Card Information */}
                      <div className="px-0 pt-3 sm:px-3 lg:pt-6">
                        <h3 className="truncate text-base font-semibold leading-6 text-[#252525]">
                          <Link
                            href={ `/host/listings/${item.id}`
                            }
                            className="after:absolute after:inset-0 after:rounded-[22px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4"
                          >
                            {item.title || "Property name"}
                          </Link>
                        </h3>
                        <p className="mt-1 truncate text-sm leading-6 text-[#858585]">
                          {item.city || item.country ? `${item.city || ""}${item.city && item.country ? ", " : ""}${item.country || ""}` : "Address, Country"}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  disabled={pending}
                  aria-label="Create a new listing"
                  className="min-w-0 rounded-[22px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 disabled:cursor-wait"
                >
                  <div className="relative aspect-[375/352] sm:aspect-[490/514] w-full overflow-hidden rounded-xl sm:rounded-[22px] border border-[#777] bg-[#f1f1f1]">
                    <span className="capitalize absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-sm leading-5 text-[#252525]">
                      <span className="size-2 shrink-0 rounded-full bg-[#37BE01]" />
                      Listed
                    </span>
                  </div>
                  <div className="px-0 pt-3 sm:px-3 lg:pt-6">
                    <h3 className="text-base font-semibold leading-6 text-[#252525]">Property name</h3>
                    <p className="mt-1 text-sm leading-6 text-[#858585]">Address, Country</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </Container>
      </main>

      {/* ── 3. FOOTER SECTION (Shared Dashboard Footer) ── */}
      <Footer />

      <BecomeHostModal
        isOpen={becomeHostModalOpen}
        onClose={() => setBecomeHostModalOpen(false)}
      />

      {/* Editor Modal (Create & Edit Multi-Tab Wizard) */}
      {showEditorModal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[92vh] rounded-3xl bg-[var(--surface)] p-6 sm:p-8 shadow-2xl space-y-6 overflow-y-auto border border-[var(--border)] font-sans">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h2 className="text-lg font-semibold text-muted-foreground">
                  {editingListing ? `Edit Property: ${editingListing.title}` : "Create Property Listing"}
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Configure property details, photos, amenities, pricing, house rules, check-in, and policies.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditorModal(false)}
                className="h-8 w-8 rounded-full bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-muted-foreground flex items-center justify-center font-semibold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Wizard Steps Navigation Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-[var(--border-subtle)] text-xs font-semibold scrollbar-none">
              {[
                { step: 1, label: "1. Basic Info" },
                { step: 2, label: "2. Location & Capacity" },
                { step: 3, label: "3. Photos & Media" },
                { step: 4, label: "4. Amenities & Rules" },
                { step: 5, label: "5. Pricing & Policies" },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setEditorStep(s.step)}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${editorStep === s.step
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-muted-foreground"
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSaveListing} className="space-y-6 text-xs">
              {/* STEP 1: Basic Info */}
              {editorStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-semibold text-muted-foreground mb-1">Listing Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      placeholder="e.g. Modern Luxury Beachfront Villa with Ocean Views"
                      className="w-full rounded-xl border border-[var(--border)] p-3 bg-[var(--surface)] text-muted-foreground outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground mb-1">Detailed Description *</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      rows={4}
                      placeholder="Describe what makes your property unique, nearby attractions, neighborhood ambiance, and special features..."
                      className="w-full rounded-xl border border-[var(--border)] p-3 bg-[var(--surface)] text-muted-foreground outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-muted-foreground mb-1">Hosting Category</label>
                      <select
                        value={formData.hostingType}
                        onChange={(e) => setFormData({ ...formData, hostingType: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none font-semibold"
                      >
                        <option value="HOME">Residential Home</option>
                        <option value="EXPERIENCE">Experience</option>
                        <option value="SERVICE">Service</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-muted-foreground mb-1">Property Type</label>
                      <select
                        value={formData.propertyType}
                        onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none font-semibold"
                      >
                        {PROPERTY_TYPES.map((pt) => (
                          <option key={pt} value={pt}>{pt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-muted-foreground mb-1">Listing Type</label>
                      <select
                        value={formData.listingType}
                        onChange={(e) => setFormData({ ...formData, listingType: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none font-semibold"
                      >
                        {LISTING_TYPES.map((lt) => (
                          <option key={lt} value={lt}>{lt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Location & Capacity */}
              {editorStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-muted-foreground mb-1">Street Address *</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        required
                        placeholder="e.g. 742 Evergreen Terrace"
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-muted-foreground mb-1">City / Region *</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        required
                        placeholder="e.g. Miami"
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-muted-foreground mb-1">District / State</label>
                      <input
                        type="text"
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        placeholder="e.g. Florida"
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-muted-foreground mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="e.g. 33101"
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-muted-foreground mb-1">Country</label>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        placeholder="e.g. United States"
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none"
                      />
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-subtle)] pt-4">
                    <h4 className="font-semibold text-muted-foreground mb-3">Property Capacity</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Guests Capacity</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={formData.guests}
                          onChange={(e) => setFormData({ ...formData, guests: Number(e.target.value) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-semibold text-center outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Bedrooms</label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={formData.bedrooms}
                          onChange={(e) => setFormData({ ...formData, bedrooms: Number(e.target.value) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-semibold text-center outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Beds</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={formData.beds}
                          onChange={(e) => setFormData({ ...formData, beds: Number(e.target.value) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-semibold text-center outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Bathrooms</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={formData.bathrooms}
                          onChange={(e) => setFormData({ ...formData, bathrooms: Number(e.target.value) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-semibold text-center outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Photos & Media */}
              {editorStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-muted-foreground">Property Photos Gallery</h4>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Add high quality image URLs. Minimum 5 photos required for Admin review & approval.
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${formData.photos.length >= 5 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-300"
                      }`}>
                      {formData.photos.length} / 5 photos minimum
                    </span>
                  </div>

                  {/* Add photo File Upload & URL input */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-[#1F1F1F] font-semibold px-4 py-2.5 hover:opacity-90 transition-all shrink-0">
                        <span>📁 Choose & Upload File</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const body = new FormData();
                              body.append("file", file);
                              const res = await fetch("/api/v1/upload/listing-photo", {
                                method: "POST",
                                body,
                              });
                              const data = await res.json();
                              if (res.ok && data.url) {
                                setFormData({
                                  ...formData,
                                  photos: [...formData.photos, data.url],
                                });
                                showToast("Photo uploaded successfully!", "success");
                              } else {
                                showToast(data.error || "Failed to upload photo.", "error");
                              }
                            } catch (err: unknown) {
                              showToast(`Upload failed: ${errorMessage(err, "Please try again.")}`, "error");
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>

                      <div className="flex-1 flex gap-2">
                        <input
                          type="url"
                          value={formData.newPhotoUrl}
                          onChange={(e) => setFormData({ ...formData, newPhotoUrl: e.target.value })}
                          placeholder="Or paste image URL (e.g. https://images.unsplash.com/...)"
                          className="flex-1 rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.newPhotoUrl.trim()) return;
                            setFormData({
                              ...formData,
                              photos: [...formData.photos, formData.newPhotoUrl.trim()],
                              newPhotoUrl: "",
                            });
                          }}
                          className="rounded-xl bg-emerald-600 text-white font-semibold px-4 py-2 hover:bg-emerald-700 transition-all shrink-0"
                        >
                          + Add URL
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Photos Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {formData.photos.map((url, idx) => (
                      <div key={idx} className="relative aspect-4/3 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-zinc-100 group">
                        <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formData.photos.filter((_, i) => i !== idx);
                              setFormData({ ...formData, photos: updated });
                            }}
                            className="bg-rose-600 text-white rounded-full p-1.5 text-xs font-semibold"
                            title="Remove Photo"
                          >
                            🗑 Remove
                          </button>
                        </div>
                        <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                          #{idx + 1} {idx === 0 ? "Cover" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4: Amenities & Rules */}
              {editorStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-muted-foreground mb-1">Property Amenities</h4>
                    <p className="text-[11px] text-[var(--muted-foreground)] mb-3">Select all amenities available to guests:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {AMENITY_OPTIONS.map((item) => {
                        const isSelected = formData.amenities.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              const updated = isSelected
                                ? formData.amenities.filter((a) => a !== item.id)
                                : [...formData.amenities, item.id];
                              setFormData({ ...formData, amenities: updated });
                            }}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${isSelected
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold"
                                : "border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground"
                              }`}
                          >
                            <span className="text-base">{item.icon}</span>
                            <span className="text-xs">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
                    <h4 className="font-semibold text-muted-foreground">House Rules</h4>
                    <p className="text-[11px] text-[var(--muted-foreground)]">Select house rules for guests staying at your place:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {HOUSE_RULE_OPTIONS.map((rule) => {
                        const isChecked = formData.houseRules.includes(rule);
                        return (
                          <label key={rule} className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const updated = isChecked
                                  ? formData.houseRules.filter((r) => r !== rule)
                                  : [...formData.houseRules, rule];
                                setFormData({ ...formData, houseRules: updated });
                              }}
                              className="rounded border-zinc-300"
                            />
                            <span>{rule}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Pricing & Policies */}
              {editorStep === 5 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-muted-foreground mb-3">Pricing & Fees</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Nightly Rate ($USD) *</label>
                        <input
                          type="number"
                          min={1}
                          value={formData.price / 100}
                          onChange={(e) => setFormData({ ...formData, price: Math.round(Number(e.target.value) * 100) })}
                          required
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-semibold text-base outline-none text-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Weekend Rate ($USD)</label>
                        <input
                          type="number"
                          min={0}
                          value={(formData.weekendPrice || 0) / 100}
                          onChange={(e) => setFormData({ ...formData, weekendPrice: Math.round(Number(e.target.value) * 100) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-semibold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Cleaning Fee ($USD)</label>
                        <input
                          type="number"
                          min={0}
                          value={(formData.cleaningFee || 0) / 100}
                          onChange={(e) => setFormData({ ...formData, cleaningFee: Math.round(Number(e.target.value) * 100) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-semibold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-subtle)] pt-4 space-y-4">
                    <h4 className="font-semibold text-muted-foreground">Check-in Details & Policies</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Check-in Method</label>
                        <select
                          value={formData.checkInMethod}
                          onChange={(e) => setFormData({ ...formData, checkInMethod: e.target.value })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-semibold outline-none"
                        >
                          {CHECK_IN_METHODS.map((m) => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Check-in Window</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={formData.checkInStart}
                            onChange={(e) => setFormData({ ...formData, checkInStart: e.target.value })}
                            className="w-full rounded-xl border border-[var(--border)] p-2 bg-[var(--surface)] text-muted-foreground font-semibold text-center outline-none"
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={formData.checkInEnd}
                            onChange={(e) => setFormData({ ...formData, checkInEnd: e.target.value })}
                            className="w-full rounded-xl border border-[var(--border)] p-2 bg-[var(--surface)] text-muted-foreground font-semibold text-center outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Checkout Time</label>
                        <input
                          type="time"
                          value={formData.checkOutTime}
                          onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                          className="w-full rounded-xl border border-[var(--border)] p-2 bg-[var(--surface)] text-muted-foreground font-semibold text-center outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[var(--muted-foreground)] font-medium mb-1">Cancellation Policy</label>
                      <select
                        value={formData.cancellationPolicy}
                        onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-semibold outline-none"
                      >
                        {CANCELLATION_POLICIES.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.instantBook}
                          onChange={(e) => setFormData({ ...formData, instantBook: e.target.checked })}
                          className="rounded text-emerald-600 h-4 w-4"
                        />
                        <span>Enable Instant Booking</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isPaused}
                          onChange={(e) => setFormData({ ...formData, isPaused: e.target.checked })}
                          className="rounded text-zinc-600 h-4 w-4"
                        />
                        <span>Pause / Snooze Listing</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  disabled={editorStep === 1}
                  onClick={() => setEditorStep((prev) => Math.max(1, prev - 1))}
                  className="rounded-full px-4 py-2 border border-[var(--border)] text-xs font-semibold text-muted-foreground disabled:opacity-30"
                >
                  ← Back
                </button>

                <div className="flex items-center gap-2">
                  {editorStep < 5 ? (
                    <button
                      type="button"
                      onClick={() => setEditorStep((prev) => Math.min(5, prev + 1))}
                      className="rounded-full bg-[var(--foreground)] text-[var(--background)] px-5 py-2 text-xs font-semibold hover:opacity-90 transition-all"
                    >
                      Next Step →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-full bg-emerald-600 text-white px-6 py-2 text-xs font-semibold hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50"
                    >
                      {editingListing ? "Save Changes" : "Create Listing Draft"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Calendar / Availability Blocked Dates Modal */}
      {showAvailabilityModal && selectedListingForCal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-[var(--surface)] p-6 shadow-2xl space-y-4 border border-[var(--border)] font-sans">
            <h3 className="text-base font-semibold text-muted-foreground">
              Calendar Availability: {selectedListingForCal.title}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Manage blocked dates when your property is unavailable for booking.
            </p>

            <form onSubmit={handleSaveAvailability} className="space-y-4 text-xs">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="date"
                  value={blockedDateInput}
                  onChange={(e) => setBlockedDateInput(e.target.value)}
                  className="flex-1 rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none font-semibold"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!blockedDateInput || tempBlockedDates.includes(blockedDateInput)) return;
                    setTempBlockedDates([...tempBlockedDates, blockedDateInput].sort());
                    setBlockedDateInput("");
                  }}
                  className="rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-[#1F1F1F] font-semibold px-4 py-2"
                >
                  Block Date
                </button>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-muted-foreground block">Blocked Dates List ({tempBlockedDates.length})</span>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {tempBlockedDates.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)] italic">No dates blocked.</p>
                  ) : (
                    tempBlockedDates.map((dateStr) => (
                      <div key={dateStr} className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] font-mono font-semibold">
                        <span>📅 {dateStr}</span>
                        <button
                          type="button"
                          onClick={() => setTempBlockedDates(tempBlockedDates.filter((d) => d !== dateStr))}
                          className="text-rose-600 font-semibold text-xs"
                        >
                          Unblock
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowAvailabilityModal(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold border border-[var(--border)] text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-emerald-600 text-white px-5 py-2 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  Save Availability
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && listingToDelete && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4 border border-[var(--border)] font-sans">
            <h3 className="text-base font-semibold text-rose-600">Delete Property Listing?</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Are you sure you want to permanently delete <strong>{listingToDelete.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-full px-4 py-1.5 text-xs font-semibold border border-[var(--border)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteListing}
                disabled={pending}
                className="rounded-full bg-rose-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
