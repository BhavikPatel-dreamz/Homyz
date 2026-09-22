"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import ListingGallery from "@/components/listings/listing-gallery";
import { RealMap } from "@/components/ui/real-map";
import { CANONICAL_AMENITIES, searchAmenitiesCatalog } from "@/lib/constants/amenities";
import type { BookingQuote } from "@/services/booking.service";
import type { PublicListingDTO } from "@/services/mappers";
import { saveRecentlyViewedProperty, clearLastSearch } from "@/lib/storage/client-history";
import { formatListingPrice, getCurrencyForCountry } from "@/lib/currency";
import { getGoogleMapsUrl, trackGoogleMapsOpen } from "@/lib/location/google-maps";
import { cancellationPolicyLabel } from "@/lib/constants/listing-enums";
import useWishlist from "@/hooks/useWishlist";

interface PublicListingDetailClientProps {
  listing: PublicListingDTO & {
    host?: {
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

function overlapsBookedRange(checkIn: string, checkOut: string, ranges: BookedDateRange[]): boolean {
  return ranges.some((range) => checkIn < range.end && checkOut > range.start);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
        <h5 className="font-semibold text-zinc-900">{amenity.label}</h5>
        {amenity.description && <p className="mt-0.5 text-[11px] text-zinc-500">{amenity.description}</p>}
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
  onDateChange,
  onSelectionError,
  locationName,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  ranges: BookedDateRange[];
  isLoading: boolean;
  error: string | null;
  checkIn: string;
  checkOut: string;
  onDateChange: (checkIn: string, checkOut: string) => void;
  onSelectionError: (message: string | null) => void;
  locationName: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const canGoBack = firstDay.getTime() > new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const displayedMonths = [firstDay, new Date(month.getFullYear(), month.getMonth() + 1, 1)];
  const isSelectingCheckout = Boolean(checkIn && !checkOut);
  const formattedStayDates = checkIn && checkOut
    ? `${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${checkIn}T00:00:00`))} – ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${checkOut}T00:00:00`))}`
    : "Choose a check-in and check-out date";
  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86_400_000))
    : 0;

  const chooseDate = (key: string) => {
    const selectedDate = new Date(`${key}T00:00:00`);
    if (selectedDate < today) return;

    if (!checkIn || checkOut || key <= checkIn) {
      if (isUnavailableDate(selectedDate, ranges)) {
        onSelectionError("That check-in date is unavailable. Please choose another date.");
        return;
      }
      onSelectionError(null);
      onDateChange(key, "");
      return;
    }

    if (overlapsBookedRange(checkIn, key, ranges)) {
      onSelectionError("Those dates include an unavailable night. Please choose different dates.");
      return;
    }
    onSelectionError(null);
    onDateChange(checkIn, key);
  };

  const renderMonth = (calendarMonth: Date) => {
    const monthFirstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const title = monthFirstDay.toLocaleDateString("en", { month: "long", year: "numeric" });

    return (
      <div key={`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`} className="min-w-0">
        <h4 className="mb-4 text-center text-sm font-semibold text-zinc-800">{title}</h4>
        <div className="grid grid-cols-7 gap-y-2 text-center text-[10px] font-medium text-zinc-400">
          {weekdays.map((day) => <span key={day} aria-hidden="true">{day.slice(0, 1)}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-1" role="grid" aria-label={`${title} availability`}>
          {Array.from({ length: monthFirstDay.getDay() }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" className="aspect-square" />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1);
            const key = dateKey(date);
            const past = date < today;
            const unavailable = isUnavailableDate(date, ranges);
            const isCheckoutCandidate = Boolean(checkIn && !checkOut && key > checkIn && !overlapsBookedRange(checkIn, key, ranges));
            const disabled = past || (unavailable && !isCheckoutCandidate);
            const isStart = key === checkIn;
            const isEnd = key === checkOut;
            const isInRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut);
            const state = past ? "past" : isStart ? "check-in selected" : isEnd ? "check-out selected" : unavailable ? "unavailable" : isInRange ? "selected stay" : "available";

            return (
              <div key={key} className={`relative flex aspect-square items-center justify-center ${isInRange ? "bg-amber-100" : ""}`}>
                <button
                  type="button"
                  disabled={disabled || isLoading}
                  onClick={() => chooseDate(key)}
                  role="gridcell"
                  aria-label={`${date.toLocaleDateString("en", { dateStyle: "full" })}, ${state}`}
                  aria-pressed={isStart || isEnd}
                  className={`relative z-10 flex size-8 items-center justify-center rounded-full text-[11px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:size-9 ${
                    isStart || isEnd
                      ? "bg-[#F6CF7B] font-semibold text-zinc-900 shadow-sm"
                      : isInRange
                        ? "rounded-none bg-amber-100 text-zinc-900 hover:bg-amber-200"
                        : past || unavailable
                          ? "cursor-not-allowed text-zinc-300 line-through"
                          : "text-zinc-700 hover:bg-zinc-100"
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
    <section className="border-b border-zinc-200/80 pb-7" aria-labelledby="availability-heading">
      <div className="mb-4">
        <h3 id="availability-heading" className="text-lg font-semibold tracking-tight text-zinc-900">
          {nights > 0 ? `${nights} ${nights === 1 ? "night" : "nights"} in ${locationName}` : `Select your dates in ${locationName}`}
        </h3>
        <p className="mt-1 text-xs text-zinc-500" aria-live="polite">{formattedStayDates}</p>
      </div>
      {error ? (
        <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Availability could not be loaded. Please choose dates to confirm them before reserving.</p>
      ) : (
        <div className="rounded-2xl bg-zinc-100 p-3 sm:p-4">
          <div className="rounded-2xl bg-white px-3 py-5 sm:px-5 sm:py-6">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-start gap-1 sm:gap-3">
              <button type="button" aria-label="Previous two months" disabled={!canGoBack || isLoading} onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="mt-0.5 flex size-8 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30">‹</button>
              <div className="grid min-w-0 grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6">
                {displayedMonths.map(renderMonth)}
              </div>
              <button type="button" aria-label="Next two months" disabled={isLoading} onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="mt-0.5 flex size-8 items-center justify-center rounded-full text-lg text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30">›</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-[11px] text-zinc-500">
            <span aria-live="polite">{isLoading ? "Updating availability…" : "Select check-in, then check-out"}</span>
            <button type="button" onClick={() => { onSelectionError(null); onDateChange("", ""); }} disabled={!checkIn && !checkOut} className="underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-0">Clear dates</button>
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
  const router = useRouter();
  const wishlist = useWishlist();
  void guidebooks; // The section is intentionally paused; retain the existing server contract.

  // Modal States
  const [isAllAmenitiesOpen, setIsAllAmenitiesOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionExpandable, setIsDescriptionExpandable] = useState(false);
  const [amenitySearchQuery, setAmenitySearchQuery] = useState("");

  // Booking Widget State — pre-filled from search URL params
  const [checkIn, setCheckIn] = useState(searchCheckIn ?? "");
  const [checkOut, setCheckOut] = useState(searchCheckOut ?? "");
  const [guestsCount, setGuestsCount] = useState(searchGuests ?? 1);
  const [isNonRefundable, setIsNonRefundable] = useState(false);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookedDateRanges, setBookedDateRanges] = useState<BookedDateRange[]>([]);
  const [availabilityMonth, setAvailabilityMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [hostImageFailed, setHostImageFailed] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const amenityCloseRef = useRef<HTMLButtonElement>(null);
  const normalizedDescription = listing.description?.trim() ?? "";

  // A client component may be preserved while the route segment changes. Reset
  // all booking-specific state so a quote from property A never appears on B.
  useEffect(() => {
    const maximumGuests = Math.max(1, listing.guests || 1);
    const timer = window.setTimeout(() => {
      setCheckIn(searchCheckIn ?? "");
      setCheckOut(searchCheckOut ?? "");
      setGuestsCount(Math.min(Math.max(1, searchGuests ?? 1), maximumGuests));
      setIsNonRefundable(false);
      setQuote(null);
      setQuoteError(null);
      setBookingSuccess(false);
      setHostImageFailed(false);
      setIsDescriptionExpanded(false);
      setIsDescriptionExpandable(false);
      setIsAllAmenitiesOpen(false);
      setAmenitySearchQuery("");
      setAvailabilityMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [listing.id, listing.guests, searchCheckIn, searchCheckOut, searchGuests]);

  useEffect(() => {
    if (!normalizedDescription) return;
    const measure = () => {
      const element = descriptionRef.current;
      if (element) setIsDescriptionExpandable(element.scrollHeight > element.clientHeight + 1);
    };
    const frame = window.requestAnimationFrame(() => {
      setIsDescriptionExpandable(false);
      measure();
    });
    const observer = new ResizeObserver(measure);
    if (descriptionRef.current) observer.observe(descriptionRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [listing.id, normalizedDescription, isDescriptionExpanded]);

  useEffect(() => {
    if (!isAllAmenitiesOpen) return;
    amenityCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAllAmenitiesOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAllAmenitiesOpen]);

  // This compact range is shared by the booking card and read-only calendar.
  // The quote endpoint remains authoritative at reserve time.
  useEffect(() => {
    const controller = new AbortController();
    const rangeStart = dateKey(new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth(), 1));
    const rangeEnd = dateKey(new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth() + 2, 1));
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
        setBookedDateRanges(payload.data.ranges.filter((range: unknown): range is BookedDateRange => {
          if (!range || typeof range !== "object") return false;
          const candidate = range as BookedDateRange;
          return typeof candidate.start === "string" && typeof candidate.end === "string";
        }));
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
  }, [listing.id, availabilityMonth]);

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
    ? formatListingPrice(listing.price, listing.currency ?? getCurrencyForCountry(listing.country))
    : null;
  const currencyCode = listing.currency ?? getCurrencyForCountry(listing.country);
  const maximumGuests = Math.max(1, listing.guests || 1);
  const today = new Date().toISOString().slice(0, 10);
  const minimumCheckOut = checkIn
    ? new Date(new Date(`${checkIn}T00:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10)
    : today;
  const locationString = [listing.city, listing.country]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ");
  const publicCoordinates =
    typeof listing.latitude === "number" && Number.isFinite(listing.latitude) &&
    typeof listing.longitude === "number" && Number.isFinite(listing.longitude)
      ? { latitude: listing.latitude, longitude: listing.longitude }
      : null;
  const publicProfile = listing.host?.publicProfile?.profileVisible === false ? null : listing.host?.publicProfile ?? null;
  const hostBio = typeof publicProfile?.bio === "string" ? publicProfile.bio : "";
  const hostPrompts = publicProfile?.prompts && typeof publicProfile.prompts === "object" ? publicProfile.prompts as Record<string, unknown> : {};
  const hostInterests = Array.isArray(publicProfile?.interests) ? publicProfile.interests.filter((value): value is string => typeof value === "string") : [];
  const hostStamps = publicProfile?.stampsVisible !== false && Array.isArray(publicProfile?.selectedStamps) ? publicProfile.selectedStamps.filter((value): value is string => typeof value === "string") : [];
  const hostSince = listing.host?.createdAt && !Number.isNaN(new Date(listing.host.createdAt).getTime())
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(listing.host.createdAt))
    : null;
  const descriptionSections = listing.descriptionSections && typeof listing.descriptionSections === "object" ? listing.descriptionSections as Record<string, unknown> : {};
  const structuredDescription = [["Your property", descriptionSections.property], ["Guest access", descriptionSections.guestAccess], ["Interaction with guests", descriptionSections.guestInteraction], ["Other details to note", descriptionSections.otherDetails]] as const;
  const formatTime = (time: string | null | undefined) => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [hour, minute] = time.split(":").map(Number);
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${suffix}`;
  };
  const humanize = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

    if (guestsCount < 1 || guestsCount > maximumGuests) {
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
        `/api/v1/listings/${listing.id}/quote?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guestsCount}&nonRefundable=${isNonRefundable}`,
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
  }, [checkIn, checkOut, guestsCount, isNonRefundable, listing.id, maximumGuests]);

  const hasValidQuote = Boolean(
    checkIn && checkOut && quote && !quoteError && !isQuoteLoading && guestsCount <= maximumGuests && !overlapsBookedRange(checkIn, checkOut, bookedDateRanges),
  );

  const handleShare = async () => {
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
    if (wishlist.has(listing.id)) await wishlist.remove(listing.id);
    else await wishlist.add(listing.id);
  };

  // Handle Booking
  const handleReserve = async () => {
    if (!hasValidQuote) {
      setQuoteError("Choose valid available dates and guests before reserving.");
      return;
    }

    setIsBookingSubmitting(true);
    try {
      const res = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          startDate: checkIn,
          endDate: checkOut,
          guests: guestsCount,
          nonRefundable: isNonRefundable,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        if (res.status === 401) {
          // Redirect to login preserving booking intent
          const returnUrl = encodeURIComponent(
            `/listings/${listing.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guestsCount}`
          );
          router.push(`/login?returnUrl=${returnUrl}`);
          return;
        }
        alert(data.error?.message || "Failed to complete reservation");
      } else {
        clearLastSearch();
        setBookingSuccess(true);
      }
    } catch {
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  // Structured Rooms
  const rooms = (Array.isArray(listing.rooms) ? listing.rooms : []) as Array<{
    id: string;
    name: string;
    beds?: Array<{ count: number; type: string }>;
  }>;

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased">
      <AppHeader />

      <main className="w-full flex-1 pb-16 pt-4 sm:pt-5">
        <Container>
          <div className="mx-auto max-w-[1120px]">
          {/* Header Section */}
          <div className="flex items-start justify-between gap-4 pb-3 sm:pb-4">
            <div className="min-w-0 space-y-1.5">
              <h1 className="max-w-3xl break-words text-xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-2xl">
                {listing.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-zinc-700 sm:text-xs">
              {locationString && (
                <span className="inline-flex items-center gap-1.5">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-zinc-500">
                    <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  <span>{locationString}</span>
                </span>
              )}
              <span className="font-medium text-zinc-600">No guest reviews yet</span>
              </div>
              {(listing.isGuestFavorite || listing.host?.isSuperhost || listing.isFeatured) && (
              <div className="flex flex-wrap items-center gap-2" aria-label="Listing distinctions">
                {listing.isGuestFavorite && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-950">
                    <span aria-hidden="true">✦</span> Guest favourite
                  </span>
                )}
                {listing.host?.isSuperhost && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-950">
                    <span aria-hidden="true">★</span> Superhost
                  </span>
                )}
                {listing.isFeatured && (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                    Featured stay
                  </span>
                )}
              </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
              <button type="button" onClick={handleShare} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100" aria-label="Share this listing">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.1M8.6 13.4l6.8 4.1"/></svg>
                <span className="hidden sm:inline">Share</span>
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={wishlist.adding.has(listing.id) || wishlist.removeInFlight.has(listing.id)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50" aria-pressed={wishlist.has(listing.id)} aria-label={wishlist.has(listing.id) ? "Remove from wishlist" : "Save listing"}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill={wishlist.has(listing.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" className="size-4"><path d="M12 20.5 3.8 12a5.2 5.2 0 0 1 7.4-7.3L12 5.5l.8-.8a5.2 5.2 0 0 1 7.4 7.3L12 20.5Z"/></svg>
                <span className="hidden sm:inline">{wishlist.has(listing.id) ? "Saved" : "Save"}</span>
              </button>
            </div>
          </div>

          {/* Photo Gallery (ListingGallery component) */}
          <div>
            {/* ListingGallery handles thumbnails, lightbox, lazy loading, and fallbacks */}
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-ignore */}
            <ListingGallery key={listing.id} photos={photos} listingTitle={listing.title} />
          </div>

          {/* Main Content Layout: Left Details (7 cols) + Right Booking Widget (5 cols) */}
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-12 lg:gap-8">
            {/* LEFT COLUMN */}
            <div className="space-y-7 lg:col-span-7">
              {/* Property Summary & Host */}
              <div className="flex items-center justify-between pb-6 border-b border-zinc-200/80">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-zinc-900">
                    {listing.listingType || "Entire place"} hosted by {listing.host?.name || "Homyz host"}
                  </h2>
                  <p className="text-xs text-zinc-500 font-normal">
                    {listing.guests || 1} {listing.guests === 1 ? "guest" : "guests"} ·{" "}
                    {listing.bedrooms || 1} {listing.bedrooms === 1 ? "bedroom" : "bedrooms"} ·{" "}
                    {listing.beds || 1} {listing.beds === 1 ? "bed" : "beds"} ·{" "}
                    {listing.bathrooms || 1} {listing.bathrooms === 1 ? "bathroom" : "bathrooms"}
                  </p>
                </div>
                {listing.host?.image && !hostImageFailed ? (
                  <img
                    src={listing.host.image}
                    alt={listing.host.name || "Host"}
                    onError={() => setHostImageFailed(true)}
                    className="w-14 h-14 rounded-full object-cover border border-zinc-200 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-900 text-lg border border-amber-200 shrink-0">
                    {(listing.host?.name || "H")[0].toUpperCase()}
                  </div>
                )}
              </div>

              {/* Highlights (if any) */}
              {Array.isArray(listing.highlights) && listing.highlights.length > 0 && (
                <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-sm font-semibold text-zinc-900">Property highlights</h3>
                  <div className="flex flex-wrap gap-2">
                    {listing.highlights.map((h: string, i: number) => (
                      <span
                        key={i}
                        className="rounded-full bg-zinc-100 border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-800"
                      >
                        ✨ {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sleeping Arrangements */}
              {rooms.length > 0 && (
                <div className="space-y-4 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-base font-bold text-zinc-900">{"Where you'll sleep"}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {rooms.map((room) => (
                      <div key={room.id} className="rounded-2xl border border-zinc-200 p-4 space-y-2 bg-zinc-50/50">
                        <span className="text-xl block">🛏️</span>
                        <h4 className="text-xs font-semibold text-zinc-900">{room.name}</h4>
                        <div className="space-y-0.5 text-[11px] text-zinc-500">
                          {Array.isArray(room.beds) && room.beds.length > 0 ? (
                            room.beds.map((b: { count: number; type: string }, bi: number) => (
                              <p key={bi}>
                                {b.count} {b.type.replace(/_/g, " ").toLowerCase()}{" "}
                                {b.count === 1 ? "bed" : "beds"}
                              </p>
                            ))
                          ) : (
                            <p>1 queen bed</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {normalizedDescription && (
                <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-base font-bold text-zinc-900">About this space</h3>
                  <p
                    ref={descriptionRef}
                    className={`text-xs text-zinc-700 leading-relaxed ${
                      isDescriptionExpanded ? "whitespace-pre-line break-words" : "line-clamp-4 whitespace-pre-line break-words"
                    }`}
                  >
                    {normalizedDescription}
                  </p>
                  {isDescriptionExpandable && (
                    <button
                      type="button"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      aria-expanded={isDescriptionExpanded}
                      className="text-xs font-semibold text-zinc-900 underline cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                    >
                      {isDescriptionExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}

              {structuredDescription.some(([, value]) => typeof value === "string" && value.trim()) && (
                <section className="space-y-4 pb-6 border-b border-zinc-200/80">
                  {structuredDescription.map(([heading, value]) => typeof value === "string" && value.trim() ? <div key={heading} className="space-y-1"><h3 className="text-sm font-bold text-zinc-900">{heading}</h3><p className="text-xs leading-relaxed text-zinc-700">{value}</p></div> : null)}
                </section>
              )}

              {(listing.host || hostBio || Object.values(hostPrompts).some((value) => (typeof value === "string" && value) || (Array.isArray(value) && value.length > 0)) || hostInterests.length > 0 || hostStamps.length > 0) && (
                <section className="space-y-3 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-base font-bold text-zinc-900">Meet your host</h3>
                  {listing.host && (
                    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3">
                      {listing.host.image && !hostImageFailed ? (
                        <img src={listing.host.image} alt={listing.host.name || "Host"} onError={() => setHostImageFailed(true)} className="size-12 rounded-full border border-zinc-200 object-cover" />
                      ) : (
                        <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-100 text-sm font-bold text-amber-900">
                          {(listing.host.name || "H")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">{listing.host.name || "Homyz host"}</p>
                        {hostSince && <p className="text-[11px] text-zinc-500">Hosting since {hostSince}</p>}
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {listing.host.isSuperhost && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">Superhost</span>}
                          {listing.isGuestFavorite && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Guest favourite listing</span>}
                        </div>
                      </div>
                    </div>
                  )}
                  {hostBio && <p className="text-xs leading-relaxed text-zinc-700">{hostBio}</p>}
                  {Object.entries(hostPrompts).filter(([, value]) => (typeof value === "string" && value) || (Array.isArray(value) && value.length > 0)).map(([key, value]) => (
                    <div key={key} className="text-xs text-zinc-700"><span className="font-semibold">{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}: </span>{Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : value as string}</div>
                  ))}
                  {hostInterests.length > 0 && <div className="flex flex-wrap gap-2">{hostInterests.map((interest) => <span key={interest} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] capitalize text-zinc-700">{interest}</span>)}</div>}
                  {hostStamps.length > 0 && <p className="text-xs text-zinc-600"><span className="font-semibold">Where I&apos;ve been: </span>{hostStamps.join(", ")}</p>}
                </section>
              )}

              {/* Amenities Grid */}
              <div className="space-y-4 pb-6 border-b border-zinc-200/80">
                <h3 className="text-base font-bold text-zinc-900">What this place offers</h3>
                {categorizedAmenities.length === 0 ? (
                  <p className="text-xs text-zinc-500">This host has not listed any amenities yet.</p>
                ) : <>
                  <div className="grid grid-cols-1 gap-3 text-xs text-zinc-800 sm:grid-cols-2">
                    {categorizedAmenities.slice(0, 8).map((am) => (
                      <div key={am.id} className="flex min-w-0 items-center gap-2.5">
                        <span aria-hidden="true" className="text-base">{am.icon || "✓"}</span>
                        <span className="font-medium break-words">{am.label}</span>
                      </div>
                    ))}
                  </div>

                  {categorizedAmenities.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setIsAllAmenitiesOpen(true)}
                    className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold px-5 py-2.5 transition-all cursor-pointer shadow-2xs mt-2"
                  >
                    Show all {categorizedAmenities.length} amenities
                  </button>
                  )}
                </>}
              </div>

              <ListingAvailabilityCalendar
                month={availabilityMonth}
                onMonthChange={setAvailabilityMonth}
                ranges={bookedDateRanges}
                isLoading={isAvailabilityLoading}
                error={availabilityError}
                checkIn={checkIn}
                checkOut={checkOut}
                locationName={listing.city || listing.title || "this property"}
                onDateChange={(nextCheckIn, nextCheckOut) => {
                  setCheckIn(nextCheckIn);
                  setCheckOut(nextCheckOut);
                  setQuoteError(null);
                }}
                onSelectionError={setQuoteError}
              />

              {/* No property review model or public review API exists yet. Do
                  not mislabel host-profile metrics as reviews for this stay. */}
              <section className="space-y-2 border-b border-zinc-200/80 pb-6" aria-labelledby="guest-reviews-heading">
                <h3 id="guest-reviews-heading" className="text-base font-bold text-zinc-900">Guest reviews</h3>
                <p className="text-xs leading-relaxed text-zinc-600">This property has no guest reviews yet.</p>
              </section>

              {/* House Rules */}
              <section className="space-y-3 pb-6 border-b border-zinc-200/80" aria-labelledby="house-rules-heading">
                <h3 id="house-rules-heading" className="text-base font-bold text-zinc-900">House rules</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-700">
                  {formatTime(listing.checkInStart) && <div className="flex items-center gap-2"><span aria-hidden="true">🕒</span><span>Check-in after {formatTime(listing.checkInStart)}{formatTime(listing.checkInEnd) ? `, before ${formatTime(listing.checkInEnd)}` : ""}</span></div>}
                  {formatTime(listing.checkOutTime) && <div className="flex items-center gap-2"><span aria-hidden="true">⏱️</span><span>Check-out before {formatTime(listing.checkOutTime)}</span></div>}
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true">👥</span>
                    <span>{listing.guests || 1} guest maximum</span>
                  </div>
                  {listing.petsAllowed !== null && <div className="flex items-center gap-2"><span aria-hidden="true">{listing.petsAllowed ? "🐾" : "🚫"}</span><span>{listing.petsAllowed ? `Pets allowed${listing.maxPets ? ` · up to ${listing.maxPets}` : ""}` : "No pets"}</span></div>}
                  {listing.smokingAllowed !== null && <div className="flex items-center gap-2"><span aria-hidden="true">{listing.smokingAllowed ? "🚬" : "🚭"}</span><span>{listing.smokingAllowed ? `Smoking: ${listing.smokingLocation ? humanize(listing.smokingLocation) : "allowed"}` : "No smoking"}</span></div>}
                  {listing.eventsAllowed !== null && <div className="flex items-center gap-2"><span aria-hidden="true">{listing.eventsAllowed ? "🎉" : "🔇"}</span><span>{listing.eventsAllowed ? "Events allowed" : "No parties or events"}</span></div>}
                  {listing.photographyAllowed !== null && <div className="flex items-center gap-2"><span aria-hidden="true">📷</span><span>{listing.photographyAllowed ? "Commercial photography allowed" : "No commercial photography"}</span></div>}
                  {listing.quietHours && formatTime(listing.quietHoursStart) && formatTime(listing.quietHoursEnd) && <div className="flex items-center gap-2"><span aria-hidden="true">🤫</span><span>Quiet hours: {formatTime(listing.quietHoursStart)}–{formatTime(listing.quietHoursEnd)}</span></div>}
                  {configuredHouseRules.map((rule) => <div key={rule} className="flex items-start gap-2"><span aria-hidden="true">✓</span><span>{rule}</span></div>)}
                  {listing.additionalRules && <div className="flex items-start gap-2 sm:col-span-2"><span aria-hidden="true">📋</span><span className="whitespace-pre-line break-words">{listing.additionalRules}</span></div>}
                </div>
              </section>

              {(cancellationLabel || longTermCancellationLabel) && <section className="space-y-2 pb-6 border-b border-zinc-200/80" aria-labelledby="cancellation-heading">
                <h3 id="cancellation-heading" className="text-base font-bold text-zinc-900">Cancellation policy</h3>
                {cancellationLabel && <p className="text-xs text-zinc-600"><span className="font-semibold text-zinc-800">{cancellationLabel}.</span> Applies to stays under 28 nights.</p>}
                {longTermCancellationLabel && <p className="text-xs text-zinc-600"><span className="font-semibold text-zinc-800">{longTermCancellationLabel}.</span> Applies to stays of 28 nights or more.</p>}
              </section>}

              {/* Safety Disclosures */}
              <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                <h3 className="text-base font-bold text-zinc-900">Safety & property</h3>
                <div className="space-y-2 text-xs text-zinc-600">
                  {publicSafetyEquipment.map((item) => <div key={item} className="flex items-center gap-2"><span>🛡️</span><span>{humanize(item)}</span></div>)}
                  {publicSafetyHazards.map((item) => <div key={item} className="flex items-center gap-2"><span>⚠️</span><span>{item}</span></div>)}
                  {publicSafetyDisclosures.map((disclosure) => <div key={disclosure} className="flex items-center gap-2"><span>ℹ️</span><span>{disclosure}</span></div>)}
                  {publicSafetyEquipment.length === 0 && publicSafetyHazards.length === 0 && publicSafetyDisclosures.length === 0 && <p>No safety equipment or property hazards have been reported.</p>}
                </div>
              </div>

              {/* Location & Map Section */}
              <div className="space-y-3 pb-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-base font-bold text-zinc-900">{"Where you'll be"}</h3>
                  {(() => {
                    const mapsUrl = getGoogleMapsUrl(listing);
                    if (!mapsUrl) return null;
                    return (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackGoogleMapsOpen(listing.id, "property_details")}
                        aria-label={`Open ${listing.title || "property"} location in Google Maps`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-800 hover:text-amber-950 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-full transition-colors shrink-0 cursor-pointer"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        <span>View in Google Maps</span>
                      </a>
                    );
                  })()}
                </div>
                <p className="text-xs text-zinc-500 font-normal">
                  {locationString || "Location details are not available for this listing."}
                  {!listing.showExactLocation && " · Approximate location provided to protect host privacy"}
                </p>
                {publicCoordinates ? (
                  <div className="h-72 w-full rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs">
                    <RealMap
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
                  <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-xs text-zinc-600">
                    Map location is not available for this listing.
                  </p>
                )}
                {(listing.neighborhoodDescription || listing.gettingAround || listing.locationFeatures?.length || listing.views?.length) && <div className="space-y-4 pt-3 text-xs text-zinc-700">
                  {listing.neighborhoodDescription && <div><h4 className="font-semibold text-zinc-900">Neighborhood</h4><p className="mt-1 leading-relaxed">{listing.neighborhoodDescription}</p></div>}
                  {listing.gettingAround && <div><h4 className="font-semibold text-zinc-900">Getting around</h4><p className="mt-1 leading-relaxed">{listing.gettingAround}</p></div>}
                  {listing.locationFeatures && listing.locationFeatures.length > 0 && <div><h4 className="font-semibold text-zinc-900">Location features</h4><p className="mt-1 capitalize">{listing.locationFeatures.map((feature) => feature.replace(/_/g, " ")).join(" · ")}</p></div>}
                  {listing.views && listing.views.length > 0 && <div><h4 className="font-semibold text-zinc-900">Views</h4><p className="mt-1 capitalize">{listing.views.map((view) => view.replace(/_/g, " ")).join(" · ")}</p></div>}
                </div>}

                {/* TEMPORARILY DISABLED: local guidebook cards are hidden while the feature is paused. */}
                {/* {guidebooks.length > 0 && (
                  <div className="pt-5 border-t border-zinc-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-zinc-900">Local Host Guidebook</h4>
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
                              <h5 className="text-xs font-bold text-zinc-900 truncate">{gb.title}</h5>
                              <p className="text-[11px] text-zinc-500 truncate">
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

            {/* RIGHT COLUMN: BOOKING & PRICING PANEL */}
            <div className="lg:col-span-5">
              <div className="sticky top-20 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg">
                {bookingSuccess ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold">
                      ✓
                    </div>
                    <h3 className="text-base font-bold text-zinc-900">{listing.instantBook ? "Reservation confirmed" : "Reservation request submitted"}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                      Your stay has been recorded. You can manage your bookings in your trips dashboard.
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/bookings"
                        className="rounded-full bg-zinc-900 text-white font-semibold text-xs px-6 py-2.5 inline-block"
                      >
                        View your bookings
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
                      <div>
                        <span className="text-2xl font-bold text-zinc-900">{displayPrice ?? "Price unavailable"}</span>
                        <span className="text-xs text-zinc-500 font-normal"> / night</span>
                      </div>
                      <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold">
                        {listing.instantBook ? "Instant Book" : "Host approval required"}
                      </span>
                    </div>

                    {/* Date Pickers */}
                    <div className="rounded-2xl border border-zinc-300 overflow-hidden divide-y divide-zinc-200 text-xs">
                      <div className="grid grid-cols-2 divide-x divide-zinc-200">
                        <div className="p-3 space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Check-in
                          </label>
                          <input
                            type="date"
                            value={checkIn}
                            min={today}
                            onChange={(e) => {
                              const nextCheckIn = e.target.value;
                              setCheckIn(nextCheckIn);
                              if (checkOut && (checkOut <= nextCheckIn || overlapsBookedRange(nextCheckIn, checkOut, bookedDateRanges))) {
                                setCheckOut("");
                                setQuoteError("Those dates include an unavailable night. Please choose different dates.");
                              }
                            }}
                            className="w-full bg-transparent outline-none font-medium text-zinc-900 text-xs cursor-pointer"
                          />
                        </div>
                        <div className="p-3 space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Check-out
                          </label>
                          <input
                            type="date"
                            value={checkOut}
                            min={minimumCheckOut}
                            onChange={(e) => {
                              const nextCheckOut = e.target.value;
                              if (checkIn && overlapsBookedRange(checkIn, nextCheckOut, bookedDateRanges)) {
                                setCheckOut("");
                                setQuoteError("Those dates include an unavailable night. Please choose different dates.");
                                return;
                              }
                              setCheckOut(nextCheckOut);
                            }}
                            className="w-full bg-transparent outline-none font-medium text-zinc-900 text-xs cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="p-3 space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Guests
                        </label>
                        <select
                          value={guestsCount}
                          onChange={(e) => setGuestsCount(parseInt(e.target.value, 10))}
                          className="w-full bg-transparent outline-none font-medium text-zinc-900 text-xs cursor-pointer"
                        >
                          {Array.from({ length: maximumGuests }).map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1} {i === 0 ? "guest" : "guests"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <p className="text-[11px] leading-relaxed text-zinc-500" aria-live="polite">
                      {bookedDateRanges.length > 0
                        ? "Unavailable dates are excluded automatically."
                        : "Availability is confirmed before you reserve."}
                    </p>

                    {listing.bookingMessage && <p className="rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600 whitespace-pre-wrap">{listing.bookingMessage}</p>}

                    {quote?.nonRefundableAvailable && !isQuoteLoading && (
                      <fieldset className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs">
                        <legend className="px-1 font-semibold text-zinc-900">Choose your reservation</legend>
                        <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${!isNonRefundable ? "border-zinc-900 bg-white" : "border-transparent"}`}>
                          <input type="radio" name="reservation-type" checked={!isNonRefundable} onChange={() => setIsNonRefundable(false)} className="mt-0.5" />
                          <span><span className="block font-semibold text-zinc-900">Standard booking</span><span className="text-zinc-600">Uses this listing&apos;s normal cancellation policy.</span></span>
                        </label>
                        <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 ${isNonRefundable ? "border-amber-500 bg-amber-50" : "border-transparent"}`}>
                          <input type="radio" name="reservation-type" checked={isNonRefundable} onChange={() => setIsNonRefundable(true)} className="mt-0.5" />
                          <span><span className="block font-semibold text-zinc-900">Non-refundable booking</span><span className="text-zinc-600">Discounted price. If you cancel, you cannot receive the normal cancellation refund and the host retains the booked payout.</span></span>
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
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                        {quoteError}
                      </div>
                    )}

                        {quote && !isQuoteLoading && (
                          <div className="space-y-2.5 pt-2 border-t border-zinc-100 text-xs">
                        <div className="flex items-center justify-between text-zinc-600">
                          <span>
                            {formatListingPrice(quote.baseNightlyPrice, listing.currency ?? getCurrencyForCountry(listing.country))} × {quote.nights} {" "}
                            {quote.nights === 1 ? "night" : "nights"}
                          </span>
                          <span>{formatListingPrice(quote.nightlySubtotal, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                        </div>

                        {quote.customPricedNights !== undefined && quote.customPricedNights > 0 && (
                          <div className="flex items-center justify-between text-amber-700 text-[11px] font-medium bg-amber-50 px-2 py-0.5 rounded">
                            <span>Includes {quote.customPricedNights} custom calendar rate {quote.customPricedNights === 1 ? "night" : "nights"}</span>
                          </div>
                        )}

                        {quote.weekendNights > 0 && quote.weekendNightlyPrice && (
                          <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                            <span>Includes {quote.weekendNights} weekend nights</span>
                            <span>{formatListingPrice(quote.weekendNightlyPrice, currencyCode)} / night</span>
                          </div>
                        )}

                        {quote.cleaningFee > 0 && (
                          <div className="flex items-center justify-between text-zinc-600">
                            <span>Cleaning fee</span>
                            <span>{formatListingPrice(quote.cleaningFee, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                          </div>
                        )}

                        {quote.extraGuestFee !== undefined && quote.extraGuestFee > 0 && (
                          <div className="flex items-center justify-between text-zinc-600">
                            <span>Extra guest fee</span>
                            <span>{formatListingPrice(quote.extraGuestFee, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                          </div>
                        )}

                        {quote.appliedDiscount && (
                          <div className="flex items-center justify-between text-emerald-700 font-medium">
                            <span>{quote.appliedDiscount.name}</span>
                            <span>−{formatListingPrice(quote.appliedDiscount.amount, currencyCode)}</span>
                          </div>
                        )}

                        {quote.nonRefundableDiscount && (
                          <div className="flex items-center justify-between text-emerald-700 font-medium">
                            <span>{quote.nonRefundableDiscount.name} ({quote.nonRefundableDiscount.percentage}%)</span>
                            <span>−{formatListingPrice(quote.nonRefundableDiscount.amount, currencyCode)}</span>
                          </div>
                        )}

                        {quote.hostServiceFee > 0 && (
                          <div className="flex items-center justify-between text-zinc-600">
                            <span>Guest service fee ({quote.hostServiceFeePercentage}%)</span>
                            <span>{formatListingPrice(quote.hostServiceFee, currencyCode)}</span>
                          </div>
                        )}

                        {quote.taxes && quote.taxes.length > 0 ? (
                          <>
                            <div className="flex items-center justify-between text-zinc-600">
                              <span>Total before taxes</span>
                              <span>{formatListingPrice(((quote.nightlySubtotal - quote.discountAmount) + quote.cleaningFee + (quote.extraGuestFee || 0) + (quote.hostServiceFee || 0)), listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                            </div>

                            <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                                <div className="flex items-center justify-between text-zinc-600">
                                  <span className="flex items-center gap-1.5 font-medium">
                                    Taxes & fees
                                    {quote.taxes.some((tax) => tax.isExempt) && (
                                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-full font-semibold">
                                        Exemption applied
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-medium">{formatListingPrice(quote.taxTotal || 0, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                                </div>
                              <div className="pl-2.5 space-y-1 border-l-2 border-amber-300 text-[11px] text-zinc-500">
                                {quote.taxes.map((tax, idx) => (
                                  <div key={idx} className="flex items-center justify-between">
                                    <span>
                                      {tax.taxName}
                                      {tax.rate ? ` (${tax.rate}%)` : ""}
                                      {tax.isExempt ? ` • ${tax.exemptionReason || "Exempt"}` : ""}
                                    </span>
                                      <span>{tax.isExempt ? formatListingPrice(0, listing.currency ?? getCurrencyForCountry(listing.country)) : formatListingPrice(tax.taxAmount, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-sm font-bold text-zinc-900">
                              <span>Total</span>
                              <span>{formatListingPrice((quote.guestTotal ?? quote.totalPrice) || 0, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                            </div>
                          </>
                        ) : (
                          <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-sm font-bold text-zinc-900">
                            <span>Total</span>
                            <span>{formatListingPrice((quote.guestTotal ?? quote.totalPrice) || 0, listing.currency ?? getCurrencyForCountry(listing.country))}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reserve CTA */}
                    <button
                      type="button"
                      disabled={isBookingSubmitting || !hasValidQuote}
                      onClick={handleReserve}
                      className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 font-bold text-sm py-3.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isBookingSubmitting
                        ? "Confirming..."
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
            </div>
          </div>
          </div>
        </Container>
      </main>

      {/* ListingGallery provides an integrated lightbox/modal */}

      {/* ALL AMENITIES MODAL */}
      {isAllAmenitiesOpen && (
        <ModalOverlay role="dialog" aria-modal="true" aria-labelledby="amenities-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-[28px] border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <h3 id="amenities-modal-title" className="font-bold text-lg text-zinc-900">What this place offers</h3>
              <button
                ref={amenityCloseRef}
                type="button"
                onClick={() => setIsAllAmenitiesOpen(false)}
                aria-label="Close amenities"
                className="cursor-pointer p-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              >
                ✕
              </button>
            </div>

            <div className="py-3">
              <input
                type="text"
                value={amenitySearchQuery}
                onChange={(e) => setAmenitySearchQuery(e.target.value)}
                placeholder="Search amenities..."
                className="w-full rounded-full border border-zinc-300 px-4 py-2 text-xs outline-none focus:border-zinc-900"
              />
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto pr-1">
              {amenitySearchQuery.trim() ? (
                filteredModalAmenities.map((am) => <AmenityRow key={am.id} amenity={am} />)
              ) : amenityGroups.map(([category, amenities]) => (
                <section key={category} aria-label={`${category} amenities`}>
                  <h4 className="mb-2 text-xs font-semibold capitalize text-zinc-900">{category.replace(/_/g, " ")}</h4>
                  <div className="space-y-3">{amenities.map((am) => <AmenityRow key={am.id} amenity={am} />)}</div>
                </section>
              ))}
              {filteredModalAmenities.length === 0 && <p className="py-5 text-center text-xs text-zinc-500">No matching amenities.</p>}
            </div>
          </div>
        </ModalOverlay>
      )}

      <Footer />
    </div>
  );
}
