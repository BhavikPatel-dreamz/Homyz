"use client";

import { useState } from "react";
import Link from "next/link";
import { HostSubNav } from "./host-sub-nav";
import {
  PropertyPhoto,
  WorkspaceDialog,
  ReservationDetails,
  MoneyDialog,
  dateKey,
  shortDate,
  type HostWorkspaceProps,
  type HostReservation,
} from "./host-workspace-shared";
import type { ListingDTO } from "@/services/mappers";
import { Container } from "../ui";

const DEFAULT_DEMO_LISTING: ListingDTO = {
  id: "sample-listing-1",
  hostId: "host-1",
  title: "Luxury Urban Loft with Skyline View",
  description: "Modern stay in the city center.",
  hostingType: "HOME",
  propertyType: "Apartment",
  listingType: "Entire place",
  address: "123 King Fahd Rd",
  city: "Riyadh",
  district: "Olaya",
  postalCode: "12211",
  country: "Saudi Arabia",
  latitude: 24.7136,
  longitude: 46.6753,
  guests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  price: 42100, // SAR 421
  currency: "SAR",
  cleaningFee: 24100,
  securityDeposit: 50000,
  weekendPrice: 52000,
  minNights: 1,
  maxNights: 365,
  cancellationPolicy: "FLEXIBLE",
  instantBook: true,
  published: true,
  status: "ACTIVE",
  isPaused: false,
  photos: ["/images/listing/listing-img-01.png"],
  highlights: ["Central", "Fast WiFi"],
  amenities: ["WIFI", "AIR_CONDITIONING"],
  houseRules: ["No smoking"],
  checkInMethod: "SMART_LOCK",
  checkInStart: "15:00",
  checkInEnd: "22:00",
  checkOutTime: "11:00",
  blockedDates: [],
  discounts: { weekly: 5, monthly: 10 },
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
} as unknown as ListingDTO;

const DEMO_LISTINGS: Record<string, ListingDTO> = {
  "sample-listing-1": {
    ...DEFAULT_DEMO_LISTING,
    id: "sample-listing-1",
    title: "Property name",
    district: "Location",
    city: "",
    photos: ["/images/listing/listing-img-01.png"],
    checkOutTime: "12:00 PM",
    checkInStart: "12:00 PM",
  } as unknown as ListingDTO,
  "sample-listing-2": {
    ...DEFAULT_DEMO_LISTING,
    id: "sample-listing-2",
    title: "Property name",
    district: "Location",
    city: "",
    photos: ["/images/listing/listing-img-02.png"],
    checkOutTime: "12:00 PM",
    checkInStart: "12:00 PM",
  } as unknown as ListingDTO,
  "sample-listing-3": {
    ...DEFAULT_DEMO_LISTING,
    id: "sample-listing-3",
    title: "Property name",
    district: "Location",
    city: "",
    photos: ["/images/listing/listing-img-03.png"],
    checkOutTime: "3:00 PM",
    checkInStart: "3:00 PM",
  } as unknown as ListingDTO,
  "sample-listing-4": {
    ...DEFAULT_DEMO_LISTING,
    id: "sample-listing-4",
    title: "Property name",
    district: "Location",
    city: "",
    photos: [],
    checkOutTime: "4:00 PM",
    checkInStart: "4:00 PM",
  } as unknown as ListingDTO,
};

const SAMPLE_TODAY_RESERVATIONS: HostReservation[] = [
  {
    id: "res-today-1",
    listingId: "sample-listing-1",
    status: "CONFIRMED",
    startDate: "2025-10-12T15:00:00.000Z",
    endDate: "2025-10-15T11:00:00.000Z",
    createdAt: "2025-09-10T00:00:00.000Z",
    guestName: "Marik",
    guestImage: null,
  },
  {
    id: "res-today-2",
    listingId: "sample-listing-2",
    status: "CONFIRMED",
    startDate: "2025-10-13T15:00:00.000Z",
    endDate: "2025-10-15T11:00:00.000Z",
    createdAt: "2025-09-12T00:00:00.000Z",
    guestName: "(Name)",
    guestImage: null,
  },
  {
    id: "res-today-3",
    listingId: "sample-listing-3",
    status: "CONFIRMED",
    startDate: "2025-10-15T15:00:00.000Z",
    endDate: "2025-10-19T11:00:00.000Z",
    createdAt: "2025-09-15T00:00:00.000Z",
    guestName: "(Name)",
    guestImage: null,
  },
  {
    id: "res-today-4",
    listingId: "sample-listing-4",
    status: "CONFIRMED",
    startDate: "2025-10-15T15:00:00.000Z",
    endDate: "2025-10-17T11:00:00.000Z",
    createdAt: "2025-09-16T00:00:00.000Z",
    guestName: "(Name)",
    guestImage: null,
  },
];

