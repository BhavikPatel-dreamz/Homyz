import { z } from "zod";

import { apiHandler } from "@/lib/api/handler";
import { parsePagination } from "@/lib/api/pagination";
import { created, paginated } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

const targetTypes = ["REVIEW", "LISTING", "LISTING_PHOTO", "PROFILE", "USER", "MESSAGE", "OTHER_CONTENT"] as const;

const createReportSchema = z.object({
  targetType: z.enum(targetTypes),
  targetId: z.string().trim().min(1).max(2048),
  category: z.string().trim().min(2).max(64),
  reasonCode: z.string().trim().min(2).max(80),
  description: z.string().trim().max(5_000).optional(),
  relatedBookingId: z.string().trim().min(1).max(256).optional(),
});

// GET /api/v1/moderation/reports — the caller's own report history only.
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const { page, limit } = parsePagination(req.nextUrl.searchParams);
  const result = await moderationService.listMyModerationReports(actor, page, limit);
  return paginated(result.reports, result.pagination);
});

// POST /api/v1/moderation/reports — attach a user report to a central case.
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const input = createReportSchema.parse(await req.json());
  const report = await moderationService.createModerationReport(actor, input);
  return created(report);
});
