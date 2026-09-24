"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import ListingGallery from "@/components/listings/listing-gallery";
import { AMENITY_ICON_SOURCES, CANONICAL_AMENITIES, searchAmenitiesCatalog } from "@/lib/constants/amenities";
import type { BookingQuote } from "@/services/booking.service";
import type { PublicListingDTO } from "@/services/mappers";
import { saveRecentlyViewedProperty, clearLastSearch } from "@/lib/storage/client-history";
import { getCurrencyForCountry } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { cancellationPolicyLabel } from "@/lib/constants/listing-enums";
import useWishlist from "@/hooks/useWishlist";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";

// Reviews and the map are below the primary booking decision content. Keep
// their interactive code out of the initial route bundle; both render a stable
// placeholder until their client chunks are ready.
const ReviewList = dynamic(
  () => import("@/components/reviews").then((module) => module.ReviewList),
  {
    ssr: false,
    loading: () => (
      <section className="border-b border-zinc-200/80 py-8" aria-label="Loading guest reviews">
        <h2 className="text-[20px] font-normal text-[#1f1f1f]">Guest reviews</h2>
        <div className="mt-5 h-28 animate-pulse rounded-2xl bg-zinc-100" />
      </section>
    ),
  },
);

const RealMap = dynamic(
  () => import("@/components/ui/real-map").then((module) => module.RealMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" aria-label="Loading map" />,
  },
);

function DeferredReviewList({
  listingId,
  isGuestFavorite,
  onStatsChange,
}: {
  listingId: string;
  isGuestFavorite?: boolean;
  onStatsChange: (stats: { rating: number | null; count: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const target = containerRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {shouldLoad ? (
        <ReviewList listingId={listingId} isGuestFavorite={isGuestFavorite} onStatsChange={onStatsChange} />
      ) : (
        <section className="border-b border-zinc-200/80 py-8" aria-labelledby="guest-reviews-heading">
          <h2 id="guest-reviews-heading" className="text-[20px] font-normal text-[#1f1f1f]">Guest reviews</h2>
          <div className="mt-5 h-28 rounded-2xl bg-zinc-100" />
        </section>
      )}
    </div>
  );
}

function DeferredListingMap({
  address,
  city,
  country,
  latitude,
  longitude,
  showExactLocation,
  ariaLabel,
}: {
  address: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  showExactLocation: boolean;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const target = containerRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      {shouldLoad ? (
        <RealMap
          address={address}
          city={city}
          country={country}
          lat={latitude}
          lng={longitude}
          showExactLocation={showExactLocation}
          preferInitialCoordinates
          allowLocationEditing={false}
          lazyLoad
          className="relative h-full w-full overflow-hidden"
          ariaLabel={ariaLabel}
        />
      ) : (
        <div className="h-full w-full bg-zinc-100" aria-label="Map loads when this section is visible" />
      )}
    </div>
  );
}

interface PublicListingDetailClientProps {
  listing: PublicListingDTO & {
    host?: {
      id: string;
      name?: string | null;
      image?: string | null;
      createdAt?: Date | string;
      publicProfile?: Record<string, unknown> | null;
      isSuperhost?: boolean;
    } | null;
    isGuestFavorite?: boolean;
    // Listings currently derive display currency from their country. Keep this
    // optional for records that gain an explicit listing currency later.
    currency?: string | null;
  };
  guidebooks?: Array<{
    id: string;
    title: string;
    coverImage?: string | null;
    city?: string | null;
    itemsCount: number;
    host?: { id: string; name: string | null; image: string | null };
  }>;
  /** Pre-fill the booking widget with dates from the search page URL */
  searchCheckIn?: string;
  searchCheckOut?: string;
  searchGuests?: number;
}

type BookedDateRange = { start: string; end: string };
type TrustHighlightIconName = "award" | "sparkle" | "calendar" | "pricing";

function TrustHighlightIcon({ name }: { name: TrustHighlightIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.45,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "award") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M8.5 3.5h7l1.2 4.2 3.3 2.8-2 3.9.2 4.7-4.3 1.6L12 23l-1.9-2.6-4.3-1.6.2-4.7-2-3.9 3.3-2.8 1.2-4.2Z" /><path d="M9.5 12h5M12 9.5V14.5" /></svg>;
  }
  if (name === "calendar") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><rect x="3.5" y="5.5" width="17" height="15" rx="2" /><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M8 14h3M8 17h5" /></svg>;
  }
  if (name === "pricing") {
    return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M12 3.5v17M16 7.5c-.8-1-2.2-1.6-4-1.6-2.3 0-3.8 1.1-3.8 2.8 0 1.9 1.7 2.5 3.8 3 2.1.5 3.8 1.1 3.8 3 0 1.8-1.5 3-4 3-1.9 0-3.5-.7-4.4-1.9" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m12 3 1.3 4.2L17.5 8.5l-4.2 1.3L12 14l-1.3-4.2-4.2-1.3 4.2-1.3L12 3Z" /><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></svg>;
}

type RuleIconName = "pets" | "smoking" | "events" | "photo" | "quiet" | "rule";

function RuleIcon({ name }: { name: RuleIconName }) {
  const sources: Record<RuleIconName, string> = {
    pets: "/images/icons/house-rule-pets.svg",
    smoking: "/images/icons/house-rule-smoking.svg",
    events: "/images/icons/house-rule-events.svg",
    photo: "/images/icons/house-rule-photo.svg",
    quiet: "/images/icons/house-rule-quiet.svg",
    rule: "/images/icons/house-rule-default.svg",
  };

  return <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#1f1f1f]"><Image src={sources[name]} alt="" width={24} height={24} className="size-6" /></span>;
}

function RuleCheckIcon() {
  return <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#1f1f1f]"><Image src="/images/icons/right-mark.svg" alt="" width={18} height={18} className="size-[18px]" /></span>;
}

function overlapsBookedRange(checkIn: string, checkOut: string, ranges: BookedDateRange[]): boolean {
  return ranges.some((range) => checkIn < range.end && checkOut > range.start);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isDateKey(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}

function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function calendarNights(checkIn: string, checkOut: string): number {
  return Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86_400_000);
}

function isUnavailableDate(date: Date, ranges: BookedDateRange[]): boolean {
  const key = dateKey(date);
  return ranges.some((range) => key >= range.start && key < range.end);
}

function AmenityRow({ amenity }: { amenity: { id: string; icon?: string; label: string; description?: string } }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span aria-hidden="true" className="text-xl">{amenity.icon || "✓"}</span>
      <div className="min-w-0">
        <h5 className="text-sm font-semibold text-[#1f1f1f]">{amenity.label}</h5>
        {amenity.description && <p className="mt-0.5 text-sm font-normal text-[#727272]">{amenity.description}</p>}
      </div>
    </div>
  );
}

function HostIdentityCard({
  host,
  imageFailed,
  onImageError,
  hostTenure,
  reviewRating,
  reviewCount,
}: {
  host: { name?: string | null; image?: string | null; isSuperhost?: boolean };
  imageFailed: boolean;
  onImageError: () => void;
  hostTenure: string | null;
  reviewRating: number | null;
  reviewCount: number;
}) {
  return (
    <div className="min-h-[260px] sm:rounded-[30px] rounded-[10px] border border-[#dedede] bg-white px-7 py-7 shadow-[0_2px_5px_rgba(0,0,0,0.14)] transition-shadow hover:shadow-[0_5px_14px_rgba(0,0,0,0.14)]">
      <div className="grid grid-cols-2 gap-x-7 gap-y-4">
        <div className="host-left flex flex-col items-center justify-center text-center">
          {host.image && !imageFailed ? (
            <img src={host.image} alt={`${host.name || "Host"}'s profile photo`} loading="lazy" decoding="async" onError={onImageError} className="size-[104px] shrink-0 rounded-full border border-zinc-200 object-cover" />
          ) : (
            <div aria-hidden="true" className="flex size-[104px] shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-100 text-2xl font-bold text-amber-900">
              {(host.name || "H")[0]?.toUpperCase()}
            </div>
          )}
          <div className="pt-4 text-center">
            <p className="break-words sm:text-[20px] text-lg font-semibold text-[#1f1f1f] capitalize">{host.name || "Homyz host"}</p>
            <p className="sm:mt-2 mt-1 text-base font-light text-[#1f1f1f]">{host.isSuperhost ? "Superhost" : "Host"}</p>
          </div>
        </div>

        <div className="min-w-0 divide-y divide-[#dedede]">
          <div className="pb-4"><p className="sm:text-[20px] text-lg font-normal leading-5 text-[#1f1f1f]">{reviewCount || "—"}</p>
            <p className="mt-1 text-xs font-normal text-[#727272]">Reviews</p></div>
          <div className="py-4"><p className="flex items-center gap-1 sm:text-[20px] text-lg font-normal leading-5 text-[#1f1f1f]">{reviewRating?.toFixed(2) ?? "—"}<span className="text-[#e9a400]">★</span></p><p className="mt-2 text-xs font-normal text-[#727272]">Rating</p></div>
          <div className="pt-4">
            <p className="sm:text-[20px] text-base font-normal leading-5 text-[#1f1f1f]">{hostTenure || "—"}</p>
            <p className="mt-2 text-xs font-normal text-[#727272]">time hosting</p>
          </div>
        </div>

      </div>
    </div>
  );
}

