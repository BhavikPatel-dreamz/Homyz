"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { HostHeader } from "./host-header";
import {
  HOST_LISTINGS_GRID_CLASS,
  HostListingCardsSkeleton,
} from "./host-listings-skeleton";
import { BecomeHostModal } from "./become-host-modal";
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
import type { HostListingCardDTO, ListingDTO } from "@/services/mappers";
import { normalizeAmenities } from "@/lib/constants/amenities";
import { isSaudiArabia } from "@/lib/location/address-countries";
import { useLanguage } from "@/lib/i18n/language-context";
import { getCurrencyForCountry } from "@/lib/currency";

export const LISTING_TABS = [
  { id: "ALL", label: "All", key: "host_listings_tab_all" },
  { id: "ACTIVE", label: "Listed", key: "host_listings_tab_listed" },
  { id: "PENDING_REVIEW", label: "Pending review", key: "host_listings_tab_pending_review" },
  { id: "CHANGES_REQUESTED", label: "Changes requested", key: "host_listings_tab_changes_requested" },
  { id: "DRAFT", label: "Draft", key: "host_listings_tab_draft" },
  { id: "PAUSED", label: "Paused", key: "host_listings_tab_paused" },
  { id: "REJECTED", label: "Rejected", key: "host_listings_tab_rejected" },
] as const;

function isOptimizableImage(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("/")) return true;
  try {
    const url = new URL(src);
    const host = url.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".googleusercontent.com") ||
      host === "platform-lookaside.fbsbx.com" ||
      host === "images.unsplash.com" ||
      host.endsWith(".amazonaws.com") ||
      host.endsWith(".cloudfront.net") ||
      host === "media.homyz.co" ||
      host === "homyz.co" ||
      host.endsWith(".dynamicdreamz.net")
    );
  } catch {
    return false;
  }
}

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

type ListingPageResult = {
  items: HostListingCardDTO[];
  totalCount: number;
  totalPages: number;
  counts?: Record<string, number>;
};

function replaceListingsUrl(params: URLSearchParams) {
  const query = params.toString();
  window.history.replaceState({}, "", query ? `/host/listings?${query}` : "/host/listings");
}

function EmptyListingsState({
  onCreate,
  pending,
}: {
  onCreate: () => void;
  pending: boolean;
}) {
  const { t } = useLanguage();
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-dashed border-zinc-300 bg-[#FAFAF9] px-6 py-12 text-center sm:px-10">
      <span className="grid size-13 place-items-center rounded-2xl bg-[#FCDF9C] text-[#1F1F1F]">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M9 10h.01M15 10h.01" />
        </svg>
      </span>
      <h2 className="mt-5 text-xl font-medium text-[#1F1F1F]">{t("host_empty_listings_title")}</h2>
      <p className="mt-2 max-w-sm text-sm leading-normal text-[#727272]">
        {t("host_empty_listings_desc")}
      </p>
      <button
        type="button"
        onClick={onCreate}
        disabled={pending}
        className="mt-6 inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-transparent hover:border-[#1F1F1F] bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white font-normal text-base px-5 py-2.5 transition-all shadow-2xs cursor-pointer"
      >
        {t("host_create_first_listing")}
      </button>
    </section>
  );
}

