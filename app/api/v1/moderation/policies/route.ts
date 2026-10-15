import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import type { ModerationTargetType } from "@/generated/prisma/enums";
import { MODERATION_POLICIES } from "@/lib/moderation/policies";

// GET /api/v1/moderation/policies?targetType=...
export const GET = apiHandler(async (req) => {
  const targetType = req.nextUrl.searchParams.get("targetType") as ModerationTargetType | null;
  const policies = targetType
    ? MODERATION_POLICIES.filter((p) => p.targetTypes.includes(targetType))
    : MODERATION_POLICIES;
  return ok(policies);
});

