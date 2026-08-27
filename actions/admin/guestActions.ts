"use server";

import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { UserStatus } from "@/generated/prisma/enums";

export async function updateGuestAction(
  guestId: string,
  data: { name?: string; email?: string; phone?: string; status?: UserStatus }
) {
  try {
    const actorUser = await requirePagePermission(PERMISSIONS.USERS_EDIT);
    const updated = await adminService.updateGuestProfile(guestId, data, actorUser);
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update guest profile" };
  }
}

export async function toggleGuestSuspensionAction(
  guestId: string,
  suspend: boolean,
  reason?: string
) {
  try {
    const actorUser = await requirePagePermission(PERMISSIONS.USERS_EDIT);
    const updated = await adminService.toggleGuestSuspension(guestId, suspend, reason, actorUser);
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to toggle guest suspension" };
  }
}

export async function deleteGuestAction(guestId: string) {
  try {
    const actorUser = await requirePagePermission(PERMISSIONS.USERS_DELETE);
    const res = await adminService.deleteGuest(guestId, actorUser);
    return { ok: true, data: res };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to delete guest" };
  }
}
