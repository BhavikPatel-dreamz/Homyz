import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { ListingCard } from "@/components/listings/listing-card";
import { listingService } from "@/services/listing.service";
import type { PublicListingDTO } from "@/services/mappers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stays & Vacation Rentals — Homyz",
  description: "Browse verified homes, villas, apartments, and vacation rentals on Homyz.",
};

interface SearchPageProps {
  searchParams: Promise<{
    city?: string;
    destination?: string;
    checkIn?: string;
    startDate?: string;
    checkOut?: string;
    endDate?: string;
    guests?: string;
    propertyType?: string;
    minPrice?: string;
    maxPrice?: string;
    amenities?: string;
  }>;
}

export default async function ListingsSearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const city = sp.city || sp.destination || undefined;
  const checkIn = sp.checkIn || sp.startDate || undefined;
  const checkOut = sp.checkOut || sp.endDate || undefined;
  const guests = sp.guests ? parseInt(sp.guests, 10) : undefined;
  const propertyType = sp.propertyType || undefined;
  const minPrice = sp.minPrice ? parseInt(sp.minPrice, 10) * 100 : undefined;
  const maxPrice = sp.maxPrice ? parseInt(sp.maxPrice, 10) * 100 : undefined;
  const amenitiesList = sp.amenities ? sp.amenities.split(",").filter(Boolean) : undefined;

  let listings: PublicListingDTO[] = [];
  let total = 0;

  try {
    const res = await listingService.searchPublicListings({
      city,
      checkIn,
      checkOut,
      guests,
      propertyType,
      minPrice,
      maxPrice,
      amenities: amenitiesList,
      take: 40,
    });
    listings = res.items;
    total = res.total;
  } catch (err) {
    console.error("Search query failed:", err);
  }

  const quickFilterAmenities = [
    { id: "wifi", label: "Wi-Fi" },
    { id: "pool", label: "Pool" },
    { id: "air_conditioning", label: "Air conditioning" },
    { id: "kitchen", label: "Kitchen" },
    { id: "free_parking", label: "Free parking" },
    { id: "workspace", label: "Dedicated workspace" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />

      <main className="w-full flex-1 py-8">
        <Container>
          {/* Filter / Search Context Bar */}
          <div className="space-y-4 pb-8 border-b border-zinc-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
                  {city ? `Stays in ${city}` : "All available stays"}
                </h1>
                <p className="text-xs text-zinc-500 font-normal mt-1">
                  {total} {total === 1 ? "stay" : "stays"} available
                  {checkIn && checkOut ? ` · ${checkIn} to ${checkOut}` : ""}
                  {guests ? ` · ${guests} ${guests === 1 ? "guest" : "guests"}` : ""}
                </p>
              </div>

              {/* Destination Search Input Form */}
              <form action="/listings" method="GET" className="flex items-center gap-2">
                <input
                  type="text"
                  name="city"
                  defaultValue={city || ""}
                  placeholder="Destination or city..."
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs text-zinc-800 outline-none focus:border-zinc-900 shadow-2xs w-48 sm:w-60"
                />
                <button
                  type="submit"
                  className="rounded-full bg-zinc-900 text-white text-xs font-semibold px-4 py-2 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Quick Amenity Filters */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2">
              <Link
                href="/listings"
                className={`rounded-full text-xs font-medium px-3.5 py-1.5 transition-all whitespace-nowrap ${
                  !amenitiesList || amenitiesList.length === 0
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                All
              </Link>
              {quickFilterAmenities.map((am) => {
                const isSelected = amenitiesList?.includes(am.id);
                const nextAmenities = isSelected
                  ? amenitiesList?.filter((id) => id !== am.id)
                  : [...(amenitiesList || []), am.id];
                const nextQuery = new URLSearchParams();
                if (city) nextQuery.set("city", city);
                if (guests) nextQuery.set("guests", String(guests));
                if (nextAmenities && nextAmenities.length > 0) {
                  nextQuery.set("amenities", nextAmenities.join(","));
                }

                return (
                  <Link
                    key={am.id}
                    href={`/listings?${nextQuery.toString()}`}
                    className={`rounded-full text-xs font-medium px-3.5 py-1.5 transition-all whitespace-nowrap ${
                      isSelected
                        ? "bg-amber-300 text-amber-950 font-semibold border border-amber-400 shadow-2xs"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {am.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Listings Results Grid */}
          <div className="pt-8">
            {listings.length === 0 ? (
              <div className="py-20 text-center space-y-4 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-xl text-zinc-400">
                  🔍
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-zinc-900">
                    No stays match your search
                  </h2>
                  <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                    Try adjusting your destination, dates, or clearing some filters to find available homes.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/listings"
                    className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-6 py-2.5 transition-all inline-block"
                  >
                    Clear all filters
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {listings.map((item) => (
                  <ListingCard key={item.id} listing={item} />
                ))}
              </div>
            )}
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
