"use client";

import React, { useState, useEffect, useTransition } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type {
  ListingTaxDTO,
  ReservationTaxReportItem,
  TaxCalculationResult,
  TaxInvoiceData,
  TaxJurisdictionDTO,
  TaxRegistrationDTO,
  TaxReportSummary,
  TaxRuleDTO,
  TaxType,
} from "@/lib/tax/types";

interface TaxesManagerProps {
  listingId: string;
  listingCity?: string | null;
  listingCountry?: string | null;
  setActiveSection: (s: string) => void;
}

type ActiveTab = "overview" | "registrations" | "simulator" | "reports";

export function TaxesManager({
  listingId,
  listingCity,
  listingCountry,
  setActiveSection,
}: TaxesManagerProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Core Data
  const [listingData, setListingData] = useState<any>(null);
  const [jurisdiction, setJurisdiction] = useState<TaxJurisdictionDTO | null>(null);
  const [systemRules, setSystemRules] = useState<TaxRuleDTO[]>([]);
  const [hostTaxes, setHostTaxes] = useState<ListingTaxDTO[]>([]);
  const [registrations, setRegistrations] = useState<TaxRegistrationDTO[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Array<{ taxType: string; message: string }>>([]);

  // Modals state
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<ListingTaxDTO | null>(null);
  const [taxForm, setTaxForm] = useState<{
    taxType: TaxType;
    customName: string;
    calculationMethod: any;
    rate: string;
    amount: string;
    taxableComponents: any[];
    remittanceResponsibility: any;
    longStayExemptionNights: string;
  }>({
    taxType: "OCCUPANCY_TAX",
    customName: "",
    calculationMethod: "PERCENTAGE",
    rate: "15",
    amount: "0",
    taxableComponents: ["BASE_PRICE", "CLEANING_FEE"],
    remittanceResponsibility: "HOST",
    longStayExemptionNights: "28",
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingTaxId, setDeletingTaxId] = useState<string | null>(null);

  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({
    taxType: "VAT",
    registrationNumber: "",
    businessName: "",
    businessAddress: "",
    documentUrl: "",
  });

  // Simulator state
  const [simulatorNights, setSimulatorNights] = useState(3);
  const [simulatorGuests, setSimulatorGuests] = useState(2);
  const [simulatorResult, setSimulatorResult] = useState<TaxCalculationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Reports state
  const [reportSummary, setReportSummary] = useState<TaxReportSummary | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<string>("ALL");

  // Invoice modal state
  const [selectedInvoice, setSelectedInvoice] = useState<TaxInvoiceData | null>(null);
  const [isInvoiceLoading, setIsInvoiceLoading] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Show transient toast
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // Fetch overview
  const loadOverview = async () => {
    if (!listingId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/listings/${listingId}/taxes`);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || "Failed to load tax settings");
      }
      setListingData(data.data.listing);
      setJurisdiction(data.data.jurisdiction);
      setSystemRules(data.data.systemRules || []);
      setHostTaxes(data.data.hostTaxes || []);
      setRegistrations(data.data.registrations || []);
      setDuplicateWarnings(data.data.duplicateWarnings || []);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [listingId]);

  // Load simulator preview
  const runSimulator = async () => {
    if (!listingId) return;
    setIsSimulating(true);
    try {
      const res = await fetch(
        `/api/v1/listings/${listingId}/taxes?action=preview&nights=${simulatorNights}&guests=${simulatorGuests}`
      );
      const data = await res.json();
      if (res.ok && data.data) {
        setSimulatorResult(data.data);
      }
    } catch (e) {
      console.error("Simulation failed", e);
    } finally {
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    if (activeTab === "simulator" && !simulatorResult && !isSimulating) {
      runSimulator();
    }
  }, [activeTab, simulatorNights, simulatorGuests]);

  // Load reports
  const loadReports = async () => {
    if (!listingId) return;
    setIsReportLoading(true);
    try {
      const params = new URLSearchParams({ listingId });
      if (reportPeriod === "THIS_YEAR") {
        const year = new Date().getFullYear();
        params.set("startDate", `${year}-01-01`);
        params.set("endDate", `${year}-12-31`);
      }
      const res = await fetch(`/api/v1/taxes/reports?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setReportSummary(data.data);
      }
    } catch (e) {
      console.error("Failed to load tax reports", e);
    } finally {
      setIsReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "reports") {
      loadReports();
    }
  }, [activeTab, reportPeriod]);

  // Handle View Invoice
  const handleViewInvoice = async (bookingId: string) => {
    setIsInvoiceLoading(true);
    setSelectedInvoice(null);
    try {
      const res = await fetch(`/api/v1/taxes/invoices/${bookingId}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        showError(data.error?.message || "Failed to generate tax invoice");
        return;
      }
      setSelectedInvoice(data.data);
    } catch (e: any) {
      showError(e.message || "Failed to load invoice");
    } finally {
      setIsInvoiceLoading(false);
    }
  };

  // Handle Export CSV
  const handleExportCSV = () => {
    if (!reportSummary || reportSummary.items.length === 0) {
      showError("No tax records available to export");
      return;
    }

    const headers = [
      "Booking ID",
      "Created At",
      "Tax Name",
      "Tax Type",
      "Taxable Base (SAR)",
      "Tax Amount (SAR)",
      "Remittance Responsibility",
      "Refunded Tax (SAR)",
    ];

    const rows = reportSummary.items.map((r: ReservationTaxReportItem) => [
      r.bookingId,
      new Date(r.createdAt).toISOString(),
      `"${r.taxName.replace(/"/g, '""')}"`,
      r.taxType,
      (r.taxableBase / 100).toFixed(2),
      (r.taxAmount / 100).toFixed(2),
      r.remittanceResponsibility,
      (r.refundedTax / 100).toFixed(2),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: (string | number)[]) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `homyz-tax-report-${listingId}-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess("Tax report exported as CSV");
  };

  // Open Add Tax Modal
  const handleOpenAddTax = () => {
    setEditingTax(null);
    setTaxForm({
      taxType: "OCCUPANCY_TAX",
      customName: "",
      calculationMethod: "PERCENTAGE",
      rate: "10",
      amount: "0",
      taxableComponents: ["BASE_PRICE", "CLEANING_FEE"],
      remittanceResponsibility: "HOST",
      longStayExemptionNights: "28",
    });
    setIsTaxModalOpen(true);
  };

  // Open Edit Tax Modal
  const handleOpenEditTax = (tax: ListingTaxDTO) => {
    setEditingTax(tax);
    setTaxForm({
      taxType: tax.taxType,
      customName: tax.customName || "",
      calculationMethod: tax.calculationMethod,
      rate: tax.rate !== null ? String(tax.rate) : "0",
      amount: tax.amount !== null ? String(Math.round(tax.amount / 100)) : "0",
      taxableComponents: tax.taxableComponents || ["BASE_PRICE"],
      remittanceResponsibility: tax.remittanceResponsibility,
      longStayExemptionNights: tax.longStayExemptionNights ? String(tax.longStayExemptionNights) : "",
    });
    setIsTaxModalOpen(true);
  };

  // Save Tax
  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const payload: any = {
          listingId,
          taxType: taxForm.taxType,
          customName: taxForm.customName.trim() || undefined,
          calculationMethod: taxForm.calculationMethod,
          taxableComponents: taxForm.taxableComponents,
          remittanceResponsibility: taxForm.remittanceResponsibility,
          longStayExemptionNights: taxForm.longStayExemptionNights ? parseInt(taxForm.longStayExemptionNights, 10) : undefined,
        };

        if (taxForm.calculationMethod === "PERCENTAGE") {
          payload.rate = parseFloat(taxForm.rate);
        } else {
          payload.amount = Math.round(parseFloat(taxForm.amount || "0") * 100);
        }

        const url = editingTax
          ? `/api/v1/listings/${listingId}/taxes/${editingTax.id}`
          : `/api/v1/listings/${listingId}/taxes`;

        const res = await fetch(url, {
          method: editingTax ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || "Failed to save tax");
        }

        showSuccess(editingTax ? "Tax settings updated" : "Custom tax added successfully");
        setIsTaxModalOpen(false);
        loadOverview();
      } catch (err: any) {
        showError(err.message || "Failed to save tax");
      }
    });
  };

  // Delete Tax
  const handleDeleteTax = async () => {
    if (!deletingTaxId) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/listings/${listingId}/taxes/${deletingTaxId}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || "Failed to delete tax");
        }
        showSuccess("Tax deleted successfully");
        setIsDeleteModalOpen(false);
        setDeletingTaxId(null);
        loadOverview();
      } catch (err: any) {
        showError(err.message || "Failed to delete tax");
      }
    });
  };

  // Save Tax Registration
  const handleSaveRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/taxes/registrations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taxType: registrationForm.taxType,
            registrationNumber: registrationForm.registrationNumber.trim(),
            businessName: registrationForm.businessName.trim() || undefined,
            businessAddress: registrationForm.businessAddress.trim() || undefined,
            documentUrl: registrationForm.documentUrl.trim() || undefined,
            jurisdictionId: jurisdiction?.id,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || "Failed to save tax registration");
        }

        showSuccess("Tax registration submitted for verification");
        setIsRegistrationModalOpen(false);
        loadOverview();
      } catch (err: any) {
        showError(err.message || "Failed to save tax registration");
      }
    });
  };

  const isPlatformHandlingTaxType = (taxType: string) => {
    return systemRules.some((r) => r.taxType === taxType && r.isActive);
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl pb-16 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveSection("description")}
            className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
            title="Back"
          >
            ‹
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#1F1F1F]">Taxes</h1>
            <p className="text-xs text-zinc-500 font-normal">
              Manage occupancy taxes, value-added taxes (VAT), and tax registration for this listing.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {errorMessage}
        </div>
      )}

      {/* Duplicate Tax Warnings */}
      {duplicateWarnings.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1 text-xs">
          <div className="font-semibold flex items-center gap-1.5 text-amber-950">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Duplicate Tax Notice
          </div>
          {duplicateWarnings.map((w, i) => (
            <p key={i} className="text-amber-800 leading-relaxed">
              {w.message}
            </p>
          ))}
        </div>
      )}

      {/* Detected Jurisdiction Banner */}
      <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-amber-50/20 p-5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100/70 border border-amber-200/80 flex items-center justify-center text-amber-800">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Determined Tax Jurisdiction
              </div>
              <div className="text-sm font-bold text-zinc-900">
                {jurisdiction?.name || "Detecting jurisdiction..."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Active System Collection
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-200/60 flex flex-wrap gap-4 text-xs text-zinc-600">
          <div>
            <span className="text-zinc-400">Listing Address: </span>
            <span className="font-medium text-zinc-800">
              {listingCity || "City"}, {listingCountry || "Country"}
            </span>
          </div>
          <div>
            <span className="text-zinc-400">Jurisdiction Region: </span>
            <span className="font-medium text-zinc-800">
              {jurisdiction?.name || "Local Tax Authority"}
            </span>
          </div>
          <div>
            <span className="text-zinc-400">Currency: </span>
            <span className="font-medium text-zinc-800">
              {jurisdiction?.currency || "SAR"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-200 gap-6 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeTab === "overview"
              ? "border-zinc-950 text-zinc-950"
              : "border-transparent text-zinc-400 hover:text-zinc-700"
          }`}
        >
          Taxes Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("registrations")}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeTab === "registrations"
              ? "border-zinc-950 text-zinc-950"
              : "border-transparent text-zinc-400 hover:text-zinc-700"
          }`}
        >
          Tax Registrations ({registrations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("simulator")}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeTab === "simulator"
              ? "border-zinc-950 text-zinc-950"
              : "border-transparent text-zinc-400 hover:text-zinc-700"
          }`}
        >
          Tax Simulator
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeTab === "reports"
              ? "border-zinc-950 text-zinc-950"
              : "border-transparent text-zinc-400 hover:text-zinc-700"
          }`}
        >
          Reports & Invoices
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* SECTION: Taxes We Collect and Remit (Platform Managed) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">Taxes we collect and remit</h2>
                <p className="text-xs text-zinc-500">
                  Homyz automatically calculates, collects from guests, and remits these taxes directly to tax authorities.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-100 px-2.5 py-1 rounded-full">
                System Managed
              </span>
            </div>

            {systemRules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
                No automatic platform taxes currently active for this jurisdiction.
              </div>
            ) : (
              <div className="grid gap-3">
                {systemRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-2xl border border-zinc-200/90 bg-white p-4.5 space-y-2.5 shadow-2xs hover:border-zinc-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-zinc-900">{rule.name}</h3>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60">
                            {rule.taxType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{rule.description}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-zinc-900">
                          {rule.calculationMethod === "PERCENTAGE"
                            ? `${rule.rate}%`
                            : `${((rule.amount || 0) / 100).toFixed(2)} SAR`}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {rule.calculationMethod === "PERCENTAGE"
                            ? "of taxable components"
                            : rule.calculationMethod === "AMOUNT_PER_NIGHT"
                            ? "per night"
                            : rule.calculationMethod === "AMOUNT_PER_GUEST_PER_NIGHT"
                            ? "per guest per night"
                            : "flat rate"}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between text-[11px] text-zinc-500 gap-2">
                      <div className="flex items-center gap-3">
                        <span>
                          Taxable base:{" "}
                          <strong className="text-zinc-700 font-medium">
                            {rule.taxableComponents.join(", ").toLowerCase().replace(/_/g, " ")}
                          </strong>
                        </span>
                        {rule.longStayExemptionNights && (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                            Exempt after {rule.longStayExemptionNights}+ nights
                          </span>
                        )}
                      </div>
                      <span className="text-zinc-400 italic">
                        Remitted by Homyz directly to {jurisdiction?.name || "Tax Authority"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION: Taxes You Collect (Host Managed) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">Taxes you collect</h2>
                <p className="text-xs text-zinc-500">
                  Custom municipal, tourism, or local taxes you are required to collect from guests and remit yourself.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddTax}
                className="rounded-full bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs px-4 py-2 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>+</span> Add custom tax
              </button>
            </div>

            {hostTaxes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center space-y-2 bg-zinc-50/50">
                <div className="w-10 h-10 mx-auto rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-zinc-800">No custom taxes added</div>
                <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                  Only add a tax here if your local municipality or government requires you to collect additional taxes that Homyz does not collect automatically.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {hostTaxes.map((tax) => (
                  <div
                    key={tax.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4.5 space-y-2.5 shadow-2xs hover:border-zinc-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-zinc-900">
                            {tax.customName || tax.taxType.replace(/_/g, " ")}
                          </h3>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                            {tax.taxType.replace(/_/g, " ")}
                          </span>
                          {!tax.isActive && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-200 text-zinc-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-1">
                          Remitted by: <strong className="text-zinc-700">{tax.remittanceResponsibility}</strong>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-zinc-900">
                          {tax.calculationMethod === "PERCENTAGE"
                            ? `${tax.rate}%`
                            : `${((tax.amount || 0) / 100).toFixed(2)} SAR`}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {tax.calculationMethod.replace(/_/g, " ").toLowerCase()}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                      <div>
                        Taxable on:{" "}
                        <span className="text-zinc-700 font-medium">
                          {tax.taxableComponents.join(", ").toLowerCase().replace(/_/g, " ")}
                        </span>
                        {tax.longStayExemptionNights && (
                          <span className="ml-2 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                            Exempt after {tax.longStayExemptionNights}+ nights
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditTax(tax)}
                          className="text-xs text-zinc-600 hover:text-zinc-950 font-semibold px-2.5 py-1 rounded hover:bg-zinc-100 transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingTaxId(tax.id);
                            setIsDeleteModalOpen(true);
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2.5 py-1 rounded hover:bg-rose-50 transition-all cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TAX REGISTRATIONS */}
      {activeTab === "registrations" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Tax Registrations & Identification</h2>
              <p className="text-xs text-zinc-500">
                Provide your VAT identification, GST number, or local municipal registration numbers for compliant invoicing.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setRegistrationForm({
                  taxType: "VAT",
                  registrationNumber: "",
                  businessName: "",
                  businessAddress: "",
                  documentUrl: "",
                });
                setIsRegistrationModalOpen(true);
              }}
              className="rounded-full bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs px-4 py-2 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>+</span> Add Tax ID
            </button>
          </div>

          {registrations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center space-y-2 bg-zinc-50/50">
              <div className="w-10 h-10 mx-auto rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <div className="text-xs font-semibold text-zinc-800">No tax identification on file</div>
              <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                If you are registered for VAT or local business taxes, adding your tax ID ensures that guest invoices display your legal tax credentials.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {registrations.map((reg) => (
                <div
                  key={reg.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {reg.taxType.replace(/_/g, " ")}
                      </div>
                      <div className="text-sm font-mono font-bold text-zinc-900 mt-0.5">
                        {reg.registrationNumber}
                      </div>
                    </div>

                    <div>
                      {reg.status === "VERIFIED" && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                          Verified
                        </span>
                      )}
                      {reg.status === "PENDING_VERIFICATION" && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60">
                          Pending Verification
                        </span>
                      )}
                      {reg.status === "REJECTED" && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200/60">
                          Rejected
                        </span>
                      )}
                      {reg.status === "UNVERIFIED" && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">
                          Unverified
                        </span>
                      )}
                    </div>
                  </div>

                  {(reg.businessName || reg.businessAddress) && (
                    <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-600 space-y-0.5">
                      {reg.businessName && <div>Legal Entity: <strong>{reg.businessName}</strong></div>}
                      {reg.businessAddress && <div>Registered Address: {reg.businessAddress}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TAX SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Interactive Tax & Payout Simulator</h2>
            <p className="text-xs text-zinc-500">
              Test different reservation scenarios to verify exactly how taxes are applied and calculated for both guest and host.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Inputs Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
              <h3 className="text-xs font-bold text-zinc-900 border-b border-zinc-100 pb-2">
                Reservation Parameters
              </h3>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-600">Length of Stay (Nights)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSimulatorNights((n) => Math.max(1, n - 1))}
                    className="w-8 h-8 rounded-xl border border-zinc-200 flex items-center justify-center text-sm font-bold hover:bg-zinc-50 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold text-zinc-900 w-10 text-center font-mono">
                    {simulatorNights}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSimulatorNights((n) => n + 1)}
                    className="w-8 h-8 rounded-xl border border-zinc-200 flex items-center justify-center text-sm font-bold hover:bg-zinc-50 cursor-pointer"
                  >
                    +
                  </button>
                  {simulatorNights >= 28 && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Long-stay exemption
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-600">Number of Guests</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSimulatorGuests((g) => Math.max(1, g - 1))}
                    className="w-8 h-8 rounded-xl border border-zinc-200 flex items-center justify-center text-sm font-bold hover:bg-zinc-50 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold text-zinc-900 w-10 text-center font-mono">
                    {simulatorGuests}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSimulatorGuests((g) => g + 1)}
                    className="w-8 h-8 rounded-xl border border-zinc-200 flex items-center justify-center text-sm font-bold hover:bg-zinc-50 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={runSimulator}
                  className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs py-2.5 transition-all cursor-pointer shadow-2xs"
                >
                  {isSimulating ? "Calculating..." : "Recalculate"}
                </button>
              </div>
            </div>

            {/* Simulation Results Breakdown */}
            <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
              <h3 className="text-xs font-bold text-zinc-900 border-b border-zinc-100 pb-2 flex items-center justify-between">
                <span>Calculated Quote & Payout</span>
                <span className="text-[10px] text-zinc-400 font-normal">Deterministic Engine Result</span>
              </h3>

              {simulatorResult ? (
                <div className="space-y-4 text-xs">
                  {/* Itemized Taxes */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Calculated Taxes ({simulatorResult.taxes.length})
                    </div>
                    {simulatorResult.taxes.length === 0 ? (
                      <p className="text-zinc-400 text-xs italic">No taxes apply to this reservation.</p>
                    ) : (
                      <div className="grid gap-2">
                        {simulatorResult.taxes.map((tax, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-xl border flex items-center justify-between ${
                              tax.isExempt
                                ? "bg-zinc-50 border-zinc-200/80 text-zinc-400"
                                : "bg-white border-zinc-200/80 text-zinc-800"
                            }`}
                          >
                            <div>
                              <div className="font-semibold flex items-center gap-2">
                                <span>{tax.taxName}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-100 text-zinc-600">
                                  {tax.remittanceResponsibility}
                                </span>
                                {tax.isExempt && (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                                    {tax.exemptionReason || "Exempt"}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Taxable base: SAR {(tax.taxableBase / 100).toFixed(2)}
                              </div>
                            </div>

                            <div className="font-bold font-mono">
                              {tax.isExempt ? "SAR 0.00" : `SAR ${(tax.taxAmount / 100).toFixed(2)}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Summary Totals */}
                  <div className="pt-3 border-t border-zinc-100 grid md:grid-cols-2 gap-4">
                    {/* Guest Pays */}
                    <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-1.5">
                      <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                        Guest Pays Total
                      </div>
                      <div className="text-lg font-bold text-amber-950 font-mono">
                        SAR {(simulatorResult.guestTotal / 100).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-amber-800 space-y-0.5 pt-1 border-t border-amber-200/40">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-medium">
                            SAR {((simulatorResult.payoutBreakdown.accommodationSubtotal + simulatorResult.payoutBreakdown.cleaningFee) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxes:</span>
                          <span className="font-medium">
                            SAR {(simulatorResult.taxTotal / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Host Receives */}
                    <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60 space-y-1.5">
                      <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                        Net Host Payout
                      </div>
                      <div className="text-lg font-bold text-emerald-950 font-mono">
                        SAR {(simulatorResult.payoutBreakdown.netHostPayout / 100).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-emerald-800 space-y-0.5 pt-1 border-t border-emerald-200/40">
                        <div className="flex justify-between">
                          <span>Accommodation + Cleaning:</span>
                          <span className="font-medium">
                            SAR {((simulatorResult.payoutBreakdown.accommodationSubtotal + simulatorResult.payoutBreakdown.cleaningFee) / 100).toFixed(2)}
                          </span>
                        </div>
                        {simulatorResult.payoutBreakdown.taxesCollectedForHost > 0 && (
                          <div className="flex justify-between">
                            <span>Host-remitted taxes:</span>
                            <span className="font-medium">
                              +SAR {(simulatorResult.payoutBreakdown.taxesCollectedForHost / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-rose-700">
                          <span>Platform Fee (3%):</span>
                          <span>
                            −SAR {(simulatorResult.payoutBreakdown.platformServiceFee / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-400 text-xs">
                  Calculating simulation...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REPORTS & INVOICES */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Tax Reports & Invoices</h2>
              <p className="text-xs text-zinc-500">
                Immutable reservation tax history, aggregated tax summaries, and downloadable invoices.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 outline-none shadow-2xs"
              >
                <option value="ALL">All Time</option>
                <option value="THIS_YEAR">This Calendar Year</option>
              </select>

              <button
                type="button"
                onClick={handleExportCSV}
                className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-semibold text-xs px-4 py-1.5 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>

          {/* Metric Tiles */}
          {reportSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-2xs">
                <div className="text-[11px] font-semibold text-zinc-400">Total Taxable Base</div>
                <div className="text-base font-bold text-zinc-900 font-mono mt-1">
                  SAR {(reportSummary.totalTaxableRevenue / 100).toFixed(2)}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-2xs">
                <div className="text-[11px] font-semibold text-zinc-400">Total Taxes Collected</div>
                <div className="text-base font-bold text-zinc-900 font-mono mt-1">
                  SAR {(reportSummary.totalTaxesCollected / 100).toFixed(2)}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-2xs">
                <div className="text-[11px] font-semibold text-zinc-400">Platform Remitted</div>
                <div className="text-base font-bold text-amber-700 font-mono mt-1">
                  SAR {(reportSummary.taxesRemittedByPlatform / 100).toFixed(2)}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-2xs">
                <div className="text-[11px] font-semibold text-zinc-400">Host Remitted</div>
                <div className="text-base font-bold text-emerald-700 font-mono mt-1">
                  SAR {(reportSummary.taxesPassedToHost / 100).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Reservations Tax Table */}
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold">
                  <tr>
                    <th className="p-3.5">Booking / Date</th>
                    <th className="p-3.5">Tax Name</th>
                    <th className="p-3.5">Taxable Base</th>
                    <th className="p-3.5">Tax Amount</th>
                    <th className="p-3.5">Responsibility</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {isReportLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-400">
                        Loading tax records...
                      </td>
                    </tr>
                  ) : !reportSummary || reportSummary.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-400">
                        No reservation tax records found for this listing.
                      </td>
                    </tr>
                  ) : (
                    reportSummary.items.map((rec: ReservationTaxReportItem) => (
                      <tr key={rec.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="p-3.5">
                          <div className="font-mono font-medium text-zinc-900">{rec.bookingId.slice(0, 8)}...</div>
                          <div className="text-[11px] text-zinc-400">
                            {new Date(rec.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-zinc-900">{rec.taxName}</div>
                          <div className="text-[10px] text-zinc-400 uppercase">{rec.taxType.replace(/_/g, " ")}</div>
                        </td>
                        <td className="p-3.5 font-mono">
                          SAR {(rec.taxableBase / 100).toFixed(2)}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-zinc-900">
                          SAR {(rec.taxAmount / 100).toFixed(2)}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.remittanceResponsibility === "PLATFORM"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-emerald-100 text-emerald-900"
                            }`}
                          >
                            {rec.remittanceResponsibility}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleViewInvoice(rec.bookingId)}
                            className="text-zinc-800 hover:text-zinc-950 font-semibold px-2.5 py-1 rounded hover:bg-zinc-100 transition-all cursor-pointer text-xs"
                          >
                            View Invoice
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT HOST TAX (Complies with AGENTS.md ModalOverlay)      */}
      {/* ========================================================================= */}
      {isTaxModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                {editingTax ? "Edit Custom Tax" : "Add Custom Tax"}
              </h3>
              <button
                type="button"
                onClick={() => setIsTaxModalOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs text-zinc-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTax} className="space-y-4 text-xs">
              {/* Tax Type */}
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Tax Type</label>
                <select
                  disabled={!!editingTax}
                  value={taxForm.taxType}
                  onChange={(e) => setTaxForm({ ...taxForm, taxType: e.target.value as TaxType })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                >
                  <option value="OCCUPANCY_TAX">Occupancy Tax</option>
                  <option value="TOURIST_TAX">Tourism Tax</option>
                  <option value="VAT">Value-Added Tax (VAT)</option>
                  <option value="CITY_TAX">City / Municipal Tax</option>
                  <option value="LODGING_TAX">Lodging Tax</option>
                  <option value="GST">Goods & Services Tax (GST)</option>
                  <option value="SALES_TAX">Sales Tax</option>
                  <option value="OTHER">Other Local Levy</option>
                </select>
                {isPlatformHandlingTaxType(taxForm.taxType) && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    Warning: Homyz already collects and remits this tax type for this jurisdiction. You cannot duplicate it.
                  </p>
                )}
              </div>

              {/* Custom Name */}
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Display Name for Guests (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. City Tourism Fee"
                  value={taxForm.customName}
                  onChange={(e) => setTaxForm({ ...taxForm, customName: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                />
              </div>

              {/* Calculation Method */}
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Calculation Method</label>
                <select
                  value={taxForm.calculationMethod}
                  onChange={(e) => setTaxForm({ ...taxForm, calculationMethod: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FLAT_PER_BOOKING">Flat Amount per Booking (SAR)</option>
                  <option value="AMOUNT_PER_NIGHT">Amount per Night (SAR)</option>
                  <option value="AMOUNT_PER_GUEST">Amount per Guest (SAR)</option>
                  <option value="AMOUNT_PER_GUEST_PER_NIGHT">Amount per Guest per Night (SAR)</option>
                </select>
              </div>

              {/* Rate or Amount */}
              {taxForm.calculationMethod === "PERCENTAGE" ? (
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-700">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    required
                    value={taxForm.rate}
                    onChange={(e) => setTaxForm({ ...taxForm, rate: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-700">Amount (SAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={taxForm.amount}
                    onChange={(e) => setTaxForm({ ...taxForm, amount: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                  />
                </div>
              )}

              {/* Taxable Components */}
              <div className="space-y-1.5 pt-1">
                <label className="font-semibold text-zinc-700">Taxable Reservation Components</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "BASE_PRICE", label: "Accommodation Subtotal" },
                    { id: "CLEANING_FEE", label: "Cleaning Fee" },
                    { id: "PET_FEE", label: "Pet Fee" },
                    { id: "EXTRA_GUEST_FEE", label: "Extra Guest Fee" },
                  ].map((comp) => (
                    <label key={comp.id} className="flex items-center gap-2 text-zinc-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxForm.taxableComponents.includes(comp.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setTaxForm((prev) => ({
                            ...prev,
                            taxableComponents: checked
                              ? [...prev.taxableComponents, comp.id]
                              : prev.taxableComponents.filter((c) => c !== comp.id),
                          }));
                        }}
                        className="rounded border-zinc-300"
                      />
                      <span>{comp.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Long-Stay Exemption */}
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Long-Stay Exemption (Nights)</label>
                <input
                  type="number"
                  placeholder="e.g. 28 (leave blank if no exemption)"
                  value={taxForm.longStayExemptionNights}
                  onChange={(e) => setTaxForm({ ...taxForm, longStayExemptionNights: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                />
                <p className="text-[10px] text-zinc-400">
                  Stays equal to or longer than this length will automatically be exempt from this tax.
                </p>
              </div>

              {/* Remittance Responsibility */}
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Remittance Responsibility</label>
                <select
                  value={taxForm.remittanceResponsibility}
                  onChange={(e) => setTaxForm({ ...taxForm, remittanceResponsibility: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                >
                  <option value="HOST">Host (Paid directly to host payout for local remittance)</option>
                  <option value="THIRD_PARTY">Third Party / Property Manager</option>
                  <option value="MANUAL">Manual Offline Collection</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsTaxModalOpen(false)}
                  className="rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-5 py-2.5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || (!editingTax && isPlatformHandlingTaxType(taxForm.taxType))}
                  className="rounded-full bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white font-semibold px-6 py-2.5 transition-all cursor-pointer shadow-2xs"
                >
                  {isPending ? "Saving..." : editingTax ? "Update Tax" : "Save Tax"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DELETE CONFIRMATION (Complies with AGENTS.md ModalOverlay)       */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-zinc-900">Delete Custom Tax?</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Are you sure you want to delete this custom tax? It will no longer be collected on future reservations. Past reservations will preserve their immutable tax snapshots.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-xs px-5 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleDeleteTax}
                className="rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-5 py-2.5 transition-all cursor-pointer shadow-2xs"
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TAX REGISTRATION (Complies with AGENTS.md ModalOverlay)          */}
      {/* ========================================================================= */}
      {isRegistrationModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900">Add Tax Identification</h3>
              <button
                type="button"
                onClick={() => setIsRegistrationModalOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs text-zinc-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRegistration} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Tax Registration Type</label>
                <select
                  value={registrationForm.taxType}
                  onChange={(e) => setRegistrationForm({ ...registrationForm, taxType: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                >
                  <option value="VAT">VAT Registration Number (ZATCA / GCC)</option>
                  <option value="GST">GST Number</option>
                  <option value="TOURIST_TAX">Municipal Short-Term Rental License</option>
                  <option value="OCCUPANCY_TAX">Local Tourism Board Registration</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Tax ID / Registration Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 300123456700003"
                  value={registrationForm.registrationNumber}
                  onChange={(e) => setRegistrationForm({ ...registrationForm, registrationNumber: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Legal Business Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Desert Oasis Hospitality LLC"
                  value={registrationForm.businessName}
                  onChange={(e) => setRegistrationForm({ ...registrationForm, businessName: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-700">Registered Address (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Olaya St, Riyadh 12211, Saudi Arabia"
                  value={registrationForm.businessAddress}
                  onChange={(e) => setRegistrationForm({ ...registrationForm, businessAddress: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsRegistrationModalOpen(false)}
                  className="rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-5 py-2.5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-full bg-zinc-950 hover:bg-zinc-800 text-white font-semibold px-6 py-2.5 transition-all cursor-pointer shadow-2xs"
                >
                  {isPending ? "Submitting..." : "Submit Registration"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: OFFICIAL TAX INVOICE (Complies with AGENTS.md ModalOverlay)       */}
      {/* ========================================================================= */}
      {selectedInvoice && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto font-sans">
            {/* Invoice Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 pb-6">
              <div>
                <div className="text-xl font-black tracking-tight text-zinc-950 flex items-center gap-2">
                  <span>HOMYZ</span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
                    Tax Invoice
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Invoice Number: <strong className="text-zinc-900 font-mono">{selectedInvoice.invoiceNumber}</strong>
                </div>
                <div className="text-xs text-zinc-500">
                  Issue Date: <strong className="text-zinc-900">{selectedInvoice.issueDate}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-xs px-4 py-2 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-xs text-zinc-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Parties Details */}
            <div className="grid grid-cols-2 gap-6 text-xs border-b border-zinc-200 pb-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Host / Supplier</div>
                <div className="font-bold text-zinc-900 mt-1">{selectedInvoice.supplier.name}</div>
                {selectedInvoice.supplier.taxId && (
                  <div className="text-zinc-600 font-mono text-[11px] mt-0.5">
                    VAT / Tax ID: {selectedInvoice.supplier.taxId}
                  </div>
                )}
                {selectedInvoice.supplier.address && (
                  <div className="text-zinc-500 mt-0.5">{selectedInvoice.supplier.address}</div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Guest / Customer</div>
                <div className="font-bold text-zinc-900 mt-1">{selectedInvoice.guest.name}</div>
                <div className="text-zinc-500 mt-0.5">{selectedInvoice.guest.email}</div>
                <div className="text-zinc-500 mt-1">
                  Property: <strong className="text-zinc-700">{selectedInvoice.property.title}</strong>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full text-xs text-left">
              <thead className="border-b border-zinc-200 text-zinc-400 font-semibold">
                <tr>
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Amount (SAR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {selectedInvoice.lineItems.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2.5 font-medium">{item.description}</td>
                    <td className="py-2.5 text-right font-mono">{(item.total / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Taxes Breakdown */}
            <div className="border-t border-zinc-200 pt-4 space-y-2 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Itemized Tax Breakdown</div>
              {selectedInvoice.taxBreakdown.map((tb, i) => (
                <div key={i} className="flex items-center justify-between text-zinc-600">
                  <span>
                    {tb.taxName} {tb.rate ? `(${tb.rate}%)` : ""}
                  </span>
                  <span className="font-mono font-medium">SAR {(tb.taxAmount / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-zinc-300 pt-4 space-y-1.5 text-xs text-right">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal before taxes:</span>
                <span className="font-mono font-medium">SAR {(selectedInvoice.subtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Total Taxes & Fees:</span>
                <span className="font-mono font-medium">SAR {(selectedInvoice.taxTotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-zinc-950 pt-2 border-t border-zinc-200">
                <span>Grand Total Paid:</span>
                <span className="font-mono">SAR {(selectedInvoice.grandTotal / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

