"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminSectionHeader } from "@/components/admin/ui/admin-section-header";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import type { ReportType } from "@/services/analytics-admin.service";
import type {
  AlertInstance,
  AlertRuleConfig,
  CustomReportFilterConfig,
  EnterpriseReportType,
  HostCohortEntry,
  MarketplaceGrowthInsights,
  ReportExportFormat,
  ReportPreviewResult,
  ReportScheduleConfig,
  SavedReportConfig,
  ScheduleExecutionRecord,
} from "@/services/admin-analytics/analytics-contracts";

interface ReportsTabProps {
  initialStartDate?: string;
  initialEndDate?: string;
}

type SubSection = "builder" | "saved" | "schedules" | "alerts" | "cohorts" | "ledgers";

const REPORT_SCHEMAS: {
  id: ReportType;
  label: string;
  desc: string;
  badge: string;
}[] = [
  { id: "BOOKING_REPORT", label: "Bookings Ledger", desc: "Complete reservation audit with guest/host details, stay dates, and prices", badge: "Core Ledger" },
  { id: "PAYMENT_REPORT", label: "Payment Transactions", desc: "Gateway charges, provider transaction IDs, captured sums, and timestamps", badge: "Gateway Audits" },
  { id: "REFUND_REPORT", label: "Refunds Audit", desc: "Settled and processed refund claims cross-referenced with gateway reversals", badge: "Cash Outflow" },
  { id: "PAYOUT_REPORT", label: "Host Payouts", desc: "Host earnings, commission fee deductions, and net transfers", badge: "Settlements" },
  { id: "CANCELLATION_REPORT", label: "Cancellations Ledger", desc: "Cancelled stays, cancellation reasons, policies invoked, and guest refunds", badge: "Attrition" },
  { id: "DISPUTE_REPORT", label: "Disputes & Incidents", desc: "Mediation cases, complaint categories, decisions, and resolutions", badge: "Quality" },
  { id: "PROPERTY_REPORT", label: "Property Performance", desc: "Revenue generated, completion rate, and booked night density by listing", badge: "Inventory" },
  { id: "HOST_REPORT", label: "Host Portfolio", desc: "Listing inventory count, cumulative revenue, and payout totals by host", badge: "Partners" },
];

