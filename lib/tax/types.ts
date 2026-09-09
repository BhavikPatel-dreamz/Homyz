export type TaxType =
  | "VAT"
  | "GST"
  | "TOURIST_TAX"
  | "OCCUPANCY_TAX"
  | "LODGING_TAX"
  | "SALES_TAX"
  | "CITY_TAX"
  | "OTHER";

export type TaxCalculationMethod =
  | "PERCENTAGE"
  | "FLAT_PER_BOOKING"
  | "AMOUNT_PER_NIGHT"
  | "AMOUNT_PER_GUEST"
  | "AMOUNT_PER_GUEST_PER_NIGHT";

export type TaxRemittanceResponsibility =
  | "PLATFORM"
  | "HOST"
  | "THIRD_PARTY"
  | "MANUAL";

export type TaxRegistrationStatus =
  | "UNVERIFIED"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED";

export type TaxableComponent =
  | "BASE_PRICE"
  | "CLEANING_FEE"
  | "PET_FEE"
  | "GUEST_FEE"
  | "RESORT_FEE";

export interface TaxJurisdictionDTO {
  id: string;
  country: string;
  region: string | null;
  city: string | null;
  name: string;
  currency: string;
  isActive: boolean;
}

export interface TaxRuleDTO {
  id: string;
  jurisdictionId: string;
  taxType: TaxType;
  name: string;
  description: string | null;
  calculationMethod: TaxCalculationMethod;
  rate: number | null; // e.g. 15.0 for 15%
  amount: number | null; // minor units (cents)
  taxableComponents: TaxableComponent[];
  remittanceResponsibility: TaxRemittanceResponsibility;
  isSystemManaged: boolean;
  isInclusive: boolean;
  longStayExemptionNights: number | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  version: number;
  isActive: boolean;
}

export interface ListingTaxDTO {
  id: string;
  listingId: string;
  taxRuleId: string | null;
  customName: string | null;
  taxType: TaxType;
  calculationMethod: TaxCalculationMethod;
  rate: number | null;
  amount: number | null;
  taxableComponents: TaxableComponent[];
  remittanceResponsibility: TaxRemittanceResponsibility;
  longStayExemptionNights: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxRegistrationDTO {
  id: string;
  hostId: string;
  jurisdictionId: string | null;
  taxType: string;
  registrationNumber: string;
  businessName: string | null;
  businessAddress: string | null;
  documentUrl: string | null;
  status: TaxRegistrationStatus;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalculatedTaxItem {
  id?: string;
  taxRuleId?: string | null;
  taxRuleVersion: number;
  taxName: string;
  taxType: TaxType;
  calculationMethod: TaxCalculationMethod;
  rate: number | null;
  amount: number | null;
  taxableBase: number; // in minor units / cents
  taxAmount: number; // in minor units / cents
  currency: string;
  remittanceResponsibility: TaxRemittanceResponsibility;
  isInclusive: boolean;
  isExempt: boolean;
  exemptionReason?: string;
}

export interface HostPayoutBreakdown {
  accommodationSubtotal: number; // nightly subtotal minus discounts
  cleaningFee: number;
  petFee: number;
  taxesCollectedForHost: number; // Host-remitted taxes collected from guest
  taxesRemittedByPlatform: number; // Platform-remitted taxes
  platformServiceFee: number; // Platform commission
  netHostPayout: number; // Final net payout to host
  currency: string;
}

export interface TaxCalculationResult {
  taxes: CalculatedTaxItem[];
  taxTotal: number; // Total taxes (cents)
  platformRemittedTaxTotal: number; // Platform remittance (cents)
  hostRemittedTaxTotal: number; // Host remittance (cents)
  guestTotal: number; // Total guest pays = Subtotal + Cleaning + Taxes (cents)
  payoutBreakdown: HostPayoutBreakdown;
  currency: string;
}

export interface TaxCalculationParams {
  nights: number;
  nightlySubtotal: number; // in cents
  discountAmount?: number; // in cents
  cleaningFee?: number; // in cents
  petFee?: number; // in cents
  extraGuestFee?: number; // in cents
  guests?: number;
  currency?: string;
  rules?: TaxRuleDTO[];
  hostTaxes?: ListingTaxDTO[];
}

export interface ReservationTaxReportItem {
  id: string;
  bookingId: string;
  listingId: string;
  listingTitle: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  taxName: string;
  taxType: TaxType;
  taxableBase: number;
  rate: number | null;
  taxAmount: number;
  refundedTax: number;
  remittanceResponsibility: TaxRemittanceResponsibility;
  currency: string;
  createdAt: string;
}

export interface TaxReportSummary {
  totalReservations: number;
  totalTaxableRevenue: number;
  totalTaxesCollected: number;
  taxesRemittedByPlatform: number;
  taxesPassedToHost: number;
  taxesRefunded: number;
  netTaxableRevenue: number;
  currency: string;
  items: ReservationTaxReportItem[];
}

export interface TaxInvoiceData {
  invoiceNumber: string;
  issueDate: string;
  bookingId: string;
  stayDates: { checkIn: string; checkOut: string; nights: number };
  supplier: {
    name: string;
    taxId: string | null;
    address: string | null;
  };
  guest: {
    name: string;
    email: string;
  };
  property: {
    title: string;
    address: string;
    city: string;
    country: string;
  };
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  taxBreakdown: {
    taxName: string;
    taxType: TaxType;
    rate: number | null;
    taxableBase: number;
    taxAmount: number;
  }[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
}

