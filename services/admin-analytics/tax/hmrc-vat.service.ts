/**
 * Phase 11 — UK HMRC Making Tax Digital (MTD) VAT Service
 * Implements 9-Box VAT return calculation from verified journals, anti-fraud header generation,
 * multi-stage CFO approval workflow, and simulated HMRC MTD VAT API submission.
 */

import crypto from "node:crypto";
import { AppError, ErrorCode } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { Role } from "@/generated/prisma/enums";
import type {
  HmrcAntiFraudHeaders,
  HmrcNineBoxReturn,
  HmrcObligation,
  HmrcReturnStatus,
  HmrcVatLiability,
  HmrcVatPayment,
  HmrcVatReturnRecord,
} from "./hmrc-contracts";

const UK_ENTITY_ID = "HOMYZ_UK_LTD";
const UK_VAT_NUMBER = "GB-948-2019-34";

// Persistent in-memory stores for HMRC obligations and filings
const obligationsStore = new Map<string, HmrcObligation>();
const returnsStore = new Map<string, HmrcVatReturnRecord>();
const liabilitiesStore = new Map<string, HmrcVatLiability>();
const paymentsStore = new Map<string, HmrcVatPayment>();

// Seed obligations
if (obligationsStore.size === 0) {
  obligationsStore.set("26A1", {
    periodKey: "26A1",
    start: "2026-01-01",
    end: "2026-03-31",
    due: "2026-05-07",
    status: "F",
    received: "2026-05-04",
  });
  obligationsStore.set("26A2", {
    periodKey: "26A2",
    start: "2026-04-01",
    end: "2026-06-30",
    due: "2026-08-07",
    status: "F",
    received: "2026-08-05",
  });
  obligationsStore.set("26A3", {
    periodKey: "26A3",
    start: "2026-07-01",
    end: "2026-09-30",
    due: "2026-11-07",
    status: "O",
  });

  // Seed sample liabilities and payments
  liabilitiesStore.set("liab_26a1", {
    id: "liab_26a1",
    periodKey: "26A1",
    taxPeriodFrom: "2026-01-01",
    taxPeriodTo: "2026-03-31",
    type: "VAT Return",
    originalAmount: 14200.0,
    outstandingAmount: 0.0,
    due: "2026-05-07",
  });

  paymentsStore.set("pay_26a1", {
    id: "pay_26a1",
    taxPeriodFrom: "2026-01-01",
    taxPeriodTo: "2026-03-31",
    amount: 14200.0,
    receivedDate: "2026-05-06",
    method: "DIRECT_DEBIT",
  });
}

