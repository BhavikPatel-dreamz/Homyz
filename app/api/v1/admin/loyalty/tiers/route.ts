import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { STAYELITE_TIER_DEFINITIONS } from "@/services/stayelite-tier.service";

// Definitions are read-only here: policy versions and threshold change workflow are not approved.
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.LOYALTY_TIERS_VIEW);
  const persisted = await prisma.stayEliteTierDefinition.findMany({ orderBy: { displayOrder: "asc" } });
  return ok({ persisted, documented: STAYELITE_TIER_DEFINITIONS, mutationAllowed: false, blocker: "Tier rule versioning and policy approval workflow are not implemented; direct mutation could rewrite eligibility meaning." });
});
