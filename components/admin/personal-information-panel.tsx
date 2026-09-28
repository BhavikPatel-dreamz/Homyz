"use client";

import { useState, useTransition } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import type {
  AdminAddressData,
  AdminPersonalInfoData,
  PersonalIdentityStatus,
} from "@/services/admin.service";

function displayValue(value: string | null | undefined): string {
  return value?.trim() || "Not provided";
}

function formatAddress(address: AdminAddressData | null): string {
  if (!address) return "Not provided";
  const lineOne = [address.street, address.apt].filter(Boolean).join(", ");
  const lineTwo = [address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(", ");
  return [lineOne, lineTwo, address.country].filter(Boolean).join("\n") || "Not provided";
}

function statusClasses(status: PersonalIdentityStatus): string {
  if (status === "VERIFIED") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (status === "REJECTED") {
    return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  }
  if (status === "PENDING") {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  }
  return "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]";
}

export function AdminPersonalInformationPanel({
  userId,
  initialData,
  canViewDocument = true,
  canReviewDocument = false,
}: {
  userId: string;
  initialData: AdminPersonalInfoData;
  canViewDocument?: boolean;
  canReviewDocument?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pending, startTransition] = useTransition();

  function reviewDocument(status: "VERIFIED" | "REJECTED", reason?: string) {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/v1/admin/users/${userId}/identity-document`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, rejectionReason: reason }),
          },
        );
        const result = (await response.json().catch(() => null)) as
          | { success: true; data: AdminPersonalInfoData }
          | { success: false; error?: { message?: string } }
          | null;
        if (!response.ok || !result?.success) {
          const message =
            result && !result.success && result.error?.message
              ? result.error.message
              : "Unable to review the identity document.";
          throw new Error(message);
        }

        setData(result.data);
        setRejectOpen(false);
        setRejectionReason("");
        toast.success(
          status === "VERIFIED"
            ? "Identity document verified."
            : "Identity document rejected.",
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to review the identity document.",
        );
      }
    });
  }

  const emergency = data.emergencyContact;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Personal information</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Account settings record</p>
        </div>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(data.identityStatus)}`}
        >
          Identity: {data.identityStatus.replace(/_/g, " ").toLowerCase()}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 py-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-[var(--muted-foreground)]">Legal name</dt>
          <dd className="mt-1 font-semibold">{displayValue(data.legalName)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted-foreground)]">Preferred first name</dt>
          <dd className="mt-1 font-semibold">{displayValue(data.preferredFirstName)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted-foreground)]">Email address</dt>
          <dd className="mt-1 break-all font-semibold">{displayValue(data.email)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted-foreground)]">Phone number</dt>
          <dd className="mt-1 font-semibold">{displayValue(data.phone)}</dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-5 border-t border-[var(--border-subtle)] py-5 text-sm md:grid-cols-3">
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)]">Residential address</h3>
          <p className="mt-2 whitespace-pre-line leading-6">{formatAddress(data.residentialAddress)}</p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)]">Postal address</h3>
          <p className="mt-2 whitespace-pre-line leading-6">
            {data.sameAsResidential
              ? formatAddress(data.residentialAddress)
              : formatAddress(data.postalAddress)}
          </p>
          {data.sameAsResidential && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Same as residential</p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted-foreground)]">Emergency contact</h3>
          {emergency ? (
            <div className="mt-2 space-y-1 leading-6">
              <p className="font-semibold">{displayValue(emergency.name)}</p>
              <p>{displayValue(emergency.relationship)}</p>
              <p>{displayValue(`${emergency.countryCode} ${emergency.phoneNumber}`)}</p>
              <p className="break-all">{displayValue(emergency.email)}</p>
              <p>{displayValue(emergency.preferredLanguage)}</p>
            </div>
          ) : (
            <p className="mt-2">Not provided</p>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] pt-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-[var(--muted-foreground)]">Identity document</h3>
            {data.identityDocument ? (
              <div className="mt-2 text-sm">
                <p className="truncate font-semibold">{data.identityDocument.fileName}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {data.identityDocument.documentType.replace(/_/g, " ")} · Uploaded{" "}
                  <span suppressHydrationWarning>
                    {new Date(data.identityDocument.uploadedAt).toLocaleDateString("en-US")}
                  </span>
                </p>
                {data.identityDocument.rejectionReason && (
                  <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                    {data.identityDocument.rejectionReason}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm">Not uploaded</p>
            )}
          </div>

          {data.identityDocument && canViewDocument && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <a
                href={data.identityDocument.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-secondary)]"
              >
                View document
              </a>
              {data.identityStatus === "PENDING" && canReviewDocument && (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => reviewDocument("VERIFIED")}
                    className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setRejectOpen(true)}
                    className="rounded-full border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {rejectOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="identity-rejection-title"
          onMouseDown={() => !pending && setRejectOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="identity-rejection-title" className="text-lg font-semibold">
              Reject identity document
            </h2>
            <label className="mt-4 block text-xs font-semibold text-[var(--muted-foreground)]">
              Rejection reason
              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={4}
                maxLength={500}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm font-normal text-muted-foreground outline-none focus:border-rose-400"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setRejectOpen(false)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !rejectionReason.trim()}
                onClick={() => reviewDocument("REJECTED", rejectionReason)}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? "Rejecting..." : "Reject document"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </section>
  );
}
