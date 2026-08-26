import { z } from "zod";

// TRUSTED admin-only path — this is the single place ADMIN may be assigned.
// It is reachable exclusively from admin-guarded routes/actions, never from
// public signup (registerSchema whitelists USER | HOST only).
export const updateRoleSchema = z.object({
  role: z.enum(["USER", "HOST", "ADMIN"]),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
