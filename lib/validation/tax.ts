import { z } from "zod";

export const taxTypeSchema = z.enum([
  "VAT",
  "GST",
  "TOURIST_TAX",
  "OCCUPANCY_TAX",
  "LODGING_TAX",
  "SALES_TAX",
  "CITY_TAX",
  "OTHER",
]);

export const taxCalculationMethodSchema = z.enum([
  "PERCENTAGE",
  "FLAT_PER_BOOKING",
  "AMOUNT_PER_NIGHT",
  "AMOUNT_PER_GUEST",
  "AMOUNT_PER_GUEST_PER_NIGHT",
]);

export const taxRemittanceResponsibilitySchema = z.enum([
  "PLATFORM",
  "HOST",
  "THIRD_PARTY",
  "MANUAL",
]);

export const taxableComponentSchema = z.enum([
  "BASE_PRICE",
  "MANAGEMENT_FEE",
  "COMMUNITY_FEE",
  "LINEN_FEE",
  "PET_FEE",
  "GUEST_FEE",
  "RESORT_FEE",
]);

export const createHostTaxSchema = z
  .object({
    listingId: z.string().min(1, "Listing ID is required"),
    taxType: taxTypeSchema,
    customName: z.string().trim().min(2, "Tax name must be at least 2 characters").max(60).optional().nullable(),
    calculationMethod: taxCalculationMethodSchema.default("PERCENTAGE"),
    rate: z.number().finite().min(0.1, "Tax percentage must be at least 0.1%").max(100, "Tax percentage cannot exceed 100%").optional().nullable(),
    amount: z.number().finite().int().min(0, "Amount cannot be negative").optional().nullable(),
    taxableComponents: z.array(taxableComponentSchema).min(1, "At least one taxable component must be selected").default(["BASE_PRICE"]),
    remittanceResponsibility: taxRemittanceResponsibilitySchema.default("HOST"),
    maximumAmountPerPersonPerNight: z.number().finite().int().min(1).optional().nullable(),
    partialStayExemptionNights: z.number().finite().int().min(1).max(365).optional().nullable(),
    fullStayExemptionNights: z.number().finite().int().min(1).max(365).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.calculationMethod === "PERCENTAGE") {
        return typeof data.rate === "number" && data.rate > 0;
      }
      return typeof data.amount === "number" && data.amount >= 0;
    },
    {
      message: "A valid rate percentage or fixed amount is required for the chosen calculation method",
      path: ["rate"],
    }
  );

export const updateHostTaxSchema = z
  .object({
    taxType: taxTypeSchema.optional(),
    customName: z.string().trim().min(2).max(60).optional().nullable(),
    calculationMethod: taxCalculationMethodSchema.optional(),
    rate: z.number().finite().min(0.1).max(100).optional().nullable(),
    amount: z.number().finite().int().min(0).optional().nullable(),
    taxableComponents: z.array(taxableComponentSchema).min(1).optional(),
    remittanceResponsibility: taxRemittanceResponsibilitySchema.optional(),
    maximumAmountPerPersonPerNight: z.number().finite().int().min(1).optional().nullable(),
    partialStayExemptionNights: z.number().finite().int().min(1).max(365).optional().nullable(),
    fullStayExemptionNights: z.number().finite().int().min(1).max(365).optional().nullable(),
    isActive: z.boolean().optional(),
  });

export const saveTaxRegistrationSchema = z.object({
  taxType: z.string().trim().min(2, "Tax type is required").max(50),
  registrationNumber: z
    .string()
    .trim()
    .min(4, "Registration number must be at least 4 characters")
    .max(50, "Registration number is too long")
    .regex(/^[A-Za-z0-9\-\s]+$/, "Registration number must only contain alphanumeric characters, spaces, or hyphens"),
  businessName: z.string().trim().max(100).optional().nullable(),
  businessAddress: z.string().trim().max(255).optional().nullable(),
  documentUrl: z.string().url("Must be a valid document URL").optional().nullable(),
  jurisdictionId: z.string().optional().nullable(),
});

export const taxReportFilterSchema = z.object({
  listingId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  taxType: taxTypeSchema.optional(),
  remittanceResponsibility: taxRemittanceResponsibilitySchema.optional(),
});

