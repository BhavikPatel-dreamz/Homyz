"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HostMonthlyEarningsReportData } from "@/services/host-reporting.service";

interface HostMonthlyReportClientProps {
  initialData: HostMonthlyEarningsReportData;
}

const formatNative = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);

const formatDate = (dateStr?: string | null) =>
  dateStr
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
        new Date(dateStr),
      )
    : "—";

const statusStyle = (value: string) =>
  value === "PAID"
    ? "bg-emerald-50 text-emerald-700"
    : value === "PROCESSING"
      ? "bg-violet-50 text-violet-700"
      : "bg-sky-50 text-sky-700";

const statusText = (value: string) =>
  ({
    SCHEDULED: "Scheduled",
    ELIGIBLE_SETTLEMENT: "Ready for settlement",
    PROCESSING: "Processing",
    PAID: "Paid",
  }[value] || value.replaceAll("_", " "));

export function HostMonthlyReportClient({ initialData }: HostMonthlyReportClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<HostMonthlyEarningsReportData>(initialData);
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string | null>(null);
  const [downloadingType, setDownloadingType] = useState<"csv" | "pdf" | null>(null);

  const query = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const currency = data.selectedCurrency || "SAR";
  const summary = data.summary;

  const handlePropertyFilter = (listingId: string | null) => {
    setSelectedPropertyFilter((prev) => (prev === listingId ? null : listingId));
  };

  const handleDownload = async (format: "csv" | "pdf") => {
    setDownloadingType(format);
    try {
      const exportParams = new URLSearchParams();
      exportParams.set("period", "custom");
      exportParams.set("startDate", data.dateRange.start.slice(0, 10));
      exportParams.set("endDate", data.dateRange.end.slice(0, 10));
      if (data.selectedListingId) exportParams.set("propertyId", data.selectedListingId);
      if (currency) exportParams.set("currency", currency);
      exportParams.set("format", format);

      const res = await fetch(`/api/v1/host/earnings/reports/export?${exportParams.toString()}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `homyz-earnings-${data.year}-${String(data.month).padStart(2, "0")}.${format}`;
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
      alert("Failed to download report.");
    } finally {
      setDownloadingType(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!selectedPropertyFilter) return data.transactions;
    return data.transactions.filter((tx) => tx.listingId === selectedPropertyFilter);
  }, [data.transactions, selectedPropertyFilter]);

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
              Monthly Earnings Report
            </p>
            <h1 className="mt-1 text-3xl font-medium tracking-tight text-zinc-950 sm:text-4xl">
              {data.monthLabel}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {formatDate(data.dateRange.start)} – {formatDate(data.dateRange.end)} · {currency}
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

      {/* Financial Summary */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Financial Summary
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <p className="text-xs text-zinc-500">Gross earnings</p>
            <p className="mt-1 text-xl font-medium text-zinc-900">
              {formatNative(summary.grossEarnings, currency)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">Before deductions</p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <p className="text-xs text-zinc-500">Host service fee</p>
            <p className="mt-1 text-xl font-medium text-zinc-700">
              −{formatNative(summary.platformFee, currency)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">Platform commission</p>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <p className="text-xs text-zinc-500">Adjustments</p>
            <p className="mt-1 text-xl font-medium text-zinc-700">
              {summary.adjustments < 0 ? "−" : ""}
              {formatNative(Math.abs(summary.adjustments), currency)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">Refunds, credits, disputes</p>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4 text-white">
            <p className="text-xs text-zinc-400">Net earnings</p>
            <p className="mt-1 text-xl font-medium text-white">
              {formatNative(summary.netEarnings, currency)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">Recognized host payout</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-8 border-t border-zinc-200 pt-6">
          <div>
            <p className="text-xs text-zinc-500">Paid disbursements</p>
            <p className="mt-1 text-base font-medium text-emerald-700">
              {formatNative(summary.paidPayouts, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Upcoming payouts</p>
            <p className="mt-1 text-base font-medium text-zinc-900">
              {formatNative(summary.upcomingPayouts, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Taxes withheld</p>
            <p className="mt-1 text-base font-medium text-zinc-700">
              {formatNative(summary.taxesWithheld, currency)}
            </p>
          </div>
        </div>
      </section>

      {/* Breakdowns Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Earnings by Property */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-950">Earnings by property</h2>
            {selectedPropertyFilter && (
              <button
                type="button"
                onClick={() => setSelectedPropertyFilter(null)}
                className="text-xs font-medium text-zinc-600 underline hover:text-zinc-950"
              >
                Clear filter
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Click a property to filter matching transactions below
          </p>

          <div className="mt-4 divide-y divide-zinc-100">
            {data.propertyBreakdown.length > 0 ? (
              data.propertyBreakdown.map((p) => {
                const isSelected = selectedPropertyFilter === p.listingId;
                return (
                  <button
                    key={p.listingId}
                    type="button"
                    onClick={() => handlePropertyFilter(p.listingId)}
                    className={`flex w-full items-center justify-between py-3 text-left transition-colors ${
                      isSelected ? "rounded-xl bg-zinc-100 px-3" : "hover:bg-zinc-50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{p.listingTitle}</p>
                      <p className="text-xs text-zinc-500">
                        {p.transactionsCount} {p.transactionsCount === 1 ? "booking" : "bookings"} · Gross:{" "}
                        {formatNative(p.grossEarnings, currency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-950">
                        {formatNative(p.netEarnings, currency)}
                      </p>
                      <span className="text-[11px] text-zinc-400">
                        {isSelected ? "Filtered ✓" : "Filter →"}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="py-4 text-xs text-zinc-400">No property earnings recorded.</p>
            )}
          </div>
        </section>

        {/* Earnings by Type & Payout Methods */}
        <section className="space-y-6">
          {/* Earnings by Type */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-medium text-zinc-950">Earnings by category</h2>
            <div className="mt-4 divide-y divide-zinc-100 text-sm">
              <div className="flex justify-between py-2.5">
                <span className="text-zinc-600">Nightly accommodation</span>
                <span className="font-medium text-zinc-900">
                  {formatNative(data.earningsTypeBreakdown.accommodation, currency)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-zinc-600">Cleaning fees</span>
                <span className="font-medium text-zinc-900">
                  {formatNative(data.earningsTypeBreakdown.cleaningFee, currency)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-zinc-600">Additional guest fees</span>
                <span className="font-medium text-zinc-900">
                  {formatNative(data.earningsTypeBreakdown.extraGuestFee, currency)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-zinc-600">Pet fees</span>
                <span className="font-medium text-zinc-900">
                  {formatNative(data.earningsTypeBreakdown.petFee, currency)}
                </span>
              </div>
              {data.earningsTypeBreakdown.adjustments !== 0 && (
                <div className="flex justify-between py-2.5">
                  <span className="text-zinc-600">Recorded adjustments</span>
                  <span className="font-medium text-zinc-900">
                    {formatNative(data.earningsTypeBreakdown.adjustments, currency)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payout Methods Used */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-lg font-medium text-zinc-950">Payout destination</h2>
            <div className="mt-3 divide-y divide-zinc-100">
              {data.payoutMethodBreakdown.length > 0 ? (
                data.payoutMethodBreakdown.map((m, idx) => (
                  <div key={idx} className="flex justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-zinc-900">{m.bankName}</p>
                      <p className="font-mono text-xs text-zinc-500">{m.ibanMasked}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-zinc-900">{formatNative(m.amount, currency)}</p>
                      <p className="text-xs text-zinc-400">{m.count} payouts</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-2 text-xs text-zinc-500">
                  Disbursements are routed to verified bank payout methods upon completed stay.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Reservation Transactions List */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-medium text-zinc-950">Reservation transactions</h2>
            <p className="text-xs text-zinc-500">
              {filteredTransactions.length} transaction
              {filteredTransactions.length === 1 ? "" : "s"} in this reporting scope
              {selectedPropertyFilter && " (filtered by property)"}
            </p>
          </div>
          {selectedPropertyFilter && (
            <button
              type="button"
              onClick={() => setSelectedPropertyFilter(null)}
              className="text-xs font-medium text-zinc-600 underline hover:text-zinc-950"
            >
              Show all properties
            </button>
          )}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="pb-3">Reference / Property</th>
                <th className="pb-3">Guest & Dates</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Gross</th>
                <th className="pb-3 text-right">Fee</th>
                <th className="pb-3 text-right">Net Payout</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const txDetailHref = `/host/earnings/transactions/${tx.bookingId}?returnTo=${encodeURIComponent(
                    pathname + (query.toString() ? `?${query.toString()}` : ""),
                  )}`;

                  return (
                    <tr key={tx.bookingId} className="group hover:bg-zinc-50/60">
                      <td className="py-3.5 pr-4">
                        <Link href={txDetailHref} className="font-medium text-zinc-900 hover:underline">
                          {tx.listingTitle}
                        </Link>
                        <p className="font-mono text-xs text-zinc-400">
                          {tx.bookingId.slice(0, 14)}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <p className="font-medium text-zinc-800">{tx.guestName}</p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(tx.startDate)} – {formatDate(tx.endDate)}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(
                            tx.status,
                          )}`}
                        >
                          {statusText(tx.status)}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right text-zinc-600">
                        {formatNative(tx.grossEarnings, tx.currency)}
                      </td>
                      <td className="py-3.5 pr-4 text-right text-zinc-600">
                        −{formatNative(tx.platformFee, tx.currency)}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-medium text-zinc-950">
                        {formatNative(tx.netPayout, tx.currency)}
                      </td>
                      <td className="py-3.5 text-right">
                        <Link
                          href={txDetailHref}
                          className="text-xs font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                    No transactions recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Refunds and Adjustments (if any) */}
      {data.adjustmentsList.length > 0 && (
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
          <h2 className="text-xl font-medium text-zinc-950">Recorded adjustments</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Deductions, dispute offsets or compensation credits applied this month
          </p>

          <div className="mt-4 divide-y divide-zinc-100">
            {data.adjustmentsList.map((adj) => (
              <div key={adj.id} className="flex justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-zinc-900">{adj.type.replaceAll("_", " ")}</p>
                  <p className="text-xs text-zinc-500">{adj.reason} · {formatDate(adj.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-zinc-900">
                    {formatNative(adj.amount, adj.currency)}
                  </p>
                  <span className="text-xs text-zinc-400">{adj.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

