import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/v1/listings/[id]/booked-dates
 * Returns booked date ranges for this listing so the detail page can render an
 * accurate availability calendar.
 */
export const GET = apiHandler(
  async (_req, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;

    const bookings = await prisma.booking.findMany({
      where: {
        listingId: id,
        status: { in: ["CONFIRMED", "PENDING"] },
        endDate: { gte: new Date() },
      },
      select: { startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    });

    const ranges = bookings.map((b: { startDate: Date; endDate: Date }) => ({
      start: b.startDate.toISOString().split("T")[0],
      end: b.endDate.toISOString().split("T")[0],
    }));

    return ok({ ranges });
  },
);

