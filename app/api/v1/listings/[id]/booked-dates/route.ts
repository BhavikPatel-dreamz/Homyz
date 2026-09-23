import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/v1/listings/[id]/booked-dates
 * Returns booked date ranges for this listing so the detail page can render an
 * accurate availability calendar.
 */
export const GET = apiHandler(
  async (req, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startParam = req.nextUrl.searchParams.get("start");
    const endParam = req.nextUrl.searchParams.get("end");
    const requestedStart = parseCalendarDate(startParam) ?? today;
    const requestedEnd = parseCalendarDate(endParam);
    const rangeStart = Number.isNaN(requestedStart.getTime()) ? today : requestedStart;
    const rangeEnd = requestedEnd && requestedEnd > rangeStart ? requestedEnd : null;

    const [bookings, listing] = await Promise.all([
      prisma.booking.findMany({
        where: {
          listingId: id,
          status: { in: ["CONFIRMED", "PENDING"] },
          endDate: { gt: rangeStart },
          ...(rangeEnd ? { startDate: { lt: rangeEnd } } : {}),
        },
        select: { startDate: true, endDate: true },
        orderBy: { startDate: "asc" },
      }),
      prisma.listing.findUnique({ where: { id }, select: { blockedDates: true } }),
    ]);

    const bookingRanges = bookings.map((b: { startDate: Date; endDate: Date }) => ({
      start: dateKeyForRange(b.startDate),
      end: dateKeyForRange(b.endDate),
    }));
    // A blocked calendar day is an unavailable one-night range. It remains
    // intentionally compact and private: no booking or guest details leave
    // this public endpoint.
    const blockedRanges = (listing?.blockedDates ?? []).filter((date: string) => (
      date >= dateKeyForRange(rangeStart) && (!rangeEnd || date < dateKeyForRange(rangeEnd))
    )).map((date: string) => {
      const start = parseCalendarDate(date);
      if (!start) return null;
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start: date, end: dateKeyForRange(end) };
    }).filter((range: { start: string; end: string } | null): range is { start: string; end: string } => range !== null);
    const ranges = [...bookingRanges, ...blockedRanges];

    return ok({ ranges });
  },
);

function dateKeyForRange(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseCalendarDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) || dateKeyForRange(date) !== value ? null : date;
}
