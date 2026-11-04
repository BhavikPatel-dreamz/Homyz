"use client";

import React from "react";

import { BackButton } from "@/components/ui/back-button";
import { useLanguage, type TranslationKey } from "@/lib/i18n/language-context";
import { RegulationsSkeleton } from "./YourSpaceSkeletons";

const licenseCache = new Map<string, LicenseManagement | null>();

type LicenseManagement = {
  listing: {
    id: string;
    title: string;
    country: string | null;
    status: string;
    published: boolean;
    approvalMethod: string | null;
    eligibilityStatus: string;
    licenseUnlistingReason: string | null;
    host?: { id: string; name: string | null; email: string | null };
  };
  license: {
    number: string;
    status: string;
    issueDate: string | null;
    expiryDate: string | null;
    lastVerifiedAt: string | null;
    eligibilityStatus: string;
    licenseCategory: string | null;
    facilityName: string | null;
    verifiedEntity: string | null;
    verificationSource: string;
    verificationMethod: string | null;
    verificationError: string | null;
  };
  linkedProperties: Array<{
    id: string;
    title: string;
    status: string;
    published: boolean;
    eligibilityStatus: string;
  }>;
  verificationHistory: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    providerResultCategory: string;
    errorReason: string | null;
    createdAt: string;
  }>;
};

type ApiEnvelope<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

function normalizeLicenseManagement(data: any): LicenseManagement | null {
  if (!data || typeof data !== "object") return null;
  if (data.license && typeof data.license === "object") {
    return {
      listing: data.listing || {
        id: "",
        title: "",
        country: "Saudi Arabia",
        status: "",
        published: false,
        approvalMethod: null,
        eligibilityStatus: data.license?.eligibilityStatus || "PENDING",
        licenseUnlistingReason: null,
      },
      license: data.license,
      linkedProperties: Array.isArray(data.linkedProperties) ? data.linkedProperties : [],
      verificationHistory: Array.isArray(data.verificationHistory) ? data.verificationHistory : [],
    };
  }
  if (data.licenseNumber || data.status) {
    return {
      listing: {
        id: "",
        title: "",
        country: "Saudi Arabia",
        status: "",
        published: false,
        approvalMethod: null,
        eligibilityStatus: data.eligibilityStatus || "PENDING",
        licenseUnlistingReason: null,
      },
      license: {
        number: data.licenseNumber || "",
        status: data.status || "PENDING",
        issueDate: data.issueDate ?? null,
        expiryDate: data.expiryDate ?? null,
        lastVerifiedAt: data.lastVerifiedAt ?? (data.status === "ACTIVE" ? new Date().toISOString() : null),
        eligibilityStatus: data.eligibilityStatus || "PENDING",
        licenseCategory: data.licenseCategory ?? null,
        facilityName: data.facilityName ?? null,
        verifiedEntity: data.verifiedEntity ?? null,
        verificationSource: data.verificationSource || data.source || "GOVERNMENT_API",
        verificationMethod: data.verificationMethod ?? null,
        verificationError: data.error ?? data.verificationError ?? null,
      },
      linkedProperties: [],
      verificationHistory: [],
    };
  }
  return null;
}

function formattedDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? fallback
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

function humanize(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusPresentation(
  license: LicenseManagement["license"] | undefined,
  t: (key: TranslationKey, valuesOrFallback?: Record<string, string | number | boolean> | string, fallback?: string) => string,
) {
  if (!license) return { label: t("host_license_status_none", "No license added"), tone: "zinc" as const };
  const expiresAt = license.expiryDate ? new Date(license.expiryDate) : null;
  const daysToExpiry = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000) : null;
  if (license.status === "ACTIVE" && license.eligibilityStatus === "ELIGIBLE" && (daysToExpiry === null || daysToExpiry > 30)) {
    return { label: t("host_license_status_active", "Verified / active"), tone: "emerald" as const };
  }
  if (license.status === "ACTIVE" && daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30) {
    return { label: t("host_license_status_expiring", "Expiring soon"), tone: "amber" as const };
  }
  if (license.status === "EXPIRED" || license.eligibilityStatus === "EXPIRED") return { label: t("host_license_status_expired", "Expired"), tone: "rose" as const };
  if (["REVOKED", "SUSPENDED", "INVALID"].includes(license.status)) return { label: t("host_license_status_restricted", "Invalid / restricted"), tone: "rose" as const };
  if (license.status === "UNAVAILABLE") return { label: t("host_license_status_failed", "Verification failed"), tone: "rose" as const };
  return { label: t("host_license_status_pending", "Pending verification"), tone: "amber" as const };
}

