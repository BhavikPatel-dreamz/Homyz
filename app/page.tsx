import type { Metadata } from "next";
import { headers } from "next/headers";
import { HomeView } from "@/components/home/home-view";
import { homepageService, type HomepageSection } from "@/services/homepage.service";
import { getSessionUser } from "@/lib/auth/session";

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; destination?: string; placeName?: string; lat?: string; lng?: string; ip?: string }>;
}) {
  let sections: HomepageSection[] = [];
  let trendingLocations: Awaited<ReturnType<typeof homepageService.getHomepageData>>["trendingLocations"] = [];
  const user = await getSessionUser();

  try {
    const params = await searchParams;
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for");
    const realIp = headerStore.get("x-real-ip");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || null;
    const parsedLat = params.lat ? Number(params.lat) : null;
    const parsedLng = params.lng ? Number(params.lng) : null;
    const homepage = await homepageService.getHomepageData({
      city: params.city || params.destination || params.placeName,
      userId: user?.id,
      requestContext: {
        city: params.city || params.destination || null,
        destination: params.destination || params.city || null,
        placeName: params.placeName || null,
        lat: Number.isFinite(parsedLat) ? parsedLat : null,
        lng: Number.isFinite(parsedLng) ? parsedLng : null,
        ip: requestIp || params.ip || null,
      },
    });
    sections = homepage.sections;
    trendingLocations = homepage.trendingLocations;
  } catch (error) {
    console.error("Failed to load homepage discovery data:", error);
  }

  return <HomeView sections={sections} trendingLocations={trendingLocations} canFavorite={Boolean(user)} />;
}
