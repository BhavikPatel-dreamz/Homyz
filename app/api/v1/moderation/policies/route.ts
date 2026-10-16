import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import type { ModerationTargetType } from "@/generated/prisma/enums";
import {
  MODERATION_POLICY_CATEGORIES,
  MODERATION_POLICY_VERSION,
  listAllModerationPolicies,
  type ModerationPolicyCategory,
} from "@/lib/moderation/policies";

// GET /api/v1/moderation/policies?targetType=...&category=...&appealable=...&format=...
export const GET = apiHandler(async (req) => {
  const targetType = req.nextUrl.searchParams.get("targetType") as ModerationTargetType | null;
  const category = req.nextUrl.searchParams.get("category") as ModerationPolicyCategory | null;
  const appealableParam = req.nextUrl.searchParams.get("appealable");
  const appealable = appealableParam !== null ? appealableParam === "true" : undefined;
  const format = req.nextUrl.searchParams.get("format");

  const policies = listAllModerationPolicies({
    targetType: targetType || undefined,
    category: category || undefined,
    appealable,
  });

  if (format === "catalog" || format === "full") {
    return ok({
      version: MODERATION_POLICY_VERSION,
      categories: MODERATION_POLICY_CATEGORIES,
      policies,
    });
  }

  return ok(policies);
});
