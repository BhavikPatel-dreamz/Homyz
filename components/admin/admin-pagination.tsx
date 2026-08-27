"use client";

import React from "react";

export interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
}

export function AdminPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
  pageSizeOptions = [10, 25, 50],
}: AdminPaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted-foreground)] pt-3 pb-1 border-t border-[var(--border-subtle)]">
      {/* Left: Item Range & Page Size Selector */}
      <div className="flex items-center gap-3">
        <span>
          Showing <strong className="text-[var(--foreground)] font-semibold">{startItem}</strong> to{" "}
          <strong className="text-[var(--foreground)] font-semibold">{endItem}</strong> of{" "}
          <strong className="text-[var(--foreground)] font-semibold">{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="hidden sm:inline">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] px-2 py-1 text-xs outline-none cursor-pointer hover:border-[var(--accent)] transition-colors"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          aria-label="Previous page"
        >
          Previous
        </button>

        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            p === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-2 py-1 text-zinc-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold transition-all ${
                  currentPage === p
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-bold shadow-2xs"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        <span className="sm:hidden font-semibold text-[var(--foreground)] px-1">
          {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
