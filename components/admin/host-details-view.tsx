"use client";

import React, { useState, useTransition } from "react";
import { Alert } from "../ui";
import { AdminPagination } from "./admin-pagination";
import { HostPermissionsTab } from "./host-permissions-tab";
import type { HostDetailsData } from "@/services/admin.service";
import {
  updateHostAction,
  updateHostVerificationAction,
  toggleHostSuspensionAction,
  deleteHostAction,
} from "@/actions/admin/hostActions";

export type HostDetailsDTO = HostDetailsData;

export function HostDetailsView({ initialData }: { initialData: HostDetailsDTO }) {
  const [data, setData] = useState<HostDetailsDTO>(initialData);
  const [activeTab, setActiveTab] = useState<
    "overview" | "permissions" | "listings" | "bookings" | "earnings" | "reviews" | "activity"
  >("overview");

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

  // Form input states
  const [editName, setEditName] = useState(data.host.name || "");
  const [editEmail, setEditEmail] = useState(data.host.email || "");
  const [editPhone, setEditPhone] = useState(data.host.phone || "");

  const [verifStatusChoice, setVerifStatusChoice] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [verifReason, setVerifReason] = useState("");

  const [suspendReason, setSuspendReason] = useState("");

  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const host = data.host;
  const metrics = data.metrics;

  // Pagination calculations for tabs
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

  // Handler: Edit Host Info
  async function handleEditSubmit(e: React.FormEvent) {
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
      setFeedback({ tone: "success", msg: "Host profile updated successfully." });
    });
  }

  // Handler: Verification Review
  async function handleVerifSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await updateHostVerificationAction(
        host.id,
        verifStatusChoice,
        verifStatusChoice === "REJECTED" ? verifReason : undefined
      );

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to submit verification" });
        return;
      }

      setData((prev) => ({
        ...prev,
        host: {
          ...prev.host,
          verificationStatus: verifStatusChoice,
        },
      }));
      setShowVerifModal(false);
      setFeedback({ tone: "success", msg: `Verification ${verifStatusChoice.toLowerCase()} successfully.` });
    });
  }

  // Handler: Suspend / Unsuspend Host
  async function handleSuspendSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const suspend = host.status !== "SUSPENDED";
    const newStatus = suspend ? "SUSPENDED" : "ACTIVE";

    startTransition(async () => {
      const res = await toggleHostSuspensionAction(
        host.id,
        suspend,
        suspend ? suspendReason : undefined
      );

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to change host status" });
        return;
      }

      setData((prev) => ({
        ...prev,
        host: {
          ...prev.host,
          status: newStatus as any,
        },
      }));
      setShowSuspendModal(false);
      setFeedback({ tone: "success", msg: `Host status changed to ${newStatus}.` });
    });
  }

  // Handler: Delete Host
  async function handleDeleteSubmit() {
    setFeedback(null);

    startTransition(async () => {
      const res = await deleteHostAction(host.id);

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Cannot delete host with active bookings." });
        setShowDeleteModal(false);
        return;
      }
      window.location.href = "/admin/hosts";
    });
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">
      {/* Alert Feedback */}
      {feedback && (
        <Alert tone={feedback.tone}>
          <div className="flex items-center justify-between">
            <span>{feedback.msg}</span>
            <button onClick={() => setFeedback(null)} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* Header Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold flex items-center justify-center text-xl shadow-2xs">
            {(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
                {host.name || "Unnamed Host"}
              </h1>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  host.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
                    : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
                }`}
              >
                {host.status}
              </span>

              {/* Verification Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  host.verificationStatus === "APPROVED"
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50"
                    : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
                }`}
              >
                {host.verificationStatus === "APPROVED" ? "✓ Verified" : "Unverified"}
              </span>
            </div>

            <p className="mt-1 text-xs text-[var(--muted-foreground)] font-mono">{host.email} • ID: {host.id}</p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          >
            Edit Profile
          </button>

          <button
            type="button"
            onClick={() => setShowVerifModal(true)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          >
            Verification Review
          </button>

          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-all border shadow-2xs ${
              host.status === "SUSPENDED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
            }`}
          >
            {host.status === "SUSPENDED" ? "Unsuspend Account" : "Suspend Account"}
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-full bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white transition-all shadow-2xs"
          >
            Delete Host
          </button>
        </div>
      </div>

      {/* Top Metric Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Listings Owned</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--foreground)]">{metrics.totalListings}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Bookings</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--foreground)]">{metrics.totalBookings}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Earnings</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">${(metrics.totalEarnings / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Average Rating</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">★ {metrics.averageRating} <span className="text-xs font-normal text-[var(--muted-foreground)]">({metrics.reviewsCount} reviews)</span></p>
        </div>
      </div>

      {/* Tabs Bar Navigation */}
      <div className="border-b border-[var(--border)] flex items-center gap-2 overflow-x-auto pt-2" suppressHydrationWarning>
        {[
          { id: "overview", label: "Overview" },
          { id: "permissions", label: "Access & Permissions" },
          { id: "listings", label: `Listings (${data.listings.length})` },
          { id: "bookings", label: `Bookings (${data.bookings.length})` },
          { id: "earnings", label: "Earnings" },
          { id: "reviews", label: `Reviews (${metrics.reviewsCount})` },
          { id: "activity", label: `Activity (${data.activity.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-[var(--accent)] text-[var(--foreground)] font-extrabold"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: ACCESS & PERMISSIONS */}
      {activeTab === "permissions" && (
        <HostPermissionsTab
          hostId={host.id}
          hostName={host.name}
          hostEmail={host.email}
          hostStatus={host.status}
        />
      )}

      {/* Tab 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">Personal & Profile Info</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Full Name</span>
                <span className="font-semibold text-[var(--foreground)]">{host.name || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Email Address</span>
                <span className="font-semibold text-[var(--foreground)]">{host.email || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Phone Number</span>
                <span className="font-semibold text-[var(--foreground)]">{host.phone || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">User Role</span>
                <span className="font-semibold text-[var(--foreground)]">{host.role}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Account Status</span>
                <span className="font-semibold text-[var(--foreground)]">{host.status}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Verification</span>
                <span className="font-semibold text-[var(--foreground)]">{host.verificationStatus}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">Account System Timestamps</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Joined Date</span>
                <span className="font-semibold text-[var(--foreground)] font-mono" suppressHydrationWarning>{new Date(host.createdAt).toLocaleString("en-US")}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Last Active Timestamp</span>
                <span className="font-semibold text-[var(--foreground)] font-mono" suppressHydrationWarning>{new Date(host.lastActive).toLocaleString("en-US")}</span>
              </div>
            </div>
          </div>

          {/* Compliance, Document Verification & Onboarding Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4 md:col-span-2">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">Host Compliance & Onboarding Review</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Verification assessment, document compliance checkpoints, and application status.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowVerifModal(true)}
                className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3.5 py-1.5 text-xs font-bold text-[var(--accent-foreground)] transition-colors shadow-2xs"
              >
                Change Verification Status
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--foreground)]">ID & Identity Check</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    host.verificationStatus === "APPROVED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}>
                    {host.verificationStatus === "APPROVED" ? "Verified" : "Pending Review"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">Government-issued identity & host contact credentials.</p>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--foreground)]">Account Compliance</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    host.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                  }`}>
                    {host.status === "ACTIVE" ? "Compliant" : "Restricted"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">Platform terms of service and community policy compliance status.</p>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--foreground)]">Onboarding Readiness</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    host.status === "ACTIVE" && host.verificationStatus === "APPROVED"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}>
                    {host.status === "ACTIVE" && host.verificationStatus === "APPROVED" ? "Ready to Host" : "Action Required"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {host.status === "ACTIVE" && host.verificationStatus === "APPROVED"
                    ? "Host is authorized to publish listings and accept bookings."
                    : "Host requires approval or account resolution before publishing."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: LISTINGS */}
      {activeTab === "listings" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Listing Title</th>
                  <th className="py-3.5 px-4">Price / Night</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Bookings Count</th>
                  <th className="py-3.5 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.listings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--muted-foreground)]">
                      This host has no property listings yet.
                    </td>
                  </tr>
                ) : (
                  paginatedListings.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[var(--foreground)]">{item.title}</td>
                      <td className="py-3.5 px-4 text-[var(--foreground)] font-bold">${(item.price / 100).toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        {item.published ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--surface-secondary)] text-[var(--muted-foreground)] border border-[var(--border)]">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-[var(--foreground)]">{item.bookingsCount}</td>
                      <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>{new Date(item.createdAt).toLocaleDateString("en-US")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-[var(--border-subtle)]">
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
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
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
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--muted-foreground)]">
                      No reservations recorded for this host.
                    </td>
                  </tr>
                ) : (
                  paginatedBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-[var(--foreground)]">{b.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--foreground)]">{b.guestName || "Guest"}</div>
                        <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{b.guestEmail || "—"}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[var(--foreground)]">{b.listingTitle}</td>
                      <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>{new Date(b.startDate).toLocaleDateString("en-US")}</td>
                      <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>{new Date(b.endDate).toLocaleDateString("en-US")}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[var(--foreground)]">${(b.amount / 100).toFixed(2)}</td>
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

      {/* Tab 4: EARNINGS */}
      {activeTab === "earnings" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">Earnings & Payout Ledger</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4">
              <span className="text-xs text-[var(--muted-foreground)] font-medium">Lifetime Gross Earnings</span>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">${(metrics.totalEarnings / 100).toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4">
              <span className="text-xs text-[var(--muted-foreground)] font-medium">Platform Fee Withheld (10%)</span>
              <p className="text-2xl font-extrabold text-[var(--foreground)] mt-1">${((metrics.totalEarnings * 0.1) / 100).toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4">
              <span className="text-xs text-[var(--muted-foreground)] font-medium">Net Payout Completed</span>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">${((metrics.totalEarnings * 0.9) / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: REVIEWS */}
      {activeTab === "reviews" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">Guest Ratings & Feedback</h2>
          <p className="text-xs text-[var(--muted-foreground)]">Average Host Rating: <span className="font-bold text-amber-600 dark:text-amber-400">★ {metrics.averageRating}</span> based on guest stay reviews.</p>
        </div>
      )}

      {/* Tab 6: ACTIVITY LOG */}
      {activeTab === "activity" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">Host Audit History Logs</h2>
          {data.activity.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No recorded activity history for this host.</p>
          ) : (
            <div className="space-y-3">
              {paginatedActivity.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-xs">
                  <div>
                    <span className="font-bold text-[var(--foreground)]">{log.action}</span>
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

      {/* EDIT HOST MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-[var(--foreground)]">Edit Host Profile</h3>
            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] p-2.5 outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] p-2.5 outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] p-2.5 outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
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
        </div>
      )}

      {/* VERIFICATION REVIEW MODAL */}
      {showVerifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-[var(--foreground)]">Host Verification Review</h3>
            <form onSubmit={handleVerifSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Decision</label>
                <select
                  value={verifStatusChoice}
                  onChange={(e) => setVerifStatusChoice(e.target.value as any)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] p-2.5 outline-none"
                >
                  <option value="APPROVED">Approve Host Verification</option>
                  <option value="REJECTED">Reject Host Verification</option>
                </select>
              </div>

              {verifStatusChoice === "REJECTED" && (
                <div>
                  <label className="block text-[var(--muted-foreground)] font-bold mb-1">Rejection Reason</label>
                  <textarea
                    rows={3}
                    value={verifReason}
                    onChange={(e) => setVerifReason(e.target.value)}
                    placeholder="Provide reason for rejecting verification..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] p-2.5 outline-none"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowVerifModal(false)}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
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
                  <span>{pending ? "Submitting..." : "Submit Decision"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUSPEND / UNSUSPEND MODAL */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              {host.status === "SUSPENDED" ? "Unsuspend Host Account" : "Suspend Host Account"}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {host.status === "SUSPENDED"
                ? "This will restore full hosting capabilities for this account."
                : "Suspending this host will restrict hosting actions. No permanent data will be deleted."}
            </p>

            <form onSubmit={handleSuspendSubmit} className="space-y-3 text-xs">
              {host.status !== "SUSPENDED" && (
                <div>
                  <label className="block text-[var(--muted-foreground)] font-bold mb-1">Suspension Reason</label>
                  <textarea
                    rows={3}
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Reason for suspending host..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] p-2.5 outline-none"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSuspendModal(false)}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={`rounded-full px-4 py-2 font-extrabold text-white shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 transition-all ${
                    host.status === "SUSPENDED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
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
        </div>
      )}

      {/* DELETE HOST MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-rose-600">Delete Host Account</h3>
            <div className="p-3 bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 rounded-xl text-xs text-rose-800 dark:text-rose-300">
              <strong className="block mb-1 font-bold">⚠️ Warning: Destructive Action</strong>
              Are you sure you want to delete this host account ({host.email})? If the host has active confirmed bookings, deletion will be blocked automatically.
            </div>

            <div className="flex justify-end gap-2 pt-3 text-xs">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={pending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
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
        </div>
      )}
    </div>
  );
}
