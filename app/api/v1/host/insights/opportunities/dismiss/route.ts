import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostOpportunitiesService } from "@/services/host-opportunities.service";

export const dynamic = "force-dynamic";

const dismissSchema = z.object({
  opportunityId: z.string().min(1, "Opportunity ID is required"),
  listingId: z.string().min(1, "Listing ID is required"),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const body = dismissSchema.parse(await req.json());

  const result = await hostOpportunitiesService.updateLifecycle(actor, {
    opportunityId: body.opportunityId,
    listingId: body.listingId,
    action: "DISMISS",
  });

  return NextResponse.json({
    success: true,
    data: result,
  });
});
