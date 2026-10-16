import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { BookingDetailsClient } from "@/components/bookings/booking-details-client";
import { toReservationCardData } from "@/lib/profile/reservation-data";
import { BookingDetailsActions } from "@/components/bookings/booking-details-actions";

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

  return <BookingDetailsClient data={details} />;
}
