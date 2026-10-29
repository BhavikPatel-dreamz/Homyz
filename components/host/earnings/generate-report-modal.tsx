"use client";

import React, { useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { defaultExportFields } from "@/lib/export/report-constants";

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  listings: Array<{ id: string; title: string }>;
  currencies: string[];
  defaultYear?: number;
}

type ReportingPeriod = "this_month" | "last_month" | "this_year" | "previous_year" | "custom";
type EarningsType = "all" | "reservation" | "adjustments";
type PayoutStatus = "all" | "paid" | "upcoming";

const REPORTING_PERIODS: ReadonlyArray<{ id: ReportingPeriod; label: string }> = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_year", label: "Year to date" },
  { id: "previous_year", label: "Previous year" },
  { id: "custom", label: "Custom range" },
];

const FIELD_GROUPS = [
  {
    title: "Reservation Information",
    fields: [
      { id: "bookingId", label: "Reservation reference" },
      { id: "guestName", label: "Guest name" },
      { id: "listingTitle", label: "Property title" },
      { id: "checkIn", label: "Check-in date" },
      { id: "checkOut", label: "Check-out date" },
      { id: "nights", label: "Number of nights" },
      { id: "status", label: "Reservation status" },
    ],
  },
  {
    title: "Financial Information",
    fields: [
      { id: "currency", label: "Booking currency" },
      { id: "accommodation", label: "Accommodation subtotal" },
      { id: "cleaningFee", label: "Cleaning fee" },
      { id: "extraGuestFee", label: "Additional guest fee" },
      { id: "grossEarnings", label: "Gross earnings" },
      { id: "hostServiceFee", label: "Host service fee" },
      { id: "adjustments", label: "Recorded adjustments" },
      { id: "taxesWithheld", label: "Taxes withheld" },
      { id: "netEarnings", label: "Net earnings" },
    ],
  },
  {
    title: "Payout Information",
    fields: [
      { id: "payoutReference", label: "Payout reference" },
      { id: "payoutStatus", label: "Payout status" },
      { id: "payoutMethod", label: "Payout method" },
      { id: "scheduledPayoutDate", label: "Scheduled payout date" },
      { id: "actualPayoutDate", label: "Actual payout date" },
      { id: "payoutAmount", label: "Payout amount" },
    ],
  },
];

export function GenerateReportModal({
  isOpen,
  onClose,
  listings,
  currencies,
}: GenerateReportModalProps) {
  const [period, setPeriod] = useState<ReportingPeriod>("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [listingId, setListingId] = useState("");
  const [earningsType, setEarningsType] = useState<EarningsType>("all");
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus>("all");
  const [currency, setCurrency] = useState(currencies[0] || "");
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [selectedFields, setSelectedFields] = useState<string[]>(defaultExportFields);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId],
    );
  };

  const selectAllFields = () => {
    const all = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.id));
    setSelectedFields(all);
  };

  const deselectAllFields = () => {
    setSelectedFields([]);
  };

  const resetToDefault = () => {
    setSelectedFields(defaultExportFields);
    setPeriod("this_month");
    setListingId("");
    setEarningsType("all");
    setPayoutStatus("all");
    setFormat("csv");
    setError(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (period === "custom") {
      if (!startDate || !endDate) {
        setError("Please choose both a start date and an end date for custom date range.");
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        setError("Start date must be before or equal to end date.");
        return;
      }
    }

    if (selectedFields.length === 0) {
      setError("Please select at least one field column for the report.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/v1/host/earnings/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          startDate: period === "custom" ? startDate : undefined,
          endDate: period === "custom" ? endDate : undefined,
          listingId: listingId || undefined,
          earningsType,
          payoutStatus,
          currency: currency || undefined,
          format,
          fields: selectedFields,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson?.error?.message || "Failed to generate report.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `homyz-earnings-report.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate earnings report.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      isOpen={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-[10000] flex items-end bg-black/50 p-4 backdrop-blur-xs sm:items-center sm:justify-center"
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h2 id="report-modal-title" className="text-xl font-medium tracking-tight text-[#1f1f1f]">
              Generate earnings report
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Configure reporting period, listings, filters and column fields
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="mt-5 space-y-6">
          {/* Period Selection */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Reporting period
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {REPORTING_PERIODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriod(item.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    period === item.id
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {period === "custom" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-zinc-700">
                  Start Date
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
                <label className="block text-xs font-medium text-zinc-700">
                  End Date
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Listings & Currency */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Listing / Property
              </label>
              <select
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900"
              >
                <option value="">All authorized listings</option>
                {listings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Settlement Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900"
              >
                {currencies.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Earnings Type & Payout Status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Earnings Type
              </label>
              <select
                value={earningsType}
                onChange={(e) => setEarningsType(e.target.value as EarningsType)}
                className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900"
              >
                <option value="all">All earnings & adjustments</option>
                <option value="reservation">Reservation earnings only</option>
                <option value="adjustments">Adjustments only</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Payout Status
              </label>
              <select
                value={payoutStatus}
                onChange={(e) => setPayoutStatus(e.target.value as PayoutStatus)}
                className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900"
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid payouts only</option>
                <option value="upcoming">Upcoming & processing only</option>
              </select>
            </div>
          </div>

          {/* Export Format */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Report Format
            </label>
            <div className="mt-2 flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="report-format"
                  value="csv"
                  checked={format === "csv"}
                  onChange={() => setFormat("csv")}
                  className="h-4 w-4 text-zinc-950 focus:ring-zinc-950"
                />
                CSV Spreadsheet (.csv)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="report-format"
                  value="pdf"
                  checked={format === "pdf"}
                  onChange={() => setFormat("pdf")}
                  className="h-4 w-4 text-zinc-950 focus:ring-zinc-950"
                />
                PDF Document (.pdf)
              </label>
            </div>
          </div>

          {/* Configurable Columns */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Include report columns</p>
                <p className="text-xs text-zinc-500">
                  {selectedFields.length} columns selected
                </p>
              </div>
              <div className="flex gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={selectAllFields}
                  className="text-zinc-700 underline hover:text-zinc-950"
                >
                  Select all
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={deselectAllFields}
                  className="text-zinc-700 underline hover:text-zinc-950"
                >
                  Deselect all
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={resetToDefault}
                  className="text-zinc-700 underline hover:text-zinc-950"
                >
                  Default
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {FIELD_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-xs font-semibold text-zinc-500">{group.title}</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.fields.map((field) => (
                      <label
                        key={field.id}
                        className="flex items-center gap-2.5 text-xs text-zinc-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field.id)}
                          onChange={() => toggleField(field.id)}
                          className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                        />
                        {field.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={resetToDefault}
              className="text-xs font-semibold text-zinc-600 underline underline-offset-4 hover:text-zinc-950"
            >
              Reset filters
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating…
                  </>
                ) : (
                  `Download ${format.toUpperCase()}`
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
