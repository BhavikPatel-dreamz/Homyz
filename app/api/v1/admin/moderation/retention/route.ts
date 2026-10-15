import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { evidenceRetentionService } from "@/services/evidence-retention.service";

const purgeSchema = z.object({
  evidenceIds: z.array(z.string().trim().min(1)).min(1, "At least one evidence ID is required"),
  confirmPurge: z.boolean().refine((val) => val === true, "confirmPurge must be explicitly set to true"),
  dryRun: z.boolean().optional().default(false),
  reason: z.string().trim().min(5, "Purge justification must be at least 5 characters").max(500).optional(),
});

// GET /api/v1/admin/moderation/retention — Evidence retention eligibility report (dry-run review)
export const GET = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_RETENTION_MANAGE);
  const url = new URL(req.url);

  const retentionDaysParam = url.searchParams.get("retentionDays");
  const retentionDays = retentionDaysParam ? parseInt(retentionDaysParam, 10) : undefined;
  const dryRunParam = url.searchParams.get("dryRun");
  const dryRun = dryRunParam !== "false";

  const report = await evidenceRetentionService.getEvidenceRetentionReport(actor, {
    retentionDays: retentionDays && !isNaN(retentionDays) ? retentionDays : undefined,
    dryRun,
  });

  return ok(report);
});

// POST /api/v1/admin/moderation/retention — Authorized evidence purge execution
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_EVIDENCE_PURGE);
  const body = purgeSchema.parse(await req.json());

  const result = await evidenceRetentionService.purgeEligibleEvidence(actor, {
    evidenceIds: body.evidenceIds,
    confirmPurge: body.confirmPurge,
    dryRun: body.dryRun,
    reason: body.reason,
  });

  return ok(result);
});