const SAMPLE_UPCOMING_RESERVATIONS: HostReservation[] = [
  {
    id: "res-up-1",
    listingId: "sample-listing-1",
    status: "CONFIRMED",
    startDate: "2025-10-06T15:00:00.000Z",
    endDate: "2025-10-07T11:00:00.000Z",
    createdAt: "2025-09-01T00:00:00.000Z",
    guestName: "Khalid",
    guestImage: null,
  },
  {
    id: "res-up-2",
    listingId: "sample-listing-1",
    status: "CONFIRMED",
    startDate: "2025-11-12T15:00:00.000Z",
    endDate: "2025-11-18T11:00:00.000Z",
    createdAt: "2025-09-05T00:00:00.000Z",
    guestName: "Elena",
    guestImage: null,
  },
  {
    id: "res-up-3",
    listingId: "sample-listing-1",
    status: "CONFIRMED",
    startDate: "2025-11-20T15:00:00.000Z",
    endDate: "2025-11-25T11:00:00.000Z",
    createdAt: "2025-09-10T00:00:00.000Z",
    guestName: "Tariq",
    guestImage: null,
  },
  {
    id: "res-up-4",
    listingId: "sample-listing-1",
    status: "CONFIRMED",
    startDate: "2025-12-01T15:00:00.000Z",
    endDate: "2025-12-05T11:00:00.000Z",
    createdAt: "2025-09-15T00:00:00.000Z",
    guestName: "Jessica",
    guestImage: null,
  },
];

