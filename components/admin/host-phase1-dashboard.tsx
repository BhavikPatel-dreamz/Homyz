"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { UnifiedHostAnalytics, UnifiedHostItem } from "@/services/admin.service";

export interface HostPhase1DashboardProps {
  analytics: UnifiedHostAnalytics;
  initialHosts: UnifiedHostItem[];
}

export type StatusTabKey =
  | "ALL"
  | "REGISTRATIONS"
  | "PENDING_REVIEW"
  | "DOCUMENTS_PENDING"
  | "COMPLIANCE_PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

const VALID_TABS: StatusTabKey[] = [
  "ALL",
  "REGISTRATIONS",
  "PENDING_REVIEW",
  "DOCUMENTS_PENDING",
  "COMPLIANCE_PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
];

export function HostPhase1Dashboard({
  analytics,
  initialHosts,
}: HostPhase1DashboardProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = (searchParams.get("tab") || "").toUpperCase() as StatusTabKey;
  const activeTab: StatusTabKey = VALID_TABS.includes(tabParam) ? tabParam : "ALL";

  const [search, setSearch] = useState("");
  const [accountStatusFilter, setAccountStatusFilter] = useState("ALL");
  const [appStatusFilter, setAppStatusFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [verifFilter, setVerifFilter] = useState("ALL");
  const [complianceFilter, setComplianceFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "listingsCount">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  function getTabHref(tabKey: StatusTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabKey === "ALL") {
      params.delete("tab");
    } else {
      params.set("tab", tabKey);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  // Compute count for each primary filter tab
  const tabCounts = useMemo(() => {
    let all = initialHosts.length;
    let registrations = 0;
    let pendingReview = 0;
    let docsPending = 0;
    let compliancePending = 0;
    let approved = 0;
    let rejected = 0;
    let suspended = 0;

    initialHosts.forEach((host) => {
      const appStat = (host.applicationStatus || "").toUpperCase();
      const accStat = (host.accountStatus || "").toUpperCase();
      const stage = (host.onboardingStage || "").toUpperCase();
      const verif = (host.verificationStatus || "").toUpperCase();
      const comp = (host.complianceStatus || "").toUpperCase();

      if (appStat === "PENDING" || appStat === "SUBMITTED" || stage.includes("REGISTRATION")) {
        registrations++;
      }
      if (appStat === "IN_REVIEW" || appStat === "PENDING" || stage.includes("REVIEW")) {
        pendingReview++;
      }
      if (verif === "PENDING" || appStat === "WAITING_FOR_DOCUMENTS" || stage.includes("DOC")) {
        docsPending++;
      }
      if (comp === "PENDING" || comp === "UNDER_REVIEW" || stage.includes("COMPLIANCE")) {
        compliancePending++;
      }
      if (accStat === "ACTIVE" || appStat === "APPROVED") {
        approved++;
      }
      if (accStat === "REJECTED" || appStat === "REJECTED") {
        rejected++;
      }
      if (accStat === "SUSPENDED") {
        suspended++;
      }
    });

    return {
      ALL: all,
      REGISTRATIONS: registrations,
      PENDING_REVIEW: pendingReview,
      DOCUMENTS_PENDING: docsPending,
      COMPLIANCE_PENDING: compliancePending,
      APPROVED: approved,
      REJECTED: rejected,
      SUSPENDED: suspended,
    };
  }, [initialHosts]);

  // Main host filtering logic combining status tab + search + explicit dropdowns
  const filteredHosts = useMemo(() => {
    return initialHosts
      .filter((host) => {
        const appStat = (host.applicationStatus || "").toUpperCase();
        const accStat = (host.accountStatus || "").toUpperCase();
        const stage = (host.onboardingStage || "").toUpperCase();
        const verif = (host.verificationStatus || "").toUpperCase();
        const comp = (host.complianceStatus || "").toUpperCase();

        // 1. Filter by top status tab
        if (activeTab === "REGISTRATIONS") {
          if (appStat !== "PENDING" && appStat !== "SUBMITTED" && !stage.includes("REGISTRATION")) return false;
        } else if (activeTab === "PENDING_REVIEW") {
          if (appStat !== "IN_REVIEW" && appStat !== "PENDING" && !stage.includes("REVIEW")) return false;
        } else if (activeTab === "DOCUMENTS_PENDING") {
          if (verif !== "PENDING" && appStat !== "WAITING_FOR_DOCUMENTS" && !stage.includes("DOC")) return false;
        } else if (activeTab === "COMPLIANCE_PENDING") {
          if (comp !== "PENDING" && comp !== "UNDER_REVIEW" && !stage.includes("COMPLIANCE")) return false;
        } else if (activeTab === "APPROVED") {
          if (accStat !== "ACTIVE" && appStat !== "APPROVED") return false;
        } else if (activeTab === "REJECTED") {
          if (accStat !== "REJECTED" && appStat !== "REJECTED") return false;
        } else if (activeTab === "SUSPENDED") {
          if (accStat !== "SUSPENDED") return false;
        }

        // 2. Search query filter
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchName = host.name?.toLowerCase().includes(q);
          const matchEmail = host.email?.toLowerCase().includes(q);
          const matchPhone = host.phone?.toLowerCase().includes(q);
          const matchId = host.id.toLowerCase().includes(q);
          const matchAppId = host.applicationId?.toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchPhone && !matchId && !matchAppId) return false;
        }

        // 3. Dropdown secondary filters
        if (accountStatusFilter !== "ALL" && host.accountStatus !== accountStatusFilter) return false;
        if (appStatusFilter !== "ALL" && host.applicationStatus !== appStatusFilter) return false;
        if (stageFilter !== "ALL" && host.onboardingStage !== stageFilter) return false;
        if (verifFilter !== "ALL" && host.verificationStatus !== verifFilter) return false;
        if (complianceFilter !== "ALL" && host.complianceStatus !== complianceFilter) return false;

        return true;
      })
      .sort((a, b) => {
        let valA: string | number | Date = a[sortBy] ?? 0;
        let valB: string | number | Date = b[sortBy] ?? 0;

        if (sortBy === "createdAt") {
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
        } else if (sortBy === "name") {
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [
    initialHosts,
    activeTab,
    search,
    accountStatusFilter,
    appStatusFilter,
    stageFilter,
    verifFilter,
    complianceFilter,
    sortBy,
    sortOrder,
  ]);

  const totalPages = Math.ceil(filteredHosts.length / pageSize) || 1;
  const paginatedHosts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHosts.slice(start, start + pageSize);
  }, [filteredHosts, currentPage, pageSize]);

  const tabButtons: { key: StatusTabKey; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "REGISTRATIONS", label: "Registrations" },
    { key: "PENDING_REVIEW", label: "Pending Review" },
    { key: "DOCUMENTS_PENDING", label: "Documents Pending" },
    { key: "COMPLIANCE_PENDING", label: "Compliance Pending" },
    { key: "APPROVED", label: "Approved" },
    { key: "REJECTED", label: "Rejected" },
    { key: "SUSPENDED", label: "Suspended" },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          Host Management
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Single unified module for all host applications, onboarding workflows, compliance checks, and active hosts.
        </p>
      </div>

      {/* Top Filter Buttons Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[var(--border-subtle)] scrollbar-none">
        {tabButtons.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tabCounts[tab.key];
          return (
            <Link
              key={tab.key}
              href={getTabHref(tab.key)}
              onClick={() => setCurrentPage(1)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? "bg-[#291E05] text-[#FBDE9B] dark:bg-[#f59e0b] dark:text-zinc-950 shadow-2xs"
                  : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border-subtle)]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                  isActive
                    ? "bg-[#FBDE9B]/20 text-[#FBDE9B] dark:bg-zinc-900/40 dark:text-zinc-950"
                    : "bg-[var(--surface)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Controls Bar: Search & Advanced Filter Dropdowns */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search host by name, email, phone, host ID, application ID..."
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-4 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
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
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)] font-semibold">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none shadow-2xs font-medium"
            >
              <option value="createdAt">Joined Date</option>
              <option value="name">Host Name</option>
              <option value="listingsCount">Listings Count</option>
            </select>

            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors shadow-2xs"
            >
              {sortOrder === "asc" ? "↑ ASC" : "↓ DESC"}
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <select
            value={accountStatusFilter}
            onChange={(e) => {
              setAccountStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">Account Status (All)</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>

          <select
            value={appStatusFilter}
            onChange={(e) => {
              setAppStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">App Status (All)</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">Onboarding Stage (All)</option>
            <option value="REGISTRATION_SUBMITTED">Registration</option>
            <option value="APPLICATION_REVIEW">Application Review</option>
            <option value="DOCUMENT_VERIFICATION">Documents</option>
            <option value="COMPLIANCE_REVIEW">Compliance</option>
            <option value="READY_FOR_APPROVAL">Ready for Approval</option>
            <option value="ONBOARDING_COMPLETE">Complete</option>
          </select>

          <select
            value={verifFilter}
            onChange={(e) => {
              setVerifFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">Verification (All)</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={complianceFilter}
            onChange={(e) => {
              setComplianceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">Compliance (All)</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLIANT">Compliant</option>
            <option value="ACTION_REQUIRED">Action Required</option>
            <option value="NON_COMPLIANT">Non-Compliant</option>
          </select>
        </div>
      </div>

      {/* Unified Host Table View */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Host</th>
              <th className="py-3.5 px-4">Account Status</th>
              <th className="py-3.5 px-4">Application Status</th>
              <th className="py-3.5 px-4">Onboarding Stage</th>
              <th className="py-3.5 px-4">Compliance Status</th>
              <th className="py-3.5 px-4 text-center">Listings</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {paginatedHosts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                  No hosts found in this view.
                </td>
              </tr>
            ) : (
              paginatedHosts.map((host) => (
                <tr key={host.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                  {/* Host Name & Email */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                        {(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[var(--foreground)] line-clamp-1">
                          {host.name || "Unnamed Host / Applicant"}
                        </div>
                        <div className="text-[11px] text-[var(--muted-foreground)] font-mono">
                          {host.email || "No email"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Account Status */}
                  <td className="py-3.5 px-4">
                    {host.accountStatus === "ACTIVE" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs">
                        Active
                      </span>
                    ) : host.accountStatus === "SUSPENDED" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60 shadow-2xs">
                        Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60 shadow-2xs">
                        {host.accountStatus || "Pending"}
                      </span>
                    )}
                  </td>

                  {/* Application Status */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                      {host.applicationStatus || "N/A"}
                    </span>
                  </td>

                  {/* Onboarding Stage */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60">
                      {host.onboardingStageLabel}
                    </span>
                  </td>

                  {/* Compliance Status */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        host.complianceStatus === "COMPLIANT"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : host.complianceStatus === "ACTION_REQUIRED"
                          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                          : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {host.complianceStatus}
                    </span>
                  </td>

                  {/* Listings Count */}
                  <td className="py-3.5 px-4 text-center font-bold text-[var(--foreground)]">
                    {host.listingsCount}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <a
                      href={`/admin/hosts/${host.id}`}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-1.5 text-xs text-[var(--foreground)] font-bold transition-all inline-block shadow-2xs"
                    >
                      View Details
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden flex flex-col gap-3">
        {paginatedHosts.map((host) => (
          <div key={host.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold flex items-center justify-center text-xs">
                  {(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-[var(--foreground)] text-xs">{host.name || "Unnamed Host"}</h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] font-mono">{host.email}</p>
                </div>
              </div>
              <a
                href={`/admin/hosts/${host.id}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--foreground)]"
              >
                Details
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--border-subtle)]">
              <div>
                <span className="text-[var(--muted-foreground)]">Account:</span> <span className="font-bold text-[var(--foreground)]">{host.accountStatus}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Stage:</span> <span className="font-bold text-sky-600">{host.onboardingStageLabel}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Compliance:</span> <span className="font-bold">{host.complianceStatus}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Listings:</span> <span className="font-bold">{host.listingsCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted-foreground)] pt-2">
        <div>
          Showing {filteredHosts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
          {Math.min(currentPage * pageSize, filteredHosts.length)} of {filteredHosts.length} hosts
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          >
            Previous
          </button>
          <span className="font-bold text-[var(--foreground)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
