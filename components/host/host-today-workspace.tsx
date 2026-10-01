"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { HostSubNav } from "./host-sub-nav";
import {
  PropertyPhoto,
  WorkspaceDialog,
  ReservationDetails,
  MoneyDialog,
  type HostWorkspaceProps,
  type HostReservation,
} from "./host-workspace-shared";
import type { ListingDTO } from "@/services/mappers";
import { Container } from "../ui";
import { bookingDateKey, formatBookingDateRange } from "@/lib/booking/booking-date";
import { formatTime12h, parseTimeMinutes } from "@/lib/booking/booking-time";

export { formatTime12h, parseTimeMinutes };

export type OperationalEvent = {
  booking: HostReservation;
  listing: ListingDTO | NonNullable<HostReservation["listing"]>;
  eventType: "checkout" | "checkin" | "staying" | "upcoming";
  timeDisplay: string;
  subtitleDisplay: string;
  timeMinutes: number;
};

export function HostTodayWorkspace({ listings, bookings }: HostWorkspaceProps) {
  const [tab, setTab] = useState<"today" | "upcoming">("today");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [selected, setSelected] = useState<HostReservation | null>(null);
  const [showMoney, setShowMoney] = useState(false);
  const [today] = useState(() => bookingDateKey(new Date()));

  // Map listings for fast lookup
  const listingsMap = useMemo(() => {
    const map = new Map<string, ListingDTO>();
    for (const l of listings) {
      map.set(l.id, l);
    }
    return map;
  }, [listings]);

  // Derive operational events based on active tab and date relationship
  const operationalEvents = useMemo(() => {
    const events: OperationalEvent[] = [];

    for (const b of bookings) {
      if (b.status === "CANCELLED") continue;

      const listing = listingsMap.get(b.listingId) || b.listing || {
        id: b.listingId,
        title: "Listing",
        city: "",
        district: "",
        country: "Saudi Arabia",
        photos: [],
        checkInStart: "15:00",
        checkOutTime: "11:00",
      };

      if (tab === "today") {
        const isCheckout = b.endDate === today;
        const isCheckin = b.startDate === today;
        const isStaying = b.startDate < today && b.endDate > today;

        if (isCheckout) {
          events.push({
            booking: b,
            listing,
            eventType: "checkout",
            timeMinutes: parseTimeMinutes(listing.checkOutTime, 11 * 60),
            timeDisplay: formatTime12h(listing.checkOutTime, "11:00 AM"),
            subtitleDisplay: `${b.guestName || "Guest"} checks out`,
          });
        } else if (isCheckin) {
          events.push({
            booking: b,
            listing,
            eventType: "checkin",
            timeMinutes: parseTimeMinutes(listing.checkInStart, 15 * 60),
            timeDisplay: formatTime12h(listing.checkInStart, "3:00 PM"),
            subtitleDisplay: `${b.guestName || "Guest"} checks in`,
          });
        } else if (isStaying) {
          events.push({
            booking: b,
            listing,
            eventType: "staying",
            timeMinutes: 12 * 60,
            timeDisplay: formatTime12h(listing.checkOutTime, "11:00 AM"),
            subtitleDisplay: `Currently hosting ${b.guestName || "Guest"}`,
          });
        }
      } else {
        // Upcoming tab: future stays starting after today
        if (b.startDate > today) {
          events.push({
            booking: b,
            listing,
            eventType: "upcoming",
            timeMinutes: parseTimeMinutes(listing.checkInStart, 15 * 60),
            timeDisplay: formatTime12h(listing.checkInStart, "3:00 PM"),
            subtitleDisplay: formatBookingDateRange(b.startDate, b.endDate),
          });
        }
      }
    }

    // Sort events
    if (tab === "today") {
      // Sort today by event time ascending (earlier check-outs first, then later check-ins)
      return events.sort((a, b) => a.timeMinutes - b.timeMinutes || a.booking.id.localeCompare(b.booking.id));
    } else {
      // Sort upcoming by check-in date ascending, then event time
      return events.sort((a, b) => {
        const dateDiff = a.booking.startDate.localeCompare(b.booking.startDate);
        if (dateDiff !== 0) return dateDiff;
        return a.timeMinutes - b.timeMinutes || a.booking.id.localeCompare(b.booking.id);
      });
    }
  }, [bookings, listingsMap, tab, today]);

  // Apply listing filter
  const displayedEvents = useMemo(() => {
    if (filters.length === 0) return operationalEvents;
    return operationalEvents.filter((ev) => filters.includes(ev.booking.listingId));
  }, [operationalEvents, filters]);

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
        onFilterClick={() => {
          setDraft(filters);
          setFiltersOpen(true);
        }}
        filterActive={filters.length > 0}
      />

      <main className="w-full min-w-0 pb-12 pt-10 sm:pb-24 sm:pt-10">
        <Container>
          {/* Toggle & Mobile Filter Bar */}
          <div className="mb-6 flex w-full items-center justify-between gap-3 border-b border-[#727272] pb-5 sm:mb-10 sm:w-fit sm:pb-7">
            {/* Reservation Period Pill Switcher */}
            <div
              className="flex items-center gap-2"
              role="tablist"
              aria-label="Reservation period"
            >
              <button
                role="tab"
                aria-selected={tab === "today"}
                onClick={() => setTab("today")}
                className={`rounded-full px-4 py-3 text-base sm:px-4.25 sm:py-2.75 font-medium transition-all duration-300 ease-in-out font-sans ${
                  tab === "today"
                    ? "bg-[#1F1F1F] text-white shadow-xs"
                    : "bg-[#F3F4F5] text-[#1F1F1F] hover:bg-zinc-200"
                }`}
              >
                Today
              </button>
              <button
                role="tab"
                aria-selected={tab === "upcoming"}
                onClick={() => setTab("upcoming")}
                className={`rounded-full px-4 py-3 text-base sm:py-2.75 font-medium transition-all duration-300 ease-in-out font-sans ${
                  tab === "upcoming"
                    ? "bg-[#1F1F1F] text-white shadow-xs"
                    : "bg-[#F3F4F5] text-[#1F1F1F] border border-transparent hover:bg-[#1F1F1F] hover:text-white hover:border-[#1F1F1F]"
                }`}
              >
                Upcoming
              </button>
            </div>

            {/* Mobile Filter Button */}
            <button
              type="button"
              aria-label="Filter listings"
              onClick={() => {
                setDraft(filters);
                setFiltersOpen(true);
              }}
              className={`flex size-12 shrink-0 items-center justify-center rounded-full sm:hidden transition-colors duration-300 ease-in-out ${
                filters.length ? "bg-[#1F1F1F] text-white border-zinc-900" : "bg-[#F3F4F5] text-[#1F1F1F]"
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
            You have {displayedEvents.length} {tab === "upcoming" ? "upcoming " : ""}
            {displayedEvents.length === 1 ? "reservation" : "reservations"}
          </h1>

          {/* Reservation Cards Grid */}
          {displayedEvents.length > 0 ? (
            <div className="grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {displayedEvents.map((ev, index) => {
                const b = ev.booking;
                const listing = ev.listing;
                const isSelected = selected?.id === b.id;
                const isNextUp = tab === "today" && index === 0;

                const badgeLetter =
                  b.guestName && b.guestName !== "(Name)"
                    ? b.guestName.charAt(0).toUpperCase()
                    : "G";

                const guestCount = b.guests || 1;

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelected(b)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(b);
                      }
                    }}
                    className={`group relative flex min-h-[330px] w-full min-w-0 flex-col items-center justify-center rounded-[12px] border border-zinc-100 px-4 py-8 sm:min-h-[362px] sm:rounded-[20px] transition-colors duration-300 ease-in-out cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F1F1F] font-sans ${
                      isSelected
                        ? "bg-[#FCDF9C]"
                        : isNextUp
                          ? "bg-white hover:bg-[#FCDF9C] ring-2 ring-[#1F1F1F]/20"
                          : "bg-white hover:bg-[#FCDF9C]"
                    }`}
                    style={{
                      boxShadow: "0 1px 5px rgba(0, 0, 0, 0.20)",
                    }}
                  >
                    {/* "Next up" badge for the immediate operational event */}
                    {isNextUp && (
                      <span className="absolute top-3.5 right-3.5 z-10 rounded-full bg-[#1F1F1F] px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white tracking-wide uppercase shadow-xs">
                        Next up
                      </span>
                    )}

                    {/* Frame 1996663767 */}
                    <div className="relative flex w-[170px] flex-col items-center gap-[28px] sm:gap-[32px]">
                      {/* Frame 1996663765: Header (Time + Subtitle) */}
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="font-sans text-[16px] font-medium leading-[24px] text-[#1F1F1F]">
                          {ev.timeDisplay}
                        </span>
                        <span
                          className={`font-sans text-[14px] font-normal leading-[21px] transition-colors duration-300 ease-in-out ${
                            isSelected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
                          }`}
                        >
                          {ev.subtitleDisplay}
                        </span>
                      </div>

                      {/* Frame 1996663766: Content Body */}
                      <div className="flex w-[170px] flex-col items-center gap-[10px] sm:gap-[12px]">
                        {/* Frame 1996663768: Photo Thumbnail + Badge */}
                        <div className="relative flex flex-col items-center">
                          <div
                            className="h-[110px] w-[149.79px] overflow-hidden rounded-[23px] border border-[#1F1F1F] transition-all duration-300 ease-in-out"
                          >
                            <PropertyPhoto
                              listing={listing as unknown as ListingDTO}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          {/* Avatar Badge: Frame 1996663769 */}
                          <div className="absolute -top-[20px] left-1/2 flex h-[40px] w-[40px] -translate-x-1/2 items-center justify-center rounded-full border border-black bg-white z-10 shadow-xs overflow-hidden">
                            {b.guestImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={b.guestImage}
                                alt={b.guestName || "Guest"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="font-sans text-[16px] font-medium leading-[24px] text-[#1F1F1F]">
                                {badgeLetter}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Property name, Location */}
                        <div
                          className={`flex min-h-[36px] w-full min-w-0 flex-col items-center justify-center text-center font-sans text-[12px] font-normal leading-[18px] transition-colors duration-300 ease-in-out ${
                            isSelected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
                          }`}
                        >
                          <span className="line-clamp-1 max-w-full break-words font-medium">{listing.title},</span>
                          <span className="line-clamp-1 max-w-full break-words">
                            {[listing.district, listing.city].filter(Boolean).join(", ") || "Location"}
                          </span>
                        </div>

                        {/* Guest Count */}
                        <div
                          className={`flex items-center gap-1.5 font-sans text-[12px] font-normal leading-[18px] transition-colors duration-300 ease-in-out ${
                            isSelected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
                          }`}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="shrink-0"
                            aria-hidden="true"
                          >
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          <span>{guestCount} {guestCount === 1 ? "guest" : "guests"}</span>
                        </div>

                        {/* Action Button: slide */}
                        <div
                          className={`flex h-[32px] w-[32px] items-center justify-center rounded-full border border-[#1F1F1F] transition-colors duration-300 ease-in-out ${
                            isSelected
                              ? "bg-white"
                              : "bg-[#FCDF9C] group-hover:bg-white"
                          }`}
                          aria-hidden="true"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className={`origin-center transition-transform duration-300 ease-in-out ${
                              isSelected
                                ? "rotate-45"
                                : "rotate-0 group-hover:rotate-45"
                            }`}
                          >
                            <path
                              d="M2 2H8V8"
                              stroke="#1F1F1F"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-[24px] border border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center">
              <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-[#FDE29B] text-2xl shadow-xs">
                ☼
              </span>
              <p className="text-lg font-semibold text-[#1F1F1F]">
                {filters.length > 0
                  ? "No reservations for selected listings"
                  : tab === "today"
                    ? "A quiet day at home"
                    : "No upcoming reservations"}
              </p>
              <p className="mt-2 text-sm text-[#727272]">
                {filters.length > 0
                  ? "Try clearing your listing filters to see all reservations."
                  : tab === "today"
                    ? "You don't have any check-ins, check-outs, or active stays scheduled for today."
                    : "Your next reservations will appear here once guests book your space."}
              </p>
              {filters.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilters([])}
                  className="mt-6 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white hover:bg-black transition-colors cursor-pointer"
                >
                  Clear filters
                </button>
              ) : (
                <Link
                  href="/host/calendar"
                  className="mt-6 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white hover:bg-black transition-colors"
                >
                  Open calendar
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
              <div className="space-y-1.5 sm:space-y-2 sm:py-1">
                {listings.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[#727272]">No listings available.</p>
                ) : (
                  listings.map((l) => (
                    <label
                      key={l.id}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl hover:bg-zinc-50 transition-colors sm:min-h-[68px] sm:gap-5 sm:py-1"
                    >
                      {l.photos[0] ? (
                        <PropertyPhoto
                          listing={l}
                          className="size-12 shrink-0 rounded-full border border-[#727272] object-cover sm:size-[60px]"
                        />
                      ) : (
                        <span aria-hidden="true" className="size-12 shrink-0 rounded-full border border-[#727272] bg-[#F3F4F5] sm:size-[60px]" />
                      )}
                      <span className="min-w-0 flex-1 break-words text-sm font-normal leading-5 text-[#1F1F1F] sm:text-base sm:leading-6">
                        {l.title}
                      </span>
                      <input
                        type="checkbox"
                        checked={draft.includes(l.id)}
                        onChange={(e) =>
                          setDraft(
                            e.target.checked
                              ? [...draft, l.id]
                              : draft.filter((id) => id !== l.id),
                          )
                        }
                        className="size-[22px] shrink-0 appearance-none rounded-full border border-[#1F1F1F] bg-white checked:border-[6px] checked:bg-[#FCDF9C] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F1F1F]"
                      />
                    </label>
                  ))
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#D7D7D7] pt-4 sm:mt-5 sm:justify-start sm:gap-6 sm:pt-8">
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  className="min-h-11 text-sm sm:text-base font-normal text-[#727272] underline underline-offset-4 hover:text-[#1F1F1F]"
                >
                  Clear filters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters(draft);
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
          {selected && selectedListing && !showMoney && (
            <ReservationDetails
              booking={selected}
              listing={selectedListing}
              onClose={() => setSelected(null)}
              onMoney={() => setShowMoney(true)}
            />
          )}

          {/* Send or Request Money Dialog */}
          {selected && showMoney && (
            <MoneyDialog
              booking={selected}
              onClose={() => {
                setShowMoney(false);
                setSelected(null);
              }}
            />
          )}
        </Container>
      </main>
    </>
  );
}
