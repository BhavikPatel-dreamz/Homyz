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

  // Canonicalize personal_info aliases to /profile/tab/account_settings
  // (Supports /account-settings/personal-info integrated directly within My profile tabs)
  if (slug[0] === "personal-info" || slug[0] === "personal_info" || slug[0] === "account-settings") {
    redirect("/profile/tab/account_settings");
  }

  const data = await loadProfilePageData(route.tab, route.subTab);

  return (
    <ProfileClient
      initial={data.user}
      initialTripPhotos={data.tripPhotos}
      initialTripPhotosLoaded={data.tripPhotosLoaded}
      initialStats={data.stats}
      initialReservations={data.initialReservations}
      initialFavorites={data.initialFavorites}
      initialFavoritesTotal={data.initialFavoritesTotal}
      initialReviews={data.initialReviews}
      initialNotifications={data.initialNotifications}
      initialPersonalInfo={data.initialPersonalInfo}
      isOwner={true}
      initialTab={route.tab}
      initialSubTab={route.subTab}
    />
  );
}
