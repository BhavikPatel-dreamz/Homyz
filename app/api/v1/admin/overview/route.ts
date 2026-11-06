import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { adminBusinessOverviewService, OverviewDateFilter } from "@/services/admin-business-overview.service";

// GET /api/v1/admin/overview — Fetch authoritative Airbnb-inspired business KPIs and analytics
export const GET = apiHandler(async (req) => {
  await requireApiRole(req, [Role.ADMIN]);
  const sp = req.nextUrl.searchParams;

  const rawPeriod = sp.get("period");
  const period: OverviewDateFilter["period"] =
    rawPeriod === "7d" || rawPeriod === "30d" || rawPeriod === "this_month" || rawPeriod === "90d"
      ? rawPeriod
      : "30d";

  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;

  const data = await adminBusinessOverviewService.getOverview({
    period,
    from,
    to,
  });

  return ok(data);
});

