/**
 * Saudi ZATCA Electronic Invoicing (FATOORA Phase 2) Contracts - Phase 11
 * UBL 2.1 XML, Cryptographic Hash Chaining, ECDSA Signature, and 8-Tag Base64 TLV QR Codes.
 */

export type ZatcaInvoiceType =
  | "STANDARD"   // B2B: Requires real-time pre-clearance by ZATCA
  | "SIMPLIFIED" // B2C: Retail travelers, reported within 24 hours
  | "CREDIT_NOTE" // Issued for cancellations / refunds
  | "DEBIT_NOTE";  // Issued for extensions / additional damage charges

export type ZatcaInvoiceStatus =
  | "DRAFT"
  | "VALIDATED"
  | "READY_FOR_SUBMISSION"
  | "SUBMITTED"
  | "ACCEPTED"
  | "ACCEPTED_WITH_WARNINGS"
  | "REJECTED";

export interface ZatcaParty {
  legalName: string;
  vatNumber: string; // 15-digit number starting and ending with 3 (e.g. 310492819200003)
  crn?: string;      // Commercial Registration Number (10 digits)
  streetName: string;
  buildingNumber: string;
  postalZone: string;
  city: string;
  countryCode: string; // "SA"
}

export interface ZatcaLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPriceMinor: number; // in halalas (1 SAR = 100 halalas)
  netAmountMinor: number;
  vatRatePercent: number; // Standard 15.0%
  vatAmountMinor: number;
  totalAmountMinor: number; // Net + VAT
}

export interface ZatcaInvoiceRecord {
  id: string;
  invoiceNumber: string; // e.g. "HOMYZ-SA-2026-000104"
  invoiceUuid: string;   // RFC 4122 UUID v4
  invoiceType: ZatcaInvoiceType;
  issueDate: string;     // YYYY-MM-DD
  issueTime: string;     // HH:mm:ss
  currency: "SAR";
  seller: ZatcaParty;
  buyer: ZatcaParty | { legalName: string; buyerType: "INDIVIDUAL_GUEST" };
  lineItems: ZatcaLineItem[];
  netTotalMinor: number;
  vatTotalMinor: number;
  grossTotalMinor: number;

  // Cryptographic & FATOORA Phase 2 Chaining
  previousInvoiceHash: string; // Base64 of SHA-256 of preceding invoice in chain
  invoiceHash: string;         // SHA-256 hash of canonicalized UBL 2.1 invoice
  digitalSignature: string;     // ECDSA signature over invoiceHash
  qrCodeTlvBase64: string;     // Base64 TLV containing 8 ZATCA tags
  ublXmlPayload: string;       // UBL 2.1 XML

  // Original reference for Credit/Debit notes
  originalInvoiceUuid?: string;
  billingReferenceReason?: string;

  // Submission & Authority status
  status: ZatcaInvoiceStatus;
  submittedAt?: string | null;
  clearanceStatus?: "CLEARED" | "REPORTED" | "NOT_SUBMITTED";
  zatcaWarnings?: string[];
  zatcaErrors?: string[];

  // Mandatory Regulatory Disclosure
  complianceDisclaimer: string;
}

export interface ZatcaSubmissionResult {
  invoiceUuid: string;
  invoiceNumber: string;
  status: ZatcaInvoiceStatus;
  clearanceStatus: "CLEARED" | "REPORTED" | "NOT_SUBMITTED";
  validationPassed: boolean;
  warnings: string[];
  errors: string[];
  submittedAt: string;
  zatcaTrackingId: string;
  regulatoryNotice: string;
}

