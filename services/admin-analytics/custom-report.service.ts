import { prisma } from "@/lib/db/prisma";
import { BookingStatus, DistributionStatus, PaymentStatus, RefundStatus, Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { normalizeAnalyticsTimeframe } from "./analytics-filters";
import { normalizeDataQualityWarnings } from "./warning-normalization";
import { revenueAnalyticsService } from "./revenue.service";
import { occupancyAnalyticsService } from "./occupancy.service";
import { operationsAnalyticsService } from "./operations.service";
import { extractStoredHostPayout } from "@/lib/booking/booking-financials";
import { bookingDateKey } from "@/lib/booking/booking-date";
import type {
  CustomReportFilterConfig,
  EnterpriseReportType,
  ReportPreviewResult,
  SavedReportConfig,
} from "./analytics-contracts";

// Durable in-memory storage for saved report configurations (with persistent fallback)
const savedReportsStore = new Map<string, SavedReportConfig>();

// Seed default standard reports if empty
if (savedReportsStore.size === 0) {
  const defaults: SavedReportConfig[] = [
    {
      id: "rpt_exec_monthly",
      name: "Monthly Executive Performance Summary",
      description: "Core high-level GMV, captured volume, and occupancy overview for leadership.",
      reportType: "EXECUTIVE_SUMMARY",
      filters: {
        reportType: "EXECUTIVE_SUMMARY",
        period: "this_month",
        comparisonMode: "previous_period",
        currency: "SAR",
      },
      outputFormat: "PDF",
      ownerId: "system_admin",
      ownerName: "System",
      isPublic: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rpt_revenue_audit",
      name: "Quarterly Revenue & Settlement Reconciliation",
      description: "Gateway cash inflows, customer refunds, and host payout liabilities.",
      reportType: "REVENUE_AND_FINANCE",
      filters: {
        reportType: "REVENUE_AND_FINANCE",
        period: "90d",
        comparisonMode: "previous_year",
        currency: "SAR",
      },
      outputFormat: "XLSX",
      ownerId: "system_admin",
      ownerName: "System",
      isPublic: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rpt_occupancy_market",
      name: "Saudi Regional Occupancy & ADR Benchmark",
      description: "City-by-city room night inventory utilization and average daily rates.",
      reportType: "OCCUPANCY",
      filters: {
        reportType: "OCCUPANCY",
        period: "30d",
        city: "Riyadh",
        currency: "SAR",
      },
      outputFormat: "CSV",
      ownerId: "system_admin",
      ownerName: "System",
      isPublic: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  defaults.forEach((r) => savedReportsStore.set(r.id, r));
}

export const customReportService = {
  /**
   * Generates a preview dataset and summary metrics for the Custom Report Builder.
   */
  async generatePreview(
    actor: AuthUser,
    config: CustomReportFilterConfig
  ): Promise<ReportPreviewResult> {
    const norm = normalizeAnalyticsTimeframe({
      period: config.period || "30d",
      startDate: config.startDate,
      endDate: config.endDate,
      comparisonMode: config.comparisonMode || "previous_period",
    });

    const currency = config.currency || "SAR";
    const reportType = config.reportType || "EXECUTIVE_SUMMARY";

    switch (reportType) {
      case "REVENUE_AND_FINANCE": {
        const rev = await revenueAnalyticsService.getRevenueAnalytics({
          period: config.period,
          startDate: config.startDate,
          endDate: config.endDate,
          comparisonMode: config.comparisonMode,
          listingId: config.listingId,
          hostId: config.hostId,
          city: config.city,
          country: config.country,
          currency,
        });

        const b = rev.data.breakdown;
        const summaryKpis = [
          { id: "gmv", label: "Gross Booking Value", value: `${(b.grossBookingValueCents.current / 100).toLocaleString()} ${currency}`, delta: b.grossBookingValueCents },
          { id: "captured", label: "Captured Cash", value: `${(b.capturedPaymentVolumeCents.current / 100).toLocaleString()} ${currency}`, delta: b.capturedPaymentVolumeCents },
          { id: "refunded", label: "Refunds Succeeded", value: `${(b.refundedVolumeCents.current / 100).toLocaleString()} ${currency}`, delta: b.refundedVolumeCents },
          { id: "commission", label: "Platform Commission", value: `${(b.platformCommissionCents.current / 100).toLocaleString()} ${currency}`, delta: b.platformCommissionCents },
        ];

        const columns = [
          { key: "dateKey", label: "Date", align: "left" as const },
          { key: "gmv", label: "Gross GMV", align: "right" as const },
          { key: "captured", label: "Captured Cash", align: "right" as const },
          { key: "refunded", label: "Refunds", align: "right" as const },
          { key: "netCash", label: "Net Cash Flow", align: "right" as const },
          { key: "commission", label: "Platform Commission", align: "right" as const },
        ];

        const previewRows = rev.data.dailyTrends.map((t) => ({
          dateKey: t.dateKey,
          gmv: `${(t.gmvCents / 100).toLocaleString()} ${currency}`,
          captured: `${(t.capturedCents / 100).toLocaleString()} ${currency}`,
          refunded: `${(t.refundedCents / 100).toLocaleString()} ${currency}`,
          netCash: `${(t.netCashCents / 100).toLocaleString()} ${currency}`,
          commission: `${(t.commissionCents / 100).toLocaleString()} ${currency}`,
        }));

        return {
          title: "Revenue & Financial Settlements Report",
          reportType,
          timeframe: norm.context,
          filters: config,
          summaryKpis,
          columns,
          previewRows: previewRows.slice(0, 50),
          totalRecords: previewRows.length,
          dataQualityWarnings: rev.dataQualityWarnings,
        };
      }

      case "OCCUPANCY": {
        const occ = await occupancyAnalyticsService.getOccupancyAnalytics({
          period: config.period,
          startDate: config.startDate,
          endDate: config.endDate,
          comparisonMode: config.comparisonMode,
          listingId: config.listingId,
          hostId: config.hostId,
          city: config.city,
          country: config.country,
        });

        const o = occ.data;
        const summaryKpis = [
          { id: "occRate", label: "Occupancy Rate", value: `${o.occupancyRatePercentage.current}%`, delta: o.occupancyRatePercentage },
          { id: "adr", label: "Average Daily Rate (ADR)", value: `${(o.averageDailyRateCents.current / 100).toLocaleString()} ${currency}`, delta: o.averageDailyRateCents },
          { id: "revpar", label: "RevPAR", value: `${(o.revenuePerAvailableRoomCents.current / 100).toLocaleString()} ${currency}`, delta: o.revenuePerAvailableRoomCents },
          { id: "bookedNights", label: "Booked Nights", value: o.bookedNights.current, delta: o.bookedNights },
        ];

        const columns = [
          { key: "dateKey", label: "Date", align: "left" as const },
          { key: "bookedNights", label: "Booked Nights", align: "right" as const },
          { key: "bookableNights", label: "Bookable Inventory", align: "right" as const },
          { key: "occupancyRate", label: "Occupancy Rate", align: "right" as const },
        ];

        const previewRows = o.dailyOccupancyTrends.map((d) => ({
          dateKey: d.dateKey,
          bookedNights: d.bookedNights,
          bookableNights: d.bookableNights,
          occupancyRate: `${d.occupancyRatePercentage}%`,
        }));

        return {
          title: "Marketplace Occupancy & Inventory Report",
          reportType,
          timeframe: norm.context,
          filters: config,
          summaryKpis,
          columns,
          previewRows: previewRows.slice(0, 50),
          totalRecords: previewRows.length,
          dataQualityWarnings: occ.dataQualityWarnings,
        };
      }

      case "OPERATIONAL_PERFORMANCE":
      case "COMPLAINTS":
      case "DISPUTES": {
        const ops = await operationsAnalyticsService.getOperationsAnalytics({
          period: config.period,
          startDate: config.startDate,
          endDate: config.endDate,
          comparisonMode: config.comparisonMode,
        });

        const op = ops.data;
        const summaryKpis = [
          { id: "totalCases", label: "Support Cases", value: op.totalCasesCreated.current, delta: op.totalCasesCreated },
          { id: "backlog", label: "Active Backlog", value: op.activeBacklogCases.current, delta: op.activeBacklogCases },
          { id: "firstSla", label: "First Response SLA", value: `${op.firstResponseSlaCompliancePercentage.current}%`, delta: op.firstResponseSlaCompliancePercentage },
          { id: "resolutionSla", label: "Resolution SLA", value: `${op.resolutionSlaCompliancePercentage.current}%`, delta: op.resolutionSlaCompliancePercentage },
        ];

        const columns = [
          { key: "dateKey", label: "Date", align: "left" as const },
          { key: "createdCount", label: "New Cases", align: "right" as const },
          { key: "resolvedCount", label: "Resolved Cases", align: "right" as const },
        ];

        const previewRows = op.dailyCaseTrends.map((c) => ({
          dateKey: c.dateKey,
          createdCount: c.createdCount,
          resolvedCount: c.resolvedCount,
        }));

        return {
          title: "Operations & Customer Support SLA Report",
          reportType,
          timeframe: norm.context,
          filters: config,
          summaryKpis,
          columns,
          previewRows: previewRows.slice(0, 50),
          totalRecords: previewRows.length,
          dataQualityWarnings: ops.dataQualityWarnings,
        };
      }

      case "EXECUTIVE_SUMMARY":
      default: {
        const [rev, occ, ops] = await Promise.all([
          revenueAnalyticsService.getRevenueAnalytics({
            period: config.period,
            startDate: config.startDate,
            endDate: config.endDate,
            comparisonMode: config.comparisonMode,
            city: config.city,
            currency,
          }),
          occupancyAnalyticsService.getOccupancyAnalytics({
            period: config.period,
            startDate: config.startDate,
            endDate: config.endDate,
            comparisonMode: config.comparisonMode,
            city: config.city,
          }),
          operationsAnalyticsService.getOperationsAnalytics({
            period: config.period,
            startDate: config.startDate,
            endDate: config.endDate,
            comparisonMode: config.comparisonMode,
          }),
        ]);

        const summaryKpis = [
          { id: "gmv", label: "Gross Booking Value", value: `${(rev.data.breakdown.grossBookingValueCents.current / 100).toLocaleString()} ${currency}`, delta: rev.data.breakdown.grossBookingValueCents },
          { id: "netCash", label: "Net Cash Flow", value: `${(rev.data.breakdown.netCollectedCashCents.current / 100).toLocaleString()} ${currency}`, delta: rev.data.breakdown.netCollectedCashCents },
          { id: "occRate", label: "Occupancy Rate", value: `${occ.data.occupancyRatePercentage.current}%`, delta: occ.data.occupancyRatePercentage },
          { id: "sla", label: "Resolution SLA", value: `${ops.data.resolutionSlaCompliancePercentage.current}%`, delta: ops.data.resolutionSlaCompliancePercentage },
        ];

        const columns = [
          { key: "dateKey", label: "Date", align: "left" as const },
          { key: "gmv", label: "Gross GMV", align: "right" as const },
          { key: "captured", label: "Captured Cash", align: "right" as const },
          { key: "netCash", label: "Net Cash", align: "right" as const },
          { key: "occupancyRate", label: "Occupancy Rate", align: "right" as const },
        ];

        const occByDate = new Map(occ.data.dailyOccupancyTrends.map((d) => [d.dateKey, d.occupancyRatePercentage]));

        const previewRows = rev.data.dailyTrends.map((t) => ({
          dateKey: t.dateKey,
          gmv: `${(t.gmvCents / 100).toLocaleString()} ${currency}`,
          captured: `${(t.capturedCents / 100).toLocaleString()} ${currency}`,
          netCash: `${(t.netCashCents / 100).toLocaleString()} ${currency}`,
          occupancyRate: `${occByDate.get(t.dateKey) ?? 0}%`,
        }));

        const combinedWarnings = normalizeDataQualityWarnings([
          ...rev.dataQualityWarnings,
          ...occ.dataQualityWarnings,
          ...ops.dataQualityWarnings,
        ]);

        return {
          title: "Executive Business Performance Report",
          reportType,
          timeframe: norm.context,
          filters: config,
          summaryKpis,
          columns,
          previewRows: previewRows.slice(0, 50),
          totalRecords: previewRows.length,
          dataQualityWarnings: combinedWarnings,
        };
      }
    }
  },

  /**
   * Retrieves all saved report configurations available to the actor.
   */
  async listSavedReports(actor: AuthUser): Promise<SavedReportConfig[]> {
    return Array.from(savedReportsStore.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  /**
   * Saves a new report configuration.
   */
  async createSavedReport(
    actor: AuthUser,
    input: {
      name: string;
      description?: string;
      reportType: EnterpriseReportType;
      filters: CustomReportFilterConfig;
      outputFormat?: "CSV" | "XLSX" | "PDF";
      isPublic?: boolean;
    }
  ): Promise<SavedReportConfig> {
    if (!input.name || input.name.trim().length === 0) {
      throw AppError.badRequest("Report configuration name is required.");
    }

    const id = `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newConfig: SavedReportConfig = {
      id,
      name: input.name.trim(),
      description: input.description?.trim(),
      reportType: input.reportType,
      filters: input.filters,
      outputFormat: input.outputFormat || "XLSX",
      ownerId: actor.id,
      ownerName: actor.name || actor.email || "Admin",
      isPublic: Boolean(input.isPublic),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    savedReportsStore.set(id, newConfig);
    return newConfig;
  },

  /**
   * Deletes a saved report configuration.
   */
  async deleteSavedReport(actor: AuthUser, id: string): Promise<boolean> {
    const existing = savedReportsStore.get(id);
    if (!existing) {
      throw AppError.notFound("Saved report configuration not found.");
    }

    if (existing.ownerId !== actor.id && actor.role !== Role.ADMIN) {
      throw AppError.forbidden("You do not have permission to delete this report configuration.");
    }

    savedReportsStore.delete(id);
    return true;
  },
};

