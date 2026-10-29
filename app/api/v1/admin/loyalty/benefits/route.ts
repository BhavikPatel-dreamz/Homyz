import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { buildAdminBenefitCatalog } from "@/lib/stayelite/admin-loyalty-catalog";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.LOYALTY_BENEFITS_VIEW);
  return ok({ benefits: buildAdminBenefitCatalog(), mutationAllowed: false, reason: "Financial and operational benefit fulfillment remains policy-gated." });
});
