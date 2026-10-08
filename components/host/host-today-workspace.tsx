"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HostSubNav } from "./host-sub-nav";
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

export function HostTodayWorkspace({
  listings,
  bookings,
  totalCount: initialTotalCount,
  total: initialTotal,
  page: initialPageProp,
  totalPages: initialTotalPagesProp,
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const parsedInitialTab: ReservationPeriod =
    initialTab ||
    (requestedTab === "upcoming" ||
    requestedTab === "staying" ||
    requestedTab === "completed" ||
    requestedTab === "pending" ||
    requestedTab === "cancelled" ||
    requestedTab === "all"
      ? requestedTab
      : "today");

  const [tab, setTab] = useState<ReservationPeriod>(parsedInitialTab);
  const [page, setPage] = useState<number>(
    () => Number(searchParams.get("page")) || initialPage || initialPageProp || 1,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const [refreshError, setRefreshError] = useState<string | null>(null);

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
      : null;

  // In-memory client cache to support instantaneous tab switching
  const cacheRef = useRef<
    Map<
      string,
      {
        bookings: HostReservation[];
        totalCount: number;
        totalPages: number;
      }
    >
  >(new Map());

  // In-flight deduplication & request cancellation refs
  const inFlightRef = useRef<
    Map<
      string,
      Promise<{
        bookings: HostReservation[];
        totalCount: number;
        totalPages: number;
      }>
    >
  >(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Seed cache with server-rendered initial data
  useEffect(() => {
    const initialKey = `${parsedInitialTab}:${page}:${appliedPropertyId || "all"}`;
    if (!cacheRef.current.has(initialKey)) {
      cacheRef.current.set(initialKey, {
        bookings: initialDeduplicated,
        totalCount: initialTotalCount ?? initialTotal ?? bookings.length,
        totalPages: initialTotalPagesProp ?? Math.max(1, Math.ceil((initialTotalCount ?? initialTotal ?? bookings.length) / 12)),
      });
    }
  }, [parsedInitialTab, page, appliedPropertyId, initialDeduplicated, initialTotalCount, initialTotal, initialTotalPagesProp, bookings.length]);

  const fetchReservations = useCallback(
    async (
      targetTab: ReservationPeriod,
      targetPage: number,
      targetPropertyId: string | null,
      options?: { bypassCache?: boolean },
    ) => {
      const cacheKey = `${targetTab}:${targetPage}:${targetPropertyId || "all"}`;

      if (!options?.bypassCache && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)!;
        setReservations(cached.bookings);
        setTotalCount(cached.totalCount);
        setTotalPages(cached.totalPages);
        setRefreshError(null);
        setLoading(false);
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);

      const requestKey = `${targetTab}:${targetPage}:${targetPropertyId || "all"}`;
      let pendingPromise = inFlightRef.current.get(requestKey);

      if (!pendingPromise) {
        const queryParams = new URLSearchParams();
        queryParams.set("tab", targetTab);
        queryParams.set("page", String(targetPage));
        queryParams.set("limit", "12");
        if (targetPropertyId) {
          queryParams.set("propertyId", targetPropertyId);
        }

        pendingPromise = (async () => {
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
            throw new Error(
              payload?.error?.message || "Unable to refresh reservations.",
            );
          }
          const fetchedBookings = deduplicateHostReservations(payload.data.bookings);
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

          const result = {
            bookings: fetchedBookings,
            totalCount: count,
            totalPages: pages,
          };
          cacheRef.current.set(cacheKey, result);
          return result;
        })().finally(() => {
          inFlightRef.current.delete(requestKey);
        });

        inFlightRef.current.set(requestKey, pendingPromise);
      }

      try {
        const result = await pendingPromise;
        if (!controller.signal.aborted) {
          setReservations(result.bookings);
          setTotalCount(result.totalCount);
          setTotalPages(result.totalPages);
          setRefreshError(null);
          setLoading(false);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setRefreshError(
          error instanceof Error
            ? error.message
            : "Unable to refresh reservations.",
        );
        setLoading(false);
      }
    },
    [],
  );

  const handleTabChange = useCallback(
    (newTab: ReservationPeriod) => {
      if (newTab === tab) return;
      setTab(newTab);
      setPage(1);
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", newTab);
      nextParams.delete("page");
      if (appliedPropertyId) {
        nextParams.set("listing", appliedPropertyId);
      }
      router.replace(`/host/today?${nextParams.toString()}`, { scroll: false });
      void fetchReservations(newTab, 1, appliedPropertyId);
    },
    [tab, searchParams, appliedPropertyId, router, fetchReservations],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage === page || newPage < 1 || newPage > totalPages) return;
      setPage(newPage);
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", tab);
      nextParams.set("page", String(newPage));
      if (appliedPropertyId) {
        nextParams.set("listing", appliedPropertyId);
      }
      router.replace(`/host/today?${nextParams.toString()}`, { scroll: false });
      void fetchReservations(tab, newPage, appliedPropertyId);
    },
    [page, totalPages, searchParams, tab, appliedPropertyId, router, fetchReservations],
  );

  const refreshReservations = useCallback(async () => {
    void fetchReservations(tab, page, appliedPropertyId, { bypassCache: true });
  }, [fetchReservations, tab, page, appliedPropertyId]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshReservations();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "homyz:reservations-updated") {
        void refreshReservations();
      }
    };
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("homyz:reservations-updated", refreshWhenVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener(
        "homyz:reservations-updated",
        refreshWhenVisible,
      );
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshReservations]);

  useEffect(() => {
    if (
      requestedTab === "upcoming" ||
      requestedTab === "staying" ||
      requestedTab === "completed" ||
      requestedTab === "pending" ||
      requestedTab === "cancelled" ||
      requestedTab === "all" ||
      requestedTab === "today"
    ) {
      if (requestedTab !== tab) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTab(requestedTab);
        setPage(1);
        void fetchReservations(requestedTab, 1, appliedPropertyId);
      }
    }
  }, [requestedTab, tab, appliedPropertyId, fetchReservations]);

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
    const requestedListingId = searchParams.get("listing");
    if (requestedListingId && listingsMap.has(requestedListingId)) {
      if (requestedListingId !== selectedPropertyId) {
        setSelectedPropertyId(requestedListingId);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(1);
        void fetchReservations(tab, 1, requestedListingId);
      }
    }
  }, [listingsMap, searchParams, setSelectedPropertyId, selectedPropertyId, tab, fetchReservations]);

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
    () => buildOperationalEvents(reservations, listingsMap, tab, currentDate, currentTimeMinutes),
    [reservations, listingsMap, tab, currentDate, currentTimeMinutes],
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

  const closeReservationDetails = () => {
    setSelected(null);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("reservation");
    const query = nextParams.toString();
    router.replace(query ? `/host/today?${query}` : "/host/today", { scroll: false });
  };

  const handleApplyFilter = (propId: string | null) => {
    setSelectedPropertyId(propId);
    setFiltersOpen(false);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tab);
    nextParams.delete("page");
    if (propId) {
      nextParams.set("listing", propId);
    } else {
      nextParams.delete("listing");
    }
    router.replace(`/host/today?${nextParams.toString()}`, { scroll: false });
    void fetchReservations(tab, 1, propId);
  };

  return (
    <>
      <HostSubNav
        activeTab="today"
        onFilterClick={openFilters}
        filterActive={Boolean(appliedPropertyId)}
      />

      <main className="w-full min-w-0 pb-12 pt-10 sm:pb-24 sm:pt-10">
        <Container>
          {/* Toggle & Mobile Filter Bar */}
          <div className="mb-6 flex w-full items-center justify-between gap-3 border-b border-[#727272] pb-5 sm:mb-10 sm:w-fit sm:pb-7">
            {/* Reservation Period Pill Switcher */}
            <div
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
              role="tablist"
              aria-label="Reservation period"
            >
              {[
                { id: "today", label: "Today" },
                { id: "upcoming", label: "Upcoming" },
                { id: "staying", label: "Current stays" },
                { id: "completed", label: "Completed" },
                { id: "pending", label: "Pending" },
                { id: "cancelled", label: "Cancelled" },
                { id: "all", label: "All" },
              ].map((filterTab) => (
                <button
                  key={filterTab.id}
                  role="tab"
                  aria-selected={tab === filterTab.id}
                  onClick={() => handleTabChange(filterTab.id as ReservationPeriod)}
                  className={`rounded-full px-4 py-2.5 text-sm sm:px-4.5 sm:py-2.5 font-medium transition-all duration-200 shrink-0 font-sans cursor-pointer ${
                    tab === filterTab.id
                      ? "bg-[#1F1F1F] text-white shadow-xs"
                      : "bg-[#F3F4F5] text-[#1F1F1F] hover:bg-zinc-200"
                  }`}
                >
                  {filterTab.label}
                </button>
              ))}
            </div>

            {/* Mobile Filter Button */}
            <button
              type="button"
              aria-label="Filter listings"
              onClick={openFilters}
              className={`flex size-12 shrink-0 items-center justify-center rounded-full sm:hidden transition-colors duration-300 ease-in-out ${
                appliedPropertyId
                  ? "bg-[#1F1F1F] text-white border-zinc-900"
                  : "bg-[#F3F4F5] text-[#1F1F1F]"
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <circle cx="4" cy="12" r="2" />
                <circle cx="12" cy="10" r="2" />
                <circle cx="20" cy="14" r="2" />
              </svg>
            </button>
          </div>

          {/* Section Headline */}
          <h1 className="mb-6 break-words font-sans text-[24px] leading-8 font-medium text-[#1F1F1F] tracking-normal sm:mb-8 sm:text-[32px] sm:leading-10 xl:text-[36px] xl:leading-[44px]">
            You have {totalCount}{" "}
            {tab === "upcoming"
              ? "upcoming "
              : tab === "staying"
              ? "current "
              : tab === "completed"
              ? "completed "
              : tab === "pending"
              ? "pending "
              : tab === "cancelled"
              ? "cancelled "
              : ""}
            {totalCount === 1 ? "reservation" : "reservations"}
          </h1>

          {refreshError && (
            <div
              className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="status"
            >
              <span>
                Reservations could not be refreshed. Showing the last available data.
              </span>
              <button
                type="button"
                onClick={() => void refreshReservations()}
                className="font-semibold underline underline-offset-4 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Reservation Cards Grid */}
          {displayedEvents.length > 0 ? (
            <div className={`grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}>
              {displayedEvents.map((event) => (
                <ReservationCard
                  key={event.booking.id}
                  event={event}
                  selected={selected?.id === event.booking.id}
                  isActive={priorityReservationId === event.booking.id}
                  priorityLabel={
                    event.eventType === "staying"
                      ? "Now"
                      : event.eventType === "cancelled"
                      ? "Cancelled"
                      : event.eventType === "pending"
                      ? "Pending"
                      : event.eventType === "completed"
                      ? "Past"
                      : tab === "today"
                        ? "Next up"
                        : "Upcoming"
                  }
                  onSelect={() => setSelected(event.booking)}
                />
              ))}
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="relative flex min-h-[330px] w-full min-w-0 flex-col items-center justify-center rounded-[12px] border border-zinc-100 px-4 py-8 sm:min-h-[362px] sm:rounded-[20px] bg-white shadow-[0_1px_5px_rgba(0,0,0,0.1)]"
                >
                  <div className="relative flex w-[170px] flex-col items-center gap-[28px] sm:gap-[32px]">
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
                    <div className="size-8 rounded-full skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-[24px] border border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center">
              <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-[#FDE29B] text-2xl shadow-xs">
                ☼
              </span>
              <p className="text-lg font-semibold text-[#1F1F1F]">
                {appliedPropertyId
                  ? "No reservations found for this property"
                  : tab === "today"
                    ? "No reservations today"
                    : tab === "upcoming"
                    ? "No upcoming reservations"
                    : tab === "staying"
                    ? "No current stays"
                    : tab === "completed"
                    ? "No completed stays yet"
                    : tab === "pending"
                    ? "No pending requests"
                    : tab === "cancelled"
                    ? "No cancelled reservations"
                    : "No reservations found"}
              </p>
              <p className="mt-2 text-sm text-[#727272]">
                {appliedPropertyId
                  ? "Try clearing your listing filter to see all reservations."
                  : tab === "today"
                    ? "You don't have any check-ins, check-outs, or active stays scheduled for today."
                    : tab === "upcoming"
                    ? "Your next reservations will appear here once guests book your space."
                    : tab === "staying"
                    ? "Guests who are currently checking in or staying will appear here."
                    : tab === "completed"
                    ? "Past completed stays will be listed here after checkout."
                    : tab === "pending"
                    ? "Reservation requests awaiting your review will appear here."
                    : tab === "cancelled"
                    ? "Cancelled reservations and refund records will appear here."
                    : "Your reservations will appear here once guests book your space."}
              </p>
              {appliedPropertyId ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPropertyId(null);
                    setDraftPropertyId(null);
                    setPage(1);
                    void fetchReservations(tab, 1, null);
                  }}
                  className="mt-6 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white hover:bg-black transition-colors cursor-pointer"
                >
                  Clear filters
                </button>
              ) : (
                <Link
                  href="/host/calendar"
                  className="mt-6 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white hover:bg-black transition-colors"
                >
                  View calendar
                </Link>
              )}
            </div>
          )}

          {/* Previous / Next Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-zinc-200 pt-6 sm:flex-row">
              <p className="text-sm text-[#727272]">
                Page <span className="font-semibold text-[#1F1F1F]">{page}</span> of{" "}
                <span className="font-semibold text-[#1F1F1F]">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => handlePageChange(page - 1)}
                  className="rounded-full border border-[#727272] bg-white px-5 py-2 text-xs font-semibold text-[#1F1F1F] transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => handlePageChange(page + 1)}
                  className="rounded-full border border-[#727272] bg-white px-5 py-2 text-xs font-semibold text-[#1F1F1F] transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Filter Listings Modal */}
          {filtersOpen && (
            <WorkspaceDialog
              title="Filter listings"
              onClose={() => setFiltersOpen(false)}
              maxWidth="max-w-[520px]"
              variant="listing-filter"
            >
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
                    All properties
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
                {listings.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[#727272]">
                    No listings available.
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

              <div className="sticky bottom-0 mt-3 flex items-center justify-between gap-4 border-t border-[#D7D7D7] bg-white pt-4 sm:mt-5 sm:justify-start sm:gap-6 sm:pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setDraftPropertyId(null);
                    handleApplyFilter(null);
                  }}
                  className="min-h-11 text-sm sm:text-base font-normal text-[#727272] underline underline-offset-4 hover:text-[#1F1F1F]"
                >
                  Clear filters
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
                  className="min-h-12 rounded-full border border-[#727272] bg-[#FCDF9C] px-7 py-3 text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#F7D37D] sm:text-base sm:min-h-11 sm:border-transparent sm:px-7 sm:py-2.5"
                >
                  Apply
                </button>
              </div>
            </WorkspaceDialog>
          )}

          {/* Reservation Details Drawer / Modal */}
          {selected && selectedListing && (
            <ReservationDetails
              booking={selected}
              listing={selectedListing}
              onClose={closeReservationDetails}
              onHostReview={() => router.push(`/host/reviews/${encodeURIComponent(selected.id)}`)}
            />
          )}
        </Container>
      </main>
    </>
  );
}
