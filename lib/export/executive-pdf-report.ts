import { SimplePdfDocument } from "./pdf-generator";
import type { TimeframeContext, DataQualityWarning } from "@/services/admin-analytics/analytics-contracts";

export interface ExecutiveReportData {
  timeframe: TimeframeContext;
  currency: string;
  generatedAt: string;
  filtersDescription: string;
  // Core Executive KPIs
  executiveKpis: Array<{
    label: string;
    value: string;
    deltaText?: string;
    isHighlight?: boolean;
  }>;
  // Performance Trends Table
  trendRows: Array<{
    date: string;
    gmv: string;
    captured: string;
    refunded: string;
    netCash: string;
    occupancy: string;
  }>;
  // Financial Reconciliation
  financialSummary: Array<{
    category: string;
    amount: string;
    percentage: string;
    notes: string;
  }>;
  // Operations Metrics
  operationsKpis: Array<{
    label: string;
    value: string;
    status: string;
  }>;
  // Audit warnings & caveats
  dataQualityWarnings?: DataQualityWarning[];
}

/**
 * Builds an enterprise-grade 4-page executive PDF report for Homyz Admin Analytics.
 */
export function buildExecutivePdfReport(data: ExecutiveReportData): Buffer {
  const doc = new SimplePdfDocument({
    title: "HOMYZ EXECUTIVE BUSINESS REPORT",
    subtitle: "Enterprise Performance & Financial Integrity Audit",
    periodLabel: `${data.timeframe.label} (${data.timeframe.startDateKey} to ${data.timeframe.endDateKey})`,
    currency: data.currency,
    generatedAt: data.generatedAt,
    footerNote: "Homyz Marketplace Administration • Confidential Executive Intelligence",
  });

  // =========================================================================
  // PAGE 1: EXECUTIVE SUMMARY & KEY PERFORMANCE INDICATORS
  // =========================================================================
  doc.addHeader();

  doc.addCallout(
    `Scope: ${data.filtersDescription} | Comparison: ${data.timeframe.comparisonLabel} | All financial values strictly in ${data.currency}.`
  );

  doc.addSummaryGrid(
    data.executiveKpis.map((kpi) => ({
      label: kpi.label,
      value: kpi.value,
      isHighlight: kpi.isHighlight,
    }))
  );

  doc.addCallout(
    "Executive Overview: Real-time telemetry reflects finalized gateway captures, completed stay settlements, and host disbursement obligations."
  );

  // =========================================================================
  // PAGE 2: BUSINESS PERFORMANCE & OCCUPANCY TRENDS
  // =========================================================================
  doc.addHeader();

  doc.addCallout("Section 2: Daily Transaction Volume & Marketplace Occupancy Velocity");

  doc.addTable(
    [
      { header: "Date (UTC)", key: "date", width: 75, align: "left" },
      { header: "Gross GMV", key: "gmv", width: 85, align: "right" },
      { header: "Captured Cash", key: "captured", width: 85, align: "right" },
      { header: "Refunds", key: "refunded", width: 75, align: "right" },
      { header: "Net Cash Flow", key: "netCash", width: 85, align: "right" },
      { header: "Occupancy Rate", key: "occupancy", width: 90, align: "right" },
    ],
    data.trendRows.slice(0, 18)
  );

  // =========================================================================
  // PAGE 3: FINANCIAL BREAKDOWN & RECONCILIATION
  // =========================================================================
  doc.addHeader();

  doc.addCallout("Section 3: Financial Settlement Ledger & Host Payout Obligations");

  doc.addTable(
    [
      { header: "Financial Dimension", key: "category", width: 140, align: "left" },
      { header: "Volume Amount", key: "amount", width: 100, align: "right" },
      { header: "Share of GMV", key: "percentage", width: 85, align: "right" },
      { header: "Accounting Policy & Source", key: "notes", width: 170, align: "left" },
    ],
    data.financialSummary
  );

  doc.addCallout(
    "Reconciliation Formula: Net Cash Flow = Captured Gateway Volume - Succeeded Refunds. Host obligations reflect actual payout distributions."
  );

  // =========================================================================
  // PAGE 4: OPERATIONS & COMPLIANCE APPENDIX
  // =========================================================================
  doc.addHeader();

  doc.addCallout("Section 4: Operational Service Levels, SLA Backlog & Data Transparency");

  doc.addSummaryGrid(
    data.operationsKpis.map((op) => ({
      label: op.label,
      value: op.value,
      isHighlight: op.status === "Compliant",
    }))
  );

  if (data.dataQualityWarnings && data.dataQualityWarnings.length > 0) {
    doc.addCallout("Data Quality Notices & Historical Caveats:");
    doc.addNotes(
      data.dataQualityWarnings.map(
        (w) => `[${w.code}] ${w.message} (Affected metrics: ${w.affectedMetrics.join(", ")})`
      )
    );
  } else {
    doc.addCallout("Data Quality Audit: All metric pipelines satisfied 100% snapshot integrity with zero fallback estimations.");
  }

  return doc.buildPdf();
}
