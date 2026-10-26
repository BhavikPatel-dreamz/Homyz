"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { HostTaxDocumentDTO } from "@/services/host-tax.service";
import {
  SettingsStatusBadge,
  FileTextIcon,
  DownloadIcon,
  BuildingBankIcon,
  ReceiptTaxIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  ExternalLinkIcon,
  XIcon,
} from "@/components/host/account-settings";

interface TaxDocumentsManagerProps {
  hostId: string;
  initialDocuments: HostTaxDocumentDTO[];
}

export function TaxDocumentsManager({
  hostId,
  initialDocuments,
}: TaxDocumentsManagerProps) {
  const [documents, setDocuments] = useState<HostTaxDocumentDTO[]>(initialDocuments);
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Generate Summary Modal State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateYear, setGenerateYear] = useState<number>(new Date().getFullYear());
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Available years from documents + current and prior 3 years
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    new Set([
      ...documents.map((d) => d.taxYear),
      currentYear,
      currentYear - 1,
      currentYear - 2,
    ]),
  ).sort((a, b) => b - a);

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    if (selectedYear !== "ALL" && doc.taxYear.toString() !== selectedYear) {
      return false;
    }
    if (selectedType !== "ALL" && doc.documentType !== selectedType) {
      return false;
    }
    return true;
  });

  const handleGenerateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/v1/host/tax-documents/annual-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: generateYear }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to generate tax summary.");
      }

      const generatedDoc: HostTaxDocumentDTO = data.data;

      // Update state: replace if exists or prepend
      setDocuments((prev) => {
        const exists = prev.some((d) => d.id === generatedDoc.id);
        if (exists) {
          return prev.map((d) => (d.id === generatedDoc.id ? generatedDoc : d));
        }
        return [generatedDoc, ...prev];
      });

      setSuccessMsg(`Successfully generated ${generateYear} Annual Tax Summary!`);
      setIsGenerateModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while generating document.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "PDF";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case "ANNUAL_TAX_SUMMARY":
        return { label: "Annual Summary", variant: "info" as const };
      case "BOOKING_TAX_INVOICE":
        return { label: "Booking Invoice", variant: "neutral" as const };
      case "VAT_CERTIFICATE":
        return { label: "VAT Certificate", variant: "success" as const };
      default:
        return { label: type.replace(/_/g, " "), variant: "neutral" as const };
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
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
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
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

      {/* Main Container */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-950">
              Tax Documents & Statements
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Review and download annual tax summaries, VAT reports, and reservation tax invoices.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setIsGenerateModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-zinc-800"
          >
            <FileTextIcon size={16} />
            <span>Generate Annual Summary</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-zinc-100 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Tax Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs focus:border-zinc-900 focus:outline-none"
            >
              <option value="ALL">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr.toString()}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs focus:border-zinc-900 focus:outline-none"
            >
              <option value="ALL">All Document Types</option>
              <option value="ANNUAL_TAX_SUMMARY">Annual Tax Summary</option>
              <option value="BOOKING_TAX_INVOICE">Booking Tax Invoice</option>
              <option value="VAT_CERTIFICATE">VAT Certificate</option>
            </select>
          </div>

          <span className="ml-auto text-xs text-zinc-400">
            {filteredDocuments.length} document{filteredDocuments.length === 1 ? "" : "s"} found
          </span>
        </div>

        {/* Documents Table / Card List */}
        <div className="mt-6">
          {filteredDocuments.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {filteredDocuments.map((doc) => {
                const badge = getDocTypeBadge(doc.documentType);
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between hover:bg-zinc-50/50 rounded-2xl px-3 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                        <FileTextIcon size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-zinc-950">
                            {doc.title}
                          </h3>
                          <SettingsStatusBadge label={badge.label} variant={badge.variant} />
                          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-600">
                            {doc.fileFormat.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          Tax Year {doc.taxYear}
                          {doc.description ? ` • ${doc.description}` : ""}
                          {doc.fileSize ? ` • ${formatFileSize(doc.fileSize)}` : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          Issued {new Date(doc.generatedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <a
                        href={`/api/v1/host/tax-documents/${doc.id}/download`}
                        download
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:border-zinc-300 hover:bg-zinc-50"
                      >
                        <DownloadIcon size={14} className="text-zinc-600" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 p-8 text-center">
              <FileTextIcon size={36} className="mx-auto text-zinc-400" />
              <h3 className="mt-3 text-sm font-semibold text-zinc-900">
                No tax documents match your filters
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">
                You can generate an Annual Tax Summary for any tax year, or download invoices for completed reservations.
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(true)}
                  className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-zinc-800 transition"
                >
                  Generate Tax Summary
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guidance Notice */}
      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-5 text-xs text-zinc-600">
        <div className="flex items-start gap-3">
          <InfoIcon size={18} className="mt-0.5 shrink-0 text-zinc-500" />
          <div className="space-y-1">
            <p className="font-semibold text-zinc-800">
              Tax Document Specifications & Compliance
            </p>
            <p className="leading-relaxed">
              Annual Tax Summaries aggregate gross reservation receipts, host service fees, and applicable tax collections for calendar years. These documents are generated for your accounting and filing records. For booking-level invoices with VAT breakdowns, records are generated upon reservation completion.
            </p>
          </div>
        </div>
      </div>

      {/* Generate Modal */}
      {isGenerateModalOpen && (
        <ModalOverlay
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs"
          onClose={() => setIsGenerateModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-tax-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col w-full max-w-md max-h-[min(90vh,600px)] rounded-3xl border border-zinc-200 bg-white shadow-2xl overflow-hidden"
          >
            {/* Pinned Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-zinc-100 px-6 py-5 bg-white">
              <h3 id="generate-tax-modal-title" className="text-base font-bold text-zinc-950">
                Generate Annual Tax Summary
              </h3>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                aria-label="Close dialog"
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition cursor-pointer"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="generate-tax-summary-form" onSubmit={handleGenerateSummary} className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-800">
                  Select Tax Year
                </label>
                <select
                  value={generateYear}
                  onChange={(e) => setGenerateYear(parseInt(e.target.value, 10))}
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-900 shadow-2xs focus:border-zinc-900 focus:outline-none"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} Calendar Year (Jan 1 – Dec 31)
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-zinc-500">
                  Includes all reservations completed between January 1 and December 31 of {generateYear}.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
                <p className="font-medium">Instant PDF Generation</p>
                <p className="mt-0.5 text-amber-800">
                  The summary PDF will be compiled and immediately saved to your Tax Documents repository for download.
                </p>
              </div>
            </form>

            {/* Pinned Footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4 bg-zinc-50/80">
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                disabled={actionLoading}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="generate-tax-summary-form"
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? "Generating..." : "Generate PDF Summary"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

