import type { Metadata } from "next";
import { HomeView } from "@/components/home/home-view";

export const metadata: Metadata = {
  title: "Homyz - Book cozy stays that feel like home",
  description:
    "Explore guest-favorite apartments, lofts, villas, and cozy homes in Paris, Hamburg, Berlin, Barcelona, Milan, Lisbon, and around the world.",
  openGraph: {
    title: "Homyz - Book cozy stays that feel like home",
    description:
      "Book cozy stays that feel like home. Explore top destinations and hand-picked properties.",
    siteName: "Homyz",
  },
};

export default function HomePage() {
  return <HomeView />;
}
