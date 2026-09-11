"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatSarFromHalalas } from "@/lib/currency";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  adminUpdateListingDetailsAction,
  adminUpdateListingPricingAction,
  adminToggleDisableListingAction,
  adminToggleFeatureListingAction,
  adminToggleVisibilityAction,
  adminModerateListingQualityAction,
  adminDeleteListingAction,
} from "@/actions/admin/listingActions";

export interface FullListingItem {
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
  isPaused: boolean;
  isFeatured: boolean;
  showExactLocation: boolean;
  rejectionReason: string | null;
  createdAt: string;
  host: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  bookingCount: number;
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

export function AdminListingsClient({
  initialListings,
  summary,
}: {
  initialListings: FullListingItem[];
  summary: { total: number; published: number; draft: number; featured: number; paused: number };
}) {
  const router = useRouter();
  const [listings, setListings] = useState<FullListingItem[]>(initialListings);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedListing, setSelectedListing] = useState<FullListingItem | null>(null);

  // Modal active tab: "overview" | "details" | "photos" | "policies" | "pricing" | "moderation"
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "photos" | "policies" | "pricing" | "moderation">("overview");

  // Form states for property details
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editHostingType, setEditHostingType] = useState("HOME");
  const [editPropertyType, setEditPropertyType] = useState("");
  const [editListingType, setEditListingType] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editGuests, setEditGuests] = useState(1);
  const [editBedrooms, setEditBedrooms] = useState(1);
  const [editBeds, setEditBeds] = useState(1);
  const [editBathrooms, setEditBathrooms] = useState(1);
  const [editAmenities, setEditAmenities] = useState<string[]>([]);
  const [editHouseRules, setEditHouseRules] = useState<string[]>([]);

  // Form states for photos
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  // Form states for check-in & policies
  const [editCheckInMethod, setEditCheckInMethod] = useState("SMART_LOCK");
  const [editCheckInStart, setEditCheckInStart] = useState("15:00");
  const [editCheckInEnd, setEditCheckInEnd] = useState("22:00");
  const [editCheckOutTime, setEditCheckOutTime] = useState("11:00");
  const [editCancellationPolicy, setEditCancellationPolicy] = useState("FLEXIBLE");
  const [editInstantBook, setEditInstantBook] = useState(true);
  const [editMinNights, setEditMinNights] = useState(1);
  const [editMaxNights, setEditMaxNights] = useState(365);
  const [editBlockedDates, setEditBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");

  // Form states for pricing
  const [editPrice, setEditPrice] = useState(100);
  const [editWeekendPrice, setEditWeekendPrice] = useState(0);
  const [editCleaningFee, setEditCleaningFee] = useState(0);
  const [editSecurityDeposit, setEditSecurityDeposit] = useState(0);

  // Moderation state
  const [modReason, setModReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter listings
  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (statusFilter === "PUBLISHED" && !l.published) return false;
      if (statusFilter === "DRAFT" && l.published) return false;
      if (statusFilter === "FEATURED" && !l.isFeatured) return false;
      if (statusFilter === "PAUSED" && !l.isPaused) return false;
      if (statusFilter === "PENDING_REVIEW" && l.status !== "PENDING_REVIEW") return false;
      if (statusFilter === "CHANGES_REQUESTED" && l.status !== "CHANGES_REQUESTED") return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchTitle = l.title.toLowerCase().includes(q);
        const matchHost = l.host.name?.toLowerCase().includes(q) || l.host.email?.toLowerCase().includes(q);
        const matchId = l.id.toLowerCase().includes(q);
        const matchCity = l.city.toLowerCase().includes(q);
        if (!matchTitle && !matchHost && !matchId && !matchCity) return false;
      }
      return true;
    });
  }, [listings, search, statusFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedListings = useMemo(() => {
    return filtered.slice((activePage - 1) * pageSize, activePage * pageSize);
  }, [filtered, activePage, pageSize]);

  function openListingModal(item: FullListingItem) {
    setSelectedListing(item);
    setActiveTab("overview");
    setFeedbackMsg(null);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditHostingType(item.hostingType || "HOME");
    setEditPropertyType(item.propertyType);
    setEditListingType(item.listingType);
    setEditAddress(item.address);
    setEditCity(item.city);
    setEditDistrict(item.district || "");
    setEditPostalCode(item.postalCode || "");
    setEditCountry(item.country);
    setEditGuests(item.guests);
    setEditBedrooms(item.bedrooms);
    setEditBeds(item.beds);
    setEditBathrooms(item.bathrooms);
    setEditAmenities(item.amenities || []);
    setEditHouseRules(item.houseRules || []);

    setEditPhotos(item.photos || []);
    setNewPhotoUrl("");

    setEditCheckInMethod(item.checkInMethod || "SMART_LOCK");
    setEditCheckInStart(item.checkInStart || "15:00");
    setEditCheckInEnd(item.checkInEnd || "22:00");
    setEditCheckOutTime(item.checkOutTime || "11:00");
    setEditCancellationPolicy(item.cancellationPolicy || "FLEXIBLE");
    setEditInstantBook(item.instantBook ?? true);
    setEditMinNights(item.minNights || 1);
    setEditMaxNights(item.maxNights || 365);
    setEditBlockedDates(item.blockedDates || []);
    setNewBlockedDate("");

    setEditPrice(item.price / 100);
    setEditWeekendPrice((item.weekendPrice || 0) / 100);
    setEditCleaningFee((item.cleaningFee || 0) / 100);
    setEditSecurityDeposit((item.securityDeposit || 0) / 100);
    setModReason(item.rejectionReason || "");
  }

  function updateLocalListing(updatedItem: Partial<FullListingItem>) {
    if (!selectedListing) return;
    const updated = { ...selectedListing, ...updatedItem };
    setSelectedListing(updated);
    setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<FullListingItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteListing() {
    if (!listingToDelete) return;
    setIsDeleting(true);
    const res = await adminDeleteListingAction({ listingId: listingToDelete.id });
    setIsDeleting(false);
    if (res.ok) {
      setListings((prev) => prev.filter((l) => l.id !== listingToDelete.id));
      if (selectedListing?.id === listingToDelete.id) {
        setSelectedListing(null);
      }
      setFeedbackMsg({ type: "success", text: "Property listing deleted successfully." });
      setShowDeleteModal(false);
      setListingToDelete(null);
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to delete listing." });
    }
  }

  // Action handlers
  async function handleToggleFeature() {
    if (!selectedListing) return;
    setIsSaving(true);
    const newFeatured = !selectedListing.isFeatured;
    const res = await adminToggleFeatureListingAction({ listingId: selectedListing.id, isFeatured: newFeatured });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({ isFeatured: newFeatured });
      setFeedbackMsg({ type: "success", text: newFeatured ? "Property marked as Featured!" : "Property removed from Featured." });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to update featured status." });
    }
  }

  async function handleToggleDisable() {
    if (!selectedListing) return;
    setIsSaving(true);
    const newPaused = !selectedListing.isPaused;
    const res = await adminToggleDisableListingAction({ listingId: selectedListing.id, isPaused: newPaused });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({ isPaused: newPaused, published: newPaused ? false : selectedListing.published });
      setFeedbackMsg({ type: "success", text: newPaused ? "Listing disabled/paused." : "Listing enabled." });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to disable listing." });
    }
  }

  async function handleToggleVisibility() {
    if (!selectedListing) return;
    setIsSaving(true);
    const newPublished = !selectedListing.published;
    const res = await adminToggleVisibilityAction({ listingId: selectedListing.id, published: newPublished });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({ published: newPublished, status: newPublished ? "ACTIVE" : selectedListing.status, isPaused: false });
      setFeedbackMsg({ type: "success", text: newPublished ? "Listing published & active!" : "Listing unpublished." });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to toggle visibility." });
    }
  }

  async function handleSaveDetails() {
    if (!selectedListing) return;
    setIsSaving(true);
    const res = await adminUpdateListingDetailsAction({
      listingId: selectedListing.id,
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
      amenities: editAmenities,
      houseRules: editHouseRules,
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
        amenities: editAmenities,
        houseRules: editHouseRules,
      });
      setFeedbackMsg({ type: "success", text: "Property details updated successfully!" });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to update property details." });
    }
  }

  async function handleSavePhotos() {
    if (!selectedListing) return;
    setIsSaving(true);
    const res = await adminUpdateListingDetailsAction({
      listingId: selectedListing.id,
      photos: editPhotos,
    });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({ photos: editPhotos });
      setFeedbackMsg({ type: "success", text: `Updated property gallery (${editPhotos.length} photos saved)!` });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to update photos." });
    }
  }

  async function handleSavePolicies() {
    if (!selectedListing) return;
    setIsSaving(true);
    const res = await adminUpdateListingDetailsAction({
      listingId: selectedListing.id,
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
      setFeedbackMsg({ type: "success", text: "Check-in details, policies & availability updated successfully!" });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to update policies." });
    }
  }

  async function handleSavePricing() {
    if (!selectedListing) return;
    setIsSaving(true);
    const res = await adminUpdateListingPricingAction({
      listingId: selectedListing.id,
      price: Math.round(editPrice * 100),
      weekendPrice: Math.round(editWeekendPrice * 100),
      cleaningFee: Math.round(editCleaningFee * 100),
      securityDeposit: Math.round(editSecurityDeposit * 100),
    });
    setIsSaving(false);
    if (res.ok) {
      updateLocalListing({
        price: Math.round(editPrice * 100),
        weekendPrice: Math.round(editWeekendPrice * 100),
        cleaningFee: Math.round(editCleaningFee * 100),
        securityDeposit: Math.round(editSecurityDeposit * 100),
      });
      setFeedbackMsg({ type: "success", text: "Pricing & fees updated successfully!" });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to update pricing." });
    }
  }

  async function handleModerate(action: "APPROVE" | "REQUEST_CHANGES" | "REJECT") {
    if (!selectedListing) return;
    setIsSaving(true);
    const res = await adminModerateListingQualityAction({
      listingId: selectedListing.id,
      action,
      reason: modReason,
    });
    setIsSaving(false);
    if (res.ok) {
      const updated = res.data as { status: string; published: boolean; rejectionReason: string | null } | undefined;
      updateLocalListing({
        status: updated?.status ?? selectedListing.status,
        published: updated?.published ?? selectedListing.published,
        rejectionReason: updated?.rejectionReason ?? null,
      });
      setFeedbackMsg({ type: "success", text: `Quality moderation action applied: ${action}` });
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Moderation action failed." });
    }
  }

  function toggleAmenityChip(amenity: string) {
    if (editAmenities.includes(amenity)) {
      setEditAmenities(editAmenities.filter((a) => a !== amenity));
    } else {
      setEditAmenities([...editAmenities, amenity]);
    }
  }

  function toggleHouseRuleChip(rule: string) {
    if (editHouseRules.includes(rule)) {
      setEditHouseRules(editHouseRules.filter((r) => r !== rule));
    } else {
      setEditHouseRules([...editHouseRules, rule]);
    }
  }

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["Listing ID", "Title", "Host", "Price per Night", "Status", "Featured", "Disabled/Paused", "City", "Created Date"];
    const rows = filtered.map((l) => [
      `"${l.id}"`,
      `"${l.title.replace(/"/g, '""')}"`,
      `"${l.host.name || ""}"`,
      `"${formatSarFromHalalas(l.price)}"`,
      `"${l.published ? "Published" : l.status}"`,
      `"${l.isFeatured ? "Yes" : "No"}"`,
      `"${l.isPaused ? "Yes" : "No"}"`,
      `"${l.city}"`,
      `"${new Date(l.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `admin_listings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1>
            Admin Property Listings Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Full administrative control: edit details, photo gallery upload, pricing, feature properties, disable listings, check-in policies, blocked dates, and quality moderation.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-5 py-2.5 text-xs font-semibold transition-all shadow-md shrink-0 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV ({filtered.length})
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Total Listings</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-muted-foreground">{summary.total}</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active & Live</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{summary.published}</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Featured ★</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">{summary.featured}</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">Disabled / Paused</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-rose-500">{summary.paused}</p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Drafts / Review</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-muted-foreground">{summary.draft}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, city, host name, ID..."
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-2.5 pl-9 pr-9 text-xs text-muted-foreground outline-none focus:border-amber-500 transition-all"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)] hover:text-muted-foreground">
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-muted-foreground outline-none"
          >
            <option value="ALL">Status: All Properties</option>
            <option value="PUBLISHED">Published & Active</option>
            <option value="FEATURED">Featured Properties ★</option>
            <option value="PAUSED">Disabled / Paused</option>
            <option value="DRAFT">Draft Listings</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="CHANGES_REQUESTED">Changes Requested</option>
          </select>
        </div>
      </div>

      {/* Listings Table */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">ID</th>
                <th className="py-3.5 px-4">Property & City</th>
                <th className="py-3.5 px-4">Host</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Nightly Rate</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Badges</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                    No property listings match the selected criteria.
                  </td>
                </tr>
              ) : (
                paginatedListings.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/listings/${item.id}`)}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--muted-foreground)] font-semibold">
                        #{item.id.slice(-8)}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-muted-foreground">
                        <div className="flex items-center gap-3">
                          {item.photos && item.photos.length > 0 ? (
                            <img src={item.photos[0]} alt={item.title} className="w-10 h-10 rounded-lg object-cover border border-[var(--border-subtle)]" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs">🏡</div>
                          )}
                          <div className="flex flex-col">
                            <span className="truncate max-w-[200px] font-semibold text-xs">{item.title}</span>
                            <span className="text-[10px] text-[var(--muted-foreground)] font-normal">{item.city ? `${item.city}, ${item.country}` : "Location pending"}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs">{item.host.name || "Host"}</span>
                          <span className="text-[10px] text-[var(--muted-foreground)]">{item.host.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-muted-foreground font-mono text-xs">
                        {formatSarFromHalalas(item.price)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            item.published
                              ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
                              : item.isPaused
                              ? "bg-rose-500/20 text-rose-700 border-rose-500/30 dark:text-rose-300"
                              : "bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-300"
                          }`}
                        >
                          {item.published ? "PUBLISHED" : item.isPaused ? "DISABLED" : item.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {item.isFeatured && (
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black text-amber-600 dark:text-amber-300 border border-amber-500/30">
                              ★ Featured
                            </span>
                          )}
                          {item.isPaused && (
                            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] font-semibold text-rose-500 border border-rose-500/30">
                              Paused
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/listings/${item.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-3.5 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-amber-400 transition-all shadow-xs"
                          >
                            Manage Listing →
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setListingToDelete(item);
                              setShowDeleteModal(true);
                            }}
                            title="Delete Listing"
                            className="inline-flex items-center justify-center rounded-full bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-[11px] font-semibold transition-all shadow-xs"
                          >
                            🗑 Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => openListingModal(item)}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-2.5 active:bg-[var(--surface-secondary)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] text-[var(--muted-foreground)] block">#{item.id.slice(-8)}</span>
                <h3 className="font-semibold text-xs text-muted-foreground mt-0.5">{item.title}</h3>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${item.published ? "bg-emerald-500/20 text-emerald-600" : "bg-amber-500/20 text-amber-600"}`}>
                {item.published ? "ACTIVE" : item.status}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--border-subtle)] font-mono font-semibold">
              <span>{formatSarFromHalalas(item.price)} / night</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openListingModal(item);
                }}
                className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950"
              >
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      <AdminPagination
        currentPage={activePage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        itemLabel="listings"
        pageSizeOptions={[10, 20, 50]}
      />

      {/* Admin Full Management Workspace Drawer / Modal */}
      {selectedListing && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[var(--surface)] text-muted-foreground p-6 sm:p-8 shadow-2xl border border-[var(--border)] flex flex-col gap-5 animate-in fade-in zoom-in-95">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[var(--muted-foreground)] font-semibold">#{selectedListing.id.slice(-10)}</span>
                  {selectedListing.isFeatured && (
                    <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-black text-amber-600 dark:text-amber-300">
                      ★ FEATURED
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${selectedListing.published ? "bg-emerald-500/20 text-emerald-600" : "bg-amber-500/20 text-amber-600"}`}>
                    {selectedListing.published ? "PUBLISHED" : selectedListing.status}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-black text-muted-foreground">{selectedListing.title}</h2>
                <p className="text-xs text-[var(--muted-foreground)]">Host: {selectedListing.host.name} ({selectedListing.host.email})</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="h-8 w-8 rounded-full flex items-center justify-center bg-[var(--surface-secondary)] text-muted-foreground hover:bg-[var(--muted)]"
              >
                ✕
              </button>
            </div>

            {/* Notification Alert Banner */}
            {feedbackMsg && (
              <div className={`rounded-2xl p-3.5 text-xs font-semibold ${feedbackMsg.type === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-600 border border-rose-500/30"}`}>
                {feedbackMsg.text}
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex gap-1.5 border-b border-[var(--border)] pb-2 overflow-x-auto text-xs font-semibold scrollbar-none">
              {[
                { id: "overview", label: "1. Overview & Controls" },
                { id: "details", label: "2. Edit Details & Rules" },
                { id: "photos", label: `3. Photos (${editPhotos.length})` },
                { id: "policies", label: "4. Policies & Availability" },
                { id: "pricing", label: "5. Pricing & Fees" },
                { id: "moderation", label: "6. Quality Moderation" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`rounded-full px-3.5 py-1.5 whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? "bg-amber-500 text-zinc-950 shadow-xs"
                      : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: OVERVIEW & CONTROLS */}
            {activeTab === "overview" && (
              <div className="space-y-4 animate-in fade-in">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Quick Status Control Box */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-5 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Visibility & Administrative Override Controls</h3>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Publish / Unpublish Listing</span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleToggleVisibility}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${selectedListing.published ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-200"}`}
                      >
                        {selectedListing.published ? "✓ Published (Live)" : "Unpublished"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                      <span className="text-xs font-semibold text-muted-foreground">Disable / Pause Listing</span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleToggleDisable}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${selectedListing.isPaused ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}
                      >
                        {selectedListing.isPaused ? "⏸ Listing Paused" : "Active / Enabled"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                      <span className="text-xs font-semibold text-muted-foreground">Feature on Homepage</span>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleToggleFeature}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${selectedListing.isFeatured ? "bg-amber-500 text-zinc-950 shadow-xs" : "bg-zinc-700 text-zinc-200"}`}
                      >
                        {selectedListing.isFeatured ? "★ Featured Property" : "Not Featured"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Permanently Delete Listing</span>
                      <button
                        type="button"
                        disabled={isSaving || isDeleting}
                        onClick={() => {
                          setListingToDelete(selectedListing);
                          setShowDeleteModal(true);
                        }}
                        className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
                      >
                        🗑 Delete Listing
                      </button>
                    </div>
                  </div>

                  {/* Summary Overview Card */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-5 space-y-2 text-xs">
                    <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Property Summary Overview</h3>
                    <p><strong className="text-muted-foreground">Location:</strong> {selectedListing.address || "Address pending"}, {selectedListing.city}, {selectedListing.country}</p>
                    <p><strong className="text-muted-foreground">Property Type:</strong> {selectedListing.propertyType} ({selectedListing.listingType})</p>
                    <p><strong className="text-muted-foreground">Capacity:</strong> {selectedListing.guests} Guests • {selectedListing.bedrooms} Bed • {selectedListing.bathrooms} Bath</p>
                    <p><strong className="text-muted-foreground">Photos Uploaded:</strong> {selectedListing.photos.length} photos ({selectedListing.photos.length >= 5 ? "✓ Meets minimum" : "⚠️ Needs 5 photos"})</p>
                    <p><strong className="text-muted-foreground">Pricing:</strong> {formatSarFromHalalas(selectedListing.price)} / night</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EDIT PROPERTY DETAILS */}
            {activeTab === "details" && (
              <div className="space-y-4 animate-in fade-in text-xs">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-muted-foreground">Title *</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-muted-foreground">Detailed Description *</label>
                    <textarea
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Property Type</label>
                    <input
                      type="text"
                      value={editPropertyType}
                      onChange={(e) => setEditPropertyType(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Listing Type</label>
                    <input
                      type="text"
                      value={editListingType}
                      onChange={(e) => setEditListingType(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Address</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">City</label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2 sm:col-span-2">
                    <div>
                      <label className="block font-semibold text-muted-foreground">Guests</label>
                      <input
                        type="number"
                        min={1}
                        value={editGuests}
                        onChange={(e) => setEditGuests(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-muted-foreground"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-muted-foreground">Bedrooms</label>
                      <input
                        type="number"
                        min={1}
                        value={editBedrooms}
                        onChange={(e) => setEditBedrooms(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-muted-foreground"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-muted-foreground">Beds</label>
                      <input
                        type="number"
                        min={1}
                        value={editBeds}
                        onChange={(e) => setEditBeds(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-muted-foreground"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-muted-foreground">Bathrooms</label>
                      <input
                        type="number"
                        min={1}
                        value={editBathrooms}
                        onChange={(e) => setEditBathrooms(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-muted-foreground"
                      />
                    </div>
                  </div>

                  {/* Amenities Chips Selector */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block font-semibold text-muted-foreground">Amenities</label>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_AMENITIES.map((am) => {
                        const active = editAmenities.includes(am);
                        return (
                          <button
                            key={am}
                            type="button"
                            onClick={() => toggleAmenityChip(am)}
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold border transition-all ${
                              active
                                ? "bg-amber-500 text-zinc-950 border-amber-500"
                                : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)] border-[var(--border)]"
                            }`}
                          >
                            {active ? "✓ " : "+ "}{am.replace(/_/g, " ")}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* House Rules Selector */}
                  <div className="sm:col-span-2 space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                    <label className="block font-semibold text-muted-foreground">House Rules</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {HOUSE_RULE_OPTIONS.map((rule) => {
                        const active = editHouseRules.includes(rule);
                        return (
                          <button
                            key={rule}
                            type="button"
                            onClick={() => toggleHouseRuleChip(rule)}
                            className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition-all ${
                              active
                                ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300 font-semibold"
                                : "border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground"
                            }`}
                          >
                            <span>{active ? "✓" : "○"}</span>
                            <span>{rule}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveDetails}
                    className="rounded-full bg-amber-500 px-6 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 shadow-md"
                  >
                    {isSaving ? "Saving Details..." : "Save Property Details"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: PROPERTY PHOTOS & GALLERY */}
            {activeTab === "photos" && (
              <div className="space-y-4 animate-in fade-in text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground">Property Photos & Media Gallery</h3>
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      Admin can upload new photo files directly or add image URLs. Minimum 5 photos required for approval.
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${editPhotos.length >= 5 ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" : "bg-amber-500/20 text-amber-600 border-amber-500/30"}`}>
                    {editPhotos.length} / 5 photos minimum
                  </span>
                </div>

                {/* File Upload Button & URL Input */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-[#1F1F1F] font-semibold px-4 py-2.5 hover:opacity-90 transition-all shrink-0">
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
                      className="flex-1 rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface-secondary)] text-muted-foreground outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPhotoUrl.trim()) return;
                        setEditPhotos([...editPhotos, newPhotoUrl.trim()]);
                        setNewPhotoUrl("");
                      }}
                      className="rounded-xl bg-amber-500 text-zinc-950 font-semibold px-4 py-2 hover:bg-amber-400 transition-all shrink-0"
                    >
                      + Add URL
                    </button>
                  </div>
                </div>

                {/* Photos Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {editPhotos.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-[var(--muted-foreground)] italic border border-dashed border-[var(--border)] rounded-2xl">
                      No photos uploaded for this property listing yet.
                    </div>
                  ) : (
                    editPhotos.map((url, idx) => (
                      <div key={idx} className="relative aspect-4/3 rounded-xl overflow-hidden border border-[var(--border)] bg-zinc-100 group">
                        <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editPhotos.filter((_, i) => i !== idx);
                              setEditPhotos(updated);
                            }}
                            className="bg-rose-600 text-white rounded-full px-3 py-1 text-xs font-semibold"
                          >
                            🗑 Remove
                          </button>
                        </div>
                        <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                          #{idx + 1} {idx === 0 ? "Cover" : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-end pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSavePhotos}
                    className="rounded-full bg-amber-500 px-6 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 shadow-md"
                  >
                    {isSaving ? "Saving Photos..." : "Save Property Gallery"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: CHECK-IN, POLICIES & AVAILABILITY */}
            {activeTab === "policies" && (
              <div className="space-y-4 animate-in fade-in text-xs">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block font-semibold text-muted-foreground">Check-in Method</label>
                    <input
                      type="text"
                      value={editCheckInMethod}
                      onChange={(e) => setEditCheckInMethod(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Check-in Window</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="time"
                        value={editCheckInStart}
                        onChange={(e) => setEditCheckInStart(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-muted-foreground"
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={editCheckInEnd}
                        onChange={(e) => setEditCheckInEnd(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Checkout Time</label>
                    <input
                      type="time"
                      value={editCheckOutTime}
                      onChange={(e) => setEditCheckOutTime(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Cancellation Policy</label>
                    <select
                      value={editCancellationPolicy}
                      onChange={(e) => setEditCancellationPolicy(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground"
                    >
                      <option value="FLEXIBLE">Flexible (Full refund 1 day prior)</option>
                      <option value="MODERATE">Moderate (Full refund 5 days prior)</option>
                      <option value="STRICT">Strict (50% refund 7 days prior)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Min Nights Stay</label>
                    <input
                      type="number"
                      min={1}
                      value={editMinNights}
                      onChange={(e) => setEditMinNights(Number(e.target.value))}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-muted-foreground"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Instant Booking</label>
                    <button
                      type="button"
                      onClick={() => setEditInstantBook(!editInstantBook)}
                      className={`mt-1 w-full rounded-2xl py-2.5 text-xs font-semibold transition-all border ${editInstantBook ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" : "bg-zinc-700 text-white"}`}
                    >
                      {editInstantBook ? "✓ Instant Book Enabled" : "Manual Host Approval Required"}
                    </button>
                  </div>
                </div>

                {/* Blocked Dates Manager */}
                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                  <h4 className="font-semibold text-muted-foreground">Calendar Blocked Dates ({editBlockedDates.length})</h4>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newBlockedDate}
                      onChange={(e) => setNewBlockedDate(e.target.value)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-muted-foreground font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newBlockedDate || editBlockedDates.includes(newBlockedDate)) return;
                        setEditBlockedDates([...editBlockedDates, newBlockedDate].sort());
                        setNewBlockedDate("");
                      }}
                      className="rounded-xl bg-amber-500 text-zinc-950 font-semibold px-4 py-2 text-xs"
                    >
                      + Block Date
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {editBlockedDates.map((dateStr) => (
                      <span key={dateStr} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 px-3 py-1 text-xs font-mono font-semibold">
                        📅 {dateStr}
                        <button
                          type="button"
                          onClick={() => setEditBlockedDates(editBlockedDates.filter((d) => d !== dateStr))}
                          className="text-rose-600 hover:text-rose-700 ml-1 font-black"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSavePolicies}
                    className="rounded-full bg-amber-500 px-6 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 shadow-md"
                  >
                    {isSaving ? "Saving Policies..." : "Save Policies & Availability"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: EDIT PRICING & FEES */}
            {activeTab === "pricing" && (
              <div className="space-y-4 animate-in fade-in text-xs">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block font-semibold text-muted-foreground">Nightly Price (SAR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground font-mono font-semibold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Weekend Price (SAR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editWeekendPrice}
                      onChange={(e) => setEditWeekendPrice(Number(e.target.value))}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Cleaning Fee (SAR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editCleaningFee}
                      onChange={(e) => setEditCleaningFee(Number(e.target.value))}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-muted-foreground">Security Deposit (SAR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editSecurityDeposit}
                      onChange={(e) => setEditSecurityDeposit(Number(e.target.value))}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSavePricing}
                    className="rounded-full bg-amber-500 px-6 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 shadow-md"
                  >
                    {isSaving ? "Saving Pricing..." : "Save Pricing & Fees"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 6: QUALITY MODERATION */}
            {activeTab === "moderation" && (
              <div className="space-y-4 animate-in fade-in text-xs">
                {/* Moderation Checklist */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-4 space-y-2">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Quality Moderation Checklist</h4>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span>Minimum 5 High-Resolution Photos:</span>
                    <span className={`font-semibold ${editPhotos.length >= 5 ? "text-emerald-600" : "text-amber-600"}`}>
                      {editPhotos.length >= 5 ? "✓ PASSED (Has 5+ photos)" : `⚠️ FAILED (${editPhotos.length} / 5 photos)`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t border-[var(--border-subtle)] pt-1">
                    <span>Valid Nightly Rate & Location:</span>
                    <span className="font-semibold text-emerald-600">✓ PASSED (SAR {editPrice}/night, {selectedListing.city})</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground">Moderation Feedback / Rejection Notes</label>
                  <textarea
                    rows={3}
                    value={modReason}
                    onChange={(e) => setModReason(e.target.value)}
                    placeholder="Enter reason or requested changes for the host..."
                    className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleModerate("REJECT")}
                    className="rounded-full bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Reject Listing
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleModerate("REQUEST_CHANGES")}
                    className="rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                  >
                    Request Changes
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleModerate("APPROVE")}
                    className="rounded-full bg-emerald-600 px-6 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-md"
                  >
                    Approve Listing
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-6 py-2 text-xs font-semibold text-muted-foreground"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Listing Confirmation Modal */}
      {showDeleteModal && listingToDelete && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[var(--surface)] p-6 shadow-2xl space-y-4 border border-[var(--border)] animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center font-semibold text-lg">
                ⚠️
              </div>
              <h3 className="text-base font-semibold text-muted-foreground">Permanently Delete Listing?</h3>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Are you sure you want to delete <strong className="text-muted-foreground">{listingToDelete.title}</strong> (ID: <span className="font-mono">{listingToDelete.id}</span>)? This action will permanently remove the listing, host listing data, and cache across the platform.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setListingToDelete(null);
                }}
                className="rounded-full px-5 py-2 text-xs font-semibold border border-[var(--border)] hover:bg-[var(--surface-secondary)] text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteListing}
                className="rounded-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-5 py-2 text-xs font-semibold transition-all shadow-sm"
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
