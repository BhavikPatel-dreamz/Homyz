import React from "react";

/**
 * Dedicated skeleton loader for the Admin Manage Listing detail page (/admin/listings/[id]).
 * Adheres to the exact layout contract of the admin listing editor:
 * 2-column split with admin navigation sidebar on the left and section editor panel on the right.
 */
export function AdminManageListingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading listing details"
      className="admin-listing-editor flex min-h-[calc(100vh-6.5rem)] min-w-0 flex-col font-sans max-w-full"
    >
      <div className="flex-1 grid grid-cols-1 gap-6 sm:py-6 py-4 lg:py-0 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 xl:gap-8 lg:h-[calc(100vh-6.5rem)] lg:overflow-hidden">
        
        {/* LEFT COLUMN: Admin Navigation Sidebar */}
        <aside className="admin-editor-sidebar rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs flex flex-col order-first lg:order-1 lg:h-full lg:max-h-full">
          {/* Header section with back button & status pill */}
          <div className="border-b border-[var(--border-subtle)] pb-3 pt-1 px-1 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="h-7 w-20 rounded-xl bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
              <div className="h-5 w-16 rounded-full bg-amber-500/20 skeleton-shimmer" />
            </div>

            <div className="pt-0.5 space-y-1.5">
              <div className="h-3 w-28 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
              <div className="h-4 w-44 rounded-md bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
            </div>
          </div>

          {/* Grouped section list */}
          <div className="mt-3 flex-1 min-h-0 space-y-3.5 overflow-hidden">
            {[
              { titleWidth: "w-24", count: 2 },
              { titleWidth: "w-28", count: 6 },
              { titleWidth: "w-24", count: 4 },
              { titleWidth: "w-20", count: 3 },
            ].map((group, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <div className="flex items-center justify-between px-2.5 pt-1 pb-1">
                  <div className={`h-2.5 ${group.titleWidth} rounded bg-zinc-200/70 dark:bg-zinc-700/70 skeleton-shimmer`} />
                  <div className="h-2.5 w-4 rounded bg-zinc-200/50 dark:bg-zinc-700/50 skeleton-shimmer" />
                </div>
                {Array.from({ length: group.count }).map((_, iIdx) => (
                  <div
                    key={iIdx}
                    className="flex h-8 items-center justify-between rounded-xl px-3 bg-zinc-100/80 dark:bg-zinc-800/60 skeleton-shimmer"
                  >
                    <div className="h-3 w-28 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
                    <div className="h-3 w-3 rounded bg-zinc-200/60 dark:bg-zinc-700/60 skeleton-shimmer" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* RIGHT COLUMN: Section Editor Content Panel */}
        <main className="admin-editor-content flex min-w-0 flex-col space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 lg:p-8 shadow-2xs order-2 lg:h-full lg:max-h-full lg:overflow-y-auto custom-scrollbar">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
              <div className="space-y-1.5">
                <div className="h-6 w-52 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
                <div className="h-3.5 w-72 rounded bg-zinc-200/60 dark:bg-zinc-700/60 skeleton-shimmer" />
              </div>
            </div>
            <div className="h-9 w-24 rounded-full bg-amber-500/30 skeleton-shimmer" />
          </div>

          {/* Section Form Fields (Cards / Inputs) */}
          <div className="space-y-5 pt-2 max-w-2xl">
            {/* Input Field 1 */}
            <div className="space-y-2">
              <div className="h-4 w-36 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
              <div className="h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 skeleton-shimmer" />
            </div>

            {/* Input Field 2 */}
            <div className="space-y-2">
              <div className="h-4 w-44 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
              <div className="h-24 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 skeleton-shimmer" />
            </div>

            {/* Grid of Option Cards */}
            <div className="space-y-2 pt-2">
              <div className="h-4 w-32 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3.5"
                  >
                    <div className="size-8 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3.5 w-24 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
                      <div className="h-2.5 w-32 rounded bg-zinc-200/60 dark:bg-zinc-700/60 skeleton-shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
              <div className="h-9 w-20 rounded-full bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
              <div className="h-9 w-28 rounded-full bg-amber-500/40 skeleton-shimmer" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
