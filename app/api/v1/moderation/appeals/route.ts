import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import {
  moderationService,
  type ModerationAppealDecision,
  type ModerationAppealStatus,
} from "@/services/moderation.service";

// GET /api/v1/moderation/appeals — list appeals across cases (Admin Queue)
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const searchParams = req.nextUrl.searchParams;

  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
  const status = (searchParams.get("status") as ModerationAppealStatus) || undefined;
  const decision = (searchParams.get("decision") as ModerationAppealDecision) || undefined;
  const assignedReviewerId = searchParams.get("assignedReviewerId") || undefined;
  const search = searchParams.get("search") || undefined;
  const sort = (searchParams.get("sort") as "newest" | "oldest" | "deadline") || undefined;

  const result = await moderationService.listModerationAppeals(actor, {
    page,
    limit,
    status,
    decision,
    assignedReviewerId,
    search,
    sort,
  });

  return ok(result);
});

