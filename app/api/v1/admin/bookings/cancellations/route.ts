import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bookingService } from "@/services/booking.service";
import { parsePagination } from "@/lib/api/pagination";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings/cancellations
 * Returns server-side paginated list of cancellations for Admin Cancellation Management.
 */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.BOOKINGS_VIEW);
  const { searchParams } = req.nextUrl;

  const { page, limit } = parsePagination(searchParams);
  const tab = searchParams.get("tab") || "all";
  const requestedInitiator = searchParams.get("initiator");
  const initiator =
    requestedInitiator === "GUEST" ||
    requestedInitiator === "HOST" ||
    requestedInitiator === "ADMIN" ||
    requestedInitiator === "UNKNOWN" ||
    requestedInitiator === "ALL"
      ? requestedInitiator
      : undefined;
  const search = searchParams.get("search") || undefined;
  const policy = searchParams.get("policy") || undefined;
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const checkInFrom = searchParams.get("checkInFrom") || undefined;
  const checkInTo = searchParams.get("checkInTo") || undefined;
  const listingId = searchParams.get("listingId") || undefined;
  const hostId = searchParams.get("hostId") || undefined;
  const guestId = searchParams.get("guestId") || undefined;
  const city = searchParams.get("city") || undefined;
  const country = searchParams.get("country") || undefined;
  const paymentStatus = searchParams.get("paymentStatus") || undefined;
  const refundStatus = searchParams.get("refundStatus") || undefined;
  const requestedSort = searchParams.get("sortBy");
  const sortBy =
    requestedSort === "cancelledAt" ||
    requestedSort === "startDate" ||
    requestedSort === "totalPrice" ||
    requestedSort === "createdAt"
      ? requestedSort
      : undefined;
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : undefined;

  const result = await bookingService.listCancellationsForAdmin(actor, {
    page,
    limit,
    tab,
    initiator,
    search,
    policy,
    dateFrom,
    dateTo,
    checkInFrom,
    checkInTo,
    listingId,
    hostId,
    guestId,
    city,
    country,
    paymentStatus,
    refundStatus,
    sortBy,
    sortOrder,
  });

  return ok(result);
});
