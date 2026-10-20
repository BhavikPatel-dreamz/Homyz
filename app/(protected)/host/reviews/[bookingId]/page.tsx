import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { Footer } from "@/components/dashboard/footer";
import { HostHeader } from "@/components/host/host-header";
import { HostReviewIntroduction } from "@/components/host/host-review-introduction";
import { HostReviewIneligibleCard } from "@/components/host/host-review-ineligible-card";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Container } from "@/components/ui";
import { AppError } from "@/lib/api/errors";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { getHostReviewContext } from "@/services/host-review.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostReviewPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const context = await getHostReviewContext(actor, bookingId).catch((error) => {
    // Do not disclose whether another host has a reservation with this ID.
    if (error instanceof AppError && (error.status === 403 || error.status === 404)) return null;
    throw error;
  });
  if (!context) notFound();

  const returnHref = `/host/today?tab=completed&reservation=${encodeURIComponent(context.bookingId)}&listing=${encodeURIComponent(context.listing.id)}`;

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] text-zinc-900 sm:pb-0">
      <HostHeader />
      <HostSubNav activeTab="today" />
      <main className="flex-1 py-8 sm:py-12">
        <Container>
          {context.eligibility.eligible ? (
            <HostReviewIntroduction context={context} returnHref={returnHref} />
          ) : (
            <HostReviewIneligibleCard
              status={context.eligibility.status}
              reason={context.eligibility.reason}
              returnHref={returnHref}
            />
          )}
        </Container>
      </main>
      <Footer />
    </div>
  );
}
