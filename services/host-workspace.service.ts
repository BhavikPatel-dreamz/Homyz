import "server-only";
import { prisma } from "@/lib/db/prisma";
import { BookingStatus, ReviewStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/lib/auth/types";
import { listingService } from "@/services/listing.service";
import { bookingDateKey } from "@/lib/booking/booking-date";
import { getExpiryThresholdDate } from "@/lib/booking/booking-expiry";
import { getHostReviewEligibility } from "@/lib/booking/host-review-eligibility";
import type { HostReservation } from "@/components/host/host-workspace-shared";
import type { ReservationPeriod } from "@/lib/booking/host-reservation-events";

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
  priceBreakdown?: HostReservation["priceBreakdown"];
  cancellationPolicy?: string | null;
  isNonRefundable: boolean;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    email?: string | null;
    createdAt?: Date;
  };
  conversations?: Array<{ id: string }>;
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
  };
};

export type GetHostWorkspaceOptions = {
  includeCancelled?: boolean;
  tab?: ReservationPeriod;
  propertyId?: string | null;
  page?: number;
  limit?: number;
  lightweight?: boolean;
};

type ReservationQuery = {
  where: Prisma.BookingWhereInput;
  orderBy: Prisma.BookingOrderByWithRelationInput[];
};

/** One shared scope keeps tab cards and their count in sync. */
export function buildHostReservationQuery({
  listingIds,
  propertyId,
  tab,
  includeCancelled,
  now,
}: {
  listingIds: string[];
  propertyId?: string | null;
  tab?: ReservationPeriod;
  includeCancelled: boolean;
  now: Date;
}): ReservationQuery {
  const today = new Date(`${bookingDateKey(now)}T00:00:00.000Z`);
  const listingScope: Prisma.BookingWhereInput =
    propertyId && listingIds.includes(propertyId)
      ? { listingId: propertyId }
      : { listingId: { in: listingIds } };
  const activePending: Prisma.BookingWhereInput = {
    status: BookingStatus.PENDING,
    createdAt: { gt: getExpiryThresholdDate(now) },
    endDate: { gt: today },
  };

  if (tab === "today") {
    const todayScope: Prisma.BookingWhereInput = {
      startDate: { lte: today },
      endDate: { gte: today },
    };
    return {
      where: {
        ...listingScope,
        OR: [
          { status: BookingStatus.CONFIRMED, ...todayScope },
          { AND: [activePending, todayScope] },
        ],
      },
      orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { id: "asc" }],
    };
  }

  if (tab === "upcoming") {
    const future: Prisma.BookingWhereInput = { startDate: { gt: today } };
    return {
      where: {
        ...listingScope,
        OR: [
          { status: BookingStatus.CONFIRMED, ...future },
          { AND: [activePending, future] },
        ],
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    };
  }

  if (tab === "staying") {
    return {
      where: {
        ...listingScope,
        status: BookingStatus.CONFIRMED,
        startDate: { lte: today },
        endDate: { gt: today },
      },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    };
  }

  if (tab === "completed") {
    return {
      where: {
        ...listingScope,
        status: BookingStatus.CONFIRMED,
        endDate: { lte: today },
      },
      orderBy: [{ endDate: "desc" }, { id: "asc" }],
    };
  }

  if (tab === "pending") {
    return {
      where: { ...listingScope, ...activePending },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    };
  }

  if (tab === "cancelled") {
    return {
      where: { ...listingScope, status: BookingStatus.CANCELLED },
      orderBy: [{ endDate: "desc" }, { id: "asc" }],
    };
  }

  if (tab === "all") {
    return {
      where: {
        ...listingScope,
        OR: [
          { status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] } },
          activePending,
        ],
      },
      orderBy: [{ endDate: "desc" }, { id: "asc" }],
    };
  }

  const statuses = includeCancelled
    ? [BookingStatus.CONFIRMED, BookingStatus.CANCELLED]
    : [BookingStatus.CONFIRMED];

  return {
    where: { ...listingScope, OR: [{ status: { in: statuses } }, activePending] },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  };
}

