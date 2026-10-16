import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingService } from "@/services/listing.service";
import { cookies } from "next/headers";
import { LAST_SEARCH_COOKIE, parseServerLastSearch } from "@/lib/storage/client-history";
import { BookingCheckoutClient } from "./booking-checkout-client";

interface BookPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    checkin?: string;
    checkout?: string;
    startDate?: string;
    endDate?: string;
    guests?: string;
    adults?: string;
    children?: string;
    infants?: string;
    pets?: string;
    nonRefundable?: string;
    specialOfferId?: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const listing = await listingService.getPublicListingById(id);
    return {
      title: `${listing.bookingMode === "INSTANT_BOOK" ? "Confirm booking" : "Request to book"} — ${listing.title} — Homyz`,
      description: `Complete your reservation for ${listing.title} on Homyz.`,
    };
  } catch {
    return {
      title: "Booking checkout — Homyz",
    };
  }
}

export default async function BookListingPage({ params, searchParams }: BookPageProps) {
  const { id } = await params;
  const sp = await searchParams;

  let listing;
  try {
    listing = await listingService.getPublicListingById(id);
  } catch {
    try {
      listing = await listingService.getPublicListingBySlug(id);
    } catch {
      notFound();
    }
  }

  const cookieStore = await cookies();
  const serverLastSearch = parseServerLastSearch(cookieStore.get(LAST_SEARCH_COOKIE)?.value);

  const checkIn = sp.checkIn || sp.checkin || sp.startDate || serverLastSearch?.checkIn || undefined;
  const checkOut = sp.checkOut || sp.checkout || sp.endDate || serverLastSearch?.checkOut || undefined;
  const parseCount = (value: string | number | null | undefined, fallback: number, minimum: number) => {
    const parsed = typeof value === "number" ? value : Number.parseInt(value || "", 10);
    return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
  };
  const guests = parseCount(sp.guests ?? serverLastSearch?.guests, 1, 1);
  const adults = parseCount(sp.adults ?? serverLastSearch?.adults, guests, 1);
  const children = parseCount(sp.children ?? serverLastSearch?.children, 0, 0);
  const infants = parseCount(sp.infants ?? serverLastSearch?.infants, 0, 0);
  const pets = parseCount(sp.pets ?? serverLastSearch?.pets, 0, 0);
  const specialOfferId = sp.specialOfferId || serverLastSearch?.specialOfferId || undefined;

  return (
    <BookingCheckoutClient
      listing={listing}
      initialCheckIn={checkIn}
      initialCheckOut={checkOut}
      initialGuests={guests}
      initialAdults={adults}
      initialChildren={children}
      initialInfants={infants}
      initialPets={pets}
      initialNonRefundable={sp.nonRefundable === "true"}
      initialSpecialOfferId={specialOfferId}
    />
  );
}
