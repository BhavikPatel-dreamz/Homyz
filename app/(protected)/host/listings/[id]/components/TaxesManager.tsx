"use client";

import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/ui/back-button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import { useLanguage, type TranslationKey } from "@/lib/i18n/language-context";
import type {
  ListingTaxDTO,
  TaxJurisdictionDTO,
  TaxRegistrationDTO,
  TaxRuleDTO,
  TaxType,
  TaxCalculationMethod,
  TaxableComponent,
} from "@/lib/tax/types";

interface TaxesManagerProps {
  listingId: string;
  listingCity?: string | null;
  listingCountry?: string | null;
  setActiveSection: (s: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

type TaxFormSnapshot = {
  taxName: string;
  taxType: string;
  rateMode: "Fixed" | "Percentage";
  taxRate: string;
  taxableComponents: TaxableComponent[];
  maximumAmountPerPersonPerNight: string;
  partialStayExemption: string;
  fullStayExemption: string;
  registrationNumber: string;
  termsAgreed: boolean;
};

function sameTaxForm(left: TaxFormSnapshot, right: TaxFormSnapshot) {
  return (
    left.taxName === right.taxName &&
    left.taxType === right.taxType &&
    left.rateMode === right.rateMode &&
    left.taxRate === right.taxRate &&
    left.maximumAmountPerPersonPerNight === right.maximumAmountPerPersonPerNight &&
    left.partialStayExemption === right.partialStayExemption &&
    left.fullStayExemption === right.fullStayExemption &&
    left.registrationNumber === right.registrationNumber &&
    left.termsAgreed === right.termsAgreed &&
    left.taxableComponents.length === right.taxableComponents.length &&
    left.taxableComponents.every((component, index) => component === right.taxableComponents[index])
  );
}

export function TaxesManager({
  listingId,
  listingCity: _listingCity,
  listingCountry,
  setActiveSection,
  onDirtyChange,
}: TaxesManagerProps) {
  const { t } = useLanguage();
  const [_isLoading, setIsLoading] = useState(true);

  // Overview data
  const [jurisdiction, setJurisdiction] = useState<TaxJurisdictionDTO | null>(null);
  const [systemRules, setSystemRules] = useState<TaxRuleDTO[]>([]);
  const [hostTaxes, setHostTaxes] = useState<ListingTaxDTO[]>([]);
  const [_registrations, setRegistrations] = useState<TaxRegistrationDTO[]>([]);

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
  const [savedForm, setSavedForm] = useState<TaxFormSnapshot | null>(null);

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

  const TAXABLE_BASE_OPTIONS: { value: TaxableComponent; label: string }[] = [
    { value: "BASE_PRICE", label: t("host_tax_base_price") },
    { value: "MANAGEMENT_FEE", label: t("host_tax_management_fee") },
    { value: "COMMUNITY_FEE", label: t("host_tax_community_fee") },
    { value: "LINEN_FEE", label: t("host_tax_linen_fee") },
    { value: "RESORT_FEE", label: t("host_tax_resort_fee") },
    { value: "CLEANING_FEE", label: t("host_tax_cleaning_fee") },
    { value: "PET_FEE", label: t("host_tax_pet_fee") },
  ];

  const currentForm: TaxFormSnapshot = {
    taxName,
    taxType,
    rateMode,
    taxRate,
    taxableComponents,
    maximumAmountPerPersonPerNight,
    partialStayExemption,
    fullStayExemption,
    registrationNumber,
    termsAgreed,
  };
  const isFormDirty = isAddTaxModalOpen && savedForm !== null && !sameTaxForm(currentForm, savedForm);

  useEffect(() => {
    onDirtyChange?.(isFormDirty);
  }, [isFormDirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Helper toasts
  const showSuccess = (msg: string) => {
    toast.success(msg);
  };

  const showError = (msg: string) => {
    toast.error(msg);
  };

  // Load listing taxes overview
  const loadOverview = async () => {
    if (!listingId) return;
    try {
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
    } catch (err: unknown) {
      console.error("Error fetching tax overview:", err);
      showError(err instanceof Error ? err.message : "Could not load tax overview");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchInitialData() {
      if (!listingId) return;
      try {
        const res = await fetch(`/api/v1/listings/${listingId}/taxes`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (ignore) return;
        if (!res.ok || json.error) {
          throw new Error(json.error?.message || "Failed to load tax settings");
        }
        const data = json.data;
        setJurisdiction(data.jurisdiction || null);
        setSystemRules(data.systemRules || []);
        setHostTaxes(data.hostTaxes || []);
        setRegistrations(data.registrations || []);

        if (data.registrations && data.registrations.length > 0) {
          setRegistrationNumber((prev) => prev || data.registrations[0].registrationNumber);
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error("Error fetching tax overview:", err);
          showError(err instanceof Error ? err.message : "Could not load tax overview");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    fetchInitialData();
    return () => {
      ignore = true;
    };
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
    setSavedForm({
      taxName: "",
      taxType: "",
      rateMode: "Fixed",
      taxRate: "",
      taxableComponents: ["BASE_PRICE"],
      maximumAmountPerPersonPerNight: "",
      partialStayExemption: "",
      fullStayExemption: "",
      registrationNumber: "",
      termsAgreed: false,
    });
    setIsAddTaxModalOpen(true);
  };

  // Open "Edit tax" modal
  const handleEditTax = (tax: ListingTaxDTO) => {
    setEditingTax(tax);
    setTaxName(tax.customName || formatTaxTypeName(tax.taxType, t));
    const methodStr = formatCalculationMethod(tax.calculationMethod, t);
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
    setSavedForm({
      taxName: tax.customName || formatTaxTypeName(tax.taxType, t),
      taxType: methodStr,
      rateMode: isPct ? "Percentage" : "Fixed",
      taxRate: isPct ? String(tax.rate ?? "") : String((tax.amount ?? 0) / 100),
      taxableComponents: tax.taxableComponents,
      maximumAmountPerPersonPerNight: tax.maximumAmountPerPersonPerNight ? String(tax.maximumAmountPerPersonPerNight / 100) : "",
      partialStayExemption: tax.partialStayExemptionNights ? String(tax.partialStayExemptionNights) : "",
      fullStayExemption: tax.fullStayExemptionNights || tax.longStayExemptionNights
        ? String(tax.fullStayExemptionNights || tax.longStayExemptionNights)
        : "",
      registrationNumber,
      termsAgreed: true,
    });
    setIsAddTaxModalOpen(true);
  };

  const handleCancel = () => {
    setIsAddTaxModalOpen(false);
    setEditingTax(null);
    setFormSubmitted(false);
    setSavedForm(null);
  };

  // Synchronize rateMode based on TaxType selection
  const handleTaxTypeChange = (selected: string) => {
    setTaxType(selected);
    if (selected === t("host_tax_type_percentage_per_booking")) {
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
      (taxType === t("host_tax_type_percentage_per_booking") && taxableComponents.length === 0)
    ) {
      return;
    }

    const numericRate = parseFloat(taxRate);
    if (isNaN(numericRate) || numericRate <= 0) {
      showError(t("host_taxes_error_invalid_rate"));
      return;
    }

    const normalizedRegistrationNumber = registrationNumber.trim();
    if (!/^[A-Za-z0-9\-\s]{4,50}$/.test(normalizedRegistrationNumber)) {
      showError(t("host_taxes_error_invalid_reg"));
      return;
    }

    const mappedTaxType: TaxType = mapNameToTaxType(taxName);
    const mappedCalcMethod: TaxCalculationMethod = mapTypeToCalcMethod(taxType, t);
    const isPlatformManaged = systemRules.some(
      (rule) => rule.taxType === mappedTaxType && rule.isActive,
    );
    if (isPlatformManaged) {
      showError(t("host_taxes_error_platform_managed"));
      return;
    }

    setIsSaving(true);

    try {
      const payload: Record<string, unknown> = {
        listingId,
        taxType: mappedTaxType,
        customName: taxName,
        calculationMethod: mappedCalcMethod,
        rate: mappedCalcMethod === "PERCENTAGE" ? numericRate : null,
        amount: mappedCalcMethod !== "PERCENTAGE" ? Math.round(numericRate * 100) : null,
        taxableComponents:
          mappedCalcMethod === "PERCENTAGE" ? taxableComponents : ["BASE_PRICE"],
        remittanceResponsibility: "HOST",
        maximumAmountPerPersonPerNight: maximumAmountPerPersonPerNight
          ? Math.round(parseFloat(maximumAmountPerPersonPerNight) * 100)
          : null,
        partialStayExemptionNights: partialStayExemption ? parseInt(partialStayExemption, 10) : null,
        fullStayExemptionNights: fullStayExemption ? parseInt(fullStayExemption, 10) : null,
        longStayExemptionNights: fullStayExemption ? parseInt(fullStayExemption, 10) : null,
      };

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

      showSuccess(editingTax ? t("host_taxes_updated_success") : t("host_taxes_added_success"));
      setIsAddTaxModalOpen(false);
      setEditingTax(null);
      setSavedForm(null);
      await loadOverview();
    } catch (err: unknown) {
      console.error("Save tax error:", err);
      showError(err instanceof Error ? err.message : "Failed to save tax");
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
      showSuccess(t("host_taxes_deleted_success"));
      setIsDeleteModalOpen(false);
      setDeletingTaxId(null);
      await loadOverview();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Failed to delete tax");
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

    return [
      { id: "cgst", label: "Standard Rate - CGST (In - Gujarat (in-gj))" },
      { id: "sgst", label: "Standard Rate - SGST (In - Gujarat (in-gj))" },
    ];
  };

  const platformTaxes = getPlatformTaxes();

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 lg:max-w-[calc(100%-75px)]">
      {/* Main Section Content */}
      <div className="space-y-6">
        {/* Back Button & Title */}
        <div className="flex items-start gap-6">
          <BackButton
            onClick={() => setActiveSection("propertyType")}
            className="mb-4"
            aria-label="Back to listing editor"
          />
          <div>
            <h1>{t("host_taxes_heading")}</h1>
            <p className="text-sm sm:text-base text-[#727272] dark:text-zinc-400 mt-1.5 leading-relaxed">
              {t("host_taxes_subtitle")}
            </p>
          </div>
        </div>

        {/* CARD 1: Taxes Homyz Submits */}
        <div className="border border-[#DDDDDD] dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900 shadow-2xs">
          <h2 className="text-lg font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_taxes_homyz_submits_heading")}</h2>
          <p className="text-sm text-[#727272] dark:text-zinc-400 mt-1 leading-relaxed">
            {t("host_taxes_homyz_submits_desc")}{" "}
            <button
              type="button"
              onClick={() => setLearnMoreTopic("platform_taxes")}
              className="underline font-normal text-zinc-900 dark:text-zinc-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              {t("host_learn_more")}
            </button>
          </p>

          <div className="mt-4 space-y-2.5">
            {platformTaxes.map((tax) => (
              <div key={tax.id} className="flex items-center gap-2.5 text-sm text-[#1f1f1f] dark:text-zinc-200">
                <svg
                  className="w-4 h-4 text-zinc-900 dark:text-zinc-200 flex-shrink-0"
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
        <div className="border border-[#DDDDDD] dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900 shadow-2xs">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{t("host_taxes_add_taxes_heading")}</h2>
          <p className="text-sm text-[#727272] dark:text-zinc-400 mt-1 leading-relaxed">
            {t("host_taxes_add_taxes_desc")}{" "}
            <button
              type="button"
              onClick={() => setLearnMoreTopic("host_taxes")}
              className="underline font-normal text-zinc-900 dark:text-zinc-200 hover:text-black dark:hover:text-white cursor-pointer"
            >
              {t("host_learn_more")}
            </button>
          </p>

          {/* If host taxes already added, show list */}
          {hostTaxes.length > 0 && (
            <div className="mt-4 space-y-3">
              {hostTaxes.map((tax) => (
                <div
                  key={tax.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {tax.customName || formatTaxTypeName(tax.taxType, t)}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {tax.calculationMethod === "PERCENTAGE"
                        ? `${tax.rate}% ${t("host_tax_type_percentage_per_booking").toLowerCase()}`
                        : `${((tax.amount || 0) / 100).toFixed(2)} ${jurisdiction?.currency || "SAR"} (${formatCalculationMethod(tax.calculationMethod, t).toLowerCase()})`}
                      {tax.longStayExemptionNights && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px]">
                          {t("host_taxes_exempt_after_nights", { count: tax.longStayExemptionNights })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditTax(tax)}
                      className="px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:underline cursor-pointer"
                    >
                      {t("host_edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingTaxId(tax.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:underline cursor-pointer"
                    >
                      {t("host_delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenAddTax}
            className="mt-4 px-4 py-2 inline-flex items-center gap-1.5 rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-4 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
          >
            {t("host_taxes_add_a_tax_btn")}
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
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="p-6 sm:p-8 lg:p-10 overflow-y-auto flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="tax-modal-title" className="text-xl font-semibold tracking-tight text-[#1F1F1F] dark:text-zinc-100 sm:text-2xl">
                    {editingTax ? t("host_taxes_edit_tax") : t("host_taxes_add_a_tax")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#727272] dark:text-zinc-400">
                    {t("host_taxes_modal_intro")}{" "}
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("add_tax")}
                      className="font-medium text-zinc-900 underline underline-offset-2 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:text-zinc-200 dark:hover:text-white dark:focus-visible:ring-zinc-100"
                    >
                      {t("host_learn_more")}
                    </button>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#1f1f1f] transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-7 space-y-7">
                {/* 1. Tax name */}
                <div>
                  <label htmlFor="tax-name-select" className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("host_taxes_name_label")}
                  </label>
                  <div className="relative">
                    <select
                      id="tax-name-select"
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                      className={`w-full appearance-none rounded-lg border bg-white px-3.5 py-3 text-sm text-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-100/15 ${formSubmitted && !taxName
                          ? "border-[#C13515] ring-1 ring-[#C13515]"
                          : "border-[#B0B0B0] dark:border-zinc-700 hover:border-black dark:hover:border-zinc-500 focus:border-black dark:focus:border-zinc-400"
                        }`}
                    >
                      <option value="">{t("host_select")}</option>
                      <option value="Hotel tax">{t("host_tax_name_hotel")}</option>
                      <option value="Lodging tax">{t("host_tax_name_lodging")}</option>
                      <option value="Room tax">{t("host_tax_name_room")}</option>
                      <option value="Tourist tax">{t("host_tax_name_tourist")}</option>
                      <option value="Transient Occupancy Tax">{t("host_tax_name_tot")}</option>
                      <option value="Sales tax">{t("host_tax_name_sales")}</option>
                      <option value="VAT/GST">{t("host_tax_name_vat_gst")}</option>
                      <option value="Tourism Assessment/Fee">{t("host_tax_name_tourism_fee")}</option>
                      <option value="Amusement tax">{t("host_tax_name_amusement")}</option>
                      <option value="City tax">{t("host_tax_name_city")}</option>
                      <option value="Other local tax">{t("host_tax_name_other")}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 dark:text-zinc-400">
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
                      {t("host_required")}
                    </p>
                  )}
                </div>

                {/* 2. Tax type */}
                <div>
                  <label htmlFor="tax-type-select" className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("host_taxes_type_label")}
                  </label>
                  <div className="relative">
                    <select
                      id="tax-type-select"
                      value={taxType}
                      onChange={(e) => handleTaxTypeChange(e.target.value)}
                      className={`w-full appearance-none rounded-lg border bg-white px-3.5 py-3 text-sm text-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-100/15 ${formSubmitted && !taxType
                          ? "border-[#C13515] ring-1 ring-[#C13515]"
                          : "border-[#B0B0B0] dark:border-zinc-700 hover:border-black dark:hover:border-zinc-500 focus:border-black dark:focus:border-zinc-400"
                        }`}
                    >
                      <option value="">{t("host_select")}</option>
                      <option value={t("host_tax_type_per_guest")}>{t("host_tax_type_per_guest")}</option>
                      <option value={t("host_tax_type_per_guest_per_night")}>{t("host_tax_type_per_guest_per_night")}</option>
                      <option value={t("host_tax_type_per_night")}>{t("host_tax_type_per_night")}</option>
                      <option value={t("host_tax_type_percentage_per_booking")}>{t("host_tax_type_percentage_per_booking")}</option>
                      <option value={t("host_tax_type_per_booking")}>{t("host_tax_type_per_booking")}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 dark:text-zinc-400">
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
                      {t("host_required")}
                    </p>
                  )}
                </div>

                {/* 3. Tax rate */}
                <div>
                  <label htmlFor="tax-rate-input" className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("host_taxes_rate_label")}
                  </label>
                  <div
                    className={`overflow-hidden rounded-lg border dark:border-zinc-700 ${formSubmitted && (!taxRate || parseFloat(taxRate) <= 0)
                        ? "border-[#C13515]"
                        : "border-[#B0B0B0]"
                      }`}
                  >
                    <div className="bg-[#F7F7F7] dark:bg-zinc-800 border-b border-[#E5E5E5] dark:border-zinc-700 px-3.5 py-2">
                      <span className="block text-xs leading-none text-zinc-500 dark:text-zinc-400">{t("host_select")}</span>
                      <span className="text-sm font-medium leading-tight text-zinc-800 dark:text-zinc-200">
                        {rateMode}
                      </span>
                    </div>
                    <div className="p-1 bg-white dark:bg-zinc-900">
                      <input
                        id="tax-rate-input"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={rateMode === "Percentage" ? "10 (%)" : "0.00 (Amount)"}
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        className="w-full bg-transparent px-3 py-2.5 text-sm text-zinc-900 focus:outline-none dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  {formSubmitted && (!taxRate || parseFloat(taxRate) <= 0) && (
                    <p className="text-[11px] text-[#C13515] font-medium flex items-center gap-1 mt-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {t("host_required")}
                    </p>
                  )}
                </div>

                {/* Taxable base applies only to percentage calculations. */}
                {taxType === t("host_tax_type_percentage_per_booking") && (
                  <fieldset>
                    <legend className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("host_taxes_taxable_base_label")}</legend>
                    <div className="space-y-2">
                      {TAXABLE_BASE_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-center justify-between gap-3 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                          <span>{option.label}</span>
                          <input
                            type="checkbox"
                            checked={taxableComponents.includes(option.value)}
                            onChange={() => toggleTaxableComponent(option.value)}
                            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 accent-black dark:accent-amber-400 cursor-pointer"
                          />
                        </label>
                      ))}
                    </div>
                    {formSubmitted && taxableComponents.length === 0 && (
                      <p className="text-[11px] text-[#C13515] font-medium mt-1.5">{t("host_taxes_taxable_base_error")}</p>
                    )}
                  </fieldset>
                )}

                {/* 5. Maximum cap */}
                <div>
                  <label htmlFor="tax-maximum-cap" className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("host_taxes_max_cap_label")}
                  </label>
                  <p className="mt-1 text-sm leading-5 text-[#727272] dark:text-zinc-400">
                    {t("host_taxes_max_cap_desc")}
                  </p>
                  <input
                    id="tax-maximum-cap"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t("host_optional")}
                    value={maximumAmountPerPersonPerNight}
                    onChange={(e) => setMaximumAmountPerPersonPerNight(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#B0B0B0] bg-white px-3.5 py-3 text-sm text-zinc-900 transition-colors hover:border-black focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-100/15"
                  />
                </div>

                {/* 6. Partial-stay exemption */}
                <div>
                  <label htmlFor="partial-stay-exemption-input" className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("host_taxes_partial_exemption_label")}
                  </label>
                  <p className="mt-1 text-sm leading-5 text-[#727272] dark:text-zinc-400">
                    {t("host_taxes_partial_exemption_desc")}{" "}
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("partial_stay")}
                      className="font-medium text-zinc-900 underline underline-offset-2 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:text-zinc-200 dark:hover:text-white dark:focus-visible:ring-zinc-100"
                    >
                      {t("host_learn_more")}
                    </button>
                  </p>
                  <input
                    id="partial-stay-exemption-input"
                    type="number"
                    min="1"
                    placeholder={t("host_optional")}
                    value={partialStayExemption}
                    onChange={(e) => setPartialStayExemption(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#B0B0B0] bg-white px-3.5 py-3 text-sm text-zinc-900 transition-colors hover:border-black focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-100/15"
                  />
                </div>

                {/* 7. Full-stay exemption */}
                <div>
                  <label htmlFor="full-stay-exemption-input" className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("host_taxes_full_exemption_label")}
                  </label>
                  <p className="mt-1 text-sm leading-5 text-[#727272] dark:text-zinc-400">
                    {t("host_taxes_full_exemption_desc")}{" "}
                    <button
                      type="button"
                      onClick={() => setLearnMoreTopic("full_stay")}
                      className="font-medium text-zinc-900 underline underline-offset-2 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:text-zinc-200 dark:hover:text-white dark:focus-visible:ring-zinc-100"
                    >
                      {t("host_learn_more")}
                    </button>
                  </p>
                  <input
                    id="full-stay-exemption-input"
                    type="number"
                    min="1"
                    placeholder={t("host_optional")}
                    value={fullStayExemption}
                    onChange={(e) => setFullStayExemption(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#B0B0B0] bg-white px-3.5 py-3 text-sm text-zinc-900 transition-colors hover:border-black focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-100/15"
                  />
                </div>

                {/* 8. Accommodation tax registration number */}
                <div>
                  <label htmlFor="tax-reg-input" className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("host_taxes_reg_number_label")}
                  </label>
                  <p className="mt-1 text-sm leading-5 text-[#727272] dark:text-zinc-400">
                    {t("host_taxes_reg_number_desc")}
                  </p>
                  <input
                    id="tax-reg-input"
                    type="text"
                    placeholder={t("host_taxes_reg_number_placeholder")}
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className={`mt-2 w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-100/15 ${formSubmitted && !registrationNumber.trim()
                        ? "border-[#C13515] ring-1 ring-[#C13515]"
                        : "border-[#B0B0B0] dark:border-zinc-700 hover:border-black dark:hover:border-zinc-500 focus:border-black dark:focus:border-zinc-400"
                      }`}
                  />
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">{t("host_required")}</p>
                </div>

                {/* 9. Terms for adding taxes */}
                <div>
                  <span className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("host_taxes_terms_label")}
                  </span>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="terms-checkbox"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-black dark:text-amber-400 focus:ring-black dark:focus:ring-amber-400 accent-black dark:accent-amber-400 cursor-pointer flex-shrink-0"
                    />
                    <label
                      htmlFor="terms-checkbox"
                      className="text-sm leading-5 text-[#727272] dark:text-zinc-400 cursor-pointer"
                    >
                      {t("host_taxes_terms_checkbox_text")}
                    </label>
                  </div>
                  {formSubmitted && !termsAgreed && (
                    <p className="text-[11px] text-[#C13515] font-medium flex items-center gap-1 mt-2">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {t("host_taxes_terms_error")}
                    </p>
                  )}
                </div>
              </form>
            </div>

            {/* Sticky Bottom Bar */}
            <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-[#E5E5E5] bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8 lg:px-10">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-full bg-white hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-5 py-2.5 transition-all cursor-pointer border border-[#1f1f1f] hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
              >
                {t("host_cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-6 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
              >
                {isSaving ? t("host_saving") : t("host_save")}
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
          <section role="dialog" aria-modal="true" aria-labelledby="tax-learn-more-title" className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 pb-4 pt-6 dark:border-zinc-800">
              <h3 id="tax-learn-more-title" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {learnMoreTopic === "platform_taxes" && t("host_taxes_learn_platform_title")}
                {learnMoreTopic === "host_taxes" && t("host_taxes_learn_host_title")}
                {learnMoreTopic === "add_tax" && t("host_taxes_learn_add_title")}
                {learnMoreTopic === "partial_stay" && t("host_taxes_learn_partial_title")}
                {learnMoreTopic === "full_stay" && t("host_taxes_learn_full_title")}
              </h3>
              <button
                type="button"
                onClick={() => setLearnMoreTopic(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
                aria-label="Close modal"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5 text-sm leading-6 text-[#727272] dark:text-zinc-300">
              {learnMoreTopic === "platform_taxes" && (
                <>
                  <p>{t("host_taxes_learn_platform_p1")}</p>
                  <p>{t("host_taxes_learn_platform_p2")}</p>
                </>
              )}
              {learnMoreTopic === "host_taxes" && (
                <>
                  <p>{t("host_taxes_learn_host_p1")}</p>
                  <p>{t("host_taxes_learn_host_p2")}</p>
                </>
              )}
              {learnMoreTopic === "add_tax" && (
                <>
                  <p>{t("host_taxes_learn_add_p1")}</p>
                </>
              )}
              {learnMoreTopic === "partial_stay" && (
                <>
                  <p>{t("host_taxes_learn_partial_p1")}</p>
                  <p>{t("host_taxes_learn_partial_p2")}</p>
                </>
              )}
              {learnMoreTopic === "full_stay" && (
                <>
                  <p>{t("host_taxes_learn_full_p1")}</p>
                  <p>{t("host_taxes_learn_full_p2")}</p>
                </>
              )}
            </div>

            <div className="flex justify-end border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setLearnMoreTopic(null)}
                className="min-h-11 rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
              >
                {t("host_got_it")}
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: Delete Tax Confirmation Modal (ModalOverlay)        */}
      {/* ============================================================ */}
      {isDeleteModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-tax-title" className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
            <h3 id="delete-tax-title" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{t("host_taxes_delete_modal_title")}</h3>
            <p className="mt-2 text-sm leading-6 text-[#727272] dark:text-zinc-400">
              {t("host_taxes_delete_modal_desc")}
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingTaxId(null);
                }}
                className="min-h-11 rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
              >
                {t("host_cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDeleteTax}
                className="min-h-11 rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 dark:hover:bg-rose-500 dark:focus-visible:ring-rose-400 dark:focus-visible:ring-offset-zinc-900"
              >
                {t("host_delete")}
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: Registration Document Viewer (ModalOverlay)         */}
      {/* ============================================================ */}
      {viewingRegistration && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="registration-details-title" className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <h3 id="registration-details-title" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{t("host_taxes_reg_details_title")}</h3>
              <button
                type="button"
                onClick={() => setViewingRegistration(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
                aria-label="Close registration details"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 py-5 text-sm leading-6 text-[#727272] dark:text-zinc-300">
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{t("host_taxes_type_label")}:</span> {viewingRegistration.taxType}
              </div>
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{t("host_taxes_reg_number_label")}:</span> {viewingRegistration.registrationNumber}
              </div>
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Status:</span> {viewingRegistration.status}
              </div>
            </div>
            <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setViewingRegistration(null)}
                className="min-h-11 rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
              >
                {t("host_close")}
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: Tax Statement & Regulatory Info Modal (ModalOverlay)*/}
      {/* ============================================================ */}
      {viewingInvoiceModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="tax-statement-title" className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <h3 id="tax-statement-title" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{t("host_taxes_statement_title")}</h3>
              <button
                type="button"
                onClick={() => setViewingInvoiceModal(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
                aria-label="Close tax statement"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 py-5 text-sm leading-6 text-[#727272] dark:text-zinc-300">
              <p>
                {t("host_taxes_statement_desc")}
              </p>
            </div>
            <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setViewingInvoiceModal(false)}
                className="min-h-11 rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-900"
              >
                {t("host_close")}
              </button>
            </div>
          </section>
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

function mapTypeToCalcMethod(typeStr: string, t?: (key: TranslationKey) => string): TaxCalculationMethod {
  if (typeStr === "Percentage per booking" || (t && typeStr === t("host_tax_type_percentage_per_booking"))) return "PERCENTAGE";
  if (typeStr === "Per guest" || typeStr === "Flat amount per guest" || (t && typeStr === t("host_tax_type_per_guest"))) return "AMOUNT_PER_GUEST";
  if (typeStr === "Per night" || typeStr === "Flat amount per night" || (t && typeStr === t("host_tax_type_per_night"))) return "AMOUNT_PER_NIGHT";
  if (typeStr === "Per guest, per night" || typeStr === "Flat amount per guest per night" || (t && typeStr === t("host_tax_type_per_guest_per_night"))) return "AMOUNT_PER_GUEST_PER_NIGHT";
  if (typeStr === "Per booking" || typeStr === "Flat amount per booking" || (t && typeStr === t("host_tax_type_per_booking"))) return "FLAT_PER_BOOKING";
  return "PERCENTAGE";
}

function formatCalculationMethod(method: TaxCalculationMethod, t: (key: TranslationKey) => string): string {
  switch (method) {
    case "PERCENTAGE":
      return t("host_tax_type_percentage_per_booking");
    case "AMOUNT_PER_GUEST":
      return t("host_tax_type_per_guest");
    case "AMOUNT_PER_NIGHT":
      return t("host_tax_type_per_night");
    case "AMOUNT_PER_GUEST_PER_NIGHT":
      return t("host_tax_type_per_guest_per_night");
    case "FLAT_PER_BOOKING":
      return t("host_tax_type_per_booking");
    default:
      return t("host_tax_type_percentage_per_booking");
  }
}

function formatTaxTypeName(taxType: TaxType, t: (key: TranslationKey) => string): string {
  switch (taxType) {
    case "OCCUPANCY_TAX":
      return t("host_tax_name_tot");
    case "TOURIST_TAX":
      return t("host_tax_name_tourist");
    case "CITY_TAX":
      return t("host_tax_name_city");
    case "LODGING_TAX":
      return t("host_tax_name_lodging");
    case "SALES_TAX":
      return t("host_tax_name_sales");
    case "VAT":
      return t("host_tax_name_vat_gst");
    case "GST":
      return t("host_tax_name_vat_gst");
    default:
      return t("host_tax_name_other");
  }
}
