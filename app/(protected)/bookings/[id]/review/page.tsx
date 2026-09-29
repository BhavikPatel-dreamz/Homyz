import { redirect } from "next/navigation";
import { BookingReviewWizard } from "@/components/reviews/booking-review-wizard";
import { getCurrencyForCountry } from "@/lib/currency";
import { CurrencyPrice } from "@/components/ui/currency-price";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";

function formatStayDates(startDate: Date | string, endDate: Date | string): string {
  const format = (date: Date | string) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${format(startDate)} – ${format(endDate)}`;
}

export default async function BookingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/bookings/${id}/review`);
  const details = await bookingService.getBookingDetails(user, id).catch(() => redirect(`/bookings/${id}`));

  if (!details.actions.canReview || !details.listing) {
    redirect(`/bookings/${details.booking.id}`);
  }

  const { booking, listing } = details;
  const currency = booking.currency || getCurrencyForCountry(listing.country);

  return (
    <BookingReviewWizard
      bookingId={booking.id}
      listingId={listing.id}
      listingName={listing.title}
      listingPhoto={listing.photos[0] || null}
      location={[listing.city, listing.country].filter(Boolean).join(", ") || null}
      stayDates={formatStayDates(booking.startDate, booking.endDate)}
      totalPaid={<CurrencyPrice amountMinorUnits={booking.totalPrice || 0} sourceCurrency={currency} fractionDigits={2} />}
    />
  );
}
