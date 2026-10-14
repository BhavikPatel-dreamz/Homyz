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
  const proposalType = typeof formData.get("proposalType") === "string" ? String(formData.get("proposalType")) : "OTHER";
  const explanation = typeof formData.get("explanation") === "string" ? String(formData.get("explanation")) : "";
  const files = formData.getAll("evidence").filter((value): value is File => value instanceof File);
  if (files.length !== formData.getAll("evidence").length) throw AppError.badRequest("Invalid evidence file.");

  const evidenceFiles = await Promise.all(
    files.map(async (file) => ({
      fileName: file.name,
      mimeType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );

  return ok(
    await disputeService.proposeHostDisputeResolution(actor, id, {
      proposalType,
      explanation,
      evidenceFiles,
    }),
  );
});