export function HostListingsWorkspace({
  initialListings,
  initialTotalCount,
  initialTotalPages,
  initialTab = "ALL",
  initialPage = 1,
  initialCounts,
  currentUserId,
  initialSearchQuery = "",
}: {
  initialListings: HostListingCardDTO[];
  initialTotalCount?: number;
  initialTotalPages?: number;
  initialTab?: string;
  initialPage?: number;
  initialCounts?: Record<string, number>;
  currentUserId: string;
  initialShowSearch?: boolean;
  initialSearchQuery?: string;
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [page, setPage] = useState<number>(initialPage);
  const [listings, setListings] = useState<HostListingCardDTO[]>(initialListings);
  const [totalCount, setTotalCount] = useState<number>(
    initialTotalCount ?? initialListings.length,
  );
  const [totalPages, setTotalPages] = useState<number>(
    initialTotalPages ?? Math.max(1, Math.ceil((initialTotalCount ?? initialListings.length) / 12)),
  );
  const [counts, setCounts] = useState<Record<string, number> | undefined>(initialCounts);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [loading, setLoading] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [becomeHostModalOpen, setBecomeHostModalOpen] = useState(false);
  const [becomeHostModalStep, setBecomeHostModalStep] = useState<1 | 2>(1);

  const cacheRef = useRef<
    Map<string, ListingPageResult>
  >(new Map());
  const inFlightRef = useRef<
    Map<string, { controller: AbortController; promise: Promise<ListingPageResult> }>
  >(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestRequestKeyRef = useRef<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Seed cache with server-rendered initial data
  useEffect(() => {
    const initialKey = `${initialTab}:${initialPage}:${initialSearchQuery.trim().toLowerCase()}`;
    if (!cacheRef.current.has(initialKey)) {
      cacheRef.current.set(initialKey, {
        items: initialListings,
        totalCount: initialTotalCount ?? initialListings.length,
        totalPages:
          initialTotalPages ??
          Math.max(1, Math.ceil((initialTotalCount ?? initialListings.length) / 12)),
        counts: initialCounts,
      });
    }
  }, [
    initialTab,
    initialPage,
    initialSearchQuery,
    initialListings,
    initialTotalCount,
    initialTotalPages,
    initialCounts,
  ]);

  const fetchListings = useCallback(
    async (
      targetTab: string,
      targetPage: number,
      targetSearch: string,
      options?: { bypassCache?: boolean },
    ) => {
      const normalizedSearch = targetSearch.trim().toLowerCase();
      const cacheKey = `${targetTab}:${targetPage}:${normalizedSearch}`;
      latestRequestKeyRef.current = cacheKey;

      if (!options?.bypassCache && cacheRef.current.has(cacheKey)) {
        abortControllerRef.current?.abort();
        const cached = cacheRef.current.get(cacheKey)!;
        setListings(cached.items);
        setTotalCount(cached.totalCount);
        setTotalPages(cached.totalPages);
        if (cached.counts) setCounts(cached.counts);
        setRefreshError(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      let inFlight = inFlightRef.current.get(cacheKey);
      if (!inFlight) {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const queryParams = new URLSearchParams();
        queryParams.set("tab", targetTab);
        queryParams.set("page", String(targetPage));
        queryParams.set("limit", "12");
        if (targetSearch.trim()) {
          queryParams.set("q", targetSearch.trim());
        }

        const promise = (async () => {
          const endpoint = `/api/v1/host/listings?${queryParams.toString()}`;
          const response = await fetch(endpoint, {
            signal: controller.signal,
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
          const payload = await response.json().catch(() => null);
          if (
            !response.ok ||
            !payload?.success ||
            !Array.isArray(payload.data?.items)
          ) {
            throw new Error(
              payload?.error?.message || "Unable to refresh listings.",
            );
          }

          const fetchedItems = payload.data.items as HostListingCardDTO[];
          const count =
            typeof payload.data.totalCount === "number"
              ? payload.data.totalCount
              : typeof payload.data.total === "number"
              ? payload.data.total
              : fetchedItems.length;
          const pages =
            typeof payload.data.totalPages === "number"
              ? payload.data.totalPages
              : Math.max(1, Math.ceil(count / 12));
          const fetchedCounts = payload.data.counts as Record<string, number> | undefined;

          const result = {
            items: fetchedItems,
            totalCount: count,
            totalPages: pages,
            counts: fetchedCounts,
          };
          cacheRef.current.set(cacheKey, result);
          return result;
        })().finally(() => {
          inFlightRef.current.delete(cacheKey);
        });

        inFlight = { controller, promise };
        inFlightRef.current.set(cacheKey, inFlight);
      }

      try {
        const result = await inFlight.promise;
        if (latestRequestKeyRef.current === cacheKey) {
          setListings(result.items);
          setTotalCount(result.totalCount);
          setTotalPages(result.totalPages);
          if (result.counts) setCounts(result.counts);
          setRefreshError(null);
          setLoading(false);
        }
      } catch (error) {
        if (inFlight.controller.signal.aborted || latestRequestKeyRef.current !== cacheKey) return;
        setRefreshError(
          error instanceof Error ? error.message : "Unable to refresh listings.",
        );
        setLoading(false);
      }
    },
    [],
  );

  const handleTabChange = useCallback(
    (newTab: string) => {
      if (newTab === activeTab) return;
      setActiveTab(newTab);
      setPage(1);
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("tab", newTab);
      nextParams.delete("page");
      if (searchQuery.trim()) {
        nextParams.set("q", searchQuery.trim());
      }
      replaceListingsUrl(nextParams);
      void fetchListings(newTab, 1, searchQuery.trim());
    },
    [activeTab, searchQuery, fetchListings],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage === page || newPage < 1 || newPage > totalPages) return;
      setPage(newPage);
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("tab", activeTab);
      nextParams.set("page", String(newPage));
      if (searchQuery.trim()) {
        nextParams.set("q", searchQuery.trim());
      }
      replaceListingsUrl(nextParams);
      void fetchListings(activeTab, newPage, searchQuery.trim());
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [page, totalPages, activeTab, searchQuery, fetchListings],
  );

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      const params = new URLSearchParams(window.location.search);
      if (val.trim()) {
        params.set("q", val.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");
      replaceListingsUrl(params);
      void fetchListings(activeTab, 1, val.trim());
    }, 300);
  };

  const handleCancelSearch = () => {
    setSearchQuery("");
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.trim()) {
      setPage(1);
      const params = new URLSearchParams(window.location.search);
      params.delete("q");
      params.delete("page");
      replaceListingsUrl(params);
      void fetchListings(activeTab, 1, "");
    }
  };

  const refreshListings = useCallback(async () => {
    cacheRef.current.clear();
    void fetchListings(activeTab, page, searchQuery.trim(), { bypassCache: true });
  }, [fetchListings, activeTab, page, searchQuery]);

  // Request cancellation belongs to the component lifecycle, not the listener
  // lifecycle below. That listener needs to be refreshed as the active tab,
  // page, or search changes; cancelling there would abort the request that a
  // page or tab change has just started.
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "homyz:listings-updated") {
        void refreshListings();
      }
    };
    const onListingsUpdated = () => {
      void refreshListings();
    };
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlTab = (params.get("tab") || "ALL").toUpperCase();
      const urlPage = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
      const urlSearch = params.get("q") || "";
      setActiveTab(urlTab);
      setPage(urlPage);
      setSearchQuery(urlSearch);
      void fetchListings(urlTab, urlPage, urlSearch);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("homyz:listings-updated", onListingsUpdated);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("homyz:listings-updated", onListingsUpdated);
      window.removeEventListener("popstate", onPopState);
    };
  }, [refreshListings, fetchListings]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "open") {
        window.history.replaceState({}, "", "/host/listings");
        setTimeout(() => {
          setBecomeHostModalStep(2);
          setBecomeHostModalOpen(true);
        }, 0);
      }
    }
  }, []);

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
  const [listingToDelete, setListingToDelete] = useState<HostListingCardDTO | null>(null);

  const [pending, startTransition] = useTransition();

  // Form states for editor
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: 15000, // SAR 150.00
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
    setBecomeHostModalStep(1);
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
        cacheRef.current.clear();
        void fetchListings(activeTab, page, searchQuery.trim(), { bypassCache: true });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:listings-updated"));
          localStorage.setItem("homyz:listings-updated", String(Date.now()));
        }
      } catch (err: unknown) {
        showToast(errorMessage(err, "Failed to save listing."), "error");
      }
    });
  }

  // Submit / Resubmit Listing
  async function handleSubmitListing(item: ListingDTO) {
    startTransition(async () => {
      try {
        const actionFn = ["CHANGES_REQUESTED", "REJECTED"].includes(item.status)
          ? resubmitListingForReviewAction
          : submitListingForReviewAction;
        const res = await actionFn(item.id);
        if (!res.ok) {
          showToast(res.error || "Failed to submit listing.", "error");
          return;
        }
        showToast("Listing submitted for Admin Review!", "success");
        cacheRef.current.clear();
        void fetchListings(activeTab, page, searchQuery.trim(), { bypassCache: true });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:listings-updated"));
          localStorage.setItem("homyz:listings-updated", String(Date.now()));
        }
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
        cacheRef.current.clear();
        void fetchListings(activeTab, page, searchQuery.trim(), { bypassCache: true });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:listings-updated"));
          localStorage.setItem("homyz:listings-updated", String(Date.now()));
        }
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
        cacheRef.current.clear();
        void fetchListings(activeTab, 1, searchQuery.trim(), { bypassCache: true });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:listings-updated"));
          localStorage.setItem("homyz:listings-updated", String(Date.now()));
        }
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
        const targetPage = listings.length === 1 && page > 1 ? page - 1 : page;
        setPage(targetPage);
        cacheRef.current.clear();
        void fetchListings(activeTab, targetPage, searchQuery.trim(), { bypassCache: true });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:listings-updated"));
          localStorage.setItem("homyz:listings-updated", String(Date.now()));
        }
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
        cacheRef.current.clear();
        void fetchListings(activeTab, page, searchQuery.trim(), { bypassCache: true });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:listings-updated"));
          localStorage.setItem("homyz:listings-updated", String(Date.now()));
        }
      } catch (err: unknown) {
        showToast(errorMessage(err, "Failed to update availability."), "error");
      }
    });
  }

  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FCDF9C]">
      {/* ── 1. TOP HEADER (Matches Figma Screenshot Header) ── */}
      <HostHeader />

      {/* ── 2. MAIN CONTENT AREA ── */}
      <main className="listing-main min-w-0 flex-1 pt-7.5 pb-[calc(128px+env(safe-area-inset-bottom))] sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-16">
        <div className="mx-auto box-border w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8">
          {/* Toast Alert */}
          {toastMsg && (
            <div className={`fixed top-5 right-4 left-4 sm:left-auto sm:max-w-md z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-medium transition-all ${toastMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
              }`}>
              {toastMsg.text}
            </div>
          )}

          {/* Refresh Error Alert */}
          {refreshError && (
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
              <span>{refreshError}</span>
              <button
                type="button"
                onClick={() => fetchListings(activeTab, page, searchQuery.trim(), { bypassCache: true })}
                className="ml-4 rounded-full bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700 cursor-pointer"
              >
                {t("host_listings_btn_retry")}
              </button>
            </div>
          )}

          {/* Listings Title & Actions Bar (Fully Responsive without changing flow) */}
          <div className="listing-title mb-6 flex min-w-0 flex-col gap-4 sm:mb-8 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between">
            <h1 className="min-w-0 text-2xl sm:text-[28px] font-medium text-[#1F1F1F]">
              {t("host_listings_title")}
            </h1>

            <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 min-[900px]:w-auto min-[900px]:justify-end">
              {/* Search Bar */}
              <div className="relative min-w-0 flex-1 sm:max-w-[288px] min-[900px]:w-[288px] min-[900px]:flex-none">
                <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#717171"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="10.5" cy="10.5" r="7" />
                    <path d="m16 16 5 5" />
                  </svg>
                </div>
                <input
                  type="text"
                  role="searchbox"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t("host_search_listings_aria") ? `${t("host_search_listings_aria")}...` : "Search listings..."}
                  aria-label={t("host_search_listings_aria")}
                  className="h-10 w-full rounded-full border border-zinc-300 bg-[#f9fafb] pl-10 pr-9 font-['Poppins'] text-sm text-[#1F1F1F] outline-none transition-colors focus:border-[#1F1F1F] focus:bg-white [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleCancelSearch}
                    className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Create New Listing Button */}
              <button
                type="button"
                onClick={handleOpenCreate}
                disabled={pending}
                aria-label={t("host_create_new_listing", "Add listing")}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F4F5] hover:bg-[#FCDF9C] text-[#1F1F1F] hover:text-white font-normal text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Image src="/images/icons/Plus.svg" alt="" width={24} height={24} />
              </button>
            </div>
          </div>

          {/* Status Tabs Pill Switcher matching /host/today style */}
          <div className="mb-6 min-w-0 border-b border-[#727272]/20 pb-4 sm:mb-8 sm:pb-5">
            <div
              className="flex min-w-0 flex-wrap items-center gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:pb-1 no-scrollbar"
              role="tablist"
              aria-label={t("host_listings_tablist_aria", "Listing status")}
            >
              {LISTING_TABS.map((tabItem) => {
                const isSelected = activeTab === tabItem.id;
                const count = counts?.[tabItem.id];
                return (
                  <button
                    key={tabItem.id}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleTabChange(tabItem.id)}
                    className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-xs font-medium font-sans transition-colors duration-200 cursor-pointer sm:px-3.5 ${
                      isSelected
                        ? "bg-[#1F1F1F] text-white shadow-xs"
                        : "bg-[#F3F4F6] text-[#717171] hover:bg-zinc-200 hover:text-[#1F1F1F]"
                    }`}
                  >
                    <span>{t(tabItem.key, tabItem.label)}</span>
                    {count !== undefined && (
                      <span className={`ml-1.5 text-[11px] ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div aria-busy={loading}>
            {loading ? (
              <HostListingCardsSkeleton cardCount={12} />
            ) : (
              <>
              {/* Property Cards Grid */}
              <div className="block">
                {listings.length === 0 && searchQuery ? (
                  <div className="py-10 text-center text-[#727272]">
                    <p>{t("host_no_listings_matching_search")}</p>
                    <button
                      type="button"
                      onClick={() => handleSearchChange("")}
                      className="mt-3 text-sm text-[#1F1F1F] underline cursor-pointer"
                    >
                      {t("host_listings_clear_search")}
                    </button>
                  </div>
                ) : listings.length === 0 ? (
                  <EmptyListingsState onCreate={handleOpenCreate} pending={pending} />
                ) : (
                  <div className={HOST_LISTINGS_GRID_CLASS}>
                    {listings.map((item) => {
                      const photos = Array.isArray(item.photos) ? item.photos : [];
                      const coverPhoto = photos[0] || null;
                      const isListed = !item.isPaused && (item.status === "ACTIVE" || item.published);
                      const isCoHosted = item.hostId !== currentUserId;
                      const adminFeedback = item.rejectionReason
                        || (typeof item.requestedChanges === "string" ? item.requestedChanges : null);

                      return (
                        <div
                          key={item.id}
                          className="group relative w-full min-w-0 text-left"
                        >
                          {/* Photo Container */}
                          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] border border-zinc-200 bg-[#f1f1f1]">
                            {coverPhoto ? (
                              <Image
                                src={coverPhoto}
                                alt={item.title || t("host_no_photo_yet")}
                                fill
                                sizes="(max-width: 639px) calc(100vw - 32px), 298px"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                unoptimized={!isOptimizableImage(coverPhoto)}
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center bg-[#F1F1F1] text-sm text-[#717171]">{t("host_no_photo_yet")}</div>
                            )}

                            {/* White Pill Badge matching screenshot */}
                            <div className="absolute left-3 top-3 flex max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-[11px] leading-4 text-[#252525]">
                              <span className={`size-1.5 shrink-0 rounded-full ${isListed ? "bg-[#37BE01]" : "bg-[#E1473D]"}`}></span>
                              {isCoHosted ? t("host_badge_cohost") : isListed ? t("host_badge_listed") : t("host_badge_action_required")}
                            </div>

                            {/* Delete Action Icon Button */}
                            {!isCoHosted && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setListingToDelete(item);
                                  setShowDeleteModal(true);
                                }}
                                aria-label={t("host_delete_property_aria")}
                                title={t("host_delete_property_aria")}
                                className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-full bg-white text-xs text-rose-600 shadow-2xs backdrop-blur-xs transition-colors duration-200 ease-out hover:bg-rose-600 hover:text-white max-sm:hidden cursor-pointer"
                              >
                                <svg
                                  aria-hidden="true"
                                  className="size-4 transition-colors duration-200 ease-out"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={1.8}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-1.327L4.772 5.79m14.456 0A48.108 48.108 0 0 0 15.75 5.25M4.772 5.79A48.11 48.11 0 0 1 8.25 5.25m0 0V4.5c0-1.02.78-1.86 1.794-1.921a51.966 51.966 0 0 1 3.912 0A1.98 1.98 0 0 1 15.75 4.5v.75m-7.5 0h7.5" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* Below Card Information */}
                          <div className="min-w-0 px-0 pt-3">
                            <h3 className="line-clamp-2 app-title-card text-[#1f1f1f]">
                              <Link
                                href={`/host/listings/${item.id}`}
                                className="after:absolute after:inset-0 after:rounded-[14px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4"
                              >
                                {item.title === "Draft Listing" ? t("host_untitled_draft") : item.title || t("host_untitled_listing")}
                              </Link>
                            </h3>
                            <p className="mt-1 line-clamp-1 text-xs leading-4 text-[#727272]">
                              {item.city || item.country ? `${item.city || ""}${item.city && item.country ? ", " : ""}${item.country || ""}` : t("host_no_location_yet")}
                            </p>
                            {item.status === "PENDING_REVIEW" && (
                              <p className="mt-1 text-xs font-medium text-[#349010]">
                                {isSaudiArabia(item.country) ? t("host_ready_to_publish") : t("host_submitted_for_admin_approval")}
                              </p>
                            )}
                            {(item.status === "CHANGES_REQUESTED" || item.status === "REJECTED") && adminFeedback && (
                              <p className="mt-1 line-clamp-2 text-xs font-medium text-rose-700" title={adminFeedback}>
                                {t("host_admin_feedback", { feedback: adminFeedback })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <nav
                  aria-label={t("host_listings_pagination_aria", "Listings pagination")}
                  className="mt-10 flex items-center justify-between border-t border-zinc-200 pt-6"
                >
                  <button
                    type="button"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1 || loading}
                    className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-5 text-sm font-medium text-[#1F1F1F] shadow-2xs transition-all duration-200 hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white disabled:hover:border-zinc-300 disabled:hover:bg-white disabled:hover:text-[#1F1F1F] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-white dark:hover:bg-white dark:hover:text-[#1F1F1F]"
                  >
                    <svg
                      className="size-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    <span>Previous</span>
                  </button>
                  <span className="text-sm font-medium text-[#1f1f1f]">
                    {t("host_listings_page_info", { page, totalPages: Math.max(1, totalPages) }, `Page ${page} of ${Math.max(1, totalPages)}`)}
                    {totalCount > 0 && (
                      <span className="ml-1.5 text-xs text-[#727272]">
                        ({totalCount} {totalCount === 1 ? t("host_listings_count_single", "listing") : t("host_listings_count_multiple", "listings")})
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-5 text-sm font-medium text-[#1F1F1F] shadow-2xs transition-all duration-200 hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white disabled:hover:border-zinc-300 disabled:hover:bg-white disabled:hover:text-[#1F1F1F] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-white dark:hover:bg-white dark:hover:text-[#1F1F1F]"
                  >
                    <span>Next</span>
                    <svg
                      className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </nav>
              )}
              </>
            )}
          </div>
        </div>
      </main>

      <BecomeHostModal
        isOpen={becomeHostModalOpen}
        initialStep={becomeHostModalStep}
        onClose={() => setBecomeHostModalOpen(false)}
      />

      {/* Editor Modal (Create & Edit Multi-Tab Wizard) */}
      {showEditorModal && (
        <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[92vh] rounded-3xl bg-[var(--surface)] p-6 sm:p-8 shadow-2xl space-y-6 overflow-y-auto border border-[var(--border)] font-sans">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h2 className="text-lg font-medium text-muted-foreground">
                  {editingListing ? t("host_listings_modal_edit_title", { title: editingListing.title }) : t("host_listings_modal_create_title", "Create Property Listing")}
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {t("host_listings_modal_header_desc", "Configure property details, photos, amenities, pricing, house rules, check-in, and policies.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditorModal(false)}
                className="h-8 w-8 rounded-full bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-muted-foreground flex items-center justify-center font-medium text-sm"
              >
                ✕
              </button>
            </div>

            {/* Wizard Steps Navigation Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-[var(--border-subtle)] text-xs font-medium scrollbar-none">
              {[
                { step: 1, label: t("host_listings_modal_step_1", "1. Basic Info") },
                { step: 2, label: t("host_listings_modal_step_2", "2. Location & Capacity") },
                { step: 3, label: t("host_listings_modal_step_3", "3. Photos & Details") },
                { step: 4, label: t("host_listings_modal_amenities", "4. Amenities & Rules") },
                { step: 5, label: t("host_listings_modal_step_4", "5. Pricing & Policies") },
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
                    <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_title", "Listing Title *")}</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      placeholder={t("host_listings_modal_title_ph", "e.g. Modern Luxury Beachfront Villa with Ocean Views")}
                      className="w-full rounded-xl border border-[var(--border)] p-3 bg-[var(--surface)] text-muted-foreground outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_desc", "Detailed Description *")}</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      rows={4}
                      placeholder={t("host_listings_modal_desc_ph", "Describe what makes your property unique, nearby attractions, neighborhood ambiance, and special features...")}
                      className="w-full rounded-xl border border-[var(--border)] p-3 bg-[var(--surface)] text-muted-foreground outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_category", "Hosting Category")}</label>
                      <select
                        value={formData.hostingType}
                        onChange={(e) => setFormData({ ...formData, hostingType: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none font-medium"
                      >
                        <option value="HOME">{t("host_listings_modal_cat_home", "Residential Home")}</option>
                        <option value="EXPERIENCE">{t("host_listings_modal_cat_exp", "Experience")}</option>
                        <option value="SERVICE">{t("host_listings_modal_cat_service", "Service")}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_prop_type", "Property Type")}</label>
                      <select
                        value={formData.propertyType}
                        onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none font-medium"
                      >
                        {PROPERTY_TYPES.map((pt) => (
                          <option key={pt} value={pt}>{pt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_listing_type", "Listing Type")}</label>
                      <select
                        value={formData.listingType}
                        onChange={(e) => setFormData({ ...formData, listingType: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none font-medium"
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
                      <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_street", "Street Address *")}</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        required
                        placeholder={t("host_listings_modal_street_ph", "e.g. 742 Evergreen Terrace")}
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_city", "City / Region *")}</label>
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
                      <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_district", "District / State")}</label>
                      <input
                        type="text"
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        placeholder="e.g. Florida"
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_zip", "Postal Code")}</label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="e.g. 33101"
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-muted-foreground mb-1">{t("host_listings_modal_country", "Country")}</label>
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
                    <h4 className="font-medium text-muted-foreground mb-3">{t("host_listings_modal_capacity", "Property Capacity")}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">{t("host_listings_modal_guests_cap", "Guests Capacity")}</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={formData.guests}
                          onChange={(e) => setFormData({ ...formData, guests: Number(e.target.value) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-medium text-center outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">{t("host_listings_modal_bedrooms", "Bedrooms")}</label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={formData.bedrooms}
                          onChange={(e) => setFormData({ ...formData, bedrooms: Number(e.target.value) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-medium text-center outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">{t("host_listings_modal_beds", "Beds")}</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={formData.beds}
                          onChange={(e) => setFormData({ ...formData, beds: Number(e.target.value) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-medium text-center outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">{t("host_listings_modal_bathrooms", "Bathrooms")}</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={formData.bathrooms}
                          onChange={(e) => setFormData({ ...formData, bathrooms: Number(e.target.value) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-medium text-center outline-none"
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
                      <h4 className="font-medium text-muted-foreground">{t("host_listings_modal_photos", "Property Photos Gallery")}</h4>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Add high quality image URLs. Minimum 5 photos required for Admin review & approval.
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${formData.photos.length >= 5 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-300"
                      }`}>
                      {formData.photos.length} / 5 photos minimum
                    </span>
                  </div>

                  {/* Add photo File Upload & URL input */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-[#1F1F1F] font-medium px-4 py-2.5 hover:opacity-90 transition-all shrink-0">
                        <span>{t("host_listings_modal_upload_btn", "📁 Choose & Upload File")}</span>
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
                          className="rounded-xl bg-emerald-600 text-white font-medium px-4 py-2 hover:bg-emerald-700 transition-all shrink-0"
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
                        <Image src={url} alt={`Photo ${idx + 1}`} fill sizes="200px" className="w-full h-full object-cover" unoptimized={!isOptimizableImage(url)} />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formData.photos.filter((_, i) => i !== idx);
                              setFormData({ ...formData, photos: updated });
                            }}
                            className="bg-rose-600 text-white rounded-full p-1.5 text-xs font-medium"
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
                    <h4 className="font-medium text-muted-foreground mb-1">{t("host_listings_modal_amenities", "Property Amenities")}</h4>
                    <p className="text-[11px] text-[var(--muted-foreground)] mb-3">{t("host_listings_modal_amenities_sub", "Select all amenities available to guests:")}</p>
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
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium"
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
                    <h4 className="font-medium text-muted-foreground">{t("host_listings_modal_rules", "House Rules")}</h4>
                    <p className="text-[11px] text-[var(--muted-foreground)]">{t("host_listings_modal_rules_sub", "Select house rules for guests staying at your place:")}</p>
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
                    <h4 className="font-medium text-muted-foreground mb-3">{t("host_listings_modal_pricing", "Pricing")}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Nightly Rate ({getCurrencyForCountry(formData.country)}) *</label>
                        <input
                          type="number"
                          min={1}
                          value={formData.price / 100}
                          onChange={(e) => setFormData({ ...formData, price: Math.round(Number(e.target.value) * 100) })}
                          required
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-medium text-base outline-none text-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">Weekend Rate ({getCurrencyForCountry(formData.country)})</label>
                        <input
                          type="number"
                          min={0}
                          value={(formData.weekendPrice || 0) / 100}
                          onChange={(e) => setFormData({ ...formData, weekendPrice: Math.round(Number(e.target.value) * 100) })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-medium outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border-subtle)] pt-4 space-y-4">
                    <h4 className="font-medium text-muted-foreground">{t("host_listings_modal_checkin_details", "Check-in Details & Policies")}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">{t("host_listings_modal_checkin_method", "Check-in Method")}</label>
                        <select
                          value={formData.checkInMethod}
                          onChange={(e) => setFormData({ ...formData, checkInMethod: e.target.value })}
                          className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-medium outline-none"
                        >
                          {CHECK_IN_METHODS.map((m) => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">{t("host_listings_modal_checkin_window", "Check-in Window")}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={formData.checkInStart}
                            onChange={(e) => setFormData({ ...formData, checkInStart: e.target.value })}
                            className="w-full rounded-xl border border-[var(--border)] p-2 bg-[var(--surface)] text-muted-foreground font-medium text-center outline-none"
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={formData.checkInEnd}
                            onChange={(e) => setFormData({ ...formData, checkInEnd: e.target.value })}
                            className="w-full rounded-xl border border-[var(--border)] p-2 bg-[var(--surface)] text-muted-foreground font-medium text-center outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[var(--muted-foreground)] font-medium mb-1">{t("host_listings_modal_checkout_time", "Checkout Time")}</label>
                        <input
                          type="time"
                          value={formData.checkOutTime}
                          onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                          className="w-full rounded-xl border border-[var(--border)] p-2 bg-[var(--surface)] text-muted-foreground font-medium text-center outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[var(--muted-foreground)] font-medium mb-1">{t("host_listings_modal_cancel_policy", "Cancellation Policy")}</label>
                      <select
                        value={formData.cancellationPolicy}
                        onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground font-medium outline-none"
                      >
                        {CANCELLATION_POLICIES.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.instantBook}
                          onChange={(e) => setFormData({ ...formData, instantBook: e.target.checked })}
                          className="rounded text-emerald-600 h-4 w-4"
                        />
                        <span>{t("host_listings_modal_instant_book", "Enable Instant Booking")}</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-[#727272] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isPaused}
                          onChange={(e) => setFormData({ ...formData, isPaused: e.target.checked })}
                          className="rounded text-zinc-600 h-4 w-4"
                        />
                        <span>{t("host_listings_modal_pause", "Pause / Snooze Listing")}</span>
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
                  className="rounded-full px-4 py-2 border border-[var(--border)] text-xs font-medium text-muted-foreground hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] transition-all cursor-pointer disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  ← {t("host_back", "Back")}
                </button>

                <div className="flex items-center gap-2">
                  {editorStep < 5 ? (
                    <button
                      type="button"
                      onClick={() => setEditorStep((prev) => Math.min(5, prev + 1))}
                      className="rounded-full bg-[var(--foreground)] text-[var(--background)] px-5 py-2 text-xs font-medium hover:opacity-90 transition-all"
                    >
                      {t("host_next", "Next")} →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-full bg-emerald-600 text-white px-6 py-2 text-xs font-medium hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50"
                    >
                      {editingListing ? t("host_save_changes", "Save Changes") : t("host_listings_create_draft_btn", "Create Listing Draft")}
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
        <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-[var(--surface)] p-6 shadow-2xl space-y-4 border border-[var(--border)] font-sans">
            <h3 className="text-base font-medium text-muted-foreground">
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
                  className="flex-1 rounded-xl border border-[var(--border)] p-2.5 bg-[var(--surface)] text-muted-foreground outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!blockedDateInput || tempBlockedDates.includes(blockedDateInput)) return;
                    setTempBlockedDates([...tempBlockedDates, blockedDateInput].sort());
                    setBlockedDateInput("");
                  }}
                  className="rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-[#1F1F1F] font-medium px-4 py-2"
                >
                  {t("host_listings_block_date")}
                </button>
              </div>

              <div className="space-y-2">
                <span className="font-medium text-muted-foreground block">Blocked Dates List ({tempBlockedDates.length})</span>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {tempBlockedDates.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)] italic">{t("host_listings_modal_no_dates_blocked", "No dates blocked.")}</p>
                  ) : (
                    tempBlockedDates.map((dateStr) => (
                      <div key={dateStr} className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] font-mono font-medium">
                        <span>📅 {dateStr}</span>
                        <button
                          type="button"
                          onClick={() => setTempBlockedDates(tempBlockedDates.filter((d) => d !== dateStr))}
                          className="text-rose-600 font-medium text-xs"
                        >
                          {t("host_listings_unblock")}
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
                  className="rounded-full px-4 py-2 text-xs font-medium border border-[var(--border)] text-muted-foreground"
                >
                  {t("host_cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-emerald-600 text-white px-5 py-2 text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t("host_save_availability", "Save Availability")}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && listingToDelete && (
        <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-[500px] rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200/80 dark:border-zinc-800 font-sans overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="relative flex items-center justify-center px-6 py-4 sm:py-5 border-b border-[#EBEBEB] dark:border-zinc-800">
              <h3 className="text-xl font-medium text-[#1f1f1f] dark:text-zinc-100 text-center">
                {t("host_listings_modal_delete_confirm", "Delete Property Listing?")}
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <Image
                  src="/images/icons/close-icon.svg"
                  alt="Close"
                  width={12}
                  height={12}
                  className="size-3 object-contain dark:invert"
                />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 sm:py-8 border-b border-[#EBEBEB] dark:border-zinc-800">
              <p className="text-sm text-[#1f1f1f] dark:text-zinc-300 font-normal leading-relaxed">
                {t("host_listings_delete_confirm_desc", { title: listingToDelete.title })}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-sm font-medium text-[#1f1f1f] dark:text-zinc-200 hover:underline underline-offset-4 transition-colors cursor-pointer rounded-full"
              >
                {t("host_cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteListing}
                disabled={pending}
                className="bg-[#1f1f1f] hover:bg-[#FCDF9C] hover:text-[#1f1f1f] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white text-white text-sm font-medium px-6 py-3 rounded-full transition-colors cursor-pointer disabled:opacity-50"
              >
                {t("host_listings_delete_permanent_btn", "Delete it")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
