"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
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
  today,
  initialCurrentTimeMinutes,
}: HostWorkspaceProps & {
  today: string;
  initialCurrentTimeMinutes: number;
}) {
  const [tab, setTab] = useState<ReservationPeriod>("today");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { selectedPropertyId, setSelectedPropertyId } = useHostDashboardState();
  const [draftPropertyId, setDraftPropertyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<HostReservation | null>(null);
  const [currentDate, setCurrentDate] = useState(today);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(
    initialCurrentTimeMinutes,
  );
  const [reservations, setReservations] = useState(() =>
    deduplicateHostReservations(bookings),
  );
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshInFlightRef = useRef(false);

  const refreshReservations = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const response = await fetch("/api/v1/host/workspace", {
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
      setReservations(deduplicateHostReservations(payload.data.bookings));
      setRefreshError(null);
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Unable to refresh reservations.",
      );
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshReservations();
    };
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("homyz:reservations-updated", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener(
        "homyz:reservations-updated",
        refreshWhenVisible,
      );
    };
  }, [refreshReservations]);

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
                  onClick={() => setTab(filterTab.id as ReservationPeriod)}
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
            You have {displayedEvents.length}{" "}
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
            {displayedEvents.length === 1 ? "reservation" : "reservations"}
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
            <div className="grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
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
                  onClick={() => setSelectedPropertyId(null)}
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
                    setSelectedPropertyId(null);
                    setFiltersOpen(false);
                  }}
                  className="min-h-11 text-sm sm:text-base font-normal text-[#727272] underline underline-offset-4 hover:text-[#1F1F1F]"
                >
                  Clear filters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPropertyId(
                      draftPropertyId && listingsMap.has(draftPropertyId)
                        ? draftPropertyId
                        : null,
                    );
                    setFiltersOpen(false);
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
              onClose={() => setSelected(null)}
            />
          )}
        </Container>
      </main>
    </>
  );
}