export async function getHostWorkspace(
  actor: AuthUser,
  {
    includeCancelled = false,
    tab,
    propertyId,
    page,
    limit,
    lightweight = false,
  }: GetHostWorkspaceOptions = {},
) {
  const { items: listings } = await listingService.listForHost(actor, { take: 100 });
  const listingIds = listings.map((listing) => listing.id);

  const isPaginated = tab !== undefined || page !== undefined || limit !== undefined;
  const safePage = Math.max(1, page ?? 1);
  const safeLimit = Math.min(100, Math.max(1, limit ?? 12));

  if (!listingIds.length) {
    return {
      listings: [],
      bookings: [],
      items: [],
      total: 0,
      totalCount: 0,
      page: safePage,
      totalPages: 0,
      hasMore: false,
      nextCursor: null,
    };
  }

  const now = new Date();
  const { where, orderBy } = buildHostReservationQuery({
    listingIds,
    propertyId,
    tab,
    includeCancelled,
    now,
  });

  const select = {
    id: true,
    listingId: true,
    status: true,
    startDate: true,
    endDate: true,
    guests: true,
    totalPrice: true,
    nightlyPrice: true,
    cleaningFee: true,
    currency: true,
    isNonRefundable: true,
    createdAt: true,
    ...(lightweight ? {} : { priceBreakdown: true, cancellationPolicy: true }),
    user: {
      select: {
        id: true,
        name: true,
        image: true,
        ...(lightweight ? {} : { email: true, createdAt: true }),
      },
    },
    conversations: {
      select: { id: true },
      orderBy: { updatedAt: "desc" },
      take: 1,
    },
    hostGuestReview: { select: { submittedAt: true } },
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
      },
    },
  } satisfies Prisma.BookingSelect;

  const [rows, totalCount] = await Promise.all([
    isPaginated
      ? prisma.booking.findMany({
          where,
          select,
          orderBy,
          skip: (safePage - 1) * safeLimit,
          take: safeLimit,
        })
      : prisma.booking.findMany({ where, select, orderBy }),
    prisma.booking.count({ where }),
  ]);

  const bookings = (rows as unknown as WorkspaceBooking[]).map((booking) =>
    mapBooking(booking, now),
  );
  const totalPages = isPaginated ? Math.ceil(totalCount / safeLimit) : 1;

  return {
    listings,
    bookings,
    items: bookings,
    total: totalCount,
    totalCount,
    page: safePage,
    totalPages,
    hasMore: isPaginated ? safePage < totalPages : false,
    nextCursor: null,
  };
}

function mapBooking(booking: WorkspaceBooking, now: Date): HostReservation {
  const eligibility = getHostReviewEligibility({
    isAuthorizedHost: true,
    bookingStatus: booking.status,
    endDate: booking.endDate,
    checkOutTime: booking.listing.checkOutTime,
    hasHostReview: Boolean(booking.hostGuestReview),
    now,
  });

  return {
    id: booking.id,
    listingId: booking.listingId,
    status: booking.status,
    startDate: bookingDateKey(booking.startDate),
    endDate: bookingDateKey(booking.endDate),
    guests: booking.guests || 1,
    totalPrice: booking.totalPrice,
    nightlyPrice: booking.nightlyPrice,
    cleaningFee: booking.cleaningFee,
    currency: booking.currency || "SAR",
    priceBreakdown: booking.priceBreakdown,
    cancellationPolicy: booking.cancellationPolicy,
    isNonRefundable: booking.isNonRefundable,
    hostReview: {
      eligible: eligibility.eligible,
      status: eligibility.status,
      reviewDeadline: eligibility.reviewDeadline?.toISOString() ?? null,
      reviewSubmitted: eligibility.reviewSubmitted,
    },
    guestReview: {
      status: booking.reviews.length ? "RECEIVED" : "PENDING",
      reviewId: booking.reviews[0]?.id ?? null,
    },
    createdAt: booking.createdAt.toISOString(),
    guestName: booking.user.name || "Guest",
    guestId: booking.user.id,
    guestImage: booking.user.image || null,
    guestEmail: booking.user.email || null,
    guestCreatedAt: booking.user.createdAt?.toISOString() || null,
    conversationId: booking.conversations?.[0]?.id || null,
    listing: {
      id: booking.listing.id,
      title: booking.listing.title,
      city: booking.listing.city,
      district: booking.listing.district,
      country: booking.listing.country,
      photos: booking.listing.photos,
      checkInStart: booking.listing.checkInStart || "15:00",
      checkInEnd: booking.listing.checkInEnd || "22:00",
      checkOutTime: booking.listing.checkOutTime || "11:00",
      price: booking.listing.price,
    },
  };
}
