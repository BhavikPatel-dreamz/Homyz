import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertOwnership } from "@/lib/permissions/authorize";
import { prisma } from "@/lib/db/prisma";
import type { CreateBookingInput } from "@/lib/validation/booking";

import { toBookingDTO, type BookingDTO } from "./mappers";

async function create(
  actor: AuthUser,
  input: CreateBookingInput,
): Promise<BookingDTO> {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
  });
  if (!listing || !listing.published) {
    throw AppError.notFound("Listing not found");
  }
  const booking = await prisma.booking.create({
    data: {
      userId: actor.id,
      listingId: input.listingId,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  });
  return toBookingDTO(booking);
}

// A user's own bookings.
async function listForUser(
  actor: AuthUser,
  opts: { skip: number; take: number },
): Promise<{ items: BookingDTO[]; total: number }> {
  const where = { userId: actor.id };
  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip: opts.skip,
      take: opts.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.booking.count({ where }),
  ]);
  return { items: items.map(toBookingDTO), total };
}

async function getById(actor: AuthUser, id: string): Promise<BookingDTO> {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw AppError.notFound("Booking not found");
  // Owner or ADMIN only.
  assertOwnership(actor, booking.userId);
  return toBookingDTO(booking);
}

export const bookingService = {
  create,
  listForUser,
  getById,
};
