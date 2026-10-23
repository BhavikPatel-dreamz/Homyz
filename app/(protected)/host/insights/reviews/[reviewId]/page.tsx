import React from "react";
import { notFound } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostReviewsInsightsService } from "@/services/host-reviews-insights.service";
import { HostReviewDetailsClient } from "./host-review-details-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostReviewDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ reviewId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const { reviewId } = await params;
  const rawSearchParams = await searchParams;
  const rawReturnTo = Array.isArray(rawSearchParams.returnTo) ? rawSearchParams.returnTo[0] : rawSearchParams.returnTo;
  const returnTo = rawReturnTo?.startsWith("/host/insights") ? rawReturnTo : "/host/insights?tab=reviews";

  let review;
  try {
    review = await hostReviewsInsightsService.getHostReviewDetails(actor, reviewId);
  } catch {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50/60 pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 pb-16 pt-8 sm:pb-24 sm:pt-10">
        <Container className="max-w-5xl px-4 sm:px-6">
          <HostReviewDetailsClient review={review} returnTo={returnTo} />
        </Container>
      </main>
    </div>
  );
}
