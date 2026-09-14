"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { assertPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { Role } from "@/generated/prisma/enums";
import { updateHostServiceFeeSchema } from "@/lib/validation/settings";
import {
  getHostServiceFeePercentage,
  updateHostServiceFeePercentage,
} from "@/services/app-settings.service";

/**
 * Get current Host Service Fee percentage.
 */
export async function getHostServiceFeeAction() {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.SETTINGS_VIEW);

    const percentage = await getHostServiceFeePercentage();
    return { percentage };
  });
}

/**
 * Update Host Service Fee percentage and revalidate admin settings.
 */
export async function updateHostServiceFeeAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.SETTINGS_EDIT);

    const { percentage } = updateHostServiceFeeSchema.parse(input);
    const updated = await updateHostServiceFeePercentage(percentage, actor.id);

    revalidatePath("/admin/settings");
    return { percentage: updated };
  });
}

