import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { supportCaseEvidenceSecurityService } from "@/services/support-case-evidence-security.service";

export const dynamic = "force-dynamic";

// Reporting only. A destructive cleanup endpoint is intentionally withheld
// until a business/legal retention policy and an explicit deployment runbook
// are approved.
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.DISPUTES_RESOLVE);
  return ok(await supportCaseEvidenceSecurityService.getSupportEvidenceRetentionReport());
});
