"use client";

import React, { useState, useEffect } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type {
  ListingTaxDTO,
  TaxJurisdictionDTO,
  TaxRegistrationDTO,
  TaxRuleDTO,
  TaxType,
  TaxCalculationMethod,
  TaxableComponent,
} from "@/lib/tax/types";

const TAXABLE_BASE_OPTIONS: { value: TaxableComponent; label: string }[] = [
  { value: "BASE_PRICE", label: "Base price" },
  { value: "MANAGEMENT_FEE", label: "Management fee" },
  { value: "COMMUNITY_FEE", label: "Community fee" },
  { value: "LINEN_FEE", label: "Linen fee" },
  { value: "RESORT_FEE", label: "Resort fee" },
  { value: "CLEANING_FEE", label: "Cleaning fee" },
  { value: "PET_FEE", label: "Pet fee" },
];

interface TaxesManagerProps {
  listingId: string;
  listingCity?: string | null;
  listingCountry?: string | null;
  setActiveSection: (s: any) => void;
}

export function TaxesManager({
  listingId,
  listingCity,
  listingCountry,
  setActiveSection,
}: TaxesManagerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Overview data
  const [jurisdiction, setJurisdiction] = useState<TaxJurisdictionDTO | null>(null);
  const [systemRules, setSystemRules] = useState<TaxRuleDTO[]>([]);
  const [hostTaxes, setHostTaxes] = useState<ListingTaxDTO[]>([]);
  const [registrations, setRegistrations] = useState<TaxRegistrationDTO[]>([]);

  // "Add a tax" modal state
  const [isAddTaxModalOpen, setIsAddTaxModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<ListingTaxDTO | null>(null);

  // Form Fields
  const [taxName, setTaxName] = useState<string>("");
  const [taxType, setTaxType] = useState<string>("");
  const [rateMode, setRateMode] = useState<"Fixed" | "Percentage">("Fixed");
  const [taxRate, setTaxRate] = useState<string>("");
  const [taxableComponents, setTaxableComponents] = useState<TaxableComponent[]>(["BASE_PRICE"]);
  const [maximumAmountPerPersonPerNight, setMaximumAmountPerPersonPerNight] = useState<string>("");
  const [partialStayExemption, setPartialStayExemption] = useState<string>("");
  const [fullStayExemption, setFullStayExemption] = useState<string>("");
  const [registrationNumber, setRegistrationNumber] = useState<string>("");
  const [termsAgreed, setTermsAgreed] = useState<boolean>(false);

  // Form validation & submission state
  const [formSubmitted, setFormSubmitted] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modals & Drawers state (ModalOverlay compliance)
  const [learnMoreTopic, setLearnMoreTopic] = useState<
    "platform_taxes" | "host_taxes" | "add_tax" | "partial_stay" | "full_stay" | null
  >(null);
  const [deletingTaxId, setDeletingTaxId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [viewingRegistration, setViewingRegistration] = useState<TaxRegistrationDTO | null>(null);
  const [viewingInvoiceModal, setViewingInvoiceModal] = useState<boolean>(false);

  // Helper toasts
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 6000);
  };

  // Load listing taxes overview
  const loadOverview = async () => {
    if (!listingId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Always request a fresh overview. The tax POST/PATCH has just changed
      // server state and a cached GET would leave the added tax off this list.
      const res = await fetch(`/api/v1/listings/${listingId}/taxes`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to load tax settings");
      }
      const data = json.data;
      setJurisdiction(data.jurisdiction || null);
      setSystemRules(data.systemRules || []);
      setHostTaxes(data.hostTaxes || []);
      setRegistrations(data.registrations || []);

      // If registrations exist and input is empty, prefill with first registration
      if (data.registrations && data.registrations.length > 0 && !registrationNumber) {
        setRegistrationNumber(data.registrations[0].registrationNumber);
      }
    } catch (err: any) {
      console.error("Error fetching tax overview:", err);
      showError(err.message || "Could not load tax overview");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [listingId]);

  // Open "Add a tax" modal
  const handleOpenAddTax = () => {
    setEditingTax(null);
    setTaxName("");
    setTaxType("");
    setRateMode("Fixed");
    setTaxRate("");
    setTaxableComponents(["BASE_PRICE"]);
    setMaximumAmountPerPersonPerNight("");
    setPartialStayExemption("");
    setFullStayExemption("");
    setTermsAgreed(false);
    setFormSubmitted(false);
    setIsAddTaxModalOpen(true);
  };

  // Open "Edit tax" modal
  const handleEditTax = (tax: ListingTaxDTO) => {
    setEditingTax(tax);
    setTaxName(tax.customName || formatTaxTypeName(tax.taxType));
    const methodStr = formatCalculationMethod(tax.calculationMethod);
    setTaxType(methodStr);
    const isPct = tax.calculationMethod === "PERCENTAGE";
    setRateMode(isPct ? "Percentage" : "Fixed");
    setTaxRate(isPct ? String(tax.rate ?? "") : String((tax.amount ?? 0) / 100));
    setTaxableComponents(tax.taxableComponents);
    setMaximumAmountPerPersonPerNight(
      tax.maximumAmountPerPersonPerNight ? String(tax.maximumAmountPerPersonPerNight / 100) : "",
    );
    setFullStayExemption(
      tax.fullStayExemptionNights || tax.longStayExemptionNights
        ? String(tax.fullStayExemptionNights || tax.longStayExemptionNights)
        : "",
    );
    setPartialStayExemption(tax.partialStayExemptionNights ? String(tax.partialStayExemptionNights) : "");
    setTermsAgreed(true);
    setFormSubmitted(false);
    setIsAddTaxModalOpen(true);
  };

  const handleCancel = () => {
    setIsAddTaxModalOpen(false);
    setEditingTax(null);
    setFormSubmitted(false);
  };

  // Synchronize rateMode based on TaxType selection
  const handleTaxTypeChange = (selected: string) => {
    setTaxType(selected);
    if (selected === "Percentage per booking") {
      setRateMode("Percentage");
    } else if (selected) {
      setRateMode("Fixed");
    }
  };

  const toggleTaxableComponent = (component: TaxableComponent) => {
    setTaxableComponents((current) => {
      if (current.includes(component)) {
        return current.length === 1 ? current : current.filter((item) => item !== component);
      }
      return [...current, component];
    });
  };

  // Save handler
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormSubmitted(true);

    if (
      !taxName ||
      !taxType ||
      !taxRate ||
      !registrationNumber ||
      !termsAgreed ||
      (taxType === "Percentage per booking" && taxableComponents.length === 0)
    ) {
      return;
    }

    const numericRate = parseFloat(taxRate);
    if (isNaN(numericRate) || numericRate <= 0) {
      showError("Please enter a valid numeric tax rate or amount");
      return;
    }

    const normalizedRegistrationNumber = registrationNumber.trim();
    if (!/^[A-Za-z0-9\-\s]{4,50}$/.test(normalizedRegistrationNumber)) {
      showError("Enter a valid tax registration number (at least 4 letters or numbers)");
      return;
    }

    const mappedTaxType: TaxType = mapNameToTaxType(taxName);
    const mappedCalcMethod: TaxCalculationMethod = mapTypeToCalcMethod(taxType);
    const isPlatformManaged = systemRules.some(
      (rule) => rule.taxType === mappedTaxType && rule.isActive,
    );
    if (isPlatformManaged) {
      showError("Homyz already collects and submits this tax for your listing location.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // Map UI values to API schemas.
      const payload: any = {
        listingId,
        taxType: mappedTaxType,
        customName: taxName,
        calculationMethod: mappedCalcMethod,
        rate: mappedCalcMethod === "PERCENTAGE" ? numericRate : null,
        amount: mappedCalcMethod !== "PERCENTAGE" ? Math.round(numericRate * 100) : null,
        // Taxable-base checkboxes only affect a percentage calculation. Fixed
        // taxes have no percentage base, so keep their stored value neutral.
        taxableComponents:
          mappedCalcMethod === "PERCENTAGE" ? taxableComponents : ["BASE_PRICE"],
        remittanceResponsibility: "HOST",
        maximumAmountPerPersonPerNight: maximumAmountPerPersonPerNight
          ? Math.round(parseFloat(maximumAmountPerPersonPerNight) * 100)
          : null,
        partialStayExemptionNights: partialStayExemption ? parseInt(partialStayExemption, 10) : null,
        fullStayExemptionNights: fullStayExemption ? parseInt(fullStayExemption, 10) : null,
        // Retain compatibility with bookings that currently use this field to
        // determine a full-stay exemption.
        longStayExemptionNights: fullStayExemption ? parseInt(fullStayExemption, 10) : null,
      };

      // The registration field is required by this form. Save it first and
      // inspect its API response instead of treating a failed request as a
      // successful tax save. The endpoint is an upsert, so retrying is safe.
      const registrationRes = await fetch(`/api/v1/taxes/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxType: mappedTaxType,
          registrationNumber: normalizedRegistrationNumber,
          jurisdictionId: jurisdiction?.id,
        }),
      });
      const registrationJson = await registrationRes.json();
      if (!registrationRes.ok || registrationJson.error) {
        throw new Error(registrationJson.error?.message || "Failed to save tax registration");
      }

      const endpoint = editingTax
        ? `/api/v1/listings/${listingId}/taxes/${editingTax.id}`
        : `/api/v1/listings/${listingId}/taxes`;
      const method = editingTax ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to save tax");
      }

      showSuccess(editingTax ? "Tax updated successfully" : "Tax added successfully");
      setIsAddTaxModalOpen(false);
      setEditingTax(null);
      await loadOverview();
    } catch (err: any) {
      console.error("Save tax error:", err);
      showError(err.message || "Failed to save tax");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete tax handler
  const confirmDeleteTax = async () => {
    if (!deletingTaxId) return;
    try {
      const res = await fetch(`/api/v1/listings/${listingId}/taxes/${deletingTaxId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to delete tax");
      }
      showSuccess("Tax removed successfully");
      setIsDeleteModalOpen(false);
      setDeletingTaxId(null);
      await loadOverview();
    } catch (err: any) {
      showError(err.message || "Failed to delete tax");
    }
  };

  // Determine platform taxes to display with checkmarks
  const getPlatformTaxes = () => {
    if (systemRules && systemRules.length > 0) {
      return systemRules.map((rule) => {
        const countryCode = jurisdiction?.country || listingCountry || "In";
        const regionCode = jurisdiction?.region || "Gujarat (in-gj)";
        return {
          id: rule.id,
          label: `Standard Rate - ${rule.name} (${countryCode} - ${regionCode})`,
        };
      });
    }

    // High fidelity fallback matching screenshot reference
    const country = (listingCountry || "").toLowerCase();
    if (country.includes("saudi") || country === "sa") {
      return [{ id: "sa-vat", label: "Standard Rate - VAT (SA)" }];
    }
    if (country.includes("united arab") || country === "ae") {
      return [{ id: "ae-vat", label: "Standard Rate - VAT (AE)" }];
    }
    if (country.includes("united kingdom") || country === "gb") {
      return [{ id: "gb-vat", label: "Standard Rate - VAT (GB)" }];
    }

    // Default reference items (matching India / screenshot)
    return [
      { id: "cgst", label: "Standard Rate - CGST (In - Gujarat (in-gj))" },
      { id: "sgst", label: "Standard Rate - SGST (In - Gujarat (in-gj))" },
    ];
  };

  const platformTaxes = getPlatformTaxes();

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Toast Messages */}
      {successMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-5 right-5 z-50 bg-rose-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMessage}
        </div>
      )}

      {/* Main Section Content (Renders in Main Column alongside EditorSidebar) */}
      <div className="space-y-6">
        {/* Back Button & Title */}
        <div>
          <button
            type="button"
            onClick={() => setActiveSection("propertyType")}
            className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 transition-colors mb-4 cursor-pointer"
            aria-label="Back to listing editor"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <h1 className="text-2xl sm:text-[32px] font-bold text-[#1F1F1F] tracking-tight leading-tight">
            Taxes
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1.5 leading-relaxed">
            Homyz automatically submits some taxes, and you can add other taxes you need to submit.
          </p>
        </div>

        {/* CARD 1: Taxes Homyz Submits */}
        <div className="border border-[#DDDDDD] rounded-2xl p-6 bg-white shadow-2xs">
          <h2 className="text-sm font-semibold text-zinc-900">Taxes Homyz submits</h2>
          <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
            We&apos;ll collect these taxes from guests on your behalf and submit payment to the designated tax authority.{" "}
            <button
              type="button"
              onClick={() => setLearnMoreTopic("platform_taxes")}
              className="underline font-normal text-zinc-900 hover:text-black cursor-pointer"
            >
              Learn more
            </button>
          </p>

          <div className="mt-4 space-y-2.5">
            {platformTaxes.map((tax) => (
              <div key={tax.id} className="flex items-center gap-2.5 text-xs text-zinc-900">
                <svg
                  className="w-4 h-4 text-zinc-900 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{tax.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 2: Add taxes you'll submit */}
        <div className="border border-[#DDDDDD] rounded-2xl p-6 bg-white shadow-2xs">
          <h2 className="text-sm font-semibold text-zinc-900">Add taxes you&apos;ll submit</h2>
          <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
            We&apos;ll collect these taxes from guests on your behalf and pass the funds on to you. You must submit payment to the correct tax authority.{" "}
            <button
              type="button"
              onClick={() => setLearnMoreTopic("host_taxes")}
              className="underline font-normal text-zinc-900 hover:text-black cursor-pointer"
            >
              Learn more
            </button>
          </p>

          {/* If host taxes already added, show list */}
          {hostTaxes.length > 0 && (
            <div className="mt-4 space-y-3">
              {hostTaxes.map((tax) => (
                <div
                  key={tax.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-zinc-900">
                      {tax.customName || formatTaxTypeName(tax.taxType)}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      {tax.calculationMethod === "PERCENTAGE"
                        ? `${tax.rate}% per booking`
                        : `${((tax.amount || 0) / 100).toFixed(2)} ${jurisdiction?.currency || "SAR"} (${tax.calculationMethod.toLowerCase().replace(/_/g, " ")})`}
                      {tax.longStayExemptionNights && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                          Exempt after {tax.longStayExemptionNights} nights
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditTax(tax)}
                      className="px-2.5 py-1 text-xs font-medium text-zinc-700 hover:text-black hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingTaxId(tax.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenAddTax}
            className="mt-4 px-4 py-2 border border-black rounded-lg text-xs font-semibold text-black hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            Add a tax
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: Add or edit a tax                                      */}
      {/* ============================================================ */}
      {isAddTaxModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="tax-modal-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* Top Close Header */}
            <div className="p-6 sm:p-8 lg:p-10 overflow-y-auto flex-1">
              <div className="flex items-center justify-between pb-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-black transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Title & Subtitle */}
              <h2 id="tax-modal-title" className="text-2xl font-semibold text-zinc-900 tracking-tight">
                {editingTax ? "Edit tax" : "Add a tax"}
              </h2>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                You can add one or more taxes to apply to your listing.{" "}
                <button
                  type="button"
                  onClick={() => setLearnMoreTopic("add_tax")}
                  className="underline font-normal text-zinc-900 hover:text-black cursor-pointer"
                >
                  Learn more
                </button>
              </p>

              <form onSubmit={handleSave} className="mt-6 space-y-6">
                {/* 1. Tax name */}
                <div>
                  <label htmlFor="tax-name-select" className="block text-xs font-semibold text-zinc-900 mb-1.5">
                    Tax name
                  </label>
                  <div className="relative">
                    <select
                      id="tax-name-select"
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                      className={`w-full appearance-none rounded-lg border px-3.5 py-3 text-xs text-zinc-900 bg-white focus:outline-none transition-colors ${
                        formSubmitted && !taxName
                          ? "border-[#C13515] ring-1 ring-[#C13515]"
                          : "border-[#B0B0B0] hover:border-black focus:border-black"
                      }`}
                    >
                      <option value="">Select</option>
                      <option value="Hotel tax">Hotel tax</option>
                      <option value="Lodging tax">Lodging tax</option>
                      <option value="Room tax">Room tax</option>
                      <option value="Tourist tax">Tourist tax</option>
                      <option value="Transient Occupancy Tax">Transient Occupancy Tax</option>
                      <option value="Sales tax">Sales tax</option>
                      <option value="VAT/GST">VAT/GST</option>
                      <option value="Tourism Assessment/Fee">Tourism Assessment/Fee</option>
                      <option value="Amusement tax">Amusement tax</option>
                      <option value="City tax">City tax</option>
                      <option value="Other local tax">Other local tax</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {formSubmitted && !taxName && (
                    <p className="text-[11px] text-[#C13515] font-medium flex items-center gap-1 mt-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Required
                    </p>
                  )}
                </div>

                {/* 2. Tax type */}
                <div>
                  <label htmlFor="tax-type-select" className="block text-xs font-semibold text-zinc-900 mb-1.5">
                    Tax type
                  </label>
                  <div className="relative">
                    <select
                      id="tax-type-select"
                      value={taxType}
                      onChange={(e) => handleTaxTypeChange(e.target.value)}
                      className={`w-full appearance-none rounded-lg border px-3.5 py-3 text-xs text-zinc-900 bg-white focus:outline-none transition-colors ${
                        formSubmitted && !taxType
                          ? "border-[#C13515] ring-1 ring-[#C13515]"
                          : "border-[#B0B0B0] hover:border-black focus:border-black"
                      }`}
                    >
                      <option value="">Select</option>
                      <option value="Per guest">Per guest</option>
                      <option value="Per guest, per night">Per guest, per night</option>
                      <option value="Per night">Per night</option>
                      <option value="Percentage per booking">Percentage per booking</option>
                      <option value="Per booking">Per booking</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {formSubmitted && !taxType && (
                    <p className="text-[11px] text-[#C13515] font-medium flex items-center gap-1 mt-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Required
                    </p>
                  )}
                </div>

                {/* 3. Tax rate (Stacked box exactly like screenshot) */}
                <div>
                  <label htmlFor="tax-rate-input" className="block text-xs font-semibold text-zinc-900 mb-1.5">
                    Tax rate
                  </label>
                  <div
                    className={`rounded-lg border overflow-hidden ${
                      formSubmitted && (!taxRate || parseFloat(taxRate) <= 0)
                        ? "border-[#C13515]"
                        : "border-[#B0B0B0]"
                    }`}
                  >
                    {/* Top sub-segment */}
                    <div className="bg-[#F7F7F7] border-b border-[#E5E5E5] px-3.5 py-2">
                      <span className="text-[10px] text-zinc-500 block leading-none">Select</span>
                      <span className="text-xs font-normal text-zinc-800 leading-tight">
                        {rateMode}
                      </span>
                    </div>
                    {/* Bottom input */}
                    <div className="p-1">
                      <input
                        id="tax-rate-input"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={rateMode === "Percentage" ? "10 (%)" : "0.00 (Amount)"}
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs text-zinc-900 focus:outline-none bg-transparent"
                      />
                    </div>
                  </div>
                  {formSubmitted && (!taxRate || parseFloat(taxRate) <= 0) && (
                    <p className="text-[11px] text-[#C13515] font-medium flex items-center gap-1 mt-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Required
                    </p>
                  )}
                </div>

                {/* Taxable base applies only to percentage calculations. */}
                {taxType === "Percentage per booking" && (
                  <fieldset>
                    <legend className="block text-xs font-semibold text-zinc-900 mb-2">Taxable base</legend>
                    <div className="space-y-2">
                      {TAXABLE_BASE_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-center justify-between gap-3 text-xs text-zinc-700 cursor-pointer">
                          <span>{option.label}</span>
                          <input
                            type="checkbox"
                            checked={taxableComponents.includes(option.value)}
                            onChange={() => toggleTaxableComponent(option.value)}
                            className="h-4 w-4 rounded border-zinc-300 accent-black cursor-pointer"
                          />
                        </label>
                      ))}
                    </div>
                    {formSubmitted && taxableComponents.length === 0 && (
                      <p className="text-[11px] text-[#C13515] font-medium mt-1.5">Select at least one taxable base.</p>
                    )}
                  </fieldset>
                )}

                {/* 5. Maximum cap */}
                <div>
                  <label htmlFor="tax-maximum-cap" className="block text-xs font-semibold text-zinc-900">
                    Maximum cap per person per night
                  </label>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                    Optional. Set a per-person, per-night maximum if applicable.
                  </p>
                  <input
                    id="tax-maximum-cap"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={maximumAmountPerPersonPerNight}
                    onChange={(e) => setMaximumAmountPerPersonPerNight(e.target.value)}
                    className="w-full mt-2 rounded-lg border border-[#B0B0B0] hover:border-black focus:border-black px-3.5 py-3 text-xs text-zinc-900 focus:outline-none transition-colors"
                  />
                </div>

                {/* 6. Partial-stay exemption */}
                <div>
                  <label htmlFor="partial-stay-exemption-input" className="block text-xs font-semibold text-zinc-900">
                    Partial-stay exemption
                  </label>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                    If local laws exempt taxes after a certain number of nights, select that number of nights.{" "}
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("partial_stay")}
                      className="underline font-normal text-zinc-900 hover:text-black cursor-pointer"
                    >
                      Learn more
                    </button>
                  </p>
                  <input
                    id="partial-stay-exemption-input"
                    type="number"
                    min="1"
                    placeholder="Optional"
                    value={partialStayExemption}
                    onChange={(e) => setPartialStayExemption(e.target.value)}
                    className="w-full mt-2 rounded-lg border border-[#B0B0B0] hover:border-black focus:border-black px-3.5 py-3 text-xs text-zinc-900 focus:outline-none transition-colors"
                  />
                </div>

                {/* 7. Full-stay exemption */}
                <div>
                  <label htmlFor="full-stay-exemption-input" className="block text-xs font-semibold text-zinc-900">
                    Full-stay exemption
                  </label>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                    If local laws exempt taxes for the entire stay after a certain number of nights, select that number of nights.{" "}
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("full_stay")}
                      className="underline font-normal text-zinc-900 hover:text-black cursor-pointer"
                    >
                      Learn more
                    </button>
                  </p>
                  <input
                    id="full-stay-exemption-input"
                    type="number"
                    min="1"
                    placeholder="Optional"
                    value={fullStayExemption}
                    onChange={(e) => setFullStayExemption(e.target.value)}
                    className="w-full mt-2 rounded-lg border border-[#B0B0B0] hover:border-black focus:border-black px-3.5 py-3 text-xs text-zinc-900 focus:outline-none transition-colors"
                  />
                </div>

                {/* 8. Accommodation tax registration number */}
                <div>
                  <label htmlFor="tax-reg-input" className="block text-xs font-semibold text-zinc-900">
                    Accommodation tax registration number
                  </label>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    This number is on your tax regulation documents.
                  </p>
                  <input
                    id="tax-reg-input"
                    type="text"
                    placeholder="Tax registration number"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className={`w-full mt-2 rounded-lg border px-3.5 py-3 text-xs text-zinc-900 focus:outline-none transition-colors ${
                      formSubmitted && !registrationNumber.trim()
                        ? "border-[#C13515] ring-1 ring-[#C13515]"
                        : "border-[#B0B0B0] hover:border-black focus:border-black"
                    }`}
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Required</p>
                </div>

                {/* 9. Terms for adding taxes */}
                <div>
                  <span className="block text-xs font-semibold text-zinc-900 mb-2">
                    Terms for adding taxes
                  </span>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="terms-checkbox"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-zinc-300 text-black focus:ring-black accent-black cursor-pointer flex-shrink-0"
                    />
                    <label
                      htmlFor="terms-checkbox"
                      className="text-[11px] text-zinc-600 leading-relaxed cursor-pointer"
                    >
                      I confirm the tax information is correct and will remit any tax collected on my bookings to the appropriate tax authorities. I grant Homyz permission to disclose tax-related and transaction information (such as name, listing address, tax amount and registration number) to the relevant tax authorities.
                    </label>
                  </div>
                  {formSubmitted && !termsAgreed && (
                    <p className="text-[11px] text-[#C13515] font-medium flex items-center gap-1 mt-2">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      You must agree to the terms to add taxes
                    </p>
                  )}
                </div>
              </form>
            </div>

            {/* Sticky Bottom Bar */}
            <div className="border-t border-[#E5E5E5] px-6 sm:px-8 lg:px-10 py-4 bg-white flex items-center justify-between sticky bottom-0 z-10">
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs font-semibold text-zinc-900 underline hover:text-black cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-black text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: Educational "Learn More" Drawers (ModalOverlay)     */}
      {/* ============================================================ */}
      {learnMoreTopic !== null && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <h3 className="text-base font-bold text-zinc-900">
                {learnMoreTopic === "platform_taxes" && "Taxes Homyz Submits"}
                {learnMoreTopic === "host_taxes" && "Taxes You Collect & Remit"}
                {learnMoreTopic === "add_tax" && "About Custom Listing Taxes"}
                {learnMoreTopic === "partial_stay" && "Partial-Stay Tax Exemptions"}
                {learnMoreTopic === "full_stay" && "Full-Stay Tax Exemptions"}
              </h3>
              <button
                type="button"
                onClick={() => setLearnMoreTopic(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="py-4 text-xs text-zinc-600 leading-relaxed space-y-3">
              {learnMoreTopic === "platform_taxes" && (
                <>
                  <p>
                    In many jurisdictions, Homyz has agreements with state, provincial, or local tax authorities to automatically collect and remit occupancy, tourist, or value-added taxes on behalf of hosts.
                  </p>
                  <p>
                    These taxes are collected directly from guests during checkout and remitted by Homyz to the designated government authority. You don&apos;t need to take any action for these taxes.
                  </p>
                </>
              )}
              {learnMoreTopic === "host_taxes" && (
                <>
                  <p>
                    If your local municipality or regional authority requires you as an independent host to collect occupancy or tourist tax that Homyz does not collect on your behalf, you can add that tax here.
                  </p>
                  <p>
                    Homyz will itemize and collect this tax from guests during booking, and pass the exact tax funds to you in your payout. You are legally responsible for submitting those tax proceeds directly to your tax authority.
                  </p>
                </>
              )}
              {learnMoreTopic === "add_tax" && (
                <>
                  <p>
                    You can add one or more custom taxes to apply to bookings of this property. Configure the calculation method (percentage or fixed amount), enter your valid local accommodation tax registration number, and agree to the remittance terms.
                  </p>
                </>
              )}
              {learnMoreTopic === "partial_stay" && (
                <>
                  <p>
                    Certain municipal laws specify that taxes only apply for a maximum number of nights (e.g. only the first 28 or 30 nights are taxable). Any subsequent nights beyond that threshold become exempt from tax.
                  </p>
                  <p>
                    Enter the threshold number of nights to enable partial-stay exemptions.
                  </p>
                </>
              )}
              {learnMoreTopic === "full_stay" && (
                <>
                  <p>
                    In some jurisdictions, if a guest books an extended stay exceeding a certain length (for example, 30+ consecutive nights), the reservation qualifies as a residential tenancy and becomes 100% exempt from occupancy tax for the entire stay.
                  </p>
                  <p>
                    Enter the minimum stay length threshold to automatically waive the tax for qualifying reservations.
                  </p>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-100 flex justify-end">
              <button
                type="button"
                onClick={() => setLearnMoreTopic(null)}
                className="px-5 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: Delete Tax Confirmation Modal (ModalOverlay)        */}
      {/* ============================================================ */}
      {isDeleteModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-zinc-900">Delete this tax?</h3>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Are you sure you want to remove this tax? Future bookings will no longer collect this amount from guests.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingTaxId(null);
                }}
                className="px-4 py-2 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTax}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: Registration Document Viewer (ModalOverlay)         */}
      {/* ============================================================ */}
      {viewingRegistration && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">Tax Registration Details</h3>
              <button
                type="button"
                onClick={() => setViewingRegistration(null)}
                className="text-zinc-400 hover:text-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="py-4 space-y-2 text-xs text-zinc-600">
              <div>
                <span className="font-semibold text-zinc-900">Tax Type:</span> {viewingRegistration.taxType}
              </div>
              <div>
                <span className="font-semibold text-zinc-900">Registration Number:</span> {viewingRegistration.registrationNumber}
              </div>
              <div>
                <span className="font-semibold text-zinc-900">Status:</span> {viewingRegistration.status}
              </div>
            </div>
            <div className="pt-3 border-t border-zinc-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingRegistration(null)}
                className="px-4 py-1.5 bg-black text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: Tax Statement & Regulatory Info Modal (ModalOverlay)*/}
      {/* ============================================================ */}
      {viewingInvoiceModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900">Tax Statement & Regulatory Info</h3>
              <button
                type="button"
                onClick={() => setViewingInvoiceModal(false)}
                className="text-zinc-400 hover:text-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="py-4 text-xs text-zinc-600 space-y-2">
              <p>
                All tax records for this listing are stored securely in accordance with local taxation authorities and compliance standards.
              </p>
            </div>
            <div className="pt-3 border-t border-zinc-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingInvoiceModal(false)}
                className="px-4 py-1.5 bg-black text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helper Mappers & Formatters
// -----------------------------------------------------------------------------

function mapNameToTaxType(name: string): TaxType {
  const lower = name.toLowerCase();
  if (lower.includes("transient") || lower.includes("occupancy")) return "OCCUPANCY_TAX";
  if (lower.includes("tourist") || lower.includes("tourism")) return "TOURIST_TAX";
  if (lower.includes("city")) return "CITY_TAX";
  if (lower.includes("hotel") || lower.includes("lodging") || lower.includes("room")) return "LODGING_TAX";
  if (lower.includes("sales")) return "SALES_TAX";
  if (lower.includes("vat") || lower.includes("value-added")) return "VAT";
  if (lower.includes("gst") || lower.includes("goods and services")) return "GST";
  return "OTHER";
}

function mapTypeToCalcMethod(typeStr: string): TaxCalculationMethod {
  if (typeStr === "Percentage per booking") return "PERCENTAGE";
  if (typeStr === "Per guest" || typeStr === "Flat amount per guest") return "AMOUNT_PER_GUEST";
  if (typeStr === "Per night" || typeStr === "Flat amount per night") return "AMOUNT_PER_NIGHT";
  if (typeStr === "Per guest, per night" || typeStr === "Flat amount per guest per night") return "AMOUNT_PER_GUEST_PER_NIGHT";
  if (typeStr === "Per booking" || typeStr === "Flat amount per booking") return "FLAT_PER_BOOKING";
  return "PERCENTAGE";
}

function formatCalculationMethod(method: TaxCalculationMethod): string {
  switch (method) {
    case "PERCENTAGE":
      return "Percentage per booking";
    case "AMOUNT_PER_GUEST":
      return "Per guest";
    case "AMOUNT_PER_NIGHT":
      return "Per night";
    case "AMOUNT_PER_GUEST_PER_NIGHT":
      return "Per guest, per night";
    case "FLAT_PER_BOOKING":
      return "Per booking";
    default:
      return "Percentage per booking";
  }
}

function formatTaxTypeName(taxType: TaxType): string {
  switch (taxType) {
    case "OCCUPANCY_TAX":
      return "Transient Occupancy Tax";
    case "TOURIST_TAX":
      return "Tourist tax";
    case "CITY_TAX":
      return "City tax";
    case "LODGING_TAX":
      return "Lodging tax";
    case "SALES_TAX":
      return "Sales tax";
    case "VAT":
      return "VAT/GST";
    case "GST":
      return "Goods and services tax (GST)";
    default:
      return "Other local tax";
  }
}
