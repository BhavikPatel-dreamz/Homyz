"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";
import type { HostEarningsDetails, HostPayoutMethod } from "@/services/payout.service";

interface HostEarningsClientProps {
  initialData: HostEarningsDetails;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return dateFormatter.format(new Date(val));
  } catch {
    return String(val);
  }
}

export function HostEarningsClient({ initialData }: HostEarningsClientProps) {
  const { formatPrice } = useCurrency();

  const [data, setData] = useState<HostEarningsDetails>(initialData);
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "completed">("all");
  const [search, setSearch] = useState("");

  // Add payout method modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [methodLoading, setMethodLoading] = useState(false);

  // Selected payout for detail modal
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);

  const reloadData = async () => {
    try {
      const res = await fetch("/api/v1/host/earnings");
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
      }
    } catch (err) {
      console.error("[HostEarningsClient] Reload error:", err);
    }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setMethodLoading(true);
    setMethodError(null);
    try {
      const res = await fetch("/api/v1/host/payout-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName,
          bankName,
          iban,
          isDefault,
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error?.message || "Failed to add payout method");
      }
      setIsAddModalOpen(false);
      setAccountHolderName("");
      setBankName("");
      setIban("");
      setIsDefault(false);
      await reloadData();
    } catch (err: any) {
      setMethodError(err.message || String(err));
    } finally {
      setMethodLoading(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      const res = await fetch(`/api/v1/host/payout-methods/${methodId}/default`, {
        method: "PUT",
      });
      if (res.ok) {
        await reloadData();
      }
    } catch (err) {
      console.error("Set default failed", err);
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    if (!confirm("Are you sure you want to remove this payout method?")) return;
    try {
      const res = await fetch(`/api/v1/host/payout-methods/${methodId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await reloadData();
      }
    } catch (err) {
      console.error("Delete method failed", err);
    }
  };

  const summary = data.summary;
  const allPayouts = [
    ...data.upcomingPayouts.map((p) => ({ ...p, type: "upcoming" })),
    ...data.completedPayouts.map((p) => ({ ...p, type: "completed" })),
  ];

  const filteredPayouts = allPayouts.filter((p) => {
    if (activeTab === "upcoming" && p.type !== "upcoming") return false;
    if (activeTab === "completed" && p.type !== "completed") return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchProp = p.listingTitle?.toLowerCase().includes(term);
      const matchGuest = p.guestName?.toLowerCase().includes(term);
      const matchId = p.bookingId?.toLowerCase().includes(term);
      return matchProp || matchGuest || matchId;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Earnings & Payouts
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your payout methods, view upcoming disbursements, and track completed earnings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/v1/host/earnings/export"
            download
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition-all"
          >
            <span>Export Statement</span>
          </a>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-black transition-all"
          >
            <span>+ Add Payout Method</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Paid Out */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Paid Out
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatPrice(summary.totalPaidVolume / 100, summary.currency)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{summary.totalPaidCount} completed payouts</p>
        </div>

        {/* Upcoming Payouts */}
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-5 shadow-2xs">
          <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
            Upcoming Scheduled
          </p>
          <p className="text-2xl font-bold text-sky-900 mt-2">
            {formatPrice(summary.scheduledPendingVolume / 100, summary.currency)}
          </p>
          <p className="text-xs text-sky-600 mt-1">{summary.scheduledPendingCount} pending stays</p>
        </div>

        {/* Eligible for Settlement */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-2xs">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Eligible for Settlement
          </p>
          <p className="text-2xl font-bold text-emerald-900 mt-2">
            {formatPrice(summary.eligibleSettlementVolume / 100, summary.currency)}
          </p>
          <p className="text-xs text-emerald-600 mt-1">{summary.eligibleSettlementCount} stays ready</p>
        </div>

        {/* On Hold / In Review */}
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-2xs">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            On Hold / Pending Review
          </p>
          <p className="text-2xl font-bold text-amber-900 mt-2">
            {formatPrice(summary.onHoldVolume / 100, summary.currency)}
          </p>
          <p className="text-xs text-amber-600 mt-1">{summary.onHoldCount} reservations held</p>
        </div>
      </div>

      {/* Payout Methods Management Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Configured Payout Methods</h2>
            <p className="text-xs text-gray-500">
              Disbursements in Saudi Arabia require a verified Saudi IBAN linked to your verified identity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            + Add Another Account
          </button>
        </div>

        {data.payoutMethods.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-gray-700">No payout method configured yet</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Add your Saudi IBAN bank account so Homyz can disburse your booking earnings 24 hours after guest check-in.
            </p>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold"
            >
              Add Payout Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.payoutMethods.map((m) => (
              <div
                key={m.id}
                className={`p-4 rounded-xl border flex flex-col justify-between ${
                  m.isDefault ? "border-emerald-500/40 bg-emerald-50/20" : "border-gray-200 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900">{m.bankName}</span>
                    <div className="flex items-center gap-2">
                      {m.isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                          Default
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-3xs font-semibold ${
                          m.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-800"
                            : m.status === "REJECTED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {m.status === "VERIFIED"
                          ? "Verified"
                          : m.status === "REJECTED"
                          ? "Rejected"
                          : "Pending Verification"}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-mono font-semibold text-gray-700 mt-2">
                    {m.ibanMasked}
                  </p>
                  <p className="text-2xs text-gray-500 mt-0.5">Beneficiary: {m.accountHolderName}</p>
                  {m.rejectionReason && (
                    <p className="text-2xs text-rose-600 mt-1">Reason: {m.rejectionReason}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100 text-xs">
                  {!m.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(m.id)}
                      className="text-2xs font-semibold text-gray-600 hover:text-gray-900 hover:underline"
                    >
                      Make Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteMethod(m.id)}
                    className="text-2xs font-semibold text-rose-600 hover:text-rose-800 hover:underline ml-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payouts History & Upcoming Table */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 border-b sm:border-b-0 border-gray-200">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "all" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              All Payouts ({allPayouts.length})
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "upcoming" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Upcoming ({data.upcomingPayouts.length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "completed" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Completed ({data.completedPayouts.length})
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search property or guest..."
            className="w-full sm:w-64 px-3 py-1.5 rounded-xl border border-gray-300 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Reservation</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Guest</th>
                <th className="py-3 px-4">Scheduled Date</th>
                <th className="py-3 px-4">Gross Earnings</th>
                <th className="py-3 px-4">Platform Fee</th>
                <th className="py-3 px-4">Net Payout</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">
                    No reservations found in this view.
                  </td>
                </tr>
              ) : (
                filteredPayouts.map((p) => (
                  <tr key={p.bookingId} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-gray-900">
                      {p.bookingId.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 max-w-[180px] truncate">
                      {p.listingTitle}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{p.guestName}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-2xs">
                      {formatDate(p.scheduledPayoutDate)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {formatPrice(p.grossEarnings / 100, p.currency)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-rose-600">
                      -{formatPrice(p.platformFee / 100, p.currency)}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                      {formatPrice(p.netPayout / 100, p.currency)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                          p.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "ELIGIBLE_SETTLEMENT"
                            ? "bg-teal-100 text-teal-800"
                            : p.status === "SCHEDULED"
                            ? "bg-sky-100 text-sky-800"
                            : p.status === "ON_HOLD"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedPayout(p)}
                        className="text-2xs font-semibold text-gray-700 hover:text-gray-900 hover:underline"
                      >
                        Breakdown
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Payout Method Modal with ModalOverlay */}
      {isAddModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="text-base font-bold text-gray-900">Add Saudi Bank Account</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {methodError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {methodError}
              </div>
            )}

            <form onSubmit={handleAddMethod} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Beneficiary Account Holder Name
                </label>
                <input
                  type="text"
                  required
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="e.g. Mohammed Al-Otaibi"
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs text-gray-900"
                />
                <span className="text-3xs text-gray-500 mt-0.5 block">
                  Must match your verified government ID legal name.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Al Rajhi Bank, SNB, Riyad Bank"
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs text-gray-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Saudi IBAN (24 Characters)
                </label>
                <input
                  type="text"
                  required
                  value={iban}
                  onChange={(e) => setIban(e.target.value.toUpperCase())}
                  placeholder="SA00 0000 0000 0000 0000 0000"
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-mono text-xs text-gray-900 uppercase"
                />
                <span className="text-3xs text-gray-500 mt-0.5 block">
                  Starts with &quot;SA&quot; followed by 22 digits.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="defaultCheck"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-gray-900 focus:ring-gray-900"
                />
                <label htmlFor="defaultCheck" className="text-xs text-gray-700 cursor-pointer">
                  Set as my default payout account
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={methodLoading}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black disabled:opacity-50"
                >
                  {methodLoading ? "Saving..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Payout Details Modal with ModalOverlay */}
      {selectedPayout && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="text-base font-bold text-gray-900">Earnings Breakdown</h3>
              <button
                onClick={() => setSelectedPayout(null)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <span className="text-xs text-gray-500 font-medium">Net Payout to Host</span>
              <p className="text-3xl font-black text-gray-900 mt-1">
                {formatPrice(selectedPayout.netPayout / 100, selectedPayout.currency)}
              </p>
              <span className="text-2xs text-emerald-700 font-semibold block mt-1">
                Status: {selectedPayout.status}
              </span>
            </div>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl text-xs overflow-hidden">
              <div className="flex justify-between p-3">
                <span className="text-gray-500">Gross Booking Value</span>
                <span className="font-semibold text-gray-900">
                  {formatPrice(selectedPayout.grossEarnings / 100, selectedPayout.currency)}
                </span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-gray-500">Homyz Platform Fee (Commission)</span>
                <span className="font-semibold text-rose-600">
                  -{formatPrice(selectedPayout.platformFee / 100, selectedPayout.currency)}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 font-bold">
                <span className="text-gray-900">Net Host Disbursement</span>
                <span className="text-gray-900">
                  {formatPrice(selectedPayout.netPayout / 100, selectedPayout.currency)}
                </span>
              </div>
            </div>

            <div className="text-2xs text-gray-500 space-y-1">
              <p>Property: {selectedPayout.listingTitle}</p>
              <p>Guest: {selectedPayout.guestName}</p>
              <p>Check-In: {formatDate(selectedPayout.startDate)}</p>
              <p>Scheduled Payout Date: {formatDate(selectedPayout.scheduledPayoutDate)}</p>
              {selectedPayout.executionDetails && (
                <p className="font-mono text-emerald-700 font-semibold">
                  Disbursed: Ref {selectedPayout.executionDetails.settlementReference}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold"
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

