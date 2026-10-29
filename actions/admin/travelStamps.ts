"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { auditService } from "@/services/audit.service";
import {
  listAdminTravelStamps,
  createAdminTravelStamp,
  updateAdminTravelStamp,
  toggleAdminTravelStampActive,
  archiveAdminTravelStamp,
  deleteAdminTravelStamp,
} from "@/services/travel-stamp.service";
import type { AdminTravelStampDTO, TravelStampDTO } from "@/types/travel";

async function requireAdminActor() {
  const actor = await getSessionUser();
  if (!actor) {
    throw AppError.unauthorized("Authentication required");
  }
  assertRole(actor, [Role.ADMIN]);
  return actor;
}

export async function listAdminTravelStampsAction(filters: {
  search?: string;
  country?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE";
} = {}): Promise<AdminTravelStampDTO[]> {
  await requireAdminActor();
  return listAdminTravelStamps(filters);
}

export async function createAdminTravelStampAction(input: {
  displayName: string;
  title?: string | null;
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  description?: string | null;
  category?: string;
  iconUrl: string;
  displayOrder?: number;
  isActive?: boolean;
}): Promise<TravelStampDTO> {
  const actor = await requireAdminActor();
  const created = await createAdminTravelStamp(input);
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "TRAVEL_STAMP_CREATED", resourceType: "TRAVEL_STAMP", resourceId: created.id, description: "Created a travel stamp catalog entry.", metadata: { slug: created.slug } });
  revalidatePath("/admin/travel-stamps");
  revalidatePath("/travel-profile");
  return created;
}

export async function updateAdminTravelStampAction(
  id: string,
  input: {
    displayName?: string;
    title?: string | null;
    country?: string | null;
    countryCode?: string | null;
    city?: string | null;
    description?: string | null;
    category?: string;
    iconUrl?: string;
    displayOrder?: number;
    isActive?: boolean;
  }
): Promise<TravelStampDTO> {
  const actor = await requireAdminActor();
  const updated = await updateAdminTravelStamp(id, input);
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "TRAVEL_STAMP_UPDATED", resourceType: "TRAVEL_STAMP", resourceId: id, description: "Updated a travel stamp catalog entry.", metadata: { slug: updated.slug } });
  revalidatePath("/admin/travel-stamps");
  revalidatePath("/travel-profile");
  return updated;
}

export async function toggleAdminTravelStampActiveAction(id: string): Promise<TravelStampDTO> {
  const actor = await requireAdminActor();
  const updated = await toggleAdminTravelStampActive(id);
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "TRAVEL_STAMP_TOGGLED", resourceType: "TRAVEL_STAMP", resourceId: id, description: "Changed travel stamp active status.", metadata: { isActive: updated.isActive } });
  revalidatePath("/admin/travel-stamps");
  revalidatePath("/travel-profile");
  return updated;
}

export async function archiveAdminTravelStampAction(id: string): Promise<void> {
  const actor = await requireAdminActor();
  await archiveAdminTravelStamp(id);
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "TRAVEL_STAMP_ARCHIVED", resourceType: "TRAVEL_STAMP", resourceId: id, description: "Archived a travel stamp catalog entry." });
  revalidatePath("/admin/travel-stamps");
  revalidatePath("/travel-profile");
}

export async function deleteAdminTravelStampAction(id: string): Promise<{ archived: boolean }> {
  const actor = await requireAdminActor();
  const result = await deleteAdminTravelStamp(id);
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: result.archived ? "TRAVEL_STAMP_ARCHIVED" : "TRAVEL_STAMP_DELETED", resourceType: "TRAVEL_STAMP", resourceId: id, description: result.archived ? "Archived a collected travel stamp." : "Deleted an uncollected travel stamp." });
  revalidatePath("/admin/travel-stamps");
  revalidatePath("/travel-profile");
  return result;
}
