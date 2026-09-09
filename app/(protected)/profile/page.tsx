import { redirect } from "next/navigation";
import { extractProfileRoute, getProfileTabHref } from "@/lib/profile/tab-utils";
import { loadProfilePageData } from "@/lib/profile/profile-loader";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const route = extractProfileRoute({ searchParams: resolvedSearchParams });

  // Convert old query format (e.g. /profile?tab/notifications) to clean pathname /profile/tab/notifications
  if (route.hasQueryTab) {
    const target = getProfileTabHref(route.tab, route.subTab);
    redirect(target);
  }

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
