import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission, requireApiAuth } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { disputeService } from "@/services/dispute.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.DISPUTES_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const result = await disputeService.listDisputesForAdmin(actor, {
    page: Number(searchParams.get("page")) || 1,
    limit: Number(searchParams.get("limit")) || 20,
    tab: searchParams.get("tab") || undefined,
    search: searchParams.get("search") || undefined,
    category: searchParams.get("category") || undefined,
    status: searchParams.get("status") || undefined,
    severity: searchParams.get("severity") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    sortBy: (searchParams.get("sortBy") as any) || "createdAt",
    sortOrder: (searchParams.get("sortOrder") as any) || "desc",
  });

  return ok(result);
});

export const POST = apiHandler(async (req: NextRequest) => {
  // Can be called by Admin, or authorized Guest/Host on booking
  const actor = await requireApiAuth(req);
  const body = await req.json();

  const dispute = await disputeService.createDispute(actor, {
    bookingId: body.bookingId,
    category: body.category,
    severity: body.severity,
    description: body.description,
    incidentDate: body.incidentDate,
    evidenceUrls: body.evidenceUrls,
  });

  return ok(dispute);
});
