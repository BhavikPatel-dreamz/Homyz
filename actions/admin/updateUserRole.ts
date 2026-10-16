"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/lib/actions/result";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { updateRoleSchema } from "@/lib/validation/admin";
import { adminService } from "@/services/admin.service";
import { Role } from "@/generated/prisma/enums";

// Trusted role assignment (the only path that may grant ADMIN). Guarded by
// ADMIN here AND unreachable from public signup.
export async function updateUserRoleAction(userId: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    const { role } = updateRoleSchema.parse(input);
    const user = await adminService.setUserRole(userId, role);
    revalidatePath("/admin/users");
    return user;
  });
}
