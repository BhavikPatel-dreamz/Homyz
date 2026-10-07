import "server-only";
import { prisma } from "@/lib/db/prisma";
import { BookingStatus, ReviewStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { listingService } from "@/services/listing.service";
import { bookingDateKey } from "@/lib/booking/booking-date";
import { isBookingRequestExpired } from "@/lib/booking/booking-expiry";
import { getHostReviewEligibility } from "@/lib/booking/host-review-eligibility";
import type { HostReservation } from "@/components/host/host-workspace-shared";

type WorkspaceBooking = {
  id: string;
  listingId: string;
  status: string;
  startDate: Date;
  endDate: Date;
  guests: number;
  totalPrice: number | null;
  nightlyPrice: number | null;
  cleaningFee: number | null;
  currency: string;
  priceBreakdown: HostReservation["priceBreakdown"];
  cancellationPolicy: string | null;
  isNonRefundable: boolean;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
    createdAt: Date;
  };
  conversations: Array<{ id: string }>;
  hostGuestReview: { submittedAt: Date } | null;
  reviews: Array<{ id: string }>;
  listing: {
    id: string;
    title: string;
    city: string;
    district: string | null;
    country: string;
    photos: string[];
    checkInStart: string | null;
    checkInEnd: string | null;
    checkOutTime: string | null;
    price: number;
    hostId: string;
  };
};

export async function getHostWorkspace(
  actor: AuthUser,
  { includeCancelled = false }: { includeCancelled?: boolean } = {},
) {
  const { items: listings } = await listingService.listForHost(actor, {
    take: 100,
  });

  const listingIds = listings.map((listing) => listing.id);
  if (listingIds.length === 0) {
    return {
      listings: [],
      bookings: [],
    };
  }

  const now = new Date();

  const bookingStatuses = includeCancelled
    ? [BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.CANCELLED]
    : [BookingStatus.CONFIRMED, BookingStatus.PENDING];

  const bookings = await prisma.booking.findMany({
    where: {
      listingId: { in: listingIds },
      status: { in: bookingStatuses },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          email: true,
          createdAt: true,
        },
      },
      conversations: {
        select: { id: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      hostGuestReview: {
        select: { submittedAt: true },
      },
      // List cards need only whether the guest has submitted a public review.
      // The review text and private note are loaded on demand from the modal.
      reviews: {
        where: { status: ReviewStatus.PUBLISHED },
        select: { id: true },
        take: 1,
      },
      listing: {
        select: {
          id: true,
          title: true,
          city: true,
          district: true,
          country: true,
          photos: true,
          checkInStart: true,
          checkInEnd: true,
          checkOutTime: true,
          price: true,
          hostId: true,
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });

  // Filter out expired pending requests. Cancelled bookings are included only
  // for the Today page; calendar callers retain the active-booking default.
  const visibleBookings = (bookings as unknown as WorkspaceBooking[]).filter((b) => {
    if (b.status === BookingStatus.PENDING) {
      return !isBookingRequestExpired(b.createdAt, now, b.endDate);
    }
    return b.status === BookingStatus.CONFIRMED
      || (includeCancelled && b.status === BookingStatus.CANCELLED);
  });

  return {
    listings,
    bookings: visibleBookings.map((b) => ({
      id: b.id,
      listingId: b.listingId,
      status: b.status,
      startDate: bookingDateKey(b.startDate),
      endDate: bookingDateKey(b.endDate),
      guests: b.guests || 1,
      totalPrice: b.totalPrice,
      nightlyPrice: b.nightlyPrice,
      currency: b.currency || "SAR",
      priceBreakdown: b.priceBreakdown,
      cancellationPolicy: b.cancellationPolicy,
      isNonRefundable: b.isNonRefundable,
      hostReview: (() => {
        const eligibility = getHostReviewEligibility({
          // The query is already scoped to listing IDs returned by
          // listForHost(actor), including accepted co-host assignments.
          isAuthorizedHost: true,
          bookingStatus: b.status,
          endDate: b.endDate,
          checkOutTime: b.listing.checkOutTime,
          hasHostReview: Boolean(b.hostGuestReview),
          now,
        });
        return {
          eligible: eligibility.eligible,
          status: eligibility.status,
          reviewDeadline: eligibility.reviewDeadline?.toISOString() ?? null,
          reviewSubmitted: eligibility.reviewSubmitted,
        };
      })(),
      guestReview: {
        status: b.reviews.length > 0 ? "RECEIVED" as const : "PENDING" as const,
        reviewId: b.reviews[0]?.id ?? null,
      },
      createdAt: b.createdAt.toISOString(),
      guestName: b.user?.name || "Guest",
      guestId: b.user?.id,
      guestImage: b.user?.image || null,
      guestEmail: b.user?.email || null,
      guestCreatedAt: b.user?.createdAt?.toISOString() || null,
      conversationId: b.conversations?.[0]?.id || null,
      listing: {
        id: b.listing.id,
        title: b.listing.title,
        city: b.listing.city,
        district: b.listing.district,
        country: b.listing.country,
        photos: b.listing.photos,
        checkInStart: b.listing.checkInStart || "15:00",
        checkInEnd: b.listing.checkInEnd || "22:00",
        checkOutTime: b.listing.checkOutTime || "11:00",
        price: b.listing.price,
      },
    })),
  };
}
