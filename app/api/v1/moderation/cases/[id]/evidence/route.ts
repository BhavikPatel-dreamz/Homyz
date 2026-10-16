import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { created, ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/moderation/cases/[id]/evidence — list evidence visible to actor
export const GET = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { id: caseId } = await context.params;
  const evidence = await moderationService.listModerationEvidence(actor, caseId);
  return ok(evidence);
});

// POST /api/v1/moderation/cases/[id]/evidence — upload evidence (admin or case participant)
export const POST = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiAuth(req);
  const { id: caseId } = await context.params;

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    throw AppError.badRequest("Evidence upload requires multipart/form-data");
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string" || !(file instanceof Blob)) {
    throw AppError.badRequest("Missing evidence file");
  }

  const description = formData.get("description")?.toString() || undefined;
  const accessScopeRaw = formData.get("accessScope")?.toString();
  const accessScope = accessScopeRaw === "CASE_PARTICIPANTS" ? "CASE_PARTICIPANTS" : "MODERATORS_ONLY";
  const informationRequestId = formData.get("informationRequestId")?.toString() || undefined;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = (file as File).name || "evidence";

  const evidence = await moderationService.uploadModerationEvidence(actor, caseId, {
    file: { buffer, fileName },
    description,
    accessScope,
    informationRequestId,
  });

  return created(evidence);
});

