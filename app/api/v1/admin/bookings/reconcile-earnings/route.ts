import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { reconcileHistoricalBookings } from "@/services/host-earnings-lifecycle.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/bookings/reconcile-earnings
 * Dry-run audit report of all bookings, eligible earnings, and any blocked records.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiPermission(req, [
    PERMISSIONS.PAYOUTS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const hostId = searchParams.get("hostId") || undefined;
  const bookingId = searchParams.get("bookingId") || undefined;

  const result = await reconcileHistoricalBookings({
    dryRun: true,
    hostId,
    bookingId,
  });

  return ok(result);
});

/**
 * POST /api/v1/admin/bookings/reconcile-earnings
 * Executes reconciliation and recognizes host earnings for eligible bookings.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  await requireApiPermission(req, [
    PERMISSIONS.PAYOUTS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const result = await reconcileHistoricalBookings({
    dryRun: body.dryRun !== undefined ? Boolean(body.dryRun) : false,
    hostId: body.hostId || undefined,
    bookingId: body.bookingId || undefined,
  });

  return ok(result);
});

