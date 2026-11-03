import { AppError } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { disputeService } from "@/services/dispute.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  if (!req.headers.get("content-type")?.includes("multipart/form-data")) {
    throw AppError.badRequest("Evidence upload requires multipart/form-data.");
  }

  const { id } = await params;
  const formData = await req.formData();
  const values = formData.getAll("evidence");
  const files = values.filter((value): value is File => value instanceof File);
  if (!files.length || files.length !== values.length) {
    throw AppError.badRequest("Select one or more valid evidence files.");
  }

  const evidenceFiles = await Promise.all(
    files.map(async (file) => ({
      fileName: file.name,
      mimeType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );
  return ok(
    await disputeService.uploadHostDisputeEvidence(actor, id, evidenceFiles),
  );
});
