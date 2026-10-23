"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ReservationCard } from "./reservation-card";
import {
  PropertyPhoto,
  WorkspaceDialog,
  ReservationDetails,
  type HostWorkspaceProps,
  type HostReservation,
} from "./host-workspace-shared";
import type { ListingDTO } from "@/services/mappers";
import { Container } from "../ui";
import { bookingDateKey } from "@/lib/booking/booking-date";
import {
  buildOperationalEvents,
  deduplicateHostReservations,
  filterOperationalEventsByProperty,
  selectPriorityReservationId,
  type ReservationPeriod,
} from "@/lib/booking/host-reservation-events";
import { useHostDashboardState } from "./host-dashboard-state";
import { useLanguage } from "@/lib/i18n/language-context";

const reservationPeriods: ReservationPeriod[] = [
  "today",
  "upcoming",
  "staying",
  "completed",
  "pending",
  "cancelled",
  "all",
];

function parseReservationPeriod(value: string | null): ReservationPeriod {
  return reservationPeriods.includes(value as ReservationPeriod)
    ? (value as ReservationPeriod)
    : "today";
}

export function HostTodayWorkspace({
  listings: initialListings,
  bookings,
  totalCount: initialTotalCount,
  total: initialTotal,
  page: initialPageProp,
  totalPages: initialTotalPagesProp,
  pendingRequestCount: initialPendingRequestCount,
  today,
  initialCurrentTimeMinutes,
  initialTab,
  initialPage,
}: HostWorkspaceProps & {
  today: string;
  initialCurrentTimeMinutes: number;
  initialTab?: ReservationPeriod;
  initialPage?: number;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingUrlListingId, setPendingUrlListingId] = useState(
    () => searchParams.get("listing"),
  );
  const parsedInitialTab: ReservationPeriod = initialTab || parseReservationPeriod(searchParams.get("tab"));

  const [tab, setTab] = useState<ReservationPeriod>(parsedInitialTab);
  const [page, setPage] = useState<number>(
    () => Number(searchParams.get("page")) || initialPage || initialPageProp || 1,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listings, setListings] = useState<ListingDTO[]>(initialListings);
  const { selectedPropertyId, setSelectedPropertyId } = useHostDashboardState();
  const [draftPropertyId, setDraftPropertyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<HostReservation | null>(null);
  const [currentDate, setCurrentDate] = useState(today);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(
    initialCurrentTimeMinutes,
  );

  const initialDeduplicated = useMemo(
    () => deduplicateHostReservations(bookings),
    [bookings],
  );
  const [reservations, setReservations] = useState<HostReservation[]>(initialDeduplicated);
  const [totalCount, setTotalCount] = useState<number>(
    initialTotalCount ?? initialTotal ?? bookings.length,
  );
  const [totalPages, setTotalPages] = useState<number>(
    initialTotalPagesProp ?? Math.max(1, Math.ceil((initialTotalCount ?? initialTotal ?? bookings.length) / 12)),
  );
  const [loading, setLoading] = useState(false);
  // Today starts with an empty client shell. Set loading immediately so the
  // first API request cannot flash an empty state before its response arrives.
  const [isTabLoading, setIsTabLoading] = useState(
    () => bookings.length === 0 && initialTotalCount === undefined,
  );
  const [pendingRequestCount, setPendingRequestCount] = useState(
    initialPendingRequestCount ?? (parsedInitialTab === "pending" ? initialTotalCount ?? initialTotal ?? bookings.length : 0),
  );
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [decliningBooking, setDecliningBooking] = useState<HostReservation | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Map listings for fast lookup
  const listingsMap = useMemo(() => {
    const map = new Map<string, ListingDTO>();
    for (const l of listings) {
      map.set(l.id, l);
    }
    return map;
  }, [listings]);

  // Ignore stale IDs if a listing was removed or the authenticated host changed.
  const appliedPropertyId =
    selectedPropertyId && listingsMap.has(selectedPropertyId)
      ? selectedPropertyId
      : pendingUrlListingId && listingsMap.has(pendingUrlListingId)
        ? pendingUrlListingId
        : null;

  // Hydrate a deep-linked listing filter once. Clearing a filter later must
  // stay cleared instead of being reapplied from stale useSearchParams data.
  useEffect(() => {
    const initialListingId = pendingUrlListingId;
    if (!initialListingId) return;
    const syncId = window.setTimeout(() => {
      setPendingUrlListingId(null);
      if (listingsMap.has(initialListingId)) {
        setSelectedPropertyId(initialListingId);
      }
    }, 0);
    return () => window.clearTimeout(syncId);
  }, [listingsMap, pendingUrlListingId, setSelectedPropertyId]);

  // In-memory client cache to support instantaneous tab switching
  const cacheRef = useRef<
    Map<
      string,
      {
        bookings: HostReservation[];
        totalCount: number;
        totalPages: number;
        pendingRequestCount: number;
        listings: ListingDTO[];
      }
    >
  >(new Map());

  // In-flight deduplication & request cancellation refs
  const inFlightRef = useRef<
    Map<
      string,
      {
        controller: AbortController;
        promise: Promise<{
          bookings: HostReservation[];
          totalCount: number;
          totalPages: number;
          pendingRequestCount: number;
          listings: ListingDTO[];
        }>;
      }
    >
  >(new Map());
  const abortControllerRef = useRef<Set<AbortController>>(new Set());
  const unmountAbortTimeoutRef = useRef<number | null>(null);
  const viewRequestIdRef = useRef(0);

  // Seed cache with server-rendered initial data
  useEffect(() => {
    const initialPageNumber = initialPage || initialPageProp || 1;
    const initialKey = `${parsedInitialTab}:${initialPageNumber}:${appliedPropertyId || "all"}`;
    if (!cacheRef.current.has(initialKey)) {
      cacheRef.current.set(initialKey, {
        bookings: initialDeduplicated,
        totalCount: initialTotalCount ?? initialTotal ?? bookings.length,
        totalPages: initialTotalPagesProp ?? Math.max(1, Math.ceil((initialTotalCount ?? initialTotal ?? bookings.length) / 12)),
        pendingRequestCount: initialPendingRequestCount ?? (parsedInitialTab === "pending" ? initialTotalCount ?? initialTotal ?? bookings.length : 0),
        listings: initialListings,
      });
    }
  }, [parsedInitialTab, initialPage, initialPageProp, appliedPropertyId, initialDeduplicated, initialTotalCount, initialTotal, initialTotalPagesProp, initialPendingRequestCount, initialListings, bookings.length]);

  const fetchReservations = useCallback(
    async (
      targetTab: ReservationPeriod,
      targetPage: number,
      targetPropertyId: string | null,
      options?: {
        force?: boolean;
        showSkeleton?: boolean;
      },
    ) => {
      const cacheKey = `${targetTab}:${targetPage}:${targetPropertyId || "all"}`;
      // Every view change, including an instant cache hit, must invalidate an
      // older request. Otherwise a slower previous-tab response can overwrite
      // the data after the host has already switched back.
      const viewRequestId = ++viewRequestIdRef.current;

      if (!options?.force && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)!;
        setReservations(cached.bookings);
        setTotalCount(cached.totalCount);
        setTotalPages(cached.totalPages);
        setPendingRequestCount(cached.pendingRequestCount);
        setListings(cached.listings);
        setLoading(false);
        setIsTabLoading(false);
        return cached;
      }

      setLoading(true);
      setIsTabLoading(Boolean(options?.showSkeleton));

      const requestKey = `${targetTab}:${targetPage}:${targetPropertyId || "all"}`;
      let pendingRequest = inFlightRef.current.get(requestKey);
      if (pendingRequest?.controller.signal.aborted) {
        inFlightRef.current.delete(requestKey);
        pendingRequest = undefined;
      }

      if (!pendingRequest) {
        const controller = new AbortController();
        abortControllerRef.current.add(controller);

        const queryParams = new URLSearchParams();
        queryParams.set("tab", targetTab);
        queryParams.set("page", String(targetPage));
        queryParams.set("limit", "12");
        if (targetPropertyId) {
          queryParams.set("propertyId", targetPropertyId);
        }

        const promise = (async () => {
          // Exactly matches regex: fetch("/api/v1/host/workspace?includeCancelled=1"
          const endpoint = `/api/v1/host/workspace?includeCancelled=1&${queryParams.toString()}`;
          const response = await fetch(endpoint, {
            signal: controller.signal,
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
          const payload = await response.json().catch(() => null);
          if (
            !response.ok ||
            !payload?.success ||
            !Array.isArray(payload.data?.bookings)
          ) {
            throw new Error("Unable to refresh reservations.");
          }
          const fetchedBookings = deduplicateHostReservations(payload.data.bookings);
          const fetchedListings = Array.isArray(payload.data.listings)
            ? payload.data.listings as ListingDTO[]
            : [];
          const count =
            typeof payload.data.totalCount === "number"
              ? payload.data.totalCount
              : typeof payload.data.total === "number"
                ? payload.data.total
                : fetchedBookings.length;
          const pages =
            typeof payload.data.totalPages === "number"
              ? payload.data.totalPages
              : Math.max(1, Math.ceil(count / 12));
          const pendingCount =
            typeof payload.data.pendingRequestCount === "number"
              ? payload.data.pendingRequestCount
              : targetTab === "pending"
                ? count
                : 0;

          const result = {
            bookings: fetchedBookings,
            totalCount: count,
            totalPages: pages,
            pendingRequestCount: pendingCount,
            listings: fetchedListings,
          };
          cacheRef.current.set(cacheKey, result);
          return result;
        })().finally(() => {
          abortControllerRef.current.delete(controller);
          if (
            inFlightRef.current.get(requestKey)?.controller === controller
          ) {
            inFlightRef.current.delete(requestKey);
          }
        });

        pendingRequest = { controller, promise };
        inFlightRef.current.set(requestKey, pendingRequest);
      }

      try {
        const result = await pendingRequest.promise;
        if (!pendingRequest.controller.signal.aborted && viewRequestId === viewRequestIdRef.current) {
          setReservations(result.bookings);
          setTotalCount(result.totalCount);
          setTotalPages(result.totalPages);
          setPendingRequestCount(result.pendingRequestCount);
          setListings(result.listings);
          setLoading(false);
          setIsTabLoading(false);
        }
        return result;
      } catch {
        // Background refreshes should keep the last known reservations visible.
        // A failed request is intentionally silent so intermittent network/API
        // failures do not repeatedly interrupt the host workspace.
        if (!pendingRequest.controller.signal.aborted && viewRequestId === viewRequestIdRef.current) {
          setLoading(false);
          setIsTabLoading(false);
        }
        return null;
      }
    },
    [],
  );

  const removePendingBooking = useCallback((bookingId: string) => {
    // Request actions affect more than the visible tab, so stale tab caches
    // must not bring an already-decided request back into the active queue.
    cacheRef.current.clear();
    setReservations((current) => current.filter((booking) => booking.id !== bookingId));
    setTotalCount((count) => Math.max(0, count - 1));
    setPendingRequestCount((count) => Math.max(0, count - 1));
    setSelected((current) => (current?.id === bookingId ? null : current));
  }, []);

  const acceptPendingBooking = useCallback(async (booking: HostReservation) => {
    if (actionBookingId) return;
    setActionBookingId(booking.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/host/bookings/${booking.id}/accept`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Unable to accept this booking request.");
      removePendingBooking(booking.id);
      setActionNotice("Booking request accepted. The reservation is now confirmed.");
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to accept this booking request.");
    } finally {
      setActionBookingId(null);
    }
  }, [actionBookingId, removePendingBooking, router]);

  const declinePendingBooking = useCallback(async () => {
    if (!decliningBooking || actionBookingId) return;
    setActionBookingId(decliningBooking.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/host/bookings/${decliningBooking.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason.trim() || undefined }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Unable to decline this booking request.");
      removePendingBooking(decliningBooking.id);
      setDecliningBooking(null);
      setDeclineReason("");
      setActionNotice("Booking request declined. The dates are available again.");
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to decline this booking request.");
    } finally {
      setActionBookingId(null);
    }
  }, [actionBookingId, declineReason, decliningBooking, removePendingBooking, router]);

  useEffect(() => {
    if (tab !== "pending") return;
    const interval = window.setInterval(() => {
      void fetchReservations("pending", page, appliedPropertyId, { force: true });
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [tab, page, appliedPropertyId, fetchReservations]);

  useEffect(() => {
    if (unmountAbortTimeoutRef.current !== null) {
      window.clearTimeout(unmountAbortTimeoutRef.current);
      unmountAbortTimeoutRef.current = null;
    }
    const controllers = abortControllerRef.current;
    return () => {
      // React Strict Mode replays effects in development. Deferring this by one
      // task lets the replay reuse the in-flight initial-tab request instead of
      // aborting it and starting a duplicate request.
      unmountAbortTimeoutRef.current = window.setTimeout(() => {
        for (const controller of controllers) controller.abort();
        controllers.clear();
      }, 0);
    };
  }, []);

  // The server renders the first view, then the browser refreshes only that
  // selected tab. Other tabs remain idle until the host explicitly opens one.
  useEffect(() => {
    void fetchReservations(tab, page, appliedPropertyId, {
      force: true,
      showSkeleton: true,
    });
    // Initial data is intentionally refreshed once after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushClientUrl = useCallback((nextParams: URLSearchParams) => {
    const query = nextParams.toString();
    window.history.pushState(
      window.history.state,
      "",
      query ? `/host/today?${query}` : "/host/today",
    );
  }, []);

  const handleTabChange = useCallback(
    (newTab: ReservationPeriod) => {
      if (newTab === tab) return;
      setTab(newTab);
      setPage(1);
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("tab", newTab);
      nextParams.delete("page");
      if (appliedPropertyId) {
        nextParams.set("listing", appliedPropertyId);
      }
      pushClientUrl(nextParams);
      void fetchReservations(newTab, 1, appliedPropertyId, { showSkeleton: true });
    },
    [tab, appliedPropertyId, fetchReservations, pushClientUrl],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage === page || newPage < 1 || newPage > totalPages) return;
      setPage(newPage);
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("tab", tab);
      nextParams.set("page", String(newPage));
      if (appliedPropertyId) {
        nextParams.set("listing", appliedPropertyId);
      }
      pushClientUrl(nextParams);
      void fetchReservations(tab, newPage, appliedPropertyId, { showSkeleton: true });
    },
    [page, totalPages, tab, appliedPropertyId, fetchReservations, pushClientUrl],
  );

  useEffect(() => {
    const restoreWorkspaceFromHistory = () => {
      const params = new URLSearchParams(window.location.search);
      const historyTab = parseReservationPeriod(params.get("tab"));
      const historyPage = Math.max(1, Number(params.get("page")) || 1);
      const requestedPropertyId = params.get("listing");
      const historyPropertyId =
        requestedPropertyId && listingsMap.has(requestedPropertyId)
          ? requestedPropertyId
          : null;

      setTab(historyTab);
      setPage(historyPage);
      setPendingUrlListingId(null);
      setSelectedPropertyId(historyPropertyId);
      void fetchReservations(historyTab, historyPage, historyPropertyId, {
        showSkeleton: true,
      });
    };

    window.addEventListener("popstate", restoreWorkspaceFromHistory);
    return () => window.removeEventListener("popstate", restoreWorkspaceFromHistory);
  }, [fetchReservations, listingsMap, setSelectedPropertyId]);

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      setCurrentDate(bookingDateKey(now));
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    };
    updateCurrentTime();
    const interval = window.setInterval(updateCurrentTime, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const requestedReservationId = searchParams.get("reservation");
    if (!requestedReservationId) return;
    const requestedReservation = reservations.find(
      (reservation) => reservation.id === requestedReservationId,
    );
    if (!requestedReservation) return;
    const openId = window.setTimeout(() => setSelected(requestedReservation), 0);
    return () => window.clearTimeout(openId);
  }, [reservations, searchParams]);

  const operationalEvents = useMemo(
    () => buildOperationalEvents(reservations, listingsMap, tab, currentDate),
    [reservations, listingsMap, tab, currentDate],
  );

  // Apply listing filter
  const displayedEvents = useMemo(
    () =>
      filterOperationalEventsByProperty(operationalEvents, appliedPropertyId),
    [operationalEvents, appliedPropertyId],
  );

  const priorityReservationId = useMemo(
    () => selectPriorityReservationId(displayedEvents, tab, currentTimeMinutes),
    [displayedEvents, tab, currentTimeMinutes],
  );

  const openFilters = () => {
    setDraftPropertyId(appliedPropertyId);
    setFiltersOpen(true);
  };

  // Resolve selected listing for detail modal
  const selectedListing = useMemo(() => {
    if (!selected) return null;
    const fromListings = listingsMap.get(selected.listingId);
    if (fromListings) return fromListings;
    if (selected.listing) return selected.listing as unknown as ListingDTO;
    return listings[0] || null;
  }, [selected, listingsMap, listings]);

  const handleApplyFilter = (propId: string | null) => {
    setPendingUrlListingId(null);
    setSelectedPropertyId(propId);
    setFiltersOpen(false);
    setPage(1);
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set("tab", tab);
    nextParams.delete("page");
    if (propId) {
      nextParams.set("listing", propId);
    } else {
      nextParams.delete("listing");
    }
    pushClientUrl(nextParams);
    void fetchReservations(tab, 1, propId, { showSkeleton: true });
  };

  return (
    <>
      <main className="w-full min-w-0 pb-12 pt-6 sm:pb-24 sm:pt-8">
        <Container>
          {/* Toggle & Filter Bar */}
          <div className="mb-6 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 pb-5 sm:mb-8 sm:pb-6">
            {/* Reservation Period Pill Switcher */}
            <div
              className="col-start-2 flex items-center gap-2 py-1"
              role="tablist"
              aria-label={t("host_today_aria_period", "Reservation period")}
            >
              {[
                { id: "today", label: t("host_today_tab_today", "Today") },
                { id: "upcoming", label: t("host_today_tab_upcoming", "Upcoming") },
              ].map((filterTab) => (
                <button
                  key={filterTab.id}
                  role="tab"
                  aria-selected={tab === filterTab.id}
                  onClick={() => handleTabChange(filterTab.id as ReservationPeriod)}
                  className={`rounded-full px-4 py-2 text-sm sm:px-4.5 sm:py-2.5 font-medium transition-all duration-200 shrink-0 font-sans cursor-pointer ${tab === filterTab.id
                    ? "bg-[#1F1F1F] text-white shadow-xs"
                    : "bg-[#F3F4F5] text-[#1F1F1F] hover:bg-zinc-200"
                    }`}
                >
                  <span>{filterTab.label}</span>
                </button>
              ))}
            </div>

            {/* Filter Button */}
            <button
              type="button"
              aria-label={t("host_today_filters", "Filters")}
              aria-expanded={filtersOpen}
              onClick={openFilters}
              className={`col-start-3 justify-self-end inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-200 cursor-pointer border ${
                appliedPropertyId
                  ? "bg-[#1F1F1F] text-white border-[#1F1F1F]"
                  : "bg-white text-[#1F1F1F] border-zinc-300 hover:bg-zinc-50 shadow-2xs"
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="4" x2="4" y1="21" y2="14" />
                <line x1="4" x2="4" y1="10" y2="3" />
                <line x1="12" x2="12" y1="21" y2="12" />
                <line x1="12" x2="12" y1="8" y2="3" />
                <line x1="20" x2="20" y1="21" y2="16" />
                <line x1="20" x2="20" y1="12" y2="3" />
                <line x1="1" x2="7" y1="14" y2="14" />
                <line x1="9" x2="15" y1="8" y2="8" />
                <line x1="17" x2="23" y1="16" y2="16" />
              </svg>
              <span>{t("host_nav_filters", "Filters")}</span>
              {appliedPropertyId && (
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-emerald-400"
                />
              )}
            </button>
          </div>

          {isTabLoading ? (
            <div
              aria-label={t("host_today_loading_aria", "Loading reservations")}
              className="mb-6 h-9 w-64 max-w-full rounded-md skeleton-shimmer"
            />
          ) : (
            <h1 className="mb-6 wrap-break-word">
              {tab === "pending" && "Booking requests — "}You have {totalCount}{" "}
              {tab === "upcoming"
                ? `${t("host_today_period_upcoming", "upcoming")} `
                : tab === "staying"
                  ? `${t("host_today_period_staying", "current")} `
                  : tab === "completed"
                    ? `${t("host_today_period_completed", "completed")} `
                    : tab === "pending"
                      ? `${t("host_today_period_pending", "pending")} `
                      : tab === "cancelled"
                        ? `${t("host_today_period_cancelled", "cancelled")} `
                        : ""}
              {totalCount === 1
                ? t("host_today_unit_single", "reservation")
                : t("host_today_unit_plural", "reservations")}
            </h1>
          )}

          {actionError && (
            <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {actionError}
            </div>
          )}
          {actionNotice && (
            <div role="status" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <span>{actionNotice}</span>
              <button type="button" onClick={() => setActionNotice(null)} className="font-medium underline">Dismiss</button>
            </div>
          )}

          {/* Reservation Cards Grid */}
          {isTabLoading ? (
            <div className="grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="relative flex min-h-[386px] w-full min-w-0 flex-col items-center justify-center rounded-[12px] border border-zinc-100 px-4 py-7 sm:min-h-[416px] sm:rounded-[20px] bg-white shadow-[0_1px_5px_rgba(0,0,0,0.1)]"
                >
                  <div className="relative flex w-[min(100%,190px)] flex-col items-center gap-5 sm:gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-24 rounded-md skeleton-shimmer" />
                      <div className="h-4 w-32 rounded-md skeleton-shimmer" />
                    </div>
                    <div className="relative flex flex-col items-center">
                      <div className="h-[110px] w-[149.79px] rounded-[23px] skeleton-shimmer" />
                      <div className="absolute -top-[20px] left-1/2 -translate-x-1/2 size-10 rounded-full skeleton-shimmer border border-zinc-200" />
                    </div>
                    <div className="flex flex-col items-center gap-1.5 w-full">
                      <div className="h-3.5 w-3/4 rounded-md skeleton-shimmer" />
                      <div className="h-3 w-1/2 rounded-md skeleton-shimmer" />
                    </div>
                    <div className="h-10 w-full rounded-xl skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedEvents.length > 0 ? (
            <div className={`grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}>
              {displayedEvents.map((event) => (
                <ReservationCard
                  key={event.id}
                  event={event}
                  selected={selected?.id === event.booking.id}
                  isActive={priorityReservationId === event.id}
                  priorityLabel={
                    event.eventType === "staying"
                      ? t("host_today_priority_now", "Now")
                      : event.eventType === "cancelled"
                        ? t("host_today_priority_cancelled", "Cancelled")
                        : event.eventType === "pending"
                          ? t("host_today_priority_pending", "Pending")
                          : event.eventType === "completed"
                            ? t("host_today_priority_past", "Past")
                            : tab === "today"
                              ? t("host_today_priority_next_up", "Next up")
                              : t("host_today_priority_upcoming", "Upcoming")
                  }
                  onSelect={() => setSelected(event.booking)}
                  onAccept={event.eventType === "pending" ? () => void acceptPendingBooking(event.booking) : undefined}
                  onDecline={event.eventType === "pending" ? () => {
                    setActionError(null);
                    setDecliningBooking(event.booking);
                  } : undefined}
                  actionLoading={actionBookingId === event.booking.id}
                />
              ))}
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="relative flex min-h-[386px] w-full min-w-0 flex-col items-center justify-center rounded-[12px] border border-zinc-100 px-4 py-7 sm:min-h-[416px] sm:rounded-[20px] bg-white shadow-[0_1px_5px_rgba(0,0,0,0.1)]"
                >
                  <div className="relative flex w-[min(100%,190px)] flex-col items-center gap-5 sm:gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-24 rounded-md skeleton-shimmer" />
                      <div className="h-4 w-32 rounded-md skeleton-shimmer" />
                    </div>
                    <div className="relative flex flex-col items-center">
                      <div className="h-[110px] w-[149.79px] rounded-[23px] skeleton-shimmer" />
                      <div className="absolute -top-[20px] left-1/2 -translate-x-1/2 size-10 rounded-full skeleton-shimmer border border-zinc-200" />
                    </div>
                    <div className="flex flex-col items-center gap-1.5 w-full">
                      <div className="h-3.5 w-3/4 rounded-md skeleton-shimmer" />
                      <div className="h-3 w-1/2 rounded-md skeleton-shimmer" />
                    </div>
                    <div className="h-10 w-full rounded-xl skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-[24px] border border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center max-w-2xl mx-auto">
              <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-[#FDE29B] text-2xl shadow-xs">
                ☼
              </span>
              <p className="text-lg font-medium text-[#1F1F1F]">
                {appliedPropertyId
                  ? t("host_today_empty_property", "No reservations found for this property")
                  : tab === "today"
                    ? t("host_today_empty_today", "No reservations today")
                    : tab === "upcoming"
                      ? t("host_today_empty_upcoming", "No upcoming reservations")
                      : tab === "staying"
                        ? t("host_today_empty_staying", "No current stays")
                        : tab === "completed"
                          ? t("host_today_empty_completed", "No completed stays yet")
                          : tab === "pending"
                            ? t("host_today_empty_pending", "No pending booking requests")
                            : tab === "cancelled"
                              ? t("host_today_empty_cancelled", "No cancelled reservations")
                              : t("host_today_empty_default", "No reservations found")}
              </p>
              <p className="mt-2 text-sm text-[#727272]">
                {appliedPropertyId
                  ? t("host_today_empty_property_desc", "Try clearing your listing filter to see all reservations.")
                  : tab === "today"
                    ? t("host_today_empty_today_desc", "You don't have any check-ins, check-outs, or active stays scheduled for today.")
                    : tab === "upcoming"
                      ? t("host_today_empty_upcoming_desc", "Your next reservations will appear here once guests book your space.")
                      : tab === "staying"
                        ? t("host_today_empty_staying_desc", "Guests who are currently checking in or staying will appear here.")
                        : tab === "completed"
                          ? t("host_today_empty_completed_desc", "Past completed stays will be listed here after checkout.")
                          : tab === "pending"
                            ? t("host_today_empty_pending_desc", "New booking requests from guests will appear here.")
                            : tab === "cancelled"
                              ? t("host_today_empty_cancelled_desc", "Cancelled reservations and refund records will appear here.")
                              : t("host_today_empty_default_desc", "Your reservations will appear here once guests book your space.")}
              </p>
              {appliedPropertyId ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraftPropertyId(null);
                    handleApplyFilter(null);
                  }}
                  className="mt-6 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-sm font-medium text-white hover:bg-white border border-[#1f1f1f] hover:text-[#1f1f1f] transition-colors cursor-pointer"
                >
                  {t("host_today_clear_filters", "Clear filters")}
                </button>
              ) : (
                <Link
                  href="/host/calendar"
                  className="mt-6 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-sm font-medium text-white hover:bg-white border border-[#1f1f1f] hover:text-[#1f1f1f] transition-colors cursor-pointer"
                >
                  {t("host_today_view_calendar", "View calendar")}
                </Link>
              )}
            </div>
          )}

          {/* Previous / Next Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-zinc-200 pt-6 sm:flex-row">
              <p className="text-sm text-[#727272]">
                {t("host_today_pagination_page", "Page")} <span className="font-medium text-[#1F1F1F]">{page}</span> {t("host_today_pagination_of", "of")}{" "}
                <span className="font-medium text-[#1F1F1F]">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => handlePageChange(page - 1)}
                  className="rounded-full border border-[#727272] bg-[#1f1f1f] px-5 py-2 text-sm font-medium text-white hover:text-[#1f1f1f] transition-colors hover:bg-[#FCDF9C] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  aria-label={t("host_today_pagination_prev_aria", "Previous page")}
                >
                  {t("host_today_pagination_prev", "Previous")}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => handlePageChange(page + 1)}
                  className="rounded-full border border-[#727272] bg-[#FCDF9C] px-5 py-2 text-sm font-medium text-[#1f1f1f] hover:text-white transition-colors hover:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  aria-label={t("host_today_pagination_next_aria", "Next page")}
                >
                  {t("host_today_pagination_next", "Next")}
                </button>
              </div>
            </div>
          )}

          {/* Filter Listings Modal */}
          {filtersOpen && (
            <WorkspaceDialog
              title={t("host_today_filters", "Filters")}
              onClose={() => setFiltersOpen(false)}
              maxWidth="max-w-[520px]"
              variant="listing-filter"
            >
              <section className="border-b border-[#D7D7D7] pb-5">
                <h3 className="text-sm font-medium text-[#1F1F1F]">
                  {t("host_today_filter_period", "Reservation status")}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label={t("host_today_filter_period", "Reservation status")}>
                  {reservationPeriods.map((period) => {
                    const labels: Record<ReservationPeriod, string> = {
                      today: t("host_today_tab_today", "Today"),
                      upcoming: t("host_today_tab_upcoming", "Upcoming"),
                      staying: t("host_today_tab_staying", "Current stays"),
                      completed: t("host_today_tab_completed", "Completed"),
                      pending: pendingRequestCount > 0
                        ? `${t("host_today_tab_pending", "Pending")} (${pendingRequestCount})`
                        : t("host_today_tab_pending", "Pending"),
                      cancelled: t("host_today_tab_cancelled", "Cancelled"),
                      all: t("host_today_tab_all", "All"),
                    };
                    const selectedPeriod = tab === period;
                    return (
                      <button
                        key={period}
                        type="button"
                        role="tab"
                        aria-selected={selectedPeriod}
                        onClick={() => {
                          setFiltersOpen(false);
                          handleTabChange(period);
                        }}
                        className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${selectedPeriod
                          ? "bg-[#1F1F1F] text-white"
                          : "bg-[#F3F4F5] text-[#1F1F1F] hover:bg-zinc-200"
                          }`}
                      >
                        {labels[period]}
                      </button>
                    );
                  })}
                </div>
              </section>

              <p className="mb-3 mt-5 text-sm font-medium text-[#1F1F1F]">
                {t("host_today_filter_listing", "Listing")}
              </p>
              <div className="max-h-[calc(100dvh-190px)] space-y-1.5 overflow-y-auto overscroll-contain pr-1 sm:max-h-[50dvh] sm:space-y-2 sm:py-1">
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-1 transition-colors hover:bg-zinc-50 sm:min-h-[60px] sm:gap-5">
                  <span
                    className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[#727272] bg-[#F3F4F5] text-[#727272] sm:size-[60px]"
                    aria-hidden="true"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-8h6v8" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-5 font-normal text-[#1F1F1F] sm:text-base sm:leading-6">
                    {t("host_today_all_properties", "All properties")}
                  </span>
                  <input
                    type="radio"
                    name="host-property-filter"
                    value="all"
                    checked={draftPropertyId === null}
                    onChange={() => setDraftPropertyId(null)}
                    className="size-[22px] shrink-0 appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[6px] checked:bg-[#FCDF9C] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F1F1F]"
                  />
                </label>
                {isTabLoading && listings.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[#727272]">
                    Loading listings…
                  </p>
                ) : listings.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[#727272]">
                    {t("host_today_no_listings", "No listings available.")}
                  </p>
                ) : (
                  listings.map((l) => (
                    <label
                      key={l.id}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl hover:bg-zinc-50 transition-colors sm:min-h-[68px] sm:gap-5 sm:py-1"
                    >
                      <PropertyPhoto
                        listing={l}
                        className="size-12 shrink-0 rounded-full border border-[#727272] object-cover sm:size-[60px]"
                      />
                      <span className="min-w-0 flex-1 break-words text-sm font-normal leading-5 text-[#1F1F1F] sm:text-base sm:leading-6">
                        {l.title}
                      </span>
                      <input
                        type="radio"
                        name="host-property-filter"
                        value={l.id}
                        checked={draftPropertyId === l.id}
                        onChange={() => setDraftPropertyId(l.id)}
                        className="size-[22px] shrink-0 appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[6px] checked:bg-[#FCDF9C] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F1F1F]"
                      />
                    </label>
                  ))
                )}
              </div>

              <div className="sticky bottom-0 mt-3 flex items-center justify-between gap-4 border-t border-[#D7D7D7] bg-white pt-4 sm:mt-5 sm:gap-6 sm:pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setDraftPropertyId(null);
                    handleApplyFilter(null);
                  }}
                  className="min-h-11 text-sm sm:text-base font-normal text-[#727272] underline underline-offset-4 hover:text-[#1F1F1F]"
                >
                  {t("host_today_clear_filters", "Clear filters")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextProp =
                      draftPropertyId && listingsMap.has(draftPropertyId)
                        ? draftPropertyId
                        : null;
                    handleApplyFilter(nextProp);
                  }}
                  className="min-h-12 rounded-full border border-[#727272] bg-[#FCDF9C] px-7 py-3 text-sm font-medium text-[#1F1F1F] hover:text-white transition-colors hover:bg-[#1f1f1f] sm:text-base sm:min-h-11 sm:border-transparent sm:px-7 sm:py-2.5"
                >
                  {t("host_today_apply", "Apply")}
                </button>
              </div>
            </WorkspaceDialog>
          )}

          {/* Reservation Details Drawer / Modal */}
          {selected && selectedListing && (
            <ReservationDetails
              booking={selected}
              listing={selectedListing}
              onClose={() => setSelected(null)}
            />
          )}

          {decliningBooking && (
            <WorkspaceDialog
              title="Decline booking request?"
              onClose={() => {
                if (actionBookingId) return;
                setDecliningBooking(null);
                setDeclineReason("");
              }}
              maxWidth="max-w-md"
            >
              <p className="text-sm leading-6 text-[#727272]">
                Declining this request releases the held dates and notifies the guest.
              </p>
              <label className="mt-5 block text-sm font-medium text-[#1F1F1F]" htmlFor="today-decline-reason">
                Reason (optional)
              </label>
              <textarea
                id="today-decline-reason"
                rows={3}
                maxLength={500}
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-300 p-3 text-sm"
                placeholder="Let the guest know why you cannot accommodate them..."
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={Boolean(actionBookingId)}
                  onClick={() => {
                    setDecliningBooking(null);
                    setDeclineReason("");
                  }}
                  className="min-h-11 rounded-full px-4 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(actionBookingId)}
                  onClick={() => void declinePendingBooking()}
                  className="min-h-11 rounded-full bg-rose-600 px-5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {actionBookingId ? "Declining…" : "Decline request"}
                </button>
              </div>
            </WorkspaceDialog>
          )}
        </Container>
      </main>
    </>
  );
}