export const taxPreviewInputSchema = z.object({
  listingId: z.string().min(1),
  nights: z.number().int().min(1).default(1),
  guests: z.number().int().min(1).default(1),
  pets: z.number().int().min(0).default(0),
  baseNightlyPrice: z.number().int().min(0).default(10000), // in cents
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Taxpayer Profiles & VAT/GST Validation Helpers & Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const taxpayerTypeSchema = z.enum(["INDIVIDUAL", "BUSINESS"]);
export const taxIdentifierTypeSchema = z.enum(["NIN", "IQAMA", "TIN", "CR", "OTHER"]);

/**
 * Validates Saudi ZATCA 15-digit VAT number format.
 * Format: 15 digits total, starts with '3' and ends with '3'.
 * Explicitly differentiates from a 10-digit TIN.
 */
export function validateSaudiVatNumber(rawVat: string): {
  valid: boolean;
  error?: string;
  cleanVat?: string;
} {
  const clean = rawVat.replace(/[\s\-_]/g, "");

  if (clean.length === 10) {
    return {
      valid: false,
      error: "This appears to be a 10-digit Tax Identification Number (TIN). A Saudi VAT registration number must be 15 digits starting and ending with 3.",
    };
  }

  if (clean.length !== 15) {
    return {
      valid: false,
      error: `Saudi VAT number must be exactly 15 digits. Received ${clean.length} digits.`,
    };
  }

  if (!clean.startsWith("3")) {
    return {
      valid: false,
      error: "Saudi VAT registration number must start with digit 3.",
    };
  }

  if (!clean.endsWith("3")) {
    return {
      valid: false,
      error: "Saudi VAT registration number must end with digit 3.",
    };
  }

  if (!/^\d{15}$/.test(clean)) {
    return {
      valid: false,
      error: "Saudi VAT number must contain only numeric digits.",
    };
  }

  return { valid: true, cleanVat: clean };
}

/**
 * Validates Saudi Taxpayer Identification numbers (NIN, Iqama, TIN, CR).
 */
export function validateSaudiTaxIdentifier(
  type: "NIN" | "IQAMA" | "TIN" | "CR" | "OTHER",
  rawId: string,
): { valid: boolean; error?: string; cleanId?: string } {
  const clean = rawId.replace(/[\s\-_]/g, "");

  switch (type) {
    case "NIN":
      if (!/^1\d{9}$/.test(clean)) {
        return {
          valid: false,
          error: "Saudi National ID (NIN) must be 10 digits starting with 1.",
        };
      }
      break;
    case "IQAMA":
      if (!/^2\d{9}$/.test(clean)) {
        return {
          valid: false,
          error: "Saudi Iqama / Residency Number must be 10 digits starting with 2.",
        };
      }
      break;
    case "TIN":
      if (!/^3\d{9}$/.test(clean)) {
        return {
          valid: false,
          error: "Saudi Tax Identification Number (TIN) must be 10 digits starting with 3.",
        };
      }
      break;
    case "CR":
      if (!/^\d{10}$/.test(clean)) {
        return {
          valid: false,
          error: "Commercial Registration (CR) number must be exactly 10 digits.",
        };
      }
      break;
    case "OTHER":
      if (clean.length < 4 || clean.length > 30) {
        return {
          valid: false,
          error: "Tax identifier must be between 4 and 30 characters.",
        };
      }
      break;
  }

  return { valid: true, cleanId: clean };
}

/**
 * Masks a sensitive tax identifier preserving the last 4 characters.
 * E.g. "1029384756" -> "••••••4756"
 */
export function maskTaxIdentifier(rawId: string): string {
  const clean = rawId.replace(/[\s\-_]/g, "");
  if (clean.length <= 4) {
    return "••••";
  }
  const last4 = clean.slice(-4);
  const maskedPrefix = "•".repeat(clean.length - 4);
  return `${maskedPrefix}${last4}`;
}

export const saveTaxpayerProfileSchema = z
  .object({
    taxpayerType: taxpayerTypeSchema.default("INDIVIDUAL"),
    legalName: z.string().trim().min(2, "Legal name must be at least 2 characters").max(100),
    businessName: z.string().trim().max(100).optional().nullable(),
    businessRegistrationNumber: z.string().trim().max(50).optional().nullable(),
    countryCode: z.string().trim().length(2, "Country code must be 2 characters (e.g. SA)").default("SA"),
    taxIdentifierType: taxIdentifierTypeSchema.default("NIN"),
    taxIdentifier: z.string().trim().min(4, "Tax identifier must be at least 4 characters").max(50),
    addressLine1: z.string().trim().max(150).optional().nullable(),
    addressLine2: z.string().trim().max(150).optional().nullable(),
    city: z.string().trim().max(100).optional().nullable(),
    region: z.string().trim().max(100).optional().nullable(),
    postalCode: z.string().trim().max(20).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.taxpayerType === "BUSINESS" && !data.businessName?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: "Business name is required for business taxpayer classification.",
      path: ["businessName"],
    },
  )
  .refine(
    (data) => {
      if (data.countryCode === "SA") {
        const val = validateSaudiTaxIdentifier(data.taxIdentifierType as any, data.taxIdentifier);
        return val.valid;
      }
      return true;
    },
    {
      message: "Invalid tax identification number for Saudi Arabia.",
      path: ["taxIdentifier"],
    },
  );

export const saveVatRegistrationInputSchema = z
  .object({
    countryCode: z.string().trim().length(2).default("SA"),
    isVatRegistered: z.boolean().default(true),
    vatNumber: z.string().trim().optional().nullable(),
    businessName: z.string().trim().max(100).optional().nullable(),
    businessAddress: z.string().trim().max(255).optional().nullable(),
    documentUrl: z.string().url("Must be a valid document URL").optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.isVatRegistered && !data.vatNumber?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: "VAT/GST number is mandatory when indicating VAT-registered status.",
      path: ["vatNumber"],
    },
  )
  .refine(
    (data) => {
      if (data.isVatRegistered && data.countryCode === "SA" && data.vatNumber) {
        const check = validateSaudiVatNumber(data.vatNumber);
        return check.valid;
      }
      return true;
    },
    {
      message: "Invalid Saudi ZATCA 15-digit VAT number format.",
      path: ["vatNumber"],
    },
  );

