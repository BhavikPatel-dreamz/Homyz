"use client";

import { useState, useTransition } from "react";
import { Alert } from "../ui";
import { AdminPagination } from "./admin-pagination";
import {
  inviteAdminAction,
  resendInvitationAction,
  revokeInvitationAction,
  listInvitationsAction,
} from "@/actions/admin/invitationActions";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatUTCDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const d = new Date(value);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTH_SHORT[d.getUTCMonth()];
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month}, ${hours}:${minutes} UTC`;
}

export interface PublicInvitationItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  adminRoleId: string | null;
  adminRoleName?: string | null;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED" | "FAILED";
  invitedById: string | null;
  invitedByEmail: string | null;
  invitedByName?: string | null;
  expiresAt: Date | string;
  acceptedAt?: Date | string | null;
  revokedAt?: Date | string | null;
  lastResentAt?: Date | string | null;
  message?: string | null;
  customPermissions?: string[] | null;
  createdAt: Date | string;
}

export interface RoleOption {
  id: string;
  name: string;
  slug: string;
}

export function AdminInvitationsTable({
  initialInvitations,
  initialTotal,
  availableRoles,
}: {
  initialInvitations: PublicInvitationItem[];
  initialTotal: number;
  availableRoles: RoleOption[];
}) {
  const [invitations, setInvitations] = useState<PublicInvitationItem[]>(initialInvitations);
  const [total, setTotal] = useState(initialTotal);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<PublicInvitationItem | null>(null);

  // Invite Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleSlug, setInviteRoleSlug] = useState(availableRoles[0]?.slug || "admin");
  const [inviteMessage, setInviteMessage] = useState("");

  // Feedback state
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function fetchInvitations(
    p = page,
    s = search,
    st = statusFilter,
    r = roleFilter,
    d = dateFilter
  ) {
    const res = await listInvitationsAction({
      skip: (p - 1) * limit,
      take: limit,
      search: s,
      status: st,
      role: r,
      dateRange: d,
    });
    if (res.ok && res.data) {
      setInvitations(res.data.items as any);
      setTotal(res.data.total);
    }
  }

  function handleFilterChange(newSearch: string, newStatus: string, newRole: string, newDate: string) {
    setSearch(newSearch);
    setStatusFilter(newStatus);
    setRoleFilter(newRole);
    setDateFilter(newDate);
    setPage(1);
    startTransition(() => {
      fetchInvitations(1, newSearch, newStatus, newRole, newDate);
    });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    startTransition(() => {
      fetchInvitations(newPage);
    });
  }

  function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await inviteAdminAction({
        name: inviteName,
        email: inviteEmail,
        adminRoleSlug: inviteRoleSlug,
        message: inviteMessage || undefined,
        role: "ADMIN",
      });

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to send invitation." });
        return;
      }

      setFeedback({ tone: "success", msg: `Invitation sent successfully to ${inviteEmail}!` });
      setShowInviteModal(false);
      setInviteName("");
      setInviteEmail("");
      setInviteMessage("");
      fetchInvitations(1);
    });
  }

  function handleResend(inv: PublicInvitationItem) {
    setFeedback(null);
    startTransition(async () => {
      const res = await resendInvitationAction(inv.id);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to resend invitation." });
        return;
      }
      setFeedback({ tone: "success", msg: `Invitation email resent to ${inv.email}` });
      fetchInvitations();
    });
  }

  function handleRevoke(inv: PublicInvitationItem) {
    if (!confirm(`Are you sure you want to revoke the invitation for ${inv.email}? The link will become permanently invalid.`)) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res = await revokeInvitationAction(inv.id);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error || "Failed to revoke invitation." });
        return;
      }
      setFeedback({ tone: "success", msg: `Invitation for ${inv.email} has been revoked.` });
      fetchInvitations();
    });
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
          </span>
        );
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Accepted
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            Expired
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Revoked
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Delivery Failed
          </span>
        );
      default:
        return <span className="text-xs text-zinc-500">{status}</span>;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {feedback && (
        <Alert tone={feedback.tone === "error" ? "error" : "success"}>
          {feedback.msg}
        </Alert>
      )}

      {/* Control Bar: Search, Filters, Primary Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by email, name, inviter…"
              value={search}
              onChange={(e) => handleFilterChange(e.target.value, statusFilter, roleFilter, dateFilter)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(search, e.target.value, roleFilter, dateFilter)}
            className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked</option>
            <option value="FAILED">Delivery Failed</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => handleFilterChange(search, statusFilter, e.target.value, dateFilter)}
            className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="ALL">All Roles</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.slug}>{r.name}</option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => handleFilterChange(search, statusFilter, roleFilter, e.target.value)}
            className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="ALL">All Time</option>
            <option value="LAST_24_HOURS">Last 24 Hours</option>
            <option value="LAST_7_DAYS">Last 7 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
          </select>
        </div>

        {/* Invite Action */}
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-sm rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Invite Admin
        </button>
      </div>

      {/* Invitations Data Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Invited Admin</th>
                <th className="px-5 py-3.5">Assigned Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Invited By</th>
                <th className="px-5 py-3.5">Sent At</th>
                <th className="px-5 py-3.5">Expires At</th>
                <th className="px-5 py-3.5">Accepted At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-zinc-400">
                    No admin invitations found matching your criteria.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {inv.name || "—"}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        {inv.email}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium">
                        {inv.adminRoleName || inv.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-600 dark:text-zinc-400">
                      {inv.invitedByName || inv.invitedByEmail || "System"}
                    </td>
                    <td className="px-5 py-4 text-xs whitespace-nowrap text-zinc-500">
                      {formatUTCDateTime(inv.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-xs whitespace-nowrap text-zinc-500">
                      {formatUTCDateTime(inv.expiresAt)}
                    </td>
                    <td className="px-5 py-4 text-xs whitespace-nowrap text-zinc-500">
                      {formatUTCDateTime(inv.acceptedAt)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap space-x-2">
                      {/* Resend button for Pending or Expired or Failed */}
                      {(inv.status === "PENDING" || inv.status === "EXPIRED" || inv.status === "FAILED") && (
                        <button
                          type="button"
                          onClick={() => handleResend(inv)}
                          disabled={pending}
                          className="px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-md transition-colors disabled:opacity-50"
                        >
                          Resend
                        </button>
                      )}

                      {/* Revoke button for Pending */}
                      {inv.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(inv)}
                          disabled={pending}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      )}

                      {/* View Details */}
                      <button
                        type="button"
                        onClick={() => setSelectedDetails(inv)}
                        className="px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
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

        {/* Pagination */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <AdminPagination
            currentPage={page}
            totalPages={Math.ceil(total / limit) || 1}
            totalItems={total}
            pageSize={limit}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Invite Admin Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Invite New Administrator
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
              The invited administrator will receive an email containing a secure link to create their own confidential password. No password is set by you.
            </p>

            <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="jane.doe@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Assigned Admin Role
                </label>
                <select
                  value={inviteRoleSlug}
                  onChange={(e) => setInviteRoleSlug(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                >
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.slug}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Invitation Note / Message (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Welcome to the team! Please set up your admin profile."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {pending ? "Sending Invitation…" : "Send Invitation Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invitation Details Drawer/Modal */}
      {selectedDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Invitation Details
                </h2>
                <p className="text-xs text-zinc-500 font-mono">{selectedDetails.id}</p>
              </div>
              <button
                onClick={() => setSelectedDetails(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-xs font-semibold text-zinc-500">Invited Name</span>
                <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">{selectedDetails.name || "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-xs font-semibold text-zinc-500">Email</span>
                <span className="col-span-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">{selectedDetails.email}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-xs font-semibold text-zinc-500">Assigned Role</span>
                <span className="col-span-2 font-medium text-zinc-800 dark:text-zinc-200">{selectedDetails.adminRoleName || selectedDetails.role}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-xs font-semibold text-zinc-500">Status</span>
                <span className="col-span-2">{getStatusBadge(selectedDetails.status)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-xs font-semibold text-zinc-500">Invited By</span>
                <span className="col-span-2 text-xs text-zinc-700 dark:text-zinc-300">{selectedDetails.invitedByName || selectedDetails.invitedByEmail || "System"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-xs font-semibold text-zinc-500">Sent At</span>
                <span className="col-span-2 text-xs text-zinc-700 dark:text-zinc-300">{formatUTCDateTime(selectedDetails.createdAt)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-xs font-semibold text-zinc-500">Expires At</span>
                <span className="col-span-2 text-xs text-zinc-700 dark:text-zinc-300">{formatUTCDateTime(selectedDetails.expiresAt)}</span>
              </div>
              {selectedDetails.acceptedAt && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-xs font-semibold text-zinc-500">Accepted At</span>
                  <span className="col-span-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{formatUTCDateTime(selectedDetails.acceptedAt)}</span>
                </div>
              )}
              {selectedDetails.lastResentAt && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-xs font-semibold text-zinc-500">Last Resent At</span>
                  <span className="col-span-2 text-xs text-zinc-700 dark:text-zinc-300">{formatUTCDateTime(selectedDetails.lastResentAt)}</span>
                </div>
              )}
              {selectedDetails.message && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-500">Custom Message</span>
                  <span className="col-span-2 text-xs italic text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">{selectedDetails.message}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400">🔒 Token is cryptographically hashed</span>
              <button
                type="button"
                onClick={() => setSelectedDetails(null)}
                className="px-4 py-2 text-sm font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
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
