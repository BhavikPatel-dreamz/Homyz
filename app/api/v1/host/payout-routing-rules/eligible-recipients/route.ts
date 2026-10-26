import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { payoutRoutingService } from "@/services/payout-routing.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");

  if (!listingId) {
    throw AppError.badRequest("listingId query parameter is required.");
  }

  const recipients = await payoutRoutingService.getListingEligibleRecipients(
    actor.id,
    listingId,
  );

  return ok(recipients);
});

