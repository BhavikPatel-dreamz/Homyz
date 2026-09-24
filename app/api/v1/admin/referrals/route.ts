import { ReferralRewardStatus } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { paginated } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { referralService } from "@/services/referral.service";

const STATUSES = new Set(Object.values(ReferralRewardStatus));

// GET /api/v1/admin/referrals — referral reward review queue and history.
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.REFERRALS_VIEW);
  const { page, limit, skip, take } = parsePagination(req.nextUrl.searchParams);
  const statusValue = req.nextUrl.searchParams.get("status");
  const status = statusValue && STATUSES.has(statusValue as ReferralRewardStatus)
    ? (statusValue as ReferralRewardStatus)
    : undefined;
  const search = req.nextUrl.searchParams.get("search") || undefined;
  const { items, total } = await referralService.listRewards({ skip, take, status, search });
  return paginated(items, buildPagination(page, limit, total));
});
