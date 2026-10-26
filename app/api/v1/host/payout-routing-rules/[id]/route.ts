import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { payoutRoutingService } from "@/services/payout-routing.service";

export const dynamic = "force-dynamic";

export const DELETE = apiHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
    const { id } = await params;

    let listingId = id;
    const rule = await prisma.payoutRoutingRule.findUnique({
      where: { id },
      select: { listingId: true },
    });
    if (rule) {
      listingId = rule.listingId;
    }

    const disabled = await payoutRoutingService.disableListingRoutingRules(
      actor.id,
      listingId,
      actor,
    );

    return ok(disabled);
  },
);

