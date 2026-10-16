import { notFound } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { userService } from "@/services/user.service";
import { PublicHostProfileView } from "@/components/users/public-host-profile-view";

export default async function PublicHostProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await userService.getPublicHostProfile(id).catch(() => notFound());
  const { host, stats, reviews, listings } = profile;

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />
      <main className="w-full flex-1 pb-13 pt-5 sm:pt-10">
        <Container>
          <PublicHostProfileView
            host={host}
            stats={stats}
            reviews={reviews}
            listings={listings}
          />
        </Container>
      </main>
      <Footer />
    </div>
  );
}

