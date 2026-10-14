import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { disputeService } from "@/services/dispute.service";

export const dynamic = "force-dynamic";

export const PATCH = apiHandler(async (req, { params }) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  const { id, noteId } = await params;
  const body = await req.json();
  if (typeof body?.content !== "string") throw AppError.badRequest("A private note is required.");
  return ok(await disputeService.updateHostDisputePrivateNote(actor, id, noteId, body.content));
});

export const DELETE = apiHandler(async (req, { params }) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  const { id, noteId } = await params;
  await disputeService.deleteHostDisputePrivateNote(actor, id, noteId);
  return ok({ deleted: true });
});
