"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useState, useTransition, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  if (!value) return "Never";
  const d = new Date(value);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTH_SHORT[d.getUTCMonth()];
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month}, ${hours}:${minutes} UTC`;
}

function formatUTCDate(value?: string | Date | null) {
  if (!value) return "—";
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

export interface AdminUserTableProps {
  initialUsers: AdminUserItem[];
  availableRoles: RoleOption[];
  initialSearch?: string;
  initialStatus?: string;
  initialRole?: string;
  initialPage?: number;
  initialPageSize?: number;
}

export function AdminUserTable({
  initialUsers,
  availableRoles,
  initialSearch = "",
  initialStatus = "ALL",
  initialRole = "ALL",
  initialPage = 1,
  initialPageSize = 10,
}: AdminUserTableProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlSearch = searchParams?.get("search") ?? initialSearch;
  const urlStatus = (searchParams?.get("status") ?? initialStatus).toUpperCase();
  const urlRole = searchParams?.get("role") ?? initialRole;
  const urlPage = Math.max(1, parseInt(searchParams?.get("page") || String(initialPage), 10) || 1);
  const urlPageSize = Math.max(1, parseInt(searchParams?.get("pageSize") || String(initialPageSize), 10) || 10);

  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);
  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState<string>(urlStatus);
  const [roleFilter, setRoleFilter] = useState<string>(urlRole);
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(urlPageSize);

  // Debounced URL sync helper
  const isInitialMount = useRef(true);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const syncUrl = useCallback(
    (newSearch: string, newStatus: string, newRole: string, newPage: number, newPageSize: number) => {
      const params = new URLSearchParams();
      if (newSearch.trim()) params.set("search", newSearch.trim());
      if (newStatus && newStatus !== "ALL") params.set("status", newStatus);
      if (newRole && newRole !== "ALL") params.set("role", newRole);
      if (newPage > 1) params.set("page", String(newPage));
      if (newPageSize !== 10) params.set("pageSize", String(newPageSize));

      const queryStr = params.toString();
      const targetUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
      window.history.replaceState(null, "", targetUrl);
    },
    [pathname]
  );

  // Sync state if user navigates back/forward with browser history
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const s = searchParams?.get("search") ?? "";
    const st = (searchParams?.get("status") ?? "ALL").toUpperCase();
    const r = searchParams?.get("role") ?? "ALL";
    const p = Math.max(1, parseInt(searchParams?.get("page") || "1", 10) || 1);
    const ps = Math.max(1, parseInt(searchParams?.get("pageSize") || "10", 10) || 10);

    setSearch((prev) => (prev !== s ? s : prev));
    setStatusFilter((prev) => (prev !== st ? st : prev));
    setRoleFilter((prev) => (prev !== r ? r : prev));
    setCurrentPage((prev) => (prev !== p ? p : prev));
    setPageSize((prev) => (prev !== ps ? ps : prev));
  }, [searchParams]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserItem | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserItem | null>(null);
  const [statusConfirmUser, setStatusConfirmUser] = useState<{
    user: AdminUserItem;
    targetStatus: "ACTIVE" | "SUSPENDED";
  } | null>(null);
  const [revokeSessionsUser, setRevokeSessionsUser] = useState<AdminUserItem | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRoleSlug, setNewRoleSlug] = useState(availableRoles[0]?.slug || "admin");
  const [editRoleSlug, setEditRoleSlug] = useState("");

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Super admin helper
  function isSuper(u: AdminUserItem) {
    return u.adminRole?.slug === "super_admin" || u.adminRole?.slug === "super-admin";
  }

  const superRoleSlug = useMemo(() => {
    return (
      availableRoles.find((r) => r.slug === "super_admin" || r.slug === "super-admin")?.slug ||
      "super_admin"
    );
  }, [availableRoles]);

  // Metrics for quick-filter cards
  const metrics = useMemo(() => {
    const total = users.length;
    let active = 0;
    let suspended = 0;
    let superAdmins = 0;

    for (const u of users) {
      if (u.status === "SUSPENDED") {
        suspended++;
      } else {
        active++;
      }
      if (isSuper(u)) {
        superAdmins++;
      }
    }

    return { total, active, suspended, superAdmins };
  }, [users]);

  // Filter users
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "ALL" || (u.status || "ACTIVE") === statusFilter;

      const matchesRole =
        roleFilter === "ALL" ||
        u.adminRole?.slug === roleFilter ||
        u.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, search, statusFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== "ALL" || roleFilter !== "ALL");

  // Handler functions with URL sync
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      syncUrl(val, statusFilter, roleFilter, 1, pageSize);
    }, 250);
  };

  const handleClearSearch = () => {
    setSearch("");
    setCurrentPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl("", statusFilter, roleFilter, 1, pageSize);
  };

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl(search, newStatus, roleFilter, 1, pageSize);
  };

  const handleRoleFilterChange = (newRole: string) => {
    setRoleFilter(newRole);
    setCurrentPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl(search, statusFilter, newRole, 1, pageSize);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    syncUrl(search, statusFilter, roleFilter, newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    syncUrl(search, statusFilter, roleFilter, 1, newSize);
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setRoleFilter("ALL");
    setCurrentPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl("", "ALL", "ALL", 1, pageSize);
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = ["ID", "Name", "Email", "Role", "Status", "Last Login", "Created Date"];
    const rows = filteredUsers.map((u) => [
      `"${u.id}"`,
      `"${(u.name || "").replace(/"/g, '""')}"`,
      `"${(u.email || "").replace(/"/g, '""')}"`,
      `"${(u.adminRole?.name || u.role).replace(/"/g, '""')}"`,
      `"${u.status || "ACTIVE"}"`,
      `"${formatUTCDateTime(u.lastLoginAt)}"`,
      `"${formatUTCDate(u.createdAt)}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredUsers.length} administrators to CSV`);
  };

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
    setStatusConfirmUser({ user, targetStatus: nextStatus as "ACTIVE" | "SUSPENDED" });
  }

  function confirmToggleStatus() {
    if (!statusConfirmUser) return;
    const { user, targetStatus } = statusConfirmUser;
    setActionLoadingId(`${user.id}_status`);

    startTransition(async () => {
      try {
        const res = await toggleUserStatusAction(user.id, targetStatus);
        if (!res.ok) {
          toast.error(res.error || "Failed to update user status");
          return;
        }

        setUsers(users.map((u) => (u.id === user.id ? { ...u, status: targetStatus } : u)));
        toast.success(`User ${user.email} is now ${targetStatus.toLowerCase()}.`);
        setStatusConfirmUser(null);
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
    setRevokeSessionsUser(user);
  }

  function confirmRevokeSessions() {
    if (!revokeSessionsUser) return;
    const user = revokeSessionsUser;
    setActionLoadingId(`${user.id}_revoke`);

    startTransition(async () => {
      try {
        const res = await revokeUserSessionsAction(user.id);
        if (!res.ok) {
          toast.error(res.error || "Failed to revoke sessions");
          return;
        }
        toast.success(`All active sessions revoked for ${user.email}.`);
        setRevokeSessionsUser(null);
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
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Interactive Quick-Filter KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Admins */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("ALL");
            setRoleFilter("ALL");
            setCurrentPage(1);
            syncUrl(search, "ALL", "ALL", 1, pageSize);
          }}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === "ALL" && roleFilter === "ALL"
              ? "border-[var(--accent)] bg-[var(--surface-secondary)] ring-2 ring-[var(--accent)]/20 shadow-xs"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Admins</span>
            <span className="p-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)]">
              <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground mt-2">
            {metrics.total}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
            All configured staff accounts
          </span>
        </button>

        {/* Card 2: Active Accounts */}
        <button
          type="button"
          onClick={() => {
            const next = statusFilter === "ACTIVE" ? "ALL" : "ACTIVE";
            handleStatusFilterChange(next);
          }}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === "ACTIVE"
              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 shadow-xs"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-emerald-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Active</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground mt-2">
            {metrics.active}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Fully authorized & active
          </span>
        </button>

        {/* Card 3: Suspended Accounts */}
        <button
          type="button"
          onClick={() => {
            const next = statusFilter === "SUSPENDED" ? "ALL" : "SUSPENDED";
            handleStatusFilterChange(next);
          }}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === "SUSPENDED"
              ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 ring-2 ring-rose-500/20 shadow-xs"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-rose-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Suspended</span>
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50">
              <svg className="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground mt-2">
            {metrics.suspended}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Access currently revoked
          </span>
        </button>

        {/* Card 4: Super Admins */}
        <button
          type="button"
          onClick={() => {
            const next = roleFilter === superRoleSlug ? "ALL" : superRoleSlug;
            handleRoleFilterChange(next);
          }}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            roleFilter === superRoleSlug
              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-amber-500/20 shadow-xs"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-amber-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Super Admins</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground mt-2">
            {metrics.superAdmins}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Full root RBAC access
          </span>
        </button>
      </div>

      {/* Controls Bar: Search, Filters, CSV Export, Add Admin Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search input with clear button */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-2 pl-9 pr-9 text-xs text-muted-foreground outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
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
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-muted-foreground hover:bg-[var(--surface)] transition-colors cursor-pointer"
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
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-muted-foreground outline-none shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => handleRoleFilterChange(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-muted-foreground outline-none shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            {availableRoles.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Reset Filters Quick Button if active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-xs text-muted-foreground hover:bg-[var(--surface)] transition-all cursor-pointer shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right action group: Export CSV + Add Administrator */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredUsers.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Export administrators to CSV"
          >
            <svg className="h-3.5 w-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 text-xs font-semibold text-[var(--accent-foreground)] transition-all shadow-2xs cursor-pointer"
          >
            + Add Administrator
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
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
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p>No administrators found matching your criteria.</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] cursor-pointer shadow-2xs"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
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
                          <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold flex items-center justify-center text-xs shadow-2xs">
                            {(u.name?.[0] || u.email?.[0] || "A").toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-muted-foreground">
                              {u.name || "Unnamed Admin"}
                            </div>
                            <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--surface-secondary)] text-muted-foreground border border-[var(--border-subtle)]">
                          {u.adminRole?.name || u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-2xs ${
                            u.status === "SUSPENDED"
                              ? "bg-rose-100/90 text-rose-800 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300"
                              : isPendingSetup
                              ? "bg-amber-100 text-amber-800 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {u.status === "SUSPENDED"
                            ? "Suspended"
                            : isPendingSetup
                            ? "Pending Setup"
                            : "Active"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/admins/${u.id}/permissions`}
                            className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline font-semibold"
                          >
                            <span>Permissions</span>
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                          {superAdmin && (
                            <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                              Root
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]">
                        {formatUTCDateTime(u.lastLoginAt)}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]">
                        {formatUTCDate(u.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {/* Activate Button for Invitations/Pending setup */}
                        {isPendingSetup && !superAdmin && (
                          <button
                            type="button"
                            onClick={() => handleActivateAdmin(u)}
                            disabled={isRowBusy}
                            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[11px] font-semibold shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                          >
                            {isActivating && (
                              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            )}
                            <span>{isActivating ? "Activating..." : "Activate"}</span>
                          </button>
                        )}

                        {/* Edit Role Button */}
                        {!superAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditUser(u);
                              setEditRoleSlug(u.adminRole?.slug || "admin");
                            }}
                            disabled={isRowBusy}
                            className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            Role
                          </button>
                        )}

                        {/* Suspend / Unsuspend */}
                        {!superAdmin && !isPendingSetup && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isRowBusy}
                            className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer shadow-2xs"
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

                        {/* Revoke Sessions */}
                        <button
                          type="button"
                          onClick={() => handleRevokeSessions(u)}
                          disabled={isRowBusy}
                          className="rounded-full border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50 px-2 py-1 text-[11px] font-semibold disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Revoke all active sessions for this administrator"
                        >
                          {isRevoking && (
                            <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          )}
                          <span>Log Out</span>
                        </button>

                        {/* Delete Admin */}
                        {!superAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteUser(u)}
                            disabled={isRowBusy}
                            className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 px-2 py-1 text-[11px] font-semibold disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            Delete
                          </button>
                        )}
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
        {paginatedUsers.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted-foreground)]">
            <p>No administrators found matching your criteria.</p>
            {hasActiveFilters && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] cursor-pointer shadow-2xs"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        ) : (
          paginatedUsers.map((u) => {
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
                    <div className="h-9 w-9 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold flex items-center justify-center text-sm shadow-2xs">
                      {(u.name?.[0] || u.email?.[0] || "A").toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-muted-foreground text-sm">
                        {u.name || "Unnamed Admin"}
                      </h3>
                      <p className="text-xs text-[var(--muted-foreground)] font-mono">{u.email}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-2xs ${
                      u.status === "SUSPENDED"
                        ? "bg-rose-100/90 text-rose-800 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300"
                        : isPendingSetup
                        ? "bg-amber-100 text-amber-800 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300"
                    }`}
                  >
                    {u.status === "SUSPENDED"
                      ? "Suspended"
                      : isPendingSetup
                      ? "Pending Setup"
                      : "Active"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--border-subtle)]">
                  <div>
                    <span className="text-[var(--muted-foreground)] text-[10px] uppercase font-semibold block">
                      Role
                    </span>
                    <span className="font-medium text-muted-foreground">
                      {u.adminRole?.name || u.role}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] text-[10px] uppercase font-semibold block">
                      Last Login
                    </span>
                    <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                      {formatUTCDateTime(u.lastLoginAt)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-end gap-1.5">
                  {!superAdmin ? (
                    <Link
                      href={`/admin/admins/${u.id}/permissions`}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)]"
                    >
                      Permissions
                    </Link>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 px-2.5 py-1 text-[10px] font-semibold">
                      Fixed Super Access
                    </span>
                  )}
                  {isPendingSetup && !superAdmin && (
                    <button
                      type="button"
                      onClick={() => handleActivateAdmin(u)}
                      disabled={isRowBusy}
                      className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-semibold shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
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
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-muted-foreground disabled:opacity-50 cursor-pointer"
                    >
                      Role
                    </button>
                  )}
                  {!superAdmin && !isPendingSetup && (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(u)}
                      disabled={isRowBusy}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-muted-foreground disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
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
          })
        )}
      </div>

      {/* Pagination Footer */}
      <AdminPagination
        currentPage={activePage}
        totalPages={totalPages}
        totalItems={filteredUsers.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        itemLabel="administrators"
        pageSizeOptions={[10, 25, 50]}
      />

      {/* Modal 1: Add Administrator */}
      {showAddModal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-muted-foreground">
                Add New Administrator
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[var(--muted-foreground)] hover:text-muted-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mb-2">
              An invitation email will be sent to the administrator to securely set up their confidential password.
            </p>

            <form onSubmit={handleCreateAdmin} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--muted-foreground)]">Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="e.g. Alex Walker"
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--muted-foreground)]">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="alex@homyz.local"
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--muted-foreground)]">
                  Assign Administrative Role *
                </label>
                <select
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
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
                  className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 text-xs font-semibold text-[var(--accent-foreground)] transition-all shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {pending && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <span>{pending ? "Creating..." : "Create Admin"}</span>
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Modal 2: Edit Role */}
      {editUser && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h2 className="text-base font-semibold text-muted-foreground mb-1">
              Change Role for {editUser.name || editUser.email}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Select the administrative permission bundle for this user.
            </p>

            <form onSubmit={handleUpdateRole} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[var(--muted-foreground)]">
                  Role
                </label>
                <select
                  value={editRoleSlug}
                  onChange={(e) => setEditRoleSlug(e.target.value)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground px-3 py-2 text-xs outline-none focus:border-[var(--accent)] cursor-pointer"
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
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 text-xs font-semibold text-[var(--accent-foreground)] transition-all shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {pending && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <span>{pending ? "Saving..." : "Save Role"}</span>
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Modal 3: Delete Administrator Confirmation */}
      {deleteUser && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-muted-foreground">
                  Delete Administrator
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Permanent removal of administrator account
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mb-5 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-muted-foreground">{deleteUser.name || deleteUser.email}</strong> ({deleteUser.email})? All active sessions and administrator access will be revoked immediately. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteUser(null)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAdmin}
                disabled={pending}
                className="rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {pending ? "Deleting..." : "Delete Administrator"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Modal 4: Suspend / Activate Administrator Confirmation */}
      {statusConfirmUser && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                  statusConfirmUser.targetStatus === "SUSPENDED"
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {statusConfirmUser.targetStatus === "SUSPENDED" ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-muted-foreground">
                  {statusConfirmUser.targetStatus === "SUSPENDED" ? "Suspend Administrator" : "Activate Administrator"}
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {statusConfirmUser.targetStatus === "SUSPENDED" ? "Account restriction" : "Restore account access"}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mb-5 leading-relaxed">
              {statusConfirmUser.targetStatus === "SUSPENDED" ? (
                <>
                  Are you sure you want to suspend administrator{" "}
                  <strong className="text-muted-foreground">
                    {statusConfirmUser.user.name || statusConfirmUser.user.email}
                  </strong>{" "}
                  ({statusConfirmUser.user.email})? They will immediately lose administrative portal access and all active sessions will be terminated.
                </>
              ) : (
                <>
                  Are you sure you want to activate administrator{" "}
                  <strong className="text-muted-foreground">
                    {statusConfirmUser.user.name || statusConfirmUser.user.email}
                  </strong>{" "}
                  ({statusConfirmUser.user.email})? They will regain administrative portal access based on their assigned permissions.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusConfirmUser(null)}
                disabled={pending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmToggleStatus}
                disabled={pending}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer ${
                  statusConfirmUser.targetStatus === "SUSPENDED"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {pending && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>
                  {pending
                    ? "Updating..."
                    : statusConfirmUser.targetStatus === "SUSPENDED"
                    ? "Suspend Account"
                    : "Activate Account"}
                </span>
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Modal 5: Revoke Sessions Confirmation */}
      {revokeSessionsUser && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-muted-foreground">
                  Revoke Active Sessions
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Force sign-out across all devices
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mb-5 leading-relaxed">
              Are you sure you want to revoke all active sessions for{" "}
              <strong className="text-muted-foreground">
                {revokeSessionsUser.name || revokeSessionsUser.email}
              </strong>{" "}
              ({revokeSessionsUser.email})? The user will be immediately logged out of all active web and mobile sessions and will be required to authenticate again.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeSessionsUser(null)}
                disabled={pending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRevokeSessions}
                disabled={pending}
                className="rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {pending && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>{pending ? "Revoking..." : "Revoke All Sessions"}</span>
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
