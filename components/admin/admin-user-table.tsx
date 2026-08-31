"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { AdminPagination } from "./admin-pagination";
import {
  createAdminAction,
  updateAdminAction,
  deleteAdminAction,
  toggleUserStatusAction,
  resetAdminPasswordAction,
  revokeUserSessionsAction,
  activatePendingAdminAction,
} from "@/actions/admin/adminManagement";

// Use deterministic UTC-based formatting to avoid server/client locale/timezone
// differences which can cause React hydration mismatches.
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatUTCDateTime(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTH_SHORT[d.getUTCMonth()];
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month}, ${hours}:${minutes}`;
}

function formatUTCDate(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTH_SHORT[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export interface AdminUserItem {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status?: string;
  lastLoginAt?: Date | string | null;
  adminRoleId?: string | null;
  adminRole?: { name: string; slug: string } | null;
  createdAt: Date | string;
}

export interface RoleOption {
  id: string;
  name: string;
  slug: string;
}

export function AdminUserTable({
  initialUsers,
  availableRoles,
}: {
  initialUsers: AdminUserItem[];
  availableRoles: RoleOption[];
}) {
  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserItem | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserItem | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRoleSlug, setNewRoleSlug] = useState(availableRoles[0]?.slug || "admin");

  const [editRoleSlug, setEditRoleSlug] = useState("");

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Helper check for super admin
  function isSuper(u: AdminUserItem) {
    return u.adminRole?.slug === "super_admin" || u.adminRole?.slug === "super-admin";
  }

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || (u.status || "ACTIVE") === statusFilter;

    const matchesRole =
      roleFilter === "ALL" ||
      u.adminRole?.slug === roleFilter ||
      u.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );

  function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const payload: any = {
        name: newName.trim(),
        email: newEmail.trim(),
        role: "ADMIN",
        adminRoleSlug: newRoleSlug,
      };

      const res = await createAdminAction(payload);

      if (!res.ok) {
        toast.error(res.error || "Failed to create administrator");
        return;
      }

      setUsers([res.data as AdminUserItem, ...users]);
      setShowAddModal(false);
      setNewName("");
      setNewEmail("");
      toast.success(
        `Invitation sent to ${res.data.email}! An invitation email has been sent for them to set up their password.`
      );
    });
  }

  function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    if (isSuper(editUser)) {
      toast.error("Super Admin role cannot be modified.");
      return;
    }

    startTransition(async () => {
      const res = await updateAdminAction(editUser.id, {
        adminRoleSlug: editRoleSlug,
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to update role");
        return;
      }

      setUsers(users.map((u) => (u.id === editUser.id ? (res.data as AdminUserItem) : u)));
      setEditUser(null);
      toast.success("Administrator role updated.");
    });
  }

  function handleToggleStatus(user: AdminUserItem) {
    if (isSuper(user)) {
      toast.error("Super Admin account cannot be suspended.");
      return;
    }

    const current = user.status || "ACTIVE";
    const nextStatus = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setActionLoadingId(`${user.id}_status`);

    startTransition(async () => {
      try {
        const res = await toggleUserStatusAction(user.id, nextStatus as "ACTIVE" | "SUSPENDED");
        if (!res.ok) {
          toast.error(res.error || "Failed to update user status");
          return;
        }

        setUsers(users.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
        toast.success(`User ${user.email} is now ${nextStatus.toLowerCase()}.`);
      } finally {
        setActionLoadingId(null);
      }
    });
  }

  function handleActivateAdmin(user: AdminUserItem) {
    setActionLoadingId(`${user.id}_activate`);

    startTransition(async () => {
      try {
        const res = await activatePendingAdminAction(user.id);
        if (!res.ok) {
          toast.error(res.error || "Failed to activate administrator");
          return;
        }

        setUsers(users.map((u) => (u.id === user.id ? { ...u, status: "ACTIVE" } : u)));
        toast.success(
          `Pending administrator ${user.email} permissions verified and account successfully activated!`
        );
      } finally {
        setActionLoadingId(null);
      }
    });
  }

  function handleRevokeSessions(user: AdminUserItem) {
    if (!confirm(`Revoke all active sessions for ${user.email}? They will be forced to log in again.`)) {
      return;
    }
    setActionLoadingId(`${user.id}_revoke`);

    startTransition(async () => {
      try {
        const res = await revokeUserSessionsAction(user.id);
        if (!res.ok) {
          toast.error(res.error || "Failed to revoke sessions");
          return;
        }
        toast.success(`All active sessions revoked for ${user.email}.`);
      } finally {
        setActionLoadingId(null);
      }
    });
  }

  function handleDeleteAdmin() {
    if (!deleteUser) return;

    startTransition(async () => {
      const res = await deleteAdminAction(deleteUser.id);
      if (!res.ok) {
        toast.error(res.error || "Failed to delete administrator");
        setDeleteUser(null);
        return;
      }

      setUsers(users.filter((u) => u.id !== deleteUser.id));
      toast.success(`Administrator ${deleteUser.email} was permanently deleted.`);
      setDeleteUser(null);
    });
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">
      {/* Controls Bar: Search, Filters, Add Admin Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-2 pl-9 pr-9 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)] pointer-events-none"
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
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">All Roles</option>
            {availableRoles.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 text-xs font-extrabold text-[var(--accent-foreground)] transition-all shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          + Add Administrator
        </button>
      </div>

      {/* Desktop Table View (Columns: Name, Email, Role, Status, Permission Count, Last Login, Created, Actions) */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Admin Name</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Permission Access</th>
              <th className="py-3 px-4">Last Login</th>
              <th className="py-3 px-4">Created Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[var(--muted-foreground)]">
                  No administrators found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const superAdmin = isSuper(u);
                const isPendingSetup = u.status === "INVITATION_PENDING" || u.status === "PENDING_SETUP";
                const isActivating = actionLoadingId === `${u.id}_activate`;
                const isTogglingStatus = actionLoadingId === `${u.id}_status`;
                const isRevoking = actionLoadingId === `${u.id}_revoke`;
                const isRowBusy = pending || isActivating || isTogglingStatus || isRevoking;

                return (
                  <tr key={u.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold flex items-center justify-center text-xs shadow-2xs">
                          {(u.name?.[0] || u.email?.[0] || "A").toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--foreground)]">
                            {u.name || "Unnamed Admin"}
                          </div>
                          <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border-subtle)]">
                        {u.adminRole?.name || u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs ${
                          u.status === "SUSPENDED"
                            ? "bg-rose-100/90 text-rose-800 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60"
                            : isPendingSetup
                            ? "bg-amber-100/90 text-amber-800 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60"
                            : "bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                        }`}
                      >
                        {isPendingSetup ? "Pending Setup" : u.status || "ACTIVE"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {superAdmin ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100/90 text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300">
                          🛡️ Super Admin (Full Access)
                        </span>
                      ) : isPendingSetup ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300">
                          ⚠️ Needs Permission Setup
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border-subtle)]">
                          Individual Configuration
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Never"}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>
                      {new Date(u.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Manage Permissions Action */}
                        {!superAdmin ? (
                          <Link
                            href={`/admin/admins/${u.id}/permissions`}
                            className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-3 py-1 text-[11px] font-extrabold transition-all shadow-2xs"
                            title="Configure individual permissions matrix"
                          >
                            Manage Permissions
                          </Link>
                        ) : (
                          <span
                            className="rounded-full border border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-2.5 py-1 text-[10px] font-extrabold cursor-not-allowed opacity-80"
                            title="Super Admin has fixed full access"
                          >
                            Fixed Access
                          </span>
                        )}

                        {isPendingSetup && !superAdmin && (
                          <button
                            type="button"
                            onClick={() => handleActivateAdmin(u)}
                            disabled={isRowBusy}
                            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 text-[11px] font-extrabold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                            title="Verify configured permissions and activate account"
                          >
                            {isActivating && (
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            )}
                            <span>{isActivating ? "Activating..." : "Activate Admin"}</span>
                          </button>
                        )}

                        {!superAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditUser(u);
                              setEditRoleSlug(u.adminRole?.slug || "admin");
                            }}
                            disabled={isRowBusy}
                            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                          >
                            Edit Role
                          </button>
                        )}

                        {!superAdmin && !isPendingSetup && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isRowBusy}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                              u.status === "SUSPENDED"
                                ? "bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-rose-100/90 text-rose-800 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300"
                            }`}
                          >
                            {isTogglingStatus && (
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            )}
                            <span>
                              {isTogglingStatus
                                ? "Updating..."
                                : u.status === "SUSPENDED"
                                ? "Activate"
                                : "Suspend"}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRevokeSessions(u)}
                          disabled={isRowBusy}
                          className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 px-2.5 py-1 text-[11px] font-bold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                          title="Revoke Sessions"
                        >
                          {isRevoking && (
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          )}
                          <span>{isRevoking ? "Revoking..." : "Revoke"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredUsers.map((u) => {
          const superAdmin = isSuper(u);
          const isPendingSetup = u.status === "INVITATION_PENDING" || u.status === "PENDING_SETUP";
          const isActivating = actionLoadingId === `${u.id}_activate`;
          const isTogglingStatus = actionLoadingId === `${u.id}_status`;
          const isRevoking = actionLoadingId === `${u.id}_revoke`;
          const isRowBusy = pending || isActivating || isTogglingStatus || isRevoking;

          return (
            <div
              key={u.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold flex items-center justify-center text-sm shadow-2xs">
                    {(u.name?.[0] || u.email?.[0] || "A").toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)] text-sm">
                      {u.name || "Unnamed Admin"}
                    </h3>
                    <p className="text-xs text-[var(--muted-foreground)] font-mono">{u.email}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs ${
                    u.status === "SUSPENDED"
                      ? "bg-rose-100/90 text-rose-800 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300"
                      : isPendingSetup
                      ? "bg-amber-100/90 text-amber-800 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300"
                      : "bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}
                >
                  {isPendingSetup ? "Pending Setup" : u.status || "ACTIVE"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] pt-2 border-t border-[var(--border-subtle)]">
                <span>Role: <strong className="text-[var(--foreground)]">{u.adminRole?.name || u.role}</strong></span>
                <span>
                  {superAdmin ? (
                    <strong className="text-amber-700 dark:text-amber-300 font-extrabold">Full Access</strong>
                  ) : isPendingSetup ? (
                    <span className="text-amber-800 dark:text-amber-300 font-bold">Needs Setup</span>
                  ) : (
                    <span>Individual Matrix</span>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {!superAdmin ? (
                  <Link
                    href={`/admin/admins/${u.id}/permissions`}
                    className="rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-3 py-1 text-center text-[10px] font-extrabold shadow-2xs"
                  >
                    Manage Permissions
                  </Link>
                ) : (
                  <span className="rounded-full border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 px-2.5 py-1 text-[10px] font-bold">
                    Fixed Super Access
                  </span>
                )}
                {isPendingSetup && !superAdmin && (
                  <button
                    type="button"
                    onClick={() => handleActivateAdmin(u)}
                    disabled={isRowBusy}
                    className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-extrabold shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {isActivating && (
                      <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    <span>{isActivating ? "Activating..." : "Activate"}</span>
                  </button>
                )}
                {!superAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditUser(u);
                      setEditRoleSlug(u.adminRole?.slug || "admin");
                    }}
                    disabled={isRowBusy}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--foreground)] disabled:opacity-50 cursor-pointer"
                  >
                    Role
                  </button>
                )}
                {!superAdmin && !isPendingSetup && (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(u)}
                    disabled={isRowBusy}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--foreground)] disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {isTogglingStatus && (
                      <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    <span>
                      {isTogglingStatus
                        ? "Updating..."
                        : u.status === "SUSPENDED"
                        ? "Activate"
                        : "Suspend"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      <AdminPagination
        currentPage={activePage}
        totalPages={totalPages}
        totalItems={filteredUsers.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        itemLabel="administrators"
        pageSizeOptions={[10, 20, 50]}
      />

      {/* Modal 1: Add Administrator */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-extrabold text-[var(--foreground)]">
                Add New Administrator
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mb-2">
              An invitation email will be sent to the administrator to securely set up their confidential password.
            </p>

            <form onSubmit={handleCreateAdmin} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--muted-foreground)]">Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="e.g. Alex Walker"
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--muted-foreground)]">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="alex@homyz.local"
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--muted-foreground)]">
                  Assign Administrative Role *
                </label>
                <select
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                >
                  {availableRoles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 text-xs font-extrabold text-[var(--accent-foreground)] transition-all shadow-2xs inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {pending && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <span>{pending ? "Creating..." : "Create Admin"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Role */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h2 className="text-base font-extrabold text-[var(--foreground)] mb-1">
              Change Role for {editUser.name || editUser.email}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Select the administrative permission bundle for this user.
            </p>

            <form onSubmit={handleUpdateRole} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[var(--muted-foreground)]">
                  Role
                </label>
                <select
                  value={editRoleSlug}
                  onChange={(e) => setEditRoleSlug(e.target.value)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                >
                  {availableRoles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 text-xs font-extrabold text-[var(--accent-foreground)] transition-all shadow-2xs inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {pending && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <span>{pending ? "Saving..." : "Save Role"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Delete Administrator Confirmation */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[var(--foreground)]">
                  Delete Administrator
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Permanent removal of administrator account
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mb-5 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-[var(--foreground)]">{deleteUser.name || deleteUser.email}</strong> ({deleteUser.email})? All active sessions and administrator access will be revoked immediately. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteUser(null)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAdmin}
                disabled={pending}
                className="rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {pending ? "Deleting..." : "Delete Administrator"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
