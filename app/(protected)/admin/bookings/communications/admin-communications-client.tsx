"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { CommunicationSummaryData } from "@/services/communication-admin.service";

interface AdminCommunicationsClientProps {
  initialSummary: CommunicationSummaryData;
  initialConversations: any[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function AdminCommunicationsClient({
  initialSummary,
  initialConversations,
  initialPagination,
}: AdminCommunicationsClientProps) {
  const [summary] = useState<CommunicationSummaryData>(initialSummary);
  const [conversations, setConversations] = useState<any[]>(initialConversations);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Inspect Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [loadingConvDetails, setLoadingConvDetails] = useState(false);
  const [convDetails, setConvDetails] = useState<any | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchConversations = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set("page", String(pageToLoad));
        sp.set("limit", String(pagination.limit));
        if (activeTab !== "ALL") sp.set("type", activeTab);
        if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());

        const res = await fetch(`/api/v1/admin/bookings/communications?${sp.toString()}`);
        const json = await res.json();
        const data = json.data ?? json;

        setConversations(data.conversations || []);
        if (data.pagination) setPagination(data.pagination);
      } catch (err) {
        console.error("[AdminCommunicationsClient] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, debouncedSearch, pagination.limit],
  );

  useEffect(() => {
    fetchConversations(1);
  }, [activeTab, debouncedSearch, fetchConversations]);

  const handleInspectConversation = async (conv: any) => {
    setSelectedConv(conv);
    setInspectModalOpen(true);
    setLoadingConvDetails(true);
    setConvDetails(null);

    try {
      const res = await fetch(`/api/v1/admin/bookings/communications/${conv.id}`);
      const json = await res.json();
      const data = json.data ?? json;
      setConvDetails(data);
    } catch (err) {
      console.error("[AdminCommunicationsClient] Load details error:", err);
    } finally {
      setLoadingConvDetails(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "CONFIRMED":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20";
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "BOOKING_REQUEST":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "INQUIRY":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
      case "BOOKING":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20";
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/bookings"
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              ← Bookings Hub
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-xs text-[var(--muted-foreground)]">Communications</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Booking Communications
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Monitor booking-related conversations, notification activity, and guest-host communication logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/bookings/notifications"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Notifications Hub</span>
          </Link>
          <Link
            href="/admin/bookings/analytics"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Analytics</span>
          </Link>
          <button
            type="button"
            onClick={() => fetchConversations(pagination.page)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-4 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-[var(--muted-foreground)]">
            Total Conversations
          </span>
          <p className="text-xl font-black text-foreground mt-1">
            {summary.totalConversations.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
            Active
          </span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {summary.activeConversations.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-purple-600 dark:text-purple-400">
            Inquiries
          </span>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {summary.bookingInquiries.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
            Booking Requests
          </span>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {summary.bookingRequests.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
            Confirmed Stays
          </span>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {summary.confirmedConversations.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">
            Reported / Issues
          </span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {summary.reportedConversations.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
          {[
            { id: "ALL", label: "All Threads" },
            { id: "INQUIRY", label: "Inquiries" },
            { id: "BOOKING_REQUEST", label: "Requests" },
            { id: "BOOKING", label: "Bookings" },
            { id: "GENERAL", label: "General" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
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
            placeholder="Search by ID, property, user..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-xl text-foreground placeholder-[var(--muted-foreground)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
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
        </div>
      </div>

      {/* Conversations Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[var(--muted-foreground)] font-semibold uppercase text-3xs tracking-wider">
                <th className="py-3 px-4">Conversation ID</th>
                <th className="py-3 px-4">Property & Host</th>
                <th className="py-3 px-4">Guest</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Latest Message</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {conversations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--muted-foreground)]">
                    No booking conversations found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                conversations.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--surface-secondary)]/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      <span className="block">{c.id.slice(0, 10)}...</span>
                      {c.bookingId && (
                        <span className="text-3xs text-[var(--accent)] font-semibold block">
                          Bkg: {c.bookingId.slice(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-semibold text-foreground truncate">{c.listing?.title || "Property"}</p>
                      <span className="text-3xs text-[var(--muted-foreground)] block">
                        Host: {c.host?.name || c.host?.email || "Host"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-foreground">{c.guest?.name || "Guest"}</p>
                      <span className="text-3xs text-[var(--muted-foreground)]">{c.guest?.email}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-3xs font-bold uppercase border ${getTypeBadge(c.type)}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-3xs font-bold uppercase border ${getStatusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <p className="truncate text-foreground text-3xs">
                        {c.lastMessage?.contentPreview || "No messages yet"}
                      </p>
                      {c.totalMessages > 0 && (
                        <span className="text-3xs text-[var(--muted-foreground)]">
                          {c.totalMessages} message{c.totalMessages !== 1 ? "s" : ""}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] whitespace-nowrap text-3xs">
                      {new Date(c.lastMessageAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleInspectConversation(c)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-xs font-semibold text-foreground transition-all shadow-2xs"
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

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} conversations)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchConversations(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="px-3 py-1 rounded-lg border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--surface-secondary)]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => fetchConversations(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1 rounded-lg border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--surface-secondary)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Read-Only Inspection Modal */}
      {inspectModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-secondary)]/40">
              <div>
                <span className="text-3xs uppercase font-bold tracking-wider text-[var(--accent)]">
                  Read-Only Conversation Inspection
                </span>
                <h3 className="text-base font-bold text-foreground">
                  Thread: {selectedConv?.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                className="w-8 h-8 rounded-full border border-[var(--border)] hover:bg-[var(--surface-secondary)] flex items-center justify-center text-foreground font-bold"
              >
                ✕
              </button>
            </div>

            {/* Privacy Notice Banner */}
            <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 text-3xs px-5 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>Confidential Operational Monitoring:</strong> Administrative viewing does not mark guest or host messages as read. Potential sensitive credentials (PINs, Wi-Fi keys) are automatically masked.
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
              {loadingConvDetails ? (
                <div className="py-20 text-center text-xs text-[var(--muted-foreground)]">
                  Loading conversation message history...
                </div>
              ) : convDetails ? (
                <>
                  {/* Context Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30">
                      <span className="text-3xs uppercase font-semibold text-[var(--muted-foreground)]">Listing & Host</span>
                      <p className="font-bold text-foreground mt-0.5">{convDetails.conversation?.listing?.title}</p>
                      <p className="text-3xs text-[var(--muted-foreground)]">
                        Host: {convDetails.conversation?.host?.name} ({convDetails.conversation?.host?.email})
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30">
                      <span className="text-3xs uppercase font-semibold text-[var(--muted-foreground)]">Guest & Booking</span>
                      <p className="font-bold text-foreground mt-0.5">
                        {convDetails.conversation?.guest?.name} ({convDetails.conversation?.guest?.email})
                      </p>
                      {convDetails.conversation?.booking ? (
                        <p className="text-3xs text-[var(--accent)] font-semibold">
                          Booking ID: {convDetails.conversation?.booking?.id} • Status: {convDetails.conversation?.booking?.status}
                        </p>
                      ) : (
                        <p className="text-3xs text-[var(--muted-foreground)]">Direct Inquiry (No booking linked)</p>
                      )}
                    </div>
                  </div>

                  {/* Messages Bubble History */}
                  <div className="flex flex-col gap-3 mt-2">
                    <span className="text-3xs uppercase font-bold text-[var(--muted-foreground)]">
                      Message History ({convDetails.messages?.length || 0} messages)
                    </span>

                    {convDetails.messages?.length === 0 ? (
                      <p className="text-center py-6 text-xs text-[var(--muted-foreground)]">No messages in this conversation.</p>
                    ) : (
                      convDetails.messages.map((m: any) => {
                        const isGuest = m.senderRole === "GUEST";
                        const isHost = m.senderRole === "HOST";

                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col max-w-lg ${
                              isGuest
                                ? "self-start items-start"
                                : isHost
                                  ? "self-end items-end"
                                  : "self-center items-center"
                            }`}
                          >
                            <span className="text-3xs text-[var(--muted-foreground)] mb-0.5">
                              {isGuest ? `Guest (${convDetails.conversation?.guest?.name})` : isHost ? `Host (${convDetails.conversation?.host?.name})` : "System"}
                              {" • "}
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <div
                              className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                isGuest
                                  ? "bg-[var(--surface-secondary)] text-foreground border border-[var(--border)]"
                                  : isHost
                                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                                    : "bg-zinc-200 dark:bg-zinc-800 text-[var(--muted-foreground)] text-center text-3xs"
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{m.content}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]/30 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-semibold text-foreground transition-all"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

