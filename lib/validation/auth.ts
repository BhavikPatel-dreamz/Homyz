import { z } from "zod";

// Shared password policy — reused by register / reset / change-password.
export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(100, { message: "Password must be at most 100 characters" });

// Signup. SECURITY: `role` is whitelisted to USER | HOST only — ADMIN is never
// accepted from client input (it mirrors the Prisma `Role` enum minus ADMIN).
// ADMIN is assigned exclusively by trusted server-side code (seed / admin API).
export const registerSchema = z.object({
  name: z.string().trim().min(1, { message: "Full name is required" }).max(100).optional(),
  email: z.string().trim().email({ message: "Please enter a valid email address" }),
  password: passwordSchema,
  role: z.enum(["USER", "HOST"]).default("USER"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: z.email() });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(1) });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// OTP — literals mirror the Prisma OtpChannel / OtpPurpose enums.
export const otpChannelSchema = z.enum(["SMS", "EMAIL"]);
export const otpPurposeSchema = z.enum([
  "PHONE_VERIFICATION",
  "LOGIN",
  "PASSWORD_RESET",
]);

export const sendOtpSchema = z.object({
  identifier: z.string().trim().min(3).max(190),
  channel: otpChannelSchema.default("SMS"),
  purpose: otpPurposeSchema.default("PHONE_VERIFICATION"),
});
export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  identifier: z.string().trim().min(3).max(190),
  code: z.string().trim().min(4).max(10),
  purpose: otpPurposeSchema.default("PHONE_VERIFICATION"),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// Mobile token endpoints.
export const mobileLoginSchema = loginSchema;
export type MobileLoginInput = z.infer<typeof mobileLoginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshInput = z.infer<typeof refreshSchema>;
