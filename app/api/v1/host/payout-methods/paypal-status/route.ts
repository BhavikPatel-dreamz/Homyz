import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { paypalPayoutService } from "@/services/paypal-payout.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);
  const country = url.searchParams.get("country") || "SA";

  const status = paypalPayoutService.getIntegrationStatus(country);
  return ok(status);
});

