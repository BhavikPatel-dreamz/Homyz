import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { demandForecastService } from "@/services/admin-analytics/forecasting/demand-forecast.service";
import type { ForecastHorizon } from "@/services/admin-analytics/forecasting/forecast-contracts";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiPermission(req, [PERMISSIONS.ANALYTICS_VIEW]);

  const { searchParams } = new URL(req.url);
  const horizon = (searchParams.get("horizon") as ForecastHorizon) || "30d";
  const currency = searchParams.get("currency") || "SAR";
  const city = searchParams.get("city") || undefined;

  const result = await demandForecastService.generateForecast({
    horizon,
    currency,
    city,
  });

  return ok(result);
});

