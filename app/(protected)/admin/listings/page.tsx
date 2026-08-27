import { requirePageRole } from "@/lib/permissions/page-guards";
import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import { AdminListingsClient } from "./admin-listings-client";

export default async function AdminListingsPage() {
  await requirePageRole([Role.ADMIN]);

  const [listings, totalCount, publishedCount] = await Promise.all([
    prisma.listing.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        host: { select: { id: true, name: true, email: true, image: true } },
        _count: { select: { bookings: true } },
      },
    }),
    prisma.listing.count(),
    prisma.listing.count({ where: { published: true } }),
  ]);

  const serializedListings = listings.map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    price: l.price,
    published: l.published,
    createdAt: l.createdAt.toISOString(),
    host: l.host,
    bookingCount: l._count.bookings,
  }));

  return (
    <AdminListingsClient
      initialListings={serializedListings}
      summary={{
        total: totalCount,
        published: publishedCount,
        draft: totalCount - publishedCount,
      }}
    />
  );
}
