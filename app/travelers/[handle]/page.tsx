import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { userService } from "@/services/user.service";
import { travelSocialLikesService } from "@/services/travel-social-likes.service";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";
import { GuestTravelProfileView } from "@/components/travel/guest-travel-profile-view";
import { toTravelProfileDto } from "@/services/travel-profile.service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle}'s Travel Profile | Homyz`,
    description: `Explore travel photos and visited destinations of @${handle} on Homyz.`,
  };
}

export default async function PublicTravelerProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const sessionUser = await getSessionUser();

  const profile = await prisma.travelProfile.findFirst({
    where: {
      OR: [{ handle }, { userId: handle }],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          email: true,
          createdAt: true,
          role: true,
        },
      },
    },
  });

  if (!profile || !profile.user) {
    notFound();
  }

  // If viewing own profile, redirect to dedicated owner travel profile
  if (sessionUser?.id === profile.userId) {
    redirect("/travel-profile");
  }

  // Mutual blocking check
  if (sessionUser) {
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: sessionUser.id, blockedId: profile.userId },
          { blockerId: profile.userId, blockedId: sessionUser.id },
        ],
      },
    });

    if (block) {
      notFound();
    }
  }

  // Privacy check
  if (!profile.isPublic) {
    return (
      <div className="flex min-h-screen flex-col text-muted-foreground">
        <AppHeader />
        <Container as="main" className="flex-1 py-16 text-center">
          <div className="max-w-md mx-auto p-8 rounded-3xl bg-zinc-50 border border-zinc-200">
            <span className="text-4xl">🔒</span>
            <h1 className="mt-4 text-xl font-bold text-zinc-900">This profile is private</h1>
            <p className="mt-2 text-xs text-zinc-500">
              @{profile.handle || "traveler"} has set their travel profile to private.
            </p>
          </div>
        </Container>
        <Footer />
      </div>
    );
  }

  const [baseStats, receivedLikes] = await Promise.all([
    userService.getUserStats(profile.userId).catch(() => ({ trips: 0, reviews: 0 })),
    travelSocialLikesService.getTotalReceivedLikes(profile.userId).catch(() => 0),
  ]);

  const stats = {
    trips: baseStats.trips,
    likes: receivedLikes,
    reviews: baseStats.reviews,
    likesSupported: true,
  };

  return (
    <div className="flex min-h-screen flex-col text-muted-foreground">
      <AppHeader />
      <Container as="main" className="flex-1 py-8">
        <GuestTravelProfileView
          user={profile.user}
          initialProfile={toTravelProfileDto(profile)}
          initialStats={stats}
          isOwner={false}
        />
      </Container>
      <Footer />
    </div>
  );
}

