import type { Metadata } from "next";
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
  searchParams: Promise<{ city?: string; destination?: string }>;
}) {
  let sections: HomepageSection[] = [];
  const user = await getSessionUser();
  try {
    const params = await searchParams;
    const homepage = await homepageService.getHomepageData({
      city: params.city || params.destination,
      userId: user?.id,
    });
    sections = homepage.sections;
  } catch (error) {
    console.error("Failed to load homepage discovery data:", error);
  }

  return <HomeView sections={sections} canFavorite={Boolean(user)} />;
}