export const hmrcVatService = {
  /**
   * Generates mandatory HMRC Fraud Prevention headers.
   */
  generateAntiFraudHeaders(user?: AuthUser, clientIp = "127.0.0.1"): HmrcAntiFraudHeaders {
    return {
      "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
      "Gov-Client-Device-ID": crypto.createHash("sha256").update(user?.id || "homyz_server_node_1").digest("hex"),
      "Gov-Client-User-IDs": `homyz_user=${user?.id || "anonymous"}`,
      "Gov-Client-Timezone": "UTC",
      "Gov-Client-Local-IPs": clientIp,
      "Gov-Client-Screens": "width=1920&height=1080&scaling-factor=1&colour-depth=24",
      "Gov-Vendor-Version": "homyz-erp=11.0.0",
    };
  },

  /**
   * Retrieves HMRC VAT obligations.
   */
  async getObligations(status?: "O" | "F"): Promise<HmrcObligation[]> {
    const list = Array.from(obligationsStore.values());
    if (status) {
      return list.filter((o) => o.status === status);
    }
    return list;
  },

  /**
   * Calculates HMRC 9-Box VAT return values from verified transactional ledger figures.
   */
  calculateNineBoxes(params: {
    taxableSalesMinor: number;       // Sales subject to UK 20% VAT (in minor units / pence)
    inputPurchasesMinor: number;     // Allowable UK business expenses with input VAT (in pence)
    vatRatePercent?: number;         // Standard UK 20%
  }): HmrcNineBoxReturn {
    const vatRate = params.vatRatePercent ?? 20.0;

    const salesPence = params.taxableSalesMinor;
    const purchasesPence = params.inputPurchasesMinor;

    const box1Pence = Math.round((salesPence * vatRate) / 100);
    const box2Pence = 0; // Acquisitions from EU
    const box3Pence = box1Pence + box2Pence;
    const box4Pence = Math.round((purchasesPence * vatRate) / 100);
    const box5Pence = Math.abs(box3Pence - box4Pence);

    // Box 6 and 7 in whole pounds sterling
    const box6 = Math.round(salesPence / 100);
    const box7 = Math.round(purchasesPence / 100);
    const box8 = 0;
    const box9 = 0;

    return {
      periodKey: "26A3",
      box1VatDueSales: Number((box1Pence / 100).toFixed(2)),
      box2VatDueAcquisitions: 0.0,
      box3TotalVatDue: Number((box3Pence / 100).toFixed(2)),
      box4VatReclaimedCurrPeriod: Number((box4Pence / 100).toFixed(2)),
      box5NetVatDue: Number((box5Pence / 100).toFixed(2)),
      box6TotalValueSalesExVAT: box6,
      box7TotalValuePurchasesExVAT: box7,
      box8TotalValueGoodsSuppliedExVAT: box8,
      box9TotalAcquisitionsExVAT: box9,
      finalised: false,
    };
  },

  /**
   * Prepares a draft 9-Box return for a given period.
   */
  async prepareVatReturn(params: {
    periodKey: string;
    quarterLabel: string;
    taxableSalesMinor?: number;
    inputPurchasesMinor?: number;
    user?: AuthUser;
  }): Promise<HmrcVatReturnRecord> {
    const salesMinor = params.taxableSalesMinor ?? 12500000; // £125,000.00
    const purchasesMinor = params.inputPurchasesMinor ?? 4500000; // £45,000.00

    const nineBoxes = this.calculateNineBoxes({
      taxableSalesMinor: salesMinor,
      inputPurchasesMinor: purchasesMinor,
    });
    nineBoxes.periodKey = params.periodKey;

    const returnId = `hmrc_vat_${params.periodKey.toLowerCase()}`;
    const antiFraudHeaders = this.generateAntiFraudHeaders(params.user);

    const record: HmrcVatReturnRecord = {
      id: returnId,
      entityId: UK_ENTITY_ID,
      vatRegistrationNumber: UK_VAT_NUMBER,
      periodKey: params.periodKey,
      quarterLabel: params.quarterLabel,
      nineBoxes,
      status: "DRAFT_BOXES",
      preparedAt: new Date().toISOString(),
      antiFraudHeaders,
      declarationSigned: false,
      complianceDisclaimer:
        "HMRC Making Tax Digital (MTD) VAT Integration: Submitting a digital VAT return files the mandatory 9-box tax return with HMRC. It does NOT initiate direct bank debit or funds remittance; liability payment must be settled through approved banking rails (HMRC Direct Debit or online bank transfer).",
    };

    returnsStore.set(record.id, record);
    return record;
  },

  /**
   * Approves a prepared VAT return with explicit CFO declaration.
   */
  async approveReturn(
    returnId: string,
    user: AuthUser,
    options: { declarationSigned: boolean }
  ): Promise<HmrcVatReturnRecord> {
    const record = returnsStore.get(returnId);
    if (!record) {
      throw new AppError(ErrorCode.NOT_FOUND, "VAT return record not found", 404);
    }

    if (user.role !== Role.ADMIN) {
      throw new AppError(ErrorCode.FORBIDDEN, "Only authorized financial controllers can approve HMRC VAT filings", 403);
    }

    if (!options.declarationSigned) {
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        "HMRC statutory requirement: Legal declaration must be signed prior to approval",
        400
      );
    }

    record.status = "CFO_APPROVED";
    record.approvedByActorId = user.id;
    record.approvedAt = new Date().toISOString();
    record.declarationSigned = true;
    record.declarationSignerName = user.name || user.email;
    record.nineBoxes.finalised = true;

    returnsStore.set(record.id, record);
    return record;
  },

  /**
   * Submits an approved VAT return to HMRC MTD VAT API.
   */
  async submitReturnToHmrc(
    returnId: string,
    user: AuthUser,
    customHeaders?: Partial<HmrcAntiFraudHeaders>
  ): Promise<{
    success: boolean;
    receiptId: string;
    submittedAt: string;
    vatReturn: HmrcVatReturnRecord;
    regulatoryNotice: string;
  }> {
    const record = returnsStore.get(returnId);
    if (!record) {
      throw new AppError(ErrorCode.NOT_FOUND, "VAT return record not found", 404);
    }

    if (record.status !== "CFO_APPROVED") {
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        `Cannot submit VAT return in status ${record.status}. Must be CFO_APPROVED first.`,
        400
      );
    }

    // Merge anti-fraud headers
    record.antiFraudHeaders = {
      ...this.generateAntiFraudHeaders(user),
      ...customHeaders,
    };

    // Simulate successful HMRC MTD API transmission
    const receiptId = `HMRC_VR_${record.periodKey}_${Date.now()}_${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const submittedAt = new Date().toISOString();

    record.status = "ACCEPTED";
    record.submittedAt = submittedAt;
    record.hmrcReceiptId = receiptId;

    // Update obligation to Fulfilled
    const obligation = obligationsStore.get(record.periodKey);
    if (obligation) {
      obligation.status = "F";
      obligation.received = submittedAt.split("T")[0];
      obligationsStore.set(record.periodKey, obligation);
    }

    // Record open liability for Box 5 net payment
    liabilitiesStore.set(`liab_${record.periodKey.toLowerCase()}`, {
      id: `liab_${record.periodKey.toLowerCase()}`,
      periodKey: record.periodKey,
      taxPeriodFrom: obligation?.start || "2026-07-01",
      taxPeriodTo: obligation?.end || "2026-09-30",
      type: "VAT Return",
      originalAmount: record.nineBoxes.box5NetVatDue,
      outstandingAmount: record.nineBoxes.box5NetVatDue,
      due: obligation?.due || "2026-11-07",
    });

    returnsStore.set(record.id, record);

    return {
      success: true,
      receiptId,
      submittedAt,
      vatReturn: record,
      regulatoryNotice:
        "VAT return successfully submitted and acknowledged by HMRC MTD. Remittance notice: Direct debit or online bank transfer of Box 5 liability must be arranged through your UK corporate banking facility before the due date.",
    };
  },

  /**
   * Retrieves stored VAT returns.
   */
  async getReturns(): Promise<HmrcVatReturnRecord[]> {
    return Array.from(returnsStore.values());
  },

  /**
   * Retrieves liabilities and payments history.
   */
  async getLiabilitiesAndPayments(): Promise<{
    liabilities: HmrcVatLiability[];
    payments: HmrcVatPayment[];
  }> {
    return {
      liabilities: Array.from(liabilitiesStore.values()),
      payments: Array.from(paymentsStore.values()),
    };
  },
};
