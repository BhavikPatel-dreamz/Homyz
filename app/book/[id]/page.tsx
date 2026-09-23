import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listingService } from "@/services/listing.service";
import { BookingCheckoutClient } from "./booking-checkout-client";

interface BookPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pets?: string;
    nonRefundable?: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const listing = await listingService.getPublicListingById(id);
    return {
      title: `Request to book — ${listing.title} — Homyz`,
      description: `Complete your reservation for ${listing.title} on Homyz.`,
    };
  } catch {
    return {
      title: "Request to book — Homyz",
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

  return (
    <BookingCheckoutClient
      listing={listing}
      initialCheckIn={sp.checkIn}
      initialCheckOut={sp.checkOut}
      initialGuests={sp.guests ? parseInt(sp.guests, 10) : 1}
      initialPets={sp.pets ? parseInt(sp.pets, 10) : 0}
      initialNonRefundable={sp.nonRefundable === "true"}
    />
  );
}

