"use client";

import React from "react";

import { BackButton } from "@/components/ui/back-button";

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

function formattedDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

function humanize(value: string | null | undefined) {
  if (!value) return "Not available";
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusPresentation(license?: LicenseManagement["license"]) {
  if (!license) return { label: "No license added", tone: "zinc" as const };
  const expiresAt = license.expiryDate ? new Date(license.expiryDate) : null;
  const daysToExpiry = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000) : null;
  if (license.status === "ACTIVE" && license.eligibilityStatus === "ELIGIBLE" && (daysToExpiry === null || daysToExpiry > 30)) {
    return { label: "Verified / active", tone: "emerald" as const };
  }
  if (license.status === "ACTIVE" && daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30) {
    return { label: "Expiring soon", tone: "amber" as const };
  }
  if (license.status === "EXPIRED" || license.eligibilityStatus === "EXPIRED") return { label: "Expired", tone: "rose" as const };
  if (["REVOKED", "SUSPENDED", "INVALID"].includes(license.status)) return { label: "Invalid / restricted", tone: "rose" as const };
  if (license.status === "UNAVAILABLE") return { label: "Verification failed", tone: "rose" as const };
  return { label: "Pending verification", tone: "amber" as const };
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
  const [management, setManagement] = React.useState<LicenseManagement | null>(null);
  const [licenseNumber, setLicenseNumber] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [adminReason, setAdminReason] = React.useState("");
  const [notice, setNotice] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/host/licenses/${encodeURIComponent(listingId)}`, { credentials: "same-origin" });
      const payload = await response.json() as ApiEnvelope<LicenseManagement | null>;
      if (!response.ok || !payload.success) throw new Error(("error" in payload && payload.error?.message) || "Unable to load license information.");
      setManagement(payload.data);
      setLicenseNumber(payload.data?.license.number ?? "");
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load license information." });
    } finally {
      setIsLoading(false);
    }
  }, [listingId]);

  React.useEffect(() => {
    // Defer the request until after the effect commits; the request callback,
    // not the effect itself, owns state updates.
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async () => {
    const nextNumber = licenseNumber.trim();
    if (!nextNumber) {
      setNotice({ type: "error", message: "Enter a Saudi license number before saving." });
      return;
    }
    if (presentation === "admin" && !adminReason.trim()) {
      setNotice({ type: "error", message: "Enter a reason before changing this license record." });
      return;
    }
    if (management && nextNumber !== management.license.number && management.linkedProperties.length > 1 && !window.confirm(
      `This license is linked to ${management.linkedProperties.length} properties. This change only replaces the license for this property and requires fresh verification. Continue?`,
    )) return;
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
      if (!response.ok || !payload.success) throw new Error(("error" in payload && payload.error?.message) || "Unable to save license information.");
      setManagement(payload.data);
      setLicenseNumber(payload.data.license.number);
      setAdminReason("");
      setNotice({ type: "success", message: "License saved. Verify it to restore publishing eligibility." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save license information." });
    } finally {
      setIsSaving(false);
    }
  };

  const verify = async () => {
    if (!management?.license.number) {
      setNotice({ type: "error", message: "Save a license number before verification." });
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
      if (!response.ok || !payload.success) throw new Error(("error" in payload && payload.error?.message) || "License verification failed.");
      setManagement(payload.data);
      setLicenseNumber(payload.data.license.number);
      setNotice({ type: "success", message: "License verification completed. Review the official details below." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "License verification failed." });
    } finally {
      setIsVerifying(false);
    }
  };

  const status = statusPresentation(management?.license);
  const listing = management?.listing;
  const details: Array<[string, string]> = management ? [
    ["License category", humanize(management.license.licenseCategory)],
    ["Country", "Saudi Arabia"],
    ["Facility / business", management.license.facilityName || "Not supplied by provider"],
    ["Licensed entity", management.license.verifiedEntity || "Not supplied by provider"],
    ["Official license status", humanize(management.license.status)],
    ["Verification eligibility", humanize(management.license.eligibilityStatus)],
    ["Issue date", formattedDate(management.license.issueDate)],
    ["Expiration date", formattedDate(management.license.expiryDate)],
    ["Last verified", formattedDate(management.license.lastVerifiedAt)],
    ["Verification source", humanize(management.license.verificationSource)],
    ["Approval method", listing?.approvalMethod === "SAUDI_LICENSE_AUTOMATIC" ? "Automatic Saudi license approval" : "Manual review"],
    ["Publishing status", listing?.published ? "Listed" : "Unlisted"],
  ] : [];

  return (
    <section className="max-w-4xl space-y-6 pb-12 font-sans text-[#1F1F1F] animate-in fade-in">
      <div className="flex items-center gap-5">
        <BackButton onClick={() => setActiveSection("listing-status")} />
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#727272]">{presentation === "admin" ? "Admin property details" : "Property regulations"}</p>
          <h1>{presentation === "admin" ? "License & regulations" : "License details"}</h1>
        </div>
      </div>

      <p className="max-w-2xl text-sm leading-6 text-[#727272]">
        Saudi government fields are read-only and update only after verification. Saving a different license number never verifies it automatically.
      </p>

      {notice && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          {notice.message}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Saudi Arabia license</h2>
            <p className="mt-1 text-sm text-[#727272]">{listing?.title || listingTitle}</p>
            {presentation === "admin" && listing?.host && <p className="mt-1 text-xs text-[#727272]">Host: {listing.host.name || listing.host.email || listing.host.id}</p>}
          </div>
          <span className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${toneClasses[status.tone]}`}>{status.label}</span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <label className="block text-sm font-medium">
            Saudi license number
            <input
              value={licenseNumber}
              onChange={(event) => setLicenseNumber(event.target.value)}
              disabled={!canManage || isSaving || isVerifying}
              placeholder="Enter your license number"
              className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100"
            />
          </label>
          <button type="button" onClick={save} disabled={!canManage || isSaving || isVerifying || licenseNumber.trim() === (management?.license.number ?? "") || (presentation === "admin" && !adminReason.trim())}
            className="min-h-12 rounded-full border border-zinc-900 px-5 text-sm font-semibold transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent disabled:hover:text-zinc-400">
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={verify} disabled={!canManage || isSaving || isVerifying || !management?.license.number}
            className="min-h-12 rounded-full bg-[#FCDF9C] px-5 text-sm font-semibold text-[#1F1F1F] transition hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500">
            {isVerifying ? "Verifying…" : management ? "Reverify license" : "Verify license"}
          </button>
        </div>
        {presentation === "admin" && canManage && (
          <label className="mt-3 block text-sm font-medium">Reason for administrative change
            <input value={adminReason} onChange={(event) => setAdminReason(event.target.value)} disabled={isSaving || isVerifying}
              placeholder="Required when saving a license change" className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 disabled:bg-zinc-100" />
          </label>
        )}
        {!canManage && <p className="mt-3 text-xs text-[#727272]">You can view this license record, but your role cannot change or verify it.</p>}
      </div>

      {isLoading && <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-[#727272]">Loading license information…</div>}

      {!isLoading && management && (
        <>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Official verification details</h2>
            <p className="mt-1 text-sm text-[#727272]">These values come from the latest trusted verification response and cannot be edited here.</p>
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {details.map(([label, value]) => <div key={label} className="border-b border-zinc-100 pb-3"><dt className="text-xs font-medium uppercase tracking-wide text-[#727272]">{label}</dt><dd className="mt-1 text-sm font-medium break-words">{value}</dd></div>)}
            </dl>
            {management.license.verificationError && <p className="mt-5 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800">Latest verification message: {management.license.verificationError}</p>}
            {listing?.licenseUnlistingReason && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">Unlisting reason: {humanize(listing.licenseUnlistingReason)}</p>}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-baseline justify-between gap-4"><h2 className="text-lg font-semibold">Linked properties</h2><span className="text-sm text-[#727272]">{management.linkedProperties.length} linked</span></div>
            <p className="mt-1 text-sm text-[#727272]">If this license expires or is restricted, all linked listed properties are automatically unlisted.</p>
            <ul className="mt-4 divide-y divide-zinc-100">
              {management.linkedProperties.map((property) => <li key={property.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{property.title}</p><p className="mt-0.5 text-xs text-[#727272]">{property.id}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${property.published ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"}`}>{property.published ? "Listed" : "Unlisted"}</span></li>)}
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Verification history</h2>
            {management.verificationHistory.length === 0 ? <p className="mt-3 text-sm text-[#727272]">No license events have been recorded yet.</p> : <ol className="mt-4 space-y-4 border-l border-zinc-200 pl-4">{management.verificationHistory.map((entry) => <li key={entry.id} className="relative text-sm"><span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-zinc-400" /><p className="font-medium">{humanize(entry.providerResultCategory)} · {humanize(entry.newStatus)}</p><p className="mt-0.5 text-xs text-[#727272]">{formattedDate(entry.createdAt)}{entry.previousStatus ? ` · Previous status: ${humanize(entry.previousStatus)}` : ""}</p>{entry.errorReason && <p className="mt-1 text-xs text-rose-700">{entry.errorReason}</p>}</li>)}</ol>}
          </div>
        </>
      )}

      {!isLoading && !management && <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-[#727272]">No Saudi license has been added. Save a license number, then verify it with the government provider.</div>}
    </section>
  );
}
