"use client";

import React, { useState } from "react";
import { toast } from "@/components/ui/toast";
import { COUNTRY_CODES, getCountryByCallingCode } from "@/lib/auth/country-codes";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type {
  AddressData,
  EmergencyContactData,
  PersonalInfoDTO,
} from "@/services/personal-info.service";
import {
  updateLegalNameAction,
  updatePreferredNameAction,
  updateEmailAction,
  updatePhoneAction,
  updateResidentialAddressAction,
  updatePostalAddressAction,
  updateEmergencyContactAction,
} from "@/actions/user/personal-info";
import { PersonalInfoSkeleton } from "@/components/dashboard/section-skeletons";
import { useLanguage } from "@/lib/i18n/language-context";

interface PersonalInfoViewProps {
  initialData?: PersonalInfoDTO | null;
}

const defaultData: PersonalInfoDTO = {
  legalFirstName: "",
  legalLastName: "",
  legalName: "",
  preferredFirstName: "",
  email: "",
  phone: "",
  identityStatus: "NOT_STARTED",
  residentialAddress: null,
  postalAddress: null,
  sameAsResidential: true,
  emergencyContact: null,
};

// Helpers for masking sensitive information
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "Not provided";
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone || !phone.trim()) return "Not provided";
  const cleaned = phone.trim();
  if (cleaned.startsWith("+")) {
    const parts = cleaned.split(" ");
    if (parts.length >= 2) {
      const countryCode = parts[0];
      const rest = parts.slice(1).join("");
      if (rest.length > 4) {
        const last4 = rest.slice(-4);
        return `${countryCode} ***** *${last4}`;
      }
      return `${countryCode} *****`;
    }
    const match = cleaned.match(/^(\+\d{1,4})(\d+)$/);
    if (match) {
      const code = match[1];
      const rest = match[2];
      const last4 = rest.length > 4 ? rest.slice(-4) : rest;
      return `${code} ***** *${last4}`;
    }
  }
  if (cleaned.length > 4) {
    const last4 = cleaned.slice(-4);
    return `***** *${last4}`;
  }
  return cleaned;
}

