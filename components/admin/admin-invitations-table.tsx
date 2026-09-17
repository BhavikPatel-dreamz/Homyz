"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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

export interface InvitationMetrics {
  total: number;
  pending: number;
  accepted: number;
  expiredRevoked: number;
}

export interface AdminInvitationsTableProps {
  initialInvitations: PublicInvitationItem[];
  initialTotal: number;
  availableRoles: RoleOption[];
  initialSearch?: string;
  initialStatus?: string;
  initialRole?: string;
  initialDateRange?: string;
  initialPage?: number;
  initialPageSize?: number;
  metrics?: InvitationMetrics;
}

export function AdminInvitationsTable({
  initialInvitations,
  initialTotal,
  availableRoles,
  initialSearch = "",
  initialStatus = "ALL",
  initialRole = "ALL",
  initialDateRange = "ALL",
  initialPage = 1,
  initialPageSize = 10,
  metrics,
}: AdminInvitationsTableProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlSearch = searchParams?.get("search") ?? initialSearch;
  const urlStatus = (searchParams?.get("status") ?? initialStatus).toUpperCase();
  const urlRole = searchParams?.get("role") ?? initialRole;
  const urlDate = (searchParams?.get("dateRange") ?? initialDateRange).toUpperCase();
  const urlPage = Math.max(1, parseInt(searchParams?.get("page") || String(initialPage), 10) || 1);
  const urlPageSize = Math.max(1, parseInt(searchParams?.get("pageSize") || String(initialPageSize), 10) || 10);

  const [invitations, setInvitations] = useState<PublicInvitationItem[]>(initialInvitations);
  const [total, setTotal] = useState(initialTotal);

  // Filters
  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState<string>(urlStatus);
  const [roleFilter, setRoleFilter] = useState<string>(urlRole);
  const [dateFilter, setDateFilter] = useState<string>(urlDate);
  const [page, setPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(urlPageSize);

  const [stats, setStats] = useState<InvitationMetrics>(
    metrics || {
      total: initialTotal,
      pending: initialInvitations.filter((i) => i.status === "PENDING").length,
      accepted: initialInvitations.filter((i) => i.status === "ACCEPTED").length,
      expiredRevoked: initialInvitations.filter((i) =>
        ["EXPIRED", "REVOKED", "FAILED"].includes(i.status)
      ).length,
    }
  );

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<PublicInvitationItem | null>(null);
  const [revokeConfirmInv, setRevokeConfirmInv] = useState<PublicInvitationItem | null>(null);

  // Invite Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleSlug, setInviteRoleSlug] = useState(availableRoles[0]?.slug || "admin");
  const [inviteMessage, setInviteMessage] = useState("");

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Debounced URL sync helper
  const isInitialMount = useRef(true);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const syncUrl = useCallback(
    (
      newSearch: string,
      newStatus: string,
      newRole: string,
      newDate: string,
      newPage: number,
      newPageSize: number
    ) => {
      const params = new URLSearchParams();
      if (newSearch.trim()) params.set("search", newSearch.trim());
      if (newStatus && newStatus !== "ALL") params.set("status", newStatus);
      if (newRole && newRole !== "ALL") params.set("role", newRole);
      if (newDate && newDate !== "ALL") params.set("dateRange", newDate);
      if (newPage > 1) params.set("page", String(newPage));
      if (newPageSize !== 10) params.set("pageSize", String(newPageSize));

      const queryStr = params.toString();
      const targetUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
      window.history.replaceState(null, "", targetUrl);
    },
    [pathname]
  );

  async function fetchInvitations(
    p = page,
    s = search,
    st = statusFilter,
    r = roleFilter,
    d = dateFilter,
    ps = pageSize
  ) {
    const res = await listInvitationsAction({
      skip: (p - 1) * ps,
      take: ps,
      search: s.trim() || undefined,
      status: st !== "ALL" ? st : undefined,
      role: r !== "ALL" ? r : undefined,
      dateRange: d !== "ALL" ? d : undefined,
    });
    if (res.ok && res.data) {
      setInvitations(res.data.items as any);
      setTotal(res.data.total);
    }
  }

  // Sync state if user navigates back/forward with browser history
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const s = searchParams?.get("search") ?? "";
    const st = (searchParams?.get("status") ?? "ALL").toUpperCase();
    const r = searchParams?.get("role") ?? "ALL";
    const d = (searchParams?.get("dateRange") ?? "ALL").toUpperCase();
    const p = Math.max(1, parseInt(searchParams?.get("page") || "1", 10) || 1);
    const ps = Math.max(1, parseInt(searchParams?.get("pageSize") || "10", 10) || 10);

    setSearch(s);
    setStatusFilter(st);
    setRoleFilter(r);
    setDateFilter(d);
    setPage(p);
    setPageSize(ps);

    startTransition(() => {
      fetchInvitations(p, s, st, r, d, ps);
    });
  }, [searchParams]);

  // Handlers
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      syncUrl(val, statusFilter, roleFilter, dateFilter, 1, pageSize);
      startTransition(() => {
        fetchInvitations(1, val, statusFilter, roleFilter, dateFilter, pageSize);
      });
    }, 250);
  };

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl("", statusFilter, roleFilter, dateFilter, 1, pageSize);
    startTransition(() => {
      fetchInvitations(1, "", statusFilter, roleFilter, dateFilter, pageSize);
    });
  };

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl(search, newStatus, roleFilter, dateFilter, 1, pageSize);
    startTransition(() => {
      fetchInvitations(1, search, newStatus, roleFilter, dateFilter, pageSize);
    });
  };

  const handleRoleFilterChange = (newRole: string) => {
    setRoleFilter(newRole);
    setPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl(search, statusFilter, newRole, dateFilter, 1, pageSize);
    startTransition(() => {
      fetchInvitations(1, search, statusFilter, newRole, dateFilter, pageSize);
    });
  };

  const handleDateFilterChange = (newDate: string) => {
    setDateFilter(newDate);
    setPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl(search, statusFilter, roleFilter, newDate, 1, pageSize);
    startTransition(() => {
      fetchInvitations(1, search, statusFilter, roleFilter, newDate, pageSize);
    });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    syncUrl(search, statusFilter, roleFilter, dateFilter, newPage, pageSize);
    startTransition(() => {
      fetchInvitations(newPage, search, statusFilter, roleFilter, dateFilter, pageSize);
    });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    syncUrl(search, statusFilter, roleFilter, dateFilter, 1, newSize);
    startTransition(() => {
      fetchInvitations(1, search, statusFilter, roleFilter, dateFilter, newSize);
    });
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setRoleFilter("ALL");
    setDateFilter("ALL");
    setPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl("", "ALL", "ALL", "ALL", 1, pageSize);
    startTransition(() => {
      fetchInvitations(1, "", "ALL", "ALL", "ALL", pageSize);
    });
  };

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter !== "ALL" || roleFilter !== "ALL" || dateFilter !== "ALL"
  );

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "ID",
      "Name",
      "Email",
      "Role",
      "Status",
      "Invited By",
      "Sent At",
      "Expires At",
      "Accepted At",
    ];
    const rows = invitations.map((i) => [
      `"${i.id}"`,
      `"${(i.name || "").replace(/"/g, '""')}"`,
      `"${(i.email || "").replace(/"/g, '""')}"`,
      `"${(i.adminRoleName || i.role).replace(/"/g, '""')}"`,
      `"${i.status}"`,
      `"${(i.invitedByName || i.invitedByEmail || "System").replace(/"/g, '""')}"`,
      `"${formatUTCDateTime(i.createdAt)}"`,
      `"${formatUTCDateTime(i.expiresAt)}"`,
      `"${formatUTCDateTime(i.acceptedAt)}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-invitations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${invitations.length} invitations to CSV`);
  };

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
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        pending: prev.pending + 1,
      }));
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
    setRevokeConfirmInv(inv);
  }

  function confirmRevokeInvitation() {
    if (!revokeConfirmInv) return;
    const inv = revokeConfirmInv;
    setActionLoadingId(`${inv.id}_revoke`);
    startTransition(async () => {
      try {
        const res = await revokeInvitationAction(inv.id);
        if (!res.ok) {
          toast.error(res.error || "Failed to revoke invitation.");
          return;
        }
        toast.success(`Invitation for ${inv.email} has been revoked.`);
        setRevokeConfirmInv(null);
        setStats((prev) => ({
          ...prev,
          pending: Math.max(0, prev.pending - 1),
          expiredRevoked: prev.expiredRevoked + 1,
        }));
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
          </span>
        );
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Accepted
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            Expired
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Revoked
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800/50 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Delivery Failed
          </span>
        );
      default:
        return <span className="text-xs text-zinc-500">{status}</span>;
    }
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Interactive Quick-Filter KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Invitations */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("ALL");
            setRoleFilter("ALL");
            setDateFilter("ALL");
            setSearch("");
            setPage(1);
            syncUrl("", "ALL", "ALL", "ALL", 1, pageSize);
            startTransition(() => {
              fetchInvitations(1, "", "ALL", "ALL", "ALL", pageSize);
            });
          }}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === "ALL" && roleFilter === "ALL" && dateFilter === "ALL" && !search
              ? "border-[var(--accent)] bg-[var(--surface-secondary)] ring-2 ring-[var(--accent)]/20 shadow-xs"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sent</span>
            <span className="p-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)]">
              <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground mt-2">
            {stats.total}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
            All historical invitation records
          </span>
        </button>

        {/* Card 2: Pending Setup */}
        <button
          type="button"
          onClick={() => {
            const next = statusFilter === "PENDING" ? "ALL" : "PENDING";
            handleStatusFilterChange(next);
          }}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === "PENDING"
              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-amber-500/20 shadow-xs"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-amber-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground mt-2">
            {stats.pending}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Awaiting password completion
          </span>
        </button>

        {/* Card 3: Accepted Accounts */}
        <button
          type="button"
          onClick={() => {
            const next = statusFilter === "ACCEPTED" ? "ALL" : "ACCEPTED";
            handleStatusFilterChange(next);
          }}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === "ACCEPTED"
              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 shadow-xs"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-emerald-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Accepted</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground mt-2">
            {stats.accepted}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Activated into admin team
          </span>
        </button>

        {/* Card 4: Expired / Revoked */}
        <button
          type="button"
          onClick={() => {
            const next = statusFilter === "EXPIRED" ? "ALL" : "EXPIRED";
            handleStatusFilterChange(next);
          }}
          className={`flex flex-col text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === "EXPIRED" || statusFilter === "REVOKED"
              ? "border-zinc-500 bg-zinc-50/50 dark:bg-zinc-900/20 ring-2 ring-zinc-500/20 shadow-xs"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-zinc-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Expired / Revoked</span>
            <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <svg className="w-4 h-4 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground mt-2">
            {stats.expiredRevoked}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Tokens invalidated or timed out
          </span>
        </button>
      </div>

      {/* Control Bar: Search, Filters, CSV Export, Invite Admin */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search with clear button */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by email, name, inviter…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
            />
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
            className="px-3.5 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--surface)] text-muted-foreground outline-none shadow-2xs cursor-pointer"
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
            onChange={(e) => handleRoleFilterChange(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--surface)] text-muted-foreground outline-none shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.slug}>{r.name}</option>
            ))}
          </select>

          {/* Date Range Filter */}
          <select
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--surface)] text-muted-foreground outline-none shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Time</option>
            <option value="LAST_24_HOURS">Last 24 Hours</option>
            <option value="LAST_7_DAYS">Last 7 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
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

        {/* Right action group: Export CSV + Invite Admin */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={invitations.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Export invitations to CSV"
          >
            <svg className="h-3.5 w-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] font-semibold text-xs rounded-full shadow-2xs transition-all shrink-0 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Invite Admin</span>
          </button>
        </div>
      </div>

      {/* Desktop Invitations Data Table */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-muted-foreground">
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
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p>No admin invitations found matching your criteria.</p>
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
                invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-muted-foreground">
                        {inv.name || "—"}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] font-mono">
                        {inv.email}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[var(--surface-secondary)] text-muted-foreground text-[11px] font-semibold border border-[var(--border-subtle)]">
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
                          className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-2.5 py-1 text-[11px] font-semibold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
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
                          className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 px-2.5 py-1 text-[11px] font-semibold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
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
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all shadow-2xs cursor-pointer"
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
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted-foreground)]">
            <p>No admin invitations found matching your criteria.</p>
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
          invitations.map((inv) => (
            <div
              key={inv.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-xs text-muted-foreground">{inv.name || "Administrator"}</h3>
                  <p className="text-xs text-[var(--muted-foreground)] font-mono">{inv.email}</p>
                </div>
                {getStatusBadge(inv.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[var(--border-subtle)]">
                <div>
                  <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Role</span>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-[var(--surface-secondary)] text-muted-foreground text-[10px] font-semibold border border-[var(--border-subtle)]">
                    {inv.adminRoleName || inv.role}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Invited By</span>
                  <span className="text-muted-foreground truncate block">{inv.invitedByName || inv.invitedByEmail || "System"}</span>
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
                    className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
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
                    className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
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
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all shadow-2xs cursor-pointer"
                >
                  Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <AdminPagination
        currentPage={page}
        totalPages={Math.ceil(total / pageSize) || 1}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        itemLabel="invitations"
        pageSizeOptions={[10, 25, 50]}
      />

      {/* Invite Admin Modal */}
      {showInviteModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] text-muted-foreground border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-muted-foreground">
                Invite New Administrator
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[var(--muted-foreground)] hover:text-muted-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mb-5">
              The invited administrator will receive an email containing a secure link to create their own confidential password. No password is set by you.
            </p>

            <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-muted-foreground placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="jane.doe@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-muted-foreground placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Assigned Admin Role
                </label>
                <select
                  value={inviteRoleSlug}
                  onChange={(e) => setInviteRoleSlug(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-muted-foreground outline-none focus:border-[var(--accent)] cursor-pointer"
                >
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.slug}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Invitation Note / Message (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Welcome to the team! Please set up your admin profile."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-muted-foreground placeholder-[var(--muted-foreground)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {pending ? "Sending Invitation…" : "Send Invitation Email"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Invitation Details Drawer/Modal */}
      {selectedDetails && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] text-muted-foreground border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-lg font-semibold text-muted-foreground">
                  Invitation Details
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] font-mono">{selectedDetails.id}</p>
              </div>
              <button
                onClick={() => setSelectedDetails(null)}
                className="text-[var(--muted-foreground)] hover:text-muted-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Invited Name</span>
                <span className="col-span-2 font-medium text-muted-foreground">{selectedDetails.name || "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Email</span>
                <span className="col-span-2 font-mono text-muted-foreground">{selectedDetails.email}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-[var(--muted-foreground)]">Assigned Role</span>
                <span className="col-span-2 font-medium text-muted-foreground">{selectedDetails.adminRoleName || selectedDetails.role}</span>
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
                  <span className="col-span-2 italic text-muted-foreground bg-[var(--surface-secondary)] p-2.5 rounded-lg border border-[var(--border-subtle)]">{selectedDetails.message}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">🔒 Token is cryptographically hashed</span>
              <button
                type="button"
                onClick={() => setSelectedDetails(null)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all shadow-2xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Revoke Invitation Confirmation Modal */}
      {revokeConfirmInv && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-muted-foreground">
                  Revoke Administrator Invitation
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Invalidate pending invitation token
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mb-5 leading-relaxed">
              Are you sure you want to revoke the invitation for{" "}
              <strong className="text-muted-foreground">{revokeConfirmInv.email}</strong>?
              The invitation link will become permanently invalid and cannot be used to set up an administrator account.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeConfirmInv(null)}
                disabled={pending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRevokeInvitation}
                disabled={pending}
                className="rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {pending && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>{pending ? "Revoking..." : "Revoke Invitation"}</span>
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
