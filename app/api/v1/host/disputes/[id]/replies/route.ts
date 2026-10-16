import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { disputeService } from "@/services/dispute.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  const { id } = await params;
  const formData = await req.formData();
  const values = formData.getAll("evidence");
  const files = values.filter((value): value is File => value instanceof File);
  if (files.length !== values.length) throw AppError.badRequest("Invalid evidence file.");
  return ok(await disputeService.sendHostDisputeReply(actor, id, {
    content: typeof formData.get("content") === "string" ? String(formData.get("content")) : "",
    evidenceFiles: await Promise.all(files.map(async (file) => ({ fileName: file.name, mimeType: file.type, buffer: Buffer.from(await file.arrayBuffer()) }))),
  }));
});