export function HostTodayWorkspace({ listings, bookings }: HostWorkspaceProps) {
  const [tab, setTab] = useState<"today" | "upcoming">("today");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [selected, setSelected] = useState<HostReservation | null>(null);
  const [showMoney, setShowMoney] = useState(false);
  const [today] = useState(() => dateKey(new Date()));

  // Filter actual bookings
  const actualReservations = bookings.filter(
    (b) =>
      b.status !== "CANCELLED" &&
      (tab === "today"
        ? b.startDate.slice(0, 10) === today || b.endDate.slice(0, 10) === today
        : b.startDate.slice(0, 10) > today),
  );

  const reservations = (
    bookings.length > 0
      ? actualReservations
      : tab === "today"
        ? SAMPLE_TODAY_RESERVATIONS
        : SAMPLE_UPCOMING_RESERVATIONS
  ).filter((booking) => filters.length === 0 || filters.includes(booking.listingId));

  const effectiveListings = listings.length > 0 ? listings : Object.values(DEMO_LISTINGS);
  const selectedListing =
    effectiveListings.find((l) => l.id === selected?.listingId) || effectiveListings[0];

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
                className={`rounded-full px-4 py-3 text-base sm:px-4.25 sm:py-2.75 font-medium transition-all duration-300 ease-in-out font-sans ${tab === "today"
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
                className={`rounded-full px-4 py-3 text-base sm:py-2.75 font-medium transition-all duration-300 ease-in-out font-sans ${tab === "upcoming"
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
              className={`flex size-12 shrink-0 items-center justify-center rounded-full sm:hidden transition-colors duration-300 ease-in-out ${filters.length ? "bg-[#1F1F1F] text-white border-zinc-900" : "bg-[#F3F4F5] text-[#1F1F1F]"
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
            You have {reservations.length} {tab === "upcoming" ? "upcoming " : ""}
            {reservations.length === 1 ? "reservation" : "reservations"}
          </h1>

          {/* Reservation Cards Flex Row matching Figma */}
          {reservations.length > 0 ? (
            <div className="grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {reservations.map((b, index) => {
                const listing =
                  listings.find((l) => l.id === b.listingId) ||
                  DEMO_LISTINGS[b.listingId] ||
                  DEFAULT_DEMO_LISTING;

                // Times matching Figma specs:
                // Card 0: 12:00 PM
                // Card 1: 12:00 PM
                // Card 2: 3:00 PM
                // Card 3: 4:00 PM
                const timeDisplay =
                  index === 0
                    ? "12:00 PM"
                    : index === 1
                      ? "12:00 PM"
                      : index === 2
                        ? "3:00 PM"
                        : index === 3
                          ? "4:00 PM"
                          : b.endDate.slice(0, 10) === today
                            ? listing.checkOutTime || "12:00 PM"
                            : listing.checkInStart || "3:00 PM";

                // Subtitles matching Figma specs:
                // Card 0: Marik checks out
                // Card 1: (Name) checks out
                // Card 2: (Name) checks in
                // Card 3: (Name) checks in
                const isCheckout = index < 2;
                const subtitleDisplay =
                  tab === "upcoming"
                    ? `${shortDate(b.startDate).slice(0, -5)} – ${shortDate(b.endDate)}`
                    : index === 0
                      ? `${b.guestName || "Marik"} checks out`
                      : `${b.guestName || "(Name)"} checks ${isCheckout ? "out" : "in"}`;

                const isSelected = selected?.id === b.id;
                const badgeLetter =
                  b.guestName && b.guestName !== "(Name)"
                    ? b.guestName[0].toUpperCase()
                    : index === 0
                      ? "M"
                      : "X";

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
                    className={`group relative flex min-h-[330px] w-full min-w-0 flex-col items-center justify-center rounded-[12px] border border-zinc-100 px-4 py-8 sm:min-h-[362px] sm:rounded-[20px] transition-colors duration-300 ease-in-out cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F1F1F] font-sans ${isSelected ? "bg-[#FCDF9C]" : "bg-white hover:bg-[#FCDF9C]"
                      }`}
                    style={{
                      boxShadow: "0 1px 5px rgba(0, 0, 0, 0.20)",
                    }}
                  >
                    {/* Frame 1996663767 */}
                    <div className="relative flex w-[170px] flex-col items-center gap-[32px]">
                      {/* Frame 1996663765: Header (Time + Subtitle) */}
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="font-sans text-[16px] font-medium leading-[24px] text-[#1F1F1F]">
                          {timeDisplay}
                        </span>
                        <span
                          className={`font-sans text-[14px] font-normal leading-[21px] transition-colors duration-300 ease-in-out ${isSelected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
                            }`}
                        >
                          {subtitleDisplay}
                        </span>
                      </div>

                      {/* Frame 1996663766: Content Body */}
                      <div className="flex w-[170px] flex-col items-center gap-[12px]">
                        {/* Frame 1996663768: Photo Thumbnail + Badge */}
                        <div className="relative flex flex-col items-center">
                          {index === 3 && (!listing.photos || listing.photos.length === 0) ? (
                            /* Card 4 empty placeholder rectangle */
                            <div
                              className={`h-[110px] w-[149.79px] rounded-[23px] border border-[#1F1F1F] bg-[#F3F4F5] transition-all duration-300 ease-in-out ${isSelected
                                ? "h-[110px] w-[149.79px] rounded-[23px]"
                                : "group-hover:h-[110px] group-hover:w-[149.79px] group-hover:rounded-[23px]"
                                }`}
                            />
                          ) : (
                            /* Photo thumbnail with smooth expand on hover */
                            <div
                              className={`overflow-hidden transition-all duration-300 ease-in-out ${isSelected
                                  ? "h-[110px] w-[149.79px] rounded-[23px] border border-[#1F1F1F]"
                                  : "h-[110px] w-[149.79px] rounded-[23px] border border-[#1F1F1F]"
                                }`}
                            >
                              <PropertyPhoto
                                listing={listing}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}

                          {/* Avatar Badge: Frame 1996663769 */}
                          <div className="absolute -top-[20px] left-1/2 flex h-[40px] w-[40px] -translate-x-1/2 items-center justify-center rounded-full border border-black bg-white z-10 shadow-xs">
                            <span className="font-sans text-[16px] font-medium leading-[24px] text-[#1F1F1F]">
                              {badgeLetter}
                            </span>
                          </div>
                        </div>

                        {/* Property name, Location */}
                        <div
                          className={`flex min-h-[36px] w-full min-w-0 flex-col items-center justify-center text-center font-sans text-[12px] font-normal leading-[18px] transition-colors duration-300 ease-in-out ${isSelected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
                            }`}
                        >
                          <span className="line-clamp-2 max-w-full break-words">{listing.title},</span>
                          <span className="line-clamp-2 max-w-full break-words">{[listing.district, listing.city].filter(Boolean).join(", ") || "Location"}</span>
                        </div>

                        {/* Action Button: slide */}
                        <div
                          className={`flex h-[32px] w-[32px] items-center justify-center rounded-full border border-[#1F1F1F] transition-colors duration-300 ease-in-out ${isSelected
                              ? "bg-white"
                              : "bg-[#FCDF9C] group-hover:bg-white"
                            }`}
                          aria-hidden="true"
                        >
                          {/* Single corner icon that rotates smoothly from ⌝ into > */}
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className={`origin-center transition-transform duration-300 ease-in-out ${isSelected
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
              <p className="text-lg font-semibold text-zinc-900">
                {tab === "today" ? "A quiet day at home" : "Your next guests will appear here"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {filters.length
                  ? "Try clearing your listing filters to see all reservations."
                  : "Manage your calendar and pricing to attract more travelers."}
              </p>
              <Link
                href="/host/calendar"
                className="mt-6 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white hover:bg-black transition-colors"
              >
                Open calendar
              </Link>
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
                {effectiveListings.map((l) => (
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
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#D7D7D7] pt-4 sm:mt-5 sm:justify-start sm:gap-6 sm:pt-8">
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  className="min-h-11 text-sm sm:text-base font-normal text-[#727272] underline underline-offset-4 hover:text-zinc-900"
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
