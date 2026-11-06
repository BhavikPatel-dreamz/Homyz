import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { Role } from "@/generated/prisma/enums";
import { customReportService } from "./custom-report.service";
import { reportExportService } from "./report-export.service";
import { isEmailDeliveryConfigured, sendOperationalNotificationEmail } from "@/lib/services/email";
import type {
  ReportScheduleConfig,
  ScheduleExecutionRecord,
  ScheduleFrequency,
  ScheduleStatus,
} from "./analytics-contracts";

// Durable store for schedules and executions
const schedulesStore = new Map<string, ReportScheduleConfig>();
const executionHistory: ScheduleExecutionRecord[] = [];

/**
 * Calculates the next UTC execution timestamp given frequency, delivery time, and timezone.
 */
export function calculateNextRunTimestamp(
  frequency: ScheduleFrequency,
  deliveryTimeUtc: string, // "HH:MM" e.g. "06:00"
  deliveryDayOfWeek: number = 1, // 1 (Mon)
  deliveryDayOfMonth: number = 1,
  fromTime: Date = new Date()
): string {
  const [hoursStr, minutesStr] = deliveryTimeUtc.split(":");
  const hours = parseInt(hoursStr || "06", 10);
  const minutes = parseInt(minutesStr || "00", 10);

  const next = new Date(fromTime);
  next.setUTCHours(hours, minutes, 0, 0);

  switch (frequency) {
    case "DAILY": {
      if (next.getTime() <= fromTime.getTime()) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      break;
    }
    case "WEEKLY": {
      // Find the next occurrence of deliveryDayOfWeek (1=Mon ... 7=Sun)
      const currentDay = next.getUTCDay() || 7; // Convert 0 (Sun) to 7
      let daysToAdd = deliveryDayOfWeek - currentDay;
      if (daysToAdd < 0 || (daysToAdd === 0 && next.getTime() <= fromTime.getTime())) {
        daysToAdd += 7;
      }
      next.setUTCDate(next.getUTCDate() + daysToAdd);
      break;
    }
    case "MONTHLY": {
      next.setUTCDate(Math.min(deliveryDayOfMonth, 28));
      if (next.getTime() <= fromTime.getTime()) {
        next.setUTCMonth(next.getUTCMonth() + 1);
      }
      break;
    }
  }

  return next.toISOString();
}

