"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPagination } from "@/components/admin/admin-pagination";

type ModerationCase = {
  id: string; caseReference: string; targetType: string; targetId: string; category: string; status: string; severity: string; priority: number;
  assignedModerator: { id: string; name: string | null; email: string | null } | null; createdAt: string | Date; updatedAt: string | Date;
  _count: { reports: number; evidence: number }; reports: { reasonCode: string; relatedBookingId: string | null }[];
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type Filters = Record<string, string | undefined>;
const tabs = ["ALL", "NEW", "IN_REVIEW", "NEEDS_INFORMATION", "RESOLVED", "DISMISSED", "REOPENED"] as const;
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
function formatDate(value: string | Date) { return dateFormat.format(new Date(value)); }
function badgeClass(value: string) { return value === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : value === "DISMISSED" ? "bg-slate-200 text-slate-700" : value === "CRITICAL" ? "bg-red-100 text-red-800" : value === "HIGH" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"; }

export function AdminModerationCasesClient({ initialCases, initialPagination, initialFilters, initialModerators }: { initialCases: ModerationCase[]; initialPagination: Pagination; initialFilters: Filters; initialModerators: { id: string; name: string | null; email: string | null }[] }) {
  const router = useRouter(); const pathname = usePathname();
  const [items, setItems] = useState(initialCases); const [pagination, setPagination] = useState(initialPagination);
  const [filters, setFilters] = useState<Filters>(initialFilters); const [searchInput, setSearchInput] = useState(initialFilters.search ?? "");
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const initial = useRef(true); const abortRef = useRef<AbortController | null>(null);
  const activeStatus = filters.status ?? "ALL";
  const updateFilters = (updates: Filters) => setFilters((current) => ({ ...current, ...updates, page: "1" }));
  const buildParams = useCallback((page?: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value && key !== "page") params.set(key, value);
    params.set("page", String(page ?? (Number(filters.page) || 1))); params.set("limit", filters.limit || "20"); return params;
  }, [filters]);
  const load = useCallback(async (page = 1) => {
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller; const params = buildParams(page);
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/v1/admin/moderation/cases?${params}`, { signal: controller.signal }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Unable to load moderation cases.");
      if (!controller.signal.aborted) { setItems(payload.data || []); setPagination(payload.pagination); router.replace(`${pathname}?${params}`); }
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load moderation cases."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [buildParams, pathname, router]);
  useEffect(() => { const timer = window.setTimeout(() => { if (searchInput !== (filters.search ?? "")) updateFilters({ search: searchInput.trim() || undefined }); }, 350); return () => window.clearTimeout(timer); }, [searchInput, filters.search]);
  useEffect(() => { if (initial.current) { initial.current = false; return; } void load(1); }, [filters.status, filters.targetType, filters.severity, filters.category, filters.assigned, filters.startDate, filters.endDate, filters.updatedStartDate, filters.updatedEndDate, filters.sort, filters.limit, filters.search, load]);
  const clearFilters = () => { setSearchInput(""); setFilters({ limit: filters.limit || "20" }); };

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-500">Support &amp; Operations / Moderation</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Moderation cases</h1></div><Link href="/admin/moderation" className="text-sm font-medium text-indigo-700 hover:underline">View overview</Link></div>
    <nav aria-label="Case status" className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">{tabs.map((tab) => <button key={tab} onClick={() => updateFilters({ status: tab === "ALL" ? undefined : tab })} className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${activeStatus === tab ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{tab.replaceAll("_", " ")}</button>)}</nav>
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="xl:col-span-2"><span className="sr-only">Search moderation cases</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search case, report, listing, booking, user, reason" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
        <select aria-label="Content type" value={filters.targetType || ""} onChange={(event) => updateFilters({ targetType: event.target.value || undefined })} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All content</option>{["REVIEW", "LISTING", "LISTING_PHOTO", "PROFILE", "USER", "MESSAGE"].map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Severity" value={filters.severity || ""} onChange={(event) => updateFilters({ severity: event.target.value || undefined })} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All severity</option>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Assignment" value={filters.assigned || ""} onChange={(event) => updateFilters({ assigned: event.target.value || undefined })} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All assignments</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select>
        <select aria-label="Assigned moderator" value={filters.assignedModeratorId || ""} onChange={(event) => updateFilters({ assignedModeratorId: event.target.value || undefined, assigned: undefined })} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">Any moderator</option>{initialModerators.map((moderator) => <option key={moderator.id} value={moderator.id}>{moderator.name || moderator.email}</option>)}</select>
        <input aria-label="Category" value={filters.category || ""} onChange={(event) => updateFilters({ category: event.target.value || undefined })} placeholder="Exact category" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select aria-label="Sort cases" value={filters.sort || "newest"} onChange={(event) => updateFilters({ sort: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="updated">Recently updated</option><option value="priority">Highest priority</option><option value="severity">Highest severity</option><option value="reports">Most reported</option></select>
        <label className="text-xs text-slate-600">Created from<input type="date" value={filters.startDate || ""} onChange={(event) => updateFilters({ startDate: event.target.value || undefined })} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-slate-600">Created to<input type="date" value={filters.endDate || ""} onChange={(event) => updateFilters({ endDate: event.target.value || undefined })} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" /></label>
        <button type="button" onClick={clearFilters} className="self-end rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear filters</button>
      </div>
    </section>
    {error && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Case", "Content / reason", "Reports", "Severity", "Status", "Assigned", "Created", "Last activity", ""].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-3"><Link href={`/admin/moderation/cases/${item.id}`} className="font-semibold text-indigo-700 hover:underline">{item.caseReference}</Link><p className="mt-0.5 max-w-32 truncate text-xs text-slate-500">{item.targetId}</p></td><td className="px-4 py-3"><div className="flex items-center gap-2.5">{item.targetType === "LISTING_PHOTO" && <img src={item.targetId} alt="Reported photo thumbnail" className="size-8 rounded object-cover flex-shrink-0 border border-slate-200" />}<div><p className="font-medium">{item.targetType.replaceAll("_", " ")}</p><p className="max-w-48 truncate text-xs text-slate-500">{item.reports[0]?.reasonCode || item.category}</p></div></div></td><td className="px-4 py-3">{item._count.reports}<span className="text-xs text-slate-500"> reports</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(item.severity)}`}>{item.severity}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(item.status)}`}>{item.status.replaceAll("_", " ")}</span></td><td className="px-4 py-3 text-slate-600">{item.assignedModerator?.name || item.assignedModerator?.email || "Unassigned"}</td><td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(item.createdAt)}</td><td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(item.updatedAt)}</td><td className="px-4 py-3"><Link href={`/admin/moderation/cases/${item.id}`} className="font-medium text-indigo-700 hover:underline">View<span className="sr-only"> {item.caseReference}</span></Link></td></tr>)}{!items.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">{loading ? "Loading moderation cases…" : "No moderation cases match these filters."}</td></tr>}</tbody></table></div>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">{loading ? "Refreshing…" : `${pagination.total} case${pagination.total === 1 ? "" : "s"}`}</p><div className="flex items-center gap-3"><select aria-label="Cases per page" value={filters.limit || "20"} onChange={(event) => updateFilters({ limit: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm">{[10, 20, 50].map((size) => <option key={size}>{size}</option>)}</select><AdminPagination currentPage={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.total} pageSize={pagination.limit} itemLabel="cases" onPageChange={(page) => void load(page)} /></div></div>
    </section>
  </main>;
}
