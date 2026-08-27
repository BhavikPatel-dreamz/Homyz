import { z } from "zod";

export const updateRoleSchema = z.object({
  role: z.enum(["USER", "HOST", "ADMIN"]),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const createAdminSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  role: z.enum(["USER", "HOST", "ADMIN"]).default("ADMIN"),
  adminRoleSlug: z.string().optional(),
});
export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export const updateAdminSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(["USER", "HOST", "ADMIN"]).optional(),
  adminRoleSlug: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;

export const toggleUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});
export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;

export const adminResetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

export const createRoleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters").max(50),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, "Slug must be lowercase alphanumeric with dashes or underscores"),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const editRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).optional(),
});
export type EditRoleInput = z.infer<typeof editRoleSchema>;
