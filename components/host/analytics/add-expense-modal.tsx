"use client";

import React, { useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  listings: Array<{ id: string; title: string }>;
  selectedListingId?: string | null;
  currency?: string;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: "CLEANING", label: "Cleaning" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "GUEST_SUPPLIES", label: "Supplies & Amenities" },
  { value: "UTILITIES", label: "Utilities (Water, Electric, Wifi)" },
  { value: "LAUNDRY", label: "Laundry & Linens" },
  { value: "PROPERTY_MANAGEMENT", label: "Property Management" },
  { value: "REPAIRS", label: "Repairs & Improvements" },
  { value: "OTHER", label: "Other Operating Cost" },
];

export function AddExpenseModal({
  isOpen,
  onClose,
  listings,
  selectedListingId,
  currency = "SAR",
  onSuccess,
}: AddExpenseModalProps) {
  const [listingId, setListingId] = useState(
    selectedListingId || listings[0]?.id || "",
  );
  const [category, setCategory] = useState("CLEANING");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const amountCents = Math.round(parsedAmount * 100);

    if (!listingId) {
      setError("Please select a property.");
      return;
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError("Please enter a valid expense amount greater than 0.");
      return;
    }
    if (!expenseDate) {
      setError("Please select the date this expense was incurred.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/host/earnings/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          category,
          amountCents,
          currency,
          expenseDate,
          description: description.trim() || null,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Failed to record expense.");
      }

      toast.success("Operating expense recorded successfully!");
      setAmount("");
      setDescription("");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-zinc-900 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label="Close dialog"
          className="absolute top-5 right-5 size-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center hover:bg-zinc-200 transition cursor-pointer"
        >
          ✕
        </button>

        {/* Heading */}
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800">
            Operating Expenses
          </span>
          <h2 className="text-xl font-medium tracking-tight text-zinc-950 mt-1">
            Record Operating Cost
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Record expenses by property and date. Costs are calculated into your
            estimated operating profit.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Property Select */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Property <span className="text-amber-800">*</span>
            </label>
            <select
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          {/* Category Select */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Category <span className="text-amber-800">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Amount & Date in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Amount ({currency}) <span className="text-amber-800">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Expense Date <span className="text-amber-800">*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Notes / Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Deep cleaning supplies after turnover"
              value={description}
              maxLength={120}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-zinc-300 px-5 py-2 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-zinc-950 px-5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-black transition cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Record Expense"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

