import "server-only";
import { prisma } from "@/lib/db/prisma";
import { BookingStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { listingService } from "@/services/listing.service";
import { bookingDateKey } from "@/lib/booking/booking-date";
import { isBookingRequestExpired } from "@/lib/booking/booking-expiry";

export async function getHostWorkspace(actor: AuthUser) {
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

  const bookings = await prisma.booking.findMany({
    where: {
      listingId: { in: listingIds },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
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

  // Filter out expired pending requests so they do not pollute active operational views
  const activeBookings = (bookings as any[]).filter((b: any) => {
    if (b.status === BookingStatus.PENDING) {
      return !isBookingRequestExpired(b.createdAt, now, b.endDate);
    }
    return b.status === BookingStatus.CONFIRMED;
  });

  return {
    listings,
    bookings: activeBookings.map((b: any) => ({
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
