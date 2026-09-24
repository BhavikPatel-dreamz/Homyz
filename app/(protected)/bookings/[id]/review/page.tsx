import { redirect } from "next/navigation";
import { BookingReviewWizard } from "@/components/reviews/booking-review-wizard";
import { getCurrencyForCountry } from "@/lib/currency";
import { CurrencyPrice } from "@/components/ui/currency-price";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { reviewService } from "@/services/review.service";

function formatStayDates(startDate: Date | string, endDate: Date | string): string {
  const format = (date: Date | string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${format(startDate)} – ${format(endDate)}`;
}

export default async function BookingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/bookings/${id}/review`);
  const booking = await bookingService.getById(user, id).catch(() => redirect(`/bookings/${id}`));
  const alreadyReviewed = await reviewService.hasReviewForBooking(booking.id);
  const eligible = booking.status === "CONFIRMED" && new Date(booking.endDate) < new Date() && !alreadyReviewed;
  if (!eligible || !booking.listing) redirect(`/bookings/${booking.id}`);

  const currency = booking.currency || getCurrencyForCountry(booking.listing.country);
  return <BookingReviewWizard
    bookingId={booking.id}
    listingId={booking.listing.id}
    listingName={booking.listing.title}
    listingPhoto={booking.listing.photos[0] || null}
    location={[booking.listing.city, booking.listing.country].filter(Boolean).join(", ") || null}
    stayDates={formatStayDates(booking.startDate, booking.endDate)}
    totalPaid={<CurrencyPrice amountMinorUnits={booking.totalPrice || 0} sourceCurrency={currency} />}
  />;
}
