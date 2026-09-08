import "server-only";
import type { Booking } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "@/lib/auth/types";
import { listingService } from "@/services/listing.service";

export async function getHostWorkspace(actor: AuthUser) {
  const { items: listings } = await listingService.listForHost(actor, {
    take: 100,
  });
  const bookings = await prisma.booking.findMany({
    where: {
      listing: { hostId: actor.id },
      listingId: { in: listings.map((listing) => listing.id) },
    },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { startDate: "asc" },
  });
  return {
    listings,
    bookings: bookings.map(
      (
        b: Booking & { user: { name: string | null; image: string | null } },
      ) => ({
        id: b.id,
        listingId: b.listingId,
        status: b.status,
        startDate: b.startDate.toISOString(),
        endDate: b.endDate.toISOString(),
        createdAt: b.createdAt.toISOString(),
        guestName: b.user.name || "Guest",
        guestImage: b.user.image,
      }),
    ),
  };
}
