/**
 * UK HMRC Making Tax Digital (MTD) VAT Contracts - Phase 11
 * Types for MTD VAT 9-Box returns, obligations, anti-fraud headers, and submission workflows.
 */

export interface HmrcObligation {
  periodKey: string;     // e.g. "26A1", "#001"
  start: string;         // YYYY-MM-DD
  end: string;           // YYYY-MM-DD
  due: string;           // YYYY-MM-DD
  status: "O" | "F";     // "O" = Open, "F" = Fulfilled
  received?: string;     // Date received by HMRC
}

export interface HmrcNineBoxReturn {
  periodKey: string;
  box1VatDueSales: number;           // Box 1: VAT due on sales and other outputs (£)
  box2VatDueAcquisitions: number;    // Box 2: VAT due from EU acquisitions (£)
  box3TotalVatDue: number;           // Box 3: Total VAT due (Box 1 + Box 2) (£)
  box4VatReclaimedCurrPeriod: number;// Box 4: VAT reclaimed on business purchases (£)
  box5NetVatDue: number;             // Box 5: Net VAT to pay or be refunded (£)
  box6TotalValueSalesExVAT: number;  // Box 6: Total sales ex VAT (£)
  box7TotalValuePurchasesExVAT: number; // Box 7: Total purchases ex VAT (£)
  box8TotalValueGoodsSuppliedExVAT: number; // Box 8: Total supplies to EU ex VAT (£)
  box9TotalAcquisitionsExVAT: number;// Box 9: Total acquisitions from EU ex VAT (£)
  finalised: boolean;
}

export interface HmrcAntiFraudHeaders {
  "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER" | "DESKTOP_APP_DIRECT" | "OTHER";
  "Gov-Client-Device-ID": string;
  "Gov-Client-User-IDs": string;
  "Gov-Client-Timezone": string;
  "Gov-Client-Local-IPs"?: string;
  "Gov-Client-Screens"?: string;
  "Gov-Vendor-Version": string;
}

export type HmrcReturnStatus =
  | "DRAFT_BOXES"
  | "FINANCE_REVIEW"
  | "CFO_APPROVED"
  | "SUBMITTED_TO_HMRC"
  | "ACCEPTED"
  | "REJECTED";

export interface HmrcVatReturnRecord {
  id: string;
  entityId: string; // "HOMYZ_UK_LTD"
  vatRegistrationNumber: string; // "GB-948-2019-34"
  periodKey: string;
  quarterLabel: string; // "2026-Q3"
  nineBoxes: HmrcNineBoxReturn;
  status: HmrcReturnStatus;
  preparedAt: string;
  reviewedByActorId?: string | null;
  reviewedAt?: string | null;
  approvedByActorId?: string | null;
  approvedAt?: string | null;
  submittedAt?: string | null;
  hmrcReceiptId?: string | null;
  antiFraudHeaders: HmrcAntiFraudHeaders;
  declarationSigned: boolean;
  declarationSignerName?: string | null;
  complianceDisclaimer: string;
}

export interface HmrcVatLiability {
  id: string;
  periodKey: string;
  taxPeriodFrom: string;
  taxPeriodTo: string;
  type: "VAT Return" | "Interest" | "Penalty";
  originalAmount: number;
  outstandingAmount: number;
  due: string;
}

export interface HmrcVatPayment {
  id: string;
  taxPeriodFrom: string;
  taxPeriodTo: string;
  amount: number;
  receivedDate: string;
  method: "DIRECT_DEBIT" | "BANK_TRANSFER" | "CARD";
}

