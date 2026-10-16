import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { bookingService } from "@/services/booking.service";

// GET /api/v1/host/bookings/[id] — retrieve details of a pending booking request for the host
export const GET = apiHandler(async (req, { params }) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  const { id } = await params;
  const details = await bookingService.getRequestDetailsForHost(actor, id);
  return ok(details);
});

