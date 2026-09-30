import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { HostHeader } from "@/components/host/host-header";
import { Footer } from "@/components/dashboard/footer";
import { HostBookingDetailsClient } from "@/components/host/host-booking-details-client";

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
  const actor = await requirePageRole([Role.HOST]);

  const details = await bookingService.getRequestDetailsForHost(actor, id).catch((err) => {
    if (err?.status === 404 || err?.statusCode === 404) return null;
    throw err;
  });

  if (!details) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <HostHeader />
      <main className="flex-1 px-4 sm:px-6">
        <HostBookingDetailsClient details={details} />
      </main>
      <Footer />
    </div>
  );
}

