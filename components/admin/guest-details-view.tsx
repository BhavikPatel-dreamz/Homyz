"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GuestDetailsData } from "@/services/admin.service";
import { UserStatus } from "@/generated/prisma/enums";
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
  const [data, setData] = useState<GuestDetailsData>(initialData);
  const [activeTab, setActiveTab] = useState<"overview" | "bookings" | "activity">("overview");

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form states
  const [editName, setEditName] = useState(data.guest.name || "");
  const [editEmail, setEditEmail] = useState(data.guest.email || "");
  const [editPhone, setEditPhone] = useState(data.guest.phone || "");

  const [suspendReason, setSuspendReason] = useState("");

  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const guest = data.guest;
  const metrics = data.metrics;

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateGuestAction(guest.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
      });

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to update guest profile" });
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
      setFeedback({ tone: "success", msg: "Guest profile updated successfully!" });
      router.refresh();
    });
  }

  function handleSuspendSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const suspend = guest.status !== "SUSPENDED";
    startTransition(async () => {
      const res = await toggleGuestSuspensionAction(guest.id, suspend, suspendReason);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to toggle guest suspension" });
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
      setFeedback({
        tone: "success",
        msg: `Guest account ${suspend ? "suspended" : "unsuspended"} successfully.`,
      });
      router.refresh();
    });
  }

  function handleDeleteSubmit() {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteGuestAction(guest.id);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to delete guest" });
        setShowDeleteModal(false);
        return;
      }

      router.push("/admin/guests");
    });
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-zinc-900 pb-12">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/guests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          ← Back to Guest Registry
        </Link>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`rounded-2xl p-4 text-xs font-semibold flex items-center justify-between border ${
            feedback.tone === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span>{feedback.msg}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Guest Profile Header Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-2xl shadow-inner border border-blue-200">
            {(guest.name?.[0] || guest.email?.[0] || "G").toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
                {guest.name || "Unnamed Guest"}
              </h1>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  guest.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {guest.status}
              </span>
            </div>

            <p className="mt-1 text-xs text-zinc-500 font-mono">{guest.email} • ID: {guest.id}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-all"
          >
            Edit Profile
          </button>

          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all border ${
              guest.status === "SUSPENDED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
            }`}
          >
            {guest.status === "SUSPENDED" ? "Unsuspend Account" : "Suspend Account"}
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-full bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white transition-all shadow-2xs"
          >
            Delete Guest
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-500">Total Bookings</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">{metrics.totalBookings}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-500">Total Spending</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">${(metrics.totalSpending / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-500">Joined Date</p>
          <p className="mt-2 text-base font-bold tracking-tight text-zinc-900">{new Date(guest.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-500">Last Active</p>
          <p className="mt-2 text-base font-bold tracking-tight text-zinc-900">{new Date(guest.lastActive).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 flex items-center gap-2 overflow-x-auto pt-2">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "bookings", label: `Bookings History (${data.bookings.length})` },
            { id: "activity", label: `Activity (${data.activity.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-900 font-extrabold"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">Personal & Contact Info</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-400 block font-medium">Full Name</span>
                <span className="font-semibold text-zinc-900">{guest.name || "Not provided"}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Email Address</span>
                <span className="font-semibold text-zinc-900">{guest.email || "Not provided"}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Phone Number</span>
                <span className="font-semibold text-zinc-900">{guest.phone || "Not provided"}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Role</span>
                <span className="font-semibold text-zinc-900">{guest.role}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Account Status</span>
                <span className="font-semibold text-zinc-900">{guest.status}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">Account System Timestamps</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-400 block font-medium">Joined Date</span>
                <span className="font-semibold text-zinc-900">{new Date(guest.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Last Active Timestamp</span>
                <span className="font-semibold text-zinc-900">{new Date(guest.lastActive).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: BOOKINGS */}
      {activeTab === "bookings" && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-100 bg-zinc-50/50 text-zinc-400 font-semibold uppercase tracking-wider">
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
            <tbody className="divide-y divide-zinc-100">
              {data.bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    No reservations recorded for this guest.
                  </td>
                </tr>
              ) : (
                data.bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-zinc-900">{b.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-zinc-900">{b.listingTitle}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-900">{b.hostName || "Host"}</div>
                      <div className="text-[11px] text-zinc-400">{b.hostEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500">{new Date(b.startDate).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4 text-zinc-500">{new Date(b.endDate).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-zinc-900">${(b.amount / 100).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: ACTIVITY */}
      {activeTab === "activity" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">Guest Activity History Logs</h2>
          {data.activity.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">No recorded activity history for this guest.</p>
          ) : (
            <div className="space-y-3">
              {data.activity.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-3 rounded-xl border border-zinc-100 text-xs">
                  <div>
                    <span className="font-bold text-zinc-900">{log.action}</span>
                    <p className="text-zinc-600 mt-0.5">{log.description}</p>
                    <span className="text-[11px] text-zinc-400 mt-1 block">Actor: {log.actorEmail || "System"}</span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EDIT GUEST MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Edit Guest Profile</h3>
            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none focus:border-zinc-500"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none focus:border-zinc-500"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none focus:border-zinc-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-full border border-zinc-200 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[#F8D88E] hover:bg-[#F4CF74] px-4 py-2 font-bold text-zinc-900 shadow-2xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUSPEND / UNSUSPEND MODAL */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">
              {guest.status === "SUSPENDED" ? "Unsuspend Guest Account" : "Suspend Guest Account"}
            </h3>
            <p className="text-xs text-zinc-500">
              {guest.status === "SUSPENDED"
                ? "This will restore active status for this guest."
                : "Suspending this guest will block future booking actions. No historical data will be deleted."}
            </p>

            <form onSubmit={handleSuspendSubmit} className="space-y-3 text-xs">
              {guest.status !== "SUSPENDED" && (
                <div>
                  <label className="block text-zinc-700 font-semibold mb-1">Suspension Reason</label>
                  <textarea
                    rows={3}
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Reason for suspending guest..."
                    className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSuspendModal(false)}
                  className="rounded-full border border-zinc-200 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={`rounded-full px-4 py-2 font-bold text-white shadow-2xs ${
                    guest.status === "SUSPENDED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE GUEST MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3 className="text-lg font-bold text-rose-700">Delete Guest Account</h3>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <strong className="block mb-1 font-bold">⚠️ Warning: Destructive Action</strong>
              Are you sure you want to delete this guest account ({guest.email})? If the guest has active confirmed bookings, deletion will be blocked automatically.
            </div>

            <div className="flex justify-end gap-2 pt-3 text-xs">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-full border border-zinc-200 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={pending}
                className="rounded-full bg-rose-600 hover:bg-rose-700 px-4 py-2 font-bold text-white shadow-2xs"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
