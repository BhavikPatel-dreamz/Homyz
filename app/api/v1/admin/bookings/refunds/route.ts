import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { refundService } from "@/services/refund.service";
import { createRefundRequestSchema } from "@/lib/validation/admin-booking";
import { parsePagination } from "@/lib/api/pagination";
import { AppError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings/refunds
 * Returns server-side paginated list of refund requests for Admin Refund Management.
 */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.PAYMENTS_VIEW);
  const { searchParams } = req.nextUrl;

  const { page, limit } = parsePagination(searchParams);
  const tab = searchParams.get("tab") || "all";
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const parseMinorAmount = (key: "minAmount" | "maxAmount") => {
    const raw = searchParams.get(key);
    if (raw === null) return undefined;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw AppError.badRequest(`${key} must be a non-negative integer in minor units.`);
    }
    return value;
  };
  const minAmount = parseMinorAmount("minAmount");
  const maxAmount = parseMinorAmount("maxAmount");
  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    throw AppError.badRequest("minAmount cannot be greater than maxAmount.");
  }
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const requestedSort = searchParams.get("sortBy");
  const sortBy =
    requestedSort === "createdAt" || requestedSort === "amount" || requestedSort === "succeededAt"
      ? requestedSort
      : undefined;
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : undefined;

  const result = await refundService.listRefundsForAdmin(actor, {
    page,
    limit,
    tab,
    status,
    search,
    minAmount,
    maxAmount,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
  });

  return ok(result);
});

/**
 * POST /api/v1/admin/bookings/refunds
 * Creates a new refund request for an existing confirmed or cancelled reservation.
 */
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.PAYMENTS_MANAGE);
  const body = createRefundRequestSchema.parse(await req.json());

  const refund = await refundService.createRefundRequest(actor, {
    bookingId: body.bookingId,
    amount: body.amount,
    reason: body.reason,
    notes: body.notes,
    idempotencyKey: body.idempotencyKey,
  });

  return ok({
    success: true,
    message: "Refund request created successfully.",
    refund,
  });
});