function ListingAvailabilityCalendar({
  month,
  onMonthChange,
  ranges,
  isLoading,
  error,
  checkIn,
  checkOut,
  onDateRangeChange,
  onClearDates,
  onErrorMessage,
  locationName,
  minimumNights,
  maximumNights,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  ranges: BookedDateRange[];
  isLoading: boolean;
  error: string | null;
  checkIn: string;
  checkOut: string;
  onDateRangeChange: (checkIn: string, checkOut: string) => void;
  onClearDates: () => void;
  onErrorMessage?: (message: string | null) => void;
  locationName: string;
  minimumNights: number;
  maximumNights?: number;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const canGoBack = firstDay.getTime() > new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const displayedMonths = [firstDay, new Date(month.getFullYear(), month.getMonth() + 1, 1)];
  const formattedStayDates = checkIn && checkOut
    ? `${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${checkIn}T00:00:00`))} – ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${checkOut}T00:00:00`))}`
    : checkIn
      ? `Check-in: ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${checkIn}T00:00:00`))} – Select checkout`
      : "Select check-in date";
  const nights = checkIn && checkOut
    ? Math.max(0, calendarNights(checkIn, checkOut))
    : 0;

  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const chooseDate = (key: string) => {
    const selectedDate = new Date(`${key}T00:00:00`);
    if (selectedDate < today) return;

    if (!checkIn || checkOut || key <= checkIn) {
      if (isUnavailableDate(selectedDate, ranges)) {
        onErrorMessage?.("That check-in date is unavailable. Please choose another date.");
        return;
      }
      onErrorMessage?.(null);
      onDateRangeChange(key, "");
      return;
    }

    // Check-in exists and user is picking check-out date
    const calculatedNights = calendarNights(checkIn, key);
    if (calculatedNights < minimumNights) {
      onErrorMessage?.(`This property requires a minimum stay of ${minimumNights} ${minimumNights === 1 ? "night" : "nights"}.`);
      return;
    }
    if (maximumNights && calculatedNights > maximumNights) {
      onErrorMessage?.(`This property allows a maximum stay of ${maximumNights} ${maximumNights === 1 ? "night" : "nights"}.`);
      return;
    }
    if (overlapsBookedRange(checkIn, key, ranges)) {
      onErrorMessage?.("Those dates include an unavailable night. Please choose different dates.");
      return;
    }

    onErrorMessage?.(null);
    onDateRangeChange(checkIn, key);
  };

  const renderMonth = (calendarMonth: Date) => {
    const monthFirstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const title = monthFirstDay.toLocaleDateString("en", { month: "long", year: "numeric" });

    return (
      <div key={`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`} className="min-w-0">
        <h4 className="mb-4 text-center text-base font-medium text-[#1C1C1C]">{title}</h4>
        <div className="grid grid-cols-7 gap-y-2 text-center text-[10px] font-medium text-zinc-400">
          {weekdays.map((day) => <span key={day} aria-hidden="true">{day.slice(0, 1)}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-1" role="grid" aria-label={`${title} availability calendar`}>
          {Array.from({ length: monthFirstDay.getDay() }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" className="aspect-square" />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1);
            const key = dateKey(date);
            const past = date < today;
            const unavailable = isUnavailableDate(date, ranges);
            const isStart = key === checkIn;
            const isEnd = key === checkOut;
            const isInConfirmedRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);
            const isInHoverRange = Boolean(checkIn && !checkOut && hoverDate && key > checkIn && key <= hoverDate && !overlapsBookedRange(checkIn, hoverDate, ranges));
            const isInRange = isInConfirmedRange || isInHoverRange;
            const disabled = past || (unavailable && !isStart && !isEnd);
            const state = past ? "past" : isStart ? "check-in selected" : isEnd ? "check-out selected" : unavailable ? "unavailable" : isInRange ? "selected stay" : "available";

            return (
              <div key={key} className={`relative flex aspect-square items-center justify-center ${isInRange ? "bg-amber-100" : ""}`}>
                <button
                  type="button"
                  disabled={disabled || isLoading}
                  onClick={() => chooseDate(key)}
                  onMouseEnter={() => {
                    if (checkIn && !checkOut && key > checkIn) {
                      setHoverDate(key);
                    }
                  }}
                  onMouseLeave={() => {
                    if (hoverDate) setHoverDate(null);
                  }}
                  role="gridcell"
                  aria-label={`${date.toLocaleDateString("en", { dateStyle: "full" })}, ${state}`}
                  aria-selected={isStart || isEnd}
                  className={`relative z-10 flex size-8 items-center justify-center rounded-full text-[11px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1f1f] sm:size-9 ${isStart || isEnd
                    ? "bg-[#F6CF7B] font-semibold text-[#1f1f1f] shadow-sm"
                    : isInRange
                      ? "rounded-none bg-amber-100 text-[#1f1f1f] hover:bg-amber-200"
                      : past || unavailable
                        ? "cursor-not-allowed text-zinc-300 line-through"
                        : "cursor-pointer text-zinc-700 hover:bg-zinc-100"
                    } disabled:opacity-70`}
                >
                  {index + 1}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="pb-7" aria-labelledby="availability-heading">
      <div className="mb-6">
        <h3 id="availability-heading" className="text-[20px] font-normal text-[#1f1f1f]">
          {nights > 0 ? `${nights} ${nights === 1 ? "night" : "nights"} in ${locationName}` : `Select your dates in ${locationName}`}
        </h3>
        <p className="mt-1 text-sm font-normal text-[#727272]" aria-live="polite">{formattedStayDates}</p>
      </div>
      {error ? (
        <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>{error}</span>
          <button type="button" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth(), 1))} className="font-semibold underline underline-offset-2 cursor-pointer">Try again</button>
        </div>
      ) : (
        <div className="max-w-[608px] rounded-2xl bg-[#F3F4F5] p-3 sm:p-4">
          <div className="rounded-2xl bg-white px-3 py-5 sm:px-5 sm:py-6">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-start gap-1 sm:gap-3">
              <button type="button" aria-label="Previous two months" disabled={!canGoBack || isLoading} onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="mt-0.5 flex size-8 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer">‹</button>
              <div className="grid min-w-0 grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6">
                {displayedMonths.map(renderMonth)}
              </div>
              <button type="button" aria-label="Next two months" disabled={isLoading} onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="mt-0.5 flex size-8 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer">›</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-sm text-[#727272]">
            <span aria-live="polite">
              {isLoading
                ? "Updating availability…"
                : !checkIn
                  ? "Select check-in date"
                  : !checkOut
                    ? `Minimum stay: ${minimumNights} ${minimumNights === 1 ? "night" : "nights"}. Select checkout date.`
                    : `${nights} ${nights === 1 ? "night" : "nights"} selected`}
            </span>
            {(checkIn || checkOut) && (
              <button
                type="button"
                onClick={onClearDates}
                className="font-medium underline decoration-zinc-400 underline-offset-2 hover:text-[#1f1f1f] cursor-pointer"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function PublicListingDetailClient({
  listing,
  guidebooks = [],
  searchCheckIn,
  searchCheckOut,
  searchGuests,
}: PublicListingDetailClientProps) {
  const { formatPrice } = useCurrency();
  const router = useRouter();
  const wishlist = useWishlist();
  void guidebooks; // The section is intentionally paused; retain the existing server contract.

  // Modal and Expand States
  const [isAllAmenitiesOpen, setIsAllAmenitiesOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [expandedThingsCards, setExpandedThingsCards] = useState({ rules: false, safety: false, cancellation: false });
  const [isGuestSelectorOpen, setIsGuestSelectorOpen] = useState(false);
  const [amenitySearchQuery, setAmenitySearchQuery] = useState("");

  const maximumGuests = Math.max(1, listing.guests || 1);
  const maxPetsAllowed = Math.max(1, listing.maxPets || 2);
  const allowsPets = listing.petsAllowed !== false;

  // Booking Widget State — pre-filled from search URL params
  const [checkIn, setCheckIn] = useState(isDateKey(searchCheckIn) ? searchCheckIn : "");
  const [checkOut, setCheckOut] = useState(isDateKey(searchCheckOut) ? searchCheckOut : "");
  const [adultsCount, setAdultsCount] = useState(() => Math.min(maximumGuests, Math.max(1, searchGuests ?? 1)));
  const [childrenCount, setChildrenCount] = useState(0);
  const [infantsCount, setInfantsCount] = useState(0);
  const [petsCount, setPetsCount] = useState(0);
  const [isNonRefundable, setIsNonRefundable] = useState(false);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookedDateRanges, setBookedDateRanges] = useState<BookedDateRange[]>([]);
  const [availabilityMonth, setAvailabilityMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityRequested, setAvailabilityRequested] = useState(false);
  const [availabilityRefreshVersion, setAvailabilityRefreshVersion] = useState(0);
  const [hostImageFailed, setHostImageFailed] = useState(false);
  const [isBookingPanelSticky, setIsBookingPanelSticky] = useState(true);

  // Review Stats State
  const [reviewRating, setReviewRating] = useState<number | null>(listing.rating);
  const [reviewCount, setReviewCount] = useState(listing.reviewsCount);

  const amenityCloseRef = useRef<HTMLButtonElement>(null);
  const calendarSectionRef = useRef<HTMLDivElement>(null);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const bookingPanelRef = useRef<HTMLDivElement>(null);
  const normalizedDescription = listing.description?.trim() ?? "";

  const totalCapacityGuests = adultsCount + childrenCount;
  const canAddCapacityGuest = totalCapacityGuests < maximumGuests;

  const guestSummaryLabel = useMemo(() => {
    if (childrenCount > 0) {
      const adultPart = `${adultsCount} ${adultsCount === 1 ? "adult" : "adults"}`;
      const childPart = `${childrenCount} ${childrenCount === 1 ? "child" : "children"}`;
      return `${adultPart}, ${childPart}`;
    }
    return `${adultsCount} ${adultsCount === 1 ? "guest" : "guests"}`;
  }, [adultsCount, childrenCount]);

  const toggleThingsCard = (card: "rules" | "safety" | "cancellation") => {
    setExpandedThingsCards((current) => ({ ...current, [card]: !current[card] }));
  };

  // Telemetry: track listing_page_view once on mount
  const hasTrackedViewRef = useRef(false);
  const hasTrackedAvailabilityViewRef = useRef(false);
  const hasTrackedHouseRulesViewRef = useRef(false);

  // Keep the booking panel visible while guests choose dates, then return it
  // to normal document flow before the full-width sections begin.
  useEffect(() => {
    const updateBookingPanelPosition = () => {
      const calendar = calendarSectionRef.current;
      const reviews = reviewSectionRef.current;
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      const bookingHeight = bookingPanelRef.current?.getBoundingClientRect().height ?? 0;
      const reviewIsClearOfPanel = !reviews || reviews.getBoundingClientRect().top > 112 + bookingHeight + 24;
      const shouldStick = Boolean(
        isDesktop && calendar && calendar.getBoundingClientRect().bottom > 112 && reviewIsClearOfPanel,
      );
      setIsBookingPanelSticky((current) => current === shouldStick ? current : shouldStick);
    };

    updateBookingPanelPosition();
    window.addEventListener("scroll", updateBookingPanelPosition, { passive: true });
    window.addEventListener("resize", updateBookingPanelPosition);
    return () => {
      window.removeEventListener("scroll", updateBookingPanelPosition);
      window.removeEventListener("resize", updateBookingPanelPosition);
    };
  }, []);

  useEffect(() => {
    if (hasTrackedViewRef.current || !listing?.id) return;
    hasTrackedViewRef.current = true;
    trackListingEvent({
      eventType: "listing_page_view",
      propertyId: listing.id,
      city: listing.city,
      country: listing.country,
      guestCount: totalCapacityGuests,
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      metadata: {
        propertyType: listing.propertyType,
        listingType: listing.listingType,
        instantBook: listing.instantBook,
        isGuestFavorite: listing.isGuestFavorite,
      },
    });
  }, [listing, totalCapacityGuests, checkIn, checkOut]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !listing?.id) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.id === "availability-heading" && !hasTrackedAvailabilityViewRef.current) {
              hasTrackedAvailabilityViewRef.current = true;
              trackListingEvent({
                eventType: "availability_section_viewed",
                propertyId: listing.id,
                city: listing.city,
                country: listing.country,
              });
            } else if (entry.target.id === "things-to-know-heading" && !hasTrackedHouseRulesViewRef.current) {
              hasTrackedHouseRulesViewRef.current = true;
              trackListingEvent({
                eventType: "house_rules_viewed",
                propertyId: listing.id,
                city: listing.city,
                country: listing.country,
              });
            }
          }
        });
      },
      { threshold: 0.15 },
    );

    const availEl = document.getElementById("availability-heading");
    const rulesEl = document.getElementById("things-to-know-heading");
    if (availEl) observer.observe(availEl);
    if (rulesEl) observer.observe(rulesEl);

    return () => observer.disconnect();
  }, [listing.id, listing.city, listing.country]);

  // A client component may be preserved while the route segment changes. Reset
  // all booking-specific state so a quote from property A never appears on B.
  useEffect(() => {
    const nextCheckIn = isDateKey(searchCheckIn) ? searchCheckIn : "";
    const nextCheckOut = isDateKey(searchCheckOut) && (!nextCheckIn || searchCheckOut > nextCheckIn) ? searchCheckOut : "";
    const nextGuests = Math.min(Math.max(1, searchGuests ?? 1), maximumGuests);
    const timer = window.setTimeout(() => {
      setCheckIn(nextCheckIn);
      setCheckOut(nextCheckOut);
      setAdultsCount(nextGuests);
      setChildrenCount(0);
      setInfantsCount(0);
      setPetsCount(0);
      setIsNonRefundable(false);
      setQuote(null);
      setQuoteError(null);
      setBookingSuccess(false);
      setHostImageFailed(false);
      setIsDescriptionModalOpen(false);
      setIsDescriptionExpanded(false);
      setIsAllAmenitiesOpen(false);
      setIsGuestSelectorOpen(false);
      setAmenitySearchQuery("");
      setBookedDateRanges([]);
      setAvailabilityError(null);
      setAvailabilityRequested(Boolean(nextCheckIn || nextCheckOut));
      setIsAvailabilityLoading(false);
      setAvailabilityMonth(nextCheckIn ? new Date(`${nextCheckIn}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      setAvailabilityRefreshVersion((version) => version + 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [listing.id, maximumGuests, searchCheckIn, searchCheckOut, searchGuests]);

  useEffect(() => {
    if (!isAllAmenitiesOpen) return;
    amenityCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAllAmenitiesOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAllAmenitiesOpen]);

  useEffect(() => {
    if (!isDescriptionModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDescriptionModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDescriptionModalOpen]);

  useEffect(() => {
    if (!isGuestSelectorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsGuestSelectorOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isGuestSelectorOpen]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (checkIn) url.searchParams.set("checkIn", checkIn);
    else url.searchParams.delete("checkIn");
    if (checkOut) url.searchParams.set("checkOut", checkOut);
    else url.searchParams.delete("checkOut");
    url.searchParams.delete("startDate");
    url.searchParams.delete("endDate");
    url.searchParams.set("guests", String(totalCapacityGuests));
    if (petsCount > 0) url.searchParams.set("pets", String(petsCount));
    else url.searchParams.delete("pets");
    window.history.replaceState(window.history.state, "", url);
  }, [checkIn, checkOut, totalCapacityGuests, petsCount]);

  // This compact range is shared by the booking card and read-only calendar.
  // The quote endpoint remains authoritative at reserve time.
  useEffect(() => {
    if (!availabilityRequested && !checkIn && !checkOut) {
      return;
    }
    const controller = new AbortController();
    const calendarRangeStart = dateKey(new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth(), 1));
    const calendarRangeEnd = dateKey(new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth() + 2, 1));
    // The selected stay and availability calendar intentionally share the
    // same response cache. This also revalidates dates supplied by search.
    const rangeStart = isDateKey(checkIn) && checkIn < calendarRangeStart ? checkIn : calendarRangeStart;
    const selectedRangeEnd = isDateKey(checkOut) ? checkOut : isDateKey(checkIn) ? addCalendarDays(checkIn, 1) : "";
    const rangeEnd = selectedRangeEnd && selectedRangeEnd > calendarRangeEnd ? selectedRangeEnd : calendarRangeEnd;
    const startRequest = window.setTimeout(() => {
      setIsAvailabilityLoading(true);
      setAvailabilityError(null);
      fetch(`/api/v1/listings/${listing.id}/booked-dates?start=${rangeStart}&end=${rangeEnd}`, { signal: controller.signal, cache: "no-store" })
        .then(async (res) => ({ ok: res.ok, payload: await res.json() }))
        .then(({ ok, payload }) => {
          if (!ok || !Array.isArray(payload?.data?.ranges)) {
            setAvailabilityError("Availability could not be loaded.");
            return;
          }
          const fetchedRanges = payload.data.ranges.filter((range: unknown): range is BookedDateRange => {
            if (!range || typeof range !== "object") return false;
            const candidate = range as BookedDateRange;
            return typeof candidate.start === "string" && typeof candidate.end === "string";
          });
          setBookedDateRanges((currentRanges) => {
            // Replace data in the requested window, while retaining previously
            // loaded months. This prevents a month change from forgetting a
            // blocked date in an already-selected stay.
            const retained = currentRanges.filter((range) => range.end <= rangeStart || range.start >= rangeEnd);
            const unique = new Map<string, BookedDateRange>();
            for (const range of [...retained, ...fetchedRanges]) unique.set(`${range.start}:${range.end}`, range);
            return [...unique.values()].sort((a, b) => a.start.localeCompare(b.start));
          });
          // A direct/native date input may choose a date before its containing
          // availability window has loaded. Reconcile that selection as soon as
          // the authoritative window arrives instead of leaving an invalid
          // range visibly selected.
          if (isDateKey(checkIn) && isUnavailableDate(new Date(`${checkIn}T00:00:00`), fetchedRanges)) {
            setCheckIn("");
            setCheckOut("");
            setQuote(null);
            setQuoteError("Your selected check-in date is unavailable. Please choose different dates.");
          } else if (isDateKey(checkIn) && isDateKey(checkOut) && overlapsBookedRange(checkIn, checkOut, fetchedRanges)) {
            setCheckOut("");
            setQuote(null);
            setQuoteError("Part of your selected stay is unavailable. Please choose another checkout date.");
          }
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setAvailabilityError("Availability could not be loaded.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsAvailabilityLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(startRequest);
      controller.abort();
    };
  }, [listing.id, availabilityMonth, checkIn, checkOut, availabilityRefreshVersion, availabilityRequested]);

  useEffect(() => {
    if (listing?.id) {
      saveRecentlyViewedProperty({
        id: listing.id,
        slug: listing.customSlug,
        title: listing.title,
        city: listing.city,
        area: listing.district,
        country: listing.country,
        price: listing.price,
        mainImage: Array.isArray(listing.photos) && listing.photos.length > 0 ? listing.photos[0] : "",
        rating: null,
        maxGuests: listing.guests,
        propertyType: listing.propertyType,
      });
    }
  }, [listing]);

  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const amenitiesSet = new Set(Array.isArray(listing.amenities) ? listing.amenities : []);
  const categorizedAmenities = CANONICAL_AMENITIES.filter((amenity) => amenitiesSet.has(amenity.id));
  const filteredModalAmenities = searchAmenitiesCatalog(amenitySearchQuery).filter((amenity) => amenitiesSet.has(amenity.id));
  const amenityGroups = useMemo(() => {
    const groups = new Map<string, typeof categorizedAmenities>();
    for (const amenity of categorizedAmenities) {
      const group = amenity.category || "Other";
      groups.set(group, [...(groups.get(group) ?? []), amenity]);
    }
    return [...groups.entries()];
  }, [categorizedAmenities]);

  // Format price
  const displayPrice = typeof listing.price === "number"
    ? formatPrice(listing.price, listing.currency ?? getCurrencyForCountry(listing.country))
    : null;
  const currencyCode = listing.currency ?? getCurrencyForCountry(listing.country);
  const minimumNights = Math.max(1, listing.minNights || 1);
  const maximumNights = Math.max(minimumNights, listing.maxNights || 365);
  const today = dateKey(new Date());
  const minimumCheckOut = checkIn
    ? addCalendarDays(checkIn, minimumNights)
    : today;
  const locationString = [listing.city, listing.country]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ");
  const publicCoordinates =
    typeof listing.latitude === "number" && Number.isFinite(listing.latitude) &&
      typeof listing.longitude === "number" && Number.isFinite(listing.longitude)
      ? { latitude: listing.latitude, longitude: listing.longitude }
      : null;
  const publicProfile = (listing.host?.publicProfile as Record<string, unknown> | null) ?? {};
  const hostBio = typeof publicProfile?.bio === "string" ? publicProfile.bio : "";
  const hostWork = typeof publicProfile?.myWork === "string" ? publicProfile.myWork.trim() : "";
  const hostLanguages = Array.isArray(publicProfile?.languages)
    ? publicProfile.languages.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 4)
    : [];
  const hostSince = listing.host?.createdAt && !Number.isNaN(new Date(listing.host.createdAt).getTime())
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(listing.host.createdAt))
    : null;
  const hostYears = listing.host?.createdAt && !Number.isNaN(new Date(listing.host.createdAt).getTime())
    ? Math.max(0, new Date().getFullYear() - new Date(listing.host.createdAt).getFullYear() - (new Date().getMonth() < new Date(listing.host.createdAt).getMonth() ? 1 : 0))
    : null;
  const hostTenure = hostYears === null ? null : hostYears > 0 ? `${hostYears} ${hostYears === 1 ? "year" : "years"}` : "Less than a year";
  const hostProfileHref = listing.host?.id ? `/users/profile/${listing.host.id}` : null;
  const formatTime = (time: string | null | undefined) => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [hour, minute] = time.split(":").map(Number);
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${suffix}`;
  };
  const humanize = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const aboutLocationDetails = [
    ...(listing.neighborhoodDescription ? [{ heading: "Neighborhood", content: listing.neighborhoodDescription }] : []),
    ...(listing.gettingAround ? [{ heading: "Getting around", content: listing.gettingAround }] : []),
    ...(Array.isArray(listing.locationFeatures) && listing.locationFeatures.length > 0
      ? [{ heading: "Location features", content: listing.locationFeatures.map(humanize).join(" · ") }]
      : []),
    ...(Array.isArray(listing.views) && listing.views.length > 0
      ? [{ heading: "Views", content: listing.views.map(humanize).join(" · ") }]
      : []),
  ];
  const formatSafetyDisclosure = (entry: string): string | null => {
    const [key, status, ...detailParts] = entry.split(":");
    if (status === "NO") return null;
    const labels: Record<string, string> = {
      MUST_CLIMB_STAIRS: "Guests must climb stairs",
      POTENTIAL_FOR_NOISE: "Construction or other potential noise during stays",
      NEARBY_WATER: "Nearby water bodies",
      DANGEROUS_ANIMALS: "Potentially dangerous animals",
      SPECIAL_CONSIDERATIONS: "Other safety or regulatory notes",
    };
    const label = labels[key] ?? humanize(key);
    const details = detailParts.join(":").trim();
    return status === "YES" ? `${label}${details ? `: ${details}` : ""}` : humanize(entry);
  };
  const publicSafetyEquipment = Array.isArray(listing.safetyEquipment) ? listing.safetyEquipment : [];
  const publicSafetyHazards = Array.isArray(listing.safetyHazards)
    ? listing.safetyHazards.map(formatSafetyDisclosure).filter((item): item is string => Boolean(item))
    : [];
  const publicSafetyDisclosures = Array.isArray(listing.safetyDisclosures)
    ? listing.safetyDisclosures.map(formatSafetyDisclosure).filter((item): item is string => Boolean(item))
    : [];
  const cancellationLabel = listing.cancellationPolicy ? cancellationPolicyLabel(listing.cancellationPolicy) : null;
  const longTermCancellationLabel = listing.longTermCancellationPolicy ? cancellationPolicyLabel(listing.longTermCancellationPolicy) : null;
  const configuredHouseRules = Array.isArray(listing.houseRules)
    ? listing.houseRules.filter((rule): rule is string => typeof rule === "string" && rule.trim().length > 0)
    : [];
  const safetyItems = [
    ...publicSafetyEquipment.map(humanize),
    ...publicSafetyHazards,
    ...publicSafetyDisclosures,
  ];
  const houseRuleItems = [
    ...(formatTime(listing.checkInStart)
      ? [{ id: "check-in", icon: <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#1f1f1f]"><Image src="/images/icons/check-in-icon.svg" alt="" width={15} height={15} className="size-6" /></span>, text: `Check-in after ${formatTime(listing.checkInStart)}${formatTime(listing.checkInEnd) ? `, before ${formatTime(listing.checkInEnd)}` : ""}` }]
      : []),
    ...(formatTime(listing.checkOutTime)
      ? [{ id: "check-out", icon: <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#1f1f1f]"><Image src="/images/icons/check-in-icon.svg" alt="" width={15} height={15} className="size-6" /></span>, text: `Check-out before ${formatTime(listing.checkOutTime)}` }]
      : []),
    { id: "maximum-guests", icon: <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#1f1f1f]"><Image src="/images/icons/max-guest-icon.svg" alt="" width={15} height={15} className="size-6" /></span>, text: `${listing.guests || 1} guest maximum` },
    ...(listing.petsAllowed !== null ? [{ id: "pets", icon: <RuleIcon name="pets" />, text: listing.petsAllowed ? `Pets allowed${listing.maxPets ? ` · up to ${listing.maxPets}` : ""}` : "No pets" }] : []),
    ...(listing.smokingAllowed !== null ? [{ id: "smoking", icon: <RuleIcon name="smoking" />, text: listing.smokingAllowed ? `Smoking: ${listing.smokingLocation ? humanize(listing.smokingLocation) : "allowed"}` : "No smoking" }] : []),
    ...(listing.eventsAllowed !== null ? [{ id: "events", icon: <RuleIcon name="events" />, text: listing.eventsAllowed ? "Events allowed" : "No parties or events" }] : []),
    ...(listing.photographyAllowed !== null ? [{ id: "photography", icon: <RuleIcon name="photo" />, text: listing.photographyAllowed ? "Commercial photography allowed" : "No commercial photography" }] : []),
    ...(listing.quietHours && formatTime(listing.quietHoursStart) && formatTime(listing.quietHoursEnd)
      ? [{ id: "quiet-hours", icon: <RuleIcon name="quiet" />, text: `Quiet hours: ${formatTime(listing.quietHoursStart)}–${formatTime(listing.quietHoursEnd)}` }]
      : []),
    ...configuredHouseRules.map((text, index) => ({ id: `configured-${index}`, icon: <RuleCheckIcon />, text })),
    ...(listing.additionalRules ? [{ id: "additional", icon: <RuleIcon name="rule" />, text: listing.additionalRules }] : []),
  ];
  const cancellationItems = [
    ...(cancellationLabel ? [`${cancellationLabel}. Applies to stays under 28 nights.`] : []),
    ...(longTermCancellationLabel ? [`${longTermCancellationLabel}. Applies to stays of 28 nights or more.`] : []),
  ];
  const trustHighlights: Array<{ icon: TrustHighlightIconName; title: string; description: string }> = [
    ...(listing.isGuestFavorite
      ? [{ icon: "award" as const, title: "Guest favourite", description: "Highly rated by guests who have stayed here." }]
      : []),
    ...((Array.isArray(listing.highlights) ? listing.highlights : []).slice(0, 2).map((title) => ({
      icon: "sparkle" as const,
      title,
      description: "A highlight shared by this host.",
    }))),
    ...(cancellationLabel
      ? [{ icon: "calendar" as const, title: "Cancellation policy", description: cancellationLabel }]
      : []),
    ...(displayPrice
      ? [{ icon: "pricing" as const, title: "Clear pricing", description: "Your full price is shown before you reserve." }]
      : []),
  ].slice(0, 4);

  // Fetch quote when valid dates are selected
  useEffect(() => {
    if (!checkIn || !checkOut) {
      const timer = window.setTimeout(() => {
        setQuote(null);
        setQuoteError(null);
        setIsQuoteLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (totalCapacityGuests < 1 || totalCapacityGuests > maximumGuests) {
      const timer = window.setTimeout(() => {
        setQuote(null);
        setQuoteError(`This property accommodates up to ${maximumGuests} ${maximumGuests === 1 ? "guest" : "guests"}.`);
        setIsQuoteLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const cIn = new Date(`${checkIn}T00:00:00`);
    const cOut = new Date(`${checkOut}T00:00:00`);
    if (isNaN(cIn.getTime()) || isNaN(cOut.getTime()) || cOut <= cIn) {
      const timer = window.setTimeout(() => {
        setQuote(null);
        setQuoteError("Checkout must be after check-in");
        setIsQuoteLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    let isMounted = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // A quote always belongs to exactly one date/guest selection. Clear the
      // previous result before loading so Reserve cannot use a stale total.
      setQuote(null);
      setIsQuoteLoading(true);
      setQuoteError(null);

      fetch(
        `/api/v1/listings/${listing.id}/quote?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${totalCapacityGuests}&pets=${petsCount}&nonRefundable=${isNonRefundable}`,
        { signal: controller.signal, cache: "no-store" },
      )
        .then(async (res) => ({ ok: res.ok, data: await res.json() }))
        .then(({ ok, data }) => {
          if (!isMounted) return;
          if (!ok || data.error || !data.data) {
            setQuoteError(data.error?.message || "Selected dates are not available");
            return;
          }
          setQuote(data.data);
          setQuoteError(null);
          trackListingEvent({
            eventType: "quote_calculated",
            propertyId: listing.id,
            city: listing.city,
            country: listing.country,
            checkIn,
            checkOut,
            guestCount: totalCapacityGuests,
            metadata: {
              nights: data.data.nights,
              totalPrice: data.data.guestTotal ?? data.data.totalPrice,
              cleaningFee: data.data.cleaningFee,
              extraGuestFee: data.data.extraGuestFee,
              appliedDiscount: data.data.appliedDiscount?.name,
              nonRefundable: isNonRefundable,
            },
          });
        })
        .catch((error: unknown) => {
          if (!isMounted || (error instanceof DOMException && error.name === "AbortError")) return;
          setQuoteError("Unable to calculate price quotation.");
        })
        .finally(() => {
          if (isMounted) setIsQuoteLoading(false);
        });
    }, 0);

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [checkIn, checkOut, totalCapacityGuests, petsCount, isNonRefundable, listing.id, listing.city, listing.country, maximumGuests]);

  const isDateRangeValid = Boolean(
    isDateKey(checkIn) && isDateKey(checkOut) && checkOut > checkIn && !overlapsBookedRange(checkIn, checkOut, bookedDateRanges),
  );
  const isGuestSelectionValid = Number.isInteger(totalCapacityGuests) && totalCapacityGuests >= 1 && totalCapacityGuests <= maximumGuests;
  const hasValidQuote = Boolean(
    isDateRangeValid && isGuestSelectionValid && quote && !quoteError && !isQuoteLoading && !isAvailabilityLoading && !availabilityError,
  );

  const clearBookingDates = () => {
    setCheckIn("");
    setCheckOut("");
    setQuote(null);
    setQuoteError(null);
    trackListingEvent({
      eventType: "dates_cleared",
      propertyId: listing.id,
      city: listing.city,
      country: listing.country,
    });
  };

  const updateCheckIn = (nextCheckIn: string) => {
    if (!isDateKey(nextCheckIn) || nextCheckIn < today) {
      setQuoteError("Choose a future check-in date.");
      return;
    }
    if (isUnavailableDate(new Date(`${nextCheckIn}T00:00:00`), bookedDateRanges)) {
      setQuoteError("That check-in date is unavailable. Please choose another date.");
      trackListingEvent({
        eventType: "availability_conflict",
        propertyId: listing.id,
        metadata: { date: nextCheckIn, type: "checkIn_unavailable" },
      });
      return;
    }
    setQuote(null);
    setQuoteError(null);
    setCheckIn(nextCheckIn);
    trackListingEvent({
      eventType: "checkin_selected",
      propertyId: listing.id,
      city: listing.city,
      country: listing.country,
      checkIn: nextCheckIn,
    });
    const nextNights = checkOut && isDateKey(checkOut) ? calendarNights(nextCheckIn, checkOut) : 0;
    if (checkOut && (checkOut <= nextCheckIn || nextNights < minimumNights || nextNights > maximumNights || overlapsBookedRange(nextCheckIn, checkOut, bookedDateRanges))) {
      setCheckOut("");
      setQuoteError("Your previous checkout is no longer valid. Please choose another date.");
    }
  };

  const updateCheckOut = (nextCheckOut: string) => {
    if (!checkIn) {
      setQuoteError("Choose a check-in date before selecting checkout.");
      return;
    }
    if (!isDateKey(nextCheckOut) || nextCheckOut <= checkIn) {
      setQuoteError("Checkout must be after check-in.");
      return;
    }
    const nights = calendarNights(checkIn, nextCheckOut);
    if (nights < minimumNights) {
      setQuoteError(`This property requires a minimum stay of ${minimumNights} ${minimumNights === 1 ? "night" : "nights"}.`);
      trackListingEvent({
        eventType: "availability_conflict",
        propertyId: listing.id,
        metadata: { minimumNights, nightsRequested: nights },
      });
      return;
    }
    if (nights > maximumNights) {
      setQuoteError(`This property allows a maximum stay of ${maximumNights} ${maximumNights === 1 ? "night" : "nights"}.`);
      return;
    }
    if (overlapsBookedRange(checkIn, nextCheckOut, bookedDateRanges)) {
      setCheckOut("");
      setQuote(null);
      setQuoteError("Those dates include an unavailable night. Please choose different dates.");
      trackListingEvent({
        eventType: "availability_conflict",
        propertyId: listing.id,
        metadata: { checkIn, checkOut: nextCheckOut, type: "stay_overlaps_booked" },
      });
      return;
    }
    setQuote(null);
    setQuoteError(null);
    setCheckOut(nextCheckOut);
    trackListingEvent({
      eventType: "checkout_selected",
      propertyId: listing.id,
      city: listing.city,
      country: listing.country,
      checkIn,
      checkOut: nextCheckOut,
    });
  };

  const updateAdults = (delta: number) => {
    const next = adultsCount + delta;
    if (next < 1) return;
    if (delta > 0 && !canAddCapacityGuest) return;
    setQuote(null);
    setQuoteError(null);
    setAdultsCount(next);
    trackListingEvent({
      eventType: "guest_count_changed",
      propertyId: listing.id,
      guestCount: next + childrenCount,
      metadata: { category: "adults", adults: next, children: childrenCount, infants: infantsCount, pets: petsCount },
    });
  };

  const updateChildren = (delta: number) => {
    const next = childrenCount + delta;
    if (next < 0) return;
    if (delta > 0 && !canAddCapacityGuest) return;
    setQuote(null);
    setQuoteError(null);
    setChildrenCount(next);
    trackListingEvent({
      eventType: "guest_count_changed",
      propertyId: listing.id,
      guestCount: adultsCount + next,
      metadata: { category: "children", adults: adultsCount, children: next, infants: infantsCount, pets: petsCount },
    });
  };

  const updateInfants = (delta: number) => {
    const next = infantsCount + delta;
    if (next < 0 || next > 5) return;
    setInfantsCount(next);
    trackListingEvent({
      eventType: "guest_count_changed",
      propertyId: listing.id,
      guestCount: totalCapacityGuests,
      metadata: { category: "infants", adults: adultsCount, children: childrenCount, infants: next, pets: petsCount },
    });
  };

  const updatePets = (delta: number) => {
    const next = petsCount + delta;
    if (next < 0 || next > maxPetsAllowed) return;
    setQuote(null);
    setQuoteError(null);
    setPetsCount(next);
    trackListingEvent({
      eventType: "guest_count_changed",
      propertyId: listing.id,
      guestCount: totalCapacityGuests,
      metadata: { category: "pets", adults: adultsCount, children: childrenCount, infants: infantsCount, pets: next },
    });
  };

  const handleShare = async () => {
    trackListingEvent({
      eventType: "share_clicked",
      propertyId: listing.id,
      city: listing.city,
      country: listing.country,
    });

    const shareData = {
      title: listing.title,
      text: locationString ? `${listing.title} in ${locationString}` : listing.title,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
      }
    } catch {
      // Share cancellation and clipboard denials are intentionally silent.
    }
  };

  const handleSave = async () => {
    const nextSaved = !wishlist.has(listing.id);
    trackListingEvent({
      eventType: "wishlist_toggled",
      propertyId: listing.id,
      metadata: { saved: nextSaved },
    });
    if (wishlist.has(listing.id)) await wishlist.remove(listing.id);
    else await wishlist.add(listing.id);
  };

  // Handle Booking — validates all listing settings before redirecting to /book/[id]
  const handleReserve = () => {
    if (!checkIn || !checkOut) {
      setQuoteError("Please choose check-in and check-out dates to continue.");
      trackListingEvent({
        eventType: "reserve_validation_failed",
        propertyId: listing.id,
        metadata: { reason: "missing_dates" },
      });
      return;
    }

    if (!isDateKey(checkIn) || !isDateKey(checkOut)) {
      setQuoteError("Please enter valid check-in and check-out dates.");
      trackListingEvent({
        eventType: "reserve_validation_failed",
        propertyId: listing.id,
        metadata: { reason: "invalid_date_format" },
      });
      return;
    }

    if (checkIn < today) {
      setQuoteError("Check-in date cannot be in the past.");
      trackListingEvent({
        eventType: "reserve_validation_failed",
        propertyId: listing.id,
        metadata: { reason: "checkin_in_past" },
      });
      return;
    }

    if (checkOut <= checkIn) {
      setQuoteError("Checkout must be after check-in.");
      trackListingEvent({
        eventType: "reserve_validation_failed",
        propertyId: listing.id,
        metadata: { reason: "checkout_before_checkin" },
      });
      return;
    }

    const nights = calendarNights(checkIn, checkOut);
    if (nights < minimumNights) {
      setQuoteError(`This property requires a minimum stay of ${minimumNights} ${minimumNights === 1 ? "night" : "nights"}.`);
      trackListingEvent({
        eventType: "reserve_validation_failed",
        propertyId: listing.id,
        metadata: { reason: "minimum_nights_not_met", minimumNights, nights },
      });
      return;
    }

    if (nights > maximumNights) {
      setQuoteError(`This property allows a maximum stay of ${maximumNights} ${maximumNights === 1 ? "night" : "nights"}.`);
      trackListingEvent({
        eventType: "reserve_validation_failed",
        propertyId: listing.id,
        metadata: { reason: "maximum_nights_exceeded", maximumNights, nights },
      });
      return;
    }

    if (overlapsBookedRange(checkIn, checkOut, bookedDateRanges)) {
      setQuoteError("Those dates include an unavailable night. Please choose different dates.");
      trackListingEvent({
        eventType: "reserve_validation_failed",
        propertyId: listing.id,
        metadata: { reason: "dates_unavailable" },
      });
      return;
    }

    if (!isGuestSelectionValid || totalCapacityGuests > maximumGuests) {
      setQuoteError(`This property allows a maximum of ${maximumGuests} ${maximumGuests === 1 ? "guest" : "guests"}.`);
      trackListingEvent({
        eventType: "reserve_validation_failed",
        propertyId: listing.id,
        metadata: { reason: "max_guests_exceeded", totalCapacityGuests, maximumGuests },
      });
      return;
    }

    if (isQuoteLoading || isAvailabilityLoading) {
      return;
    }

    if (quoteError) {
      return;
    }

    if (!hasValidQuote || !quote) {
      setQuoteError("Unable to calculate price quotation for these dates. Please try another selection.");
      trackListingEvent({
        eventType: "reserve_validation_failed",
        propertyId: listing.id,
        metadata: { reason: "missing_valid_quote" },
      });
      return;
    }

    trackListingEvent({
      eventType: "reserve_clicked",
      propertyId: listing.id,
      city: listing.city,
      country: listing.country,
      checkIn,
      checkOut,
      guestCount: totalCapacityGuests,
      metadata: {
        adults: adultsCount,
        children: childrenCount,
        infants: infantsCount,
        pets: petsCount,
        isNonRefundable,
      },
    });

    trackListingEvent({
      eventType: "booking_flow_started",
      propertyId: listing.id,
      city: listing.city,
      country: listing.country,
      checkIn,
      checkOut,
      guestCount: totalCapacityGuests,
    });

    const queryParams = new URLSearchParams({
      checkIn,
      checkOut,
      guests: String(totalCapacityGuests),
      adults: String(adultsCount),
      children: String(childrenCount),
    });
    if (infantsCount > 0) queryParams.set("infants", String(infantsCount));
    if (petsCount > 0) queryParams.set("pets", String(petsCount));
    if (isNonRefundable) {
      queryParams.set("nonRefundable", "true");
    }

    router.push(`/book/${listing.customSlug || listing.id}?${queryParams.toString()}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />

      <main className="w-full flex-1 pb-13 pt-5 sm:pt-7">
        <Container>
          <div className="single-listing-page">
            {/* Header Section */}
            <div className="hidden items-start justify-between gap-4 pb-5 sm:pb-6 lg:flex">
              <div className="min-w-0 space-y-2">
                <h1>
                  {listing.title}
                </h1>
                {(listing.isGuestFavorite || listing.host?.isSuperhost || listing.isFeatured) && (
                  <div className="flex flex-wrap items-center gap-2" aria-label="Listing distinctions">
                    {listing.isGuestFavorite && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-950">
                        <span aria-hidden="true">✦</span> Guest favourite
                      </span>
                    )}
                    {listing.host?.isSuperhost && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-950">
                        <span aria-hidden="true">★</span> Superhost
                      </span>
                    )}
                    {listing.isFeatured && (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-2 text-xs font-medium text-[#1f1f1f]">
                        Featured stay
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 pt-0.5 sm:gap-8">
                <button type="button" onClick={handleShare} className="group inline-flex items-center gap-3 rounded-full text-base font-normal text-[#1f1f1f] transition-colors hover:text-[#727272]" aria-label="Share this listing">
                  <span className="flex size-10 items-center justify-center rounded-full border border-[#1f1f1f] bg-white transition-colors group-hover:border-zinc-500 group-hover:bg-zinc-50">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" className="size-6"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.6 6.8-4.1M8.6 13.4l6.8 4.1" /></svg>
                  </span>
                  <span className="hidden sm:inline">Share</span>
                </button>
                <button type="button" onClick={() => void handleSave()} disabled={wishlist.adding.has(listing.id) || wishlist.removeInFlight.has(listing.id)} className="group inline-flex items-center gap-3 rounded-full text-base font-normal text-[#1f1f1f] transition-colors hover:text-[#727272] disabled:opacity-50" aria-pressed={wishlist.has(listing.id)} aria-label={wishlist.has(listing.id) ? "Remove from wishlist" : "Save listing"}>
                  <span className={`flex size-10 items-center justify-center rounded-full border transition-colors ${wishlist.has(listing.id) ? "border-amber-300 bg-amber-50 text-amber-800" : "border-[#1f1f1f] bg-white group-hover:border-zinc-500 group-hover:bg-zinc-50"}`}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill={wishlist.has(listing.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.55" className="size-6"><path d="M12 20.5 3.8 12a5.2 5.2 0 0 1 7.4-7.3L12 5.5l.8-.8a5.2 5.2 0 0 1 7.4 7.3L12 20.5Z" /></svg>
                  </span>
                  <span className="hidden sm:inline">{wishlist.has(listing.id) ? "Saved" : "Save"}</span>
                </button>
              </div>
            </div>

            {/* Photo Gallery (ListingGallery component with Show all photos modal) */}
            <div className="listing-galelry">
              <ListingGallery key={listing.id} photos={photos} listingTitle={listing.title} onShare={handleShare} onSave={() => void handleSave()} isSaved={wishlist.has(listing.id)} saveDisabled={wishlist.adding.has(listing.id) || wishlist.removeInFlight.has(listing.id)} />
            </div>

            <h1 className="mb-4 text-[24px] font-medium leading-8 text-[#1f1f1f] lg:hidden">{listing.title}</h1>

            {/* Main Content Layout: Left Details (7 cols) + Right Booking Widget (5 cols) */}
            <div className="grid grid-cols-1 gap-9 lg:grid-cols-12 lg:gap-10">
              {/* LEFT COLUMN */}
              <div className="lg:col-span-7">
                <section className="pb-1">
                  <h2 className="text-[18px] font-normal leading-6 text-[#1f1f1f] lg:text-[20px] lg:leading-5">
                    {listing.listingType || "Stay"}{listing.propertyType ? ` in ${humanize(listing.propertyType)}` : ""}{locationString ? ` in ${locationString}` : ""}
                  </h2>
                  <p className="mt-1 text-sm font-light text-[#1F1F1F] lg:mt-2 lg:text-base">
                    {listing.guests || 1} {listing.guests === 1 ? "guest" : "guests"} · {listing.bedrooms || 1} {listing.bedrooms === 1 ? "bedroom" : "bedrooms"} · {listing.beds || 1} {listing.beds === 1 ? "bed" : "beds"} · {listing.bathrooms || 1} {listing.bathrooms === 1 ? "bath" : "baths"}
                  </p>
                </section>

                {listing.isGuestFavorite && reviewRating !== null && reviewCount > 0 && (
                  <section className="mt-7 hidden w-full max-w-[720px] overflow-hidden rounded-[40px] border border-[#dedede] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.16)] xl:grid xl:grid-cols-[1.1fr_1.75fr_.85fr_.62fr] xl:px-6" aria-label="Guest favourite rating summary">
                    <div className="flex min-w-0 items-center justify-center gap-2.5 border-b border-[#dedede] px-4 py-5 md:border-r xl:border-b-0">
                      <Image src="/images/icons/leaves-left.svg" alt="" width={39} height={71} aria-hidden="true" className="h-[71px] w-[39px] shrink-0" />
                      <span className="text-[17px] font-normal leading-5 text-[#1f1f1f] text-center">Guest<br />favourite</span>
                      <Image src="/images/icons/leaves-right.svg" alt="" width={39} height={71} aria-hidden="true" className="h-[71px] w-[39px] shrink-0" />
                    </div>
                    <p className="relative flex min-w-0 items-center border-b border-[#dedede] px-5 py-5 text-base font-normal leading-6 text-[#1f1f1f] xl:border-b-0 xl:after:absolute xl:after:right-0 xl:after:top-1/2 xl:after:h-[58px] xl:after:w-px xl:after:-translate-y-1/2 xl:after:bg-[#a9a9a9]">One of the most loved homes on Homyz, according to guests.</p>
                    <div className="relative flex items-center justify-center border-r border-[#dedede] px-4 py-5 xl:border-r-0 xl:after:absolute xl:after:right-0 xl:after:top-1/2 xl:after:h-[58px] xl:after:w-px xl:after:-translate-y-1/2 xl:after:bg-[#a9a9a9]">
                      <div>
                        <p className="text-[26px] font-medium leading-none text-[#1f1f1f]">{reviewRating.toFixed(2)}</p>
                        <p className="mt-2 text-[15px] leading-none tracking-[0.1em] text-[#e9a400]" aria-label={`${reviewRating.toFixed(2)} out of 5 stars`}>★★★★★</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center px-3 py-5">
                      <p className="text-left text-[26px] font-medium leading-5 text-[#1f1f1f]">{reviewCount}<br /><span className="text-[15px] font-normal leading-5 text-[#1f1f1f]">{reviewCount === 1 ? "Review" : "Reviews"}</span></p>
                    </div>
                  </section>
                )}

                {listing.isGuestFavorite && reviewRating !== null && reviewCount > 0 && (
                  <section className="mt-4 space-y-2 xl:hidden" aria-label="Guest favourite rating summary">
                    <div className="rounded-[12px] border border-[#dedede] bg-white px-5 py-4 text-center shadow-[0_2px_4px_rgba(0,0,0,0.16)]">
                      <div className="flex items-center justify-center gap-3">
                        <Image src="/images/icons/leaves-left.svg" alt="" width={32} height={48} className="h-12 w-8" />
                        <span className="text-base leading-5 text-[#1f1f1f]">Guest<br />bestie</span>
                        <Image src="/images/icons/leaves-right.svg" alt="" width={32} height={48} className="h-12 w-8" />
                      </div>
                      <p className="mt-3 text-sm leading-5 text-[#1f1f1f]">One of the most loved homes on Homyz, according to guests</p>
                    </div>
                    <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-[#dedede] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.16)]">
                      <div className="px-5 py-4 text-center"><p className="text-2xl font-medium leading-none">{reviewRating.toFixed(2)}</p><p className="mt-2 text-sm tracking-[0.08em] text-[#e9a400]">★★★★★</p></div>
                      <div className="border-l border-[#a9a9a9] px-5 py-4 text-center"><p className="text-2xl font-medium leading-none">{reviewCount}</p><p className="mt-2 text-sm text-[#1f1f1f]">{reviewCount === 1 ? "Review" : "Reviews"}</p></div>
                    </div>
                    <a href={`mailto:support@homyz.com?subject=${encodeURIComponent(`Report listing: ${listing.title}`)}`} className="flex items-center justify-center gap-3 py-2 text-sm text-[#1f1f1f] underline underline-offset-2">
                      <span className="flex size-9 items-center justify-center rounded-full border border-[#1F1F1F]"><Image src="/images/icons/report-icon.svg" alt="" width={16} height={16} className="size-4" /></span>
                      Report this listing
                    </a>
                  </section>
                )}

                {/* Property Summary & Host */}
                <section className="mt-7 flex items-center gap-4 border-b border-[#DDDDDE] pb-7.5 lg:mt-12 lg:gap-6">
                  <div className="min-w-0 space-y-2">
                    <h2 className="sm:text-xl text-base font-normal text-[#1f1f1f]">
                      {hostProfileHref ? (
                        <Link
                          href={hostProfileHref}
                          onClick={() => {
                            trackListingEvent({
                              eventType: "host_profile_clicked",
                              propertyId: listing.id,
                              metadata: { hostId: listing.host?.id, source: "summary_title" },
                            });
                          }}
                          className="hover:underline underline-offset-2"
                        >
                          Hosted by {listing.host?.name || "Homyz host"}
                        </Link>
                      ) : (
                        `Hosted by ${listing.host?.name || "Homyz host"}`
                      )}
                    </h2>
                    <p className="sm:text-base text-sm font-light text-[#1F1F1F]">{listing.host?.isSuperhost ? "Superhost" : "Homyz host"}{hostSince ? ` · Hosting since ${hostSince}` : ""}</p>
                  </div>
                  {hostProfileHref ? (
                    <Link
                      href={hostProfileHref}
                      aria-label={`View ${listing.host?.name || "host"}'s profile`}
                      onClick={() => {
                        trackListingEvent({
                          eventType: "host_profile_clicked",
                          propertyId: listing.id,
                          metadata: { hostId: listing.host?.id, source: "summary_avatar" },
                        });
                      }}
                      className="order-first block rounded-full transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1f1f] shrink-0"
                    >
                      {listing.host?.image && !hostImageFailed ? (
                        <img
                          src={listing.host.image}
                          alt={listing.host.name || "Host"}
                          onError={() => setHostImageFailed(true)}
                      className="order-first size-[76px] shrink-0 rounded-full border border-zinc-200 object-cover lg:size-[104px]"
                        />
                      ) : (
                        <div className="order-first flex size-[76px] shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-100 text-lg font-normal text-amber-900 lg:size-14">
                          {(listing.host?.name || "H")[0].toUpperCase()}
                        </div>
                      )}
                    </Link>
                  ) : (
                    listing.host?.image && !hostImageFailed ? (
                      <img
                        src={listing.host.image}
                        alt={listing.host.name || "Host"}
                        onError={() => setHostImageFailed(true)}
                        className="order-first size-[76px] shrink-0 rounded-full border border-zinc-200 object-cover lg:size-[104px]"
                      />
                    ) : (
                      <div className="order-first flex size-[76px] shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-100 text-lg font-normal text-amber-900 lg:size-14">
                        {(listing.host?.name || "H")[0].toUpperCase()}
                      </div>
                    )
                  )}
                </section>

                {/* Highlights (if any) */}
                {trustHighlights.length > 0 && (
                  <section className="mt-7.5 space-y-3.5 border-b border-zinc-200/80 pb-6" aria-label="Property highlights">
                    {trustHighlights.map((highlight) => (
                      <div key={highlight.title} className="flex items-start gap-6">
                        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] p-1.5 text-[#1F1F1F]"><TrustHighlightIcon name={highlight.icon} /></span>
                        <div><h3 className="text-base font-normal text-[#222222]">{highlight.title}</h3><p className="mt-0.5 text-sm font-normal text-[#6A6A6A]">{highlight.description}</p></div>
                      </div>
                    ))}
                  </section>
                )}

                {/* Description */}
                {normalizedDescription && (
                  <section className="mt-6 border-b border-zinc-200/80 pb-7.5">
                    <h3 className="text-[20px] font-normal text-[#1f1f1f]">About this place</h3>
                    <p
                      className={`mt-2.5 whitespace-pre-line break-words text-base font-normal text-[#727272] ${isDescriptionExpanded ? "" : "line-clamp-4"
                        }`}
                    >
                      {normalizedDescription}
                    </p>
                    {isDescriptionExpanded && aboutLocationDetails.length > 0 && (
                      <div className="mt-4 space-y-4 pt-4 border-t border-zinc-100">
                        {aboutLocationDetails.map((detail) => (
                          <div key={detail.heading}>
                            <h4 className="text-[20px] font-normal text-[#1f1f1f]">{detail.heading}</h4>
                            <p className="mt-2.5 whitespace-pre-line text-base font-normal leading-6 text-[#727272]">{detail.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {(normalizedDescription.length > 200 || aboutLocationDetails.length > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isDescriptionExpanded;
                          setIsDescriptionExpanded(next);
                          trackListingEvent({
                            eventType: next ? "description_expanded" : "description_collapsed",
                            propertyId: listing.id,
                          });
                        }}
                        className="mt-8 rounded-full border border-[#1F1F1F] bg-[#F3F4F5] hover:bg-[#1f1f1f] sm:px-7 px-4 sm:py-3.25 py-2 sm:text-lg text-base font-medium text-[#1F1F1F] hover:text-white transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1f1f]"
                      >
                        {isDescriptionExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </section>
                )}

                {/* Amenities Grid */}
                <div className="mt-7.5 order-1 space-y-5 border-b border-zinc-200/80 pb-7.5">
                  <h3 className="text-[20px] font-normal text-[#1f1f1f]">What this place offers</h3>
                  {categorizedAmenities.length === 0 ? (
                    <p className="text-xs text-zinc-500">This host has not listed any amenities yet.</p>
                  ) : <>
                    <div className="grid grid-cols-1 gap-x-12 gap-y-2.5 text-[#1f1f1f] sm:grid-cols-2">
                      {categorizedAmenities.slice(0, 6).map((am) => (
                        <div key={am.id} className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#1f1f1f]/65">
                            {AMENITY_ICON_SOURCES[am.id] ? (
                              <Image src={AMENITY_ICON_SOURCES[am.id]} alt="" width={18} height={18} className="size-[18px]" />
                            ) : (
                              <span aria-hidden="true" className="text-sm leading-none">{am.icon || "✓"}</span>
                            )}
                          </span>
                          <span className="break-words text-base font-normal leading-5">{am.label}</span>
                        </div>
                      ))}
                    </div>

                    {categorizedAmenities.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAllAmenitiesOpen(true);
                          trackListingEvent({
                            eventType: "amenities_opened",
                            propertyId: listing.id,
                            metadata: { totalAmenities: categorizedAmenities.length },
                          });
                        }}
                          className="mt-3 rounded-full border border-[#1F1F1F] bg-[#F3F4F5] hover:bg-[#1f1f1f] px-7 sm:py-3.25 py-2 sm:text-lg text-base font-medium text-[#1F1F1F] hover:text-white transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1f1f]"
                      >
                        Show all amenities
                      </button>
                    )}
                  </>}
                </div>

                {/* Calendar Section Ref */}
                <div ref={calendarSectionRef} className="order-2 mt-7.5">
                  <ListingAvailabilityCalendar
                    month={availabilityMonth}
                    onMonthChange={setAvailabilityMonth}
                    ranges={bookedDateRanges}
                    isLoading={isAvailabilityLoading}
                    error={availabilityError}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    locationName={listing.city || listing.title || "this property"}
                    minimumNights={minimumNights}
                    maximumNights={maximumNights}
                    onDateRangeChange={(nextCheckIn, nextCheckOut) => {
                      if (nextCheckIn && !nextCheckOut) {
                        updateCheckIn(nextCheckIn);
                      } else if (nextCheckIn && nextCheckOut) {
                        setCheckIn(nextCheckIn);
                        updateCheckOut(nextCheckOut);
                      }
                    }}
                    onClearDates={clearBookingDates}
                    onErrorMessage={setQuoteError}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: BOOKING & PRICING PANEL */}
              <div className="hidden lg:col-span-5 lg:block">
                <div ref={bookingPanelRef} className={`space-y-6 ${isBookingPanelSticky ? "lg:sticky lg:top-24" : "lg:relative"}`}>
                  <div className="flex min-h-[72px] items-center justify-center gap-4 rounded-[30px] bg-[rgba(255,255,255,0.6)] px-4 py-3 text-base text-[#1F1F1F] shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)]">
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F]">
                      <Image src="/images/icons/price-icon.svg" alt="" width={24} height={24} className="size-6" />
                    </span>
                    Prices include all fees
                  </div>
                  <div className="space-y-4 rounded-[30px] border border-zinc-300 bg-[rgba(255,255,255,0.6)] p-6 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)] sm:p-5">
                    {bookingSuccess ? (
                      <div className="py-8 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold">
                          ✓
                        </div>
                        <h3 className="text-[20px] font-normal text-[#1f1f1f]">{listing.instantBook ? "Reservation confirmed" : "Reservation request submitted"}</h3>
                        <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                          Your stay has been recorded. You can manage your bookings in your trips dashboard.
                        </p>
                        <div className="pt-2">
                          <Link
                            href="/profile/tab/upcoming"
                            className="rounded-full bg-[#1f1f1f] text-white font-semibold text-xs px-6 py-2.5 inline-block"
                          >
                            View your bookings
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
                          <div>
                            <span className="text-[20px] font-medium text-[#1F1F1F] underline underline-offset-4">{displayPrice ?? "Price unavailable"}</span>
                            <span className="text-base text-[#1F1F1F] font-normal"> / night</span>
                          </div>
                          <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold">
                            {listing.instantBook ? "Instant Book" : "Host approval required"}
                          </span>
                        </div>

                        {/* Date Pickers */}
                        <div className={`rounded-[10px] border overflow-hidden divide-y divide-zinc-200 bg-[#F3F4F5] text-sm transition-colors ${quoteError && (!checkIn || !checkOut) ? "border-rose-400 ring-2 ring-rose-100" : "border-zinc-300"
                          }`}>
                          <div className="grid grid-cols-2 divide-x divide-zinc-200">
                            <div className="p-3 space-y-1">
                              <label className="block text-base font-normal text-[#1f1f1f]">
                                Check-in
                              </label>
                              <input
                                type="date"
                                value={checkIn}
                                min={today}
                                onFocus={() => setAvailabilityRequested(true)}
                                onChange={(e) => updateCheckIn(e.target.value)}
                                className="w-full bg-transparent outline-none font-normal text-[#727272] text-sm cursor-pointer"
                              />
                            </div>
                            <div className="p-3 space-y-1">
                              <label className="block text-base font-normal text-[#1f1f1f]">
                                Check-out
                              </label>
                              <input
                                type="date"
                                value={checkOut}
                                min={minimumCheckOut}
                                disabled={!checkIn}
                                onFocus={() => setAvailabilityRequested(true)}
                                onChange={(e) => updateCheckOut(e.target.value)}
                                className="w-full bg-transparent outline-none font-normal text-[#727272] text-sm cursor-pointer"
                              />
                            </div>
                          </div>

                          <div className="p-3 space-y-1">
                            <label className="block text-base font-normal text-[#1f1f1f]">
                              Guests
                            </label>
                            <button
                              type="button"
                              aria-expanded={isGuestSelectorOpen}
                              aria-controls="guest-selector"
                              onClick={() => {
                                const nextOpen = !isGuestSelectorOpen;
                                setIsGuestSelectorOpen(nextOpen);
                                if (nextOpen) {
                                  trackListingEvent({
                                    eventType: "guest_selector_opened",
                                    propertyId: listing.id,
                                    guestCount: totalCapacityGuests,
                                  });
                                }
                              }}
                              className="flex w-full items-center justify-between text-left text-sm font-normal text-[#727272]"
                            >
                              <span>{guestSummaryLabel}</span>
                              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`size-4 transition-transform ${isGuestSelectorOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
                            </button>
                            {isGuestSelectorOpen && (
                              <div id="guest-selector" className="mt-3 space-y-3.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm" aria-label="Guest selection">
                                {/* Adults */}
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-[#1f1f1f]">Adults</p>
                                    <p className="text-xs text-[#727272]">Age 13+</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => updateAdults(-1)} disabled={adultsCount <= 1} aria-label="Remove one adult" className="flex size-7 items-center justify-center rounded-full border border-[#1f1f1f] text-base leading-none hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">−</button>
                                    <span className="min-w-4 text-center font-semibold text-[#1f1f1f]" aria-live="polite">{adultsCount}</span>
                                    <button type="button" onClick={() => updateAdults(1)} disabled={!canAddCapacityGuest} aria-label="Add one adult" className="flex size-7 items-center justify-center rounded-full border border-[#1f1f1f] text-base leading-none hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">+</button>
                                  </div>
                                </div>

                                {/* Children */}
                                <div className="flex items-center justify-between gap-3 border-t border-zinc-200/80 pt-3">
                                  <div>
                                    <p className="font-medium text-[#1f1f1f]">Children</p>
                                    <p className="text-xs text-[#727272]">Ages 2–12</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => updateChildren(-1)} disabled={childrenCount <= 0} aria-label="Remove one child" className="flex size-7 items-center justify-center rounded-full border border-[#1f1f1f] text-base leading-none hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">−</button>
                                    <span className="min-w-4 text-center font-semibold text-[#1f1f1f]" aria-live="polite">{childrenCount}</span>
                                    <button type="button" onClick={() => updateChildren(1)} disabled={!canAddCapacityGuest} aria-label="Add one child" className="flex size-7 items-center justify-center rounded-full border border-[#1f1f1f] text-base leading-none hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">+</button>
                                  </div>
                                </div>



                                <div className="border-t border-zinc-200/80 pt-2 text-sm text-zinc-500">
                                  {totalCapacityGuests >= maximumGuests ? (
                                    <p className="font-sm font-medium text-amber-700">Maximum property capacity of {maximumGuests} {maximumGuests === 1 ? "guest" : "guests"} reached.</p>
                                  ) : (
                                    <p>This property accommodates up to {maximumGuests} {maximumGuests === 1 ? "guest" : "guests"}.</p>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setIsGuestSelectorOpen(false)}
                                  className="w-full shrink-0 whitespace-nowrap rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] px-6 py-3 text-base font-medium text-[#1F1F1F] hover:text-white transition-colors inline-flex justify-center border border-transparent hover:border-[#1F1F1F]"
                                >
                                  Done
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-sm leading-relaxed text-[#727272]" aria-live="polite">
                          {isAvailabilityLoading
                            ? "Checking availability…"
                            : bookedDateRanges.length > 0
                              ? "Unavailable dates cannot be reserved."
                              : "Availability is confirmed before you reserve."}
                        </p>

                        {listing.bookingMessage && <p className="rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-[#727272] whitespace-pre-wrap">{listing.bookingMessage}</p>}

                        {quote?.nonRefundableAvailable && !isQuoteLoading && (
                          <fieldset className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs">
                            <legend className="px-1 font-semibold text-[#1f1f1f]">Choose your reservation</legend>
                            <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${!isNonRefundable ? "border-[#1f1f1f] bg-white" : "border-transparent"}`}>
                              <input type="radio" name="reservation-type" checked={!isNonRefundable} onChange={() => setIsNonRefundable(false)} className="mt-0.5" />
                              <span><span className="block font-semibold text-[#1f1f1f]">Standard booking</span><span className="text-[#727272]">Uses this listing&apos;s normal cancellation policy.</span></span>
                            </label>
                            <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${isNonRefundable ? "border-amber-500 bg-amber-50" : "border-transparent"}`}>
                              <input type="radio" name="reservation-type" checked={isNonRefundable} onChange={() => setIsNonRefundable(true)} className="mt-0.5" />
                              <span><span className="block font-semibold text-[#1f1f1f]">Non-refundable booking</span><span className="text-[#727272]">Discounted price. If you cancel, you cannot receive the normal cancellation refund and the host retains the booked payout.</span></span>
                            </label>
                          </fieldset>
                        )}

                        {/* Live Quote Breakdown */}
                        {isQuoteLoading && (
                          <div className="py-4 text-center text-xs text-zinc-400 animate-pulse font-medium">
                            Calculating price breakdown...
                          </div>
                        )}

                        {quoteError && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2 animate-in fade-in">
                            <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="flex-1">{quoteError}</span>
                          </div>
                        )}

                        {quote && !isQuoteLoading && (
                          <div className="space-y-2.5 pt-2 border-t border-zinc-100 text-xs">
                            <div className="flex items-center justify-between text-[#727272]">
                              <span>
                                {formatPrice(quote.baseNightlyPrice, listing.currency ?? getCurrencyForCountry(listing.country))} × {quote.nights} {" "}
                                {quote.nights === 1 ? "night" : "nights"}
                              </span>
                              <span>{formatPrice(quote.nightlySubtotal, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                            </div>

                            {quote.customPricedNights !== undefined && quote.customPricedNights > 0 && (
                              <div className="flex items-center justify-between text-amber-700 text-[11px] font-medium bg-amber-50 px-2 py-0.5 rounded">
                                <span>Includes {quote.customPricedNights} custom calendar rate {quote.customPricedNights === 1 ? "night" : "nights"}</span>
                              </div>
                            )}

                            {quote.weekendNights > 0 && quote.weekendNightlyPrice && (
                              <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                                <span>Includes {quote.weekendNights} weekend nights</span>
                                <span>{formatPrice(quote.weekendNightlyPrice, currencyCode)} / night</span>
                              </div>
                            )}

                            {quote.cleaningFee > 0 && (
                              <div className="flex items-center justify-between text-[#727272]">
                                <span>Cleaning fee</span>
                                <span>{formatPrice(quote.cleaningFee, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                              </div>
                            )}

                            {quote.extraGuestFee !== undefined && quote.extraGuestFee > 0 && (
                              <div className="flex items-center justify-between text-[#727272]">
                                <span>Extra guest fee</span>
                                <span>{formatPrice(quote.extraGuestFee, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                              </div>
                            )}

                            {quote.appliedDiscount && (
                              <div className="flex items-center justify-between text-emerald-700 font-medium">
                                <span>{quote.appliedDiscount.name}</span>
                                <span>−{formatPrice(quote.appliedDiscount.amount, currencyCode)}</span>
                              </div>
                            )}

                            {quote.nonRefundableDiscount && (
                              <div className="flex items-center justify-between text-emerald-700 font-medium">
                                <span>{quote.nonRefundableDiscount.name} ({quote.nonRefundableDiscount.percentage}%)</span>
                                <span>−{formatPrice(quote.nonRefundableDiscount.amount, currencyCode)}</span>
                              </div>
                            )}

                            {quote.taxes && quote.taxes.length > 0 ? (
                              <>
                                <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                                  <div className="flex items-center justify-between text-[#727272]">
                                    <span className="flex items-center gap-1.5 font-medium">
                                      Taxes & fees
                                      {quote.taxes.some((tax) => tax.isExempt) && (
                                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-full font-semibold">
                                          Exemption applied
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-medium">{formatPrice(quote.taxTotal || 0, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                                  </div>
                                  <div className="pl-2.5 space-y-1 border-l-2 border-amber-300 text-base font-light text-[#1F1F1F]">
                                    {quote.taxes.map((tax, idx) => (
                                      <div key={idx} className="flex items-center justify-between">
                                        <span>
                                          {tax.taxName}
                                          {tax.rate ? ` (${tax.rate}%)` : ""}
                                          {tax.isExempt ? ` • ${tax.exemptionReason || "Exempt"}` : ""}
                                        </span>
                                        <span>{tax.isExempt ? formatPrice(0, listing.currency ?? getCurrencyForCountry(listing.country)) : formatPrice(tax.taxAmount, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-sm font-bold text-[#1f1f1f]">
                                  <span>Total</span>
                                  <span>{formatPrice((quote.guestTotal ?? quote.totalPrice) || 0, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                                </div>
                              </>
                            ) : (
                              <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-sm font-bold text-[#1f1f1f]">
                                <span>Total</span>
                                <span>{formatPrice((quote.guestTotal ?? quote.totalPrice) || 0, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reserve CTA */}
                        <button
                          type="button"
                          disabled={isBookingSubmitting}
                          onClick={handleReserve}
                          className={`w-full rounded-full py-3.5 text-lg font-medium transition-all shadow-xs ${hasValidQuote && !isBookingSubmitting
                            ? "border border-amber-400 bg-[#fee09a] text-[#1f1f1f] hover:bg-[#fbd775] cursor-pointer active:scale-[0.99]"
                            : "border border-zinc-200 bg-zinc-100 text-zinc-400 hover:border-zinc-300 hover:text-[#727272] cursor-pointer"
                            }`}
                          aria-disabled={!hasValidQuote || isBookingSubmitting}
                        >
                          {isBookingSubmitting
                            ? "Confirming..."
                            : isQuoteLoading
                              ? "Checking availability..."
                              : listing.instantBook
                                ? "Reserve now"
                                : "Request to book"}
                        </button>

                        <p className="text-[11px] text-zinc-400 text-center font-normal">
                          {"You won't be charged yet. Taxes and additional charges may be calculated at checkout."}
                        </p>
                      </>
                    )}
                  </div>
                  <a href={`mailto:support@homyz.com?subject=${encodeURIComponent(`Report listing: ${listing.title}`)}`} className="mx-auto flex items-center justify-center gap-4 text-base text-[#1f1f1f] underline underline-offset-2 hover:text-[#727272] group">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] no-underline group-hover:border-[#727272]">
                      <Image src="/images/icons/report-icon.svg" alt="" width={18} height={18} className="size-4.5" />
                    </span>
                    Report this listing
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-7.5 flex flex-col w-full sm:space-y-12 space-y-8">

              {listing.host && (
                <section className="sm:pt-12 pt-7.5 sm:pb-12 pb-7.5 order-5 border-y border-zinc-200/80 lg:relative lg:z-10 lg:w-[calc(100vw-3rem)] lg:max-w-[1262px] mx-auto  lg:bg-white" aria-labelledby="meet-host-heading">
                  <h3 id="meet-host-heading" className="mb-6 text-[20px] font-normal text-[#1f1f1f]">Meet your host</h3>
                  <div className="grid gap-8 md:grid-cols-[376px_minmax(0,1fr)] md:gap-16">
                    <div>
                      {hostProfileHref ? (
                        <Link
                          href={hostProfileHref}
                          aria-label={`View ${listing.host.name || "host"}'s profile`}
                          onClick={() => {
                            trackListingEvent({
                              eventType: "host_profile_clicked",
                              propertyId: listing.id,
                              metadata: { hostId: listing.host?.id },
                            });
                          }}
                          className="block rounded-[25px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1f1f1f]"
                        >
                          <HostIdentityCard host={listing.host} imageFailed={hostImageFailed} onImageError={() => setHostImageFailed(true)} hostTenure={hostTenure} reviewRating={reviewRating} reviewCount={reviewCount} />
                        </Link>
                      ) : (
                        <HostIdentityCard host={listing.host} imageFailed={hostImageFailed} onImageError={() => setHostImageFailed(true)} hostTenure={hostTenure} reviewRating={reviewRating} reviewCount={reviewCount} />
                      )}

                      {(hostWork || hostLanguages.length > 0) && <div className="mt-7 space-y-4 text-base text-[#1f1f1f]">
                        {hostWork && <p className="flex items-center gap-5"><span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[#1f1f1f]"><Image src="/images/icons/job-search.svg" alt="" width={24} height={24} className="size-6" /></span><span>My work: {hostWork}</span></p>}
                        {hostLanguages.length > 0 && <p className="flex items-center gap-5"><span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[#1f1f1f]"><Image src="/images/icons/translate-icon.svg" alt="" width={24} height={24} className="size-6" /></span><span>Speaks {hostLanguages.join(", ")}</span></p>}
                      </div>}
                    </div>

                    <div className="min-w-0 pt-1">
                      <h4 className="text-[20px] font-normal text-[#1f1f1f]">{listing.host.isSuperhost ? `${listing.host.name || "This host"} is a superhost` : `Hosted by ${listing.host.name || "Homyz host"}`}</h4>
                      {listing.host.isSuperhost && <p className="mt-2 max-w-2xl text-base leading-6 text-[#727272]">Superhosts are experienced, highly rated hosts who are committed to providing great stays for guests.</p>}
                      {hostBio && <p className="mt-2 max-w-2xl line-clamp-3 whitespace-pre-line text-base leading-6 text-[#727272] font-normal">{hostBio}</p>}

                      {(hostSince || listing.host.isSuperhost) && <div className="mt-8 space-y-2">
                        <h5 className="text-[20px] font-normal text-[#1f1f1f]">Host details</h5>
                        {hostSince && <p className="text-base text-[#727272]">Joined Homyz in {hostSince}</p>}
                        {listing.host.isSuperhost && <p className="flex items-center gap-1.5 text-base text-[#727272]"><span aria-hidden="true">★</span> Superhost</p>}
                      </div>}

                      {hostProfileHref && (
                        <Link
                          href={hostProfileHref}
                          onClick={() => {
                            trackListingEvent({
                              eventType: "host_profile_clicked",
                              propertyId: listing.id,
                              metadata: { hostId: listing.host?.id },
                            });
                          }}
                          className="mt-7 inline-flex min-h-14 items-center gap-2 rounded-full border border-[#1f1f1f] bg-[#F3F4F5] px-5 text-base font-normal text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1f1f] group transition-colors"
                        >
                          <Image src="/images/icons/messages.svg" alt="messages.svg" width={18} height={18} className="size-6 group-hover:brightness-0 group-hover:invert transition-all duration-300" />
                          View host profile
                        </Link>
                      )}
                      <p className="mt-7 max-w-3xl text-sm leading-5 text-[#727272]">To help protect your payment, always use Homyz to send money and communicate with hosts.</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Guest Reviews Section */}
              <div ref={reviewSectionRef} className="order-3 lg:relative lg:bg-white border-t border-[#DDDDDE]">
                <ReviewList
                  listingId={listing.id}
                  isGuestFavorite={listing.isGuestFavorite}
                  onStatsChange={({ rating, count }) => {
                    setReviewRating(rating);
                    setReviewCount(count);
                  }}
                />
              </div>

              {/* House Rules */}
              <section className="order-6 md:pb-12 lg:relative lg:z-10 lg:w-[calc(100vw-3rem)] lg:max-w-[1262px] mx-auto lg:bg-white" aria-labelledby="things-to-know-heading">
                <h3 id="things-to-know-heading" className="mb-7 text-[20px] font-normal text-[#1f1f1f]">Things to know</h3>
                <div className="grid sm:gap-8 gap-4 md:grid-cols-[1fr_1fr_1.25fr]">
                  <div className="order-1 flex min-h-[294px] flex-col sm:rounded-[30px] rounded-[10px] border border-[#dedede] bg-white/60 sm:p-7 py-8 px-5 shadow-[2px_0px_4px_rgba(0,0,0,0.25),0px_2px_4px_rgba(0,0,0,0.25)]" aria-labelledby="house-rules-heading">
                    <h4 id="house-rules-heading" className="sm:text-[20px] text-lg font-normal text-[#1f1f1f]">House rules</h4>
                    <div className="shrink-0 mt-5 space-y-4 text-base text-[#1f1f1f]">
                      {(expandedThingsCards.rules ? houseRuleItems : houseRuleItems.slice(0, 4)).map((item) => (
                        <div key={item.id} className="shrink-0 flex items-center gap-3">
                          {item.icon}
                          <span className="whitespace-pre-line break-words">{item.text}</span>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => toggleThingsCard("rules")} aria-expanded={expandedThingsCards.rules} className="mt-auto pt-6 text-left text-base text-[#727272] underline underline-offset-2">{expandedThingsCards.rules ? "Show less" : "Show more"}</button>
                  </div>

                  {(cancellationLabel || longTermCancellationLabel) && <div className="order-3 flex min-h-[294px] flex-col sm:rounded-[30px] rounded-[10px] border border-[#dedede] bg-white py-8 px-5 shadow-[0_2px_5px_rgba(0,0,0,0.14)]" aria-labelledby="cancellation-heading">
                    <h4 id="cancellation-heading" className="sm:text-[20px] text-lg font-normal text-[#1f1f1f]">Cancellation policy</h4>
                    <div className="mt-4 space-y-4">
                      {(expandedThingsCards.cancellation ? cancellationItems : cancellationItems.slice(0, 4)).map((item, index) => (
                        <p key={`${item}-${index}`} className="text-base leading-6 text-[#1f1f1f]">{item}</p>
                      ))}
                    </div>
                    <button type="button" onClick={() => toggleThingsCard("cancellation")} aria-expanded={expandedThingsCards.cancellation} className="mt-auto pt-6 text-left text-base text-[#727272] underline underline-offset-2">{expandedThingsCards.cancellation ? "Show less" : "Show more"}</button>
                  </div>}

                  {/* Safety Disclosures */}
                  <div className="order-2 flex min-h-[294px] flex-col sm:rounded-[30px] rounded-[10px] border border-[#dedede] bg-white py-8 px-5 shadow-[0_2px_5px_rgba(0,0,0,0.14)]">
                    <h4 className="sm:text-[20px] text-lg font-normal text-[#1f1f1f]">Safety & property</h4>
                    <div className="mt-5 space-y-4 text-base text-[#1f1f1f]">
                      {(expandedThingsCards.safety ? safetyItems : safetyItems.slice(0, 4)).map((item, index) => (
                        <p key={`${item}-${index}`}>{item}</p>
                      ))}
                      {safetyItems.length === 0 && <p>No safety equipment or property hazards have been reported.</p>}
                    </div>
                    <button type="button" onClick={() => toggleThingsCard("safety")} aria-expanded={expandedThingsCards.safety} className="mt-auto pt-6 text-left text-base text-[#727272] underline underline-offset-2">{expandedThingsCards.safety ? "Show less" : "Show more"}</button>
                  </div>
                </div>
              </section>

              {/* Location & Map Section */}
              <div className="order-4 space-y-3 sm:pb-12 pb-8 lg:relative lg:z-10 w-full lg:w-[calc(100vw-3rem)] lg:max-w-[1262px] mx-auto lg:bg-white">
                <h3 className="text-[20px] font-normal text-[#1f1f1f]">{"Where you'll be"}</h3>
                <p className="mt-1 text-sm text-[#727272] font-normal">
                  {locationString || "Location details are not available for this listing."}
                  {!listing.showExactLocation && " · Approximate location provided to protect host privacy"}
                </p>
                {publicCoordinates ? (
                  <div className="h-[163px] w-full overflow-hidden sm:rounded-[30px] rounded-[10px] border border-zinc-200 shadow-sm sm:h-[604px] bg-[#F1F1F199]">
                    <RealMap
                      address={listing.shortAddress || listing.address || ""}
                      city={listing.city || undefined}
                      country={listing.country || undefined}
                      lat={publicCoordinates.latitude}
                      lng={publicCoordinates.longitude}
                      showExactLocation={listing.showExactLocation ?? false}
                      preferInitialCoordinates
                      allowLocationEditing={false}
                      lazyLoad
                      className="relative h-full w-full overflow-hidden"
                      ariaLabel={`${listing.showExactLocation ? "Property" : "Approximate property"} location map for ${locationString || listing.title}`}
                    />
                  </div>
                ) : (
                  <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-xs text-[#727272]">
                    Map location is not available for this listing.
                  </p>
                )}
                {/* TEMPORARILY DISABLED: local guidebook cards are hidden while the feature is paused. */}
                {/* {guidebooks.length > 0 && (
                  <div className="pt-5 border-t border-zinc-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-[#1f1f1f]">Local Host Guidebook</h4>
                      <span className="text-[11px] text-zinc-400">Curated recommendations</span>
                    </div>
                    <div className="space-y-2.5">
                      {guidebooks.map((gb) => (
                        <div
                          key={gb.id}
                          className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center justify-between gap-4 hover:border-zinc-300 transition-all shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-lg shrink-0">
                              📖
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-[#1f1f1f] truncate">{gb.title}</h5>
                              <p className="text-base font-light text-[#1F1F1F] truncate">
                                {gb.itemsCount} recommendations by {gb.host?.name || "Host"}
                              </p>
                            </div>
                          </div>
                          <Link
                            href={`/guidebooks/${gb.id}`}
                            className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-4 py-2 shadow-2xs shrink-0 transition-all"
                          >
                            View guidebook
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )} */}
              </div>
            </div>
          </div>
        </Container>
      </main>

      {/* ListingGallery provides an integrated lightbox/modal */}

      {isDescriptionModalOpen && (
        <ModalOverlay role="dialog" aria-modal="true" aria-labelledby="description-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <h3 id="description-modal-title" className="text-lg font-semibold text-[#1f1f1f]">About this place</h3>
              <button type="button" onClick={() => setIsDescriptionModalOpen(false)} aria-label="Close description" className="p-1 text-zinc-500 hover:text-[#1f1f1f]">✕</button>
            </div>
            <div className="mt-5 space-y-6 overflow-y-auto pr-1 text-sm leading-6 text-zinc-700">
              <p className="whitespace-pre-line">{normalizedDescription}</p>
              {aboutLocationDetails.map((detail) => (
                <section key={detail.heading}>
                  <h4 className="text-xl font-normal text-[#1f1f1f]">{detail.heading}</h4>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-zinc-700">{detail.content}</p>
                </section>
              ))}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ALL AMENITIES MODAL */}
      {isAllAmenitiesOpen && (
        <ModalOverlay role="dialog" aria-modal="true" aria-labelledby="amenities-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <h3 id="amenities-modal-title" className="font-medium text-xl text-[#1f1f1f]">What this place offers</h3>
              <button
                ref={amenityCloseRef}
                type="button"
                onClick={() => setIsAllAmenitiesOpen(false)}
                aria-label="Close amenities"
                className="cursor-pointer p-1 text-lg font-semibold text-[#1f1f1f] hover:text-[#727272] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1f1f]"
              >
                ✕
              </button>
            </div>

            <div className="py-5">
              <input
                type="text"
                value={amenitySearchQuery}
                onChange={(e) => setAmenitySearchQuery(e.target.value)}
                placeholder="Search amenities..."
                className="w-full rounded-full border border-[#727272] text-[#1f1f1f] px-4 py-2 sm:min-h-[56px] min-h-[45px] text-sm outline-none focus:border-[#1f1f1f]"
              />
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto pr-1">
              {amenitySearchQuery.trim() ? (
                filteredModalAmenities.map((am) => <AmenityRow key={am.id} amenity={am} />)
              ) : amenityGroups.map(([category, amenities]) => (
                <section key={category} aria-label={`${category} amenities`}>
                  <h4 className="mb-4 pb-3 text-base font-semibold capitalize text-[#1f1f1f] border-b border-zinc-200">{category.replace(/_/g, " ")}</h4>
                  <div className="space-y-3">{amenities.map((am) => <AmenityRow key={am.id} amenity={am} />)}</div>
                </section>
              ))}
              {filteredModalAmenities.length === 0 && <p className="py-5 text-center text-xs text-zinc-500">No matching amenities.</p>}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Mobile Sticky Booking Bar (Visible below lg breakpoint where desktop card is not sticky) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1 truncate">
              <span className="text-[20px] font-normal text-[#1f1f1f] sm:text-lg">
                {quote?.guestTotal || quote?.totalPrice
                  ? formatPrice((quote.guestTotal ?? quote.totalPrice) || 0, currencyCode)
                  : displayPrice ?? "Price unavailable"}
              </span>
              <span className="text-xs font-normal text-zinc-500">
                {quote?.nights ? `total · ${quote.nights} ${quote.nights === 1 ? "night" : "nights"}` : "/ night"}
              </span>
            </div>
            <div className="truncate text-xs font-medium text-[#727272]">
              {checkIn && checkOut
                ? `${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${checkIn}T00:00:00`))} – ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${checkOut}T00:00:00`))}`
                : "Choose your dates"}
            </div>
          </div>

          <div className="shrink-0">
            {!checkIn || !checkOut ? (
              <button
                type="button"
                onClick={() => {
                  setAvailabilityRequested(true);
                  const calendarEl = document.getElementById("availability-heading");
                  if (calendarEl) {
                    calendarEl.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                className="rounded-2xl border border-amber-400 bg-[#fee09a] px-5 py-2.5 text-xs font-bold text-[#1f1f1f] shadow-xs transition hover:bg-[#fbd775] active:scale-[0.98] cursor-pointer"
              >
                Check availability
              </button>
            ) : (
              <button
                type="button"
                disabled={isBookingSubmitting || !hasValidQuote}
                onClick={handleReserve}
                className={`rounded-2xl px-5 py-2.5 text-xs font-bold transition-all shadow-xs ${hasValidQuote && !isBookingSubmitting
                  ? "border border-amber-400 bg-[#fee09a] text-[#1f1f1f] hover:bg-[#fbd775] active:scale-[0.98] cursor-pointer"
                  : "border border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed"
                  }`}
                aria-disabled={!hasValidQuote || isBookingSubmitting}
              >
                {isBookingSubmitting
                  ? "Confirming..."
                  : isQuoteLoading
                    ? "Checking..."
                    : listing.instantBook
                      ? "Reserve"
                      : "Request to book"}
              </button>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
