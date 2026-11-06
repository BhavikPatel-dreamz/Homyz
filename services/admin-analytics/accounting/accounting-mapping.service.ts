import { AppError } from "@/lib/api/errors";
import type {
  AccountingJournalEntry,
  ChartOfAccountMapping,
  JournalEntryLine,
} from "./accounting-contracts";

export const STANDARD_CHART_OF_ACCOUNTS: Record<string, ChartOfAccountMapping> = {
  OPERATING_BANK: {
    accountCode: "1010",
    accountName: "Operating Cash / Bank Account (SARIE Rail)",
    accountType: "ASSET",
    normalBalance: "DEBIT",
  },
  GATEWAY_CLEARING: {
    accountCode: "1020",
    accountName: "Payment Gateway In-Transit Clearing",
    accountType: "ASSET",
    normalBalance: "DEBIT",
  },
  HOST_PAYOUT_LIABILITY: {
    accountCode: "2010",
    accountName: "Host Payout Obligations Payable",
    accountType: "LIABILITY",
    normalBalance: "CREDIT",
  },
  TAX_PAYABLE: {
    accountCode: "2030",
    accountName: "Hospitality & VAT Tax Payable",
    accountType: "LIABILITY",
    normalBalance: "CREDIT",
  },
  PLATFORM_COMMISSION: {
    accountCode: "4010",
    accountName: "Platform Marketplace Commission Revenue",
    accountType: "REVENUE",
    normalBalance: "CREDIT",
  },
  GATEWAY_FEE_EXPENSE: {
    accountCode: "5010",
    accountName: "Merchant Processing & Gateway Interchange Fees",
    accountType: "EXPENSE",
    normalBalance: "DEBIT",
  },
};

