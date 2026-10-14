import { redirect } from "next/navigation";
import { BookingReviewWizard } from "@/components/reviews/booking-review-wizard";
import { getCurrencyForCountry } from "@/lib/currency";
import { CurrencyPrice } from "@/components/ui/currency-price";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { reviewService } from "@/services/review.service";
import { prisma } from "@/lib/db/prisma";

function formatStayDates(startDate: Date | string, endDate: Date | string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const monthStart = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const dayStart = start.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const monthEnd = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const dayEnd = end.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const yearStart = start.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
  const yearEnd = end.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });

  if (yearStart !== yearEnd) {
    return `${monthStart} ${dayStart}, ${yearStart} - ${monthEnd} ${dayEnd}, ${yearEnd}`;
  }
  return `${monthStart} ${dayStart} - ${monthEnd} ${dayEnd}, ${yearEnd}`;
}

export default async function BookingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/bookings/${id}/review`);
  const details = await bookingService.getBookingDetails(user, id).catch(() => redirect(`/bookings/${id}`));

  if (!details.actions.canReview || !details.listing) {
    redirect(`/bookings/${details.booking.id}`);
  }

  const { booking, listing } = details;
  const currency = booking.currency || getCurrencyForCountry(listing.country) || "SAR";
  const currencyCode = currency === "SAR" ? "SR" : currency;

  const [stats, extraListing] = await Promise.all([
    reviewService.getReviewStats(listing.id).catch(() => null),
    prisma.listing
      .findUnique({
        where: { id: listing.id },
        select: { isGuestFavorite: true, description: true },
      })
      .catch(() => null),
  ]);

  return (
    <BookingReviewWizard
      bookingId={booking.id}
      listingId={listing.id}
      listingName={listing.title}
      listingDescription={extraListing?.description || listing.description || ""}
      hostName={listing.host?.name || null}
      listingPhoto={listing.photos[0] || null}
      location={[listing.city, listing.country].filter(Boolean).join(", ") || null}
      stayDates={formatStayDates(booking.startDate, booking.endDate)}
      currencyCode={currencyCode}
      averageRating={stats?.averageRating ?? null}
      reviewsCount={stats?.totalCount ?? 0}
      isGuestFavorite={extraListing?.isGuestFavorite ?? true}
      totalPaid={<CurrencyPrice amountMinorUnits={booking.totalPrice || 0} sourceCurrency={currency} fractionDigits={2} />}
    />
  );
}