const toneClasses = {
  zinc: "bg-zinc-100 text-zinc-700",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  rose: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function LicenseRegulationsView({
  listingId,
  listingTitle,
  presentation = "host",
  canManage = true,
  setActiveSection,
}: {
  listingId: string;
  listingTitle: string;
  presentation?: "host" | "admin";
  canManage?: boolean;
  setActiveSection: (section: string) => void;
}) {
  const { t } = useLanguage();
  const cached = licenseCache.get(listingId);
  const [management, setManagement] = React.useState<LicenseManagement | null>(cached ?? null);
  const [licenseNumber, setLicenseNumber] = React.useState(cached?.license.number ?? "");
  const [isLoading, setIsLoading] = React.useState(!licenseCache.has(listingId));
  const [isSaving, setIsSaving] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [adminReason, setAdminReason] = React.useState("");
  const [notice, setNotice] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = React.useCallback(async () => {
    if (!licenseCache.has(listingId)) {
      setIsLoading(true);
    }
    try {
      const response = await fetch(`/api/v1/host/licenses/${encodeURIComponent(listingId)}`, { credentials: "same-origin" });
      const payload = await response.json() as ApiEnvelope<LicenseManagement | null>;
      if (!response.ok || !payload.success) throw new Error(("error" in payload && payload.error?.message) || t("host_license_err_load", "Unable to load license information."));
      const normalized = normalizeLicenseManagement(payload.data);
      licenseCache.set(listingId, normalized);
      setManagement(normalized);
      setLicenseNumber(normalized?.license.number ?? "");
    } catch (error) {
      if (!licenseCache.has(listingId)) {
        setNotice({ type: "error", message: error instanceof Error ? error.message : t("host_license_err_load", "Unable to load license information.") });
      }
    } finally {
      setIsLoading(false);
    }
  }, [listingId, t]);

  React.useEffect(() => {
    // Defer the request until after the effect commits; the request callback,
    // not the effect itself, owns state updates.
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async () => {
    const nextNumber = licenseNumber.trim();
    if (!nextNumber) {
      setNotice({ type: "error", message: t("host_license_err_enter_before_save", "Enter a Saudi license number before saving.") });
      return;
    }
    if (presentation === "admin" && !adminReason.trim()) {
      setNotice({ type: "error", message: t("host_license_err_enter_reason", "Enter a reason before changing this license record.") });
      return;
    }
    if (
      management &&
      nextNumber !== (management.license?.number ?? "") &&
      (management.linkedProperties?.length ?? 0) > 1 &&
      !window.confirm(
        t("host_license_confirm_replace", { count: management.linkedProperties?.length ?? 0 }, `This license is linked to ${management.linkedProperties?.length ?? 0} properties. This change only replaces the license for this property and requires fresh verification. Continue?`),
      )
    ) return;
    setIsSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/host/licenses/${encodeURIComponent(listingId)}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseNumber: nextNumber, ...(presentation === "admin" ? { reason: adminReason.trim() } : {}) }),
      });
      const payload = await response.json() as ApiEnvelope<LicenseManagement>;
      if (!response.ok || !payload.success) throw new Error(("error" in payload && payload.error?.message) || t("host_license_err_save", "Unable to save license information."));
      const normalized = normalizeLicenseManagement(payload.data);
      setManagement(normalized);
      setLicenseNumber(normalized?.license.number ?? "");
      setAdminReason("");
      setNotice({ type: "success", message: t("host_license_success_saved", "License saved. Verify it to restore publishing eligibility.") });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : t("host_license_err_save", "Unable to save license information.") });
    } finally {
      setIsSaving(false);
    }
  };

  const verify = async () => {
    if (!management?.license?.number) {
      setNotice({ type: "error", message: t("host_license_err_save_before_verify", "Save a license number before verification.") });
      return;
    }
    setIsVerifying(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/host/licenses/${encodeURIComponent(listingId)}`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = await response.json() as ApiEnvelope<LicenseManagement>;
      if (!response.ok || !payload.success) throw new Error(("error" in payload && payload.error?.message) || t("host_license_err_verify_failed", "License verification failed."));
      const normalized = normalizeLicenseManagement(payload.data);
      setManagement(normalized);
      setLicenseNumber(normalized?.license.number ?? "");
      setNotice({ type: "success", message: t("host_license_success_verified", "License verification completed. Review the official details below.") });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : t("host_license_err_verify_failed", "License verification failed.") });
    } finally {
      setIsVerifying(false);
    }
  };

  const notAvailable = t("host_license_not_available", "Not available");
  const notSupplied = t("host_license_detail_not_supplied", "Not supplied by provider");
  const status = statusPresentation(management?.license, t);
  const listing = management?.listing;
  const license = management?.license;
  const details: Array<[string, string]> = license ? [
    [t("host_license_detail_category", "License category"), humanize(license.licenseCategory, notAvailable)],
    [t("host_license_detail_country", "Country"), t("host_license_country_saudi", "Saudi Arabia")],
    [t("host_license_detail_facility", "Facility / business"), license.facilityName || notSupplied],
    [t("host_license_detail_entity", "Licensed entity"), license.verifiedEntity || notSupplied],
    [t("host_license_detail_official_status", "Official license status"), humanize(license.status, notAvailable)],
    [t("host_license_detail_eligibility", "Verification eligibility"), humanize(license.eligibilityStatus, notAvailable)],
    [t("host_license_detail_issue_date", "Issue date"), formattedDate(license.issueDate, notAvailable)],
    [t("host_license_detail_expiry_date", "Expiration date"), formattedDate(license.expiryDate, notAvailable)],
    [t("host_license_detail_last_verified", "Last verified"), formattedDate(license.lastVerifiedAt, notAvailable)],
    [t("host_license_detail_source", "Verification source"), humanize(license.verificationSource, notAvailable)],
    [t("host_license_detail_approval_method", "Approval method"), listing?.approvalMethod === "SAUDI_LICENSE_AUTOMATIC" ? t("host_license_approval_auto", "Automatic Saudi license approval") : t("host_license_approval_manual", "Manual review")],
    [t("host_license_detail_publishing_status", "Publishing status"), listing?.published ? t("host_license_status_listed", "Listed") : t("host_license_status_unlisted", "Unlisted")],
  ] : [];

  if (isLoading && !management) {
    return <RegulationsSkeleton />;
  }

  return (
    <section className="max-w-4xl space-y-6 pb-12 font-sans text-[#1F1F1F] animate-in fade-in">
      <div className="flex items-center gap-5">
        <BackButton onClick={() => setActiveSection("listing-status")} />
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#727272]">
            {presentation === "admin" ? t("host_license_admin_details", "Admin property details") : t("host_license_property_regulations", "Property regulations")}
          </p>
          <h1>
            {presentation === "admin" ? t("host_license_admin_title", "License & regulations") : t("host_license_details_title", "License details")}
          </h1>
        </div>
      </div>

      <p className="max-w-2xl text-sm leading-6 text-[#727272]">
        {t("host_license_readonly_notice", "Saudi government fields are read-only and update only after verification. Saving a different license number never verifies it automatically.")}
      </p>

      {notice && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          {notice.message}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-medium">{t("host_license_saudi_title", "Saudi Arabia license")}</h2>
            <p className="mt-1 text-sm text-[#727272]">{listing?.title || listingTitle}</p>
            {presentation === "admin" && listing?.host && (
              <p className="mt-1 text-xs text-[#727272]">
                {t("host_license_host_prefix", "Host:")} {listing.host.name || listing.host.email || listing.host.id}
              </p>
            )}
          </div>
          <span className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${toneClasses[status.tone]}`}>{status.label}</span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <label className="block text-sm font-medium">
            {t("host_license_saudi_number_label", "Saudi license number")}
            <input
              value={licenseNumber}
              onChange={(event) => setLicenseNumber(event.target.value)}
              disabled={!canManage || isSaving || isVerifying}
              placeholder={t("host_license_saudi_placeholder", "Enter your license number")}
              className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={!canManage || isSaving || isVerifying || licenseNumber.trim() === (management?.license?.number ?? "") || (presentation === "admin" && !adminReason.trim())}
            className="min-h-12 rounded-full border border-zinc-900 px-5 text-sm font-medium transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
          >
            {isSaving ? t("host_license_btn_saving", "Saving…") : t("host_license_btn_save", "Save")}
          </button>
          <button
            type="button"
            onClick={verify}
            disabled={!canManage || isSaving || isVerifying || !management?.license?.number}
            className="min-h-12 rounded-full bg-[#FCDF9C] px-5 text-sm font-medium text-[#1F1F1F] transition hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            {isVerifying ? t("host_license_btn_verifying", "Verifying…") : management ? t("host_license_btn_reverify", "Reverify license") : t("host_license_btn_verify", "Verify license")}
          </button>
        </div>
        {presentation === "admin" && canManage && (
          <label className="mt-3 block text-sm font-medium">
            {t("host_license_admin_reason_label", "Reason for administrative change")}
            <input
              value={adminReason}
              onChange={(event) => setAdminReason(event.target.value)}
              disabled={isSaving || isVerifying}
              placeholder={t("host_license_admin_reason_placeholder", "Required when saving a license change")}
              className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 disabled:bg-zinc-100"
            />
          </label>
        )}
        {!canManage && <p className="mt-3 text-xs text-[#727272]">{t("host_license_readonly_role_notice", "You can view this license record, but your role cannot change or verify it.")}</p>}
      </div>

      {!isLoading && management && (
        <>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-medium">{t("host_license_official_details_title", "Official verification details")}</h2>
            <p className="mt-1 text-sm text-[#727272]">{t("host_license_official_details_desc", "These values come from the latest trusted verification response and cannot be edited here.")}</p>
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className="border-b border-zinc-100 pb-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#727272]">{label}</dt>
                  <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {license?.verificationError && (
              <p className="mt-5 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
                {t("host_license_latest_verification_message", "Latest verification message: ")}{license.verificationError}
              </p>
            )}
            {listing?.licenseUnlistingReason && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                {t("host_license_unlisting_reason", "Unlisting reason: ")}{humanize(listing.licenseUnlistingReason, notAvailable)}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-medium">{t("host_license_linked_properties_title", "Linked properties")}</h2>
              <span className="text-sm text-[#727272]">{t("host_license_linked_count", { count: management.linkedProperties?.length ?? 0 }, `${management.linkedProperties?.length ?? 0} linked`)}</span>
            </div>
            <p className="mt-1 text-sm text-[#727272]">{t("host_license_linked_warning", "If this license expires or is restricted, all linked listed properties are automatically unlisted.")}</p>
            <ul className="mt-4 divide-y divide-zinc-100">
              {management.linkedProperties?.map((property) => (
                <li key={property.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{property.title}</p>
                    <p className="mt-0.5 text-xs text-[#727272]">{property.id}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${property.published ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"}`}>
                    {property.published ? t("host_license_status_listed", "Listed") : t("host_license_status_unlisted", "Unlisted")}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-medium">{t("host_license_history_title", "Verification history")}</h2>
            {(management.verificationHistory?.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-[#727272]">{t("host_license_history_empty", "No license events have been recorded yet.")}</p>
            ) : (
              <ol className="mt-4 space-y-4 border-l border-zinc-200 pl-4">
                {management.verificationHistory?.map((entry) => (
                  <li key={entry.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-zinc-400" />
                    <p className="font-medium">{humanize(entry.providerResultCategory, notAvailable)} · {humanize(entry.newStatus, notAvailable)}</p>
                    <p className="mt-0.5 text-xs text-[#727272]">
                      {formattedDate(entry.createdAt, notAvailable)}
                      {entry.previousStatus ? ` · ${t("host_license_history_previous_status", "Previous status: ")}${humanize(entry.previousStatus, notAvailable)}` : ""}
                    </p>
                    {entry.errorReason && <p className="mt-1 text-xs text-rose-700">{entry.errorReason}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}

      {!isLoading && !management && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-[#727272]">
          {t("host_license_empty_state", "No Saudi license has been added. Save a license number, then verify it with the government provider.")}
        </div>
      )}
    </section>
  );
}
