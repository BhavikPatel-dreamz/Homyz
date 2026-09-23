"use client";

import { useMemo, useState } from "react";
import { ReservationCard, ReservationCardData } from "./reservation-card";
import { FilterBar, FilterOptions } from "./filter-bar";
import { LoadingSkeleton } from "./loading-skeleton";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";

export function ReservationDashboard({
  initialReservations = [],
  initialTab = "today",
  onTabChange,
}: {
  initialReservations?: ReservationCardData[];
  initialTab?: FilterOptions["tab"];
  onTabChange?: (tab: FilterOptions["tab"]) => void;
}) {
  const [filters, setFilters] = useState<FilterOptions>({
    tab: initialTab,
    search: "",
    status: "ALL",
    dateRange: "ALL",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const combinedData = useMemo(() => initialReservations, [initialReservations]);

  const filteredItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return combinedData.filter((item) => {
      const status = item.status || "PENDING";
      // Tab Filter
      if (filters.tab === "today") {
        if (status === "CANCELLED" || !item.isToday) return false;
      }
      if (filters.tab === "upcoming") {
        const start = new Date(item.startDate);
        if (status === "CANCELLED" || (start < today && !item.isToday)) return false;
      }
      if (filters.tab === "past") {
        const end = new Date(item.endDate);
        if (end >= today || status === "CANCELLED") return false;
      }

      // Status Filter
      if (filters.status !== "ALL" && item.status !== filters.status) {
        return false;
      }

      // Search Filter
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const prop = (item.propertyName || "").toLowerCase();
        const loc = (item.location || "").toLowerCase();
        const guest = (item.guestName || "").toLowerCase();
        if (!prop.includes(q) && !loc.includes(q) && !guest.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((left, right) => {
      if (filters.tab === "past") return new Date(right.endDate).getTime() - new Date(left.endDate).getTime();
      return new Date(left.startDate).getTime() - new Date(right.startDate).getTime();
    });
  }, [combinedData, filters]);

  const pastYearGroups = useMemo(() => {
    if (filters.tab !== "past") return [];
    const groups = new Map<number, ReservationCardData[]>();
    const sorted = [...filteredItems].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );
    for (const item of sorted) {
      const year = new Date(item.startDate).getUTCFullYear();
      const group = groups.get(year) ?? [];
      group.push(item);
      groups.set(year, group);
    }
    return Array.from(groups, ([year, items]) => ({ year, items }));
  }, [filteredItems, filters.tab]);

  const handleFilterChange = (updated: Partial<FilterOptions>) => {
    setLoading(true);
    setFilters((prev) => ({ ...prev, ...updated }));
    if (updated.tab && onTabChange) {
      onTabChange(updated.tab);
    }
    setTimeout(() => setLoading(false), 200);
  };

  return (
    <div className="flex flex-col gap-8 sm:pb-12 pb-5">
      {/* Header & Filter Controls matching Screenshots */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        totalCount={filteredItems.length}
      />

      {/* Main Reservation Cards Grid matching Reference Screenshots */}
      {error ? (
        <ErrorState message={error} onRetry={() => setError(null)} />
      ) : loading ? (
        <LoadingSkeleton count={4} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={`No ${filters.tab} reservations`}
          description="Try adjusting your search criteria or switching filter tabs."
        />
      ) : filters.tab === "past" ? (
        <div className="flex flex-col gap-14 sm:gap-16">
          {pastYearGroups.map(({ year, items }) => (
            <section key={year} aria-labelledby={`bookings-year-${year}`}>
              <h2 id={`bookings-year-${year}`} className="text-xl font-semibold leading-7 text-[#1F1F1F] mb-5 sm:text-2xl">
                {year}
              </h2>
              <div className="grid grid-cols-1 items-start gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                  <ReservationCard key={item.id} data={item} href={`/bookings/${item.id}`} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => (
            <ReservationCard key={item.id} data={item} href={`/bookings/${item.id}`} />
          ))}
        </div>
      )}

    </div>
  );
}
