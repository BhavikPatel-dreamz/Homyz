import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";
import { archiveAdminTravelStamp, updateAdminTravelStamp } from "@/services/travel-stamp.service";

export const PATCH = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_MANAGE);
  const id = (await params).id;
  const stamp = await updateAdminTravelStamp(id, await req.json());
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "TRAVEL_STAMP_UPDATED", resourceType: "TRAVEL_STAMP", resourceId: id, description: "Updated a travel stamp catalog entry.", metadata: { slug: stamp.slug, destinationId: stamp.destinationId ?? null } });
  return ok(stamp);
});

// Preserve collected stamps and history; deletion is intentionally not exposed via the API.
export const DELETE = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_MANAGE);
  const id = (await params).id;
  await archiveAdminTravelStamp(id);
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "TRAVEL_STAMP_ARCHIVED", resourceType: "TRAVEL_STAMP", resourceId: id, description: "Archived a travel stamp without removing guest collections." });
  return ok({ id, archived: true });
});
