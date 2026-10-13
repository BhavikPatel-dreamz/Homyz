import { apiHandler } from "@/lib/api/handler";
import { paginated } from "@/lib/api/response";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings
 * Reusable admin booking list endpoint supporting server-side filtering,
 * bounded pagination, sorting, and search.
 */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BOOKINGS_VIEW);
  const searchParams = req.nextUrl.searchParams;
  const { page, limit, skip, take } = parsePagination(searchParams);

  const status = searchParams.get("status") || undefined;
  const tab = searchParams.get("tab") || undefined;
  const bookingType = searchParams.get("bookingType") || undefined;
  const paymentStatus = searchParams.get("paymentStatus") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const checkInFrom = searchParams.get("checkInFrom") || undefined;
  const checkInTo = searchParams.get("checkInTo") || undefined;
  const checkOutFrom = searchParams.get("checkOutFrom") || undefined;
  const checkOutTo = searchParams.get("checkOutTo") || undefined;
  const createdFrom = searchParams.get("createdFrom") || undefined;
  const createdTo = searchParams.get("createdTo") || undefined;
  const city = searchParams.get("city") || undefined;
  const listingId = searchParams.get("listingId") || searchParams.get("propertyId") || undefined;
  const hostId = searchParams.get("hostId") || undefined;
  const guestId = searchParams.get("guestId") || undefined;
  const search = searchParams.get("search") || undefined;
  const sortBy = (searchParams.get("sortBy") as any) || undefined;
  const sortOrder = (searchParams.get("sortOrder") as any) || undefined;

  const result = await bookingService.listForAdmin(actor, {
    page,
    limit,
    skip,
    take,
    tab,
    status,
    bookingType,
    paymentStatus,
    startDate,
    endDate,
    checkInFrom,
    checkInTo,
    checkOutFrom,
    checkOutTo,
    createdFrom,
    createdTo,
    city,
    listingId,
    hostId,
    guestId,
    search,
    sortBy,
    sortOrder,
  });

  return paginated(result.items, buildPagination(result.page, result.limit, result.total));
});

