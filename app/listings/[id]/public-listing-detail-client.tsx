"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { RealMap } from "@/components/ui/real-map";
import { CANONICAL_AMENITIES, searchAmenitiesCatalog } from "@/lib/constants/amenities";
import type { BookingQuote } from "@/services/booking.service";
import type { PublicListingDTO } from "@/services/mappers";

interface PublicListingDetailClientProps {
  listing: PublicListingDTO & {
    host?: {
      name?: string | null;
      image?: string | null;
      createdAt?: Date | string;
      publicProfile?: Record<string, unknown> | null;
    } | null;
  };
  guidebooks?: Array<{
    id: string;
    title: string;
    coverImage?: string | null;
    city?: string | null;
    itemsCount: number;
    host?: { id: string; name: string | null; image: string | null };
  }>;
}

export function PublicListingDetailClient({
  listing,
  guidebooks = [],
}: PublicListingDetailClientProps) {
  const router = useRouter();

  // Modal States
  const [isAllPhotosOpen, setIsAllPhotosOpen] = useState(false);
  const [isAllAmenitiesOpen, setIsAllAmenitiesOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [amenitySearchQuery, setAmenitySearchQuery] = useState("");

  // Booking Widget State
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestsCount, setGuestsCount] = useState(1);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const amenitiesSet = new Set(Array.isArray(listing.amenities) ? listing.amenities : []);

  // Format price
  const basePriceSAR = Math.round(listing.price / 100);
  const locationString = listing.city
    ? `${listing.city}${listing.country ? `, ${listing.country}` : ""}`
    : listing.country || "Saudi Arabia";
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
  const descriptionSections = listing.descriptionSections && typeof listing.descriptionSections === "object" ? listing.descriptionSections as Record<string, unknown> : {};
  const structuredDescription = [["Your property", descriptionSections.property], ["Guest access", descriptionSections.guestAccess], ["Interaction with guests", descriptionSections.guestInteraction], ["Other details to note", descriptionSections.otherDetails]] as const;
  const formatTime = (time: string | null | undefined) => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [hour, minute] = time.split(":").map(Number);
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${suffix}`;
  };
  const humanize = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const publicSafetyEquipment = Array.isArray(listing.safetyEquipment) ? listing.safetyEquipment : [];
  const publicSafetyHazards = Array.isArray(listing.safetyHazards) ? listing.safetyHazards : [];
  const cancellationLabel = listing.cancellationPolicy.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const longTermCancellationLabel = listing.longTermCancellationPolicy.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

  // Fetch quote when valid dates are selected
  useEffect(() => {
    if (!checkIn || !checkOut) {
      return;
    }

    const cIn = new Date(checkIn);
    const cOut = new Date(checkOut);
    if (isNaN(cIn.getTime()) || isNaN(cOut.getTime()) || cOut <= cIn) {
      const timer = setTimeout(() => {
        setQuote(null);
        setQuoteError("Checkout must be after check-in");
      }, 0);
      return () => clearTimeout(timer);
    }

    let isMounted = true;
    const timer = setTimeout(() => {
      setIsQuoteLoading(true);
      setQuoteError(null);

      fetch(
        `/api/v1/listings/${listing.id}/quote?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guestsCount}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          if (data.error || !data.data) {
            setQuoteError(data.error?.message || "Selected dates are not available");
            setQuote(null);
          } else {
            setQuote(data.data);
            setQuoteError(null);
          }
        })
        .catch(() => {
          if (!isMounted) return;
          setQuoteError("Unable to calculate price quotation.");
          setQuote(null);
        })
        .finally(() => {
          if (isMounted) setIsQuoteLoading(false);
        });
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [checkIn, checkOut, guestsCount, listing.id]);

  // Handle Booking
  const handleReserve = async () => {
    if (!checkIn || !checkOut) {
      alert("Please select check-in and check-out dates");
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

  // Categorized Amenities for Modal
  const categorizedAmenities = CANONICAL_AMENITIES.filter((a) => amenitiesSet.has(a.id));
  const filteredModalAmenities = searchAmenitiesCatalog(amenitySearchQuery).filter((a) =>
    amenitiesSet.has(a.id)
  );

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased">
      <AppHeader />

      <main className="w-full flex-1 pb-24 pt-6">
        <Container>
          {/* Header Section */}
          <div className="space-y-1.5 pb-5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              {listing.title}
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <span>📍 {locationString}</span>
                {listing.isFeatured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                    Featured stay
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Photo Gallery (5-Photo Mosaic / Responsive Grid) */}
          <div className="relative mb-10 overflow-hidden rounded-3xl border border-zinc-200">
            {photos.length === 0 ? (
              <div className="aspect-[21/9] w-full bg-zinc-100 flex flex-col items-center justify-center text-zinc-400">
                <span className="text-4xl mb-2">🏡</span>
                <span className="text-xs font-medium">No property photos uploaded</span>
              </div>
            ) : photos.length === 1 ? (
              <div className="aspect-[16/9] sm:aspect-[21/9] w-full overflow-hidden">
                <img src={photos[0]} alt="Property cover" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 aspect-[4/3] sm:aspect-[21/9]">
                {/* Main Large Cover (Left 2 cols) */}
                <div className="md:col-span-2 relative h-full overflow-hidden bg-zinc-100">
                  <img
                    src={photos[0]}
                    alt="Main photo"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => setIsAllPhotosOpen(true)}
                  />
                </div>
                {/* Right 4-Grid Preview */}
                <div className="hidden md:grid md:col-span-2 grid-cols-2 gap-2 h-full">
                  {photos.slice(1, 5).map((photo: string, index: number) => (
                    <div
                      key={index}
                      className="relative h-full overflow-hidden bg-zinc-100 cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => setIsAllPhotosOpen(true)}
                    >
                      <img src={photo} alt={`Photo ${index + 2}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => setIsAllPhotosOpen(true)}
                className="absolute right-4 bottom-4 rounded-full bg-white/90 backdrop-blur-md px-4 py-2 text-xs font-semibold text-zinc-800 shadow-md hover:bg-white transition-all cursor-pointer border border-zinc-200 flex items-center gap-1.5"
              >
                <span>Show all photos</span>
                <span className="text-zinc-500 font-normal">({photos.length})</span>
              </button>
            )}
          </div>

          {/* Main Content Layout: Left Details (7 cols) + Right Booking Widget (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-7 space-y-10">
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
                {listing.host?.image ? (
                  <img
                    src={listing.host.image}
                    alt={listing.host.name || "Host"}
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
              {listing.description && (
                <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-base font-bold text-zinc-900">About this space</h3>
                  <p
                    className={`text-xs text-zinc-700 leading-relaxed ${
                      isDescriptionExpanded ? "" : "line-clamp-4"
                    }`}
                  >
                    {listing.description}
                  </p>
                  {listing.description.length > 250 && (
                    <button
                      type="button"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-xs font-semibold text-zinc-900 underline cursor-pointer"
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

              {(hostBio || Object.values(hostPrompts).some((value) => typeof value === "string" && value) || hostInterests.length > 0 || hostStamps.length > 0) && (
                <section className="space-y-3 pb-6 border-b border-zinc-200/80">
                  <h3 className="text-base font-bold text-zinc-900">About your host</h3>
                  {hostBio && <p className="text-xs leading-relaxed text-zinc-700">{hostBio}</p>}
                  {Object.entries(hostPrompts).filter(([, value]) => typeof value === "string" && value).map(([key, value]) => (
                    <div key={key} className="text-xs text-zinc-700"><span className="font-semibold">{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}: </span>{value as string}</div>
                  ))}
                  {hostInterests.length > 0 && <div className="flex flex-wrap gap-2">{hostInterests.map((interest) => <span key={interest} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] capitalize text-zinc-700">{interest}</span>)}</div>}
                  {hostStamps.length > 0 && <p className="text-xs text-zinc-600"><span className="font-semibold">Where I&apos;ve been: </span>{hostStamps.join(", ")}</p>}
                </section>
              )}

              {/* Amenities Grid */}
              <div className="space-y-4 pb-6 border-b border-zinc-200/80">
                <h3 className="text-base font-bold text-zinc-900">What this place offers</h3>
                <div className="grid grid-cols-2 gap-3 text-xs text-zinc-800">
                  {categorizedAmenities.slice(0, 8).map((am) => (
                    <div key={am.id} className="flex items-center gap-2.5">
                      <span className="text-base">{am.icon || "✓"}</span>
                      <span className="font-medium">{am.label}</span>
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
              </div>

              {/* House Rules */}
              <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                <h3 className="text-base font-bold text-zinc-900">House rules</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-700">
                  {formatTime(listing.checkInStart) && <div className="flex items-center gap-2"><span>🕒</span><span>Check-in: {formatTime(listing.checkInStart)}–{formatTime(listing.checkInEnd) || "open"}</span></div>}
                  {formatTime(listing.checkOutTime) && <div className="flex items-center gap-2"><span>⏱️</span><span>Checkout: by {formatTime(listing.checkOutTime)}</span></div>}
                  <div className="flex items-center gap-2">
                    <span>👥</span>
                    <span>{listing.guests || 1} guest maximum</span>
                  </div>
                  {listing.petsAllowed !== null && <div className="flex items-center gap-2"><span>{listing.petsAllowed ? "🐾" : "🚫"}</span><span>{listing.petsAllowed ? `Pets allowed${listing.maxPets ? ` · up to ${listing.maxPets}` : ""}` : "No pets"}</span></div>}
                  {listing.smokingAllowed !== null && <div className="flex items-center gap-2"><span>{listing.smokingAllowed ? "🚬" : "🚭"}</span><span>{listing.smokingAllowed ? `Smoking: ${listing.smokingLocation ? humanize(listing.smokingLocation) : "allowed"}` : "No smoking"}</span></div>}
                  {listing.eventsAllowed !== null && <div className="flex items-center gap-2"><span>{listing.eventsAllowed ? "🎉" : "🔇"}</span><span>{listing.eventsAllowed ? "Events allowed" : "No parties or events"}</span></div>}
                  {listing.photographyAllowed !== null && <div className="flex items-center gap-2"><span>📷</span><span>{listing.photographyAllowed ? "Commercial photography allowed" : "No commercial photography"}</span></div>}
                  {listing.quietHours && formatTime(listing.quietHoursStart) && formatTime(listing.quietHoursEnd) && <div className="flex items-center gap-2"><span>🤫</span><span>Quiet hours: {formatTime(listing.quietHoursStart)}–{formatTime(listing.quietHoursEnd)}</span></div>}
                  {listing.additionalRules && <div className="flex items-start gap-2 sm:col-span-2"><span>📋</span><span className="whitespace-pre-line">{listing.additionalRules}</span></div>}
                </div>
              </div>

              <div className="space-y-2 pb-6 border-b border-zinc-200/80">
                <h3 className="text-base font-bold text-zinc-900">Cancellation policy</h3>
                <p className="text-xs text-zinc-600">{cancellationLabel} for stays under 28 nights.</p>
                <p className="text-xs text-zinc-600">{longTermCancellationLabel} long-term policy for stays of 28 nights or more.</p>
              </div>

              {/* Safety Disclosures */}
              <div className="space-y-3 pb-6 border-b border-zinc-200/80">
                <h3 className="text-base font-bold text-zinc-900">Safety & property</h3>
                <div className="space-y-2 text-xs text-zinc-600">
                  {publicSafetyEquipment.map((item) => <div key={item} className="flex items-center gap-2"><span>🛡️</span><span>{humanize(item)}</span></div>)}
                  {publicSafetyHazards.map((item) => <div key={item} className="flex items-center gap-2"><span>⚠️</span><span>{item}</span></div>)}
                  {Array.isArray(listing.safetyDisclosures) &&
                    listing.safetyDisclosures.map((d: string, i: number) => {
                      const [k, v] = d.split(":");
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span>ℹ️</span>
                          <span>
                            {k.replace(/_/g, " ").toLowerCase()}: {v}
                          </span>
                        </div>
                      );
                    })}
                  {publicSafetyEquipment.length === 0 && publicSafetyHazards.length === 0 && (!listing.safetyDisclosures || listing.safetyDisclosures.length === 0) && <p>No safety equipment or property hazards have been reported.</p>}
                </div>
              </div>

              {/* Location & Map Section */}
              <div className="space-y-3 pb-6">
                <h3 className="text-base font-bold text-zinc-900">{"Where you'll be"}</h3>
                <p className="text-xs text-zinc-500 font-normal">
                  {locationString}
                  {!listing.showExactLocation && " · Approximate location provided to protect host privacy"}
                </p>
                {publicCoordinates ? (
                  <div className="h-72 w-full rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs">
                    <RealMap
                      lat={publicCoordinates.latitude}
                      lng={publicCoordinates.longitude}
                      address={locationString}
                      showExactLocation={listing.showExactLocation ?? false}
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

                {guidebooks.length > 0 && (
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
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: BOOKING & PRICING PANEL */}
            <div className="lg:col-span-5">
              <div className="sticky top-24 rounded-3xl border border-zinc-200 bg-white p-6 shadow-lg space-y-5">
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
                        <span className="text-2xl font-bold text-zinc-900">SAR {basePriceSAR}</span>
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
                            onChange={(e) => setCheckIn(e.target.value)}
                            className="w-full bg-transparent outline-none font-medium text-zinc-900 text-xs cursor-pointer"
                          />
                        </div>
                        <div className="p-3 space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Checkout
                          </label>
                          <input
                            type="date"
                            value={checkOut}
                            onChange={(e) => setCheckOut(e.target.value)}
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
                          {Array.from({ length: Math.min(listing.guests || 1, 16) }).map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1} {i === 0 ? "guest" : "guests"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {listing.bookingMessage && <p className="rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600 whitespace-pre-wrap">{listing.bookingMessage}</p>}

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
                            SAR {Math.round(quote.baseNightlyPrice / 100)} × {quote.nights}{" "}
                            {quote.nights === 1 ? "night" : "nights"}
                          </span>
                          <span>SAR {Math.round(quote.nightlySubtotal / 100)}</span>
                        </div>

                        {quote.weekendNights > 0 && quote.weekendNightlyPrice && (
                          <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                            <span>Includes {quote.weekendNights} weekend nights</span>
                            <span>SAR {Math.round(quote.weekendNightlyPrice / 100)} / night</span>
                          </div>
                        )}

                        {quote.cleaningFee > 0 && (
                          <div className="flex items-center justify-between text-zinc-600">
                            <span>Cleaning fee</span>
                            <span>SAR {Math.round(quote.cleaningFee / 100)}</span>
                          </div>
                        )}

                        {quote.discountAmount > 0 && <div className="flex items-center justify-between text-emerald-700"><span>{quote.discountPercentage}% length-of-stay discount</span><span>−SAR {Math.round(quote.discountAmount / 100)}</span></div>}

                        {quote.taxes && quote.taxes.length > 0 ? (
                          <>
                            <div className="flex items-center justify-between text-zinc-600">
                              <span>Total before taxes</span>
                              <span>SAR {Math.round((quote.subtotal ?? quote.totalPrice) / 100)}</span>
                            </div>

                            <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                              <div className="flex items-center justify-between text-zinc-600">
                                <span className="flex items-center gap-1.5 font-medium">
                                  Taxes & fees
                                  {quote.taxes.some((t: any) => t.isExempt) && (
                                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-full font-semibold">
                                      Exemption applied
                                    </span>
                                  )}
                                </span>
                                <span className="font-medium">SAR {Math.round((quote.taxTotal || 0) / 100)}</span>
                              </div>
                              <div className="pl-2.5 space-y-1 border-l-2 border-amber-300 text-[11px] text-zinc-500">
                                {quote.taxes.map((t: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between">
                                    <span>
                                      {t.taxName}
                                      {t.rate ? ` (${t.rate}%)` : ""}
                                      {t.isExempt ? ` • ${t.exemptionReason || "Exempt"}` : ""}
                                    </span>
                                    <span>{t.isExempt ? "SAR 0" : `SAR ${Math.round(t.taxAmount / 100)}`}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-sm font-bold text-zinc-900">
                              <span>Total</span>
                              <span>SAR {Math.round((quote.guestTotal ?? quote.totalPrice) / 100)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-sm font-bold text-zinc-900">
                            <span>Total before taxes</span>
                            <span>SAR {Math.round(quote.totalPrice / 100)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reserve CTA */}
                    <button
                      type="button"
                      disabled={isBookingSubmitting || isQuoteLoading}
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
        </Container>
      </main>

      {/* ALL PHOTOS MODAL */}
      {isAllPhotosOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/90 flex flex-col p-4 sm:p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between text-white sticky top-0 bg-black/60 backdrop-blur-md py-3 px-2 z-10">
              <span className="font-semibold text-sm">Photos ({photos.length})</span>
              <button
                type="button"
                onClick={() => setIsAllPhotosOpen(false)}
                className="text-white hover:text-zinc-300 font-bold text-lg cursor-pointer px-3 py-1"
              >
                ✕ Close
              </button>
            </div>
            <div className="space-y-4">
              {photos.map((p: string, i: number) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-zinc-900">
                  <img src={p} alt={`Photo ${i + 1}`} className="w-full h-auto object-contain max-h-[85vh] mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ALL AMENITIES MODAL */}
      {isAllAmenitiesOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-6 max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <h3 className="font-bold text-lg text-zinc-900">What this place offers</h3>
              <button
                type="button"
                onClick={() => setIsAllAmenitiesOpen(false)}
                className="text-zinc-500 hover:text-zinc-900 text-sm font-semibold cursor-pointer p-1"
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

            <div className="flex-1 overflow-y-auto space-y-3 divide-y divide-zinc-100 pr-1">
              {filteredModalAmenities.map((am) => (
                <div key={am.id} className="pt-3 flex items-start gap-3 text-xs">
                  <span className="text-xl">{am.icon || "✓"}</span>
                  <div>
                    <h4 className="font-semibold text-zinc-900">{am.label}</h4>
                    {am.description && <p className="text-[11px] text-zinc-500 mt-0.5">{am.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ModalOverlay>
      )}

      <Footer />
    </div>
  );
}
