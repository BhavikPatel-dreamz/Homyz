import { z } from "zod";
import { isValidE164Phone, normalizeEmail, normalizePhone } from "@/lib/auth/normalization";

export const legalNameSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60, "First name too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(60, "Last name too long"),
});

export const preferredNameSchema = z.object({
  preferredFirstName: z.string().trim().max(60, "Preferred name too long").optional(),
});

export const updateEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .transform((val) => normalizeEmail(val)),
});

export const updatePhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(5, "Enter a valid phone number")
    .max(25, "Phone number is too long")
    .refine((value) => isValidE164Phone(normalizePhone(value)), {
      message: "Enter a valid mobile number with country code",
    }),
});

export const identityStatusSchema = z.object({
  status: z.enum(["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"]),
});

export const addressSchema = z.object({
  street: z.string().trim().max(120, "Street name too long").optional().default(""),
  apt: z.string().trim().max(50, "Apt/Suite too long").optional().default(""),
  city: z.string().trim().max(80, "City name too long").optional().default(""),
  state: z.string().trim().max(80, "State name too long").optional().default(""),
  postalCode: z.string().trim().max(30, "Postal code too long").optional().default(""),
  country: z.string().trim().max(80, "Country name too long").optional().default(""),
});

export const postalAddressSchema = z.object({
  sameAsResidential: z.boolean().default(false),
  street: z.string().trim().max(120, "Street name too long").optional().default(""),
  apt: z.string().trim().max(50, "Apt/Suite too long").optional().default(""),
  city: z.string().trim().max(80, "City name too long").optional().default(""),
  state: z.string().trim().max(80, "State name too long").optional().default(""),
  postalCode: z.string().trim().max(30, "Postal code too long").optional().default(""),
  country: z.string().trim().max(80, "Country name too long").optional().default(""),
});

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  relationship: z.string().trim().min(1, "Relationship is required").max(50, "Relationship is too long"),
  countryCode: z.string().trim().optional().default(""),
  phoneNumber: z.string().trim().min(3, "Phone number is required").max(25, "Phone number is too long"),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  preferredLanguage: z.string().trim().max(50).optional().default(""),
});

export type LegalNameInput = z.infer<typeof legalNameSchema>;
export type PreferredNameInput = z.infer<typeof preferredNameSchema>;
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type PostalAddressInput = z.infer<typeof postalAddressSchema>;
export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>;

