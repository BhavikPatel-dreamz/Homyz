export type AutoPilotMode =
  | "RECOMMENDATIONS_ONLY" // Mode A: Pure advisory, zero automatic changes
  | "APPROVAL_REQUIRED" // Mode B: Proposals generated; host explicitly approves batch
  | "AUTOMATIC_WITHIN_LIMITS"; // Mode C: Explicit host opt-in only, applies bounded daily rates

export type AutoPilotSensitivity = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export type AutoPilotStatus = "ACTIVE" | "PAUSED" | "DISABLED";

export interface AutoPilotConfig {
  listingId: string;
  enabled: boolean; // Must be false by default
  operatingMode: AutoPilotMode;
  minPriceCents: number; // Host floor
  maxPriceCents: number; // Host ceiling
  maxDailyAdjustmentPercentage: number; // e.g. 15%
  maxCumulativeAdjustmentPercentage: number; // e.g. 25% over 30 days
  demandSensitivity: AutoPilotSensitivity;
  weekendAdjustmentEnabled: boolean; // Saudi Thu/Fri
  eligibleFutureDays: number; // Horizon (e.g. 30, 60, 90)
  blackoutDates: string[]; // YYYY-MM-DD dates Auto-Pilot cannot touch
  protectManualOverrides: boolean; // If true, never overwrite customPrices
  status: AutoPilotStatus;
  updatedAt: string;
  optedInAt?: string | null;
}

export interface ProposedPriceChange {
  dateKey: string;
  dayLabel: string;
  isWeekend: boolean;
  oldPriceCents: number;
  newPriceCents: number;
  deltaPercentage: number;
  demandSignal: string;
  reason: string;
  appliedConstraints: string[];
}

export interface AutoPilotExecutionBatch {
  id: string;
  listingId: string;
  executedAt: string;
  mode: AutoPilotMode;
  datesEvaluatedCount: number;
  proposedChanges: ProposedPriceChange[];
  appliedChanges: ProposedPriceChange[];
  skippedDatesCount: number;
  status: "PROPOSED" | "APPLIED" | "REVERTED" | "REJECTED";
  canRollback: boolean;
  executionDurationMs: number;
  triggeredBy: "SCHEDULED_CRON" | "MANUAL_HOST_TRIGGER" | "ADMIN_SIMULATION";
}

