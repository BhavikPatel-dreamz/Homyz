"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Summary = {
  counts: Record<string, number>;
  distribution: { targetType: string; count: number }[];
  workload: { assignedModeratorId: string | null; moderator: { id: string; name: string | null; email: string | null } | null; count: number }[];
  recentActivity: { id: string; action: string; createdAt: string | Date; actor: { name: string | null; email: string | null } | null; case: { id: string; caseReference: string } }[];
};

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
function formatDate(value: string | Date) { return dateFormat.format(new Date(value)); }

const kpis = [
  ["totalCases", "Total cases", ""], ["newCases", "New cases", "NEW"],
  ["inReviewCases", "In review", "IN_REVIEW"], ["needsInformationCases", "Needs information", "NEEDS_INFORMATION"],
  ["highPriorityOpenCases", "High-priority open", "attention=1"], ["resolvedCases", "Resolved", "RESOLVED"],
  ["dismissedCases", "Dismissed", "DISMISSED"], ["unassignedOpenCases", "Unassigned open", "assigned=unassigned"],
] as const;

export function AdminModerationDashboardClient({ initialSummary, initialFilters }: { initialSummary: Summary; initialFilters: { startDate?: string; endDate?: string } }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(initialFilters.startDate ?? "");
  const [endDate, setEndDate] = useState(initialFilters.endDate ?? "");
  const dateQuery = new URLSearchParams();
  if (startDate) dateQuery.set("startDate", startDate);
  if (endDate) dateQuery.set("endDate", endDate);
  const appendQuery = (filter: string) => {
    const params = new URLSearchParams(dateQuery);
    if (filter.includes("=")) { const [key, value] = filter.split("="); params.set(key, value); }
    else if (filter) params.set("status", filter);
    return params.toString();
  };
  const urgent = initialSummary.workload.filter((entry) => !entry.assignedModeratorId).reduce((total, entry) => total + entry.count, 0);

  return <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm text-slate-500">Support &amp; Operations / Moderation</p>
        <h1 className="mt-1">Moderation overview</h1>
        <p className="mt-1 text-sm text-[#727272]">Track content reports and investigation workload. Decisions here do not enforce content changes.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/moderation/cases" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
          Cases Queue
        </Link>
        <Link href="/admin/moderation/reviews" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm">
          Review Moderation
        </Link>
        <Link href="/admin/moderation/reported-listings" className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm">
          Reported Listings
        </Link>
        <Link href="/admin/moderation/media" className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 shadow-sm">
          Media Moderation
        </Link>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); router.replace(`/admin/moderation?${dateQuery}`); }}>
          <label className="text-sm text-slate-600">From <input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="ml-1 rounded-md border border-slate-300 px-2 py-1.5" /></label>
          <label className="text-sm text-slate-600">To <input aria-label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="ml-1 rounded-md border border-slate-300 px-2 py-1.5" /></label>
          <button className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Apply</button>
        </form>
      </div>
    </div>

    <section aria-label="Moderation case counts" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {kpis.map(([key, label, filter]) => <Link key={key} href={`/admin/moderation/cases?${appendQuery(filter)}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{initialSummary.counts[key] ?? 0}</p>
      </Link>)}
    </section>

    <section className="grid gap-5 xl:grid-cols-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 xl:col-span-1">
        <h2 className="font-semibold text-slate-900">Urgent attention</h2>
        <p className="mt-1 text-sm text-slate-600">High severity or prioritized open investigations, plus cases that need assignment.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href={`/admin/moderation/cases?${appendQuery("attention=1")}`} className="rounded-lg bg-white p-3 text-sm shadow-sm"><span className="block text-xl font-semibold">{initialSummary.counts.highPriorityOpenCases ?? 0}</span>High-priority open</Link>
          <Link href={`/admin/moderation/cases?${appendQuery("assigned=unassigned")}`} className="rounded-lg bg-white p-3 text-sm shadow-sm"><span className="block text-xl font-semibold">{urgent}</span>Awaiting assignment</Link>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-1">
        <h2 className="font-semibold text-slate-900">Case distribution</h2>
        <div className="mt-4 space-y-3">{initialSummary.distribution.length ? initialSummary.distribution.map((entry) => <Link key={entry.targetType} href={`/admin/moderation/cases?${appendQuery(`targetType=${entry.targetType}`)}`} className="flex items-center justify-between text-sm hover:underline"><span>{entry.targetType.replaceAll("_", " ")}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{entry.count}</span></Link>) : <p className="text-sm text-slate-500">No cases in this date range.</p>}</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-1">
        <h2 className="font-semibold text-slate-900">Moderator workload</h2>
        <div className="mt-4 space-y-3">{initialSummary.workload.length ? initialSummary.workload.map((entry) => <Link key={entry.assignedModeratorId ?? "unassigned"} href={`/admin/moderation/cases?${appendQuery(entry.assignedModeratorId ? `assignedModeratorId=${entry.assignedModeratorId}` : "assigned=unassigned")}`} className="flex items-center justify-between text-sm hover:underline"><span>{entry.moderator?.name || entry.moderator?.email || "Unassigned"}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{entry.count} open</span></Link>) : <p className="text-sm text-slate-500">No open workload.</p>}</div>
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Recent moderation activity</h2><Link href="/admin/moderation/cases" className="text-sm font-medium text-indigo-700 hover:underline">Open queue</Link></div>
      <ol className="mt-4 divide-y divide-slate-100">{initialSummary.recentActivity.length ? initialSummary.recentActivity.map((activity) => <li key={activity.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between"><span><Link className="font-medium text-indigo-700 hover:underline" href={`/admin/moderation/cases/${activity.case.id}`}>{activity.case.caseReference}</Link> · {activity.action.replaceAll("_", " ")}<span className="text-slate-500"> by {activity.actor?.name || activity.actor?.email || "system"}</span></span><time className="text-slate-500">{formatDate(activity.createdAt)}</time></li>) : <li className="py-6 text-sm text-slate-500">No moderation activity in this date range.</li>}</ol>
    </section>
  </main>;
}
