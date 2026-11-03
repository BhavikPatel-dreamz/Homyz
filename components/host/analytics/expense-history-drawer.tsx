"use client";

import React, { useState, useMemo } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";

interface ExpenseItem {
  id: string;
  listingId: string;
  category: string;
  amountCents: number;
  currency: string;
  expenseDate: string;
  description: string | null;
}

interface ExpenseHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: ExpenseItem[];
  listings: Array<{ id: string; title: string }>;
  currency?: string;
  onExpenseVoided: () => void;
}

const fmt = (cents: number, curr = "SAR") => {
  const val = Math.round(cents / 100);
  return `${curr} ${val.toLocaleString("en-US")}`;
};

export function ExpenseHistoryDrawer({
  isOpen,
  onClose,
  expenses,
  listings,
  currency = "SAR",
  onExpenseVoided,
}: ExpenseHistoryDrawerProps) {
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const listingTitleMap = useMemo(() => {
    return new Map(listings.map((l) => [l.id, l.title]));
  }, [listings]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (filterCategory !== "ALL" && e.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const descMatch = e.description?.toLowerCase().includes(q);
        const titleMatch = listingTitleMap.get(e.listingId)?.toLowerCase().includes(q);
        const catMatch = e.category.toLowerCase().includes(q);
        if (!descMatch && !titleMatch && !catMatch) return false;
      }
      return true;
    });
  }, [expenses, filterCategory, search, listingTitleMap]);

  const handleVoid = async (id: string) => {
    if (!window.confirm("Void this operating expense? It will be removed from profit calculations while preserving an audit entry.")) {
      return;
    }

    setVoidingId(id);
    try {
      const res = await fetch(`/api/v1/host/earnings/expenses/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Corrected by host" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to void expense.");
      toast.success("Expense voided successfully.");
      onExpenseVoided();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void expense.");
    } finally {
      setVoidingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[85vh] rounded-3xl bg-white shadow-2xl border border-zinc-200 text-zinc-900 flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 p-5 sm:px-6">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-amber-800">
              Audit & Ledger
            </span>
            <h2 className="text-xl font-medium tracking-tight text-zinc-950 mt-0.5">
              Operating Expenses History
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {expenses.length} total recorded operating cost{expenses.length === 1 ? "" : "s"} in this period.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="size-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center hover:bg-zinc-200 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-zinc-100 bg-zinc-50/50">
          <input
            type="text"
            placeholder="Search description or property..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-800 outline-none focus:border-amber-400"
          >
            <option value="ALL">All Categories</option>
            <option value="CLEANING">Cleaning</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="GUEST_SUPPLIES">Supplies</option>
            <option value="UTILITIES">Utilities</option>
            <option value="LAUNDRY">Laundry</option>
            <option value="PROPERTY_MANAGEMENT">Management</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 p-4 sm:px-6">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 truncate">
                      {listingTitleMap.get(item.listingId) || "Property"}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-normal text-zinc-600 uppercase tracking-wide">
                      {item.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500 font-normal">
                    {new Date(item.expenseDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {item.description ? ` · ${item.description}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-medium text-zinc-950 text-sm">
                    {fmt(item.amountCents, item.currency || currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleVoid(item.id)}
                    disabled={voidingId === item.id}
                    className="text-zinc-400 hover:text-rose-600 font-normal underline underline-offset-2 transition cursor-pointer"
                  >
                    {voidingId === item.id ? "Voiding..." : "Void"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-zinc-500">
              No operating expenses match your search or filter.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 p-4 flex justify-end bg-zinc-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

