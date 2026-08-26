import { z } from "zod";

import { passwordSchema } from "./auth";

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().min(5).max(20).optional(),
    image: z.url().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "No fields to update",
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
