"use client";

import React, { useState, useMemo } from "react";

export interface ListingItem {
  id: string;
  title: string;
  description: string;
  price: number;
  published: boolean;
  createdAt: string;
  host: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  bookingCount: number;
}

export function AdminListingsClient({
  initialListings,
  summary,
}: {
  initialListings: ListingItem[];
  summary: { total: number; published: number; draft: number };
}) {
  const [listings] = useState<ListingItem[]>(initialListings);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedListing, setSelectedListing] = useState<ListingItem | null>(null);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (statusFilter === "PUBLISHED" && !l.published) return false;
      if (statusFilter === "DRAFT" && l.published) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchTitle = l.title.toLowerCase().includes(q);
        const matchHost = l.host.name?.toLowerCase().includes(q) || l.host.email?.toLowerCase().includes(q);
        const matchId = l.id.toLowerCase().includes(q);
        if (!matchTitle && !matchHost && !matchId) return false;
      }
      return true;
    });
  }, [listings, search, statusFilter]);

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["Listing ID", "Title", "Host Name", "Host Email", "Price per Night", "Status", "Bookings Count", "Created Date"];
    const rows = filtered.map((l) => [
      `"${l.id}"`,
      `"${l.title.replace(/"/g, '""')}"`,
      `"${l.host.name || ""}"`,
      `"${l.host.email || ""}"`,
      `"$${(l.price / 100).toFixed(2)}"`,
      `"${l.published ? "Published" : "Draft"}"`,
      `"${l.bookingCount}"`,
      `"${new Date(l.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `admin_listings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            Property Listings Directory
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Review, audit, verify, and moderate property listings across the platform.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-4 py-2 text-xs font-bold transition-all shadow-2xs shrink-0 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV ({filtered.length})
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Listings</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--foreground)]">{summary.total}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Platform properties</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Published & Active</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{summary.published}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Live for guest bookings</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Draft / Pending</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-600 dark:text-amber-400">{summary.draft}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Unpublished properties</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, host name, email, listing ID..."
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-2 pl-9 pr-4 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--foreground)] outline-none"
          >
            <option value="ALL">Status: All</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* Listings Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">Listing ID</th>
                <th className="py-3.5 px-4">Title & Description</th>
                <th className="py-3.5 px-4">Host</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Price / Night</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Bookings</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                    No property listings match the selected criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                    onClick={() => setSelectedListing(item)}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--muted-foreground)] font-bold">
                      #{item.id.slice(-8)}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-[var(--foreground)]">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[240px] font-bold">{item.title}</span>
                        <span className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[240px] font-normal">{item.description}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-[var(--foreground)]">
                      <div className="flex flex-col">
                        <span className="font-semibold">{item.host.name || "Host"}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">{item.host.email}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-[var(--foreground)] font-mono">
                      ${(item.price / 100).toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[var(--foreground)] font-bold">
                      {item.bookingCount} reservations
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          item.published
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {item.published ? "PUBLISHED" : "DRAFT"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedListing(item);
                        }}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Listing Details Drawer */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  {selectedListing.title}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">Listing ID: #{selectedListing.id.slice(-12)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="rounded-xl bg-[var(--surface-secondary)] p-3.5 border border-[var(--border-subtle)]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1">Description</span>
                <p className="text-[var(--foreground)] leading-relaxed">{selectedListing.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--surface-secondary)] p-3 border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1">Host</span>
                  <p className="font-bold text-[var(--foreground)]">{selectedListing.host.name || "Host"}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{selectedListing.host.email}</p>
                </div>

                <div className="rounded-xl bg-[var(--surface-secondary)] p-3 border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1">Nightly Rate</span>
                  <p className="font-extrabold text-amber-600 dark:text-amber-400 text-sm font-mono">${(selectedListing.price / 100).toFixed(2)} / night</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2 text-xs font-bold shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
