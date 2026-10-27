"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HostEarningsReportsLandingData } from "@/services/host-reporting.service";
import { GenerateReportModal } from "@/components/host/earnings/generate-report-modal";
import {
  SettingsStatusBadge,
  BarChartReportsIcon,
  DownloadIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  CalendarIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  BuildingBankIcon,
  ReceiptTaxIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  XIcon,
} from "@/components/host/account-settings";

interface EarningsReportsManagerProps {
  initialData: HostEarningsReportsLandingData;
  hostId: string;
}

const formatNative = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);

export function EarningsReportsManager({
  initialData,
  hostId,
}: EarningsReportsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<HostEarningsReportsLandingData>(initialData);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeCurrency = data.yearlySummary.currency || data.selectedCurrency || "SAR";

  // Handle filter changes (Year, Property, Currency)
  const handleFilterChange = (changes: Record<string, string | null>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

    startTransition(async () => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      try {
        const res = await fetch(`/api/v1/host/earnings/reports?${next.toString()}`);
        const payload = await res.json();
        if (res.ok && payload.data) {
          setData(payload.data);
        } else {
          setErrorMsg(payload.message || "Failed to update earnings reports data.");
        }
      } catch (err: any) {
        setErrorMsg("Failed to connect to the reporting service. Please try again.");
      }
    });
  };

  // Dedicated direct report download handler
  const handleDownloadReport = async (options: {
    format: "csv" | "pdf";
    month?: number;
    year?: number;
    label?: string;
  }) => {
    const { format, month, year = data.selectedYear, label } = options;
    const downloadKey = month ? `${month}-${format}` : `annual-${format}`;
    setDownloadingFormat(downloadKey);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const exportParams = new URLSearchParams();
      if (month) {
        const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
        // Last day of month
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const endStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        exportParams.set("period", "custom");
        exportParams.set("startDate", startStr);
        exportParams.set("endDate", endStr);
      } else {
        exportParams.set("period", "custom");
        exportParams.set("startDate", `${year}-01-01`);
        exportParams.set("endDate", `${year}-12-31`);
      }

      if (data.selectedListingId) {
        exportParams.set("propertyId", data.selectedListingId);
      }
      if (activeCurrency) {
        exportParams.set("currency", activeCurrency);
      }
      exportParams.set("format", format);

      const res = await fetch(`/api/v1/host/earnings/reports/export?${exportParams.toString()}`);
      if (!res.ok) {
        throw new Error("Your report couldn't be generated. Please try again.");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `homyz-earnings-${year}${month ? `-${String(month).padStart(2, "0")}` : ""}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      setSuccessMsg(
        `Successfully downloaded ${label || (month ? `Month ${month}` : `Annual ${year}`)} ${format.toUpperCase()} statement.`,
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Your report couldn't be generated. Please try again.");
    } finally {
      setDownloadingFormat(null);
    }
  };

  const getMonthStatusBadge = (status: "COMPLETED" | "IN_PROGRESS" | "NO_ACTIVITY") => {
    switch (status) {
      case "COMPLETED":
        return { label: "Completed", variant: "success" as const };
      case "IN_PROGRESS":
        return { label: "In Progress", variant: "warning" as const };
      case "NO_ACTIVITY":
      default:
        return { label: "No Activity", variant: "neutral" as const };
    }
  };

  return (
    <div className="space-y-8">
      {/* Alert Notices */}
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 shadow-xs">
          <AlertTriangleIcon size={20} className="mt-0.5 shrink-0 text-rose-600" />
          <div className="flex-1 text-sm font-medium">{errorMsg}</div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-xs">
          <CheckCircleIcon size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="flex-1 text-sm font-medium">{successMsg}</div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {/* Filter Toolbar Card */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-950">
              Filter Reporting Scope
            </h2>
            <p className="text-xs text-zinc-500">
              View historical earnings statements or isolate performance by property and year.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-zinc-500">Year:</span>
              <select
                value={data.selectedYear}
                onChange={(e) => handleFilterChange({ year: e.target.value })}
                disabled={isPending}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-2xs focus:border-zinc-900 focus:outline-none disabled:opacity-50"
              >
                {data.availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Property Selector */}
            {data.listings.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-zinc-500">Property:</span>
                <select
                  value={data.selectedListingId || ""}
                  onChange={(e) =>
                    handleFilterChange({ propertyId: e.target.value || null })
                  }
                  disabled={isPending}
                  className="max-w-[180px] truncate rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-2xs focus:border-zinc-900 focus:outline-none disabled:opacity-50"
                >
                  <option value="">All Properties ({data.listings.length})</option>
                  {data.listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Currency Selector */}
            {data.currencies.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-zinc-500">Currency:</span>
                <select
                  value={activeCurrency}
                  onChange={(e) => handleFilterChange({ currency: e.target.value })}
                  disabled={isPending}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-2xs focus:border-zinc-900 focus:outline-none disabled:opacity-50"
                >
                  {data.currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Report Button */}
            <button
              type="button"
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <CalendarIcon size={14} className="text-zinc-600" />
              <span>Custom Date Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section A: Earnings Overview Grid */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-medium tracking-tight text-[#1f1f1f]">
                {data.selectedYear} Financial Summary
              </h3>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-xs font-medium text-zinc-700">
                {activeCurrency}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Aggregated across {data.yearlySummary.transactionCount} completed reservation{data.yearlySummary.transactionCount === 1 ? "" : "s"} in {data.selectedYear}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handleDownloadReport({
                  format: "pdf",
                  label: `${data.selectedYear} Annual`,
                })
              }
              disabled={downloadingFormat === "annual-pdf"}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <DownloadIcon size={14} />
              <span>
                {downloadingFormat === "annual-pdf"
                  ? "Generating..."
                  : "Annual Statement (PDF)"}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleDownloadReport({
                  format: "csv",
                  label: `${data.selectedYear} Annual`,
                })
              }
              disabled={downloadingFormat === "annual-csv"}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
            >
              <FileSpreadsheetIcon size={14} className="text-zinc-600" />
              <span>
                {downloadingFormat === "annual-csv" ? "Exporting..." : "Annual CSV"}
              </span>
            </button>
          </div>
        </div>

        {/* 6-Card Overview Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {/* 1. Gross Earnings */}
          <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4">
            <span className="text-[11px] font-medium text-zinc-500 block">
              Gross Earnings
            </span>
            <p className="mt-1 font-mono text-sm sm:text-base font-bold text-zinc-900 truncate">
              {formatNative(data.yearlySummary.grossEarnings, activeCurrency)}
            </p>
            <span className="mt-1 text-[10px] text-zinc-400 block">
              Accommodation & fees
            </span>
          </div>

          {/* 2. Platform Service Fee */}
          <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4">
            <span className="text-[11px] font-medium text-zinc-500 block">
              Service Fees
            </span>
            <p className="mt-1 font-mono text-sm sm:text-base font-bold text-rose-700 truncate">
              -{formatNative(data.yearlySummary.platformFee, activeCurrency)}
            </p>
            <span className="mt-1 text-[10px] text-zinc-400 block">
              Platform commission
            </span>
          </div>

          {/* 3. Adjustments */}
          <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4">
            <span className="text-[11px] font-medium text-zinc-500 block">
              Adjustments
            </span>
            <p className="mt-1 font-mono text-sm sm:text-base font-bold text-zinc-900 truncate">
              {data.yearlySummary.adjustments >= 0 ? "+" : ""}
              {formatNative(data.yearlySummary.adjustments, activeCurrency)}
            </p>
            <span className="mt-1 text-[10px] text-zinc-400 block">
              Credits & claims
            </span>
          </div>

          {/* 4. Net Host Earnings (Highlight) */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-white shadow-xs">
            <span className="text-[11px] font-medium text-zinc-300 block">
              Net Earnings
            </span>
            <p className="mt-1 font-mono text-sm sm:text-base font-bold text-white truncate">
              {formatNative(data.yearlySummary.netEarnings, activeCurrency)}
            </p>
            <span className="mt-1 text-[10px] text-zinc-400 block">
              Payable to host
            </span>
          </div>

          {/* 5. Confirmed Paid */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <span className="text-[11px] font-medium text-emerald-800 block">
              Paid Out
            </span>
            <p className="mt-1 font-mono text-sm sm:text-base font-bold text-emerald-950 truncate">
              {formatNative(data.yearlySummary.paidPayouts, activeCurrency)}
            </p>
            <span className="mt-1 text-[10px] text-emerald-700 block">
              Settled to bank
            </span>
          </div>

          {/* 6. Upcoming Payouts */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
            <span className="text-[11px] font-medium text-amber-800 block">
              Upcoming
            </span>
            <p className="mt-1 font-mono text-sm sm:text-base font-bold text-amber-950 truncate">
              {formatNative(data.yearlySummary.upcomingPayouts, activeCurrency)}
            </p>
            <span className="mt-1 text-[10px] text-amber-700 block">
              Pending release
            </span>
          </div>
        </div>

        {/* Reconciliation Formula Callout */}
        <div className="mt-5 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <InfoIcon size={16} className="text-zinc-500 shrink-0" />
            <p className="font-mono text-[11px] sm:text-xs">
              <span className="font-semibold text-zinc-900">Reconciliation:</span>{" "}
              Gross ({formatNative(data.yearlySummary.grossEarnings, activeCurrency)}) -
              Fees ({formatNative(data.yearlySummary.platformFee, activeCurrency)}) +
              Adjustments ({formatNative(data.yearlySummary.adjustments, activeCurrency)}) ={" "}
              <span className="font-bold text-zinc-950">
                Net Earnings ({formatNative(data.yearlySummary.netEarnings, activeCurrency)})
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Section B: Monthly Performance Statements Table */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-950">
              Monthly Earnings Statements
            </h3>
            <p className="text-xs text-zinc-500">
              Select a month to inspect transaction details or download official statements.
            </p>
          </div>
          <span className="text-xs text-zinc-400">
            12 months in {data.selectedYear}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-3">Month</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Gross</th>
                <th className="py-3 px-3 text-right">Fees</th>
                <th className="py-3 px-3 text-right">Net Earnings</th>
                <th className="py-3 px-3 text-right">Paid Out</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {data.monthlyReports.map((month) => {
                const badge = getMonthStatusBadge(month.status);
                const isDownloadingThisPdf = downloadingFormat === `${month.month}-pdf`;
                const isDownloadingThisCsv = downloadingFormat === `${month.month}-csv`;

                return (
                  <tr
                    key={month.month}
                    className="hover:bg-zinc-50/70 transition-colors group"
                  >
                    <td className="py-3.5 px-3">
                      <div>
                        <Link
                          href={`/host/earnings/reports/monthly/${month.year}/${month.month}`}
                          className="font-bold text-zinc-950 hover:underline"
                        >
                          {month.monthName}
                        </Link>
                        <p className="text-[11px] text-zinc-400">
                          {month.dateRange.start.slice(5)} to {month.dateRange.end.slice(5)}
                          {month.transactionCount > 0 && ` • ${month.transactionCount} stays`}
                        </p>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <SettingsStatusBadge label={badge.label} variant={badge.variant} />
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-medium text-zinc-700">
                      {formatNative(month.grossEarnings, month.currency)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-medium text-rose-700">
                      {month.platformFee > 0 ? `-${formatNative(month.platformFee, month.currency)}` : "—"}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold text-zinc-950">
                      {formatNative(month.netEarnings, month.currency)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-medium text-emerald-700">
                      {month.paidPayouts > 0 ? formatNative(month.paidPayouts, month.currency) : "—"}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/host/earnings/reports/monthly/${month.year}/${month.month}`}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 transition"
                        >
                          Details
                        </Link>

                        <button
                          type="button"
                          title="Download Month PDF Statement"
                          onClick={() =>
                            handleDownloadReport({
                              format: "pdf",
                              month: month.month,
                              year: month.year,
                              label: `${month.monthName} ${month.year}`,
                            })
                          }
                          disabled={isDownloadingThisPdf}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition disabled:opacity-40"
                        >
                          <DownloadIcon size={14} />
                        </button>

                        <button
                          type="button"
                          title="Download Month CSV Ledger"
                          onClick={() =>
                            handleDownloadReport({
                              format: "csv",
                              month: month.month,
                              year: month.year,
                              label: `${month.monthName} ${month.year}`,
                            })
                          }
                          disabled={isDownloadingThisCsv}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition disabled:opacity-40"
                        >
                          <FileSpreadsheetIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section C: Annual Financial Documents & Deep Link */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-900 border border-indigo-200">
            <FileTextIcon size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-zinc-950">
              Annual Financial Documents & Accounting Exports
            </h3>
            <p className="mt-1 text-sm text-zinc-600 leading-relaxed">
              Consolidated yearly accounting statements aggregate all completed reservations, host service fees, and bank disbursements for corporate accounting and filing records.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  handleDownloadReport({
                    format: "pdf",
                    label: `${data.selectedYear} Annual`,
                  })
                }
                disabled={downloadingFormat === "annual-pdf"}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-zinc-800 disabled:opacity-50"
              >
                <DownloadIcon size={15} />
                <span>Download {data.selectedYear} Statement (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDownloadReport({
                    format: "csv",
                    label: `${data.selectedYear} Annual`,
                  })
                }
                disabled={downloadingFormat === "annual-csv"}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
              >
                <FileSpreadsheetIcon size={15} className="text-zinc-600" />
                <span>Export Transaction Ledger (CSV)</span>
              </button>

              <Link
                href={`/host/earnings/reports/yearly/${data.selectedYear}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 hover:underline px-3 py-2"
              >
                <span>Full Annual Breakdown</span>
                <ChevronRightIcon size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Section D: Quick Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/host/earnings"
          className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 transition hover:border-zinc-300 hover:bg-white hover:shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-900 shadow-2xs group-hover:bg-[#FCDF9C]/50 transition-colors">
              <BarChartReportsIcon size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-950">Earnings Dashboard</p>
              <p className="text-xs text-zinc-500">Live metrics & payouts</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-800">
            <span>Open dashboard</span>
            <ExternalLinkIcon size={14} className="text-zinc-400 group-hover:text-zinc-900" />
          </div>
        </Link>

        <Link
          href="/host/earnings/transactions"
          className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 transition hover:border-zinc-300 hover:bg-white hover:shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-900 shadow-2xs group-hover:bg-[#FCDF9C]/50 transition-colors">
              <BuildingBankIcon size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-950">Transaction History</p>
              <p className="text-xs text-zinc-500">Per-booking ledger</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-800">
            <span>View transactions</span>
            <ExternalLinkIcon size={14} className="text-zinc-400 group-hover:text-zinc-900" />
          </div>
        </Link>

        <Link
          href="/host/account-settings/payouts"
          className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 transition hover:border-zinc-300 hover:bg-white hover:shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-900 shadow-2xs group-hover:bg-[#FCDF9C]/50 transition-colors">
              <BuildingBankIcon size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-950">Payout Settings</p>
              <p className="text-xs text-zinc-500">IBAN & routing rules</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-800">
            <span>Manage accounts</span>
            <ChevronRightIcon size={14} className="text-zinc-400 group-hover:text-zinc-900" />
          </div>
        </Link>

        <Link
          href="/host/account-settings/taxes?tab=documents"
          className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 transition hover:border-zinc-300 hover:bg-white hover:shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-900 shadow-2xs group-hover:bg-[#FCDF9C]/50 transition-colors">
              <ReceiptTaxIcon size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-950">Tax Documents</p>
              <p className="text-xs text-zinc-500">ZATCA VAT & invoices</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-800">
            <span>View tax forms</span>
            <ChevronRightIcon size={14} className="text-zinc-400 group-hover:text-zinc-900" />
          </div>
        </Link>
      </div>

      {/* Section E: Informational Compliance & Attribution Notice */}
      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-5 text-xs text-zinc-600">
        <div className="flex items-start gap-3">
          <InfoIcon size={18} className="mt-0.5 shrink-0 text-zinc-500" />
          <div className="space-y-1">
            <p className="font-semibold text-zinc-800">
              Financial Reporting Scope & Attribution Policy
            </p>
            <p className="leading-relaxed">
              Earnings figures follow standard short-term rental revenue recognition, attributed upon stay completion (check-out date). Net host earnings reflect gross reservation receipts less host service fees and verified adjustments. These financial statements are designed for management accounting. For official government VAT invoices and taxpayer profiles, consult the{" "}
              <Link
                href="/host/account-settings/taxes"
                className="font-semibold text-zinc-900 underline hover:text-black"
              >
                Tax Information
              </Link>{" "}
              hub.
            </p>
          </div>
        </div>
      </div>

      {/* Custom Report Generator Modal */}
      {showGenerateModal && (
        <GenerateReportModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          listings={data.listings}
          currencies={data.currencies.length > 0 ? data.currencies : [activeCurrency]}
          defaultYear={data.selectedYear}
        />
      )}
    </div>
  );
}

