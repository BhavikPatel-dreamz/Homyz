import type { Metadata } from "next";
import { HomeView } from "@/components/home/home-view";
import { listingService } from "@/services/listing.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Homyz - Book cozy stays that feel like home",
  description:
    "Explore hand-picked apartments, lofts, villas, and cozy homes across Riyadh, Jeddah, and top destinations.",
  openGraph: {
    title: "Homyz - Book cozy stays that feel like home",
    description:
      "Book cozy stays that feel like home. Explore top destinations and hand-picked properties.",
    siteName: "Homyz",
  },
};

export default async function HomePage() {
  let listings: any[] = [];
  try {
    const res = await listingService.searchPublicListings({ take: 24 });
    listings = res.items;
  } catch (error) {
    console.error("Failed to load public listings for home page:", error);
  }

  return <HomeView initialListings={listings} />;
}

