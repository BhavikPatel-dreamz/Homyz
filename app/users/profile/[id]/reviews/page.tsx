import { notFound } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { userService } from "@/services/user.service";
import { PublicHostReviewsView } from "@/components/users/public-host-reviews-view";

export default async function HostReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await userService.getPublicHostProfile(id, { reviewLimit: 100 }).catch(() => notFound());
  const { host, reviews, stats } = profile;

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1F1F1F]">
      <AppHeader />
      <main className="flex-1 py-8 sm:py-12">
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
