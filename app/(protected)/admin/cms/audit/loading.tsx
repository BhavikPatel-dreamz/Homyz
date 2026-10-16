import React from "react";

export default function AdminCmsAuditLoading() {
  return (
    <div aria-busy="true" aria-label="Loading CMS audit history" className="space-y-6 font-sans">
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-5">
        <div className="h-7 w-56 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="mt-2 h-4 w-[500px] max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
      </div>

      {/* Sub-bar */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
      </div>

      {/* Audit Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Resource</th>
                <th className="px-5 py-3.5">Actor</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4">
                    <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-56 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-7 w-16 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