export const accountingMappingService = {
  /**
   * Generates a balanced double-entry journal for a captured guest payment.
   * Debits Gateway Clearing and credits Host Liability, Platform Commission, and Taxes.
   */
  createPaymentCapturedJournal(params: {
    paymentId: string;
    bookingId: string;
    totalCapturedCents: number;
    hostPayoutShareCents: number;
    platformCommissionCents: number;
    taxCollectedCents: number;
    currency?: string;
    dateKey?: string;
  }): AccountingJournalEntry {
    const currency = params.currency || "SAR";
    const transactionDate = params.dateKey || new Date().toISOString().slice(0, 10);

    // Verify arithmetic consistency: hostShare + commission + tax must equal totalCaptured
    const expectedCreditTotal =
      params.hostPayoutShareCents + params.platformCommissionCents + params.taxCollectedCents;

    // Small rounding reconciliation adjustments if any
    let reconciledHostShare = params.hostPayoutShareCents;
    if (expectedCreditTotal !== params.totalCapturedCents) {
      reconciledHostShare = params.totalCapturedCents - (params.platformCommissionCents + params.taxCollectedCents);
    }

    const lines: JournalEntryLine[] = [
      {
        accountCode: STANDARD_CHART_OF_ACCOUNTS.GATEWAY_CLEARING.accountCode,
        accountName: STANDARD_CHART_OF_ACCOUNTS.GATEWAY_CLEARING.accountName,
        description: `Gateway cash capture for Booking ${params.bookingId}`,
        debitCents: params.totalCapturedCents,
        creditCents: 0,
      },
      {
        accountCode: STANDARD_CHART_OF_ACCOUNTS.HOST_PAYOUT_LIABILITY.accountCode,
        accountName: STANDARD_CHART_OF_ACCOUNTS.HOST_PAYOUT_LIABILITY.accountName,
        description: `Host earnings obligation for Booking ${params.bookingId}`,
        debitCents: 0,
        creditCents: reconciledHostShare,
      },
      {
        accountCode: STANDARD_CHART_OF_ACCOUNTS.PLATFORM_COMMISSION.accountCode,
        accountName: STANDARD_CHART_OF_ACCOUNTS.PLATFORM_COMMISSION.accountName,
        description: `Homyz platform commission for Booking ${params.bookingId}`,
        debitCents: 0,
        creditCents: params.platformCommissionCents,
      },
    ];

    if (params.taxCollectedCents > 0) {
      lines.push({
        accountCode: STANDARD_CHART_OF_ACCOUNTS.TAX_PAYABLE.accountCode,
        accountName: STANDARD_CHART_OF_ACCOUNTS.TAX_PAYABLE.accountName,
        description: `VAT & hospitality tax liability for Booking ${params.bookingId}`,
        debitCents: 0,
        creditCents: params.taxCollectedCents,
      });
    }

    const totalDebit = lines.reduce((sum, l) => sum + l.debitCents, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.creditCents, 0);

    return {
      id: `jnl_pay_${params.paymentId}`,
      sourceEntityType: "PAYMENT",
      sourceEntityId: params.paymentId,
      transactionDate,
      currency,
      memo: `Guest payment capture for reservation #${params.bookingId}`,
      lines,
      totalDebitCents: totalDebit,
      totalCreditCents: totalCredit,
      isBalanced: totalDebit === totalCredit,
    };
  },

  /**
   * Generates a balanced double-entry journal for a succeeded refund.
   */
  createRefundJournal(params: {
    refundId: string;
    bookingId: string;
    paymentId?: string;
    refundAmountCents: number;
    hostDeductionCents: number;
    commissionReversalCents?: number;
    feeReversalCents?: number;
    currency?: string;
    dateKey?: string;
    timestamp?: string;
  }): AccountingJournalEntry {
    const currency = params.currency || "SAR";
    const transactionDate = params.dateKey || (params.timestamp ? params.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10));
    const commissionReversal = params.commissionReversalCents ?? params.feeReversalCents ?? (params.refundAmountCents - params.hostDeductionCents);

    const lines: JournalEntryLine[] = [
      {
        accountCode: STANDARD_CHART_OF_ACCOUNTS.HOST_PAYOUT_LIABILITY.accountCode,
        accountName: STANDARD_CHART_OF_ACCOUNTS.HOST_PAYOUT_LIABILITY.accountName,
        description: `Host payout reduction for refunded Booking ${params.bookingId}`,
        debitCents: params.hostDeductionCents,
        creditCents: 0,
      },
      {
        accountCode: STANDARD_CHART_OF_ACCOUNTS.PLATFORM_COMMISSION.accountCode,
        accountName: STANDARD_CHART_OF_ACCOUNTS.PLATFORM_COMMISSION.accountName,
        description: `Platform fee refund reversal for Booking ${params.bookingId}`,
        debitCents: commissionReversal,
        creditCents: 0,
      },
      {
        accountCode: STANDARD_CHART_OF_ACCOUNTS.GATEWAY_CLEARING.accountCode,
        accountName: STANDARD_CHART_OF_ACCOUNTS.GATEWAY_CLEARING.accountName,
        description: `Disbursed refund reversal for Booking ${params.bookingId}`,
        debitCents: 0,
        creditCents: params.refundAmountCents,
      },
    ];

    const totalDebit = lines.reduce((sum, l) => sum + l.debitCents, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.creditCents, 0);

    return {
      id: `jnl_ref_${params.refundId}`,
      sourceEntityType: "REFUND",
      sourceEntityId: params.refundId,
      transactionDate,
      currency,
      memo: `Guest refund settlement for reservation #${params.bookingId}`,
      lines,
      totalDebitCents: totalDebit,
      totalCreditCents: totalCredit,
      isBalanced: totalDebit === totalCredit,
    };
  },

  /**
   * Generates a balanced double-entry journal for a settled host payout.
   */
  createPayoutSettledJournal(params: {
    distributionId: string;
    hostId: string;
    amountCents: number;
    currency?: string;
    dateKey?: string;
  }): AccountingJournalEntry {
    const currency = params.currency || "SAR";
    const transactionDate = params.dateKey || new Date().toISOString().slice(0, 10);

    const lines: JournalEntryLine[] = [
      {
        accountCode: STANDARD_CHART_OF_ACCOUNTS.HOST_PAYOUT_LIABILITY.accountCode,
        accountName: STANDARD_CHART_OF_ACCOUNTS.HOST_PAYOUT_LIABILITY.accountName,
        description: `Discharge of host payout obligation for Host ${params.hostId}`,
        debitCents: params.amountCents,
        creditCents: 0,
      },
      {
        accountCode: STANDARD_CHART_OF_ACCOUNTS.OPERATING_BANK.accountCode,
        accountName: STANDARD_CHART_OF_ACCOUNTS.OPERATING_BANK.accountName,
        description: `SARIE bank wire disbursement for Host ${params.hostId}`,
        debitCents: 0,
        creditCents: params.amountCents,
      },
    ];

    return {
      id: `jnl_payout_${params.distributionId}`,
      sourceEntityType: "PAYOUT",
      sourceEntityId: params.distributionId,
      transactionDate,
      currency,
      memo: `SARIE host payout disbursement for distribution #${params.distributionId}`,
      lines,
      totalDebitCents: params.amountCents,
      totalCreditCents: params.amountCents,
      isBalanced: true,
    };
  },

  /**
   * Alias for createPaymentCapturedJournal with parameter flexibility
   */
  createPaymentCaptureJournal(params: {
    paymentId: string;
    bookingId: string;
    totalGrossCents?: number;
    totalCapturedCents?: number;
    hostPayoutCents?: number;
    hostPayoutShareCents?: number;
    platformFeeCents?: number;
    platformCommissionCents?: number;
    taxCents?: number;
    taxCollectedCents?: number;
    currency?: string;
    timestamp?: string;
    dateKey?: string;
  }): AccountingJournalEntry {
    return this.createPaymentCapturedJournal({
      paymentId: params.paymentId,
      bookingId: params.bookingId,
      totalCapturedCents: params.totalGrossCents ?? params.totalCapturedCents ?? 0,
      hostPayoutShareCents: params.hostPayoutCents ?? params.hostPayoutShareCents ?? 0,
      platformCommissionCents: params.platformFeeCents ?? params.platformCommissionCents ?? 0,
      taxCollectedCents: params.taxCents ?? params.taxCollectedCents ?? 0,
      currency: params.currency,
      dateKey: params.dateKey || (params.timestamp ? params.timestamp.slice(0, 10) : undefined),
    });
  },

  /**
   * Alias for createPayoutSettledJournal with parameter flexibility
   */
  createPayoutSettlementJournal(params: {
    payoutId?: string;
    distributionId?: string;
    hostId: string;
    amountCents: number;
    currency?: string;
    timestamp?: string;
    dateKey?: string;
  }): AccountingJournalEntry {
    return this.createPayoutSettledJournal({
      distributionId: params.payoutId || params.distributionId || `payout_${Date.now()}`,
      hostId: params.hostId,
      amountCents: params.amountCents,
      currency: params.currency,
      dateKey: params.dateKey || (params.timestamp ? params.timestamp.slice(0, 10) : undefined),
    });
  },
};
