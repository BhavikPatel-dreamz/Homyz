"use client";

import { useState, useTransition } from "react";
import { Alert } from "../ui";
import { toast } from "@/components/ui/toast";
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

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
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

    startTransition(async () => {
      const res = await inviteAdminAction({
        name: inviteName,
        email: inviteEmail,
        adminRoleSlug: inviteRoleSlug,
        message: inviteMessage || undefined,
        role: "ADMIN",
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to send invitation.");
        return;
      }

      toast.success(`Invitation sent successfully to ${inviteEmail}!`);
      setShowInviteModal(false);
      setInviteName("");
      setInviteEmail("");
      setInviteMessage("");
      fetchInvitations(1);
    });
  }

  function handleResend(inv: PublicInvitationItem) {
    setActionLoadingId(`${inv.id}_resend`);
    startTransition(async () => {
      try {
        const res = await resendInvitationAction(inv.id);
        if (!res.ok) {
          toast.error(res.error || "Failed to resend invitation.");
          return;
        }
        toast.success(`Invitation email resent to ${inv.email}`);
        fetchInvitations();
      } finally {
        setActionLoadingId(null);
      }
    });
  }

  function handleRevoke(inv: PublicInvitationItem) {
    if (!confirm(`Are you sure you want to revoke the invitation for ${inv.email}? The link will become permanently invalid.`)) {
      return;
    }
    setActionLoadingId(`${inv.id}_revoke`);
    startTransition(async () => {
      try {
        const res = await revokeInvitationAction(inv.id);
        if (!res.ok) {
          toast.error(res.error || "Failed to revoke invitation.");
          return;
        }
        toast.success(`Invitation for ${inv.email} has been revoked.`);
        fetchInvitations();
      } finally {
        setActionLoadingId(null);
      }
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
      {/* Control Bar: Search, Filters, Primary Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by email, name, inviter…"
              value={search}
              onChange={(e) => handleFilterChange(e.target.value, statusFilter, roleFilter, dateFilter)}
              className="w-full pl-9 pr-9 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleFilterChange("", statusFilter, roleFilter, dateFilter)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(search, e.target.value, roleFilter, dateFilter)}
            className="px-3.5 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] outline-none shadow-2xs"
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
            className="px-3.5 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] outline-none shadow-2xs"
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
            className="px-3.5 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] outline-none shadow-2xs"
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
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] font-extrabold text-xs rounded-full shadow-2xs transition-all shrink-0 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Invite Admin
        </button>
      </div>

      {/* Desktop Invitations Data Table */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[var(--foreground)]">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Invited Admin</th>
                <th className="px-4 py-3.5">Assigned Role</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Invited By</th>
                <th className="px-4 py-3.5">Sent At</th>
                <th className="px-4 py-3.5">Expires At</th>
                <th className="px-4 py-3.5">Accepted At</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[var(--muted-foreground)]">
                    No admin invitations found matching your criteria.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[var(--foreground)]">
                        {inv.name || "—"}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] font-mono">
                        {inv.email}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[var(--surface-secondary)] text-[var(--foreground)] text-[11px] font-bold border border-[var(--border-subtle)]">
                        {inv.adminRoleName || inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--muted-foreground)]">
                      {inv.invitedByName || inv.invitedByEmail || "System"}
                    </td>
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap text-[var(--muted-foreground)] font-mono" suppressHydrationWarning>
                      {formatUTCDateTime(inv.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap text-[var(--muted-foreground)] font-mono" suppressHydrationWarning>
                      {formatUTCDateTime(inv.expiresAt)}
                    </td>
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap text-[var(--muted-foreground)] font-mono" suppressHydrationWarning>
                      {formatUTCDateTime(inv.acceptedAt)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                      {/* Resend button for Pending or Expired or Failed */}
                      {(inv.status === "PENDING" || inv.status === "EXPIRED" || inv.status === "FAILED") && (
                        <button
                          type="button"
                          onClick={() => handleResend(inv)}
                          disabled={pending || actionLoadingId === `${inv.id}_resend`}
                          className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-2.5 py-1 text-[11px] font-bold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          {actionLoadingId === `${inv.id}_resend` && (
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          )}
                          <span>{actionLoadingId === `${inv.id}_resend` ? "Resending..." : "Resend"}</span>
                        </button>
                      )}

                      {/* Revoke button for Pending */}
                      {inv.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(inv)}
                          disabled={pending || actionLoadingId === `${inv.id}_revoke`}
                          className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 px-2.5 py-1 text-[11px] font-bold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          {actionLoadingId === `${inv.id}_revoke` && (
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          )}
                          <span>{actionLoadingId === `${inv.id}_revoke` ? "Revoking..." : "Revoke"}</span>
                        </button>
                      )}

                      {/* View Details */}
                      <button
                        type="button"
                        onClick={() => setSelectedDetails(inv)}
                        disabled={pending}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all shadow-2xs cursor-pointer"
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
      </div>

      {/* Mobile Invitations Card List */}
      <div className="md:hidden flex flex-col gap-3">
        {invitations.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-xs text-[var(--muted-foreground)]">
            No admin invitations found matching your criteria.
          </div>
        ) : (
          invitations.map((inv) => (
            <div
              key={inv.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-xs text-[var(--foreground)]">{inv.name || "Administrator"}</h3>
                  <p className="text-xs text-[var(--muted-foreground)] font-mono">{inv.email}</p>
                </div>
                {getStatusBadge(inv.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[var(--border-subtle)]">
                <div>
                  <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Role</span>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-[var(--surface-secondary)] text-[var(--foreground)] text-[10px] font-bold border border-[var(--border-subtle)]">
                    {inv.adminRoleName || inv.role}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Invited By</span>
                  <span className="text-[var(--foreground)] truncate block">{inv.invitedByName || inv.invitedByEmail || "System"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Sent</span>
                  <span className="font-mono text-[var(--muted-foreground)]" suppressHydrationWarning>
                    {formatUTCDateTime(inv.createdAt)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-end gap-1.5">
                {(inv.status === "PENDING" || inv.status === "EXPIRED" || inv.status === "FAILED") && (
                  <button
                    type="button"
                    onClick={() => handleResend(inv)}
                    disabled={pending || actionLoadingId === `${inv.id}_resend`}
                    className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-2.5 py-1 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {actionLoadingId === `${inv.id}_resend` && (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    <span>{actionLoadingId === `${inv.id}_resend` ? "Resending..." : "Resend"}</span>
                  </button>
                )}
                {inv.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv)}
                    disabled={pending || actionLoadingId === `${inv.id}_revoke`}
                    className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 px-2.5 py-1 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {actionLoadingId === `${inv.id}_revoke` && (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    <span>{actionLoadingId === `${inv.id}_revoke` ? "Revoking..." : "Revoke"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDetails(inv)}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all shadow-2xs cursor-pointer"
                >
                  Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <AdminPagination
          currentPage={page}
          totalPages={Math.ceil(total / limit) || 1}
          totalItems={total}
          pageSize={limit}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Invite Admin Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                Invite New Administrator
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mb-5">
              The invited administrator will receive an email containing a secure link to create their own confidential password. No password is set by you.
            </p>

            <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="jane.doe@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Assigned Admin Role
                </label>
                <select
                  value={inviteRoleSlug}
                  onChange={(e) => setInviteRoleSlug(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                >
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.slug}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Invitation Note / Message (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Welcome to the team! Please set up your admin profile."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-5 py-2 text-xs font-extrabold shadow-2xs transition-all disabled:opacity-50"
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
          <div className="bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-lg font-bold text-[var(--foreground)]">
                  Invitation Details
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] font-mono">{selectedDetails.id}</p>
              </div>
              <button
                onClick={() => setSelectedDetails(null)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Invited Name</span>
                <span className="col-span-2 font-medium text-[var(--foreground)]">{selectedDetails.name || "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Email</span>
                <span className="col-span-2 font-mono text-[var(--foreground)]">{selectedDetails.email}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Assigned Role</span>
                <span className="col-span-2 font-medium text-[var(--foreground)]">{selectedDetails.adminRoleName || selectedDetails.role}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Status</span>
                <span className="col-span-2">{getStatusBadge(selectedDetails.status)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Invited By</span>
                <span className="col-span-2 text-[var(--muted-foreground)]">{selectedDetails.invitedByName || selectedDetails.invitedByEmail || "System"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Sent At</span>
                <span className="col-span-2 text-[var(--muted-foreground)] font-mono" suppressHydrationWarning>{formatUTCDateTime(selectedDetails.createdAt)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Expires At</span>
                <span className="col-span-2 text-[var(--muted-foreground)] font-mono" suppressHydrationWarning>{formatUTCDateTime(selectedDetails.expiresAt)}</span>
              </div>
              {selectedDetails.acceptedAt && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-[var(--muted-foreground)]">Accepted At</span>
                  <span className="col-span-2 text-emerald-600 dark:text-emerald-400 font-semibold font-mono" suppressHydrationWarning>{formatUTCDateTime(selectedDetails.acceptedAt)}</span>
                </div>
              )}
              {selectedDetails.lastResentAt && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-[var(--muted-foreground)]">Last Resent At</span>
                  <span className="col-span-2 text-[var(--muted-foreground)] font-mono" suppressHydrationWarning>{formatUTCDateTime(selectedDetails.lastResentAt)}</span>
                </div>
              )}
              {selectedDetails.message && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <span className="font-semibold text-[var(--muted-foreground)]">Custom Message</span>
                  <span className="col-span-2 italic text-[var(--foreground)] bg-[var(--surface-secondary)] p-2.5 rounded-lg border border-[var(--border-subtle)]">{selectedDetails.message}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">🔒 Token is cryptographically hashed</span>
              <button
                type="button"
                onClick={() => setSelectedDetails(null)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
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