export function PersonalInfoView({ initialData }: PersonalInfoViewProps) {
  const { t } = useLanguage();
  const [data, setData] = useState<PersonalInfoDTO>(initialData || defaultData);
  const [loading, setLoading] = useState<boolean>(!initialData);

  React.useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
    } else {
      setLoading(true);
      fetch("/api/v1/users/personal-info")
        .then((res) => res.json())
        .then((json) => {
          if (json.ok && json.data) {
            setData(json.data);
          }
        })
        .catch((err) => console.error("Failed to load personal info:", err))
        .finally(() => setLoading(false));
    }
  }, [initialData]);

  // Active edit row tracking
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 1. Legal Name form state
  const [legalFirst, setLegalFirst] = useState(data.legalFirstName);
  const [legalLast, setLegalLast] = useState(data.legalLastName);

  // 2. Preferred Name form state
  const [prefFirst, setPrefFirst] = useState(data.preferredFirstName);

  // 3. Email form state
  const [emailVal, setEmailVal] = useState(data.email);

  // 4. Phone form state
  const initialPhoneCountry =
    COUNTRY_CODES.find((c) => data.phone.startsWith(c.code))?.code || "+91";
  const initialPhoneNumber = data.phone.startsWith(initialPhoneCountry)
    ? data.phone.slice(initialPhoneCountry.length).trim()
    : data.phone.replace(/^\+\d+\s*/, "");

  const [phoneCountry, setPhoneCountry] = useState(initialPhoneCountry);
  const [phoneNum, setPhoneNum] = useState(initialPhoneNumber);

  // 5. Identity Verification Modal & Document Upload
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [idDocType, setIdDocType] = useState<"passport" | "license" | "national_id">("passport");
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // 6. Residential Address form state
  const [resCountry, setResCountry] = useState(data.residentialAddress?.country || "United States");
  const [resStreet, setResStreet] = useState(data.residentialAddress?.street || "");
  const [resApt, setResApt] = useState(data.residentialAddress?.apt || "");
  const [resCity, setResCity] = useState(data.residentialAddress?.city || "");
  const [resState, setResState] = useState(data.residentialAddress?.state || "");
  const [resPostal, setResPostal] = useState(data.residentialAddress?.postalCode || "");

  // 7. Postal Address form state
  const [sameAsRes, setSameAsRes] = useState(data.sameAsResidential);
  const [postCountry, setPostCountry] = useState(data.postalAddress?.country || "United States");
  const [postStreet, setPostStreet] = useState(data.postalAddress?.street || "");
  const [postApt, setPostApt] = useState(data.postalAddress?.apt || "");
  const [postCity, setPostCity] = useState(data.postalAddress?.city || "");
  const [postState, setPostState] = useState(data.postalAddress?.state || "");
  const [postPostal, setPostPostal] = useState(data.postalAddress?.postalCode || "");

  // 8. Emergency Contact form state
  const [emName, setEmName] = useState(data.emergencyContact?.name || "");
  const [emRelationship, setEmRelationship] = useState(data.emergencyContact?.relationship || "Family");
  const [emCountryCode, setEmCountryCode] = useState(data.emergencyContact?.countryCode || "+1");
  const [emPhone, setEmPhone] = useState(data.emergencyContact?.phoneNumber || "");
  const [emEmail, setEmEmail] = useState(data.emergencyContact?.email || "");
  const [emLang, setEmLang] = useState(data.emergencyContact?.preferredLanguage || "English");

  React.useEffect(() => {
    if (!data) return;
    setLegalFirst(data.legalFirstName || "");
    setLegalLast(data.legalLastName || "");
    setPrefFirst(data.preferredFirstName || "");
    setEmailVal(data.email || "");

    const pCountry = COUNTRY_CODES.find((c) => data.phone?.startsWith(c.code))?.code || "+91";
    const pNum = data.phone?.startsWith(pCountry)
      ? data.phone.slice(pCountry.length).trim()
      : (data.phone || "").replace(/^\+\d+\s*/, "");
    setPhoneCountry(pCountry);
    setPhoneNum(pNum);

    setResCountry(data.residentialAddress?.country || "United States");
    setResStreet(data.residentialAddress?.street || "");
    setResApt(data.residentialAddress?.apt || "");
    setResCity(data.residentialAddress?.city || "");
    setResState(data.residentialAddress?.state || "");
    setResPostal(data.residentialAddress?.postalCode || "");

    setSameAsRes(data.sameAsResidential ?? true);
    setPostCountry(data.postalAddress?.country || "United States");
    setPostStreet(data.postalAddress?.street || "");
    setPostApt(data.postalAddress?.apt || "");
    setPostCity(data.postalAddress?.city || "");
    setPostState(data.postalAddress?.state || "");
    setPostPostal(data.postalAddress?.postalCode || "");

    setEmName(data.emergencyContact?.name || "");
    setEmRelationship(data.emergencyContact?.relationship || "Family");
    setEmCountryCode(data.emergencyContact?.countryCode || "+1");
    setEmPhone(data.emergencyContact?.phoneNumber || "");
    setEmEmail(data.emergencyContact?.email || "");
    setEmLang(data.emergencyContact?.preferredLanguage || "English");
  }, [data]);

  const openEditRow = (rowName: string) => {
    setActiveRow(rowName);
    setFieldErrors({});
  };

  const closeEditRow = () => {
    setActiveRow(null);
    setFieldErrors({});
  };

  // Handlers for saves
  const handleSaveLegalName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalFirst.trim()) {
      setFieldErrors({ firstName: "First name is required" });
      return;
    }
    if (!legalLast.trim()) {
      setFieldErrors({ lastName: "Last name is required" });
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await updateLegalNameAction({
        firstName: legalFirst,
        lastName: legalLast,
      });

      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast.error(res.error, { title: "Update failed" });
        return;
      }

      setData(res.data);
      closeEditRow();
      toast.success("Legal name updated successfully");
    } catch {
      toast.error("Please try again later.", { title: "An error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePreferredName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await updatePreferredNameAction({
        preferredFirstName: prefFirst,
      });

      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast.error(res.error, { title: "Update failed" });
        return;
      }

      setData(res.data);
      closeEditRow();
      toast.success("Preferred name updated");
    } catch {
      toast.error("Please try again later.", { title: "An error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailVal.trim() || !emailVal.includes("@")) {
      setFieldErrors({ email: "Please enter a valid email address" });
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await updateEmailAction({ email: emailVal });

      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast.error(res.error, { title: "Update failed" });
        return;
      }

      setData(res.data);
      closeEditRow();
      toast.success("Email updated successfully");
    } catch {
      toast.error("Please try again later.", { title: "An error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = phoneNum.trim().replace(/^0+/, "");
    if (!cleanNum) {
      setFieldErrors({ phone: "Please enter your phone number" });
      return;
    }

    const fullPhone = `${phoneCountry} ${cleanNum}`;
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await updatePhoneAction({ phone: fullPhone });

      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast.error(res.error, { title: "Update failed" });
        return;
      }

      setData(res.data);
      closeEditRow();
      toast.success("Phone number updated successfully");
    } catch {
      toast.error("Please try again later.", { title: "An error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveResidentialAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await updateResidentialAddressAction({
        country: resCountry,
        street: resStreet,
        apt: resApt,
        city: resCity,
        state: resState,
        postalCode: resPostal,
      });

      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast.error(res.error, { title: "Update failed" });
        return;
      }

      setData(res.data);
      closeEditRow();
      toast.success("Residential address saved");
    } catch {
      toast.error("Please try again.", { title: "An error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePostalAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await updatePostalAddressAction({
        sameAsResidential: sameAsRes,
        country: sameAsRes ? resCountry : postCountry,
        street: sameAsRes ? resStreet : postStreet,
        apt: sameAsRes ? resApt : postApt,
        city: sameAsRes ? resCity : postCity,
        state: sameAsRes ? resState : postState,
        postalCode: sameAsRes ? resPostal : postPostal,
      });

      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast.error(res.error, { title: "Update failed" });
        return;
      }

      setData(res.data);
      closeEditRow();
      toast.success("Postal address saved");
    } catch {
      toast.error("Please try again.", { title: "An error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEmergencyContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emName.trim()) {
      setFieldErrors({ name: "Contact name is required" });
      return;
    }
    if (!emPhone.trim()) {
      setFieldErrors({ phoneNumber: "Phone number is required" });
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await updateEmergencyContactAction({
        name: emName,
        relationship: emRelationship,
        countryCode: emCountryCode,
        phoneNumber: emPhone,
        email: emEmail || undefined,
        preferredLanguage: emLang,
      });

      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        toast.error(res.error, { title: "Update failed" });
        return;
      }

      setData(res.data);
      closeEditRow();
      toast.success("Emergency contact saved");
    } catch {
      toast.error("Please try again.", { title: "An error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocFileSelect = (file: File | null) => {
    setDocUploadError(null);
    if (!file) {
      setSelectedDocFile(null);
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setDocUploadError("Please select a JPEG, PNG, WebP image or PDF document.");
      return;
    }

    const maxBytes = 15 * 1024 * 1024; // 15MB
    if (file.size > maxBytes) {
      setDocUploadError("File size exceeds 15 MB limit. Please choose a smaller file.");
      return;
    }

    setSelectedDocFile(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUploadDocument = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedDocFile) {
      setDocUploadError("Please select a document file to upload.");
      return;
    }

    setIsUploadingDoc(true);
    setDocUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedDocFile);
      formData.append("documentType", idDocType);

      const response = await fetch(
        "/api/v1/users/personal-info/identity-document",
        {
          method: "POST",
          body: formData,
        },
      );
      const result = (await response.json().catch(() => null)) as
        | {
            success: true;
            data: PersonalInfoDTO;
          }
        | {
            success: false;
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !result?.success) {
        const message =
          response.status === 413
            ? "File size exceeds 15 MB. Please choose a smaller document."
            : result && !result.success && result.error?.message
              ? result.error.message
              : "Failed to upload document. Please try again.";
        setDocUploadError(message);
        toast.error(message, { title: "Upload failed" });
        return;
      }

      setData(result.data);
      setSelectedDocFile(null);
      setIdentityModalOpen(false);
      toast.success(
        "Your document has been submitted and is currently under review by our verification team.",
        { title: "Document submitted" },
      );
    } catch {
      setDocUploadError("An error occurred while uploading. Please try again.");
      toast.error("Please try again later.", { title: "Upload failed" });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const maskEmailLoc = (email: string | null | undefined): string => {
    if (!email || !email.includes("@")) return t("personal_info_not_provided", "Not provided");
    return maskEmail(email);
  };

  const maskPhoneLoc = (phone: string | null | undefined): string => {
    if (!phone || !phone.trim()) return t("personal_info_not_provided", "Not provided");
    return maskPhone(phone);
  };

  const formatAddressPreviewLoc = (addr: AddressData | null): string => {
    if (!addr || (!addr.street && !addr.city && !addr.country)) return t("personal_info_not_provided", "Not provided");
    return t("personal_info_provided", "Provided");
  };

  if (loading) {
    return <PersonalInfoSkeleton />;
  }

  return (
    <div className="w-full max-w-2xl text-[#1F1F1F]">
      {/* Page Title */}
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1F1F1F] mb-6">
        {t("personal_info_title", "Personal information")}
      </h1>

      {/* Rows Container */}
      <div className="divide-y divide-zinc-200">
        {/* ========================================================= */}
        {/* ROW 1: Legal name */}
        {/* ========================================================= */}
        <div className="py-5">
          {activeRow === "legalName" ? (
            <form onSubmit={handleSaveLegalName} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-[#1F1F1F]">{t("personal_info_legal_name", "Legal name")}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t("personal_info_legal_name_desc", "This is the name on your travel document, which could be a license or a passport.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
                >
                  {t("personal_info_cancel", "Cancel")}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_first_name", "First name")}</label>
                  <input
                    type="text"
                    value={legalFirst}
                    onChange={(e) => setLegalFirst(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none transition-colors"
                    placeholder={t("personal_info_first_name", "First name")}
                    required
                  />
                  {fieldErrors.firstName && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.firstName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_last_name", "Last name")}</label>
                  <input
                    type="text"
                    value={legalLast}
                    onChange={(e) => setLegalLast(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none transition-colors"
                    placeholder={t("personal_info_last_name", "Last name")}
                    required
                  />
                  {fieldErrors.lastName && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t("personal_info_saving", "Saving...") : t("personal_info_save", "Save")}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium text-[#1F1F1F]">{t("personal_info_legal_name", "Legal name")}</div>
                <div className="text-sm text-zinc-500 mt-0.5 truncate">
                  {data.legalName || t("personal_info_not_provided", "Not provided")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEditRow("legalName")}
                className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
              >
                {t("personal_info_edit", "Edit")}
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ROW 2: Preferred first name */}
        {/* ========================================================= */}
        <div className="py-5">
          {activeRow === "preferredName" ? (
            <form onSubmit={handleSavePreferredName} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-[#1F1F1F]">{t("personal_info_preferred_name", "Preferred first name")}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t("personal_info_preferred_name_desc", "This is how your first name will appear to hosts and guests.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
                >
                  {t("personal_info_cancel", "Cancel")}
                </button>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  {t("personal_info_preferred_name", "Preferred first name")}
                </label>
                <input
                  type="text"
                  value={prefFirst}
                  onChange={(e) => setPrefFirst(e.target.value)}
                  className="w-full sm:max-w-md rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none transition-colors"
                  placeholder={t("personal_info_preferred_name_ph", "e.g. Shihab")}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t("personal_info_saving", "Saving...") : t("personal_info_save", "Save")}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium text-[#1F1F1F]">{t("personal_info_preferred_name", "Preferred first name")}</div>
                <div className="text-sm text-zinc-500 mt-0.5 truncate">
                  {data.preferredFirstName || t("personal_info_not_provided", "Not provided")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEditRow("preferredName")}
                className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
              >
                {data.preferredFirstName ? t("personal_info_edit", "Edit") : t("personal_info_add", "Add")}
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ROW 3: Email address */}
        {/* ========================================================= */}
        <div className="py-5">
          {activeRow === "email" ? (
            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-[#1F1F1F]">{t("personal_info_email", "Email address")}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t("personal_info_email_desc", "Use an address you’ll always have access to.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
                >
                  {t("personal_info_cancel", "Cancel")}
                </button>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_email", "Email address")}</label>
                <input
                  type="email"
                  value={emailVal}
                  onChange={(e) => setEmailVal(e.target.value)}
                  className="w-full sm:max-w-md rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none transition-colors"
                  placeholder="name@example.com"
                  required
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t("personal_info_saving", "Saving...") : t("personal_info_save", "Save")}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium text-[#1F1F1F]">{t("personal_info_email", "Email address")}</div>
                <div className="text-sm text-zinc-500 mt-0.5 truncate">
                  {maskEmailLoc(data.email)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEditRow("email")}
                className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
              >
                {t("personal_info_edit", "Edit")}
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ROW 4: Phone number */}
        {/* ========================================================= */}
        <div className="py-5">
          {activeRow === "phone" ? (
            <form onSubmit={handleSavePhone} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-[#1F1F1F]">{t("personal_info_phone", "Phone number")}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t("personal_info_phone_desc", "For notifications, reminders, and help logging in.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
                >
                  {t("personal_info_cancel", "Cancel")}
                </button>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 max-w-md">
                <div className="w-full sm:w-44">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_country_code", "Country code")}</label>
                  <select
                    value={phoneCountry}
                    onChange={(e) => setPhoneCountry(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                  >
                    {COUNTRY_CODES.map((c, idx) => (
                      <option key={`${c.iso2}-${idx}`} value={c.code}>
                        {c.flag} {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_phone", "Phone number")}</label>
                  <input
                    type="tel"
                    value={phoneNum}
                    onChange={(e) => setPhoneNum(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                    placeholder="98765 43210"
                    required
                  />
                </div>
              </div>
              {fieldErrors.phone && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t("personal_info_saving", "Saving...") : t("personal_info_save", "Save")}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium text-[#1F1F1F]">{t("personal_info_phone", "Phone number")}</div>
                <div className="text-sm text-zinc-500 mt-0.5">
                  {maskPhoneLoc(data.phone)}
                </div>
                <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {t("personal_info_phone_note", "Contact number (for confirmed guests and Homyz to get in touch). You can add other numbers and choose how they're used.")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEditRow("phone")}
                className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
              >
                {data.phone ? t("personal_info_edit", "Edit") : t("personal_info_add", "Add")}
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ROW 5: Identity verification */}
        {/* ========================================================= */}
        <div className="py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-base font-medium text-[#1F1F1F]">{t("personal_info_gov_id", "Identity verification")}</div>
              <div className="text-sm mt-1">
                {data.identityStatus === "VERIFIED" ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {t("personal_info_status_verified", "Verified")}
                    </span>
                    {data.identityDocument?.fileName && (
                      <p className="text-xs text-zinc-500">
                        {t("personal_info_official_id", "Official ID:")} <span className="font-medium text-zinc-700">{data.identityDocument.fileName}</span>
                      </p>
                    )}
                  </div>
                ) : data.identityStatus === "PENDING" ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" />
                      </svg>
                      {t("personal_info_status_pending", "Pending review")}
                    </span>
                    {data.identityDocument?.fileName && (
                      <p className="text-xs text-zinc-500">
                        {t("personal_info_uploaded", "Uploaded:")} <span className="font-medium text-zinc-700">{data.identityDocument.fileName}</span>
                        <span className="text-zinc-400"> ({t("personal_info_under_review", "Under review")})</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-zinc-500">{t("personal_info_not_provided", "Not provided")}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedDocFile(null);
                setDocUploadError(null);
                setIdentityModalOpen(true);
              }}
              className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
            >
              {data.identityStatus === "NOT_STARTED"
                ? t("personal_info_id_start", "Start")
                : data.identityStatus === "PENDING"
                ? t("personal_info_id_update", "Update ID")
                : t("personal_info_id_manage", "Manage")}
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* ROW 6: Residential address */}
        {/* ========================================================= */}
        <div className="py-5">
          {activeRow === "residentialAddress" ? (
            <form onSubmit={handleSaveResidentialAddress} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-[#1F1F1F]">{t("personal_info_residential_address", "Residential address")}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t("personal_info_residential_address_desc", "Your residential address is kept private and not shared publicly.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
                >
                  {t("personal_info_cancel", "Cancel")}
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_country", "Country / Region")}</label>
                  <input
                    type="text"
                    value={resCountry}
                    onChange={(e) => setResCountry(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                    placeholder={t("personal_info_country", "Country / Region")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_street", "Street address")}</label>
                  <input
                    type="text"
                    value={resStreet}
                    onChange={(e) => setResStreet(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                    placeholder={t("personal_info_street_ph", "House number and street name")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    {t("personal_info_apt", "Flat, suite, unit (optional)")}
                  </label>
                  <input
                    type="text"
                    value={resApt}
                    onChange={(e) => setResApt(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                    placeholder="Apt, Suite, Bldg"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_city", "City")}</label>
                    <input
                      type="text"
                      value={resCity}
                      onChange={(e) => setResCity(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder={t("personal_info_city", "City")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_state", "State / Province")}</label>
                    <input
                      type="text"
                      value={resState}
                      onChange={(e) => setResState(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder={t("personal_info_state", "State / Province")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_postal_code", "Postal code")}</label>
                    <input
                      type="text"
                      value={resPostal}
                      onChange={(e) => setResPostal(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder={t("personal_info_postal_code", "Postal code")}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t("personal_info_saving", "Saving...") : t("personal_info_save", "Save")}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium text-[#1F1F1F]">{t("personal_info_residential_address", "Residential address")}</div>
                <div className="text-sm text-zinc-500 mt-0.5">
                  {formatAddressPreviewLoc(data.residentialAddress)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEditRow("residentialAddress")}
                className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
              >
                {data.residentialAddress ? t("personal_info_edit", "Edit") : t("personal_info_add", "Add")}
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ROW 7: Postal address */}
        {/* ========================================================= */}
        <div className="py-5">
          {activeRow === "postalAddress" ? (
            <form onSubmit={handleSavePostalAddress} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-[#1F1F1F]">{t("personal_info_postal_address", "Postal address")}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t("personal_info_postal_address_desc", "Where you receive physical correspondence.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
                >
                  {t("personal_info_cancel", "Cancel")}
                </button>
              </div>

              {/* Same as residential checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sameAsRes}
                    onChange={(e) => setSameAsRes(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-[#1F1F1F] focus:ring-zinc-900 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-[#1F1F1F]">
                    {t("personal_info_same_as_residential", "Same as residential address")}
                  </span>
                </label>
              </div>

              {!sameAsRes ? (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_country", "Country / Region")}</label>
                    <input
                      type="text"
                      value={postCountry}
                      onChange={(e) => setPostCountry(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder={t("personal_info_country", "Country / Region")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_street", "Street address")}</label>
                    <input
                      type="text"
                      value={postStreet}
                      onChange={(e) => setPostStreet(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder={t("personal_info_street", "Street address")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      {t("personal_info_apt", "Flat, suite, unit (optional)")}
                    </label>
                    <input
                      type="text"
                      value={postApt}
                      onChange={(e) => setPostApt(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder="Apt, Suite"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_city", "City")}</label>
                      <input
                        type="text"
                        value={postCity}
                        onChange={(e) => setPostCity(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                        placeholder={t("personal_info_city", "City")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_state", "State / Province")}</label>
                      <input
                        type="text"
                        value={postState}
                        onChange={(e) => setPostState(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                        placeholder={t("personal_info_state", "State / Province")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_postal_code", "Postal code")}</label>
                      <input
                        type="text"
                        value={postPostal}
                        onChange={(e) => setPostPostal(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                        placeholder={t("personal_info_postal_code", "Postal code")}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                  {t("personal_info_using_residential", "Using your residential address as your postal address.")}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t("personal_info_saving", "Saving...") : t("personal_info_save", "Save")}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium text-[#1F1F1F]">{t("personal_info_postal_address", "Postal address")}</div>
                <div className="text-sm text-zinc-500 mt-0.5">
                  {data.sameAsResidential
                    ? t("personal_info_provided", "Provided")
                    : formatAddressPreviewLoc(data.postalAddress)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEditRow("postalAddress")}
                className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
              >
                {data.postalAddress || data.sameAsResidential ? t("personal_info_edit", "Edit") : t("personal_info_add", "Add")}
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ROW 8: Emergency contact */}
        {/* ========================================================= */}
        <div className="py-5">
          {activeRow === "emergencyContact" ? (
            <form onSubmit={handleSaveEmergencyContact} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-[#1F1F1F]">{t("personal_info_emergency_contact", "Emergency contact")}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t("personal_info_emergency_contact_desc", "A trusted contact we can alert in an urgent situation.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditRow}
                  className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
                >
                  {t("personal_info_cancel", "Cancel")}
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_contact_name", "Contact name")}</label>
                    <input
                      type="text"
                      value={emName}
                      onChange={(e) => setEmName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder={t("personal_info_contact_name", "Contact name")}
                      required
                    />
                    {fieldErrors.name && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_relationship", "Relationship")}</label>
                    <input
                      type="text"
                      value={emRelationship}
                      onChange={(e) => setEmRelationship(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder={t("personal_info_relationship_ph", "e.g. Spouse, Parent, Friend")}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-44">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_country_code", "Country code")}</label>
                    <select
                      value={emCountryCode}
                      onChange={(e) => setEmCountryCode(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                    >
                      {COUNTRY_CODES.map((c, idx) => (
                        <option key={`${c.iso2}-${idx}`} value={c.code}>
                          {c.flag} {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t("personal_info_phone", "Phone number")}</label>
                    <input
                      type="tel"
                      value={emPhone}
                      onChange={(e) => setEmPhone(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder={t("personal_info_phone", "Phone number")}
                      required
                    />
                    {fieldErrors.phoneNumber && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.phoneNumber}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      {t("personal_info_contact_email_opt", "Email address (optional)")}
                    </label>
                    <input
                      type="email"
                      value={emEmail}
                      onChange={(e) => setEmEmail(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      {t("personal_info_contact_lang_opt", "Preferred language (optional)")}
                    </label>
                    <input
                      type="text"
                      value={emLang}
                      onChange={(e) => setEmLang(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-zinc-900 focus:outline-none"
                      placeholder="e.g. English"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t("personal_info_saving", "Saving...") : t("personal_info_save", "Save")}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium text-[#1F1F1F]">{t("personal_info_emergency_contact", "Emergency contact")}</div>
                <div className="text-sm text-zinc-500 mt-0.5 truncate">
                  {data.emergencyContact
                    ? `${data.emergencyContact.name} (${data.emergencyContact.relationship})`
                    : t("personal_info_not_provided", "Not provided")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEditRow("emergencyContact")}
                className="text-sm font-semibold underline text-[#1F1F1F] hover:opacity-75 cursor-pointer shrink-0"
              >
                {data.emergencyContact ? t("personal_info_edit", "Edit") : t("personal_info_add", "Add")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* Informational / Privacy Card matching Reference UI */}
      {/* ========================================================= */}
      <div className="mt-10 rounded-2xl border border-zinc-200/90 bg-white p-6 space-y-6">
        {/* Item 1 */}
        <div className="flex items-start gap-4">
          <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-pink-50 text-[#E51D54]">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-4.5 1.5-8.25 1.5-8.25 1.5v7.5c0 5.25 3.75 9.75 8.25 10.5 4.5-.75 8.25-5.25 8.25-10.5V3.75s-3.75 0-8.25-1.5z" />
              <rect x="9.5" y="11" width="5" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 11V9.5a1.5 1.5 0 013 0V11" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#1F1F1F]">
              {t("personal_info_card_why_title", "Why isn’t my info shown here?")}
            </h4>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              {t("personal_info_card_why_desc", "We’re hiding some account details to protect your identity.")}
            </p>
          </div>
        </div>

        <div className="border-b border-zinc-100" />

        {/* Item 2 */}
        <div className="flex items-start gap-4">
          <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-pink-50 text-[#E51D54]">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="10" width="14" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10V7a4 4 0 118 0v3" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#1F1F1F]">
              {t("personal_info_card_edit_title", "Which details can be edited?")}
            </h4>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              {t("personal_info_card_edit_desc", "Contact info and personal details can be edited. If this info was used to verify your identity, you’ll need to get verified again the next time you book – or to continue hosting.")}
            </p>
          </div>
        </div>

        <div className="border-b border-zinc-100" />

        {/* Item 3 */}
        <div className="flex items-start gap-4">
          <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-pink-50 text-[#E51D54]">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#1F1F1F]">
              {t("personal_info_card_share_title", "What info is shared with others?")}
            </h4>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              {t("personal_info_card_share_desc", "Homyz only releases contact information for Hosts and guests after a reservation is confirmed.")}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Identity Verification Modal */}
      {/* ========================================================= */}
      {identityModalOpen && (
        <ModalOverlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="identity-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 id="identity-modal-title" className="text-lg font-semibold text-[#1F1F1F]">
                  {t("personal_info_modal_id_title", "Identity Verification")}
                </h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  {t("personal_info_modal_id_desc", "Upload an official government-issued ID to verify your identity. Your document will be securely stored and reviewed by our verification team.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIdentityModalOpen(false);
                  setSelectedDocFile(null);
                  setDocUploadError(null);
                }}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                aria-label={t("personal_info_close", "Close")}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current Status banner */}
            {data.identityStatus === "VERIFIED" ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                  <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t("personal_info_modal_id_verified_title", "Identity Verified")}
                </div>
                <p>
                  {t("personal_info_modal_id_verified_desc", "Your identity has been verified by the Homyz team.")}
                  {data.identityDocument?.fileName && (
                    <> Verified document: <span className="font-semibold">{data.identityDocument.fileName}</span>.</>
                  )}
                </p>
              </div>
            ) : data.identityStatus === "PENDING" ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                  <svg className="w-4 h-4 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" />
                  </svg>
                  {t("personal_info_modal_id_pending_title", "Pending Administrative Review")}
                </div>
                <p>
                  {t("personal_info_modal_id_pending_desc", "Your document is currently under review by our verification team.")}
                  {data.identityDocument?.fileName && (
                    <> Current submission: <span className="font-semibold">{data.identityDocument.fileName}</span>.</>
                  )}
                </p>
              </div>
            ) : null}

            {/* Document Selection */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
                {t("personal_info_modal_choose_doc_type", "Choose ID Document Type")}
              </label>
              {[
                { id: "passport", label: t("personal_info_doc_passport", "Passport"), desc: t("personal_info_doc_passport_desc", "Most international travelers") },
                { id: "license", label: t("personal_info_doc_license", "Driver’s License"), desc: t("personal_info_doc_license_desc", "National or state driving license") },
                { id: "national_id", label: t("personal_info_doc_national_id", "National ID Card"), desc: t("personal_info_doc_national_id_desc", "Government issued identity card") },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    idDocType === opt.id
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-[#1F1F1F]">{opt.label}</p>
                    <p className="text-xs text-[#727272]">{opt.desc}</p>
                  </div>
                  <input
                    type="radio"
                    name="idDocType"
                    checked={idDocType === opt.id}
                    onChange={() => setIdDocType(opt.id as any)}
                    className="w-4 h-4 text-[#1F1F1F] focus:ring-zinc-900"
                  />
                </label>
              ))}
            </div>

            {/* File Upload / Dropzone */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
                {t("personal_info_modal_upload_file", "Upload Document File")}
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  handleDocFileSelect(file);
                }}
              />

              {!selectedDocFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(true);
                  }}
                  onDragLeave={() => setIsDraggingDoc(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(false);
                    const file = e.dataTransfer.files?.[0] || null;
                    handleDocFileSelect(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                    isDraggingDoc
                      ? "border-zinc-900 bg-zinc-100"
                      : "border-zinc-300 hover:border-zinc-400 bg-zinc-50/60"
                  }`}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 mb-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[#1F1F1F]">
                    {t("personal_info_modal_drag_drop", "Click to upload or drag and drop")}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {t("personal_info_modal_file_formats", "JPG, PNG, WebP or PDF (up to 15MB)")}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-zinc-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-200 text-zinc-700 shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1F1F1F] truncate">{selectedDocFile.name}</p>
                      <p className="text-xs text-[#727272]">{formatFileSize(selectedDocFile.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDocFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                    aria-label={t("personal_info_cancel", "Cancel")}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}

              {docUploadError && (
                <p className="text-xs text-red-600 mt-1">{docUploadError}</p>
              )}
            </div>

            {/* Privacy & Review Notice */}
            <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-3.5 text-xs text-zinc-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-[#1F1F1F]">
                <svg className="w-4 h-4 text-[#727272]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                {t("personal_info_modal_secure_title", "Secure & Confidential Review")}
              </div>
              <p>
                {t("personal_info_modal_secure_desc", "Self-verification is not permitted. Once uploaded, your document will be submitted to the Homyz verification team for secure review. Your files are encrypted and never shared publicly.")}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIdentityModalOpen(false);
                  setSelectedDocFile(null);
                  setDocUploadError(null);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                {data.identityStatus === "VERIFIED" ? t("personal_info_close", "Close") : t("personal_info_cancel", "Cancel")}
              </button>

              <button
                type="button"
                disabled={!selectedDocFile || isUploadingDoc}
                onClick={handleUploadDocument}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1F1F1F] text-sm font-medium text-white hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isUploadingDoc ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" />
                    </svg>
                    {t("personal_info_uploading", "Uploading document...")}
                  </>
                ) : (
                  t("personal_info_upload_submit", "Upload and submit for review")
                )}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
