import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostOpportunitiesService, type OpportunityCategory, type OpportunityPriority, type OpportunitySort, type OpportunityStatus } from "@/services/host-opportunities.service";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";

export const dynamic = "force-dynamic";

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).optional();
const querySchema = z.object({
  category: optionalEnum(["ALL", "PRICING_AVAILABILITY", "LISTING_QUALITY", "REVIEWS_GUEST_EXPERIENCE", "SEARCH_CONVERSION", "COMPETITOR_UPDATES"]),
  priority: optionalEnum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  status: optionalEnum(["ACTIVE", "SNOOZED", "DISMISSED", "RESOLVED", "EXPIRED"]),
  sort: optionalEnum(["PRIORITY", "RECENT", "LISTING", "CATEGORY"]),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(12).default(10),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);
  const filters = parseInsightsReportingFilters(url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));
  const data = await hostOpportunitiesService.getOpportunitiesOverview(actor, {
    listingId: filters.listingId,
    category: query.category as OpportunityCategory | undefined,
    priority: query.priority as OpportunityPriority | undefined,
    status: query.status as OpportunityStatus | undefined,
    sort: query.sort as OpportunitySort | undefined,
    page: query.page,
    pageSize: query.pageSize,
  });

  return NextResponse.json({
    success: true,
    data,
  });
});
