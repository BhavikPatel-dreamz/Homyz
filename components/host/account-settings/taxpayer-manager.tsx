"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type {
  HostTaxpayerProfileDTO,
  HostVatRegistrationDTO,
} from "@/services/host-tax.service";
import {
  SettingsStatusBadge,
  ReceiptTaxIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  ExternalLinkIcon,
  XIcon,
  BuildingBankIcon,
} from "@/components/host/account-settings";
import {
  validateSaudiTaxIdentifier,
  validateSaudiVatNumber,
  maskTaxIdentifier,
} from "@/lib/validation/tax";

interface TaxpayerManagerProps {
  hostId: string;
  initialProfile: HostTaxpayerProfileDTO | null;
  initialVatRegistrations: HostVatRegistrationDTO[];
}

export function TaxpayerManager({
  hostId,
  initialProfile,
  initialVatRegistrations,
}: TaxpayerManagerProps) {
  const [profile, setProfile] = useState<HostTaxpayerProfileDTO | null>(initialProfile);
  const [vatRegistrations, setVatRegistrations] = useState<HostVatRegistrationDTO[]>(
    initialVatRegistrations,
  );

  const [activeDrawer, setActiveDrawer] = useState<"TAXPAYER" | "VAT" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Taxpayer Form State
  const [taxpayerType, setTaxpayerType] = useState<"INDIVIDUAL" | "BUSINESS">(
    profile?.taxpayerType || "INDIVIDUAL",
  );
  const [legalName, setLegalName] = useState(profile?.legalName || "");
  const [businessName, setBusinessName] = useState(profile?.businessName || "");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(
    profile?.businessRegistrationNumber || "",
  );
  const [countryCode, setCountryCode] = useState(profile?.countryCode || "SA");
  const [taxIdentifierType, setTaxIdentifierType] = useState<"NIN" | "IQAMA" | "TIN" | "CR" | "OTHER">(
    (profile?.taxIdentifierType as any) || "NIN",
  );
  const [taxIdentifier, setTaxIdentifier] = useState("");
  const [addressLine1, setAddressLine1] = useState(profile?.addressLine1 || "");
  const [city, setCity] = useState(profile?.city || "");
  const [postalCode, setPostalCode] = useState(profile?.postalCode || "");

  // VAT Form State
  const activeVat = vatRegistrations.find((r) => r.taxType === "VAT_ID" || r.taxType === "VAT");
  const [isVatRegistered, setIsVatRegistered] = useState(Boolean(activeVat));
  const [vatNumber, setVatNumber] = useState("");
  const [vatBusinessName, setVatBusinessName] = useState(activeVat?.businessName || "");
  const [vatDocumentUrl, setVatDocumentUrl] = useState(activeVat?.documentUrl || "");

  // Validation states
  const taxIdValidation = countryCode === "SA" && taxIdentifier
    ? validateSaudiTaxIdentifier(taxIdentifierType, taxIdentifier)
    : { valid: Boolean(taxIdentifier.trim()) };

  const vatValidation = isVatRegistered && countryCode === "SA" && vatNumber
    ? validateSaudiVatNumber(vatNumber)
    : { valid: !isVatRegistered || Boolean(vatNumber.trim()) };

  const isTaxpayerFormValid =
    legalName.trim().length >= 2 &&
    (taxpayerType === "INDIVIDUAL" || businessName.trim().length >= 2) &&
    (profile ? (taxIdentifier.trim() ? taxIdValidation.valid : true) : taxIdValidation.valid);

  const isVatFormValid = !isVatRegistered || (vatNumber.trim().length >= 4 && vatValidation.valid);

  // Save Taxpayer Profile
  const handleSaveTaxpayerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTaxpayerFormValid) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        taxpayerType,
        legalName: legalName.trim(),
        businessName: taxpayerType === "BUSINESS" ? businessName.trim() : null,
        businessRegistrationNumber: businessRegistrationNumber.trim() || null,
        countryCode,
        taxIdentifierType,
        taxIdentifier: taxIdentifier.trim() || (profile ? "UNCHANGED" : ""),
        addressLine1: addressLine1.trim() || null,
        city: city.trim() || null,
        postalCode: postalCode.trim() || null,
      };

      // If editing and taxIdentifier was left empty, retain existing
      if (!taxIdentifier.trim() && profile) {
        payload.taxIdentifier = "RETAIN_EXISTING_" + profile.taxIdentifierLast4;
      }

      const res = await fetch("/api/v1/host/taxpayer-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to save taxpayer profile.");
      }

      setProfile(data.data);
      setSuccessMsg("Taxpayer profile saved successfully. Information submitted for verification.");
      setActiveDrawer(null);
      setTaxIdentifier("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save taxpayer profile.");
    } finally {
      setActionLoading(false);
    }
  };

  // Save VAT Registration
  const handleSaveVatRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVatFormValid) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        countryCode,
        isVatRegistered,
        vatNumber: isVatRegistered ? vatNumber.trim() : null,
        businessName: vatBusinessName.trim() || null,
        documentUrl: vatDocumentUrl.trim() || null,
      };

      const res = await fetch("/api/v1/host/vat-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to save VAT registration.");
      }

      if (data.data?.isVatRegistered === false) {
        setVatRegistrations([]);
        setSuccessMsg("VAT status updated: Recorded as not VAT-registered.");
      } else {
        const saved: HostVatRegistrationDTO = data.data;
        setVatRegistrations([saved]);
        setSuccessMsg("VAT registration saved successfully. Submitted for verification.");
      }

      setActiveDrawer(null);
      setVatNumber("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save VAT registration.");
    } finally {
      setActionLoading(false);
    }
  };

  const resolveBadgeVariant = (status?: string) => {
    switch (status) {
      case "VERIFIED":
        return "success";
      case "PENDING_VERIFICATION":
        return "warning";
      case "REJECTED":
        return "error";
      default:
        return "neutral";
    }
  };

  return (
    <div className="space-y-8">
      {/* Alert Banners */}
      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 flex items-start gap-3">
          <AlertTriangleIcon size={18} className="shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-700 hover:text-red-950 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-start gap-3">
          <CheckCircleIcon size={18} className="shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SECTION A: TAXPAYER INFORMATION */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-zinc-950">Taxpayer information</h2>
              {profile && (
                <SettingsStatusBadge
                  label={
                    profile.status === "VERIFIED"
                      ? "Verified"
                      : profile.status === "PENDING_VERIFICATION"
                      ? "Pending Verification"
                      : profile.status === "REJECTED"
                      ? "Action Required"
                      : "Draft"
                  }
                  variant={resolveBadgeVariant(profile.status)}
                />
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-600">
              Tax information may be required depending on your country or region.
            </p>
          </div>

          <button
            onClick={() => {
              setActiveDrawer("TAXPAYER");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shrink-0 self-start"
          >
            {profile ? "Edit Info" : "Add tax info"}
          </button>
        </div>

        {/* Existing Profile Card */}
        {profile ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-4">
              <div>
                <p className="text-sm font-semibold text-zinc-950">{profile.legalName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-800">
                    {profile.taxpayerType === "INDIVIDUAL" ? "Individual Taxpayer" : "Business Entity"}
                  </span>
                  {profile.businessName && (
                    <span className="text-xs text-zinc-600">• {profile.businessName}</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                Country: <strong className="text-zinc-900">{profile.countryCode === "SA" ? "Saudi Arabia (SA)" : profile.countryCode}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-zinc-500">Tax Identifier Type:</span>
                <p className="mt-0.5 font-medium text-zinc-900">
                  {profile.taxIdentifierType === "NIN"
                    ? "Saudi National ID (NIN)"
                    : profile.taxIdentifierType === "IQAMA"
                    ? "Iqama / Residency Number"
                    : profile.taxIdentifierType === "TIN"
                    ? "Tax Identification Number (TIN)"
                    : profile.taxIdentifierType === "CR"
                    ? "Commercial Registration (CR)"
                    : profile.taxIdentifierType}
                </p>
              </div>

              <div>
                <span className="text-zinc-500">Masked Tax ID:</span>
                <p className="mt-0.5 font-mono font-medium text-zinc-900">
                  {profile.maskedTaxIdentifier}
                </p>
              </div>

              <div>
                <span className="text-zinc-500">Last Updated:</span>
                <p className="mt-0.5 text-zinc-700">
                  {new Date(profile.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {profile.addressLine1 && (
              <div className="border-t border-zinc-200 pt-3 text-xs text-zinc-600">
                Registered Address: {profile.addressLine1}
                {profile.city ? `, ${profile.city}` : ""}
                {profile.postalCode ? ` ${profile.postalCode}` : ""}
              </div>
            )}

            {profile.status === "REJECTED" && profile.rejectionReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 flex items-start gap-2">
                <AlertTriangleIcon size={16} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Rejection Note:</strong> {profile.rejectionReason}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center">
            <ReceiptTaxIcon size={28} className="mx-auto text-zinc-400" />
            <p className="mt-2 text-sm font-semibold text-zinc-900">No taxpayer profile added</p>
            <p className="mt-1 text-xs text-zinc-500 max-w-md mx-auto">
              Adding your taxpayer information ensures compliant reporting and prepares your account for annual tax statements.
            </p>
          </div>
        )}
      </div>

      {/* SECTION B: VALUE ADDED TAX (VAT) / GST */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-zinc-950">Value Added Tax (VAT) / GST</h2>
              {activeVat && (
                <SettingsStatusBadge
                  label={
                    activeVat.status === "VERIFIED"
                      ? "Verified"
                      : activeVat.status === "PENDING_VERIFICATION"
                      ? "Pending Verification"
                      : activeVat.status === "REJECTED"
                      ? "Action Required"
                      : "Active"
                  }
                  variant={resolveBadgeVariant(activeVat.status)}
                />
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-600">
              If you&apos;re registered for VAT or GST, add your registration information to your hosting account.
            </p>
          </div>

          <button
            onClick={() => {
              setActiveDrawer("VAT");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors shrink-0 self-start"
          >
            {activeVat ? "Edit VAT/GST" : "Add VAT/GST Number"}
          </button>
        </div>

        {/* Existing VAT Card */}
        {activeVat ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Saudi ZATCA VAT Registration
                </p>
                <p className="mt-1 text-base font-mono font-bold text-zinc-950">
                  {activeVat.registrationNumberMasked}
                </p>
              </div>
              <div className="text-xs text-zinc-600">
                {activeVat.businessName && <span>Registered Entity: <strong>{activeVat.businessName}</strong></span>}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Jurisdiction: Saudi Arabia (ZATCA)</span>
              <span>
                Updated:{" "}
                {new Date(activeVat.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {activeVat.status === "REJECTED" && activeVat.rejectionReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 flex items-start gap-2">
                <AlertTriangleIcon size={16} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong>VAT Rejection Note:</strong> {activeVat.rejectionReason}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 flex items-start gap-3">
            <InfoIcon size={18} className="text-zinc-500 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-600 leading-relaxed">
              <strong>Not registered for VAT/GST:</strong> If you are an individual host earning below the statutory mandatory VAT threshold, you are not required to provide a VAT registration number.
            </div>
          </div>
        )}
      </div>

      {/* DRAWER / MODAL: TAXPAYER FORM */}
      {activeDrawer === "TAXPAYER" && (
        <ModalOverlay
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs"
          onClose={() => setActiveDrawer(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="taxpayer-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col w-full max-w-lg max-h-[min(90vh,760px)] rounded-3xl bg-white shadow-2xl border border-zinc-100 overflow-hidden"
          >
            {/* Pinned Header */}
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 sm:px-8 sm:py-6 bg-white">
              <div>
                <h3 id="taxpayer-modal-title" className="text-lg font-semibold text-zinc-950">
                  {profile ? "Edit Taxpayer Information" : "Add Taxpayer Information"}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Provide your official tax classification and identification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                aria-label="Close dialog"
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              id="taxpayer-profile-form"
              onSubmit={handleSaveTaxpayerProfile}
              className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8 space-y-5"
            >
              {/* Classification Toggle */}
              <div>
                <label className="text-xs font-semibold text-zinc-900 block mb-2">
                  Taxpayer Classification
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTaxpayerType("INDIVIDUAL")}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${
                      taxpayerType === "INDIVIDUAL"
                        ? "border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <p className="text-xs font-bold text-zinc-950">Individual</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">Hosting as a private individual</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaxpayerType("BUSINESS")}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${
                      taxpayerType === "BUSINESS"
                        ? "border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <p className="text-xs font-bold text-zinc-950">Business Entity</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">Commercial company / establishment</p>
                  </button>
                </div>
              </div>

              {/* Legal Name */}
              <div>
                <label className="text-xs font-semibold text-zinc-900 block">
                  Legal Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Official legal name as on ID"
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                />
              </div>

              {/* Business Name & CR if business */}
              {taxpayerType === "BUSINESS" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-zinc-900 block">
                      Registered Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Company or Establishment Trade Name"
                      className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-900 block">
                      Commercial Registration (CR) Number
                    </label>
                    <input
                      type="text"
                      value={businessRegistrationNumber}
                      onChange={(e) => setBusinessRegistrationNumber(e.target.value)}
                      placeholder="10-digit Saudi CR Number"
                      className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Country & ID Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-900 block">
                    Tax Country
                  </label>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  >
                    <option value="SA">Saudi Arabia (SA)</option>
                    <option value="AE">United Arab Emirates (AE)</option>
                    <option value="BH">Bahrain (BH)</option>
                    <option value="KW">Kuwait (KW)</option>
                    <option value="OM">Oman (OM)</option>
                    <option value="QA">Qatar (QA)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-900 block">
                    Identifier Type
                  </label>
                  <select
                    value={taxIdentifierType}
                    onChange={(e) => setTaxIdentifierType(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  >
                    {countryCode === "SA" ? (
                      <>
                        <option value="NIN">Saudi National ID (NIN)</option>
                        <option value="IQAMA">Iqama / Residency ID</option>
                        <option value="TIN">Taxpayer TIN (10-digit)</option>
                        <option value="CR">Commercial Registration (CR)</option>
                      </>
                    ) : (
                      <option value="OTHER">Tax Identifier / Registration ID</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Tax Identifier Input */}
              <div>
                <label className="text-xs font-semibold text-zinc-900 block">
                  {taxIdentifierType === "NIN"
                    ? "National ID Number (10 digits starting with 1)"
                    : taxIdentifierType === "IQAMA"
                    ? "Iqama Number (10 digits starting with 2)"
                    : taxIdentifierType === "TIN"
                    ? "Taxpayer TIN (10 digits starting with 3)"
                    : "Tax Identification Number"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required={!profile}
                  value={taxIdentifier}
                  onChange={(e) => setTaxIdentifier(e.target.value)}
                  placeholder={
                    profile
                      ? `Leave blank to retain (${profile.maskedTaxIdentifier})`
                      : "Enter tax identification number"
                  }
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs text-zinc-950 focus:outline-none ${
                    taxIdentifier && !taxIdValidation.valid
                      ? "border-red-400 focus:border-red-500 bg-red-50/20"
                      : "border-zinc-300 focus:border-zinc-950"
                  }`}
                />
                {taxIdentifier && !taxIdValidation.valid && (
                  <p className="mt-1 text-[11px] text-red-600 font-medium">
                    {taxIdValidation.error}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-zinc-500">
                  Encrypted using AES-256-GCM. Never exposed in full in plain text.
                </p>
              </div>

              {/* Address Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-900 block">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Riyadh"
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-900 block">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="e.g. 12345"
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>
              </div>
            </form>

            {/* Pinned Footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4 sm:px-8 bg-zinc-50/80">
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                disabled={actionLoading}
                className="rounded-full px-5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200/70 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="taxpayer-profile-form"
                disabled={!isTaxpayerFormValid || actionLoading}
                className="rounded-full bg-zinc-950 px-6 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {actionLoading ? "Saving..." : "Save Information"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* DRAWER / MODAL: VAT REGISTRATION FORM */}
      {activeDrawer === "VAT" && (
        <ModalOverlay
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs"
          onClose={() => setActiveDrawer(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vat-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col w-full max-w-lg max-h-[min(90vh,760px)] rounded-3xl bg-white shadow-2xl border border-zinc-100 overflow-hidden"
          >
            {/* Pinned Header */}
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 sm:px-8 sm:py-6 bg-white">
              <div>
                <h3 id="vat-modal-title" className="text-lg font-semibold text-zinc-950">
                  VAT / GST Registration
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Value Added Tax registration for hospitality hosting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                aria-label="Close dialog"
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              id="vat-registration-form"
              onSubmit={handleSaveVatRegistration}
              className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8 space-y-5"
            >
              {/* Checkbox: Is VAT Registered */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVatRegistered}
                    onChange={(e) => setIsVatRegistered(e.target.checked)}
                    className="size-4 mt-0.5 rounded text-zinc-950 focus:ring-zinc-950"
                  />
                  <div>
                    <span className="text-xs font-semibold text-zinc-950">
                      I am registered for VAT / GST in this jurisdiction
                    </span>
                    <p className="mt-0.5 text-[11px] text-zinc-500 leading-relaxed">
                      Uncheck if you are an individual property owner not subject to mandatory VAT registration.
                    </p>
                  </div>
                </label>
              </div>

              {isVatRegistered && (
                <>
                  {/* VAT Number */}
                  <div>
                    <label className="text-xs font-semibold text-zinc-900 block">
                      Saudi ZATCA 15-Digit VAT Registration Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={isVatRegistered}
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder={activeVat ? `Current: ${activeVat.registrationNumberMasked}` : "e.g. 300123456700003"}
                      className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-mono text-zinc-950 focus:outline-none ${
                        vatNumber && !vatValidation.valid
                          ? "border-red-400 focus:border-red-500 bg-red-50/20"
                          : "border-zinc-300 focus:border-zinc-950"
                      }`}
                    />
                    {vatNumber && !vatValidation.valid && (
                      <p className="mt-1 text-[11px] text-red-600 font-medium">
                        {vatValidation.error}
                      </p>
                    )}
                    <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900">
                      <strong>Important:</strong> Enter your 15-digit VAT number (which begins and ends with digit 3). Do NOT enter your 10-digit TIN here.
                    </div>
                  </div>

                  {/* Registered Business Name */}
                  <div>
                    <label className="text-xs font-semibold text-zinc-900 block">
                      Registered Business / Tax Name
                    </label>
                    <input
                      type="text"
                      value={vatBusinessName}
                      onChange={(e) => setVatBusinessName(e.target.value)}
                      placeholder="Legal entity name matching VAT certificate"
                      className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    />
                  </div>

                  {/* Document URL */}
                  <div>
                    <label className="text-xs font-semibold text-zinc-900 block">
                      VAT Certificate Document URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={vatDocumentUrl}
                      onChange={(e) => setVatDocumentUrl(e.target.value)}
                      placeholder="https://..."
                      className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </form>

            {/* Pinned Footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4 sm:px-8 bg-zinc-50/80">
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                disabled={actionLoading}
                className="rounded-full px-5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200/70 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="vat-registration-form"
                disabled={!isVatFormValid || actionLoading}
                className="rounded-full bg-zinc-950 px-6 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {actionLoading ? "Saving..." : "Save VAT Registration"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

