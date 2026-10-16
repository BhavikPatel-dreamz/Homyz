"use server";

import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";
import { UserStatus } from "@/generated/prisma/enums";

export async function updateHostAction(
  hostId: string,
  data: { name?: string; email?: string; phone?: string; status?: UserStatus }
) {
  try {
    const actorUser = await requirePagePermission(PERMISSIONS.USERS_EDIT);
    const updated = await adminService.updateHostProfile(hostId, data, actorUser);
    return { ok: true, data: updated };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "Failed to update host profile" };
  }
}

export async function updateHostVerificationAction(
  hostId: string,
  status: "APPROVED" | "REJECTED" | "PENDING",
  reason?: string
) {
  try {
    const actorUser = await requirePagePermission(PERMISSIONS.USERS_EDIT);
    const res = await adminService.updateHostVerification(hostId, status, reason, actorUser);
    return { ok: true, data: res };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "Failed to update host verification status" };
  }
}

export async function toggleHostSuspensionAction(
  hostId: string,
  suspend: boolean,
  reason?: string
) {
  try {
    const actorUser = await requirePagePermission(PERMISSIONS.USERS_EDIT);
    const updated = await adminService.toggleHostSuspension(hostId, suspend, reason, actorUser);
    return { ok: true, data: updated };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "Failed to toggle host suspension" };
  }
}

export async function deleteHostAction(hostId: string) {
  try {
    const actorUser = await requirePagePermission(PERMISSIONS.USERS_DELETE);
    const res = await adminService.deleteHost(hostId, actorUser);
    return { ok: true, data: res };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "Failed to delete host" };
  }
}
