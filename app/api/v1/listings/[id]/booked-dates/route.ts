import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { ListingStatus } from "@/generated/prisma/enums";
import { getExpiryThresholdDate } from "@/lib/booking/booking-expiry";
import {
  bookingDateKey,
  parseBookingDate,
  shiftBookingDateKey,
} from "@/lib/booking/booking-date";

const MAX_CALENDAR_RANGE_DAYS = 366;

/**
 * GET /api/v1/listings/[id]/booked-dates
 * Returns booked date ranges for this listing so the detail page can render an
 * accurate availability calendar.
 */
export const GET = apiHandler(
  async (req, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const now = new Date();
    const today = parseBookingDate(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    );
    const startParam = req.nextUrl.searchParams.get("start");
    const endParam = req.nextUrl.searchParams.get("end");
    const requestedStart = parseCalendarDate(startParam) ?? today;
    const requestedEnd = parseCalendarDate(endParam);
    const rangeStart = Number.isNaN(requestedStart.getTime()) ? today : requestedStart;
    const maximumEnd = parseBookingDate(
      shiftBookingDateKey(bookingDateKey(rangeStart), MAX_CALENDAR_RANGE_DAYS),
    );
    if (requestedEnd && requestedEnd > maximumEnd) {
      throw AppError.badRequest(`Calendar ranges cannot exceed ${MAX_CALENDAR_RANGE_DAYS} days.`);
    }
    const rangeEnd = requestedEnd && requestedEnd > rangeStart ? requestedEnd : maximumEnd;

    const expiryThreshold = getExpiryThresholdDate();
    const [bookings, listing] = await Promise.all([
      prisma.booking.findMany({
        where: {
          listingId: id,
          endDate: { gt: rangeStart },
          ...(rangeEnd ? { startDate: { lt: rangeEnd } } : {}),
          OR: [
            { status: "CONFIRMED" },
            { status: "PENDING", createdAt: { gt: expiryThreshold } },
          ],
        },
        select: { startDate: true, endDate: true },
        orderBy: { startDate: "asc" },
      }),
      prisma.listing.findFirst({
        where: {
          id,
          published: true,
          status: ListingStatus.ACTIVE,
          isPaused: false,
          deletedAt: null,
        },
        select: { blockedDates: true },
      }),
    ]);
    if (!listing) throw AppError.notFound("Listing is not available");

    const bookingRanges = bookings.map((b: { startDate: Date; endDate: Date }) => ({
      start: bookingDateKey(b.startDate),
      end: bookingDateKey(b.endDate),
    }));
    // A blocked calendar day is an unavailable one-night range. It remains
    // intentionally compact and private: no booking or guest details leave
    // this public endpoint.
    const blockedRanges = listing.blockedDates.filter((date: string) => (
      date >= bookingDateKey(rangeStart) && date < bookingDateKey(rangeEnd)
    )).map((date: string) => {
      const start = parseCalendarDate(date);
      if (!start) return null;
      return { start: date, end: shiftBookingDateKey(date, 1) };
    }).filter((range: { start: string; end: string } | null): range is { start: string; end: string } => range !== null);
    const ranges = [...bookingRanges, ...blockedRanges];

    return ok({ ranges });
  },
);

function parseCalendarDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parseBookingDate(value);
  return Number.isNaN(date.getTime()) || bookingDateKey(date) !== value ? null : date;
}
