import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostOpportunitiesService } from "@/services/host-opportunities.service";

export const dynamic = "force-dynamic";

const snoozeSchema = z.object({
  opportunityId: z.string().min(1),
  listingId: z.string().min(1),
  snoozedUntil: z.string().datetime(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const body = snoozeSchema.parse(await req.json());
  const result = await hostOpportunitiesService.updateLifecycle(actor, {
    opportunityId: body.opportunityId,
    listingId: body.listingId,
    action: "SNOOZE",
    snoozedUntil: new Date(body.snoozedUntil),
  });
  return NextResponse.json({ success: true, data: result });
});
