import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings/calendar/listings
 * Search and retrieve listings for the admin calendar property selector.
 */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BOOKINGS_VIEW);
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const search = searchParams.get("search") || undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 25;

  if (type) {
    const allowedTypes = ["properties", "hosts", "cities", "countries", "propertyTypes"] as const;
    if (!allowedTypes.includes(type as typeof allowedTypes[number])) {
      throw AppError.badRequest("Invalid calendar filter option type.");
    }
    const result = await bookingService.listAdminCalendarFilterOptions(actor, type as typeof allowedTypes[number], {
      search,
      limit,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      selected: searchParams.get("selected") || undefined,
      country: searchParams.get("country") || undefined,
    });
    return ok(result);
  }

  const listings = await bookingService.listPropertiesForAdminCalendar(actor, search, limit);
  return ok({ listings });
});
