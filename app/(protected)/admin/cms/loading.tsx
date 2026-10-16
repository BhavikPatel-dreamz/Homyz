import React from "react";

export default function AdminCmsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading CMS content" className="space-y-6 font-sans">
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-5">
        <div className="h-7 w-64 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
      </div>

      {/* Top Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="h-10 w-full sm:w-64 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-10 w-36 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-10 w-32 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
      </div>

      {/* Content Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Content Item</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Revisions</th>
                <th className="px-5 py-3.5">Last Updated</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4">
                    <div className="h-4 w-44 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    <div className="mt-1.5 h-3 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="h-7 w-12 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                      <div className="h-7 w-16 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-18 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-7 w-14 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
