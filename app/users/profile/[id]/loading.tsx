import React from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { PublicHostProfileSkeleton } from "@/components/users/public-host-profile-skeleton";

export default function PublicHostProfileLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />
      <main className="w-full flex-1 pb-13 pt-5 sm:pt-10">
        <Container>
          <PublicHostProfileSkeleton />
        </Container>
      </main>
      <Footer />
    </div>
  );
}
