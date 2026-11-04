"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { HostPayoutMethod } from "@/services/payout.service";
import {
  SettingsStatusBadge,
  BuildingBankIcon,
  CreditCardIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  TrashIcon,
  CopyIcon,
  CheckIcon,
  LockIcon,
  type BadgeVariant,
} from "@/components/host/account-settings";

interface PayoutMethodDetailClientProps {
  initialMethod: HostPayoutMethod;
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

export function PayoutMethodDetailClient({
  initialMethod,
}: PayoutMethodDetailClientProps) {
  const router = useRouter();
  const [method, setMethod] = useState<HostPayoutMethod>(initialMethod);

  // Edit State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [accountHolderName, setAccountHolderName] = useState<string>(
    initialMethod.accountHolderName,
  );
  const [routingCode, setRoutingCode] = useState<string>(
    initialMethod.routingCode || "",
  );

  // Loading & Feedback
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const handleCopyIban = () => {
    navigator.clipboard.writeText(method.ibanMasked);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountHolderName.trim()) {
      setFeedback({ type: "error", message: "Beneficiary name cannot be empty." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/host/payout-methods/${method.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName: accountHolderName.trim(),
          routingCode: routingCode.trim() || undefined,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message || "Failed to update payout details.");
      }

      setMethod(payload.data || payload);
      setIsEditing(false);
      setFeedback({ type: "success", message: "Account details updated successfully." });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async () => {
    setActionLoading("default");
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/host/payout-methods/${method.id}/default`, {
        method: "PUT",
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message || "Failed to set default.");
      }

      setMethod((prev) => ({ ...prev, isDefault: true }));
      setFeedback({ type: "success", message: "Set as default payout method." });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to update default status." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    setActionLoading("delete");
    setFeedback(null);

    try {
      const res = await fetch(`/api/v1/host/payout-methods/${method.id}`, {
        method: "DELETE",
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message || "Failed to remove payout method.");
      }

      router.push("/host/account-settings/payouts");
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to remove method." });
      setActionLoading(null);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 text-xs sm:text-sm shadow-2xs ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircleIcon size={18} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangleIcon size={18} className="text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Main Account Card */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex items-start gap-4">
          <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border ${
            method.type === "PAYPAL"
              ? "bg-blue-50 text-blue-600 border-blue-200/80"
              : "bg-zinc-100 text-zinc-900 border-zinc-200"
          }`}>
            {method.type === "PAYPAL" ? <CreditCardIcon size={26} /> : <BuildingBankIcon size={26} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-medium text-zinc-950">{method.bankName}</h2>
              {method.isDefault && (
                <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white">
                  Default Method
                </span>
              )}
              <SettingsStatusBadge
                label={method.status.replace("_", " ")}
                variant={resolveStatusVariant(method.status)}
                dot
              />
            </div>

            <div className="mt-2 flex items-center gap-2">
              <p className="font-mono text-base tracking-wider text-zinc-800">
                {method.ibanMasked}
              </p>
              <button
                type="button"
                onClick={handleCopyIban}
                title="Copy masked IBAN"
                className="flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              >
                {copied ? <CheckIcon size={15} className="text-emerald-600" /> : <CopyIcon size={15} />}
              </button>
            </div>

            {/* Read / Edit Form Grid */}
            {!isEditing ? (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-zinc-100 pt-6">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Account Holder</span>
                  <p className="mt-1 font-medium text-zinc-900 text-sm">{method.accountHolderName}</p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Currency & Rail</span>
                  <p className="mt-1 font-medium text-zinc-900 text-sm">
                    {method.type === "PAYPAL"
                      ? `${method.currency} · PayPal Payouts (SAMA Peg: 3.75 SAR/USD)`
                      : `${method.currency} · SAMA SARIE`}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    {method.type === "PAYPAL" ? "Provider Identifier" : "Bank Code"}
                  </span>
                  <p className="mt-1 font-medium text-zinc-900 text-sm">
                    {method.type === "PAYPAL" ? "PayPal Global Payouts" : method.bankCode || "Saudi Commercial"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Country</span>
                  <p className="mt-1 font-medium text-zinc-900 text-sm">{method.country || "Saudi Arabia (SA)"}</p>
                </div>
                {method.routingCode && (
                  <div className="sm:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Nickname / Routing Reference</span>
                    <p className="mt-1 font-medium text-zinc-900 text-sm">{method.routingCode}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Registered On</span>
                  <p className="mt-1 font-medium text-zinc-900 text-sm">
                    {new Date(method.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                {method.verifiedAt && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Verified On</span>
                    <p className="mt-1 font-medium text-zinc-900 text-sm">
                      {new Date(method.verifiedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveEdits} className="mt-6 border-t border-zinc-100 pt-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-600 mb-1">
                    Beneficiary Name *
                  </label>
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-zinc-600 mb-1">
                    Nickname / Reference Note
                  </label>
                  <input
                    type="text"
                    value={routingCode}
                    onChange={(e) => setRoutingCode(e.target.value)}
                    placeholder="e.g. Al Rajhi Primary Account"
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-full bg-zinc-950 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setAccountHolderName(method.accountHolderName);
                      setRoutingCode(method.routingCode || "");
                    }}
                    className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Verification Status Explanation Card */}
            <div className="mt-6 rounded-2xl bg-zinc-50 p-4 border border-zinc-200">
              <div className="flex items-start gap-3">
                {method.status === "VERIFIED" ? (
                  <CheckCircleIcon size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : method.status === "REJECTED" ? (
                  <AlertTriangleIcon size={20} className="text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangleIcon size={20} className="text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs sm:text-sm text-zinc-700">
                  <p className="font-medium text-zinc-900">
                    {method.status === "VERIFIED"
                      ? "Verified for SARIE Disbursements"
                      : method.status === "REJECTED"
                      ? "Verification Rejected by Review"
                      : "Verification Pending Administrative Review"}
                  </p>
                  <p className="mt-0.5 text-zinc-600">
                    {method.status === "VERIFIED"
                      ? "This account is active and eligible to receive reservation settlements directly into your Saudi bank account."
                      : method.status === "REJECTED"
                      ? method.rejectionReason || "Details could not be verified against official records. Please remove this account and re-register with exact name."
                      : "Administrative review verifies beneficiary identity against Saudi Nafath/Absher records prior to your first reservation payout."}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-100">
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors"
                >
                  Edit Beneficiary Name / Note
                </button>
              )}

              {!method.isDefault && method.status !== "DISABLED" && (
                <button
                  type="button"
                  onClick={handleSetDefault}
                  disabled={Boolean(actionLoading)}
                  className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "default" ? "Updating..." : "Set as Default Method"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                disabled={Boolean(actionLoading)}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50 ml-auto"
              >
                <TrashIcon size={14} />
                <span>Remove Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Security Immutability Notice Card */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 text-xs text-zinc-600 flex items-start gap-3">
        <LockIcon size={18} className="text-zinc-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-zinc-900">IBAN Immutability Compliance</p>
          <p className="mt-0.5">
            Under SAMA regulatory policies, IBAN account numbers cannot be directly modified once created. If your bank details change, please add a new payout method and designate it as your primary account.
          </p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <ModalOverlay
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClose={() => setShowDeleteModal(false)}
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
              Are you sure you want to remove <strong>{method.bankName}</strong> ({method.ibanMasked})?
              {method.isDefault && (
                <span className="block mt-2 text-amber-700 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                  ⚠️ This is your default payout method. Removing it will automatically designate another registered account as your default.
                </span>
              )}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={Boolean(actionLoading)}
                className="rounded-full bg-rose-600 px-5 py-2 text-xs font-medium text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === "delete" ? "Removing..." : "Confirm Removal"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

