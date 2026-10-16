import { z } from "zod";

import { passwordSchema } from "./auth";
import { isValidE164Phone, normalizePhone } from "@/lib/auth/normalization";

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

const birthDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid birth date")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid birth date")
  .refine((value) => value >= "1900-01-01", "Enter a valid birth date")
  .refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    "Birth date cannot be in the future",
  );

export const completeRegistrationProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100, "Full name is too long"),
  birthDate: birthDateSchema,
  email: z.string().trim().email("Enter a valid email address").optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isValidE164Phone(normalizePhone(value)), {
      message: "Enter a valid mobile number including country code",
    }),
});
export type CompleteRegistrationProfileInput = z.infer<typeof completeRegistrationProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
