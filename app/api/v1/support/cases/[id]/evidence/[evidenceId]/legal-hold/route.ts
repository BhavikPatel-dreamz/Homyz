import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { supportCaseEvidenceSecurityService } from "@/services/support-case-evidence-security.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; evidenceId: string }> };
const schema = z.object({ hold: z.boolean(), reason: z.string().min(5).max(2_000) });

export const PATCH = apiHandler(async (req, context: Context) => {
  const actor = await requireApiPermission(req, PERMISSIONS.DISPUTES_RESOLVE);
  const { id, evidenceId } = await context.params;
  return ok(await supportCaseEvidenceSecurityService.setSupportEvidenceLegalHold(actor, id, evidenceId, schema.parse(await req.json())));
});
