"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { HostPayoutMethod } from "@/services/payout.service";
import type {
  PayoutRoutingRuleDTO,
  ListingEligibleRecipientDTO,
  ListingSplitInputItem,
} from "@/services/payout-routing.service";
import {
  SettingsStatusBadge,
  BuildingBankIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  TrashIcon,
  ExternalLinkIcon,
  SplitIcon,
  UsersIcon,
  PlusIcon,
  XIcon,
} from "@/components/host/account-settings";

interface ListingItem {
  id: string;
  title: string;
  city: string | null;
}

interface PayoutRoutingManagerProps {
  hostId: string;
  defaultPayoutMethod: HostPayoutMethod | null;
  listings: ListingItem[];
  initialRules: PayoutRoutingRuleDTO[];
}

export function PayoutRoutingManager({
  hostId,
  defaultPayoutMethod,
  listings,
  initialRules,
}: PayoutRoutingManagerProps) {
  const [rules, setRules] = useState<PayoutRoutingRuleDTO[]>(initialRules);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit / Config Drawer State
  const [activeListing, setActiveListing] = useState<ListingItem | null>(null);
  const [eligibleRecipients, setEligibleRecipients] = useState<ListingEligibleRecipientDTO[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [allocations, setAllocations] = useState<
    Array<{
      userId: string;
      payoutMethodId: string;
      percentage: number;
    }>
  >([]);

  // Revert Confirmation Modal State
  const [revertingListing, setRevertingListing] = useState<ListingItem | null>(null);

  // Group active rules by listingId
  const rulesByListing = React.useMemo(() => {
    const map = new Map<string, PayoutRoutingRuleDTO[]>();
    for (const rule of rules) {
      if (rule.status === "ACTIVE") {
        const list = map.get(rule.listingId) || [];
        list.push(rule);
        map.set(rule.listingId, list);
      }
    }
    return map;
  }, [rules]);

  // Open config drawer
  const openConfigureDrawer = async (listing: ListingItem) => {
    setActiveListing(listing);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecipientsLoading(true);

    try {
      const res = await fetch(
        `/api/v1/host/payout-routing-rules/eligible-recipients?listingId=${listing.id}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to load eligible recipients.");
      }

      const recs: ListingEligibleRecipientDTO[] = data.data || [];
      setEligibleRecipients(recs);

      // Pre-fill allocations from existing rules or default
      const currentListingRules = rulesByListing.get(listing.id) || [];
      if (currentListingRules.length > 0) {
        setAllocations(
          currentListingRules.map((r) => ({
            userId: r.recipientUserId,
            payoutMethodId: r.payoutMethodId,
            percentage: r.allocationPercentage,
          })),
        );
      } else {
        // Default: 100% to primary host
        const primaryHost = recs.find((r) => r.role === "PRIMARY_HOST");
        const defaultMethod = primaryHost?.verifiedPayoutMethods.find((m) => m.isDefault) ||
          primaryHost?.verifiedPayoutMethods[0];

        if (primaryHost && defaultMethod) {
          setAllocations([
            {
              userId: primaryHost.userId,
              payoutMethodId: defaultMethod.id,
              percentage: 100,
            },
          ]);
        } else {
          setAllocations([]);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load recipients.");
    } finally {
      setRecipientsLoading(false);
    }
  };

  const closeConfigureDrawer = () => {
    setActiveListing(null);
    setEligibleRecipients([]);
    setAllocations([]);
  };

  // Live percentage calculation
  const totalPercentage = allocations.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
  const isValidAllocation = totalPercentage === 100 && allocations.length > 0 && allocations.every(a => a.percentage > 0);

  // Update allocation percentage
  const handlePercentageChange = (userId: string, val: number) => {
    setAllocations((prev) =>
      prev.map((item) => (item.userId === userId ? { ...item, percentage: val } : item)),
    );
  };

  // Toggle recipient inclusion
  const handleToggleRecipient = (recipient: ListingEligibleRecipientDTO) => {
    const exists = allocations.find((a) => a.userId === recipient.userId);
    if (exists) {
      // Cannot remove if only 1 left
      if (allocations.length <= 1) return;
      setAllocations((prev) => prev.filter((a) => a.userId !== recipient.userId));
    } else {
      const defMethod = recipient.verifiedPayoutMethods.find((m) => m.isDefault) ||
        recipient.verifiedPayoutMethods[0];
      if (!defMethod) return;

      const remaining = Math.max(0, 100 - totalPercentage);
      setAllocations((prev) => [
        ...prev,
        {
          userId: recipient.userId,
          payoutMethodId: defMethod.id,
          percentage: remaining,
        },
      ]);
    }
  };

  // Change payout method for a recipient
  const handleMethodChange = (userId: string, methodId: string) => {
    setAllocations((prev) =>
      prev.map((item) => (item.userId === userId ? { ...item, payoutMethodId: methodId } : item)),
    );
  };

  // Save rules
  const handleSaveRules = async () => {
    if (!activeListing || !isValidAllocation) return;

    setActionLoading("SAVE");
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: ListingSplitInputItem[] = allocations.map((a) => ({
        recipientUserId: a.userId,
        payoutMethodId: a.payoutMethodId,
        allocationPercentage: a.percentage,
        ruleType: allocations.length > 1 ? "PERCENTAGE_SPLIT" : "LISTING_DEFAULT",
      }));

      const res = await fetch("/api/v1/host/payout-routing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: activeListing.id,
          rules: payload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to save payout routing rules.");
      }

      const savedRules: PayoutRoutingRuleDTO[] = data.data || [];

      // Update state
      setRules((prev) => [
        ...prev.filter((r) => r.listingId !== activeListing.id),
        ...savedRules,
      ]);

      setSuccessMsg(`Payout routing rules updated for "${activeListing.title}".`);
      closeConfigureDrawer();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save routing rules.");
    } finally {
      setActionLoading(null);
    }
  };

  // Revert rules to default
  const handleRevertRules = async () => {
    if (!revertingListing) return;

    setActionLoading("REVERT");
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/host/payout-routing-rules/${revertingListing.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to revert routing rules.");
      }

      setRules((prev) => prev.filter((r) => r.listingId !== revertingListing.id));
      setSuccessMsg(`"${revertingListing.title}" reverted to default account.`);
      setRevertingListing(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to revert routing rules.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Messages */}
      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 flex items-start gap-3">
          <AlertTriangleIcon size={18} className="shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-700 hover:text-red-950 text-xs font-medium"
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
            className="text-emerald-700 hover:text-emerald-950 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SECTION 1: DEFAULT PAYOUT DESTINATION CARD */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900">
              <BuildingBankIcon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-medium text-zinc-950">Default Payout Destination</h2>
                <SettingsStatusBadge label="Account Default" variant="success" />
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                All booking earnings are disbursed 100% to this account unless specific listing routing rules or co-host splits are defined below.
              </p>
            </div>
          </div>
          <Link
            href="/host/account-settings/payouts"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors shrink-0 self-start"
          >
            <span>Manage Methods</span>
            <ExternalLinkIcon size={14} />
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
          {defaultPayoutMethod ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-950">
                  {defaultPayoutMethod.bankName || "Commercial Bank"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600 font-mono">
                  {defaultPayoutMethod.ibanMasked}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Beneficiary: {defaultPayoutMethod.accountHolderName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                  <CheckCircleIcon size={13} />
                  Verified & Active
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-amber-900">
              <AlertTriangleIcon size={18} className="text-amber-600 shrink-0" />
              <div className="text-xs sm:text-sm">
                <span>No verified default bank account set. </span>
                <Link
                  href="/host/account-settings/payouts/add"
                  className="font-medium underline hover:text-amber-950"
                >
                  Add a Saudi IBAN payout method
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: LISTING-SPECIFIC ROUTING & SPLIT DISTRIBUTION */}
      <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-900">
                <SplitIcon size={20} />
              </div>
              <h2 className="text-lg font-medium text-zinc-950">
                Listing Routing & Split Rules
              </h2>
            </div>
            <p className="mt-1 text-sm text-zinc-600">
              Route reservation revenue from specific listings to dedicated accounts or split earnings with accepted co-hosts.
            </p>
          </div>
        </div>

        {listings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-sm text-zinc-600">No active listings found for your host account.</p>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-zinc-200">
            {listings.map((listing) => {
              const activeRules = rulesByListing.get(listing.id) || [];
              const isCustom = activeRules.length > 0;

              return (
                <div key={listing.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-sm font-medium text-zinc-950 truncate">
                          {listing.title}
                        </h3>
                        {listing.city && (
                          <span className="text-xs text-zinc-500">({listing.city})</span>
                        )}
                        {isCustom ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-900">
                            <SplitIcon size={12} />
                            {activeRules.length > 1
                              ? `Split (${activeRules.map((r) => `${r.allocationPercentage}%`).join(" / ")})`
                              : "Listing Dedicated"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                            Default Destination (100%)
                          </span>
                        )}
                      </div>

                      {/* Rules Breakdown */}
                      <div className="mt-3">
                        {isCustom ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {activeRules.map((r) => (
                              <div
                                key={r.id}
                                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-zinc-900 flex items-center gap-1">
                                    {r.recipientName || "Recipient"}
                                    {r.isCoHost ? (
                                      <span className="rounded bg-amber-100 px-1 py-0.2 text-[10px] font-medium text-amber-900">
                                        Co-Host
                                      </span>
                                    ) : (
                                      <span className="rounded bg-zinc-200 px-1 py-0.2 text-[10px] font-medium text-zinc-800">
                                        Host
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-medium text-indigo-950">
                                    {r.allocationPercentage}%
                                  </span>
                                </div>
                                <p className="mt-1 text-zinc-600 font-mono text-[11px]">
                                  {r.payoutMethodMasked} • {r.bankName || "Commercial Bank"}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500">
                            Revenues flow 100% to your account default (
                            {defaultPayoutMethod?.bankName || "Default Bank"},{" "}
                            {defaultPayoutMethod?.ibanMasked || "SA** ****"}).
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-start">
                      <button
                        onClick={() => openConfigureDrawer(listing)}
                        className="rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors shadow-2xs"
                      >
                        {isCustom ? "Edit Routing" : "Configure Routing"}
                      </button>

                      {isCustom && (
                        <button
                          onClick={() => setRevertingListing(listing)}
                          className="rounded-full border border-red-200 bg-red-50/50 px-3.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                        >
                          Revert
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL / DRAWER: CONFIGURE ROUTING RULE */}
      {activeListing && (
        <ModalOverlay
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs"
          onClose={closeConfigureDrawer}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-zinc-100 max-h-[min(90vh,780px)] overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
              <div>
                <h3 className="text-lg font-medium text-zinc-950">
                  Configure Payout Routing
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Listing: <span className="font-medium text-zinc-900">{activeListing.title}</span>
                </p>
              </div>
              <button
                onClick={closeConfigureDrawer}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
              >
                <XIcon size={18} />
              </button>
            </div>

            {recipientsLoading ? (
              <div className="py-12 text-center text-xs text-zinc-500">
                Loading eligible recipients and verified accounts...
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Recipients & Revenue Splits
                  </h4>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    Select recipients and assign integer percentages. The total allocation must equal exactly 100%.
                  </p>
                </div>

                {eligibleRecipients.map((rec) => {
                  const isIncluded = allocations.some((a) => a.userId === rec.userId);
                  const currentAlloc = allocations.find((a) => a.userId === rec.userId);
                  const hasMethods = rec.verifiedPayoutMethods.length > 0;

                  return (
                    <div
                      key={rec.userId}
                      className={`rounded-2xl border p-4 transition-all ${
                        isIncluded
                          ? "border-indigo-300 bg-indigo-50/30"
                          : "border-zinc-200 bg-zinc-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            disabled={!hasMethods || (isIncluded && allocations.length === 1)}
                            onChange={() => handleToggleRecipient(rec)}
                            className="size-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-zinc-950">
                                {rec.name}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  rec.role === "PRIMARY_HOST"
                                    ? "bg-zinc-200 text-zinc-800"
                                    : "bg-amber-100 text-amber-900"
                                }`}
                              >
                                {rec.role === "PRIMARY_HOST" ? "Primary Host" : "Co-Host"}
                              </span>
                            </div>
                            <span className="text-xs text-zinc-500">{rec.email}</span>
                          </div>
                        </div>

                        {/* Percentage Input */}
                        {isIncluded && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={currentAlloc?.percentage ?? ""}
                              onChange={(e) =>
                                handlePercentageChange(rec.userId, parseInt(e.target.value) || 0)
                              }
                              className="w-18 rounded-xl border border-zinc-300 px-2.5 py-1.5 text-right text-sm font-medium text-zinc-950 focus:border-indigo-500 focus:outline-none"
                            />
                            <span className="text-xs font-medium text-zinc-700">%</span>
                          </div>
                        )}
                      </div>

                      {/* Account selection if included */}
                      {isIncluded && hasMethods && (
                        <div className="mt-3 pl-6">
                          <label className="text-[11px] font-medium text-zinc-600">
                            Destination Payout Method:
                          </label>
                          <select
                            value={currentAlloc?.payoutMethodId}
                            onChange={(e) => handleMethodChange(rec.userId, e.target.value)}
                            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none"
                          >
                            {rec.verifiedPayoutMethods.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.bankName} ({m.ibanMasked}) {m.isDefault ? "— Default" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {!hasMethods && (
                        <div className="mt-2 pl-6 text-xs text-amber-800 flex items-center gap-1.5">
                          <AlertTriangleIcon size={14} className="shrink-0 text-amber-600" />
                          <span>No verified payout method added. This recipient cannot receive splits.</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Live Percentage Validation Bar */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-900">Total Allocation:</span>
                    <span
                      className={`font-medium ${
                        totalPercentage === 100
                          ? "text-emerald-700"
                          : totalPercentage < 100
                          ? "text-amber-700"
                          : "text-red-700"
                      }`}
                    >
                      {totalPercentage}% / 100%
                    </span>
                  </div>

                  {/* Progress track */}
                  <div className="mt-2 h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        totalPercentage === 100
                          ? "bg-emerald-600"
                          : totalPercentage < 100
                          ? "bg-amber-500"
                          : "bg-red-600"
                      }`}
                      style={{ width: `${Math.min(100, totalPercentage)}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-zinc-500">
                    {totalPercentage === 100 ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircleIcon size={14} /> Exact 100% allocation. Ready to save.
                      </span>
                    ) : totalPercentage < 100 ? (
                      <span className="text-amber-700">
                        Remaining: {100 - totalPercentage}% must be allocated.
                      </span>
                    ) : (
                      <span className="text-red-700">
                        Exceeds 100% by {totalPercentage - 100}%. Total must strictly equal 100%.
                      </span>
                    )}
                  </p>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                  <button
                    onClick={closeConfigureDrawer}
                    className="rounded-full px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRules}
                    disabled={!isValidAllocation || actionLoading === "SAVE"}
                    className="rounded-full bg-zinc-950 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading === "SAVE" ? "Saving..." : "Save Routing Rule"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* CONFIRMATION MODAL: REVERT TO DEFAULT */}
      {revertingListing && (
        <ModalOverlay
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClose={() => setRevertingListing(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-100"
          >
            <h3 className="text-base font-medium text-zinc-950">
              Revert to Default Payout Destination?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Are you sure you want to disable custom routing and co-host splits for{" "}
              <strong className="text-zinc-900">{revertingListing.title}</strong>? All future earnings will route 100% to your account default bank account.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setRevertingListing(null)}
                className="rounded-full px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                Keep Custom Rules
              </button>
              <button
                onClick={handleRevertRules}
                disabled={actionLoading === "REVERT"}
                className="rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "REVERT" ? "Reverting..." : "Yes, Revert to Default"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

