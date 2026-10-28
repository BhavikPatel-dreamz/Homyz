import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import {
  getPublicTravelProfileByHandle,
  getCanonicalProfileUrl,
} from "@/services/public-travel-profile.service";
import { PublicTravelProfileClient } from "@/components/travel/public-travel-profile-client";
import { TravelProfileVisibility } from "@/generated/prisma/client";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  try {
    const profile = await getPublicTravelProfileByHandle(handle, null);

    // Private or followers-only profiles must not be indexed by search engines
    if (profile.visibility !== TravelProfileVisibility.PUBLIC || !profile.canViewContent) {
      return {
        title: `${profile.displayName} (@${profile.handle}) — Travel Profile`,
        robots: {
          index: false,
          follow: false,
          noarchive: true,
        },
      };
    }

    const title = `${profile.displayName} (@${profile.handle}) — Travel Profile | Homyz`;
    const description =
      profile.bio ||
      `Explore ${profile.displayName}'s shared travel diary, visited destinations, and travel stamps on Homyz.`;
    const canonical = getCanonicalProfileUrl(profile.handle);
    const ogImage = profile.coverUrl || profile.avatarUrl || "/images/auth-traveler-street.jpg";

    return {
      title,
      description,
      alternates: {
        canonical,
      },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: "Homyz",
        type: "profile",
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: `${profile.displayName}'s Travel Profile`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  } catch (err) {
    return {
      title: "Traveler Profile — Homyz",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default async function PublicTravelerPage({ params }: PageProps) {
  const { handle } = await params;
  const viewer = await getSessionUser();

  let profile;
  try {
    profile = await getPublicTravelProfileByHandle(handle, viewer?.id);
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.status === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased">
      <AppHeader />
      <main className="w-full flex-1 pt-4 sm:pt-8">
        <PublicTravelProfileClient
          profile={profile}
          currentUserId={viewer?.id}
        />
      </main>
      <Footer />
    </div>
  );
}

