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
  price: 42100, // SR 421
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
      (filters.length === 0 || filters.includes(b.listingId)) &&
      (tab === "today"
        ? b.startDate.slice(0, 10) === today || b.endDate.slice(0, 10) === today
        : b.startDate.slice(0, 10) > today),
  );

  const reservations =
    actualReservations.length > 0
      ? actualReservations
      : filters.length === 0
        ? tab === "today"
          ? SAMPLE_TODAY_RESERVATIONS
          : SAMPLE_UPCOMING_RESERVATIONS
        : [];

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

      <main className="mx-auto w-full max-w-[1520px] flex-1 px-4 sm:px-6 xl:px-0 pb-24 pt-8 sm:pt-10">
        {/* Toggle & Mobile Filter Bar */}
        <div className="mb-8 flex items-center justify-between sm:mb-12">
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
              className={`rounded-full px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all font-['Poppins'] ${
                tab === "today"
                  ? "bg-[#1F1F1F] text-white shadow-xs"
                  : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              Today
            </button>
            <button
              role="tab"
              aria-selected={tab === "upcoming"}
              onClick={() => setTab("upcoming")}
              className={`rounded-full px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all font-['Poppins'] ${
                tab === "upcoming"
                  ? "bg-[#1F1F1F] text-white shadow-xs"
                  : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"
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
            className={`flex size-11 items-center justify-center rounded-2xl border sm:hidden transition-colors ${
              filters.length ? "bg-[#1F1F1F] text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-700"
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
        <h1 className="mb-8 font-['Poppins'] text-[28px] sm:text-[36px] font-semibold text-[#1F1F1F] tracking-normal">
          You have {reservations.length} {tab === "upcoming" ? "upcoming " : ""}
          {reservations.length === 1 ? "reservation" : "reservations"}
        </h1>

        {/* Reservation Cards Flex Row matching Figma */}
        {reservations.length > 0 ? (
          <div className="flex flex-row items-center gap-[24px] overflow-x-auto pb-6 max-w-full xl:overflow-visible">
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
                  className={`group relative flex h-[362px] w-[362px] shrink-0 flex-col items-center justify-center rounded-[20px] transition-colors duration-300 ease-in-out cursor-pointer select-none font-['Poppins'] ${
                    isSelected ? "bg-[#FCDF9C]" : "bg-white hover:bg-[#FCDF9C]"
                  }`}
                  style={{
                    boxShadow: "2px 0px 4px rgba(0, 0, 0, 0.25), 0px 2px 4px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  {/* Frame 1996663767 */}
                  <div className="relative flex w-[170px] flex-col items-center gap-[32px]">
                    {/* Frame 1996663765: Header (Time + Subtitle) */}
                    <div className="flex flex-col items-center justify-center text-center">
                      <span className="font-['Poppins'] text-[16px] font-medium leading-[24px] text-[#1F1F1F]">
                        {timeDisplay}
                      </span>
                      <span
                        className={`font-['Poppins'] text-[14px] font-normal leading-[21px] transition-colors duration-300 ease-in-out ${
                          isSelected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
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
                            className={`h-[94px] w-[128px] rounded-[10px] border border-[#1F1F1F] bg-[#F3F4F5] transition-all duration-300 ease-in-out ${
                              isSelected
                                ? "h-[110px] w-[150px] rounded-[12px]"
                                : "group-hover:h-[110px] group-hover:w-[150px] group-hover:rounded-[12px]"
                            }`}
                          />
                        ) : (
                          /* Photo thumbnail with smooth expand on hover */
                          <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                              isSelected
                                ? "h-[110px] w-[149.79px] rounded-[23.4px] border-[1.2px] border-[#1F1F1F]"
                                : "h-[94px] w-[128px] rounded-[20px] border-2 border-[#1F1F1F]"
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
                          <span className="font-['Poppins'] text-[16px] font-medium leading-[24px] text-[#1F1F1F]">
                            {badgeLetter}
                          </span>
                        </div>
                      </div>

                      {/* Property name, Location */}
                      <div
                        className={`flex h-[36px] w-[112px] flex-col items-center justify-center text-center font-['Poppins'] text-[12px] font-normal leading-[18px] transition-colors duration-300 ease-in-out ${
                          isSelected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
                        }`}
                      >
                        <span className="truncate max-w-full">Property name,</span>
                        <span className="truncate max-w-full">Location</span>
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
                        {/* Single corner icon that rotates smoothly from ⌝ into > */}
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
            maxWidth="max-w-md"
          >
            <div className="space-y-3 py-1">
              {effectiveListings.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-4 rounded-xl p-2 hover:bg-zinc-50 transition-colors"
                >
                  <PropertyPhoto
                    listing={l}
                    className="size-12 rounded-full border border-zinc-200 object-cover"
                  />
                  <span className="flex-1 text-sm font-medium text-zinc-900 truncate">
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
                    className="size-5 rounded-full border-zinc-300 accent-[#1F1F1F]"
                  />
                </label>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => setDraft([])}
                className="text-xs font-medium text-zinc-500 underline hover:text-zinc-900"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(draft);
                  setFiltersOpen(false);
                }}
                className="rounded-full bg-[#FDE29B] hover:bg-[#fed673] px-8 py-2.5 text-xs font-bold text-zinc-900 transition-colors shadow-2xs"
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
      </main>
    </>
  );
}
