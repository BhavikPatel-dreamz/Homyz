import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { bookingService } from "@/services/booking.service";

const rejectSchema = z
  .object({
    reason: z.string().max(1000).optional(),
  })
  .optional();

// POST /api/v1/host/bookings/[id]/reject — decline a pending booking request and release dates
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  const { id } = await params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }
  const input = rejectSchema.parse(body);

  const result = await bookingService.rejectBookingRequest(actor, id, input?.reason);
  return ok(result);
});

