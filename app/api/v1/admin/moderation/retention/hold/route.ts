import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { evidenceRetentionService } from "@/services/evidence-retention.service";

const holdActionSchema = z.object({
  evidenceId: z.string().trim().min(1, "evidenceId is required"),
  action: z.enum(["APPLY", "RELEASE"]),
  reason: z.string().trim().min(5, "Reason is required (at least 5 characters)").max(500),
});

// POST /api/v1/admin/moderation/retention/hold — Apply or release legal/preservation retention hold
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_RETENTION_MANAGE);
  const body = holdActionSchema.parse(await req.json());

  if (body.action === "APPLY") {
    const result = await evidenceRetentionService.applyEvidenceRetentionHold(actor, body.evidenceId, body.reason);
    return ok(result);
  } else {
    const result = await evidenceRetentionService.releaseEvidenceRetentionHold(actor, body.evidenceId, body.reason);
    return ok(result);
  }
});

