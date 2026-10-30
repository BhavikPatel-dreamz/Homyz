"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { HostYearlyEarningsReportData } from "@/services/host-reporting.service";

interface HostYearlyReportClientProps {
  initialData: HostYearlyEarningsReportData;
}

const formatNative = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);

export function HostYearlyReportClient({ initialData }: HostYearlyReportClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data] = useState<HostYearlyEarningsReportData>(initialData);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);
  const [downloadingType, setDownloadingType] = useState<"csv" | "pdf" | null>(null);

  const query = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const currency = data.selectedCurrency || "SAR";
  const summary = data.summary;
  const maxMonthly = Math.max(1, ...data.monthlyBreakdown.map((m) => m.netEarnings));

  const handleDownload = async (format: "csv" | "pdf") => {
    setDownloadingType(format);
    try {
      const exportParams = new URLSearchParams();
      exportParams.set("period", "custom");
      exportParams.set("startDate", `${data.year}-01-01`);
      exportParams.set("endDate", `${data.year}-12-31`);
      if (data.selectedListingId) exportParams.set("propertyId", data.selectedListingId);
      if (currency) exportParams.set("currency", currency);
      exportParams.set("format", format);

      const res = await fetch(`/api/v1/host/earnings/reports/export?${exportParams.toString()}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `homyz-annual-earnings-${data.year}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download annual report.");
    } finally {
      setDownloadingType(null);
    }
  };

  const returnToReportsHref = `/host/earnings/reports${query.toString() ? `?${query.toString()}` : ""}`;

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="border-b border-zinc-200 pb-6">
        <Link
          href={returnToReportsHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-950"
        >
          ← Back to all reports
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Annual Financial Statement
            </p>
            <h1 className="mt-1 text-3xl font-medium tracking-tight text-zinc-950 sm:text-4xl">
              {data.year} Earnings Report
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              January 1, {data.year} – December 31, {data.year} · {currency}
              {data.selectedListingId && " · Filtered by listing"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={downloadingType !== null}
              onClick={() => handleDownload("csv")}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-800 transition-colors hover:border-zinc-900 disabled:opacity-50"
            >
              {downloadingType === "csv" ? "Exporting…" : "Download CSV"}
            </button>
            <button
              type="button"
              disabled={downloadingType !== null}
              onClick={() => handleDownload("pdf")}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {downloadingType === "pdf" ? "Exporting…" : "Download PDF"}
            </button>
          </div>
        </div>
      </header>

      {/* Annual Summary Card */}
      <section className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-xs sm:p-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Annual Performance
        </h2>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <p className="text-4xl font-medium tracking-tight text-zinc-950 sm:text-5xl">
            {formatNative(summary.netEarnings, currency)}
          </p>
          <span className="text-sm font-medium text-zinc-500">Total Net Earnings</span>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-6 sm:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-500">Gross earnings</p>
            <p className="mt-1 text-lg font-medium text-zinc-900">
              {formatNative(summary.grossEarnings, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Total deductions</p>
            <p className="mt-1 text-lg font-medium text-zinc-700">
              −{formatNative(summary.platformFee + summary.taxesWithheld, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Completed payouts</p>
            <p className="mt-1 text-lg font-medium text-emerald-700">
              {formatNative(summary.paidPayouts, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Upcoming payouts</p>
            <p className="mt-1 text-lg font-medium text-zinc-900">
              {formatNative(summary.upcomingPayouts, currency)}
            </p>
          </div>
        </div>
      </section>

      {/* Monthly Bar Chart Comparison */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-medium text-zinc-950">Monthly earnings comparison</h2>
            <p className="text-xs text-zinc-500">
              Net earnings recognized across 12 calendar months
            </p>
          </div>
          <span className="text-xs font-medium text-zinc-400">{currency}</span>
        </div>

        {/* Visual Bar Graph */}
        <div className="mt-6 min-h-48 overflow-x-auto">
          <div className="flex h-48 min-w-[500px] items-end gap-2 border-b border-zinc-200 px-2 pb-6">
            {data.monthlyBreakdown.map((m, idx) => {
              const isSelected = selectedMonthIndex === idx;
              const heightPct = Math.max(m.netEarnings > 0 ? 5 : 2, (m.netEarnings / maxMonthly) * 100);

              return (
                <button
                  key={m.month}
                  type="button"
                  onClick={() => setSelectedMonthIndex(idx)}
                  className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end focus:outline-none"
                >
                  <span
                    className={`w-full rounded-t-sm transition-all ${
                      isSelected
                        ? "bg-zinc-950"
                        : m.netEarnings > 0
                          ? "bg-zinc-300 group-hover:bg-zinc-700"
                          : "bg-zinc-100"
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="absolute -bottom-5 text-[11px] font-medium text-zinc-500">
                    {m.monthName.slice(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedMonthIndex !== null && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 p-3 text-sm">
            <div>
              <span className="font-medium text-zinc-900">
                {data.monthlyBreakdown[selectedMonthIndex].monthName} {data.year}:
              </span>{" "}
              {formatNative(data.monthlyBreakdown[selectedMonthIndex].netEarnings, currency)}
            </div>
            <Link
              href={`/host/earnings/reports/monthly/${data.year}/${data.monthlyBreakdown[selectedMonthIndex].month}${
                query.toString() ? `?${query.toString()}` : ""
              }`}
              className="font-medium text-zinc-950 underline underline-offset-2 hover:text-zinc-600"
            >
              Open detailed report →
            </Link>
          </div>
        )}
      </section>

      {/* Monthly Breakdown Table */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <h2 className="text-xl font-medium text-zinc-950">Monthly report breakdown</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Click any month to open its dedicated accounting snapshot and transaction details
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="pb-3">Month</th>
                <th className="pb-3 text-right">Gross</th>
                <th className="pb-3 text-right">Deductions</th>
                <th className="pb-3 text-right">Net Earnings</th>
                <th className="pb-3 text-right">Paid Out</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.monthlyBreakdown.map((m) => {
                const monthDetailHref = `/host/earnings/reports/monthly/${m.year}/${m.month}${
                  query.toString() ? `?${query.toString()}` : ""
                }`;

                return (
                  <tr key={m.month} className="group hover:bg-zinc-50/70">
                    <td className="py-3.5 font-medium text-zinc-900">
                      <Link href={monthDetailHref} className="hover:underline">
                        {m.monthName} {m.year}
                      </Link>
                    </td>
                    <td className="py-3.5 text-right text-zinc-600">
                      {formatNative(m.grossEarnings, currency)}
                    </td>
                    <td className="py-3.5 text-right text-zinc-600">
                      −{formatNative(m.platformFee + m.taxesWithheld, currency)}
                    </td>
                    <td className="py-3.5 text-right font-medium text-zinc-950">
                      {formatNative(m.netEarnings, currency)}
                    </td>
                    <td className="py-3.5 text-right text-emerald-700">
                      {formatNative(m.paidPayouts, currency)}
                    </td>
                    <td className="py-3.5 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          m.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700"
                            : m.status === "IN_PROGRESS"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {m.status === "COMPLETED"
                          ? "Completed"
                          : m.status === "IN_PROGRESS"
                            ? "In progress"
                            : "No activity"}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href={monthDetailHref}
                        className="text-xs font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Property-wise annual breakdown */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <h2 className="text-xl font-medium text-zinc-950">Property annual earnings breakdown</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Annual financial totals aggregated per authorized property
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="pb-3">Property Title</th>
                <th className="pb-3 text-center">Bookings</th>
                <th className="pb-3 text-right">Annual Gross</th>
                <th className="pb-3 text-right">Annual Deductions</th>
                <th className="pb-3 text-right">Annual Net Earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.propertyBreakdown.length > 0 ? (
                data.propertyBreakdown.map((p) => (
                  <tr key={p.listingId} className="hover:bg-zinc-50/70">
                    <td className="py-3.5 font-medium text-zinc-900">{p.listingTitle}</td>
                    <td className="py-3.5 text-center text-zinc-600">{p.transactionsCount}</td>
                    <td className="py-3.5 text-right text-zinc-600">
                      {formatNative(p.grossEarnings, currency)}
                    </td>
                    <td className="py-3.5 text-right text-zinc-600">
                      −{formatNative(p.deductions, currency)}
                    </td>
                    <td className="py-3.5 text-right font-medium text-zinc-950">
                      {formatNative(p.netEarnings, currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-zinc-500">
                    No property records for this calendar year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

