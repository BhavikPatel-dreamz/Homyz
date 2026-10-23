import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostListingPerformanceService } from "@/services/host-listing-performance.service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  propertyId: z.string().min(1).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guests: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const parsed = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const data = await hostListingPerformanceService.getListingPerformance(actor, parsed);
  if (!data) throw AppError.notFound("No host listing is available for listing performance.");
  return NextResponse.json({ success: true, data });
});
