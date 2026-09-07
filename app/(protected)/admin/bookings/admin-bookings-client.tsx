"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useMemo } from "react";
import { AdminPagination } from "@/components/admin/admin-pagination";

export interface BookingItem {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  listing: {
    id: string;
    title: string;
    price: number;
    host: {
      id: string;
      name: string | null;
      email: string | null;
    };
  };
}

export function AdminBookingsClient({
  initialBookings,
  summary,
}: {
  initialBookings: BookingItem[];
  summary: { total: number; pending: number; confirmed: number; cancelled: number };
}) {
  const [bookings] = useState<BookingItem[]>(initialBookings);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchGuest = b.user.name?.toLowerCase().includes(q) || b.user.email?.toLowerCase().includes(q);
        const matchHost = b.listing.host.name?.toLowerCase().includes(q) || b.listing.host.email?.toLowerCase().includes(q);
        const matchTitle = b.listing.title.toLowerCase().includes(q);
        const matchId = b.id.toLowerCase().includes(q);
        if (!matchGuest && !matchHost && !matchTitle && !matchId) return false;
      }
      return true;
    });
  }, [bookings, search, statusFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedBookings = useMemo(() => {
    return filtered.slice((activePage - 1) * pageSize, activePage * pageSize);
  }, [filtered, activePage, pageSize]);

  function getDurationNights(start: string, end: string) {
    const d1 = new Date(start).getTime();
    const d2 = new Date(end).getTime();
    const diff = Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
    return diff;
  }

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["Booking ID", "Listing", "Host Email", "Guest Name", "Guest Email", "Check-In", "Check-Out", "Nights", "Total Price", "Status"];
    const rows = filtered.map((b) => {
      const nights = getDurationNights(b.startDate, b.endDate);
      const total = ((b.listing.price / 100) * nights).toFixed(2);
      return [
        `"${b.id}"`,
        `"${b.listing.title.replace(/"/g, '""')}"`,
        `"${b.listing.host.email || ""}"`,
        `"${b.user.name || ""}"`,
        `"${b.user.email || ""}"`,
        `"${new Date(b.startDate).toLocaleDateString()}"`,
        `"${new Date(b.endDate).toLocaleDateString()}"`,
        `"${nights}"`,
        `"$${total}"`,
        `"${b.status}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `admin_bookings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1>
            Bookings Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Monitor, inspect, and manage reservation lifecycles across all properties.
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

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Bookings</p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-muted-foreground">{summary.total}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">All time reservations</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Confirmed</p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{summary.confirmed}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Active & completed</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Pending Approval</p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">{summary.pending}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Awaiting host action</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Cancelled</p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">{summary.cancelled}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Cancelled reservations</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking ID, listing, guest name, host..."
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-2 pl-9 pr-9 text-xs text-muted-foreground outline-none focus:border-[var(--accent)] transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-muted-foreground hover:bg-[var(--surface)] transition-colors"
              title="Clear search"
              aria-label="Clear search"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-muted-foreground outline-none"
          >
            <option value="ALL">Status: All</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Desktop Bookings Table */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">Booking ID</th>
                <th className="py-3.5 px-4">Property Listing</th>
                <th className="py-3.5 px-4">Guest</th>
                <th className="py-3.5 px-4">Dates</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Amount</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                    No bookings found matching the selected filter.
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((booking) => {
                  const nights = getDurationNights(booking.startDate, booking.endDate);
                  const totalPrice = ((booking.listing.price / 100) * nights).toFixed(2);

                  return (
                    <tr
                      key={booking.id}
                      className="hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--muted-foreground)] font-bold">
                        #{booking.id.slice(-8)}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[200px]">{booking.listing.title}</span>
                          <span className="text-[10px] text-[var(--muted-foreground)] font-normal">Host: {booking.listing.host.name || booking.listing.host.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="font-semibold">{booking.user.name || "Guest"}</span>
                          <span className="text-[10px] text-[var(--muted-foreground)]">{booking.user.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-[var(--muted-foreground)] font-mono text-[11px]">
                        {new Date(booking.startDate).toLocaleDateString([], { month: "short", day: "numeric" })} — {new Date(booking.endDate).toLocaleDateString([], { month: "short", day: "numeric" })} ({nights} nights)
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-muted-foreground font-mono">
                        ${totalPrice}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            booking.status === "CONFIRMED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : booking.status === "CANCELLED"
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {booking.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(booking);
                          }}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Bookings Card List */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-xs text-[var(--muted-foreground)]">
            No bookings found matching the selected filter.
          </div>
        ) : (
          paginatedBookings.map((booking) => {
            const nights = getDurationNights(booking.startDate, booking.endDate);
            const totalPrice = ((booking.listing.price / 100) * nights).toFixed(2);

            return (
              <div
                key={booking.id}
                onClick={() => setSelectedBooking(booking)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-2.5 active:bg-[var(--surface-secondary)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] text-[var(--muted-foreground)] block">#{booking.id.slice(-8)}</span>
                    <h3 className="font-bold text-xs text-muted-foreground mt-0.5">{booking.listing.title}</h3>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      booking.status === "CONFIRMED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : booking.status === "CANCELLED"
                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[var(--border-subtle)]">
                  <div>
                    <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Guest</span>
                    <span className="font-medium text-muted-foreground">{booking.user.name || "Guest"}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Amount</span>
                    <span className="font-bold text-muted-foreground font-mono">${totalPrice}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Dates</span>
                    <span className="font-mono text-[var(--muted-foreground)]">
                      {new Date(booking.startDate).toLocaleDateString([], { month: "short", day: "numeric" })} — {new Date(booking.endDate).toLocaleDateString([], { month: "short", day: "numeric" })} ({nights} nights)
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBooking(booking);
                    }}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <AdminPagination
        currentPage={activePage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        itemLabel="bookings"
        pageSizeOptions={[10, 20, 50]}
      />

      {/* Booking Details Modal */}
      {selectedBooking && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="text-base font-bold text-muted-foreground">
                  Booking Details #{selectedBooking.id.slice(-8)}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">Created {new Date(selectedBooking.createdAt).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="rounded-xl bg-[var(--surface-secondary)] p-3.5 border border-[var(--border-subtle)] flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Property Information</span>
                <p className="font-bold text-sm text-muted-foreground">{selectedBooking.listing.title}</p>
                <p className="text-[var(--muted-foreground)]">Host: {selectedBooking.listing.host.name || selectedBooking.listing.host.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--surface-secondary)] p-3 border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1">Guest</span>
                  <p className="font-bold text-muted-foreground">{selectedBooking.user.name || "Guest"}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{selectedBooking.user.email}</p>
                </div>

                <div className="rounded-xl bg-[var(--surface-secondary)] p-3 border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1">Status</span>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--accent)] text-[var(--accent-foreground)]">
                    {selectedBooking.status}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--surface-secondary)] p-3.5 border border-[var(--border-subtle)] flex justify-between items-center font-mono">
                <div>
                  <span className="text-[10px] text-[var(--muted-foreground)] block">Check-in / Check-out</span>
                  <span className="font-bold">{new Date(selectedBooking.startDate).toLocaleDateString()} → {new Date(selectedBooking.endDate).toLocaleDateString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--muted-foreground)] block">Total Amount</span>
                  <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                    ${((selectedBooking.listing.price / 100) * getDurationNights(selectedBooking.startDate, selectedBooking.endDate)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="rounded-full bg-[var(--primary)] text-primary-foreground px-5 py-2 text-xs font-bold shadow-2xs"
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
