"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "@/components/ui/toast";
import type { GuestDetailsData } from "@/services/admin.service";
import { UserStatus } from "@/generated/prisma/enums";
import { AdminPagination } from "./admin-pagination";
import {
  updateGuestAction,
  toggleGuestSuspensionAction,
  deleteGuestAction,
} from "@/actions/admin/guestActions";

interface GuestDetailsViewProps {
  initialData: GuestDetailsData;
}

export function GuestDetailsView({ initialData }: GuestDetailsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabParam = (searchParams.get("tab") || "").toLowerCase() as "overview" | "bookings" | "activity";
  const activeTab = ["overview", "bookings", "activity"].includes(tabParam) ? tabParam : "overview";

  function getTabHref(tabId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const [data, setData] = useState<GuestDetailsData>(initialData);

  // Tab pagination states
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPageSize, setBookingsPageSize] = useState(5);

  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(5);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form states
  const [editName, setEditName] = useState(data.guest.name || "");
  const [editEmail, setEditEmail] = useState(data.guest.email || "");
  const [editPhone, setEditPhone] = useState(data.guest.phone || "");

  const [suspendReason, setSuspendReason] = useState("");
  const [pending, startTransition] = useTransition();

  const guest = data.guest;
  const metrics = data.metrics;

  const totalBookingsPages = Math.max(1, Math.ceil(data.bookings.length / bookingsPageSize));
  const paginatedBookings = data.bookings.slice(
    (bookingsPage - 1) * bookingsPageSize,
    bookingsPage * bookingsPageSize
  );

  const totalActivityPages = Math.max(1, Math.ceil(data.activity.length / activityPageSize));
  const paginatedActivity = data.activity.slice(
    (activityPage - 1) * activityPageSize,
    activityPage * activityPageSize
  );

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateGuestAction(guest.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to update guest profile");
        return;
      }

      setData((prev) => ({
        ...prev,
        guest: {
          ...prev.guest,
          name: editName,
          email: editEmail,
          phone: editPhone,
        },
      }));

      setShowEditModal(false);
      toast.success("Guest profile updated successfully!");
      router.refresh();
    });
  }

  function handleSuspendSubmit(e: React.FormEvent) {
    e.preventDefault();
    const suspend = guest.status !== "SUSPENDED";
    startTransition(async () => {
      const res = await toggleGuestSuspensionAction(guest.id, suspend, suspendReason);
      if (!res.ok) {
        toast.error(res.error || "Failed to toggle guest suspension");
        return;
      }

      setData((prev) => ({
        ...prev,
        guest: {
          ...prev.guest,
          status: suspend ? UserStatus.SUSPENDED : UserStatus.ACTIVE,
        },
      }));

      setShowSuspendModal(false);
      setSuspendReason("");
      toast.success(`Guest account ${suspend ? "suspended" : "unsuspended"} successfully.`);
      router.refresh();
    });
  }

  function handleDeleteSubmit() {
    startTransition(async () => {
      const res = await deleteGuestAction(guest.id);
      if (!res.ok) {
        toast.error(res.error || "Failed to delete guest");
        setShowDeleteModal(false);
        return;
      }

      router.push("/admin/guests");
    });
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-12">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/guests"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--muted-foreground)] hover:text-muted-foreground transition-colors"
        >
          ← Back to Guest Registry
        </Link>
      </div>

      {/* Guest Profile Header Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold flex items-center justify-center text-2xl shadow-inner">
            {(guest.name?.[0] || guest.email?.[0] || "G").toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1>
                {guest.name || "Unnamed Guest"}
              </h1>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                  guest.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
                    : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
                }`}
              >
                {guest.status}
              </span>
            </div>

            <p className="mt-1 text-xs text-[var(--muted-foreground)] font-mono">{guest.email} • ID: {guest.id}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-all border shadow-2xs ${
              guest.status === "SUSPENDED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
            }`}
          >
            {guest.status === "SUSPENDED" ? "Unsuspend Account" : "Suspend Account"}
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-full bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white transition-all shadow-2xs"
          >
            Delete Guest
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Bookings</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-muted-foreground">{metrics.totalBookings}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Spending</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">${(metrics.totalSpending / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Joined Date</p>
          <p className="mt-2 text-base font-extrabold tracking-tight text-muted-foreground font-mono" suppressHydrationWarning>{new Date(guest.createdAt).toLocaleDateString("en-US")}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Last Active</p>
          <p className="mt-2 text-base font-extrabold tracking-tight text-muted-foreground font-mono" suppressHydrationWarning>{new Date(guest.lastActive).toLocaleDateString("en-US")}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border)] flex items-center gap-2 overflow-x-auto pt-2">
        {[
          { id: "overview", label: "Overview" },
          { id: "bookings", label: `Bookings History (${data.bookings.length})` },
          { id: "activity", label: `Activity (${data.activity.length})` },
        ].map((tab) => (
          <Link
            key={tab.id}
            href={getTabHref(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? "border-[var(--accent)] text-muted-foreground font-extrabold"
                : "border-transparent text-[var(--muted-foreground)] hover:text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tab 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h2 className="text-base font-bold text-muted-foreground">Personal & Contact Info</h2>
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-1.5 p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--accent)] hover:bg-[var(--surface-secondary)] transition-all cursor-pointer"
                title="Edit Guest Profile"
                aria-label="Edit Guest Profile"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Full Name</span>
                <span className="font-semibold text-muted-foreground">{guest.name || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Email Address</span>
                <span className="font-semibold text-muted-foreground">{guest.email || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Phone Number</span>
                <span className="font-semibold text-muted-foreground">{guest.phone || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Role</span>
                <span className="font-semibold text-muted-foreground">{guest.role}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Account Status</span>
                <span className="font-semibold text-muted-foreground">{guest.status}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-muted-foreground border-b border-[var(--border-subtle)] pb-3">Account System Timestamps</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Joined Date</span>
                <span className="font-semibold text-muted-foreground font-mono" suppressHydrationWarning>{new Date(guest.createdAt).toLocaleString("en-US")}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Last Active Timestamp</span>
                <span className="font-semibold text-muted-foreground font-mono" suppressHydrationWarning>{new Date(guest.lastActive).toLocaleString("en-US")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: BOOKINGS */}
      {activeTab === "bookings" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Booking ID</th>
                <th className="py-3.5 px-4">Property Title</th>
                <th className="py-3.5 px-4">Host</th>
                <th className="py-3.5 px-4">Check-In</th>
                <th className="py-3.5 px-4">Check-Out</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--muted-foreground)]">
                    No reservations recorded for this guest.
                  </td>
                </tr>
              ) : (
                data.bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-muted-foreground">{b.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-muted-foreground">{b.listingTitle}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-muted-foreground">{b.hostName || "Host"}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{b.hostEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>{new Date(b.startDate).toLocaleDateString("en-US")}</td>
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>{new Date(b.endDate).toLocaleDateString("en-US")}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-muted-foreground">${(b.amount / 100).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          <div className="p-3 border-t border-[var(--border-subtle)]">
            <AdminPagination
              currentPage={bookingsPage}
              totalPages={totalBookingsPages}
              totalItems={data.bookings.length}
              pageSize={bookingsPageSize}
              onPageChange={setBookingsPage}
              onPageSizeChange={(size) => {
                setBookingsPageSize(size);
                setBookingsPage(1);
              }}
              itemLabel="bookings"
              pageSizeOptions={[5, 10, 20]}
            />
          </div>
        </div>
      )}

      {/* Tab 3: ACTIVITY */}
      {activeTab === "activity" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-muted-foreground border-b border-[var(--border-subtle)] pb-3">Guest Activity History Logs</h2>
          {data.activity.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No recorded activity history for this guest.</p>
          ) : (
            <div className="space-y-3">
              {data.activity.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-xs">
                  <div>
                    <span className="font-bold text-muted-foreground">{log.action}</span>
                    <p className="text-[var(--muted-foreground)] mt-0.5">{log.description}</p>
                    <span className="text-[11px] text-[var(--muted-foreground)] mt-1 block">Actor: {log.actorEmail || "System"}</span>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--muted-foreground)]" suppressHydrationWarning>{new Date(log.createdAt).toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EDIT GUEST MODAL */}
      {showEditModal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-muted-foreground">Edit Guest Profile</h3>
            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 font-extrabold text-[var(--accent-foreground)] shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  {pending && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <span>{pending ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* SUSPEND / UNSUSPEND MODAL */}
      {showSuspendModal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-muted-foreground">
              {guest.status === "SUSPENDED" ? "Unsuspend Guest Account" : "Suspend Guest Account"}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {guest.status === "SUSPENDED"
                ? "This will restore active status for this guest."
                : "Suspending this guest will block future booking actions. No historical data will be deleted."}
            </p>

            <form onSubmit={handleSuspendSubmit} className="space-y-3 text-xs">
              {guest.status !== "SUSPENDED" && (
                <div>
                  <label className="block text-[var(--muted-foreground)] font-bold mb-1">Suspension Reason</label>
                  <textarea
                    rows={3}
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Reason for suspending guest..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSuspendModal(false)}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={`rounded-full px-4 py-2 font-extrabold text-white shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 transition-all ${
                    guest.status === "SUSPENDED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {pending && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  <span>{pending ? "Processing..." : "Confirm"}</span>
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* DELETE GUEST MODAL */}
      {showDeleteModal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-rose-600">Delete Guest Account</h3>
            <div className="p-3 bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 rounded-xl text-xs text-rose-800 dark:text-rose-300">
              <strong className="block mb-1 font-bold">⚠️ Warning: Destructive Action</strong>
              Are you sure you want to delete this guest account ({guest.email})? If the guest has active confirmed bookings, deletion will be blocked automatically.
            </div>

            <div className="flex justify-end gap-2 pt-3 text-xs">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={pending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={pending}
                className="rounded-full bg-rose-600 hover:bg-rose-700 px-4 py-2 font-extrabold text-white shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {pending && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                <span>{pending ? "Deleting..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
