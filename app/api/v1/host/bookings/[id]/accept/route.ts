import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { bookingService } from "@/services/booking.service";

// POST /api/v1/host/bookings/[id]/accept — validate request and enforce fail-closed payment authorization gate
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  const { id } = await params;
  const result = await bookingService.acceptBookingRequest(actor, id);
  return ok(result);
});

