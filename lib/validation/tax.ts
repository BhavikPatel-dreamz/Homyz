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
  "CLEANING_FEE",
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
    rate: z.number().min(0.1, "Tax percentage must be at least 0.1%").max(100, "Tax percentage cannot exceed 100%").optional().nullable(),
    amount: z.number().int().min(1, "Amount must be at least 1 cent").optional().nullable(),
    taxableComponents: z.array(taxableComponentSchema).min(1, "At least one taxable component must be selected").default(["BASE_PRICE"]),
    remittanceResponsibility: taxRemittanceResponsibilitySchema.default("HOST"),
    longStayExemptionNights: z.number().int().min(1).max(365).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.calculationMethod === "PERCENTAGE") {
        return typeof data.rate === "number" && data.rate > 0;
      }
      return typeof data.amount === "number" && data.amount > 0;
    },
    {
      message: "A valid rate percentage or fixed amount is required for the chosen calculation method",
      path: ["rate"],
    }
  );

export const updateHostTaxSchema = z
  .object({
    customName: z.string().trim().min(2).max(60).optional().nullable(),
    calculationMethod: taxCalculationMethodSchema.optional(),
    rate: z.number().min(0.1).max(100).optional().nullable(),
    amount: z.number().int().min(1).optional().nullable(),
    taxableComponents: z.array(taxableComponentSchema).min(1).optional(),
    remittanceResponsibility: taxRemittanceResponsibilitySchema.optional(),
    longStayExemptionNights: z.number().int().min(1).max(365).optional().nullable(),
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
  cleaningFee: z.number().int().min(0).default(0),
  baseNightlyPrice: z.number().int().min(0).default(10000), // in cents
});

