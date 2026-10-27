"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
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
  await requireAdminActor();
  const created = await createAdminTravelStamp(input);
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
  await requireAdminActor();
  const updated = await updateAdminTravelStamp(id, input);
  revalidatePath("/admin/travel-stamps");
  revalidatePath("/travel-profile");
  return updated;
}

export async function toggleAdminTravelStampActiveAction(id: string): Promise<TravelStampDTO> {
  await requireAdminActor();
  const updated = await toggleAdminTravelStampActive(id);
  revalidatePath("/admin/travel-stamps");
  revalidatePath("/travel-profile");
  return updated;
}

export async function archiveAdminTravelStampAction(id: string): Promise<void> {
  await requireAdminActor();
  await archiveAdminTravelStamp(id);
  revalidatePath("/admin/travel-stamps");
  revalidatePath("/travel-profile");
}

export async function deleteAdminTravelStampAction(id: string): Promise<{ archived: boolean }> {
  await requireAdminActor();
  const result = await deleteAdminTravelStamp(id);
  revalidatePath("/admin/travel-stamps");
  revalidatePath("/travel-profile");
  return result;
}

