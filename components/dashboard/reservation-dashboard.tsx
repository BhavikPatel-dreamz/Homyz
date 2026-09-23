"use client";

import { useMemo, useState, useEffect } from "react";
import { ReservationCard, ReservationCardData } from "./reservation-card";
import { FilterBar, FilterOptions } from "./filter-bar";
import { LoadingSkeleton } from "./loading-skeleton";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { toReservationCardData } from "@/lib/profile/reservation-data";
import { MyReviewsSection } from "@/components/profile/my-reviews-section";
import type { GuestAuthoredReviewDTO } from "@/lib/profile/profile-loader";

export function ReservationDashboard({
  initialReservations,
  initialTab = "today",
  reviews = [],
  onTabChange,
}: {
  initialReservations?: ReservationCardData[];
  initialTab?: FilterOptions["tab"];
  reviews?: GuestAuthoredReviewDTO[];
  onTabChange?: (tab: FilterOptions["tab"]) => void;
}) {
  const [reservations, setReservations] = useState<ReservationCardData[]>(initialReservations || []);
  const [filters, setFilters] = useState<FilterOptions>({
    tab: initialTab,
    search: "",
    status: "ALL",
    dateRange: "ALL",
  });
  const [loading, setLoading] = useState<boolean>(initialReservations === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialReservations !== undefined) {
      setReservations(initialReservations);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/v1/bookings?limit=50", {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Unable to load reservations. Please try again.");
        }
        return res.json();
      })
      .then((json) => {
        const rawItems = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.items)
            ? json.items
            : [];
        const mapped = rawItems.map((b: any) => toReservationCardData(b));
        setReservations(mapped);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load reservations");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [initialReservations]);

  const filteredItems = useMemo(() => {
    const now = new Date();
    const todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    return reservations.filter((item) => {
      const status = item.status || "PENDING";
      const startD = new Date(item.startDate);
      const endD = new Date(item.endDate);
      const endMidnight = Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth(), endD.getUTCDate());

      // Tab Filter:
      // "today": check-in is today, or currently staying today
      if (filters.tab === "today") {
        if (status === "CANCELLED" || !item.isToday) return false;
      }

      // "upcoming": active or future stay whose check-out date has not passed yet
      if (filters.tab === "upcoming") {
        if (status === "CANCELLED") return false;
        if (endMidnight < todayMidnight) return false;
      }

      // "past": completed stay where check-out has passed
      if (filters.tab === "past") {
        // Active/future stays do not belong in past
        if (endMidnight >= todayMidnight && status !== "CANCELLED") return false;
        // In past history tab, show completed stays or cancelled stays if matching status
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
      if (filters.tab === "past") {
        return new Date(right.endDate).getTime() - new Date(left.endDate).getTime();
      }
      return new Date(left.startDate).getTime() - new Date(right.startDate).getTime();
    });
  }, [reservations, filters]);

  // Group past bookings by stay completion year (newest year first, newest stay inside)
  const pastYearGroups = useMemo(() => {
    if (filters.tab !== "past") return [];
    const groups = new Map<number, ReservationCardData[]>();
    const sorted = [...filteredItems].sort(
      (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
    );
    for (const item of sorted) {
      const year = new Date(item.endDate).getUTCFullYear();
      const group = groups.get(year) ?? [];
      group.push(item);
      groups.set(year, group);
    }
    return Array.from(groups, ([year, items]) => ({ year, items })).sort(
      (a, b) => b.year - a.year,
    );
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
      {/* Header & Filter Controls */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        totalCount={filteredItems.length}
      />

      {/* Main Reservation Cards Grid */}
      {error ? (
        <ErrorState message={error} onRetry={() => setError(null)} />
      ) : loading ? (
        <LoadingSkeleton count={4} />
      ) : filteredItems.length === 0 ? (
        filters.tab === "upcoming" && !filters.search ? (
          <EmptyState
            title="No upcoming trips yet"
            description="Time to dust off your bags and start planning your next great adventure."
            actionHref="/"
            actionText="Explore stays"
          />
        ) : filters.tab === "past" && !filters.search ? (
          <div className="space-y-12">
            <EmptyState
              title="No past bookings yet"
              description="Once you complete trips with Homyz, your completed bookings will be cataloged here."
              actionHref="/"
              actionText="Explore stays"
            />
            {/* My Reviews Section below past bookings even if past bookings are empty */}
            <div className="pt-8 border-t border-zinc-200/80">
              <MyReviewsSection reviews={reviews} />
            </div>
          </div>
        ) : (
          <EmptyState
            title={`No ${filters.tab} reservations`}
            description="Try adjusting your search criteria or switching filter tabs."
          />
        )
      ) : filters.tab === "past" ? (
        <div className="flex flex-col gap-12 sm:gap-14">
          <div className="flex flex-col gap-12 sm:gap-14">
            {pastYearGroups.map(({ year, items }) => (
              <section key={year} aria-labelledby={`bookings-year-${year}`}>
                <h2 id={`bookings-year-${year}`} className="text-xl font-semibold leading-7 text-[#1F1F1F] mb-5 sm:text-2xl">
                  {year}
                </h2>
                <div className="grid max-w-[812px] grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <ReservationCard
                      key={item.id}
                      data={item}
                      href={`/bookings/${item.id}`}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Specification Requirement: My Reviews section below Past Bookings */}
          <div className="pt-10 border-t border-zinc-200/80">
            <MyReviewsSection reviews={reviews} />
          </div>
        </div>
      ) : (
        <div className="grid max-w-[812px] grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <ReservationCard
              key={item.id}
              data={item}
              href={`/bookings/${item.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
