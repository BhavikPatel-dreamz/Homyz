import { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { supportAnalyticsService } from "@/services/support-analytics.service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "all", "custom"]).optional(), startDate: z.string().max(40).optional(), endDate: z.string().max(40).optional(),
  status: z.string().max(40).optional(), category: z.string().max(80).optional(), priority: z.string().max(20).optional(), assignedAdminId: z.string().max(100).optional(), reporterRole: z.string().max(20).optional(), escalationState: z.enum(["ESCALATED", "NOT_ESCALATED"]).optional(),
  granularity: z.enum(["day", "week", "month"]).optional(), search: z.string().max(160).optional(), page: z.coerce.number().int().positive().optional(), pageSize: z.coerce.number().int().positive().max(100).optional(), sortBy: z.enum(["createdAt", "updatedAt", "slaDueAt", "priority"]).optional(), sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, PERMISSIONS.DISPUTES_VIEW);
  const query = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await supportAnalyticsService.getSupportAnalytics(actor, query));
});
