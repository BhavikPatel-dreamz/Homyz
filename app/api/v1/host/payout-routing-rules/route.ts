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
  const listingId = searchParams.get("listingId") || undefined;

  const rules = await payoutRoutingService.getListingRoutingRules(actor.id, listingId);
  return ok(rules);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const body = await req.json();

  if (!body.listingId || !Array.isArray(body.rules)) {
    throw AppError.badRequest("listingId and rules array are required.");
  }

  const result = await payoutRoutingService.saveListingRoutingRules(
    actor.id,
    body.listingId,
    body.rules,
    actor,
  );

  return ok(result);
});

