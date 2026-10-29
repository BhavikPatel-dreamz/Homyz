import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";
import { createAdminTravelStamp, listAdminTravelStamps } from "@/services/travel-stamp.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_VIEW);
  const query = new URL(req.url).searchParams;
  return ok(await listAdminTravelStamps({ search: query.get("search") || undefined, country: query.get("country") || undefined, status: (query.get("status") as "ALL" | "ACTIVE" | "INACTIVE" | null) ?? undefined }));
});

export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.LOYALTY_ACHIEVEMENTS_MANAGE);
  const stamp = await createAdminTravelStamp(await req.json());
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "TRAVEL_STAMP_CREATED", resourceType: "TRAVEL_STAMP", resourceId: stamp.id, description: "Created a taxonomy-capable travel stamp catalog entry.", metadata: { slug: stamp.slug, destinationId: stamp.destinationId ?? null } });
  return created(stamp);
});
