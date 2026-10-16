import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";
import { parsePagination } from "@/lib/api/pagination";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings/calendar
 * Authoritative admin calendar availability endpoint.
 * Without a listingId, returns the paginated all-properties timeline. Supplying a
 * listingId preserves the established single-property month/year calendar shape.
 */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BOOKINGS_VIEW);
  const { searchParams } = req.nextUrl;
  const listingId = searchParams.get("listingId") || searchParams.get("propertyId");
  const month = searchParams.get("month") || undefined;

  if (listingId) {
    const calendarData = await bookingService.getAdminCalendarData(actor, listingId, month);
    return ok(calendarData);
  }

  const { page, limit } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 50 });
  const calendarData = await bookingService.getAdminAllPropertiesCalendarData(actor, {
    page,
    limit,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    search: searchParams.get("search") || undefined,
    hostId: searchParams.get("hostId") || undefined,
    city: searchParams.get("city") || undefined,
    cityKey: searchParams.get("cityKey") || undefined,
    country: searchParams.get("country") || undefined,
    status: searchParams.get("status") || undefined,
    propertyType: searchParams.get("propertyType") || undefined,
    bookingStatus: searchParams.get("bookingStatus") || undefined,
    filterListingId: searchParams.get("filterListingId") || undefined,
  });
  return ok(calendarData);
});
