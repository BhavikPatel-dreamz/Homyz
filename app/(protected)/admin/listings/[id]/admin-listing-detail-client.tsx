"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrencyForCountry } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import {
  adminUpdateListingDetailsAction,
  adminUpdateListingPricingAction,
  adminToggleDisableListingAction,
  adminToggleFeatureListingAction,
  adminToggleVisibilityAction,
  adminModerateListingQualityAction,
  adminDeleteListingAction,
} from "@/actions/admin/listingActions";

export interface DetailListingData {
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
  latitude: number | null;
  longitude: number | null;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  photos: string[];
  amenities: string[];
  houseRules: string[];
  highlights: string[];
  safetyDisclosures: string[];
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
  weekdayBasePrice?: number;
  extraGuestFee?: number;
  isPaused: boolean;
  isFeatured: boolean;
  showExactLocation: boolean;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  host: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    phone: string | null;
  };
  hostVerification: {
    status: string;
    complianceStatus: string;
    documents: Array<{
      id: string;
      documentType: string;
      fileUrl: string;
      status: string;
      rejectionReason: string | null;
    }>;
  } | null;
  reviewer: { id: string; name: string | null; email: string | null } | null;
  approvedBy: { id: string; name: string | null; email: string | null } | null;
  bookingCount: number;
  reviewCount: number;
}

const COMMON_AMENITIES = [
  "WIFI",
  "AIR_CONDITIONING",
  "KITCHEN",
  "WASHER",
  "DRYER",
  "FREE_PARKING",
  "POOL",
  "JACUZZI",
  "GYM",
  "WORKSPACE",
  "TV",
  "PATIO",
  "BARBECUE_GRILL",
  "FIREPLACE",
  "HEATING",
  "BALCONY",
];

const HOUSE_RULE_OPTIONS = [
  "No smoking inside",
  "No loud parties or events",
  "Quiet hours between 10:00 PM and 7:00 AM",
  "Pets allowed with prior approval",
  "Suitable for children & infants",
  "Remove shoes indoors",
];