export function ReportsTab({ initialStartDate, initialEndDate }: ReportsTabProps) {
  const [activeSection, setActiveSection] = useState<SubSection>("builder");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Custom Report Builder State
  // ─────────────────────────────────────────────────────────────────────────────
  const [builderConfig, setBuilderConfig] = useState<CustomReportFilterConfig>({
    reportType: "EXECUTIVE_SUMMARY",
    period: "30d",
    comparisonMode: "previous_period",
    currency: "SAR",
    outputFormat: "XLSX",
  });
  const [previewResult, setPreviewResult] = useState<ReportPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<ReportExportFormat | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Saved Reports State
  // ─────────────────────────────────────────────────────────────────────────────
  const [savedReports, setSavedReports] = useState<SavedReportConfig[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Scheduled Automated Reports State
  // ─────────────────────────────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<ReportScheduleConfig[]>([]);
  const [executions, setExecutions] = useState<ScheduleExecutionRecord[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [createScheduleModalOpen, setCreateScheduleModalOpen] = useState(false);
  const [schedName, setSchedName] = useState("");
  const [schedFrequency, setSchedFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
  const [schedTime, setSchedTime] = useState("06:00");
  const [schedEmails, setSchedEmails] = useState("admin@homyz.sa");
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Alerts & Anomaly Monitor State
  // ─────────────────────────────────────────────────────────────────────────────
  const [alertRules, setAlertRules] = useState<AlertRuleConfig[]>([]);
  const [alertInstances, setAlertInstances] = useState<AlertInstance[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [evaluatingAlerts, setEvaluatingAlerts] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Cohort Analytics State
  // ─────────────────────────────────────────────────────────────────────────────
  const [cohortInsights, setCohortInsights] = useState<MarketplaceGrowthInsights | null>(null);
  const [cohortsLoading, setCohortsLoading] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Standard Raw Ledgers State (Preserved)
  // ─────────────────────────────────────────────────────────────────────────────
  const [ledgerType, setLedgerType] = useState<ReportType>("BOOKING_REPORT");
  const [ledgerData, setLedgerData] = useState<{ columns: string[]; rows: any[][] }>({ columns: [], rows: [] });
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerExporting, setLedgerExporting] = useState(false);
  const [startDate, setStartDate] = useState(initialStartDate || "");
  const [endDate, setEndDate] = useState(initialEndDate || "");
  const [currency, setCurrency] = useState("ALL");
  const [searchFilter, setSearchFilter] = useState("");

  // ─────────────────────────────────────────────────────────────────────────────
  // Data Fetch Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  // Fetch Preview for Custom Builder
  const handleGeneratePreview = useCallback(async (cfg: CustomReportFilterConfig) => {
    setPreviewLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("reportType", cfg.reportType);
      if (cfg.period) sp.set("period", cfg.period);
      if (cfg.startDate) sp.set("startDate", cfg.startDate);
      if (cfg.endDate) sp.set("endDate", cfg.endDate);
      if (cfg.comparisonMode) sp.set("comparisonMode", cfg.comparisonMode);
      if (cfg.city) sp.set("city", cfg.city);
      if (cfg.currency) sp.set("currency", cfg.currency);

      const res = await fetch(`/api/v1/admin/analytics/custom-reports?${sp.toString()}`);
      if (!res.ok) throw new Error("Failed to generate preview");
      const json = await res.json();
      setPreviewResult(json.data ?? json);
    } catch (e: any) {
      console.warn("Report preview error:", e.message);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // Fetch Saved Reports
  const fetchSavedReports = useCallback(async () => {
    setSavedLoading(true);
    try {
      const res = await fetch("/api/v1/admin/analytics/custom-reports?action=saved");
      if (res.ok) {
        const json = await res.json();
        setSavedReports(json.data?.savedReports || []);
      }
    } finally {
      setSavedLoading(false);
    }
  }, []);

  // Fetch Schedules
  const fetchSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    try {
      const res = await fetch("/api/v1/admin/analytics/schedules?history=true");
      if (res.ok) {
        const json = await res.json();
        setSchedules(json.data?.schedules || []);
        setExecutions(json.data?.executions || []);
      }
    } finally {
      setSchedulesLoading(false);
    }
  }, []);

  // Fetch Alerts
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await fetch("/api/v1/admin/analytics/alerts");
      if (res.ok) {
        const json = await res.json();
        setAlertRules(json.data?.rules || []);
        setAlertInstances(json.data?.alerts || []);
      }
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  // Fetch Cohorts
  const fetchCohorts = useCallback(async () => {
    setCohortsLoading(true);
    try {
      const res = await fetch("/api/v1/admin/analytics/cohorts");
      if (res.ok) {
        const json = await res.json();
        setCohortInsights(json.data ?? json);
      }
    } finally {
      setCohortsLoading(false);
    }
  }, []);

  // Fetch Raw Ledger
  const fetchRawLedger = useCallback(async (type: ReportType) => {
    setLedgerLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("type", type);
      sp.set("limit", "50");
      if (startDate) sp.set("startDate", startDate);
      if (endDate) sp.set("endDate", endDate);
      if (currency !== "ALL") sp.set("currency", currency);

      const res = await fetch(`/api/v1/admin/bookings/reports?${sp.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        setLedgerData({
          columns: Array.isArray(data.columns) ? data.columns : [],
          rows: Array.isArray(data.rows) ? data.rows : [],
        });
      }
    } finally {
      setLedgerLoading(false);
    }
  }, [startDate, endDate, currency]);

  // Initial load based on active section
  useEffect(() => {
    if (activeSection === "builder" && !previewResult) {
      handleGeneratePreview(builderConfig);
    } else if (activeSection === "saved") {
      fetchSavedReports();
    } else if (activeSection === "schedules") {
      fetchSchedules();
    } else if (activeSection === "alerts") {
      fetchAlerts();
    } else if (activeSection === "cohorts") {
      fetchCohorts();
    } else if (activeSection === "ledgers") {
      fetchRawLedger(ledgerType);
    }
  }, [activeSection, builderConfig, handleGeneratePreview, fetchSavedReports, fetchSchedules, fetchAlerts, fetchCohorts, fetchRawLedger, ledgerType, previewResult]);

  // Handle Export (CSV, XLSX, PDF)
  const handleDownloadExport = async (format: ReportExportFormat) => {
    setDownloadingFormat(format);
    try {
      const res = await fetch("/api/v1/admin/analytics/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          filters: builderConfig,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate export");

      const blob = await res.blob();
      const ext = format === "PDF" ? "pdf" : format === "XLSX" ? "xlsx" : "csv";
      const filename = `homyz_${builderConfig.reportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      alert(`Export error: ${e.message}`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  // Save current report configuration
  const handleSaveReportConfig = async () => {
    if (!saveName.trim()) return;
    try {
      const res = await fetch("/api/v1/admin/analytics/custom-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          name: saveName.trim(),
          description: saveDescription.trim(),
          reportType: builderConfig.reportType,
          filters: builderConfig,
          outputFormat: builderConfig.outputFormat || "XLSX",
        }),
      });

      if (!res.ok) throw new Error("Failed to save report configuration");
      setSaveModalOpen(false);
      setSaveName("");
      setSaveDescription("");
      setSaveSuccessMessage("Report configuration saved successfully.");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      fetchSavedReports();
    } catch (e: any) {
      alert(`Error saving report: ${e.message}`);
    }
  };

  // Schedule Run Now
  const handleRunScheduleNow = async (schedId: string) => {
    setRunningScheduleId(schedId);
    try {
      const res = await fetch("/api/v1/admin/analytics/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_now", scheduleId: schedId }),
      });
      if (!res.ok) throw new Error("Failed to run schedule");
      fetchSchedules();
    } catch (e: any) {
      alert(`Execution error: ${e.message}`);
    } finally {
      setRunningScheduleId(null);
    }
  };

  // Evaluate Alerts Now
  const handleEvaluateAlerts = async () => {
    setEvaluatingAlerts(true);
    try {
      const res = await fetch("/api/v1/admin/analytics/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate" }),
      });
      if (res.ok) {
        fetchAlerts();
      }
    } finally {
      setEvaluatingAlerts(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 font-sans">
      {/* 1. Header & Navigation Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <AdminSectionHeader
            title="Enterprise Analytics & Reports Center"
            subtitle="Custom report builder, scheduled delivery, operational alerts, and cohort retention"
            className="mb-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/bookings/reports"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-medium shadow-2xs transition-all"
          >
            <span>Full-Page Ledgers ↗</span>
          </Link>
        </div>
      </div>

      {/* Sub-navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-4">
        {[
          { id: "builder" as const, label: "Custom Report Builder" },
          { id: "saved" as const, label: `Saved Reports (${savedReports.length || 3})` },
          { id: "schedules" as const, label: "Scheduled Delivery" },
          { id: "alerts" as const, label: "Anomaly Alerts" },
          { id: "cohorts" as const, label: "Cohort & Growth Insights" },
          { id: "ledgers" as const, label: "Standard Raw Ledgers" },
        ].map((sub) => {
          const isActive = activeSection === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => setActiveSection(sub.id)}
              className={`rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-foreground text-background shadow-xs"
                  : "border border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground hover:bg-[var(--surface-secondary)]"
              }`}
            >
              {sub.label}
            </button>
          );
        })}
      </div>

      {saveSuccessMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          ✓ {saveSuccessMessage}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SUB-VIEW 1: CUSTOM REPORT BUILDER
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeSection === "builder" && (
        <div className="flex flex-col gap-6">
          {/* Builder Controls */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Configure Custom Dataset
                </span>
                <button
                  onClick={() => setSaveModalOpen(true)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
                >
                  Save Configuration
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Report Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Report Dataset</label>
                  <select
                    value={builderConfig.reportType}
                    onChange={(e) => {
                      const next = { ...builderConfig, reportType: e.target.value as EnterpriseReportType };
                      setBuilderConfig(next);
                      handleGeneratePreview(next);
                    }}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="EXECUTIVE_SUMMARY">Executive Business Summary</option>
                    <option value="REVENUE_AND_FINANCE">Revenue & Settlement Ledger</option>
                    <option value="OCCUPANCY">Occupancy & Room Nights</option>
                    <option value="OPERATIONAL_PERFORMANCE">Customer Operations & SLA</option>
                    <option value="BOOKINGS">Reservations Performance</option>
                    <option value="PAYMENTS">Gateway Payment Captures</option>
                    <option value="REFUNDS">Dispute & Guest Refunds</option>
                    <option value="PAYOUTS">Host Payout Obligations</option>
                  </select>
                </div>

                {/* Period Preset */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Reporting Window</label>
                  <select
                    value={builderConfig.period}
                    onChange={(e) => {
                      const next = { ...builderConfig, period: e.target.value as any };
                      setBuilderConfig(next);
                      handleGeneratePreview(next);
                    }}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="today">Today</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="this_month">Month to Date</option>
                    <option value="last_month">Last Month</option>
                    <option value="90d">Last 90 Days</option>
                    <option value="this_year">This Year</option>
                  </select>
                </div>

                {/* Comparison Mode */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Comparison Basis</label>
                  <select
                    value={builderConfig.comparisonMode}
                    onChange={(e) => {
                      const next = { ...builderConfig, comparisonMode: e.target.value as any };
                      setBuilderConfig(next);
                      handleGeneratePreview(next);
                    }}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="previous_period">Prior Period (Sequential)</option>
                    <option value="previous_year">Prior Year (Year-over-Year)</option>
                    <option value="none">No Comparison</option>
                  </select>
                </div>

                {/* Currency */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Currency</label>
                  <select
                    value={builderConfig.currency}
                    onChange={(e) => {
                      const next = { ...builderConfig, currency: e.target.value };
                      setBuilderConfig(next);
                      handleGeneratePreview(next);
                    }}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="SAR">SAR (Saudi Riyal)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                  </select>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
                <span className="text-xs text-muted-foreground">
                  {previewResult ? `Found ${previewResult.totalRecords} records in window` : "Generating preview..."}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    disabled={downloadingFormat !== null}
                    onClick={() => handleDownloadExport("CSV")}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-foreground transition-all disabled:opacity-50"
                  >
                    {downloadingFormat === "CSV" ? "Exporting..." : "Export CSV"}
                  </button>
                  <button
                    disabled={downloadingFormat !== null}
                    onClick={() => handleDownloadExport("XLSX")}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-2 text-xs font-medium text-foreground transition-all disabled:opacity-50"
                  >
                    {downloadingFormat === "XLSX" ? "Exporting..." : "Download Excel (.xlsx)"}
                  </button>
                  <button
                    disabled={downloadingFormat !== null}
                    onClick={() => handleDownloadExport("PDF")}
                    className="rounded-xl bg-foreground text-background hover:bg-foreground/90 px-4 py-2 text-xs font-medium shadow-xs transition-all disabled:opacity-50"
                  >
                    {downloadingFormat === "PDF" ? "Generating..." : "Generate Executive PDF"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Summary KPIs from Preview */}
          {previewResult && previewResult.summaryKpis.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {previewResult.summaryKpis.map((kpi) => (
                <div key={kpi.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                  <span className="text-xs text-muted-foreground font-normal">{kpi.label}</span>
                  <div className="text-base sm:text-lg font-medium text-foreground mt-1">{kpi.value}</div>
                  {kpi.delta && kpi.delta.percentageChange !== null && (
                    <span className={`text-[11px] font-medium mt-1 inline-block ${kpi.delta.isPositive ? "text-emerald-700" : "text-rose-700"}`}>
                      {kpi.delta.percentageChange > 0 ? "+" : ""}{kpi.delta.percentageChange}{kpi.delta.isPercentagePoint ? " pp" : "%"} vs baseline
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Preview Table */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                {previewResult?.title || "Report Data Preview"}
              </span>
              <span className="text-[11px] text-muted-foreground">Showing top 50 rows</span>
            </div>
            <div className="overflow-x-auto">
              {previewLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Generating preview dataset...</div>
              ) : previewResult && previewResult.previewRows.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-secondary)] text-muted-foreground border-b border-[var(--border)]">
                    <tr>
                      {previewResult.columns.map((col) => (
                        <th key={col.key} className={`px-4 py-3 font-medium ${col.align === "right" ? "text-right" : "text-left"}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] text-foreground">
                    {previewResult.previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                        {previewResult.columns.map((col) => (
                          <td key={col.key} className={`px-4 py-3 ${col.align === "right" ? "text-right font-medium" : "text-left"}`}>
                            {row[col.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">No records matching the selected configuration.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SUB-VIEW 2: SAVED REPORTS
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeSection === "saved" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {savedReports.map((saved) => (
            <div key={saved.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <AdminStatusBadge variant="info">{saved.outputFormat}</AdminStatusBadge>
                  <span className="text-[11px] text-muted-foreground">Owner: {saved.ownerName}</span>
                </div>
                <h4 className="text-sm font-medium text-foreground mb-1">{saved.name}</h4>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{saved.description || "Pre-configured analytics report."}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <span className="text-[11px] text-muted-foreground">Dataset: {saved.reportType}</span>
                <button
                  onClick={() => {
                    setBuilderConfig(saved.filters);
                    setActiveSection("builder");
                    handleGeneratePreview(saved.filters);
                  }}
                  className="rounded-lg bg-foreground text-background hover:bg-foreground/90 px-3 py-1.5 text-xs font-medium transition-all"
                >
                  Load & Run
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SUB-VIEW 3: SCHEDULED DELIVERY
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeSection === "schedules" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Automated Report Delivery Jobs
            </span>
            <button
              onClick={() => setCreateScheduleModalOpen(true)}
              className="rounded-xl bg-foreground text-background hover:bg-foreground/90 px-3.5 py-2 text-xs font-medium shadow-xs transition-all"
            >
              + Create Automated Schedule
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {schedules.map((sched) => (
              <div key={sched.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium">
                      {sched.frequency} ({sched.deliveryTimeUtc} UTC)
                    </span>
                    <AdminStatusBadge variant={sched.status === "ACTIVE" ? "success" : "neutral"}>
                      {sched.status}
                    </AdminStatusBadge>
                  </div>
                  <h4 className="text-sm font-medium text-foreground mb-1">{sched.name}</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Format: {sched.outputFormat} • Recipients: {sched.recipientEmails.join(", ")}
                  </p>
                  <div className="text-[11px] text-muted-foreground bg-[var(--surface-secondary)] rounded-lg p-2 mb-4" suppressHydrationWarning>
                    Next run: {new Date(sched.nextRunAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                  <span className="text-[11px] text-muted-foreground">Last Status: {sched.lastStatus || "Pending"}</span>
                  <button
                    disabled={runningScheduleId === sched.id}
                    onClick={() => handleRunScheduleNow(sched.id)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3 py-1.5 text-xs font-medium text-foreground transition-all disabled:opacity-50"
                  >
                    {runningScheduleId === sched.id ? "Running..." : "Run Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Executions Log */}
          {executions.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs font-medium text-foreground block mb-3">Recent Scheduled Deliveries</span>
              <div className="divide-y divide-[var(--border)] text-xs">
                {executions.slice(0, 5).map((exec) => (
                  <div key={exec.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-foreground">{exec.scheduleName}</span>
                      <span className="text-muted-foreground ml-2">({exec.outputFormat})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>{new Date(exec.executedAt).toLocaleTimeString()}</span>
                      <AdminStatusBadge variant={exec.status === "SUCCESS" ? "success" : "critical"}>
                        {exec.status}
                      </AdminStatusBadge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SUB-VIEW 4: OPERATIONAL ALERTS & ANOMALY MONITOR
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeSection === "alerts" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Explainable Anomaly Rules & Thresholds
              </span>
            </div>
            <button
              disabled={evaluatingAlerts}
              onClick={handleEvaluateAlerts}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-2 text-xs font-medium text-foreground shadow-2xs transition-all disabled:opacity-50"
            >
              {evaluatingAlerts ? "Evaluating Rules..." : "Run Anomaly Audit Now"}
            </button>
          </div>

          {/* Active Breaches */}
          {alertInstances.length > 0 ? (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium text-foreground">Active Operational Alerts</span>
              {alertInstances.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-2xl border p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    alert.severity === "CRITICAL"
                      ? "border-rose-200 bg-rose-50/50"
                      : "border-amber-200 bg-amber-50/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AdminStatusBadge variant={alert.severity === "CRITICAL" ? "critical" : "warning"}>
                        {alert.severity}
                      </AdminStatusBadge>
                      <span className="text-xs font-medium text-foreground">{alert.ruleName}</span>
                    </div>
                    <p className="text-xs text-foreground/80 mb-1">{alert.whatChanged}</p>
                    <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                      Source: {alert.dataSource} • Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        await fetch("/api/v1/admin/analytics/alerts", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ alertId: alert.id, status: "ACKNOWLEDGED" }),
                        });
                        fetchAlerts();
                      }}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3 py-1.5 text-xs font-medium text-foreground transition-all"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={async () => {
                        await fetch("/api/v1/admin/analytics/alerts", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ alertId: alert.id, status: "RESOLVED" }),
                        });
                        fetchAlerts();
                      }}
                      className="rounded-lg bg-foreground text-background hover:bg-foreground/90 px-3 py-1.5 text-xs font-medium transition-all"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-2xs">
              <span className="text-sm font-medium text-foreground block mb-1">All Operational Metrics Healthy</span>
              <p className="text-xs text-muted-foreground">Zero threshold breaches detected across revenue, refunds, occupancy, and SLA queues.</p>
            </div>
          )}

          {/* Configured Rules */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
            <span className="text-xs font-medium text-foreground block mb-3">Active Monitoring Rules</span>
            <div className="divide-y divide-[var(--border)] text-xs">
              {alertRules.map((rule) => (
                <div key={rule.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-foreground">{rule.name}</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Window: {rule.evaluationWindow} • Threshold: {rule.thresholdValue} • Basis: {rule.comparisonBasis}
                    </p>
                  </div>
                  <AdminStatusBadge variant="info">Cooldown: {rule.cooldownHours}h</AdminStatusBadge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SUB-VIEW 5: COHORT & GROWTH ANALYTICS
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeSection === "cohorts" && (
        <div className="flex flex-col gap-6">
          {cohortsLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Calculating marketplace cohorts...</div>
          ) : cohortInsights ? (
            <>
              {/* Funnel Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                  <span className="text-xs text-muted-foreground font-normal">Registered Hosts</span>
                  <div className="text-base sm:text-lg font-medium text-foreground mt-1">
                    {cohortInsights.listingPublicationFunnel.registeredHosts}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                  <span className="text-xs text-muted-foreground font-normal">Created Listing Draft</span>
                  <div className="text-base sm:text-lg font-medium text-foreground mt-1">
                    {cohortInsights.listingPublicationFunnel.createdListingDraft}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                  <span className="text-xs text-muted-foreground font-normal">Published Active Listings</span>
                  <div className="text-base sm:text-lg font-medium text-foreground mt-1">
                    {cohortInsights.listingPublicationFunnel.publishedListings}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                  <span className="text-xs text-muted-foreground font-normal">Achieved First Booking</span>
                  <div className="text-base sm:text-lg font-medium text-foreground mt-1">
                    {cohortInsights.listingPublicationFunnel.bookedListings}
                  </div>
                </div>
              </div>

              {/* Host Retention Cohorts Table */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
                <div className="px-5 py-4 border-b border-[var(--border)]">
                  <span className="text-xs font-medium text-foreground">Host Cohort Retention Matrix (Active Economics Basis)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--surface-secondary)] text-muted-foreground border-b border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-3 font-medium">Cohort Month</th>
                        <th className="px-4 py-3 font-medium text-right">New Hosts</th>
                        <th className="px-4 py-3 font-medium text-right">1st Listing</th>
                        <th className="px-4 py-3 font-medium text-right">1st Booking</th>
                        <th className="px-4 py-3 font-medium text-right">30d Retention</th>
                        <th className="px-4 py-3 font-medium text-right">60d Retention</th>
                        <th className="px-4 py-3 font-medium text-right">90d Retention</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-foreground">
                      {cohortInsights.hostCohorts.map((c) => (
                        <tr key={c.cohortMonth} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                          <td className="px-4 py-3 font-medium">{c.cohortMonth}</td>
                          <td className="px-4 py-3 text-right">{c.totalHostsRegistered}</td>
                          <td className="px-4 py-3 text-right">{c.publishedFirstListing}</td>
                          <td className="px-4 py-3 text-right">{c.firstBookingReceived}</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-700">{c.retentionRate30d}%</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-700">{c.retentionRate60d}%</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-700">{c.retentionRate90d}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Guest Repeat Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                  <span className="text-xs text-muted-foreground font-normal">Guest Repeat Rate</span>
                  <div className="text-lg font-medium text-foreground mt-1">
                    {cohortInsights.guestRetention.repeatRatePercentage}%
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    {cohortInsights.guestRetention.repeatGuests} repeat guests of {cohortInsights.guestRetention.totalUniqueGuests} total
                  </span>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                  <span className="text-xs text-muted-foreground font-normal">2nd Booking Conversion</span>
                  <div className="text-lg font-medium text-foreground mt-1">
                    {cohortInsights.guestRetention.secondBookingConversionRate}%
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1 block">Guests making a subsequent reservation</span>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
                  <span className="text-xs text-muted-foreground font-normal">Average Bookings / Guest</span>
                  <div className="text-lg font-medium text-foreground mt-1">
                    {cohortInsights.guestRetention.averageBookingsPerGuest}
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1 block">Lifetime reservation frequency</span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground">Cohort data unavailable.</div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SUB-VIEW 6: STANDARD RAW LEDGERS (Preserved)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeSection === "ledgers" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {REPORT_SCHEMAS.map((schema) => (
              <button
                key={schema.id}
                onClick={() => {
                  setLedgerType(schema.id);
                  fetchRawLedger(schema.id);
                }}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  ledgerType === schema.id
                    ? "border-foreground bg-[var(--surface-secondary)] shadow-xs"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <AdminStatusBadge variant="neutral">{schema.badge}</AdminStatusBadge>
                </div>
                <span className="text-xs font-medium text-foreground block">{schema.label}</span>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{schema.desc}</p>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-foreground">
              {REPORT_SCHEMAS.find((s) => s.id === ledgerType)?.label} Preview ({ledgerData.rows.length} rows)
            </span>
            <button
              onClick={async () => {
                setLedgerExporting(true);
                try {
                  const res = await fetch("/api/v1/admin/bookings/reports/export", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reportType: ledgerType }),
                  });
                  if (!res.ok) throw new Error("Failed to export ledger");
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `homyz_${ledgerType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } finally {
                  setLedgerExporting(false);
                }
              }}
              className="rounded-xl bg-foreground text-background hover:bg-foreground/90 px-3.5 py-1.5 text-xs font-medium transition-all"
            >
              {ledgerExporting ? "Streaming CSV..." : "Stream CSV Export"}
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              {ledgerLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading ledger records...</div>
              ) : ledgerData.rows.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-secondary)] text-muted-foreground border-b border-[var(--border)]">
                    <tr>
                      {ledgerData.columns.map((col, idx) => (
                        <th key={idx} className="px-4 py-3 font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] text-foreground">
                    {ledgerData.rows.slice(0, 25).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-4 py-3">
                            {String(cell ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">No ledger records found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: SAVE REPORT CONFIGURATION
      ───────────────────────────────────────────────────────────────────────────── */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="text-base font-medium text-foreground mb-1">Save Report Configuration</h3>
            <p className="text-xs text-muted-foreground mb-4">Save these exact filter parameters for quick reuse and scheduled delivery.</p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Configuration Name</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Weekly Riyadh Performance Digest"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Description (Optional)</label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="Notes for finance or executive leadership..."
                  rows={2}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReportConfig}
                className="rounded-xl bg-foreground text-background hover:bg-foreground/90 px-4 py-2 text-xs font-medium transition-all"
              >
                Save Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: CREATE AUTOMATED SCHEDULE
      ───────────────────────────────────────────────────────────────────────────── */}
      {createScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <h3 className="text-base font-medium text-foreground mb-1">Create Automated Delivery Schedule</h3>
            <p className="text-xs text-muted-foreground mb-4">Automatically generate and email this report independently of browser sessions.</p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Schedule Name</label>
                <input
                  type="text"
                  value={schedName}
                  onChange={(e) => setSchedName(e.target.value)}
                  placeholder="e.g. Monday Morning Executive Digest"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Frequency</label>
                  <select
                    value={schedFrequency}
                    onChange={(e) => setSchedFrequency(e.target.value as any)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly (Monday)</option>
                    <option value="MONTHLY">Monthly (1st Day)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Time (UTC)</label>
                  <input
                    type="text"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    placeholder="06:00"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Authorized Recipient Emails</label>
                <input
                  type="text"
                  value={schedEmails}
                  onChange={(e) => setSchedEmails(e.target.value)}
                  placeholder="finance@homyz.sa, admin@homyz.sa"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setCreateScheduleModalOpen(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!schedName.trim()) return;
                  await fetch("/api/v1/admin/analytics/schedules", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: schedName.trim(),
                      reportType: builderConfig.reportType,
                      filters: builderConfig,
                      outputFormat: builderConfig.outputFormat || "PDF",
                      frequency: schedFrequency,
                      deliveryTimeUtc: schedTime,
                      recipientEmails: schedEmails.split(",").map((s) => s.trim()).filter(Boolean),
                    }),
                  });
                  setCreateScheduleModalOpen(false);
                  fetchSchedules();
                }}
                className="rounded-xl bg-foreground text-background hover:bg-foreground/90 px-4 py-2 text-xs font-medium transition-all"
              >
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
