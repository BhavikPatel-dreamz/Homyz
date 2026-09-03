"use client";

import React from "react";

export interface FilterOptions {
  tab: "today" | "upcoming" | "past" | "all";
  search: string;
  status: string;
  dateRange: string;
}

export function FilterBar({
  filters,
  onChange,
  totalCount,
}: {
  filters: FilterOptions;
  onChange: (updated: Partial<FilterOptions>) => void;
  totalCount: number;
}) {
  const tabs: { id: FilterOptions["tab"]; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "upcoming", label: "Upcoming" },
    { id: "past", label: "Past" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Title & View Filters Row matching Screenshots */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1>
            You have {totalCount} {filters.tab === "upcoming" ? "upcoming " : ""}reservations
          </h1>
          <p className="text-base text-muted-foreground mt-4 font-normal">
            Manage check-ins, guest stays, and property reservations.
          </p>
        </div>

        {/* View Filter Pill Tabs (Today, Upcoming, etc.) */}
        <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] p-1 w-fit shadow-2xs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange({ tab: t.id })}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                filters.tab === t.id
                ? "bg-[var(--primary)] text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Extended Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by property, guest name, or location..."
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] pl-10 pr-4 py-2 text-xs font-medium text-muted-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--muted-foreground)] transition-colors"
          />
        </div>

        {/* Status Dropdown */}
        <div className="relative w-full sm:w-auto">
          <select
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
            className="w-full sm:w-auto appearance-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] pl-4 pr-9 py-2 text-xs font-semibold text-muted-foreground outline-none focus:border-[var(--muted-foreground)] transition-colors cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <svg
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 stroke-[#1D1D1D] dark:stroke-muted-foreground"
            width="12"
            height="7"
            viewBox="0 0 16 9"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 1L8 8L1 1"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
