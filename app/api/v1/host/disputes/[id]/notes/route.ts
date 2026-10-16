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
  const body = await req.json();
  if (typeof body?.content !== "string") throw AppError.badRequest("A private note is required.");
  return ok(await disputeService.addHostDisputePrivateNote(actor, id, body.content));
});
