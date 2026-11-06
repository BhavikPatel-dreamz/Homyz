export type AccountingProvider = "QUICKBOOKS" | "XERO" | "NETSUITE";

export type AccountingSyncStatus = "PENDING" | "SYNCED" | "FAILED" | "DISCONNECTED";

export interface ChartOfAccountMapping {
  accountCode: string;
  accountName: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  normalBalance: "DEBIT" | "CREDIT";
  providerExternalId?: string;
}

export interface JournalEntryLine {
  accountCode: string;
  accountName: string;
  description: string;
  debitCents: number;
  creditCents: number;
}

export interface AccountingJournalEntry {
  id: string;
  sourceEntityType: "PAYMENT" | "REFUND" | "PAYOUT" | "SETTLEMENT_BATCH";
  sourceEntityId: string;
  transactionDate: string; // ISO Date YYYY-MM-DD
  currency: string;
  memo: string;
  lines: JournalEntryLine[];
  totalDebitCents: number;
  totalCreditCents: number;
  isBalanced: boolean; // strictly totalDebit === totalCredit
}

export interface AccountingSyncRecord {
  id: string;
  provider: AccountingProvider;
  journalEntryId: string;
  externalTransactionId?: string | null;
  status: AccountingSyncStatus;
  attemptCount: number;
  lastAttemptAt?: string | null;
  syncedAt?: string | null;
  errorMessage?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AccountingIntegrationStatus {
  provider: AccountingProvider;
  isConnected: boolean;
  connectionState: "CONNECTED" | "PENDING_CONFIGURATION" | "DISCONNECTED";
  authType: "OAUTH2" | "API_KEY";
  tenantId?: string;
  lastSyncAt?: string | null;
  pendingRecordsCount: number;
  failedRecordsCount: number;
  syncedRecordsCount: number;
  supportedCurrencies: string[];
}