export function AdminListingDetailClient({ listing: initialListing }: { listing: DetailListingData }) {
  const { formatPrice } = useCurrency();
  const router = useRouter();
  const [listing, setListing] = useState<DetailListingData>(initialListing);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<
    "overview" | "details" | "photos" | "amenities" | "policies" | "pricing" | "moderation"
  >("overview");

  // Form states for Property Details
  const [editTitle, setEditTitle] = useState(listing.title);
  const [editDescription, setEditDescription] = useState(listing.description);
  const [editHostingType, setEditHostingType] = useState(listing.hostingType || "HOME");
  const [editPropertyType, setEditPropertyType] = useState(listing.propertyType);
  const [editListingType, setEditListingType] = useState(listing.listingType);
  const [editAddress, setEditAddress] = useState(listing.address);
  const [editCity, setEditCity] = useState(listing.city);
  const [editDistrict, setEditDistrict] = useState(listing.district);
  const [editPostalCode, setEditPostalCode] = useState(listing.postalCode);
  const [editCountry, setEditCountry] = useState(listing.country);
  const [editGuests, setEditGuests] = useState(listing.guests);
  const [editBedrooms, setEditBedrooms] = useState(listing.bedrooms);
  const [editBeds, setEditBeds] = useState(listing.beds);
  const [editBathrooms, setEditBathrooms] = useState(listing.bathrooms);

  // Form states for Photos
  const [editPhotos, setEditPhotos] = useState<string[]>(listing.photos || []);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  // Form states for Amenities & Rules
  const [editAmenities, setEditAmenities] = useState<string[]>(listing.amenities || []);
  const [editHouseRules, setEditHouseRules] = useState<string[]>(listing.houseRules || []);

  // Form states for Policies & Availability
  const [editCheckInMethod, setEditCheckInMethod] = useState(listing.checkInMethod);
  const [editCheckInStart, setEditCheckInStart] = useState(listing.checkInStart);
  const [editCheckInEnd, setEditCheckInEnd] = useState(listing.checkInEnd);
  const [editCheckOutTime, setEditCheckOutTime] = useState(listing.checkOutTime);
  const [editCancellationPolicy, setEditCancellationPolicy] = useState(listing.cancellationPolicy);
  const [editInstantBook, setEditInstantBook] = useState(listing.instantBook);
  const [editMinNights, setEditMinNights] = useState(listing.minNights);
  const [editMaxNights, setEditMaxNights] = useState(listing.maxNights);
  const [editBlockedDates, setEditBlockedDates] = useState<string[]>(listing.blockedDates || []);
  const [newBlockedDate, setNewBlockedDate] = useState("");

  // Form states for Pricing
  const [editPrice, setEditPrice] = useState((listing.weekdayBasePrice ?? listing.price) / 100);
  const [editWeekendPrice, setEditWeekendPrice] = useState((listing.weekendPrice || 0) / 100);
  const [editCleaningFee, setEditCleaningFee] = useState((listing.cleaningFee || 0) / 100);
  const [editSecurityDeposit, setEditSecurityDeposit] = useState((listing.securityDeposit || 0) / 100);
  const [editExtraGuestFee, setEditExtraGuestFee] = useState((listing.extraGuestFee || 0) / 100);
  // Moderation & Delete state
  const [modReason, setModReason] = useState(listing.rejectionReason || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function updateLocalListing(updated: Partial<DetailListingData>) {
    setListing((prev) => ({ ...prev, ...updated }));
  }

  async function handleDeleteListing() {
    setIsDeleting(true);
    const res = await adminDeleteListingAction({ listingId: listing.id });
    setIsDeleting(false);
    if (res.ok) {
      setFeedbackMsg({ type: "success", text: "Property listing deleted successfully." });
      router.push("/admin/listings");
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to delete listing." });
      setShowDeleteModal(false);
    }
  }

  // Save Handlers
  async function handleToggleFeature() {
    setIsSaving(true);
    const newFeatured = !listing.isFeatured;
    const res = await adminToggleFeatureListingAction({ listingId: listing.id, isFeatured: newFeatured });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({ isFeatured: newFeatured });
      setFeedbackMsg({ type: "success", text: newFeatured ? "Property marked as Featured!" : "Property unfeatured." });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to update featured status." });
    }
  }

  async function handleToggleDisable() {
    setIsSaving(true);
    const newPaused = !listing.isPaused;
    const res = await adminToggleDisableListingAction({ listingId: listing.id, isPaused: newPaused });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({ isPaused: newPaused, published: newPaused ? false : listing.published });
      setFeedbackMsg({ type: "success", text: newPaused ? "Listing paused/disabled." : "Listing re-enabled!" });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to toggle pause status." });
    }
  }

  async function handleToggleVisibility() {
    setIsSaving(true);
    const newPublished = !listing.published;
    const res = await adminToggleVisibilityAction({ listingId: listing.id, published: newPublished });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({ published: newPublished, status: newPublished ? "ACTIVE" : listing.status, isPaused: false });
      setFeedbackMsg({ type: "success", text: newPublished ? "Listing published and live!" : "Listing unpublished." });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to update visibility." });
    }
  }

  async function handleSaveDetails() {
    setIsSaving(true);
    const res = await adminUpdateListingDetailsAction({
      listingId: listing.id,
      title: editTitle,
      description: editDescription,
      hostingType: editHostingType,
      propertyType: editPropertyType,
      listingType: editListingType,
      address: editAddress,
      city: editCity,
      district: editDistrict,
      postalCode: editPostalCode,
      country: editCountry,
      guests: editGuests,
      bedrooms: editBedrooms,
      beds: editBeds,
      bathrooms: editBathrooms,
    });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({
        title: editTitle,
        description: editDescription,
        hostingType: editHostingType,
        propertyType: editPropertyType,
        listingType: editListingType,
        address: editAddress,
        city: editCity,
        district: editDistrict,
        postalCode: editPostalCode,
        country: editCountry,
        guests: editGuests,
        bedrooms: editBedrooms,
        beds: editBeds,
        bathrooms: editBathrooms,
      });
      setFeedbackMsg({ type: "success", text: "Listing details saved successfully!" });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to save listing details." });
    }
  }

  async function handleSavePhotos() {
    setIsSaving(true);
    const res = await adminUpdateListingDetailsAction({
      listingId: listing.id,
      photos: editPhotos,
    });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({ photos: editPhotos });
      setFeedbackMsg({ type: "success", text: `Saved ${editPhotos.length} property photos!` });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to save photos." });
    }
  }

  async function handleSaveAmenitiesAndRules() {
    setIsSaving(true);
    const res = await adminUpdateListingDetailsAction({
      listingId: listing.id,
      amenities: editAmenities,
      houseRules: editHouseRules,
    });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({ amenities: editAmenities, houseRules: editHouseRules });
      setFeedbackMsg({ type: "success", text: "Amenities and house rules saved successfully!" });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to save amenities and rules." });
    }
  }

  async function handleSavePolicies() {
    setIsSaving(true);
    const res = await adminUpdateListingDetailsAction({
      listingId: listing.id,
      checkInMethod: editCheckInMethod,
      checkInStart: editCheckInStart,
      checkInEnd: editCheckInEnd,
      checkOutTime: editCheckOutTime,
      cancellationPolicy: editCancellationPolicy,
      instantBook: editInstantBook,
      minNights: editMinNights,
      maxNights: editMaxNights,
      blockedDates: editBlockedDates,
    });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({
        checkInMethod: editCheckInMethod,
        checkInStart: editCheckInStart,
        checkInEnd: editCheckInEnd,
        checkOutTime: editCheckOutTime,
        cancellationPolicy: editCancellationPolicy,
        instantBook: editInstantBook,
        minNights: editMinNights,
        maxNights: editMaxNights,
        blockedDates: editBlockedDates,
      });
      setFeedbackMsg({ type: "success", text: "Policies & availability calendar updated!" });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to save policies." });
    }
  }

  async function handleSavePricing() {
    setIsSaving(true);
    const res = await adminUpdateListingPricingAction({
      listingId: listing.id,
      price: Math.round(editPrice * 100),
      weekdayBasePrice: Math.round(editPrice * 100),
      weekendPrice: Math.round(editWeekendPrice * 100),
      cleaningFee: Math.round(editCleaningFee * 100),
      securityDeposit: Math.round(editSecurityDeposit * 100),
      extraGuestFee: Math.round(editExtraGuestFee * 100),
    });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({
        price: Math.round(editPrice * 100),
        weekdayBasePrice: Math.round(editPrice * 100),
        weekendPrice: Math.round(editWeekendPrice * 100),
        cleaningFee: Math.round(editCleaningFee * 100),
        securityDeposit: Math.round(editSecurityDeposit * 100),
        extraGuestFee: Math.round(editExtraGuestFee * 100),
      });
      setFeedbackMsg({ type: "success", text: "Pricing & fees updated successfully!" });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to update pricing." });
    }
  }

  async function handleModerate(action: "APPROVE" | "REQUEST_CHANGES" | "REJECT") {
    setIsSaving(true);
    const res = await adminModerateListingQualityAction({
      listingId: listing.id,
      action,
      reason: modReason,
    });
    setIsSaving(false);
    if (res.ok) {
      const updated = res.data as { status: string; published: boolean; rejectionReason: string | null } | undefined;
      updateLocalListing({
        status: updated?.status ?? listing.status,
        published: updated?.published ?? listing.published,
        rejectionReason: updated?.rejectionReason ?? null,
      });
      setFeedbackMsg({ type: "success", text: `Quality moderation action applied: ${action}` });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Moderation action failed." });
    }
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-12">
      {/* Top Header & Quick Override Controls Bar */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="space-y-1.5 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <Link href="/admin/listings" className="hover:text-muted-foreground font-semibold transition-colors flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Property Listings</span>
              </Link>
              <span>/</span>
              <span className="font-mono text-[11px] font-semibold text-[var(--muted-foreground)]">#{listing.id.slice(-10)}</span>
            </div>

            {/* Title & Status Badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-muted-foreground tracking-tight">{listing.title}</h1>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                    listing.published
                      ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
                      : listing.isPaused
                      ? "bg-rose-500/20 text-rose-700 border-rose-500/30 dark:text-rose-300"
                      : "bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-300"
                  }`}
                >
                  {listing.published ? "✓ PUBLISHED (LIVE)" : listing.isPaused ? "⏸ PAUSED / DISABLED" : listing.status}
                </span>

                {listing.isFeatured && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-zinc-950 border border-amber-400 shadow-2xs">
                    ★ FEATURED
                  </span>
                )}
              </div>
            </div>

            {/* Subtitle location & host info */}
            <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1 flex-wrap">
              <span>📍 {listing.address ? `${listing.address}, ` : ""}{listing.city}, {listing.country}</span>
              <span>•</span>
              <span>Host: <strong className="text-muted-foreground">{listing.host.name || "Host"}</strong> ({listing.host.email})</span>
            </p>
          </div>

          {/* Quick Override Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleToggleFeature}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-xs border cursor-pointer ${
                listing.isFeatured
                  ? "bg-amber-500 text-zinc-950 border-amber-500 hover:bg-amber-400"
                  : "bg-[var(--surface-secondary)] text-muted-foreground border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            >
              {listing.isFeatured ? "★ Featured Property" : "☆ Feature Property"}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleToggleDisable}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                listing.isPaused ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {listing.isPaused ? "▶ Enable Listing" : "⏸ Pause Listing"}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleToggleVisibility}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                listing.published ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-700 dark:hover:bg-zinc-600"
              }`}
            >
              {listing.published ? "✓ Published" : "Publish Listing"}
            </button>

            <button
              type="button"
              disabled={isSaving || isDeleting}
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-xs bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              🗑 Delete Listing
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {feedbackMsg && (
        <div className={`rounded-2xl p-4 text-xs font-semibold border animate-in fade-in flex items-center justify-between ${
          feedbackMsg.type === "success"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
        }`}>
          <span>{feedbackMsg.text}</span>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Sticky Tab Navigation Bar */}
      <div className="sticky top-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md py-2 border-b border-[var(--border)] -mx-1 px-1">
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold scrollbar-none py-1">
          {[
            { id: "overview", icon: "📌", label: "Overview & Controls" },
            { id: "details", icon: "🏡", label: "Listing Details" },
            { id: "photos", icon: "📸", label: `Photos Gallery (${editPhotos.length})` },
            { id: "amenities", icon: "🛋️", label: "Amenities & Rules" },
            { id: "policies", icon: "🔑", label: "Check-in & Availability" },
            { id: "pricing", icon: "💰", label: "Pricing & Fees" },
            { id: "moderation", icon: "🛡️", label: "Quality Moderation" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-amber-500 text-zinc-950 font-bold shadow-sm scale-102"
                  : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-muted-foreground hover:bg-[var(--muted)]"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: OVERVIEW & CONTROLS */}
      {activeTab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in">
          {/* Main Cover & Summary Card */}
          <div className="lg:col-span-2 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6 shadow-2xs">
            {/* Gallery Cover Grid */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl overflow-hidden aspect-16/9 bg-zinc-100 dark:bg-zinc-900 border border-[var(--border-subtle)]">
              {listing.photos && listing.photos.length > 0 ? (
                <>
                  <div className="col-span-2 relative h-full">
                    <img src={listing.photos[0]} alt="Cover photo" className="w-full h-full object-cover" />
                    <span className="absolute bottom-3 left-3 bg-black/75 text-white text-[10px] px-2.5 py-1 rounded-full font-mono font-semibold backdrop-blur-xs">
                      ★ Cover Photo
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 h-full">
                    {listing.photos[1] ? (
                      <img src={listing.photos[1]} alt="Photo 2" className="w-full h-1/2 object-cover" />
                    ) : (
                      <div className="w-full h-1/2 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs">📷</div>
                    )}
                    {listing.photos[2] ? (
                      <img src={listing.photos[2]} alt="Photo 3" className="w-full h-1/2 object-cover" />
                    ) : (
                      <div className="w-full h-1/2 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs">📷</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="col-span-full h-full flex flex-col items-center justify-center text-[var(--muted-foreground)] p-6 text-center">
                  <span className="text-4xl mb-2">🏡</span>
                  <span className="text-xs font-semibold">No Property Photos Uploaded</span>
                </div>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[var(--border-subtle)] pt-5 text-xs font-medium">
              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex flex-col gap-1">
                <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold tracking-wider">Nightly Rate</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatPrice(listing.price, getCurrencyForCountry(listing.country))}</span>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex flex-col gap-1">
                <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold tracking-wider">Total Bookings</span>
                <span className="text-xl font-black text-muted-foreground font-mono">{listing.bookingCount}</span>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex flex-col gap-1">
                <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold tracking-wider">Capacity</span>
                <span className="text-sm font-bold text-muted-foreground">{listing.guests} Guests ({listing.bedrooms} Beds)</span>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex flex-col gap-1">
                <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold tracking-wider">Photos Quality</span>
                <span className={`text-sm font-bold ${listing.photos.length >= 5 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {listing.photos.length} / 5 Min
                </span>
              </div>
            </div>
          </div>

          {/* Host & Audit Info Sidebar */}
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6 shadow-2xs text-xs">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">Host Account Overview</h3>
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)]">
                {listing.host.image ? (
                  <img src={listing.host.image} alt={listing.host.name || ""} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-zinc-950 font-black flex items-center justify-center text-sm shrink-0">
                    {listing.host.name?.slice(0, 1) || "H"}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-muted-foreground truncate">{listing.host.name || "Host"}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)] truncate">{listing.host.email}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Host Verification & Documents</h3>
              {listing.hostVerification ? (
                <div className="space-y-2">
                  <p><strong className="text-muted-foreground">Application:</strong> <span className="font-semibold">{listing.hostVerification.status}</span></p>
                  <p><strong className="text-muted-foreground">Compliance:</strong> <span className="font-semibold">{listing.hostVerification.complianceStatus}</span></p>
                  {listing.hostVerification.documents.length ? (
                    <ul className="space-y-1.5 pt-1">
                      {listing.hostVerification.documents.map((document) => (
                        <li key={document.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)]">
                          <a href={document.fileUrl} target="_blank" rel="noreferrer" className="truncate text-amber-600 underline font-semibold dark:text-amber-300">
                            📄 {document.documentType.replace(/_/g, " ")}
                          </a>
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">{document.status}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-[var(--muted-foreground)]">No verification documents uploaded.</p>}
                </div>
              ) : <p className="text-[var(--muted-foreground)]">No host verification application found.</p>}
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Audit & History Logs</h3>
              <p><strong className="text-muted-foreground">Created:</strong> {new Date(listing.createdAt).toLocaleString()}</p>
              <p><strong className="text-muted-foreground">Last Updated:</strong> {new Date(listing.updatedAt).toLocaleString()}</p>
              {listing.approvedAt && <p><strong className="text-muted-foreground">Approved At:</strong> {new Date(listing.approvedAt).toLocaleString()}</p>}
              {listing.reviewer && <p><strong className="text-muted-foreground">Reviewer Admin:</strong> {listing.reviewer.name} ({listing.reviewer.email})</p>}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LISTING DETAILS */}
      {activeTab === "details" && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 space-y-6 shadow-2xs text-xs animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="text-lg font-black text-muted-foreground">Property Basic Information & Capacity</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Edit title, property type, category, address, and guest capacity.</p>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveDetails}
              className="rounded-full bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md transition-all self-start sm:self-auto cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Details"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block font-bold text-muted-foreground mb-1">Property Title *</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground font-semibold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-muted-foreground mb-1">Detailed Property Description *</label>
              <textarea
                rows={4}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 text-xs text-muted-foreground outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all leading-relaxed"
              />
            </div>

            <div>
              <label className="block font-bold text-muted-foreground mb-1">Hosting Category</label>
              <select
                value={editHostingType}
                onChange={(e) => setEditHostingType(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground font-semibold outline-none focus:border-amber-500 transition-all"
              >
                <option value="HOME">Residential Home</option>
                <option value="EXPERIENCE">Experience</option>
                <option value="SERVICE">Service</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-muted-foreground mb-1">Property Type</label>
              <input
                type="text"
                value={editPropertyType}
                onChange={(e) => setEditPropertyType(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground font-semibold outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-muted-foreground mb-1">Street Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">City / Region</label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Country</label>
                <input
                  type="text"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground outline-none focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[var(--border-subtle)] pt-4">
              <div>
                <label className="block font-bold text-muted-foreground mb-1">Guests Capacity</label>
                <input
                  type="number"
                  min={1}
                  value={editGuests}
                  onChange={(e) => setEditGuests(Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground font-bold text-center outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Bedrooms</label>
                <input
                  type="number"
                  min={0}
                  value={editBedrooms}
                  onChange={(e) => setEditBedrooms(Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground font-bold text-center outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Beds</label>
                <input
                  type="number"
                  min={1}
                  value={editBeds}
                  onChange={(e) => setEditBeds(Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground font-bold text-center outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-muted-foreground mb-1">Bathrooms</label>
                <input
                  type="number"
                  min={1}
                  value={editBathrooms}
                  onChange={(e) => setEditBathrooms(Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground font-bold text-center outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PHOTOS GALLERY */}
      {activeTab === "photos" && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 space-y-6 shadow-2xs text-xs animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="text-lg font-black text-muted-foreground">Property Photos & Media Gallery</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Upload image files directly or paste image URLs. Minimum 5 photos required for approval.</p>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSavePhotos}
              className="rounded-full bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md transition-all self-start sm:self-auto cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Gallery"}
            </button>
          </div>

          {/* Photo File Upload & Add URL */}
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-[#1F1F1F] font-bold px-5 py-3 hover:opacity-90 transition-all shrink-0">
              <span>📁 Upload Photo File</span>
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
                      credentials: "include",
                      body,
                    });
                    const data = await res.json();
                    if (res.ok && data.url) {
                      setEditPhotos([...editPhotos, data.url]);
                      setFeedbackMsg({ type: "success", text: "Photo uploaded successfully!" });
                    } else {
                      setFeedbackMsg({ type: "error", text: data.error || "Failed to upload photo." });
                    }
                  } catch (err: any) {
                    setFeedbackMsg({ type: "error", text: "Upload failed: " + err.message });
                  }
                  e.target.value = "";
                }}
              />
            </label>

            <div className="flex-1 flex gap-2">
              <input
                type="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="Or paste image URL (e.g. https://images.unsplash.com/...)"
                className="flex-1 rounded-2xl border border-[var(--border)] p-3 bg-[var(--surface-secondary)] text-muted-foreground outline-none focus:border-amber-500 transition-all"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newPhotoUrl.trim()) return;
                  setEditPhotos([...editPhotos, newPhotoUrl.trim()]);
                  setNewPhotoUrl("");
                }}
                className="rounded-2xl bg-amber-500 text-zinc-950 font-bold px-5 py-3 hover:bg-amber-400 shrink-0 cursor-pointer"
              >
                + Add URL
              </button>
            </div>
          </div>

          {/* Grid view */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            {editPhotos.map((url, idx) => (
              <div key={idx} className="relative aspect-4/3 rounded-2xl overflow-hidden border border-[var(--border)] bg-zinc-100 group shadow-2xs">
                <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPhotos(editPhotos.filter((_, i) => i !== idx))}
                    className="bg-rose-600 hover:bg-rose-700 text-white rounded-full px-3.5 py-1 text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    🗑 Remove
                  </button>
                </div>
                <span className="absolute bottom-2 left-2 bg-black/75 text-white text-[10px] px-2 py-0.5 rounded font-mono font-semibold">
                  #{idx + 1} {idx === 0 ? "★ Cover" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AMENITIES & RULES */}
      {activeTab === "amenities" && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 space-y-6 shadow-2xs text-xs animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="text-lg font-black text-muted-foreground">Property Amenities & House Rules</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Manage feature amenities chips and rules for guest stays.</p>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAmenitiesAndRules}
              className="rounded-full bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md transition-all self-start sm:self-auto cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Amenities & Rules"}
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-sm text-muted-foreground mb-3">Amenities Selector</h3>
              <div className="flex flex-wrap gap-2">
                {COMMON_AMENITIES.map((am) => {
                  const active = editAmenities.includes(am);
                  return (
                    <button
                      key={am}
                      type="button"
                      onClick={() => {
                        setEditAmenities(active ? editAmenities.filter((a) => a !== am) : [...editAmenities, am]);
                      }}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                        active
                          ? "bg-amber-500 text-zinc-950 border-amber-500 shadow-2xs font-bold"
                          : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      {active ? "✓ " : "+ "}{am.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-5">
              <h3 className="font-bold text-sm text-muted-foreground mb-3">House Rules</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {HOUSE_RULE_OPTIONS.map((rule) => {
                  const active = editHouseRules.includes(rule);
                  return (
                    <button
                      key={rule}
                      type="button"
                      onClick={() => {
                        setEditHouseRules(active ? editHouseRules.filter((r) => r !== rule) : [...editHouseRules, rule]);
                      }}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left text-xs transition-all cursor-pointer ${
                        active
                          ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold"
                          : "border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground hover:bg-[var(--muted)]"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${active ? "bg-amber-500 text-zinc-950 font-bold" : "border border-[var(--border)]"}`}>
                        {active ? "✓" : ""}
                      </span>
                      <span>{rule}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: POLICIES & AVAILABILITY */}
      {activeTab === "policies" && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 space-y-6 shadow-2xs text-xs animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="text-lg font-black text-muted-foreground">Check-in, Policies & Calendar Availability</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Manage check-in details, cancellation policies, and blocked calendar dates.</p>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSavePolicies}
              className="rounded-full bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md transition-all self-start sm:self-auto cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Policies & Calendar"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-bold text-muted-foreground mb-1">Check-in Method</label>
              <input
                type="text"
                value={editCheckInMethod}
                onChange={(e) => setEditCheckInMethod(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground font-semibold outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-bold text-muted-foreground mb-1">Check-in Window</label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={editCheckInStart}
                  onChange={(e) => setEditCheckInStart(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground font-semibold text-center outline-none focus:border-amber-500"
                />
                <span className="font-semibold text-[var(--muted-foreground)]">to</span>
                <input
                  type="time"
                  value={editCheckInEnd}
                  onChange={(e) => setEditCheckInEnd(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground font-semibold text-center outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-muted-foreground mb-1">Checkout Time</label>
              <input
                type="time"
                value={editCheckOutTime}
                onChange={(e) => setEditCheckOutTime(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground font-semibold text-center outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Blocked Dates Manager */}
          <div className="border-t border-[var(--border-subtle)] pt-5 space-y-3">
            <h3 className="font-bold text-sm text-muted-foreground">Blocked Dates Calendar Manager ({editBlockedDates.length})</h3>
            <div className="flex gap-2 max-w-md">
              <input
                type="date"
                value={newBlockedDate}
                onChange={(e) => setNewBlockedDate(e.target.value)}
                className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground font-semibold outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newBlockedDate || editBlockedDates.includes(newBlockedDate)) return;
                  setEditBlockedDates([...editBlockedDates, newBlockedDate].sort());
                  setNewBlockedDate("");
                }}
                className="rounded-2xl bg-amber-500 text-zinc-950 font-bold px-5 py-2.5 text-xs hover:bg-amber-400 shrink-0 cursor-pointer"
              >
                + Block Date
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {editBlockedDates.length === 0 ? (
                <p className="text-[var(--muted-foreground)] text-xs italic">No blocked dates set on this property calendar.</p>
              ) : (
                editBlockedDates.map((dateStr) => (
                  <span key={dateStr} className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-mono font-semibold">
                    📅 {dateStr}
                    <button
                      type="button"
                      onClick={() => setEditBlockedDates(editBlockedDates.filter((d) => d !== dateStr))}
                      className="text-rose-600 font-bold hover:text-rose-700 ml-1 cursor-pointer"
                      title="Remove blocked date"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: PRICING & FEES */}
      {activeTab === "pricing" && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 space-y-6 shadow-2xs text-xs animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="text-lg font-black text-muted-foreground">Nightly Rates & Mandatory Fees</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Configure standard price, weekend rates, cleaning fees, and security deposit.</p>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSavePricing}
              className="rounded-full bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 shadow-md transition-all self-start sm:self-auto cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Pricing"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block font-bold text-muted-foreground mb-1">Standard Base Rate ({getCurrencyForCountry(listing.country)}/night) *</label>
              <input
                type="number"
                min="0"
                value={editPrice}
                onChange={(e) => setEditPrice(Number(e.target.value))}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm text-muted-foreground font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-bold text-muted-foreground mb-1">Weekend Rate ({getCurrencyForCountry(listing.country)}/night)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editWeekendPrice}
                onChange={(e) => setEditWeekendPrice(Number(e.target.value))}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm text-muted-foreground font-mono font-semibold outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-bold text-muted-foreground mb-1">Cleaning Fee ({getCurrencyForCountry(listing.country)})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editCleaningFee}
                onChange={(e) => setEditCleaningFee(Number(e.target.value))}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm text-muted-foreground font-mono font-semibold outline-none focus:border-amber-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-bold text-muted-foreground mb-1">Security Deposit / Extra Fee ({getCurrencyForCountry(listing.country)})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editSecurityDeposit}
                onChange={(e) => setEditSecurityDeposit(Number(e.target.value))}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm text-muted-foreground font-mono font-semibold outline-none focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs space-y-1">
            <span className="font-bold text-amber-700 dark:text-amber-300">Platform Pricing Architecture:</span>
            <p className="text-muted-foreground">Standard base price is applied for weekday nights. Weekend pricing applies on applicable weekend nights.</p>
          </div>
        </div>
      )}

      {/* TAB 7: QUALITY MODERATION */}
      {activeTab === "moderation" && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 space-y-6 shadow-2xs text-xs animate-in fade-in">
          <div className="border-b border-[var(--border-subtle)] pb-4">
            <h2 className="text-lg font-black text-muted-foreground">Quality Moderation & Audit Review</h2>
            <p className="text-xs text-[var(--muted-foreground)] font-medium">Review quality standards, issue requested changes, or approve listing for live publication.</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Listing Audit Checklist</h3>
            
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground">Minimum 5 High Quality Photos:</span>
              <span className={`font-bold ${editPhotos.length >= 5 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {editPhotos.length >= 5 ? "✓ PASSED" : `⚠️ FAILED (${editPhotos.length} / 5 photos)`}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5">
              <span className="font-semibold text-muted-foreground">Standard Base Price Set:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ PASSED ({getCurrencyForCountry(listing.country)} {editPrice}/night)</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-muted-foreground mb-2">Feedback Note / Rejection Reason</label>
            <textarea
              rows={4}
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
              placeholder="Enter quality feedback instructions or reason for requesting changes/rejection..."
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 text-xs text-muted-foreground outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleModerate("REJECT")}
              className="rounded-full bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Reject Listing
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleModerate("REQUEST_CHANGES")}
              className="rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-6 py-2.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Request Changes
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleModerate("APPROVE")}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Approve Listing
            </button>
          </div>
        </div>
      )}

      {/* Delete Listing Confirmation Modal */}
      {showDeleteModal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[var(--surface)] p-6 shadow-2xl space-y-4 border border-[var(--border)] animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-600 flex items-center justify-center font-bold text-lg border border-rose-500/30 shrink-0">
                ⚠️
              </div>
              <h3 className="text-base font-bold text-muted-foreground">Permanently Delete Listing?</h3>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Are you sure you want to delete <strong className="text-muted-foreground">{listing.title}</strong>? This action will completely and permanently remove the property listing, associated bookings, and database records. This cannot be undone.
            </p>
            {listing.bookingCount > 0 && (
              <div className="rounded-xl border border-rose-300/50 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-900 dark:text-rose-300">
                <strong>⚠️ Notice:</strong> This property has {listing.bookingCount} associated booking(s). Deleting will permanently erase all associated booking records.
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="rounded-full px-5 py-2.5 text-xs font-semibold border border-[var(--border)] hover:bg-[var(--surface-secondary)] text-muted-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteListing}
                className="rounded-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete Permanently"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