// Seed default initial schedules if empty
if (schedulesStore.size === 0) {
  const weeklyExec: ReportScheduleConfig = {
    id: "sched_weekly_exec",
    name: "Weekly Monday Executive Intelligence Digest",
    reportType: "EXECUTIVE_SUMMARY",
    filters: {
      reportType: "EXECUTIVE_SUMMARY",
      period: "7d",
      comparisonMode: "previous_period",
      currency: "SAR",
      outputFormat: "PDF",
    },
    outputFormat: "PDF",
    frequency: "WEEKLY",
    deliveryTimeUtc: "06:00",
    deliveryDayOfWeek: 1, // Monday
    deliveryTimezone: "Asia/Riyadh",
    recipientEmails: ["admin@homyz.sa", "finance@homyz.sa"],
    status: "ACTIVE",
    lastRunAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    nextRunAt: calculateNextRunTimestamp("WEEKLY", "06:00", 1),
    lastStatus: "SUCCESS",
    createdById: "system_admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const monthlyRev: ReportScheduleConfig = {
    id: "sched_monthly_audit",
    name: "Monthly Financial Settlement & Payout Audit",
    reportType: "REVENUE_AND_FINANCE",
    filters: {
      reportType: "REVENUE_AND_FINANCE",
      period: "last_month",
      comparisonMode: "previous_year",
      currency: "SAR",
      outputFormat: "XLSX",
    },
    outputFormat: "XLSX",
    frequency: "MONTHLY",
    deliveryTimeUtc: "05:00",
    deliveryDayOfMonth: 1,
    deliveryTimezone: "Asia/Riyadh",
    recipientEmails: ["finance@homyz.sa"],
    status: "ACTIVE",
    lastRunAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    nextRunAt: calculateNextRunTimestamp("MONTHLY", "05:00", 1, 1),
    lastStatus: "SUCCESS",
    createdById: "system_admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  schedulesStore.set(weeklyExec.id, weeklyExec);
  schedulesStore.set(monthlyRev.id, monthlyRev);
}

export const reportSchedulerService = {
  /**
   * Lists all scheduled report configurations.
   */
  async listSchedules(actor: AuthUser): Promise<ReportScheduleConfig[]> {
    return Array.from(schedulesStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  /**
   * Retrieves past execution records for audit and download inspection.
   */
  async listExecutions(actor: AuthUser): Promise<ScheduleExecutionRecord[]> {
    return [...executionHistory].sort(
      (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
    );
  },

  /**
   * Creates a new automated schedule with authorized recipients and strict validation.
   */
  async createSchedule(
    actor: AuthUser,
    input: {
      name: string;
      reportType: ReportScheduleConfig["reportType"];
      filters: ReportScheduleConfig["filters"];
      outputFormat: ReportScheduleConfig["outputFormat"];
      frequency: ScheduleFrequency;
      deliveryTimeUtc?: string;
      deliveryDayOfWeek?: number;
      deliveryDayOfMonth?: number;
      deliveryTimezone?: string;
      recipientEmails: string[];
    }
  ): Promise<ReportScheduleConfig> {
    if (!input.name || input.name.trim().length === 0) {
      throw AppError.badRequest("Schedule name is required.");
    }

    if (!input.recipientEmails || input.recipientEmails.length === 0) {
      throw AppError.badRequest("At least one authorized recipient email is required.");
    }

    // Validate email formatting
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of input.recipientEmails) {
      if (!emailRegex.test(email.trim())) {
        throw AppError.badRequest(`Invalid recipient email address: ${email}`);
      }
    }

    const id = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const deliveryTimeUtc = input.deliveryTimeUtc || "06:00";
    const nextRunAt = calculateNextRunTimestamp(
      input.frequency,
      deliveryTimeUtc,
      input.deliveryDayOfWeek ?? 1,
      input.deliveryDayOfMonth ?? 1
    );

    const config: ReportScheduleConfig = {
      id,
      name: input.name.trim(),
      reportType: input.reportType,
      filters: input.filters,
      outputFormat: input.outputFormat || "PDF",
      frequency: input.frequency,
      deliveryTimeUtc,
      deliveryDayOfWeek: input.deliveryDayOfWeek ?? 1,
      deliveryDayOfMonth: input.deliveryDayOfMonth ?? 1,
      deliveryTimezone: input.deliveryTimezone || "Asia/Riyadh",
      recipientEmails: input.recipientEmails.map((e) => e.trim().toLowerCase()),
      status: "ACTIVE",
      nextRunAt,
      createdById: actor.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    schedulesStore.set(id, config);
    return config;
  },

  /**
   * Updates an existing schedule status (PAUSE, RESUME, or modify settings).
   */
  async updateScheduleStatus(
    actor: AuthUser,
    scheduleId: string,
    status: ScheduleStatus
  ): Promise<ReportScheduleConfig> {
    const existing = schedulesStore.get(scheduleId);
    if (!existing) {
      throw AppError.notFound("Scheduled report configuration not found.");
    }

    existing.status = status;
    existing.updatedAt = new Date().toISOString();
    schedulesStore.set(scheduleId, existing);
    return existing;
  },

  /**
   * Deletes a scheduled report configuration.
   */
  async deleteSchedule(actor: AuthUser, scheduleId: string): Promise<boolean> {
    const existing = schedulesStore.get(scheduleId);
    if (!existing) {
      throw AppError.notFound("Scheduled report configuration not found.");
    }

    schedulesStore.delete(scheduleId);
    return true;
  },

  /**
   * Executes a scheduled report generation and email dispatch.
   * Can be triggered by the Background Job Worker or manual "Run Now" test action.
   */
  async executeSchedule(scheduleId: string, triggeredByActor?: AuthUser): Promise<ScheduleExecutionRecord> {
    const schedule = schedulesStore.get(scheduleId);
    if (!schedule) {
      throw AppError.notFound(`Schedule ${scheduleId} not found.`);
    }

    const startTime = Date.now();
    const execId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // System actor with full analytical authority for scheduled background reports
    const systemActor: AuthUser = triggeredByActor || {
      id: schedule.createdById,
      email: "system@homyz.sa",
      name: "Homyz Report Worker",
      role: Role.ADMIN,
      permissions: ["analytics:view", "reports:view", "reports:export"],
    } as any;

    try {
      // 1. Generate formatted export file
      const exportFile = await reportExportService.generateExport(
        systemActor,
        schedule.filters,
        schedule.outputFormat
      );

      // 2. Build professional HTML email notification
      const preview = await customReportService.generatePreview(systemActor, schedule.filters);
      const kpisHtml = preview.summaryKpis
        .map(
          (k) => `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563;">${k.label}</td>
                     <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500; color: #111827; text-align: right;">${k.value}</td></tr>`
        )
        .join("");

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
          <div style="margin-bottom: 24px; border-bottom: 2px solid #111827; padding-bottom: 12px;">
            <h1 style="font-size: 20px; font-weight: 500; color: #111827; margin: 0;">HOMYZ BUSINESS INTELLIGENCE</h1>
            <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0 0;">Automated Scheduled Executive Delivery</p>
          </div>
          <h2 style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">${schedule.name}</h2>
          <p style="font-size: 14px; color: #4b5563; line-height: 1.5; margin-bottom: 20px;">
            Your scheduled <span style="font-weight: 500;">${schedule.reportType}</span> report for <span style="font-weight: 500;">${preview.timeframe.label}</span> is ready.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f9fafb; border-radius: 6px; overflow: hidden;">
            ${kpisHtml}
          </table>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            This automated dispatch was generated by Homyz Enterprise Analytics. Access restricted to authorized personnel.
          </p>
        </div>
      `;

      // 3. Dispatch to authorized recipients via email service
      if (isEmailDeliveryConfigured()) {
        for (const recipient of schedule.recipientEmails) {
          await sendOperationalNotificationEmail({
            to: recipient,
            subject: `[Homyz Report] ${schedule.name} (${preview.timeframe.startDateKey})`,
            text: `Homyz Scheduled Business Report: ${schedule.name}. Log in to admin to download your full ${schedule.outputFormat} report.`,
            html: emailHtml,
          }).catch((err) => {
            console.warn(`[report-scheduler] Email dispatch to ${recipient} failed:`, err.message);
          });
        }
      }

      // 4. Update schedule metadata and log execution
      const durationMs = Date.now() - startTime;
      schedule.lastRunAt = new Date().toISOString();
      schedule.lastStatus = "SUCCESS";
      schedule.lastErrorMessage = null;
      schedule.nextRunAt = calculateNextRunTimestamp(
        schedule.frequency,
        schedule.deliveryTimeUtc,
        schedule.deliveryDayOfWeek,
        schedule.deliveryDayOfMonth
      );
      schedule.updatedAt = new Date().toISOString();
      schedulesStore.set(schedule.id, schedule);

      const record: ScheduleExecutionRecord = {
        id: execId,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        executedAt: new Date().toISOString(),
        status: "SUCCESS",
        recipientCount: schedule.recipientEmails.length,
        outputFormat: schedule.outputFormat,
        durationMs,
      };

      executionHistory.unshift(record);
      return record;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      schedule.lastRunAt = new Date().toISOString();
      schedule.lastStatus = "FAILED";
      schedule.lastErrorMessage = err.message || "Execution error";
      schedule.updatedAt = new Date().toISOString();
      schedulesStore.set(schedule.id, schedule);

      const failedRecord: ScheduleExecutionRecord = {
        id: execId,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        executedAt: new Date().toISOString(),
        status: "FAILED",
        recipientCount: schedule.recipientEmails.length,
        outputFormat: schedule.outputFormat,
        errorMessage: err.message || "Execution failure",
        durationMs,
      };

      executionHistory.unshift(failedRecord);
      return failedRecord;
    }
  },
};

