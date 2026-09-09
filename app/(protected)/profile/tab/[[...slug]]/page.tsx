import { redirect } from "next/navigation";
import { extractProfileRoute } from "@/lib/profile/tab-utils";
import { loadProfilePageData } from "@/lib/profile/profile-loader";
import { ProfileClient } from "../../profile-client";

export default async function ProfileTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    redirect("/profile");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const route = extractProfileRoute({
    slug,
    searchParams: resolvedSearchParams,
  });

  const data = await loadProfilePageData();

  return (
    <ProfileClient
      initial={data.user}
      initialTripPhotos={data.tripPhotos}
      initialStats={data.stats}
      initialReservations={data.initialReservations}
      isOwner={true}
      initialTab={route.tab}
      initialSubTab={route.subTab}
    />
  );
}

