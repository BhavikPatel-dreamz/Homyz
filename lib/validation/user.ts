import { z } from "zod";

import { passwordSchema } from "./auth";

const SYSTEM_MANAGED_HOST_PROFILE_FIELDS = new Set([
  "rating",
  "reviewCount",
  "reviewsCount",
  "reviewScores",
  "hostingYears",
  "hostingTenure",
]);

export const updateProfileSchema = z
  .object({
    name: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    publicProfile: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "No fields to update",
  })
  .superRefine((obj, ctx) => {
    if (!obj.publicProfile) return;
    for (const key of Object.keys(obj.publicProfile)) {
      if (SYSTEM_MANAGED_HOST_PROFILE_FIELDS.has(key)) {
        ctx.addIssue({ code: "custom", path: ["publicProfile", key], message: `${key} is system managed` });
      }
    }
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
