import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { userService } from "@/services/user.service";
import { PublicHostReviewsView } from "@/components/users/public-host-reviews-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await userService.getPublicHostProfile(id, { reviewLimit: 1 }).catch(() => null);
  const hostName = profile?.host.name || "Host";
  return {
    title: `${hostName}'s Reviews | Homyz`,
    description: `Read verified guest reviews for ${hostName} on Homyz.`,
  };
}

export default async function HostReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await userService.getPublicHostProfile(id, { reviewLimit: 100 }).catch(() => notFound());
  const { host, reviews, stats } = profile;

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1F1F1F] antialiased">
      <AppHeader />
      <main className="w-full flex-1 pb-16 pt-5 sm:pt-8">
        <Container>
          <PublicHostReviewsView
            host={host}
            reviews={reviews}
            stats={stats}
          />
        </Container>
      </main>
      <Footer />
    </div>
  );
}
