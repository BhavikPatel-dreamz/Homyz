"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { HostPayoutMethod } from "@/services/payout.service";
import {
  SettingsStatusBadge,
  SettingsEmptyState,
  BuildingBankIcon,
  CreditCardIcon,
  TrashIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  type BadgeVariant,
} from "@/components/host/account-settings";

interface PayoutMethodsManagerProps {
  initialMethods: HostPayoutMethod[];
}

function resolveStatusVariant(status: HostPayoutMethod["status"]): BadgeVariant {
  switch (status) {
    case "VERIFIED":
      return "success";
    case "PENDING_VERIFICATION":
      return "warning";
    case "REJECTED":
      return "error";
    case "DISABLED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function PayoutMethodsManager({ initialMethods }: PayoutMethodsManagerProps) {
  const router = useRouter();
  const [methods, setMethods] = useState<HostPayoutMethod[]>(initialMethods);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [methodToDelete, setMethodToDelete] = useState<HostPayoutMethod | null>(null);

  const handleSetDefault = async (methodId: string) => {
    setActionLoading(methodId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/host/payout-methods/${methodId}/default`, {
        method: "PUT",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to set default payout method.");
      }

      setMethods((prev) =>
        prev.map((m) => ({
          ...m,
          isDefault: m.id === methodId,
        })),
      );
      setSuccessMsg("Default payout method updated successfully.");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!methodToDelete) return;
    const methodId = methodToDelete.id;
    setActionLoading(methodId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/host/payout-methods/${methodId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to remove payout method.");
      }

      setMethods((prev) => prev.filter((m) => m.id !== methodId));
      setSuccessMsg("Payout method removed successfully.");
      setMethodToDelete(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while deleting.");
    } finally {
      setActionLoading(null);
    }
  };

  if (methods.length === 0) {
    return (
      <SettingsEmptyState
        title="No payout methods registered yet"
        description="To receive revenue from your completed guest bookings, add a verified Saudi IBAN bank account."
        action={{
          label: "Add payout method",
          href: "/host/account-settings/payouts/add",
        }}
        secondaryAction={{
          label: "Learn about payouts",
          href: "/host/earnings",
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast Feedback Banners */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs sm:text-sm text-emerald-900 shadow-2xs">
          <CheckCircleIcon size={18} className="text-emerald-600 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm text-rose-900 shadow-2xs">
          <AlertTriangleIcon size={18} className="text-rose-600 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Methods Card List */}
      <div className="space-y-3">
        {methods.map((method) => {
          const isLoading = actionLoading === method.id;
          return (
            <div
              key={method.id}
              className={`flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-all sm:flex-row sm:items-center sm:gap-4 ${
                isLoading ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border ${
                  method.type === "PAYPAL"
                    ? "bg-blue-50 text-blue-600 border-blue-200/80"
                    : "bg-zinc-100 text-zinc-900 border-zinc-200/80"
                }`}>
                  {method.type === "PAYPAL" ? <CreditCardIcon size={22} /> : <BuildingBankIcon size={22} />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-950 text-sm sm:text-base">
                      {method.bankName}
                    </p>
                    {method.isDefault && (
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white">
                        Default
                      </span>
                    )}
                    <SettingsStatusBadge
                      label={method.status.replace("_", " ")}
                      variant={resolveStatusVariant(method.status)}
                      dot
                    />
                  </div>

                  <p className="mt-1 font-mono text-sm tracking-wider text-zinc-700">
                    {method.ibanMasked}
                  </p>

                  <p className="mt-0.5 text-xs text-zinc-500">
                    Beneficiary: <span className="font-medium text-zinc-700">{method.accountHolderName}</span> · Currency: {method.currency} · Country: {method.country || "SA"}
                  </p>

                  {/* Rejection Notice Banner */}
                  {method.status === "REJECTED" && (
                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                      <strong>Verification notice:</strong> {method.rejectionReason || "Details could not be verified by compliance review."}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Controls */}
              <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0">
                {!method.isDefault && method.status !== "DISABLED" && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(method.id)}
                    disabled={Boolean(actionLoading)}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    Set as Default
                  </button>
                )}

                <Link
                  href={`/host/account-settings/payouts/methods/${method.id}`}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors"
                >
                  Details
                </Link>

                <button
                  type="button"
                  onClick={() => setMethodToDelete(method)}
                  disabled={Boolean(actionLoading)}
                  className="flex size-7 items-center justify-center rounded-full text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50"
                  title="Remove payout method"
                >
                  <TrashIcon size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Removal */}
      {methodToDelete && (
        <ModalOverlay
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClose={() => setMethodToDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-100"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <TrashIcon size={22} />
            </div>
            <h3 className="mt-4 text-lg font-medium text-zinc-950">
              Remove Payout Method?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Are you sure you want to remove <strong>{methodToDelete.bankName}</strong> ({methodToDelete.ibanMasked})?
              {methodToDelete.isDefault && (
                <span className="block mt-2 text-amber-700 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                  ⚠️ This is currently your default payout method. If removed, another active account will become your default.
                </span>
              )}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setMethodToDelete(null)}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={Boolean(actionLoading)}
                className="rounded-full bg-rose-600 px-5 py-2 text-xs font-medium text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === methodToDelete.id ? "Removing..." : "Confirm Removal"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

