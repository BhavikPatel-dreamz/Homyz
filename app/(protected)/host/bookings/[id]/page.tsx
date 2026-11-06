import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { disputeService } from "@/services/dispute.service";
import { HostHeader } from "@/components/host/host-header";
import { HostBookingDetailsClient } from "@/components/host/host-booking-details-client";
import { prisma } from "@/lib/db/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Booking Request #${id.slice(-8).toUpperCase()} | Host Dashboard | Homyz`,
    description: "Review and manage guest booking requests, timeline milestones, and stay details.",
  };
}

export default async function HostBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);

  let details;
  try {
    details = await bookingService.getRequestDetailsForHost(actor, id);
  } catch (err: any) {
    if (err?.status === 404 || err?.statusCode === 404) {
      notFound();
    }
    if (err?.isGuest) {
      redirect(`/bookings/${id}`);
    }
    if (err?.status === 403 || err?.statusCode === 403) {
      const isGuest = await prisma.booking.findFirst({
        where: { id, userId: actor.id },
        select: { id: true },
      });
      if (isGuest) {
        redirect(`/bookings/${id}`);
      }
      notFound();
    }
    throw err;
  }

  if (!details) {
    notFound();
  }

  const relatedCases = actor.role === Role.HOST
    ? await disputeService.listDisputesForHost(actor, { bookingId: details.id, limit: 20 })
    : { disputes: [] };

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <HostHeader />
      <main className="flex-1 px-4 sm:px-6">
        <HostBookingDetailsClient details={details} relatedCases={relatedCases.disputes.map((dispute: {
          id: string;
          caseReference: string;
          disputeWorkflowStatus: string;
          responseRequired: boolean;
        }) => ({
          id: dispute.id,
          caseReference: dispute.caseReference,
          disputeWorkflowStatus: dispute.disputeWorkflowStatus,
          responseRequired: dispute.responseRequired,
        }))} />
      </main>
    </div>
  );
}
