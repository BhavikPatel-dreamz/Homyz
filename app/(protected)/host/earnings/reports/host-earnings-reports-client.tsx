"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HostEarningsReportsLandingData } from "@/services/host-reporting.service";
import { GenerateReportModal } from "@/components/host/earnings/generate-report-modal";

interface HostEarningsReportsClientProps {
  initialData: HostEarningsReportsLandingData;
}

const formatNative = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);

export function HostEarningsReportsClient({
  initialData,
}: HostEarningsReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<HostEarningsReportsLandingData>(initialData);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [downloadingType, setDownloadingType] = useState<"csv" | "pdf" | null>(
    null,
  );

  const query = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(query);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

    startTransition(async () => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      try {
        const res = await fetch(
          `/api/v1/host/earnings/reports?${next.toString()}`,
        );
        const payload = await res.json();
        if (res.ok && payload.data) {
          setData(payload.data);
        }
      } catch {
        // Fallback to server state
      }
    });
  };

  const handleQuickDownload = async (format: "csv" | "pdf") => {
    setDownloadingType(format);
    try {
      const exportParams = new URLSearchParams();
      exportParams.set("period", "this_year");
      if (data.selectedYear) {
        exportParams.set("period", "custom");
        exportParams.set("startDate", `${data.selectedYear}-01-01`);
        exportParams.set("endDate", `${data.selectedYear}-12-31`);
      }
      if (data.selectedListingId)
        exportParams.set("propertyId", data.selectedListingId);
      if (data.selectedCurrency)
        exportParams.set("currency", data.selectedCurrency);
      exportParams.set("format", format);

      const res = await fetch(
        `/api/v1/host/earnings/reports/export?${exportParams.toString()}`,
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `homyz-earnings-${data.selectedYear}.${format}`;
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
      alert("Failed to download earnings report. Please try again.");
    } finally {
      setDownloadingType(null);
    }
  };

  const currency = data?.selectedCurrency || "SAR";
  const yearly = data?.yearlySummary || {
    grossEarnings: 0,
    adjustments: 0,
    platformFee: 0,
    taxesWithheld: 0,
    netEarnings: 0,
    paidPayouts: 0,
    upcomingPayouts: 0,
    currency,
    transactionCount: 0,
  };
  const availableYears = data?.availableYears || [];
  const listings = data?.listings || [];
  const currencies = data?.currencies || [];
  const monthlyReports = data?.monthlyReports || [];

  const hasYearlyActivity =
    yearly.transactionCount > 0 || yearly.adjustments !== 0;

  // Show months in reverse chronological order (December down to January)
  const displayMonths = [...monthlyReports].reverse();

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/host/earnings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900"
            aria-label="Back to Earnings"
          >
            ←
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Host Finances
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              Earnings reports
            </h1>
          </div>
        </div>

        {/* Filter controls */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900">
              <span className="text-xs text-zinc-500">Year:</span>
              <select
                value={data.selectedYear}
                onChange={(e) => update({ year: e.target.value })}
                className="bg-transparent font-semibold focus:outline-none"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Listing Filter */}
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900">
              <span className="text-xs text-zinc-500">Listing:</span>
              <select
                value={data?.selectedListingId || ""}
                onChange={(e) => update({ propertyId: e.target.value || null })}
                className="max-w-[180px] truncate bg-transparent font-semibold focus:outline-none"
              >
                <option value="">All listings</option>
                {listings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Filter if multiple */}
            {currencies.length > 1 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900">
                <span className="text-xs text-zinc-500">Currency:</span>
                <select
                  value={currency}
                  onChange={(e) => update({ currency: e.target.value || null })}
                  className="bg-transparent font-semibold focus:outline-none"
                >
                  {currencies.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowGenerateModal(true)}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800"
            >
              Generate report
            </button>

            <div className="flex rounded-full border border-zinc-300 p-0.5 text-xs font-semibold">
              <button
                type="button"
                disabled={downloadingType !== null}
                onClick={() => handleQuickDownload("csv")}
                className="rounded-full px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                {downloadingType === "csv" ? "Exporting…" : "CSV"}
              </button>
              <button
                type="button"
                disabled={downloadingType !== null}
                onClick={() => handleQuickDownload("pdf")}
                className="rounded-full px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                {downloadingType === "pdf" ? "Exporting…" : "PDF"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div
        className={`space-y-8 ${isPending ? "opacity-60 transition-opacity" : ""}`}
      >
        {/* Yearly Summary Card */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                {data.selectedYear} Annual Summary
              </span>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Net host earnings
              </p>
              <h2 className="mt-1 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
                {formatNative(yearly.netEarnings, currency)}
              </h2>
              {!hasYearlyActivity && (
                <p className="mt-3 max-w-md text-sm text-zinc-600">
                  No completed stays with a recorded payout snapshot match this
                  year and filter scope.
                </p>
              )}
            </div>

            <Link
              href={`/host/earnings/reports/yearly/${data.selectedYear}${
                query.toString() ? `?${query.toString()}` : ""
              }`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
            >
              View yearly report →
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-6 sm:grid-cols-4">
            <div>
              <p className="text-xs text-zinc-500">Gross earnings</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {formatNative(yearly.grossEarnings, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Host service fee</p>
              <p className="mt-1 text-lg font-semibold text-zinc-700">
                −{formatNative(yearly.platformFee, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Paid disbursements</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">
                {formatNative(yearly.paidPayouts, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Upcoming payouts</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {formatNative(yearly.upcomingPayouts, currency)}
              </p>
            </div>
          </div>
        </section>

        {/* Monthly Reports List */}
        <section>
          <div className="flex items-baseline justify-between border-b border-zinc-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">
                Monthly reports
              </h2>
              <p className="text-xs text-zinc-500">
                Select a month to inspect detailed financial breakdowns and
                transactions
              </p>
            </div>
            <span className="text-xs font-semibold text-zinc-500">
              {data.selectedYear}
            </span>
          </div>

          <div className="mt-4 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
            {displayMonths.map((report) => {
              const detailHref = `/host/earnings/reports/monthly/${report.year}/${report.month}${
                query.toString() ? `?${query.toString()}` : ""
              }`;

              return (
                <Link
                  key={`${report.year}-${report.month}`}
                  href={detailHref}
                  className="group flex items-center justify-between p-4 transition-colors hover:bg-zinc-50 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="font-semibold text-zinc-900 group-hover:text-black">
                        {report.monthName} {report.year}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          report.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700"
                            : report.status === "IN_PROGRESS"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {report.status === "COMPLETED"
                          ? "Completed"
                          : report.status === "IN_PROGRESS"
                            ? "In progress"
                            : "No earnings"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-zinc-500">
                      {report.transactionCount}{" "}
                      {report.transactionCount === 1 ? "booking" : "bookings"}
                      {report.adjustments !== 0 && " · Adjustments recorded"}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-base font-bold text-zinc-950 sm:text-lg">
                        {formatNative(report.netEarnings, report.currency)}
                      </p>
                      <p className="text-[11px] text-zinc-400">Net payout</p>
                    </div>
                    <span className="text-xl text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-950">
                      ›
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* Custom Report Generator Modal */}
      <GenerateReportModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        listings={listings}
        currencies={currencies}
        defaultYear={data?.selectedYear || new Date().getFullYear()}
      />
    </div>
  );
}
