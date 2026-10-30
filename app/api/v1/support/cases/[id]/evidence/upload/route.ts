import { NextRequest } from "next/server";

import { AppError } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireApiAuth, requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { Role } from "@/generated/prisma/enums";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiAuth(req);
  if (actor.role === Role.ADMIN) await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  if (!req.headers.get("content-type")?.includes("multipart/form-data")) {
    throw AppError.badRequest("Evidence upload requires multipart/form-data.");
  }
  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string" || !(file instanceof Blob)) {
    throw AppError.badRequest("Missing evidence file.");
  }
  const { id } = await context.params;
  return created(await supportCaseService.uploadSupportCaseEvidence(actor, id, {
    fileName: (file as File).name || "evidence",
    buffer: Buffer.from(await file.arrayBuffer()),
  }));
});
