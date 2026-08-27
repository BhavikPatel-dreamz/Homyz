import { requirePageRole } from "@/lib/permissions/page-guards";
import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import { AdminBookingsClient } from "./admin-bookings-client";

export default async function AdminBookingsPage() {
  await requirePageRole([Role.ADMIN]);

  const [bookings, totalCount, stats] = await Promise.all([
    prisma.booking.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            host: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.booking.count(),
    prisma.booking.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const serializedBookings = bookings.map((b) => ({
    id: b.id,
    status: b.status,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
    createdAt: b.createdAt.toISOString(),
    user: b.user,
    listing: b.listing,
  }));

  const pendingCount = stats.find((s) => s.status === "PENDING")?._count._all || 0;
  const confirmedCount = stats.find((s) => s.status === "CONFIRMED")?._count._all || 0;
  const cancelledCount = stats.find((s) => s.status === "CANCELLED")?._count._all || 0;

  return (
    <AdminBookingsClient
      initialBookings={serializedBookings}
      summary={{
        total: totalCount,
        pending: pendingCount,
        confirmed: confirmedCount,
        cancelled: cancelledCount,
      }}
    />
  );
}
