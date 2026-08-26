import { apiHandler } from "@/lib/api/handler";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { created, paginated } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { createBookingSchema } from "@/lib/validation/booking";
import { bookingService } from "@/services/booking.service";

// GET /api/v1/bookings — the caller's own bookings (paginated).
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const { page, limit, skip, take } = parsePagination(req.nextUrl.searchParams);
  const { items, total } = await bookingService.listForUser(actor, {
    skip,
    take,
  });
  return paginated(items, buildPagination(page, limit, total));
});

// POST /api/v1/bookings — create a booking for the caller.
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const body = createBookingSchema.parse(await req.json());
  const booking = await bookingService.create(actor, body);
  return created(booking);
});
