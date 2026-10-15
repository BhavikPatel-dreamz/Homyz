import React from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { PublicHostReviewsSkeleton } from "@/components/users/public-host-reviews-skeleton";

export default function HostReviewsLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1F1F1F]">
      <AppHeader />
      <main className="flex-1 py-8 sm:py-12">
        <Container>
          <PublicHostReviewsSkeleton />
        </Container>
      </main>
      <Footer />
    </div>
  );
}
