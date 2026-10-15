"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { ReportType } from "@/services/analytics-admin.service";

const REPORT_TYPES: { id: ReportType; label: string; desc: string; icon: string }[] = [
  { id: "BOOKING_REPORT", label: "Bookings Report", desc: "All reservations, guest/host info, and prices", icon: "📋" },
  { id: "CANCELLATION_REPORT", label: "Cancellations Report", desc: "Cancelled stays, policies, and recorded reasons", icon: "🚫" },
  { id: "PAYMENT_REPORT", label: "Payment Transactions", desc: "Gateway charges, provider IDs, and captured sums", icon: "💳" },
  { id: "REFUND_REPORT", label: "Refunds Report", desc: "Approved, processing, and settled refund claims", icon: "💸" },
  { id: "PAYOUT_REPORT", label: "Host Payouts Report", desc: "Host earnings, platform fees, and net settlements", icon: "🏦" },
  { id: "DISPUTE_REPORT", label: "Disputes & Incidents", desc: "Mediation cases, complaint categories, and decisions", icon: "⚖️" },
  { id: "PROPERTY_REPORT", label: "Property Performance", desc: "Revenue, completion, and bookings by property", icon: "🏠" },
  { id: "HOST_REPORT", label: "Host Performance", desc: "Listings portfolio, bookings, and payout totals", icon: "👤" },
];

interface AdminReportsClientProps {
  initialReportType: ReportType;
  initialReport: {
    reportType: ReportType;
    columns: string[];
    rows: any[][];
  };
}

export function AdminReportsClient({
  initialReportType,
  initialReport,
}: AdminReportsClientProps) {
  const [reportType, setReportType] = useState<ReportType>(initialReportType || "BOOKING_REPORT");
  const [reportData, setReportData] = useState<any>(initialReport);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currency, setCurrency] = useState("ALL");

  const fetchReport = useCallback(
    async (type: ReportType) => {
      setLoading(true);
      setExportError(null);
      try {
        const sp = new URLSearchParams();
        sp.set("type", type);
        sp.set("limit", "50");
        if (startDate) sp.set("startDate", startDate);
        if (endDate) sp.set("endDate", endDate);
        if (currency !== "ALL") sp.set("currency", currency);

        const res = await fetch(`/api/v1/admin/bookings/reports?${sp.toString()}`);
        const json = await res.json();
        const data = json.data ?? json;
        setReportData(data);
      } catch (err) {
        console.error("[AdminReportsClient] Fetch report error:", err);
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, currency],
  );

  const handleSelectReport = (type: ReportType) => {
    setReportType(type);
    fetchReport(type);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/v1/admin/bookings/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          currency: currency !== "ALL" ? currency : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate CSV export");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `homyz_${reportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setExportError(err.message || "Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/bookings"
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              ← Bookings Hub
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-xs text-[#727272]">Reports</span>
          </div>
          <h1 className="mt-1">
            Financial & Operational Reports
          </h1>
          <p className="text-xs text-[#727272] mt-0.5">
            Generate, filter, and securely export booking, financial, and incident audit datasets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/bookings/analytics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Analytics Dashboard</span>
          </Link>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{exporting ? "Generating CSV..." : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs rounded-xl">
          {exportError}
        </div>
      )}

      {/* 8 Report Type Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {REPORT_TYPES.map((rt) => {
          const isSelected = reportType === rt.id;
          return (
            <button
              key={rt.id}
              type="button"
              onClick={() => handleSelectReport(rt.id)}
              className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/30"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{rt.icon}</span>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">{rt.label}</h4>
                <p className="text-3xs text-[var(--muted-foreground)] mt-0.5 line-clamp-1">{rt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-3xs uppercase font-semibold text-[var(--muted-foreground)]">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-3xs uppercase font-semibold text-[var(--muted-foreground)]">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-3xs uppercase font-semibold text-[var(--muted-foreground)]">Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground"
            >
              <option value="ALL">All Currencies</option>
              <option value="SAR">SAR</option>
              <option value="USD">USD</option>
              <option value="AED">AED</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchReport(reportType)}
          className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-xs font-semibold text-foreground transition-all"
        >
          Apply Filters
        </button>
      </div>

      {/* Data Preview Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface-secondary)]/30">
          <div>
            <h3 className="text-xs font-bold text-foreground">
              Preview: {REPORT_TYPES.find((r) => r.id === reportType)?.label}
            </h3>
            <span className="text-3xs text-[var(--muted-foreground)]">
              Displaying first {reportData.rows?.length || 0} matching records
            </span>
          </div>
          <span className="text-3xs font-mono text-[var(--muted-foreground)]">
            Export format: RFC 4180 CSV
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[var(--muted-foreground)] font-semibold uppercase text-3xs tracking-wider">
                {reportData.columns?.map((col: string, idx: number) => (
                  <th key={idx} className="py-3 px-4 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={reportData.columns?.length || 5} className="py-12 text-center text-[var(--muted-foreground)]">
                    Loading report preview...
                  </td>
                </tr>
              ) : reportData.rows?.length === 0 ? (
                <tr>
                  <td colSpan={reportData.columns?.length || 5} className="py-12 text-center text-[var(--muted-foreground)]">
                    No data found for this report and filter range.
                  </td>
                </tr>
              ) : (
                reportData.rows?.map((row: any[], rIdx: number) => (
                  <tr key={rIdx} className="hover:bg-[var(--surface-secondary)]/30 transition-colors">
                    {row.map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="py-3 px-4 whitespace-nowrap text-foreground font-mono text-3xs">
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

