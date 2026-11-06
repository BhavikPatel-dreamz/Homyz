import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { BookingDetailsClient } from "@/components/bookings/booking-details-client";
import { toReservationCardData } from "@/lib/profile/reservation-data";
import { BookingDetailsActions } from "@/components/bookings/booking-details-actions";
import { prisma } from "@/lib/db/prisma";
import { ListingCoHostStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Reservation Details #${id.slice(-8).toUpperCase()} | Homyz`,
    description: "View and manage your reservation details, check-in instructions, receipt, and stay information.",
  };
}

export default async function BookingDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePageUser(`/bookings/${id}`);

  const details = await bookingService.getBookingDetails(user, id).catch(() => null);
  if (!details) {
    notFound();
  }

  // Symmetrical mode guard:
  // If the user is the Host of the property (and not the guest who made this reservation),
  // redirect them to the dedicated Host booking details screen to preserve Hosting mode.
  if (details.listing?.host?.id === user.id && details.guest?.id !== user.id) {
    redirect(`/host/bookings/${id}`);
  }

  // Also check if user is an accepted co-host of this listing
  if (details.guest?.id !== user.id && details.listing?.id) {
    const isCoHost = await prisma.listingCoHost.findFirst({
      where: {
        listingId: details.listing.id,
        userId: user.id,
        status: ListingCoHostStatus.ACCEPTED,
      },
      select: { id: true },
    });
    if (isCoHost) {
      redirect(`/host/bookings/${id}`);
    }
  }

  return <BookingDetailsClient data={details} />;
}
