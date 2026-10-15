"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { NotificationSummaryData } from "@/services/notification-admin.service";

interface AdminNotificationsClientProps {
  initialSummary: NotificationSummaryData;
  initialNotifications: any[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function AdminNotificationsClient({
  initialSummary,
  initialNotifications,
  initialPagination,
}: AdminNotificationsClientProps) {
  const [summary] = useState<NotificationSummaryData>(initialSummary);
  const [notifications, setNotifications] = useState<any[]>(initialNotifications);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [filterChannel, setFilterChannel] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [notifDetails, setNotifDetails] = useState<any | null>(null);

  // Retry state
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchNotifications = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set("page", String(pageToLoad));
        sp.set("limit", String(pagination.limit));
        if (activeTab !== "ALL") sp.set("type", activeTab);
        if (filterChannel !== "ALL") sp.set("channel", filterChannel);
        if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());

        const res = await fetch(`/api/v1/admin/bookings/notifications?${sp.toString()}`);
        const json = await res.json();
        const data = json.data ?? json;

        setNotifications(data.notifications || []);
        if (data.pagination) setPagination(data.pagination);
      } catch (err) {
        console.error("[AdminNotificationsClient] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, filterChannel, debouncedSearch, pagination.limit],
  );

  useEffect(() => {
    fetchNotifications(1);
  }, [activeTab, filterChannel, debouncedSearch, fetchNotifications]);

  const handleOpenDetails = async (notif: any) => {
    setSelectedNotif(notif);
    setDetailsModalOpen(true);
    setLoadingDetails(true);
    setNotifDetails(null);
    setRetryResult(null);
    setRetryError(null);

    try {
      const res = await fetch(`/api/v1/admin/bookings/notifications/${notif.id}`);
      const json = await res.json();
      const data = json.data ?? json;
      setNotifDetails(data);
    } catch (err) {
      console.error("[AdminNotificationsClient] Load details error:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRetryNotification = async () => {
    if (!selectedNotif) return;
    setRetrying(true);
    setRetryResult(null);
    setRetryError(null);

    try {
      const res = await fetch(`/api/v1/admin/bookings/notifications/${selectedNotif.id}/retry`, {
        method: "POST",
      });
      const json = await res.json();
      const data = json.data ?? json;

      if (!res.ok) {
        throw new Error(data.message || json.error?.message || "Retry failed");
      }

      setRetryResult(data.message || "Notification re-dispatched successfully.");
      // Refresh current list and details
      fetchNotifications(pagination.page);
      handleOpenDetails(selectedNotif);
    } catch (err: any) {
      setRetryError(err.message || "Failed to retry notification");
    } finally {
      setRetrying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "SENT":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "FAILED":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
      case "RETRYING":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20";
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Booking Notifications Hub
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Track reservation notifications, delivery statuses, provider receipts, and dispatch issues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/bookings/communications"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Communications</span>
          </Link>
          <Link
            href="/admin/bookings/analytics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Analytics</span>
          </Link>
          <button
            type="button"
            onClick={() => fetchNotifications(pagination.page)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-4 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* 7 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-[var(--muted-foreground)]">
            Total
          </span>
          <p className="text-lg font-black text-foreground mt-1">
            {summary.totalNotifications.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
            Delivered
          </span>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {summary.deliveredNotifications.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
            Sent / In-Flight
          </span>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">
            {summary.sentNotifications.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-zinc-500">
            Pending
          </span>
          <p className="text-lg font-black text-zinc-700 dark:text-zinc-300 mt-1">
            {summary.pendingNotifications.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">
            Failed
          </span>
          <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
            {summary.failedNotifications.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
            Retrying
          </span>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
            {summary.retryingNotifications.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">
            Attention Req.
          </span>
          <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
            {summary.requiresAttentionCount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabs and Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
          {[
            { id: "ALL", label: "All Events" },
            { id: "BOOKING", label: "Bookings" },
            { id: "MESSAGE", label: "Messages" },
            { id: "SYSTEM", label: "System Alerts" },
            { id: "PROMOTION", label: "Promotions" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-[var(--surface)] text-foreground shadow-2xs font-bold"
                  : "text-[var(--muted-foreground)] hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search by ID, booking, user..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-9 pl-9 pr-8 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-xl text-foreground placeholder-[var(--muted-foreground)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
          />
          <svg
            className="w-4 h-4 absolute left-3 top-2.5 text-[var(--muted-foreground)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-foreground text-xs"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Notifications Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[var(--muted-foreground)] font-semibold uppercase text-3xs tracking-wider">
                <th className="py-3 px-4">Notification ID</th>
                <th className="py-3 px-4">Event & Title</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Related Booking</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--muted-foreground)]">
                    No notification records found matching criteria.
                  </td>
                </tr>
              ) : (
                notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-[var(--surface-secondary)]/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      {n.id.slice(0, 10)}...
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-semibold text-foreground truncate">{n.title}</p>
                      <p className="text-3xs text-[var(--muted-foreground)] truncate">{n.message}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-foreground">{n.user?.name || "User"}</p>
                      <span className="text-3xs text-[var(--muted-foreground)] block">{n.user?.email}</span>
                      <span className="text-3xs uppercase font-bold text-zinc-400">{n.user?.role}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-3xs font-semibold bg-[var(--surface-secondary)] text-foreground border border-[var(--border)]">
                        {n.channel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-3xs font-bold uppercase border ${getStatusBadge(n.deliveryStatus)}`}>
                        {n.deliveryStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {n.entityId ? (
                        <span className="text-3xs font-mono font-semibold text-[var(--accent)]">
                          {n.entityId.slice(0, 12)}...
                        </span>
                      ) : (
                        <span className="text-3xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] whitespace-nowrap text-3xs">
                      {new Date(n.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(n)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-xs font-semibold text-foreground transition-all shadow-2xs"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} notifications)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchNotifications(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="px-3 py-1 rounded-lg border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--surface-secondary)]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => fetchNotifications(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1 rounded-lg border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--surface-secondary)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notification Details & Retry Modal */}
      {detailsModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-secondary)]/40">
              <div>
                <span className="text-3xs uppercase font-bold tracking-wider text-[var(--accent)]">
                  Notification Delivery Inspector
                </span>
                <h3 className="text-base font-bold text-foreground">
                  ID: {selectedNotif?.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="w-8 h-8 rounded-full border border-[var(--border)] hover:bg-[var(--surface-secondary)] flex items-center justify-center text-foreground font-bold"
              >
                ✕
              </button>
            </div>

            {/* Notification Results */}
            {retryResult && (
              <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-700 text-xs px-5">
                {retryResult}
              </div>
            )}
            {retryError && (
              <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-700 text-xs px-5">
                {retryError}
              </div>
            )}

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
              {loadingDetails ? (
                <div className="py-20 text-center text-xs text-[var(--muted-foreground)]">
                  Loading notification telemetry...
                </div>
              ) : notifDetails ? (
                <>
                  <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-3xs uppercase font-bold text-[var(--muted-foreground)]">Event Title</span>
                        <h4 className="text-sm font-bold text-foreground">{notifDetails.title}</h4>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-3xs font-bold uppercase border ${getStatusBadge(notifDetails.deliveryStatus)}`}>
                        {notifDetails.deliveryStatus}
                      </span>
                    </div>
                    <p className="text-xs text-foreground bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)] mt-1">
                      {notifDetails.message}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30">
                      <span className="text-3xs uppercase font-semibold text-[var(--muted-foreground)] block">Recipient</span>
                      <span className="font-bold text-foreground block mt-0.5">{notifDetails.user?.name || "User"}</span>
                      <span className="text-3xs text-[var(--muted-foreground)] block">{notifDetails.user?.email}</span>
                      <span className="text-3xs uppercase font-bold text-[var(--accent)] mt-1 block">Role: {notifDetails.user?.role}</span>
                    </div>
                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30">
                      <span className="text-3xs uppercase font-semibold text-[var(--muted-foreground)] block">Channel & Template</span>
                      <span className="font-bold text-foreground block mt-0.5">{notifDetails.channel}</span>
                      <span className="text-3xs font-mono text-[var(--muted-foreground)] block mt-0.5">Tpl: {notifDetails.templateId}</span>
                      <span className="text-3xs text-[var(--muted-foreground)] block mt-1">
                        Attempts: {notifDetails.attemptCount} / 5
                      </span>
                    </div>
                  </div>

                  {notifDetails.relatedBooking && (
                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 flex flex-col gap-1">
                      <span className="text-3xs uppercase font-semibold text-[var(--muted-foreground)]">Associated Reservation</span>
                      <p className="font-bold text-foreground">
                        {notifDetails.relatedBooking.listing?.title} (ID: {notifDetails.relatedBooking.id})
                      </p>
                      <p className="text-3xs text-[var(--accent)]">
                        Status: {notifDetails.relatedBooking.status} • Total: {((notifDetails.relatedBooking.totalPrice || 0) / 100).toFixed(2)} {notifDetails.relatedBooking.currency}
                      </p>
                    </div>
                  )}

                  {notifDetails.failureReason && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs">
                      <span className="font-bold block">Delivery Failure Reason:</span>
                      <span>{notifDetails.failureReason}</span>
                    </div>
                  )}

                  {/* Delivery Attempts Timeline */}
                  {notifDetails.attemptHistory?.length > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                      <span className="text-3xs uppercase font-bold text-[var(--muted-foreground)]">
                        Delivery Attempt Timeline
                      </span>
                      <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] overflow-hidden">
                        {notifDetails.attemptHistory.map((att: any, idx: number) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between text-3xs bg-[var(--surface)]">
                            <div>
                              <span className="font-bold text-foreground">Attempt #{att.attemptNumber || idx + 1}: </span>
                              <span className="text-[var(--muted-foreground)]">{att.note || "Automated dispatch"}</span>
                            </div>
                            <span className="text-zinc-400 font-mono">
                              {new Date(att.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer with Retry Action */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]/30 flex justify-between items-center">
              <span className="text-3xs text-[var(--muted-foreground)]">
                {notifDetails?.isRead ? "✓ Marked Read by recipient" : "Unread by recipient"}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetryNotification}
                  disabled={retrying || (notifDetails?.attemptCount || 0) >= 5}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-2xs transition-all disabled:opacity-40"
                >
                  {retrying ? "Retrying..." : "Manual Retry Dispatch"}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-semibold text-foreground transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

