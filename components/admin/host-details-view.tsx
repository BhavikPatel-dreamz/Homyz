"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HostDetailsData } from "@/services/admin.service";
import { UserStatus } from "@/generated/prisma/enums";
import { AdminPagination } from "./admin-pagination";
import {
  updateHostAction,
  updateHostVerificationAction,
  toggleHostSuspensionAction,
  deleteHostAction,
} from "@/actions/admin/hostActions";

interface HostDetailsViewProps {
  initialData: HostDetailsData;
}

export function HostDetailsView({ initialData }: HostDetailsViewProps) {
  const router = useRouter();
  const [data, setData] = useState<HostDetailsData>(initialData);
  const [activeTab, setActiveTab] = useState<"overview" | "listings" | "bookings" | "earnings" | "reviews" | "activity">("overview");

  // Tab pagination states
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsPageSize, setListingsPageSize] = useState(5);

  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPageSize, setBookingsPageSize] = useState(5);

  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(5);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVerifModal, setShowVerifModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form states
  const [editName, setEditName] = useState(data.host.name || "");
  const [editEmail, setEditEmail] = useState(data.host.email || "");
  const [editPhone, setEditPhone] = useState(data.host.phone || "");

  const [verifStatusChoice, setVerifStatusChoice] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [verifReason, setVerifReason] = useState("");

  const [suspendReason, setSuspendReason] = useState("");

  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const host = data.host;
  const metrics = data.metrics;

  const totalListingsPages = Math.max(1, Math.ceil(data.listings.length / listingsPageSize));
  const paginatedListings = data.listings.slice(
    (listingsPage - 1) * listingsPageSize,
    listingsPage * listingsPageSize
  );

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

  // Handlers
  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateHostAction(host.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
      });

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to update host profile" });
        return;
      }

      setData((prev) => ({
        ...prev,
        host: {
          ...prev.host,
          name: editName,
          email: editEmail,
          phone: editPhone,
        },
      }));

      setShowEditModal(false);
      setFeedback({ tone: "success", msg: "Host profile updated successfully!" });
      router.refresh();
    });
  }

  function handleVerifSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await updateHostVerificationAction(host.id, verifStatusChoice, verifReason);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to update host verification status" });
        return;
      }

      setData((prev) => ({
        ...prev,
        host: {
          ...prev.host,
          status: verifStatusChoice === "APPROVED" ? "ACTIVE" : prev.host.status,
          verificationStatus: verifStatusChoice,
        },
      }));

      setShowVerifModal(false);
      setFeedback({ tone: "success", msg: `Verification status updated to ${verifStatusChoice}.` });
      router.refresh();
    });
  }

  function handleSuspendSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const suspend = host.status !== "SUSPENDED";
    startTransition(async () => {
      const res = await toggleHostSuspensionAction(host.id, suspend, suspendReason);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to toggle host suspension" });
        return;
      }

      setData((prev) => ({
        ...prev,
        host: {
          ...prev.host,
          status: suspend ? UserStatus.SUSPENDED : UserStatus.ACTIVE,
        },
      }));

      setShowSuspendModal(false);
      setSuspendReason("");
      setFeedback({
        tone: "success",
        msg: `Host account ${suspend ? "suspended" : "unsuspended"} successfully.`,
      });
      router.refresh();
    });
  }

  function handleDeleteSubmit() {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteHostAction(host.id);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to delete host" });
        setShowDeleteModal(false);
        return;
      }

      router.push("/admin/hosts");
    });
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-zinc-900 pb-12">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/hosts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          ← Back to Host Registry
        </Link>
      </div>

      {/* Action feedback */}
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

      {/* Main Profile Header Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-2xl shadow-inner border border-amber-200">
            {(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
                {host.name || "Unnamed Host"}
              </h1>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  host.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {host.status}
              </span>

              {/* Verification Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  host.verificationStatus === "APPROVED"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {host.verificationStatus === "APPROVED" ? "✓ Verified" : "Unverified"}
              </span>
            </div>

            <p className="mt-1 text-xs text-zinc-500 font-mono">{host.email} • ID: {host.id}</p>
          </div>
        </div>

        {/* Header Action Buttons */}
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
            onClick={() => setShowVerifModal(true)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-all"
          >
            Verification Review
          </button>

          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all border ${
              host.status === "SUSPENDED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
            }`}
          >
            {host.status === "SUSPENDED" ? "Unsuspend Account" : "Suspend Account"}
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-full bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white transition-all shadow-2xs"
          >
            Delete Host
          </button>
        </div>
      </div>

      {/* Top Metric Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-500">Listings Owned</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">{metrics.totalListings}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-500">Total Bookings</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">{metrics.totalBookings}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-500">Total Earnings</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">${(metrics.totalEarnings / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold text-zinc-500">Average Rating</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">★ {metrics.averageRating} <span className="text-xs font-normal text-zinc-400">({metrics.reviewsCount} reviews)</span></p>
        </div>
      </div>

      {/* Tabs Bar Navigation */}
      <div className="border-b border-zinc-200 flex items-center gap-2 overflow-x-auto pt-2">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "listings", label: `Listings (${data.listings.length})` },
            { id: "bookings", label: `Bookings (${data.bookings.length})` },
            { id: "earnings", label: "Earnings" },
            { id: "reviews", label: `Reviews (${metrics.reviewsCount})` },
            { id: "activity", label: `Activity (${data.activity.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-amber-500 text-amber-900 font-extrabold"
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
            <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">Personal & Profile Info</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-400 block font-medium">Full Name</span>
                <span className="font-semibold text-zinc-900">{host.name || "Not provided"}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Email Address</span>
                <span className="font-semibold text-zinc-900">{host.email || "Not provided"}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Phone Number</span>
                <span className="font-semibold text-zinc-900">{host.phone || "Not provided"}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">User Role</span>
                <span className="font-semibold text-zinc-900">{host.role}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Account Status</span>
                <span className="font-semibold text-zinc-900">{host.status}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Verification</span>
                <span className="font-semibold text-zinc-900">{host.verificationStatus}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">Account System Timestamps</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-400 block font-medium">Joined Date</span>
                <span className="font-semibold text-zinc-900">{new Date(host.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-zinc-400 block font-medium">Last Active Timestamp</span>
                <span className="font-semibold text-zinc-900">{new Date(host.lastActive).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: LISTINGS */}
      {activeTab === "listings" && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-100 bg-zinc-50/50 text-zinc-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Listing Title</th>
                <th className="py-3.5 px-4">Price / Night</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Bookings Count</th>
                <th className="py-3.5 px-4">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.listings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-400">
                    This host has no property listings yet.
                  </td>
                </tr>
              ) : (
                paginatedListings.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-zinc-900">{item.title}</td>
                    <td className="py-3.5 px-4 text-zinc-700 font-semibold">${(item.price / 100).toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      {item.published ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold">{item.bookingsCount}</td>
                    <td className="py-3.5 px-4 text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="p-3 border-t border-zinc-100">
            <AdminPagination
              currentPage={listingsPage}
              totalPages={totalListingsPages}
              totalItems={data.listings.length}
              pageSize={listingsPageSize}
              onPageChange={setListingsPage}
              onPageSizeChange={(size) => {
                setListingsPageSize(size);
                setListingsPage(1);
              }}
              itemLabel="listings"
              pageSizeOptions={[5, 10, 20]}
            />
          </div>
        </div>
      )}

      {/* Tab 3: BOOKINGS */}
      {activeTab === "bookings" && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-100 bg-zinc-50/50 text-zinc-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Booking ID</th>
                <th className="py-3.5 px-4">Guest</th>
                <th className="py-3.5 px-4">Property Title</th>
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
                    No reservations recorded for this host.
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-zinc-900">{b.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-900">{b.guestName || "Guest"}</div>
                      <div className="text-[11px] text-zinc-400">{b.guestEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-zinc-800">{b.listingTitle}</td>
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
          <div className="p-3 border-t border-zinc-100">
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

      {/* Tab 4: EARNINGS */}
      {activeTab === "earnings" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">Earnings & Payout Ledger</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 p-4">
              <span className="text-xs text-zinc-400 font-medium">Lifetime Gross Earnings</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">${(metrics.totalEarnings / 100).toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <span className="text-xs text-zinc-400 font-medium">Platform Fee Withheld (10%)</span>
              <p className="text-2xl font-bold text-zinc-700 mt-1">${((metrics.totalEarnings * 0.1) / 100).toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <span className="text-xs text-zinc-400 font-medium">Net Payout Completed</span>
              <p className="text-2xl font-bold text-blue-700 mt-1">${((metrics.totalEarnings * 0.9) / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: REVIEWS */}
      {activeTab === "reviews" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">Guest Ratings & Feedback</h2>
          <p className="text-xs text-zinc-500">Average Host Rating: <span className="font-bold text-amber-600">★ {metrics.averageRating}</span> based on guest stay reviews.</p>
        </div>
      )}

      {/* Tab 6: ACTIVITY LOG */}
      {activeTab === "activity" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">Host Audit History Logs</h2>
          {data.activity.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">No recorded activity history for this host.</p>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedActivity.map((log) => (
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
              <AdminPagination
                currentPage={activityPage}
                totalPages={totalActivityPages}
                totalItems={data.activity.length}
                pageSize={activityPageSize}
                onPageChange={setActivityPage}
                onPageSizeChange={(size) => {
                  setActivityPageSize(size);
                  setActivityPage(1);
                }}
                itemLabel="logs"
                pageSizeOptions={[5, 10, 20]}
              />
            </>
          )}
        </div>
      )}

      {/* EDIT HOST MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Edit Host Profile</h3>
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

      {/* VERIFICATION REVIEW MODAL */}
      {showVerifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Host Verification Review</h3>
            <form onSubmit={handleVerifSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-700 font-semibold mb-1">Decision</label>
                <select
                  value={verifStatusChoice}
                  onChange={(e) => setVerifStatusChoice(e.target.value as "APPROVED" | "REJECTED")}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none"
                >
                  <option value="APPROVED">Approve Host Verification</option>
                  <option value="REJECTED">Reject Host Verification</option>
                </select>
              </div>

              {verifStatusChoice === "REJECTED" && (
                <div>
                  <label className="block text-zinc-700 font-semibold mb-1">Rejection Reason</label>
                  <textarea
                    rows={3}
                    value={verifReason}
                    onChange={(e) => setVerifReason(e.target.value)}
                    placeholder="Provide reason for rejecting verification..."
                    className="w-full rounded-xl border border-zinc-200 p-2.5 outline-none"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowVerifModal(false)}
                  className="rounded-full border border-zinc-200 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-amber-500 hover:bg-amber-600 px-4 py-2 font-bold text-white shadow-2xs"
                >
                  Submit Decision
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
              {host.status === "SUSPENDED" ? "Unsuspend Host Account" : "Suspend Host Account"}
            </h3>
            <p className="text-xs text-zinc-500">
              {host.status === "SUSPENDED"
                ? "This will restore full hosting capabilities for this account."
                : "Suspending this host will restrict hosting actions. No permanent data will be deleted."}
            </p>

            <form onSubmit={handleSuspendSubmit} className="space-y-3 text-xs">
              {host.status !== "SUSPENDED" && (
                <div>
                  <label className="block text-zinc-700 font-semibold mb-1">Suspension Reason</label>
                  <textarea
                    rows={3}
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Reason for suspending host..."
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
                    host.status === "SUSPENDED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE HOST MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3 className="text-lg font-bold text-rose-700">Delete Host Account</h3>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <strong className="block mb-1 font-bold">⚠️ Warning: Destructive Action</strong>
              Are you sure you want to delete this host account ({host.email})? If the host has active confirmed bookings, deletion will be blocked automatically.
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
