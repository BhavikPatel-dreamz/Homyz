import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { Footer } from "@/components/dashboard/footer";
import { HostHeader } from "@/components/host/host-header";
import { HostReviewIntroduction } from "@/components/host/host-review-introduction";
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
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 sm:pb-0">
      <HostHeader />
      <HostSubNav activeTab="today" />
      <main className="flex-1 py-8 sm:py-12">
        <Container>
          {context.eligibility.eligible ? (
            <HostReviewIntroduction context={context} returnHref={returnHref} />
          ) : (
            <section className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-800">!</span>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#1F1F1F]">
                {context.eligibility.status === "REVIEW_SUBMITTED"
                  ? "Review submitted"
                  : context.eligibility.status === "REVIEW_WINDOW_EXPIRED"
                    ? "Review window expired"
                    : "Review unavailable"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {context.eligibility.reason || "This reservation is not eligible for a host review."}
              </p>
              <Link
                href={returnHref}
                className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#1F1F1F] px-6 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
              >
                Back to reservations
              </Link>
            </section>
          )}
        </Container>
      </main>
      <Footer />
    </div>
  );
}
